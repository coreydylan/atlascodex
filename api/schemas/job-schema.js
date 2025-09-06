/**
 * Canonical Job Schema for Atlas Codex
 * 
 * This is the single source of truth for all job records across the system.
 * All job creation, updates, and validation must use this schema.
 * 
 * Addresses: Schema drift across multiple processing engines
 * Ensures: Consistent job record structure throughout the system
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Initialize AJV with strict validation
const ajv = new Ajv({ 
  strict: true,
  allErrors: true,
  removeAdditional: true, // Remove phantom fields
  useDefaults: true,
  coerceTypes: false
});
addFormats(ajv);

// Canonical Job Schema - Single source of truth
const CANONICAL_JOB_SCHEMA = {
  type: 'object',
  properties: {
    id: { 
      type: 'string', 
      minLength: 1,
      maxLength: 128,
      pattern: '^[a-zA-Z0-9_-]+$'
    },
    type: { 
      type: 'string', 
      enum: ['sync', 'async', 'ai-process', 'batch', 'webhook'] 
    },
    status: { 
      type: 'string', 
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'timeout'] 
    },
    url: { 
      type: 'string', 
      format: 'uri',
      maxLength: 2048
    },
    params: { 
      type: 'object',
      properties: {
        extractionInstructions: { type: 'string', maxLength: 10000 },
        maxPages: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        maxDepth: { type: 'integer', minimum: 1, maximum: 10, default: 2 },
        timeout: { type: 'integer', minimum: 1000, maximum: 300000, default: 120000 },
        UNIFIED_EXTRACTOR_ENABLED: { type: 'boolean', default: true },
        GPT5_ENABLED: { type: 'boolean', default: false },
        modelOverride: { type: 'string', enum: ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano'] }
      },
      required: ['extractionInstructions'],
      additionalProperties: false
    },
    result: { 
      type: ['object', 'null'],
      properties: {
        success: { type: 'boolean' },
        data: { type: 'array' },
        metadata: { 
          type: 'object',
          properties: {
            processingMethod: { type: 'string' },
            modelUsed: { type: 'string' },
            processingTime: { type: 'integer' },
            totalItems: { type: 'integer' },
            pagesProcessed: { type: 'integer' },
            cost: { 
              type: 'object',
              properties: {
                estimated: { type: 'number' },
                actual: { type: 'number' },
                currency: { type: 'string', default: 'USD' }
              }
            }
          }
        },
        error: { type: 'string' }
      },
      required: ['success']
    },
    error: { 
      type: ['string', 'null'],
      maxLength: 5000
    },
    createdAt: { 
      type: 'integer',
      minimum: 1000000000000 // Valid timestamp
    },
    updatedAt: { 
      type: 'integer',
      minimum: 1000000000000 // Valid timestamp
    },
    logs: { 
      type: 'array', 
      items: { 
        type: 'object',
        properties: {
          timestamp: { type: 'integer' },
          level: { type: 'string', enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'] },
          message: { type: 'string', maxLength: 1000 },
          correlationId: { type: 'string' },
          data: { type: 'object' }
        },
        required: ['timestamp', 'level', 'message'],
        additionalProperties: false
      },
      default: []
    },
    // Correlation tracking
    correlationId: {
      type: 'string',
      pattern: '^[a-zA-Z0-9-_]+$',
      maxLength: 64
    },
    // Version for schema evolution
    schemaVersion: {
      type: 'string',
      default: '1.0.0'
    }
  },
  required: ['id', 'type', 'status', 'url', 'params', 'createdAt', 'updatedAt'],
  additionalProperties: false
};

// Compiled validator for performance
const validateJob = ajv.compile(CANONICAL_JOB_SCHEMA);

/**
 * Job Schema Validator
 */
class JobSchemaValidator {
  /**
   * Validate a complete job object
   */
  static validateJob(jobData) {
    const isValid = validateJob(jobData);
    
    if (!isValid) {
      const errors = validateJob.errors.map(error => ({
        field: error.instancePath || error.schemaPath,
        message: error.message,
        value: error.data
      }));
      
      throw new Error(`Job schema validation failed: ${JSON.stringify(errors)}`);
    }
    
    return jobData;
  }
  
  /**
   * Validate job creation data (before adding timestamps/id)
   */
  static validateJobCreation(jobData) {
    const requiredFields = ['type', 'url', 'params'];
    const missing = requiredFields.filter(field => !jobData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields for job creation: ${missing.join(', ')}`);
    }
    
    // Validate params structure
    if (!jobData.params.extractionInstructions) {
      throw new Error('extractionInstructions is required in params');
    }
    
    // Validate URL format
    try {
      new URL(jobData.url);
    } catch (error) {
      throw new Error(`Invalid URL format: ${jobData.url}`);
    }
    
    return true;
  }
  
  /**
   * Validate job update data
   */
  static validateJobUpdate(updateData) {
    const allowedFields = ['status', 'result', 'error', 'updatedAt', 'logs'];
    const invalidFields = Object.keys(updateData).filter(field => 
      !allowedFields.includes(field)
    );
    
    if (invalidFields.length > 0) {
      throw new Error(`Invalid fields for job update: ${invalidFields.join(', ')}`);
    }
    
    // Validate status transitions
    if (updateData.status) {
      this.validateStatusTransition(updateData.status);
    }
    
    return true;
  }
  
  /**
   * Validate status transitions
   */
  static validateStatusTransition(newStatus) {
    const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'timeout'];
    
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    return true;
  }
  
  /**
   * Sanitize job data for storage (remove undefined, null, etc.)
   */
  static sanitizeJob(jobData) {
    const sanitized = JSON.parse(JSON.stringify(jobData));
    
    // Set defaults
    if (!sanitized.logs) sanitized.logs = [];
    if (!sanitized.schemaVersion) sanitized.schemaVersion = '1.0.0';
    if (!sanitized.params.maxPages) sanitized.params.maxPages = 10;
    if (!sanitized.params.maxDepth) sanitized.params.maxDepth = 2;
    if (!sanitized.params.timeout) sanitized.params.timeout = 120000;
    
    return sanitized;
  }
  
  /**
   * Migrate old job format to canonical schema
   */
  static migrateJob(oldJob) {
    const migrated = {
      id: oldJob.id || oldJob.jobId || this.generateJobId(),
      type: oldJob.type || 'sync',
      status: this.normalizeStatus(oldJob.status),
      url: oldJob.url,
      params: {
        extractionInstructions: oldJob.extractionInstructions || oldJob.params?.extractionInstructions || '',
        maxPages: oldJob.maxPages || oldJob.params?.maxPages || 10,
        maxDepth: oldJob.maxDepth || oldJob.params?.maxDepth || 2,
        timeout: oldJob.timeout || oldJob.params?.timeout || 120000,
        UNIFIED_EXTRACTOR_ENABLED: oldJob.UNIFIED_EXTRACTOR_ENABLED ?? true
      },
      result: oldJob.result || null,
      error: oldJob.error || null,
      createdAt: oldJob.createdAt || oldJob.created_at || Date.now(),
      updatedAt: oldJob.updatedAt || oldJob.updated_at || Date.now(),
      logs: oldJob.logs || [],
      correlationId: oldJob.correlationId || this.generateCorrelationId(),
      schemaVersion: '1.0.0'
    };
    
    // Clean up the migrated object
    return this.sanitizeJob(migrated);
  }
  
  /**
   * Normalize status values from old system
   */
  static normalizeStatus(oldStatus) {
    const statusMap = {
      'queued': 'pending',
      'running': 'processing',
      'done': 'completed',
      'error': 'failed',
      'cancelled': 'cancelled'
    };
    
    return statusMap[oldStatus] || oldStatus || 'pending';
  }
  
  /**
   * Generate job ID
   */
  static generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
  
  /**
   * Generate correlation ID
   */
  static generateCorrelationId() {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
  
  /**
   * Get schema version
   */
  static getSchemaVersion() {
    return '1.0.0';
  }
}

module.exports = {
  CANONICAL_JOB_SCHEMA,
  JobSchemaValidator,
  validateJob
};