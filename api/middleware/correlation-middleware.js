/**
 * Correlation Middleware for Atlas Codex
 * 
 * Provides end-to-end request correlation and structured logging.
 * Addresses: Inability to trace requests through processing pipeline
 * Ensures: Complete request traceability and structured logging
 */

const { getEnvironmentConfig } = require('../config/environment');

/**
 * Correlation Middleware for Request Tracking
 */
class CorrelationMiddleware {
  /**
   * Add correlation ID to request context
   */
  static addCorrelationId(event, context) {
    // Try to get existing correlation ID from headers
    const existingCorrelationId = 
      event.headers?.['x-correlation-id'] ||
      event.headers?.['X-Correlation-Id'] ||
      event.headers?.['correlation-id'] ||
      event.queryStringParameters?.correlationId;
    
    // Generate new correlation ID if not present
    const correlationId = existingCorrelationId || this.generateCorrelationId();
    
    // Add to Lambda context
    context.correlationId = correlationId;
    
    // Add to process environment for downstream operations
    process.env.CORRELATION_ID = correlationId;
    
    // Add request metadata
    const requestMetadata = {
      requestId: context.awsRequestId,
      correlationId: correlationId,
      timestamp: new Date().toISOString(),
      method: event.httpMethod || event.requestContext?.http?.method,
      path: event.path || event.requestContext?.http?.path,
      userAgent: event.headers?.['User-Agent'] || event.headers?.['user-agent'],
      sourceIp: event.requestContext?.identity?.sourceIp || 
                event.requestContext?.http?.sourceIp,
      stage: event.requestContext?.stage,
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      memoryLimit: context.memoryLimitInMB,
      remainingTime: context.getRemainingTimeInMillis()
    };
    
    // Store metadata in context
    context.requestMetadata = requestMetadata;
    
    // Create structured logger
    context.logger = this.createLogger(correlationId, requestMetadata);
    
    // Log request start
    context.logger.info('Request started', {
      event: this.sanitizeEvent(event),
      metadata: requestMetadata
    });
    
    return correlationId;
  }
  
  /**
   * Create structured logger with correlation ID
   */
  static createLogger(correlationId, requestMetadata = {}) {
    const config = getEnvironmentConfig();
    const logLevel = config.isDev ? 'DEBUG' : 'INFO';
    
    return {
      debug: (message, data = {}) => {
        if (logLevel === 'DEBUG') {
          this.log('DEBUG', message, data, correlationId, requestMetadata);
        }
      },
      
      info: (message, data = {}) => {
        this.log('INFO', message, data, correlationId, requestMetadata);
      },
      
      warn: (message, data = {}) => {
        this.log('WARN', message, data, correlationId, requestMetadata);
      },
      
      error: (message, error = null, data = {}) => {
        const errorData = error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
          ...data
        } : data;
        
        this.log('ERROR', message, errorData, correlationId, requestMetadata);
      },
      
      // Performance tracking
      startTimer: (operationName) => {
        const startTime = Date.now();
        return {
          end: (data = {}) => {
            const duration = Date.now() - startTime;
            this.log('INFO', `Operation completed: ${operationName}`, {
              operation: operationName,
              duration: duration,
              ...data
            }, correlationId, requestMetadata);
            return duration;
          }
        };
      },
      
      // Cost tracking
      logCost: (operation, model, estimatedCost, actualCost = null) => {
        this.log('INFO', 'Cost attribution', {
          operation,
          model,
          estimatedCost,
          actualCost,
          currency: 'USD'
        }, correlationId, requestMetadata);
      }
    };
  }
  
  /**
   * Core logging function
   */
  static log(level, message, data, correlationId, requestMetadata) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      correlationId: correlationId,
      requestId: requestMetadata.awsRequestId,
      functionName: requestMetadata.functionName,
      message: message,
      data: data
    };
    
    // Add environment context
    const config = getEnvironmentConfig();
    logEntry.environment = {
      stage: config.stage,
      nodeEnv: config.nodeEnv,
      region: config.region
    };
    
    // Output structured log
    const logMethod = level === 'ERROR' ? console.error : 
                     level === 'WARN' ? console.warn : console.log;
    
    logMethod(JSON.stringify(logEntry));
  }
  
  /**
   * Track job lifecycle events
   */
  static trackJobEvent(logger, jobId, event, data = {}) {
    logger.info(`Job ${event}`, {
      jobId: jobId,
      jobEvent: event,
      ...data
    });
  }
  
  /**
   * Track processing pipeline events
   */
  static trackProcessingEvent(logger, stage, data = {}) {
    logger.info(`Processing: ${stage}`, {
      processingStage: stage,
      ...data
    });
  }
  
  /**
   * Track model usage
   */
  static trackModelUsage(logger, model, inputTokens, outputTokens, cost = null) {
    logger.info('Model usage', {
      model: model,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      },
      estimatedCost: cost
    });
  }
  
  /**
   * Add correlation to outbound requests
   */
  static addToOutboundRequest(headers = {}) {
    const correlationId = process.env.CORRELATION_ID;
    
    if (correlationId) {
      return {
        ...headers,
        'X-Correlation-Id': correlationId
      };
    }
    
    return headers;
  }
  
  /**
   * Finalize request logging
   */
  static finalizeRequest(context, response, error = null) {
    const duration = Date.now() - new Date(context.requestMetadata.timestamp).getTime();
    
    if (error) {
      context.logger.error('Request failed', error, {
        duration: duration,
        response: this.sanitizeResponse(response)
      });
    } else {
      context.logger.info('Request completed', {
        duration: duration,
        statusCode: response?.statusCode,
        responseSize: response?.body ? response.body.length : 0
      });
    }
    
    // Log memory usage
    const memoryUsed = context.memoryLimitInMB - (process.memoryUsage().heapUsed / 1024 / 1024);
    context.logger.debug('Memory usage', {
      memoryLimit: context.memoryLimitInMB,
      memoryUsed: memoryUsed,
      memoryRemaining: context.memoryLimitInMB - memoryUsed
    });
  }
  
  /**
   * Generate correlation ID
   */
  static generateCorrelationId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 8);
    return `corr_${timestamp}_${random}`;
  }
  
  /**
   * Extract job ID from various sources
   */
  static extractJobId(event) {
    return event.pathParameters?.jobId ||
           event.queryStringParameters?.jobId ||
           JSON.parse(event.body || '{}').jobId ||
           null;
  }
  
  /**
   * Sanitize event for logging (remove sensitive data)
   */
  static sanitizeEvent(event) {
    const sanitized = { ...event };
    
    // Remove sensitive headers
    if (sanitized.headers) {
      const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];
      sensitiveHeaders.forEach(header => {
        if (sanitized.headers[header]) {
          sanitized.headers[header] = '[REDACTED]';
        }
        if (sanitized.headers[header.charAt(0).toUpperCase() + header.slice(1)]) {
          sanitized.headers[header.charAt(0).toUpperCase() + header.slice(1)] = '[REDACTED]';
        }
      });
    }
    
    // Sanitize body if it contains API keys
    if (sanitized.body) {
      try {
        const body = JSON.parse(sanitized.body);
        if (body.apiKey || body.api_key) {
          body.apiKey = '[REDACTED]';
          body.api_key = '[REDACTED]';
          sanitized.body = JSON.stringify(body);
        }
      } catch (e) {
        // Body is not JSON, leave as is
      }
    }
    
    return sanitized;
  }
  
  /**
   * Sanitize response for logging
   */
  static sanitizeResponse(response) {
    if (!response) return response;
    
    const sanitized = { ...response };
    
    // Limit body size for logging
    if (sanitized.body && sanitized.body.length > 10000) {
      sanitized.body = sanitized.body.substring(0, 10000) + '... [TRUNCATED]';
    }
    
    return sanitized;
  }
  
  /**
   * Create child logger for sub-operations
   */
  static createChildLogger(parentLogger, operationName, operationData = {}) {
    const childCorrelationId = `${process.env.CORRELATION_ID}_${operationName}_${Math.random().toString(36).substr(2, 4)}`;
    
    const childLogger = {
      ...parentLogger,
      info: (message, data = {}) => {
        parentLogger.info(`[${operationName}] ${message}`, {
          childOperation: operationName,
          childCorrelationId: childCorrelationId,
          ...operationData,
          ...data
        });
      },
      error: (message, error = null, data = {}) => {
        parentLogger.error(`[${operationName}] ${message}`, error, {
          childOperation: operationName,
          childCorrelationId: childCorrelationId,
          ...operationData,
          ...data
        });
      }
    };
    
    return childLogger;
  }
}

module.exports = {
  CorrelationMiddleware
};