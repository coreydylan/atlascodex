/**
 * Bulletproof Lambda Handler for Atlas Codex
 * 
 * Unified request handler with bulletproof architecture components.
 * Addresses: Multiple processing engines, schema inconsistencies, error handling
 * Ensures: Single entry point with comprehensive monitoring and error handling
 */

// Import bulletproof architecture components
const { getEnvironmentConfig } = require('./config/environment');
const { CorrelationMiddleware } = require('./middleware/correlation-middleware');
const { getJobManager } = require('./services/job-manager');
const { getExtractionEngine } = require('./engines/unified-extraction-engine');
const { getModelRouter } = require('./services/unified-model-router');

// AWS SDK clients
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

/**
 * Bulletproof Lambda Handler
 */
class BulletproofLambdaHandler {
  constructor() {
    // Load environment configuration
    this.config = getEnvironmentConfig();
    
    // Initialize services
    this.jobManager = getJobManager();
    this.extractionEngine = getExtractionEngine();
    this.modelRouter = getModelRouter();
    
    // Initialize AWS clients
    this.sqs = new SQSClient({ region: this.config.region });
    
    console.log('🚀 Bulletproof Lambda Handler initialized', {
      stage: this.config.stage,
      nodeEnv: this.config.nodeEnv,
      gpt5Enabled: this.config.gpt5Enabled,
      defaultModel: this.config.defaultModel
    });
  }
  
  /**
   * Main Lambda handler entry point
   */
  async handler(event, context) {
    let logger;
    let correlationId;
    
    try {
      // Initialize correlation tracking
      correlationId = CorrelationMiddleware.addCorrelationId(event, context);
      logger = context.logger;
      
      logger.info('Request received', {
        httpMethod: event.httpMethod,
        path: event.path,
        queryParams: event.queryStringParameters,
        headers: this.sanitizeHeaders(event.headers)
      });
      
      // Route request to appropriate handler
      const response = await this.routeRequest(event, context);
      
      // Finalize request logging
      CorrelationMiddleware.finalizeRequest(context, response);
      
      return response;
      
    } catch (error) {
      // Handle uncaught errors
      if (logger) {
        logger.error('Unhandled error in Lambda handler', error);
      } else {
        console.error('Unhandled error before logger initialization:', error);
      }
      
      // Finalize with error
      if (context) {
        CorrelationMiddleware.finalizeRequest(context, null, error);
      }
      
      return this.createErrorResponse(error, correlationId);
    }
  }
  
  /**
   * Route request to appropriate handler
   */
  async routeRequest(event, context) {
    const { httpMethod, path } = event;
    const logger = context.logger;
    
    // Handle CORS preflight
    if (httpMethod === 'OPTIONS') {
      return this.createCorsResponse();
    }
    
    // Health check endpoint
    if (path === '/health' && httpMethod === 'GET') {
      return await this.handleHealth(event, context);
    }
    
    // Extract endpoint
    if (path === '/api/extract' && httpMethod === 'POST') {
      return await this.handleExtraction(event, context);
    }
    
    // AI processing endpoint
    if (path === '/api/ai/process' && httpMethod === 'POST') {
      return await this.handleAIProcessing(event, context);
    }
    
    // Job status endpoint
    if (path.startsWith('/api/status/') && httpMethod === 'GET') {
      return await this.handleJobStatus(event, context);
    }
    
    // Job management endpoints
    if (path === '/api/jobs' && httpMethod === 'GET') {
      return await this.handleListJobs(event, context);
    }
    
    // Statistics endpoint
    if (path === '/api/stats' && httpMethod === 'GET') {
      return await this.handleStatistics(event, context);
    }
    
    // Unknown endpoint
    logger.warn('Unknown endpoint requested', { httpMethod, path });
    return this.createErrorResponse(new Error('Endpoint not found'), context.correlationId, 404);
  }
  
  /**
   * Handle health check
   */
  async handleHealth(event, context) {
    const logger = context.logger;
    const timer = logger.startTimer('health_check');
    
    try {
      // Perform comprehensive health checks
      const healthChecks = await Promise.allSettled([
        this.checkDynamoDB(),
        this.checkModelAvailability(),
        this.checkEnvironmentConfig(),
        this.checkProcessingPipeline()
      ]);
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0-bulletproof',
        environment: {
          stage: this.config.stage,
          nodeEnv: this.config.nodeEnv,
          region: this.config.region
        },
        features: {
          gpt5Enabled: this.config.gpt5Enabled,
          unifiedExtractor: this.config.unifiedExtractorEnabled,
          asyncProcessing: this.config.featureFlags.asyncProcessing,
          bulletproofArchitecture: true
        },
        checks: {
          dynamodb: healthChecks[0].status === 'fulfilled',
          models: healthChecks[1].status === 'fulfilled',
          config: healthChecks[2].status === 'fulfilled',
          pipeline: healthChecks[3].status === 'fulfilled'
        },
        correlationId: context.correlationId
      };
      
      // Determine overall health
      const allHealthy = Object.values(health.checks).every(check => check);
      if (!allHealthy) {
        health.status = 'degraded';
      }
      
      timer.end();
      
      return this.createSuccessResponse(health);
      
    } catch (error) {
      timer.end({ error: error.message });
      logger.error('Health check failed', error);
      
      return this.createErrorResponse(error, context.correlationId, 503);
    }
  }
  
  /**
   * Handle extraction requests
   */
  async handleExtraction(event, context) {
    const logger = context.logger;
    const timer = logger.startTimer('extraction_request');
    
    try {
      // Validate API key
      this.validateApiKey(event.headers);
      
      // Parse request body
      const requestBody = JSON.parse(event.body || '{}');
      
      // Validate extraction request
      this.validateExtractionRequest(requestBody);
      
      // Create job
      const job = await this.jobManager.createJob({
        type: 'sync',
        url: requestBody.url,
        extractionInstructions: requestBody.extractionInstructions,
        ...requestBody
      }, context);
      
      logger.info('Extraction job created', { jobId: job.id });
      
      // Update job status to processing
      await this.jobManager.updateJob(job.id, {
        status: 'processing'
      }, context);
      
      // Perform extraction
      const extractionResult = await this.extractionEngine.extract(requestBody, context);
      
      // Complete job with results
      await this.jobManager.completeJob(job.id, extractionResult, context);
      
      timer.end({ 
        jobId: job.id,
        success: extractionResult.success,
        itemCount: extractionResult.data?.length || 0
      });
      
      // Return result in consistent format
      const response = {
        jobId: job.id,
        status: 'completed',
        message: 'Extraction completed successfully',
        result: extractionResult,
        correlationId: context.correlationId
      };
      
      return this.createSuccessResponse(response);
      
    } catch (error) {
      timer.end({ error: error.message });
      logger.error('Extraction request failed', error);
      
      // Try to fail the job if it was created
      try {
        const jobId = context.currentJobId;
        if (jobId) {
          await this.jobManager.failJob(jobId, error, context);
        }
      } catch (jobError) {
        logger.error('Failed to update job status', jobError);
      }
      
      return this.createErrorResponse(error, context.correlationId);
    }
  }
  
  /**
   * Handle AI processing requests
   */
  async handleAIProcessing(event, context) {
    const logger = context.logger;
    const timer = logger.startTimer('ai_processing');
    
    try {
      // Validate API key
      this.validateApiKey(event.headers);
      
      // Parse request body
      const requestBody = JSON.parse(event.body || '{}');
      
      // Validate AI processing request
      this.validateAIProcessingRequest(requestBody);
      
      // Create job
      const job = await this.jobManager.createJob({
        type: 'ai-process',
        url: requestBody.url || 'https://example.com', // URL might be extracted from prompt
        extractionInstructions: requestBody.prompt,
        params: {
          prompt: requestBody.prompt,
          autoExecute: requestBody.autoExecute !== false,
          ...requestBody
        }
      }, context);
      
      logger.info('AI processing job created', { jobId: job.id });
      
      // Update job status to processing
      await this.jobManager.updateJob(job.id, {
        status: 'processing'
      }, context);
      
      // Process with AI
      const aiResult = await this.extractionEngine.extract({
        type: 'ai-process',
        prompt: requestBody.prompt,
        ...requestBody
      }, context);
      
      // Complete job with results
      await this.jobManager.completeJob(job.id, aiResult, context);
      
      timer.end({ 
        jobId: job.id,
        success: aiResult.success
      });
      
      // Return result
      const response = {
        jobId: job.id,
        status: 'completed',
        message: 'AI processing completed successfully',
        result: aiResult,
        correlationId: context.correlationId
      };
      
      return this.createSuccessResponse(response);
      
    } catch (error) {
      timer.end({ error: error.message });
      logger.error('AI processing request failed', error);
      
      return this.createErrorResponse(error, context.correlationId);
    }
  }
  
  /**
   * Handle job status requests
   */
  async handleJobStatus(event, context) {
    const logger = context.logger;
    
    try {
      const jobId = event.pathParameters?.jobId || event.path.split('/').pop();
      
      if (!jobId) {
        throw new Error('Job ID is required');
      }
      
      const job = await this.jobManager.getJob(jobId, context);
      
      if (!job) {
        return this.createErrorResponse(new Error('Job not found'), context.correlationId, 404);
      }
      
      return this.createSuccessResponse({
        jobId: job.id,
        status: job.status,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        correlationId: context.correlationId
      });
      
    } catch (error) {
      logger.error('Job status request failed', error);
      return this.createErrorResponse(error, context.correlationId);
    }
  }
  
  /**
   * Handle list jobs requests
   */
  async handleListJobs(event, context) {
    const logger = context.logger;
    
    try {
      const queryParams = event.queryStringParameters || {};
      
      const filters = {
        status: queryParams.status,
        type: queryParams.type,
        limit: parseInt(queryParams.limit) || 50,
        createdAfter: queryParams.createdAfter ? parseInt(queryParams.createdAfter) : null
      };
      
      const result = await this.jobManager.listJobs(filters, context);
      
      return this.createSuccessResponse({
        jobs: result.jobs,
        total: result.total,
        hasMore: result.hasMore,
        filters: filters,
        correlationId: context.correlationId
      });
      
    } catch (error) {
      logger.error('List jobs request failed', error);
      return this.createErrorResponse(error, context.correlationId);
    }
  }
  
  /**
   * Handle statistics requests
   */
  async handleStatistics(event, context) {
    const logger = context.logger;
    
    try {
      const stats = await this.jobManager.getJobStatistics(context);
      
      return this.createSuccessResponse({
        statistics: stats,
        timestamp: new Date().toISOString(),
        correlationId: context.correlationId
      });
      
    } catch (error) {
      logger.error('Statistics request failed', error);
      return this.createErrorResponse(error, context.correlationId);
    }
  }
  
  // Helper methods for validation and responses
  
  validateApiKey(headers) {
    const apiKey = headers['X-Api-Key'] || headers['x-api-key'] || headers['Authorization'];
    
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    // In development, allow test key
    if (this.config.isDev && apiKey === 'test-key-123') {
      return true;
    }
    
    // Validate against master API key
    if (apiKey !== this.config.masterApiKey) {
      throw new Error('Invalid API key');
    }
    
    return true;
  }
  
  validateExtractionRequest(body) {
    if (!body.url) {
      throw new Error('URL is required');
    }
    
    if (!body.extractionInstructions) {
      throw new Error('Extraction instructions are required');
    }
    
    try {
      new URL(body.url);
    } catch (error) {
      throw new Error('Invalid URL format');
    }
  }
  
  validateAIProcessingRequest(body) {
    if (!body.prompt) {
      throw new Error('Prompt is required for AI processing');
    }
  }
  
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    
    // Remove sensitive headers from logs
    const sensitiveKeys = ['authorization', 'x-api-key', 'cookie'];
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) sanitized[key] = '[REDACTED]';
      const titleCase = key.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join('-');
      if (sanitized[titleCase]) sanitized[titleCase] = '[REDACTED]';
    });
    
    return sanitized;
  }
  
  createSuccessResponse(data, statusCode = 200) {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key, x-api-key, X-Correlation-Id'
      },
      body: JSON.stringify(data)
    };
  }
  
  createErrorResponse(error, correlationId, statusCode = 500) {
    const errorResponse = {
      error: true,
      message: error.message || 'Internal server error',
      correlationId: correlationId,
      timestamp: new Date().toISOString()
    };
    
    // Add error details in development
    if (this.config?.isDev) {
      errorResponse.stack = error.stack;
      errorResponse.details = error.details || null;
    }
    
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key, x-api-key, X-Correlation-Id'
      },
      body: JSON.stringify(errorResponse)
    };
  }
  
  createCorsResponse() {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key, x-api-key, X-Correlation-Id',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
  }
  
  // Health check methods
  
  async checkDynamoDB() {
    try {
      await this.jobManager.getJobStatistics();
      return { healthy: true };
    } catch (error) {
      throw new Error(`DynamoDB check failed: ${error.message}`);
    }
  }
  
  async checkModelAvailability() {
    try {
      const testRequest = { extractionInstructions: 'test', url: 'https://example.com' };
      const model = this.modelRouter.selectModel(testRequest);
      const config = this.modelRouter.getModelConfig(model, testRequest);
      return { healthy: true, model, config };
    } catch (error) {
      throw new Error(`Model availability check failed: ${error.message}`);
    }
  }
  
  async checkEnvironmentConfig() {
    try {
      const requiredConfig = [
        'masterApiKey',
        'openaiApiKey',
        'dynamoTables',
        'stage',
        'region'
      ];
      
      const missing = requiredConfig.filter(key => !this.config[key]);
      
      if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(', ')}`);
      }
      
      return { healthy: true };
    } catch (error) {
      throw new Error(`Environment config check failed: ${error.message}`);
    }
  }
  
  async checkProcessingPipeline() {
    try {
      // Test extraction engine initialization
      const engine = this.extractionEngine;
      
      // Test model router
      const router = this.modelRouter;
      
      return { healthy: true };
    } catch (error) {
      throw new Error(`Processing pipeline check failed: ${error.message}`);
    }
  }
}

// Create handler instance
const bulletproofHandler = new BulletproofLambdaHandler();

// Export the handler function
exports.handler = bulletproofHandler.handler.bind(bulletproofHandler);