#!/usr/bin/env node
/**
 * Migration Script to Bulletproof Architecture
 * 
 * Safely migrates existing Atlas Codex deployment to bulletproof architecture.
 * Includes rollback capability and validation at each step.
 */

const fs = require('fs').promises;
const path = require('path');
const { getEnvironmentConfig } = require('../api/config/environment');
const { getJobManager } = require('../api/services/job-manager');
const { CorrelationMiddleware } = require('../api/middleware/correlation-middleware');
const { DeploymentValidator } = require('./validate-bulletproof-deployment');

/**
 * Bulletproof Migration Manager
 */
class BulletproofMigrator {
  constructor() {
    this.correlationId = CorrelationMiddleware.generateCorrelationId();
    this.logger = CorrelationMiddleware.createLogger(this.correlationId);
    
    this.migrationState = {
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      phase: 'initialization',
      completed: [],
      failed: [],
      rollbackData: {},
      canRollback: true
    };
    
    this.migrationPhases = [
      'backup_current_state',
      'validate_prerequisites', 
      'migrate_environment_config',
      'migrate_job_schema',
      'update_lambda_handler',
      'migrate_existing_jobs',
      'validate_new_architecture',
      'cleanup_old_components'
    ];
  }
  
  /**
   * Run complete migration to bulletproof architecture
   */
  async migrate(options = {}) {
    this.logger.info('🚀 Starting migration to bulletproof architecture');
    
    try {
      // Save migration state file
      await this.saveMigrationState();
      
      for (const phase of this.migrationPhases) {
        this.migrationState.phase = phase;
        this.logger.info(`Starting migration phase: ${phase}`);
        
        try {
          await this[`phase_${phase}`](options);
          this.migrationState.completed.push(phase);
          this.logger.info(`✅ Completed migration phase: ${phase}`);
          
        } catch (phaseError) {
          this.logger.error(`❌ Failed migration phase: ${phase}`, phaseError);
          this.migrationState.failed.push({
            phase: phase,
            error: phaseError.message,
            timestamp: new Date().toISOString()
          });
          
          // Decide whether to continue or rollback
          if (this.isCriticalPhase(phase)) {
            this.logger.error('Critical phase failed, initiating rollback');
            await this.rollback();
            throw new Error(`Migration failed at critical phase: ${phase}`);
          } else {
            this.logger.warn(`Non-critical phase failed, continuing: ${phase}`);
          }
        }
        
        await this.saveMigrationState();
      }
      
      this.migrationState.phase = 'completed';
      await this.saveMigrationState();
      
      this.logger.info('🎉 Migration to bulletproof architecture completed successfully');
      
      return {
        success: true,
        migrationState: this.migrationState,
        message: 'Migration completed successfully'
      };
      
    } catch (error) {
      this.logger.error('💥 Migration failed', error);
      
      return {
        success: false,
        migrationState: this.migrationState,
        error: error.message,
        message: 'Migration failed - check logs for details'
      };
    }
  }
  
  /**
   * Phase 1: Backup current state
   */
  async phase_backup_current_state(options) {
    this.logger.info('Backing up current system state');
    
    const backupData = {
      timestamp: new Date().toISOString(),
      environment: {},
      lambdaHandler: null,
      jobSamples: [],
      configuration: {}
    };
    
    try {
      // Backup environment configuration
      backupData.environment = process.env;
      
      // Backup current lambda handler
      try {
        const currentHandler = await fs.readFile(
          path.join(__dirname, '../api/lambda.js'), 
          'utf8'
        );
        backupData.lambdaHandler = currentHandler;
      } catch (handlerError) {
        this.logger.warn('Could not backup current lambda handler:', handlerError.message);
      }
      
      // Backup sample of existing jobs
      try {
        const config = getEnvironmentConfig();
        const jobManager = getJobManager();
        const jobSamples = await jobManager.listJobs({ limit: 10 }, { 
          logger: this.logger,
          correlationId: this.correlationId
        });
        backupData.jobSamples = jobSamples.jobs;
      } catch (jobError) {
        this.logger.warn('Could not backup job samples:', jobError.message);
      }
      
      // Save backup data
      this.migrationState.rollbackData.systemBackup = backupData;
      
      // Write backup to file
      const backupPath = path.join(__dirname, '../migration-backup.json');
      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
      
      this.logger.info('System backup completed', {
        backupPath: backupPath,
        jobSamples: backupData.jobSamples.length
      });
      
    } catch (error) {
      throw new Error(`Backup failed: ${error.message}`);
    }
  }
  
  /**
   * Phase 2: Validate prerequisites
   */
  async phase_validate_prerequisites(options) {
    this.logger.info('Validating migration prerequisites');
    
    const prerequisites = {
      nodeVersion: process.version,
      awsAccess: false,
      openaiAccess: false,
      diskSpace: 0,
      memoryAvailable: process.memoryUsage()
    };
    
    // Check Node.js version
    const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
    if (nodeVersion < 18) {
      throw new Error(`Node.js version ${nodeVersion} not supported. Requires Node.js 18+`);
    }
    
    // Check required environment variables
    const requiredEnvVars = ['OPENAI_API_KEY', 'MASTER_API_KEY', 'AWS_REGION'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    prerequisites.openaiAccess = !!process.env.OPENAI_API_KEY;
    
    // Check if bulletproof components exist
    const bulletproofComponents = [
      '../api/config/environment.js',
      '../api/schemas/job-schema.js',
      '../api/services/job-manager.js',
      '../api/engines/unified-extraction-engine.js',
      '../api/services/unified-model-router.js',
      '../api/middleware/correlation-middleware.js'
    ];
    
    for (const component of bulletproofComponents) {
      try {
        await fs.access(path.join(__dirname, component));
      } catch (error) {
        throw new Error(`Missing bulletproof component: ${component}`);
      }
    }
    
    this.logger.info('Prerequisites validation passed', prerequisites);
  }
  
  /**
   * Phase 3: Migrate environment configuration
   */
  async phase_migrate_environment_config(options) {
    this.logger.info('Migrating environment configuration');
    
    try {
      // Test new environment configuration
      const config = getEnvironmentConfig();
      
      this.logger.info('New environment configuration loaded', {
        stage: config.stage,
        nodeEnv: config.nodeEnv,
        gpt5Enabled: config.gpt5Enabled,
        defaultModel: config.defaultModel
      });
      
      // Validate configuration consistency
      if (!config.masterApiKey || !config.openaiApiKey) {
        throw new Error('Critical environment variables missing');
      }
      
      // Save migration checkpoint
      this.migrationState.rollbackData.environmentMigration = {
        originalEnv: { ...process.env },
        newConfig: config
      };
      
    } catch (error) {
      throw new Error(`Environment configuration migration failed: ${error.message}`);
    }
  }
  
  /**
   * Phase 4: Migrate job schema
   */
  async phase_migrate_job_schema(options) {
    this.logger.info('Migrating job schema');
    
    try {
      const { JobSchemaValidator } = require('../api/schemas/job-schema');
      
      // Test schema validation
      const testJobData = {
        type: 'sync',
        url: 'https://example.com',
        params: {
          extractionInstructions: 'Test migration'
        }
      };
      
      JobSchemaValidator.validateJobCreation(testJobData);
      
      // Test job migration
      const oldJobFormat = {
        id: 'test-migration-job',
        status: 'completed',
        url: 'https://example.com',
        extractionInstructions: 'Test migration',
        created_at: Date.now(),
        updated_at: Date.now()
      };
      
      const migratedJob = JobSchemaValidator.migrateJob(oldJobFormat);
      
      if (!migratedJob.schemaVersion || migratedJob.schemaVersion !== '1.0.0') {
        throw new Error('Job migration validation failed');
      }
      
      this.logger.info('Job schema validation passed', {
        schemaVersion: JobSchemaValidator.getSchemaVersion()
      });
      
    } catch (error) {
      throw new Error(`Job schema migration failed: ${error.message}`);
    }
  }
  
  /**
   * Phase 5: Update Lambda handler
   */
  async phase_update_lambda_handler(options) {
    this.logger.info('Updating Lambda handler');
    
    try {
      const bulletproofHandlerPath = path.join(__dirname, '../api/lambda-bulletproof.js');
      const currentHandlerPath = path.join(__dirname, '../api/lambda.js');
      const backupHandlerPath = path.join(__dirname, '../api/lambda-backup.js');
      
      // Check if bulletproof handler exists
      try {
        await fs.access(bulletproofHandlerPath);
      } catch (error) {
        throw new Error('Bulletproof lambda handler not found');
      }
      
      // Backup current handler
      try {
        const currentHandler = await fs.readFile(currentHandlerPath, 'utf8');
        await fs.writeFile(backupHandlerPath, currentHandler);
        this.migrationState.rollbackData.handlerBackup = backupHandlerPath;
      } catch (backupError) {
        this.logger.warn('Could not backup current handler:', backupError.message);
      }
      
      if (!options.dryRun) {
        // Copy bulletproof handler to main handler location
        const bulletproofHandler = await fs.readFile(bulletproofHandlerPath, 'utf8');
        await fs.writeFile(currentHandlerPath, bulletproofHandler);
        
        this.logger.info('Lambda handler updated to bulletproof version');
      } else {
        this.logger.info('[DRY RUN] Would update Lambda handler');
      }
      
    } catch (error) {
      throw new Error(`Lambda handler update failed: ${error.message}`);
    }
  }
  
  /**
   * Phase 6: Migrate existing jobs
   */
  async phase_migrate_existing_jobs(options) {
    this.logger.info('Migrating existing jobs to canonical schema');
    
    try {
      const jobManager = getJobManager();
      const { JobSchemaValidator } = require('../api/schemas/job-schema');
      
      // Get all existing jobs
      const existingJobs = await jobManager.listJobs({ limit: 1000 }, {
        logger: this.logger,
        correlationId: this.correlationId
      });
      
      let migratedCount = 0;
      let errorCount = 0;
      const migrationErrors = [];
      
      for (const job of existingJobs.jobs) {
        try {
          // Check if job needs migration
          if (!job.schemaVersion || job.schemaVersion !== '1.0.0') {
            const migratedJob = JobSchemaValidator.migrateJob(job);
            
            if (!options.dryRun) {
              // Update job with migrated data
              await jobManager.updateJob(job.id, {
                schemaVersion: '1.0.0',
                params: migratedJob.params,
                logs: migratedJob.logs || [],
                correlationId: migratedJob.correlationId
              }, {
                logger: this.logger,
                correlationId: this.correlationId
              });
            }
            
            migratedCount++;
          }
        } catch (jobError) {
          errorCount++;
          migrationErrors.push({
            jobId: job.id,
            error: jobError.message
          });
          
          this.logger.warn(`Failed to migrate job ${job.id}:`, jobError.message);
        }
      }
      
      this.migrationState.rollbackData.jobMigration = {
        totalJobs: existingJobs.jobs.length,
        migratedCount: migratedCount,
        errorCount: errorCount,
        errors: migrationErrors
      };
      
      if (errorCount > existingJobs.jobs.length * 0.1) { // More than 10% errors
        throw new Error(`Too many job migration errors: ${errorCount}/${existingJobs.jobs.length}`);
      }
      
      this.logger.info('Job migration completed', {
        totalJobs: existingJobs.jobs.length,
        migratedJobs: migratedCount,
        errors: errorCount,
        dryRun: !!options.dryRun
      });
      
    } catch (error) {
      throw new Error(`Job migration failed: ${error.message}`);
    }
  }
  
  /**
   * Phase 7: Validate new architecture
   */
  async phase_validate_new_architecture(options) {
    this.logger.info('Validating new bulletproof architecture');
    
    try {
      const validator = new DeploymentValidator();
      const validationResults = await validator.validate();
      
      this.migrationState.rollbackData.validationResults = validationResults;
      
      if (!validationResults.overall) {
        const criticalErrors = validationResults.errors
          .filter(error => error.critical);
        
        if (criticalErrors.length > 0) {
          throw new Error(`Architecture validation failed with ${criticalErrors.length} critical errors`);
        } else {
          this.logger.warn('Architecture validation has warnings but no critical errors');
        }
      }
      
      this.logger.info('Architecture validation passed', {
        overall: validationResults.overall,
        passRate: validationResults.summary?.passRate
      });
      
    } catch (error) {
      throw new Error(`Architecture validation failed: ${error.message}`);
    }
  }
  
  /**
   * Phase 8: Cleanup old components
   */
  async phase_cleanup_old_components(options) {
    this.logger.info('Cleaning up old components');
    
    const oldComponents = [
      '../config/gpt5-rollout.js', // Old GPT-5 rollout config
      '../api/lambda-backup.js'   // Backup handler (keep for safety)
    ];
    
    const cleanedComponents = [];
    
    for (const component of oldComponents) {
      try {
        const componentPath = path.join(__dirname, component);
        
        // Check if component exists
        await fs.access(componentPath);
        
        if (!options.dryRun && !component.includes('backup')) {
          // Move to backup instead of deleting
          const backupPath = componentPath + '.migrated-backup';
          await fs.rename(componentPath, backupPath);
          cleanedComponents.push(component);
        }
        
      } catch (error) {
        // Component doesn't exist, skip
        this.logger.debug(`Component not found (OK): ${component}`);
      }
    }
    
    this.logger.info('Old components cleanup completed', {
      cleanedComponents: cleanedComponents.length,
      dryRun: !!options.dryRun
    });
  }
  
  /**
   * Rollback migration
   */
  async rollback() {
    this.logger.warn('🔄 Starting migration rollback');
    
    try {
      // Rollback lambda handler
      if (this.migrationState.rollbackData.handlerBackup) {
        const currentHandlerPath = path.join(__dirname, '../api/lambda.js');
        const backupHandler = await fs.readFile(
          this.migrationState.rollbackData.handlerBackup, 
          'utf8'
        );
        await fs.writeFile(currentHandlerPath, backupHandler);
        this.logger.info('Lambda handler rolled back');
      }
      
      // Note: Job schema changes are backwards compatible, no rollback needed
      // Environment changes are also backwards compatible
      
      this.migrationState.phase = 'rolled_back';
      await this.saveMigrationState();
      
      this.logger.warn('Migration rollback completed');
      
    } catch (rollbackError) {
      this.logger.error('Rollback failed', rollbackError);
      throw new Error(`Rollback failed: ${rollbackError.message}`);
    }
  }
  
  /**
   * Save migration state to file
   */
  async saveMigrationState() {
    const statePath = path.join(__dirname, '../migration-state.json');
    await fs.writeFile(statePath, JSON.stringify(this.migrationState, null, 2));
  }
  
  /**
   * Check if phase is critical (requires rollback on failure)
   */
  isCriticalPhase(phase) {
    const criticalPhases = [
      'validate_prerequisites',
      'migrate_environment_config',
      'migrate_job_schema'
    ];
    
    return criticalPhases.includes(phase);
  }
}

// Command line interface
if (require.main === module) {
  const migrator = new BulletproofMigrator();
  
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    skipValidation: args.includes('--skip-validation')
  };
  
  if (args.includes('--help')) {
    console.log(`
Atlas Codex Bulletproof Migration Tool

Usage: node migrate-to-bulletproof.js [options]

Options:
  --dry-run         Perform migration simulation without making changes
  --force           Force migration even with warnings
  --skip-validation Skip final validation (not recommended)
  --help           Show this help message

Examples:
  node migrate-to-bulletproof.js --dry-run    # Test migration
  node migrate-to-bulletproof.js              # Full migration
  node migrate-to-bulletproof.js --force      # Force migration
`);
    process.exit(0);
  }
  
  console.log('🚀 Atlas Codex Bulletproof Migration');
  console.log('Options:', options);
  console.log('');
  
  migrator.migrate(options)
    .then(result => {
      if (result.success) {
        console.log('✅ Migration completed successfully!');
        process.exit(0);
      } else {
        console.error('❌ Migration failed:', result.message);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Migration failed with error:', error.message);
      process.exit(1);
    });
}

module.exports = {
  BulletproofMigrator
};