/**
 * Atomic Job Manager for Atlas Codex
 * 
 * Single job management system with atomic operations and canonical schema.
 * Addresses: Job creation and status updates in different transactions
 * Ensures: Atomic operations with consistent schema validation
 */

const { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand, ScanCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { getEnvironmentConfig } = require('../config/environment');
const { JobSchemaValidator } = require('../schemas/job-schema');
const { CorrelationMiddleware } = require('../middleware/correlation-middleware');

/**
 * Atomic Job Manager
 * Manages job lifecycle with atomic operations and schema validation
 */
class JobManager {
  constructor() {
    this.config = getEnvironmentConfig();
    
    // Initialize DynamoDB client
    this.dynamodb = new DynamoDBClient({ 
      region: this.config.region 
    });
    
    // Table configuration
    this.tableName = this.config.dynamoTables?.jobs || this.config.jobsTable || 'atlas-codex-jobs-test';
    
    // Operation timeout
    this.operationTimeout = 5000;
  }
  
  /**
   * Create new job with atomic operation
   */
  async createJob(jobData, context = {}) {
    const logger = context.logger || CorrelationMiddleware.createLogger(
      context.correlationId || CorrelationMiddleware.generateCorrelationId()
    );
    
    const timer = logger.startTimer('job_creation');
    
    try {
      // Validate job creation data
      JobSchemaValidator.validateJobCreation(jobData);
      
      // Create job with canonical schema
      const job = this.buildCanonicalJob(jobData, context);
      
      // Validate complete job object
      JobSchemaValidator.validateJob(job);
      
      // Sanitize for storage
      const sanitizedJob = JobSchemaValidator.sanitizeJob(job);
      
      logger.info('Creating job', { 
        jobId: job.id, 
        type: job.type, 
        url: job.url 
      });
      
      // Atomic creation in DynamoDB
      await this.putJobAtomic(sanitizedJob, logger);
      
      // Log job creation
      await this.addJobLog(job.id, 'INFO', 'Job created', { 
        initialStatus: job.status,
        createdBy: context.userId || 'system'
      }, logger);
      
      timer.end({ jobId: job.id });
      
      CorrelationMiddleware.trackJobEvent(logger, job.id, 'created', {
        type: job.type,
        url: job.url
      });
      
      return job;
      
    } catch (error) {
      timer.end({ error: error.message });
      logger.error('Job creation failed', error);
      throw error;
    }
  }
  
  /**
   * Update job with atomic operation
   */
  async updateJob(jobId, updates, context = {}) {
    const logger = context.logger || CorrelationMiddleware.createLogger(
      context.correlationId || CorrelationMiddleware.generateCorrelationId()
    );
    
    const timer = logger.startTimer('job_update');
    
    try {
      // Validate update data
      JobSchemaValidator.validateJobUpdate(updates);
      
      // Get current job for validation
      const currentJob = await this.getJob(jobId, { logger });
      if (!currentJob) {
        throw new Error(`Job ${jobId} not found`);
      }
      
      // Prepare atomic update
      const updateData = {
        ...updates,
        updatedAt: Date.now()
      };
      
      // Validate status transition if status is being updated
      if (updates.status) {
        this.validateStatusTransition(currentJob.status, updates.status);
      }
      
      logger.info('Updating job', { 
        jobId, 
        updates: Object.keys(updates),
        currentStatus: currentJob.status,
        newStatus: updates.status
      });
      
      // Perform atomic update
      const updatedJob = await this.updateJobAtomic(jobId, updateData, logger);
      
      // Add log entry for significant updates
      if (updates.status || updates.error || updates.result) {
        const logMessage = updates.status ? 
          `Job status changed to ${updates.status}` :
          updates.error ? 'Job error occurred' :
          'Job result updated';
        
        await this.addJobLog(jobId, 
          updates.error ? 'ERROR' : 'INFO', 
          logMessage, 
          updates, 
          logger
        );
      }
      
      timer.end({ jobId, updatesApplied: Object.keys(updates).length });
      
      CorrelationMiddleware.trackJobEvent(logger, jobId, 'updated', {
        status: updates.status,
        hasResult: !!updates.result,
        hasError: !!updates.error
      });
      
      return updatedJob;
      
    } catch (error) {
      timer.end({ jobId, error: error.message });
      logger.error('Job update failed', error, { jobId });
      throw error;
    }
  }
  
  /**
   * Get job by ID
   */
  async getJob(jobId, context = {}) {
    const logger = context.logger || CorrelationMiddleware.createLogger(
      context.correlationId || CorrelationMiddleware.generateCorrelationId()
    );
    
    try {
      const command = new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ id: jobId }),
        ConsistentRead: true
      });
      
      const result = await this.dynamodb.send(command);
      
      if (!result.Item) {
        return null;
      }
      
      const job = unmarshall(result.Item);
      
      // Migrate old job format if necessary
      if (!job.schemaVersion || job.schemaVersion !== '1.0.0') {
        const migratedJob = JobSchemaValidator.migrateJob(job);
        
        // Update with migrated data
        await this.updateJobAtomic(jobId, {
          schemaVersion: '1.0.0',
          ...migratedJob
        }, logger, true);
        
        return migratedJob;
      }
      
      return job;
      
    } catch (error) {
      logger.error('Failed to get job', error, { jobId });
      throw error;
    }
  }
  
  /**
   * List jobs with filtering
   */
  async listJobs(filters = {}, context = {}) {
    const logger = context.logger || CorrelationMiddleware.createLogger(
      context.correlationId || CorrelationMiddleware.generateCorrelationId()
    );
    
    try {
      const scanParams = {
        TableName: this.tableName,
        Limit: filters.limit || 100
      };
      
      // Add filter expressions
      if (filters.status) {
        scanParams.FilterExpression = '#status = :status';
        scanParams.ExpressionAttributeNames = { '#status': 'status' };
        scanParams.ExpressionAttributeValues = marshall({ ':status': filters.status });
      }
      
      const command = new ScanCommand(scanParams);
      const result = await this.dynamodb.send(command);
      
      const jobs = result.Items.map(item => unmarshall(item));
      
      // Apply additional filters
      let filteredJobs = jobs;
      
      if (filters.type) {
        filteredJobs = filteredJobs.filter(job => job.type === filters.type);
      }
      
      if (filters.createdAfter) {
        filteredJobs = filteredJobs.filter(job => job.createdAt > filters.createdAfter);
      }
      
      // Sort by creation time (newest first)
      filteredJobs.sort((a, b) => b.createdAt - a.createdAt);
      
      return {
        jobs: filteredJobs,
        total: filteredJobs.length,
        hasMore: !!result.LastEvaluatedKey
      };
      
    } catch (error) {
      logger.error('Failed to list jobs', error, { filters });
      throw error;
    }
  }
  
  /**
   * Complete job with result
   */
  async completeJob(jobId, result, context = {}) {
    const updates = {
      status: 'completed',
      result: result,
      error: null
    };
    
    return await this.updateJob(jobId, updates, context);
  }
  
  /**
   * Fail job with error
   */
  async failJob(jobId, error, context = {}) {
    const updates = {
      status: 'failed',
      error: typeof error === 'string' ? error : error.message,
      result: null
    };
    
    return await this.updateJob(jobId, updates, context);
  }
  
  /**
   * Cancel job
   */
  async cancelJob(jobId, reason = '', context = {}) {
    const updates = {
      status: 'cancelled',
      error: reason || 'Job cancelled'
    };
    
    return await this.updateJob(jobId, updates, context);
  }
  
  /**
   * Delete job (use with caution)
   */
  async deleteJob(jobId, context = {}) {
    const logger = context.logger || CorrelationMiddleware.createLogger(
      context.correlationId || CorrelationMiddleware.generateCorrelationId()
    );
    
    try {
      const command = new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ id: jobId }),
        ReturnValues: 'ALL_OLD'
      });
      
      const result = await this.dynamodb.send(command);
      
      if (result.Attributes) {
        const deletedJob = unmarshall(result.Attributes);
        
        CorrelationMiddleware.trackJobEvent(logger, jobId, 'deleted', {
          status: deletedJob.status
        });
        
        return deletedJob;
      }
      
      return null;
      
    } catch (error) {
      logger.error('Failed to delete job', error, { jobId });
      throw error;
    }
  }
  
  /**
   * Add log entry to job
   */
  async addJobLog(jobId, level, message, data = {}, logger) {
    try {
      const logEntry = {
        timestamp: Date.now(),
        level: level,
        message: message,
        correlationId: process.env.CORRELATION_ID,
        data: data
      };
      
      const command = new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ id: jobId }),
        UpdateExpression: 'SET logs = list_append(if_not_exists(logs, :empty_list), :log_entry), updatedAt = :timestamp',
        ExpressionAttributeValues: marshall({
          ':empty_list': [],
          ':log_entry': [logEntry],
          ':timestamp': Date.now()
        })
      });
      
      await this.dynamodb.send(command);
      
    } catch (error) {
      logger?.error('Failed to add job log', error, { jobId, level, message });
      // Don't throw - logging failure shouldn't break the main operation
    }
  }
  
  /**
   * Get job statistics
   */
  async getJobStatistics(context = {}) {
    const logger = context.logger || CorrelationMiddleware.createLogger(
      context.correlationId || CorrelationMiddleware.generateCorrelationId()
    );
    
    try {
      const allJobs = await this.listJobs({ limit: 1000 }, { logger });
      const jobs = allJobs.jobs;
      
      const stats = {
        total: jobs.length,
        byStatus: {},
        byType: {},
        avgProcessingTime: 0,
        successRate: 0,
        oldestJob: null,
        newestJob: null
      };
      
      let totalProcessingTime = 0;
      let completedJobs = 0;
      let successfulJobs = 0;
      
      jobs.forEach(job => {
        // Status statistics
        stats.byStatus[job.status] = (stats.byStatus[job.status] || 0) + 1;
        
        // Type statistics
        stats.byType[job.type] = (stats.byType[job.type] || 0) + 1;
        
        // Processing time for completed jobs
        if (job.status === 'completed' || job.status === 'failed') {
          const processingTime = job.updatedAt - job.createdAt;
          totalProcessingTime += processingTime;
          completedJobs++;
          
          if (job.status === 'completed') {
            successfulJobs++;
          }
        }
        
        // Oldest and newest jobs
        if (!stats.oldestJob || job.createdAt < stats.oldestJob.createdAt) {
          stats.oldestJob = job;
        }
        
        if (!stats.newestJob || job.createdAt > stats.newestJob.createdAt) {
          stats.newestJob = job;
        }
      });
      
      // Calculate averages
      if (completedJobs > 0) {
        stats.avgProcessingTime = Math.round(totalProcessingTime / completedJobs);
        stats.successRate = Math.round((successfulJobs / completedJobs) * 100);
      }
      
      return stats;
      
    } catch (error) {
      logger.error('Failed to get job statistics', error);
      throw error;
    }
  }
  
  // Private helper methods
  
  /**
   * Build canonical job object
   */
  buildCanonicalJob(jobData, context) {
    const now = Date.now();
    const correlationId = context.correlationId || CorrelationMiddleware.generateCorrelationId();
    
    return {
      id: JobSchemaValidator.generateJobId(),
      type: jobData.type || 'sync',
      status: 'pending',
      url: jobData.url,
      params: {
        extractionInstructions: jobData.extractionInstructions || jobData.params?.extractionInstructions,
        maxPages: jobData.maxPages || jobData.params?.maxPages || 10,
        maxDepth: jobData.maxDepth || jobData.params?.maxDepth || 2,
        timeout: jobData.timeout || jobData.params?.timeout || 120000,
        UNIFIED_EXTRACTOR_ENABLED: jobData.UNIFIED_EXTRACTOR_ENABLED ?? true,
        GPT5_ENABLED: jobData.GPT5_ENABLED ?? this.config.gpt5Enabled,
        modelOverride: jobData.modelOverride || jobData.params?.modelOverride,
        ...jobData.params
      },
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      logs: [],
      correlationId: correlationId,
      schemaVersion: '1.0.0'
    };
  }
  
  /**
   * Atomic DynamoDB put operation
   */
  async putJobAtomic(job, logger) {
    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(job),
      ConditionExpression: 'attribute_not_exists(id)' // Prevent overwrites
    });
    
    try {
      await this.dynamodb.send(command);
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error(`Job ${job.id} already exists`);
      }
      throw error;
    }
  }
  
  /**
   * Atomic DynamoDB update operation
   */
  async updateJobAtomic(jobId, updates, logger, isMigration = false) {
    const updateExpressions = [];
    const attributeNames = {};
    const attributeValues = {};
    
    Object.entries(updates).forEach(([key, value], index) => {
      const nameKey = `#attr${index}`;
      const valueKey = `:val${index}`;
      
      updateExpressions.push(`${nameKey} = ${valueKey}`);
      attributeNames[nameKey] = key;
      attributeValues[valueKey] = value;
    });
    
    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({ id: jobId }),
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: marshall(attributeValues),
      ConditionExpression: isMigration ? undefined : 'attribute_exists(id)',
      ReturnValues: 'ALL_NEW'
    });
    
    try {
      const result = await this.dynamodb.send(command);
      return unmarshall(result.Attributes);
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error(`Job ${jobId} not found or cannot be updated`);
      }
      throw error;
    }
  }
  
  /**
   * Validate status transitions
   */
  validateStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      'pending': ['processing', 'cancelled', 'failed'],
      'processing': ['completed', 'failed', 'cancelled', 'timeout'],
      'completed': [], // Terminal state
      'failed': ['processing'], // Allow retry
      'cancelled': ['processing'], // Allow restart
      'timeout': ['processing'] // Allow retry
    };
    
    const allowed = validTransitions[currentStatus] || [];
    
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }
}

// Singleton instance
let jobManagerInstance = null;

/**
 * Get job manager singleton
 */
function getJobManager() {
  if (!jobManagerInstance) {
    jobManagerInstance = new JobManager();
  }
  return jobManagerInstance;
}

/**
 * Reset job manager (for testing)
 */
function resetJobManager() {
  jobManagerInstance = null;
}

module.exports = {
  JobManager,
  getJobManager,
  resetJobManager
};