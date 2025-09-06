#!/usr/bin/env node
/**
 * Bulletproof Deployment Validation Script
 * 
 * Validates that the bulletproof architecture is correctly deployed and functioning.
 * Run this script after deployment to ensure system integrity.
 */

const { getEnvironmentConfig } = require('../api/config/environment');
const { getHealthMonitor } = require('../api/services/health-monitor');
const { getJobManager } = require('../api/services/job-manager');
const { CorrelationMiddleware } = require('../api/middleware/correlation-middleware');

/**
 * Deployment Validation Suite
 */
class DeploymentValidator {
  constructor() {
    this.correlationId = CorrelationMiddleware.generateCorrelationId();
    this.logger = CorrelationMiddleware.createLogger(this.correlationId);
    
    this.validationResults = {
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      overall: false,
      checks: {},
      errors: [],
      warnings: [],
      recommendations: []
    };
  }
  
  /**
   * Run complete deployment validation
   */
  async validate() {
    this.logger.info('🚀 Starting bulletproof deployment validation');
    
    try {
      // Run validation checks in sequence for better error handling
      await this.validateEnvironmentConfig();
      await this.validateDatabaseConnectivity();
      await this.validateHealthMonitoring();
      await this.validateProcessingPipeline();
      await this.validateSchemaConsistency();
      await this.validateModelRouting();
      await this.validateJobManagement();
      await this.validateErrorHandling();
      await this.validatePerformanceMetrics();
      
      // Calculate overall result
      this.calculateOverallResult();
      
      // Generate report
      this.generateReport();
      
      return this.validationResults;
      
    } catch (error) {
      this.logger.error('Validation suite failed', error);
      this.validationResults.errors.push({
        check: 'validation_suite',
        error: error.message,
        critical: true
      });
      
      this.validationResults.overall = false;
      this.generateReport();
      
      return this.validationResults;
    }
  }
  
  /**
   * Validate environment configuration
   */
  async validateEnvironmentConfig() {
    const checkName = 'environment_config';
    this.logger.info('Validating environment configuration');
    
    try {
      const config = getEnvironmentConfig();
      
      const check = {
        passed: true,
        details: {
          stage: config.stage,
          nodeEnv: config.nodeEnv,
          region: config.region,
          gpt5Enabled: config.gpt5Enabled,
          defaultModel: config.defaultModel
        },
        issues: []
      };
      
      // Required configuration checks
      const requiredFields = [
        'masterApiKey', 'openaiApiKey', 'stage', 'region', 
        'dynamoTables', 'defaultModel'
      ];
      
      requiredFields.forEach(field => {
        if (!config[field]) {
          check.issues.push(`Missing required field: ${field}`);
          check.passed = false;
        }
      });
      
      // Environment-specific validations
      if (config.isProd && config.masterApiKey === 'test-key-123') {
        check.issues.push('Production using test API key');
        check.passed = false;
      }
      
      if (config.gpt5Enabled && config.forceGpt4) {
        check.issues.push('Conflicting GPT configuration');
        check.passed = false;
      }
      
      // Table naming consistency
      const expectedTableName = `atlas-codex-jobs-${config.stage}`;
      if (config.dynamoTables.jobs !== expectedTableName) {
        check.issues.push(`Table name inconsistency: expected ${expectedTableName}, got ${config.dynamoTables.jobs}`);
        check.passed = false;
      }
      
      this.validationResults.checks[checkName] = check;
      
      if (!check.passed) {
        this.validationResults.errors.push(...check.issues.map(issue => ({
          check: checkName,
          error: issue,
          critical: true
        })));
      }
      
    } catch (error) {
      this.validationResults.checks[checkName] = {
        passed: false,
        error: error.message
      };
      this.validationResults.errors.push({
        check: checkName,
        error: error.message,
        critical: true
      });
    }
  }
  
  /**
   * Validate database connectivity
   */
  async validateDatabaseConnectivity() {
    const checkName = 'database_connectivity';
    this.logger.info('Validating database connectivity');
    
    try {
      const jobManager = getJobManager();
      
      // Test basic database operations
      const startTime = Date.now();
      const stats = await jobManager.getJobStatistics({ logger: this.logger });
      const responseTime = Date.now() - startTime;
      
      const check = {
        passed: responseTime < 5000, // 5 second threshold
        details: {
          responseTime: responseTime,
          totalJobs: stats.total,
          tableAccessible: true
        },
        issues: []
      };
      
      if (responseTime > 5000) {
        check.issues.push(`Slow database response: ${responseTime}ms`);
      }
      
      this.validationResults.checks[checkName] = check;
      
      if (!check.passed) {
        this.validationResults.warnings.push(...check.issues.map(issue => ({
          check: checkName,
          warning: issue
        })));
      }
      
    } catch (error) {
      this.validationResults.checks[checkName] = {
        passed: false,
        error: error.message
      };
      this.validationResults.errors.push({
        check: checkName,
        error: error.message,
        critical: true
      });
    }
  }
  
  /**
   * Validate health monitoring
   */
  async validateHealthMonitoring() {
    const checkName = 'health_monitoring';
    this.logger.info('Validating health monitoring system');
    
    try {
      const healthMonitor = getHealthMonitor();
      const healthReport = await healthMonitor.checkSystemHealth({
        logger: this.logger,
        correlationId: this.correlationId
      });
      
      const check = {
        passed: healthReport.overall,
        details: {
          healthChecks: Object.keys(healthReport.details || {}),
          overallHealth: healthReport.overall,
          summary: healthReport.summary
        },
        issues: []
      };
      
      if (!healthReport.overall) {
        check.issues.push('System health checks failed');
        
        // Add specific health check failures
        if (healthReport.details) {
          Object.entries(healthReport.details).forEach(([component, result]) => {
            if (!result.healthy) {
              check.issues.push(`${component} health check failed: ${result.error || 'Unknown error'}`);
            }
          });
        }
      }
      
      this.validationResults.checks[checkName] = check;
      
      if (!check.passed) {
        this.validationResults.errors.push(...check.issues.map(issue => ({
          check: checkName,
          error: issue,
          critical: false
        })));
      }
      
      // Add health recommendations
      if (healthReport.recommendations) {
        this.validationResults.recommendations.push(...healthReport.recommendations);
      }
      
    } catch (error) {
      this.validationResults.checks[checkName] = {
        passed: false,
        error: error.message
      };
      this.validationResults.errors.push({
        check: checkName,
        error: error.message,
        critical: false
      });
    }
  }
  
  /**
   * Validate processing pipeline
   */
  async validateProcessingPipeline() {
    const checkName = 'processing_pipeline';
    this.logger.info('Validating processing pipeline');
    
    try {
      // Test unified extraction engine initialization
      const { getExtractionEngine } = require('../api/engines/unified-extraction-engine');
      const extractionEngine = getExtractionEngine();
      
      const check = {
        passed: true,
        details: {
          engineInitialized: !!extractionEngine,
          strategiesAvailable: []
        },
        issues: []
      };
      
      if (!extractionEngine) {
        check.issues.push('Extraction engine not initialized');
        check.passed = false;
      }
      
      // Test model router
      const { getModelRouter } = require('../api/services/unified-model-router');
      const modelRouter = getModelRouter();
      
      if (!modelRouter) {
        check.issues.push('Model router not initialized');
        check.passed = false;
      } else {
        // Test model selection
        try {
          const testRequest = {
            extractionInstructions: 'Test extraction',
            url: 'https://example.com'
          };
          
          const selectedModel = modelRouter.selectModel(testRequest);
          const modelConfig = modelRouter.getModelConfig(selectedModel, testRequest);
          
          check.details.selectedModel = selectedModel;
          check.details.modelConfig = modelConfig;
        } catch (modelError) {
          check.issues.push(`Model selection failed: ${modelError.message}`);
          check.passed = false;
        }
      }
      
      this.validationResults.checks[checkName] = check;
      
      if (!check.passed) {
        this.validationResults.errors.push(...check.issues.map(issue => ({
          check: checkName,
          error: issue,
          critical: true
        })));
      }
      
    } catch (error) {
      this.validationResults.checks[checkName] = {
        passed: false,
        error: error.message
      };
      this.validationResults.errors.push({
        check: checkName,
        error: error.message,
        critical: true
      });
    }
  }
  
  /**
   * Validate schema consistency
   */
  async validateSchemaConsistency() {
    const checkName = 'schema_consistency';
    this.logger.info('Validating schema consistency');
    
    try {
      const { JobSchemaValidator } = require('../api/schemas/job-schema');
      
      const check = {
        passed: true,
        details: {
          schemaVersion: JobSchemaValidator.getSchemaVersion(),
          validationAvailable: true
        },
        issues: []
      };
      
      // Test schema validation with sample data
      try {
        const sampleJobData = {
          type: 'sync',
          url: 'https://example.com',
          params: {
            extractionInstructions: 'Test extraction'
          }
        };
        
        JobSchemaValidator.validateJobCreation(sampleJobData);
        check.details.validationWorking = true;
        
      } catch (validationError) {
        check.issues.push(`Schema validation failed: ${validationError.message}`);
        check.passed = false;
      }
      
      // Check for schema migration capabilities
      try {
        const sampleOldJob = {
          id: 'test-job-123',
          status: 'completed',
          url: 'https://example.com',
          extractionInstructions: 'Test'
        };
        
        const migratedJob = JobSchemaValidator.migrateJob(sampleOldJob);
        check.details.migrationWorking = !!migratedJob.schemaVersion;
        
      } catch (migrationError) {
        check.issues.push(`Schema migration failed: ${migrationError.message}`);
        check.passed = false;
      }
      
      this.validationResults.checks[checkName] = check;
      
      if (!check.passed) {
        this.validationResults.errors.push(...check.issues.map(issue => ({
          check: checkName,
          error: issue,
          critical: true
        })));
      }
      
    } catch (error) {
      this.validationResults.checks[checkName] = {
        passed: false,
        error: error.message
      };
      this.validationResults.errors.push({
        check: checkName,
        error: error.message,
        critical: true
      });
    }
  }
  
  /**
   * Validate model routing
   */
  async validateModelRouting() {
    const checkName = 'model_routing';
    this.logger.info('Validating model routing');
    
    try {
      const { getModelRouter } = require('../api/services/unified-model-router');
      const modelRouter = getModelRouter();
      
      const check = {
        passed: true,
        details: {
          routerInitialized: !!modelRouter,
          testResults: {}
        },
        issues: []
      };
      
      if (!modelRouter) {
        check.issues.push('Model router not initialized');
        check.passed = false;
      } else {
        // Test different complexity scenarios
        const testScenarios = [
          {
            name: 'simple',
            request: { extractionInstructions: 'Extract title', url: 'https://example.com' }
          },
          {
            name: 'complex',
            request: { 
              extractionInstructions: 'Analyze and extract comprehensive data with detailed analysis',
              url: 'https://example.com',
              maxPages: 20,
              requiresReasoning: true
            }
          },
          {
            name: 'production_override',
            request: { extractionInstructions: 'Test', url: 'https://example.com' },
            overrides: { modelOverride: 'gpt-4o' }
          }
        ];
        
        testScenarios.forEach(scenario => {
          try {
            const selectedModel = modelRouter.selectModel(scenario.request, scenario.overrides || {});
            const config = modelRouter.getModelConfig(selectedModel, scenario.request);
            const cost = modelRouter.estimateCost(selectedModel, scenario.request);
            
            check.details.testResults[scenario.name] = {
              model: selectedModel,
              config: config,
              cost: cost.totalCost
            };
          } catch (scenarioError) {
            check.issues.push(`Model routing failed for ${scenario.name}: ${scenarioError.message}`);
            check.passed = false;
          }
        });
      }
      
      this.validationResults.checks[checkName] = check;
      
      if (!check.passed) {
        this.validationResults.errors.push(...check.issues.map(issue => ({
          check: checkName,
          error: issue,
          critical: true
        })));
      }
      
    } catch (error) {
      this.validationResults.checks[checkName] = {
        passed: false,
        error: error.message
      };
      this.validationResults.errors.push({
        check: checkName,
        error: error.message,
        critical: true
      });
    }
  }
  
  /**
   * Validate job management
   */
  async validateJobManagement() {
    const checkName = 'job_management';
    this.logger.info('Validating job management');
    
    try {
      const jobManager = getJobManager();
      
      const check = {
        passed: true,
        details: {
          managerInitialized: !!jobManager,
          operations: {}
        },
        issues: []
      };
      
      if (!jobManager) {
        check.issues.push('Job manager not initialized');
        check.passed = false;
      } else {
        // Test job lifecycle
        try {
          // Create test job
          const testJob = await jobManager.createJob({
            type: 'sync',
            url: 'https://example.com',
            extractionInstructions: 'Validation test job'
          }, { logger: this.logger, correlationId: this.correlationId });
          
          check.details.operations.create = { success: true, jobId: testJob.id };
          
          // Update job
          const updatedJob = await jobManager.updateJob(testJob.id, {
            status: 'processing'
          }, { logger: this.logger, correlationId: this.correlationId });
          
          check.details.operations.update = { success: true, status: updatedJob.status };
          
          // Get job
          const retrievedJob = await jobManager.getJob(testJob.id, { 
            logger: this.logger, 
            correlationId: this.correlationId 
          });
          
          check.details.operations.retrieve = { 
            success: !!retrievedJob, 
            schemaValid: !!retrievedJob?.schemaVersion 
          };
          
          // Complete job
          await jobManager.completeJob(testJob.id, {
            success: true,
            data: [],
            metadata: { processingMethod: 'validation_test' }
          }, { logger: this.logger, correlationId: this.correlationId });
          
          check.details.operations.complete = { success: true };
          
          // Clean up test job
          await jobManager.deleteJob(testJob.id, { 
            logger: this.logger, 
            correlationId: this.correlationId 
          });
          
          check.details.operations.delete = { success: true };
          
        } catch (jobOpError) {
          check.issues.push(`Job operation failed: ${jobOpError.message}`);
          check.passed = false;
        }
      }
      
      this.validationResults.checks[checkName] = check;
      
      if (!check.passed) {
        this.validationResults.errors.push(...check.issues.map(issue => ({
          check: checkName,
          error: issue,
          critical: true
        })));
      }
      
    } catch (error) {
      this.validationResults.checks[checkName] = {
        passed: false,
        error: error.message
      };
      this.validationResults.errors.push({
        check: checkName,
        error: error.message,
        critical: true
      });
    }
  }
  
  /**
   * Validate error handling
   */
  async validateErrorHandling() {
    const checkName = 'error_handling';
    this.logger.info('Validating error handling');
    
    try {
      const check = {
        passed: true,
        details: {
          correlationTracking: !!process.env.CORRELATION_ID,
          loggerAvailable: !!this.logger,
          errorRecovery: true
        },
        issues: []
      };
      
      // Test correlation ID tracking
      if (!process.env.CORRELATION_ID) {
        check.issues.push('Correlation ID tracking not working');
        check.passed = false;
      }
      
      // Test structured logging
      try {
        this.logger.info('Test log entry for validation');
        this.logger.error('Test error log entry for validation', new Error('Test error'));
      } catch (logError) {
        check.issues.push(`Structured logging failed: ${logError.message}`);
        check.passed = false;
      }
      
      // Test error serialization
      try {
        const testError = new Error('Test error for serialization');
        testError.details = { test: true };
        const serialized = JSON.stringify({
          error: testError.message,
          stack: testError.stack,
          details: testError.details
        });
        
        check.details.errorSerialization = !!serialized;
      } catch (serializationError) {
        check.issues.push(`Error serialization failed: ${serializationError.message}`);
        check.passed = false;
      }
      
      this.validationResults.checks[checkName] = check;
      
      if (!check.passed) {
        this.validationResults.warnings.push(...check.issues.map(issue => ({
          check: checkName,
          warning: issue
        })));
      }
      
    } catch (error) {
      this.validationResults.checks[checkName] = {
        passed: false,
        error: error.message
      };
      this.validationResults.warnings.push({
        check: checkName,
        warning: error.message
      });
    }
  }
  
  /**
   * Validate performance metrics
   */
  async validatePerformanceMetrics() {
    const checkName = 'performance_metrics';
    this.logger.info('Validating performance metrics');
    
    try {
      const startTime = Date.now();
      
      // Measure memory usage
      const memoryUsage = process.memoryUsage();
      
      // Test timer functionality
      const timer = this.logger.startTimer('validation_test');
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
      const duration = timer.end();
      
      const endTime = Date.now();
      const totalValidationTime = endTime - startTime;
      
      const check = {
        passed: true,
        details: {
          memoryUsage: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
            external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
          },
          timerFunctionality: duration > 80 && duration < 200, // Allow some variance
          validationDuration: totalValidationTime
        },
        issues: []
      };
      
      if (memoryUsage.heapUsed > 512 * 1024 * 1024) { // 512MB threshold
        check.issues.push('High memory usage detected');
        check.passed = false;
      }
      
      if (!check.details.timerFunctionality) {
        check.issues.push('Timer functionality not working correctly');
        check.passed = false;
      }
      
      this.validationResults.checks[checkName] = check;
      
      if (!check.passed) {
        this.validationResults.warnings.push(...check.issues.map(issue => ({
          check: checkName,
          warning: issue
        })));
      }
      
    } catch (error) {
      this.validationResults.checks[checkName] = {
        passed: false,
        error: error.message
      };
      this.validationResults.warnings.push({
        check: checkName,
        warning: error.message
      });
    }
  }
  
  /**
   * Calculate overall validation result
   */
  calculateOverallResult() {
    const totalChecks = Object.keys(this.validationResults.checks).length;
    const passedChecks = Object.values(this.validationResults.checks)
      .filter(check => check.passed).length;
    
    const criticalErrors = this.validationResults.errors
      .filter(error => error.critical).length;
    
    // System is valid if:
    // 1. At least 80% of checks pass
    // 2. No critical errors
    const passRate = passedChecks / totalChecks;
    this.validationResults.overall = passRate >= 0.8 && criticalErrors === 0;
    
    this.validationResults.summary = {
      totalChecks: totalChecks,
      passedChecks: passedChecks,
      failedChecks: totalChecks - passedChecks,
      passRate: Math.round(passRate * 100),
      criticalErrors: criticalErrors,
      totalErrors: this.validationResults.errors.length,
      totalWarnings: this.validationResults.warnings.length
    };
  }
  
  /**
   * Generate validation report
   */
  generateReport() {
    const report = {
      '🚀 BULLETPROOF DEPLOYMENT VALIDATION REPORT': '',
      '': '',
      'Timestamp': this.validationResults.timestamp,
      'Correlation ID': this.validationResults.correlationId,
      'Overall Status': this.validationResults.overall ? '✅ PASSED' : '❌ FAILED',
      ' ': '',
      'Summary': {
        'Total Checks': this.validationResults.summary.totalChecks,
        'Passed': this.validationResults.summary.passedChecks,
        'Failed': this.validationResults.summary.failedChecks,
        'Pass Rate': `${this.validationResults.summary.passRate}%`,
        'Critical Errors': this.validationResults.summary.criticalErrors,
        'Total Errors': this.validationResults.summary.totalErrors,
        'Warnings': this.validationResults.summary.totalWarnings
      }
    };
    
    // Add check details
    report['  '] = '';
    report['Check Results'] = {};
    
    Object.entries(this.validationResults.checks).forEach(([checkName, result]) => {
      report['Check Results'][checkName] = result.passed ? '✅ PASSED' : '❌ FAILED';
      if (!result.passed && result.error) {
        report['Check Results'][`${checkName}_error`] = result.error;
      }
    });
    
    // Add errors if any
    if (this.validationResults.errors.length > 0) {
      report['   '] = '';
      report['Critical Issues'] = this.validationResults.errors
        .filter(e => e.critical)
        .map(e => `${e.check}: ${e.error}`);
    }
    
    // Add warnings if any
    if (this.validationResults.warnings.length > 0) {
      report['    '] = '';
      report['Warnings'] = this.validationResults.warnings
        .map(w => `${w.check}: ${w.warning}`);
    }
    
    // Add recommendations if any
    if (this.validationResults.recommendations.length > 0) {
      report['     '] = '';
      report['Recommendations'] = this.validationResults.recommendations
        .map(r => `${r.priority}: ${r.component} - ${r.action}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(JSON.stringify(report, null, 2));
    console.log('='.repeat(80) + '\n');
    
    // Log final result
    if (this.validationResults.overall) {
      this.logger.info('🎉 Bulletproof deployment validation PASSED');
    } else {
      this.logger.error('💥 Bulletproof deployment validation FAILED');
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new DeploymentValidator();
  
  validator.validate()
    .then(results => {
      process.exit(results.overall ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed with error:', error);
      process.exit(1);
    });
}

module.exports = {
  DeploymentValidator
};