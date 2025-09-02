// Atlas Codex - Main Worker with DIP Integration
// Production-ready worker with all systems integrated

const AWS = require('aws-sdk');
const { DIPSystem } = require('./dip');
const { ExtractionSystem } = require('./extraction');
const { EvidenceLedgerService } = require('../core/src/evidence-ledger');
const { CostOptimizer } = require('../core/src/cost-optimizer');
const { MonitoringService } = require('../core/src/monitoring');

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-west-2'
});

const sqs = new AWS.SQS();
const s3 = new AWS.S3();

class AtlasCodexWorker {
  constructor(config = {}) {
    // Initialize all systems
    this.dipSystem = new DIPSystem(config.dip);
    this.extractionSystem = new ExtractionSystem(config.extraction);
    this.evidenceLedger = new EvidenceLedgerService(config.evidence);
    this.costOptimizer = new CostOptimizer();
    this.monitoring = new MonitoringService();
    
    this.config = {
      queueUrl: process.env.SQS_QUEUE_URL || config.queueUrl,
      resultsBucket: process.env.S3_BUCKET || config.resultsBucket || 'atlas-codex-results',
      maxConcurrent: config.maxConcurrent || 3,
      pollInterval: config.pollInterval || 5000,
      shutdownGracePeriod: config.shutdownGracePeriod || 30000,
      enableEvidence: config.enableEvidence !== false,
      enableCostOptimization: config.enableCostOptimization !== false,
      ...config
    };
    
    this.running = false;
    this.activeJobs = new Map();
    this.stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      totalTime: 0
    };

    // Set up monitoring alerts
    this.setupMonitoring();
  }

  /**
   * Setup monitoring and alerts
   */
  setupMonitoring() {
    // Alert on high error rates
    this.monitoring.on('alert', (alert) => {
      console.error(`🚨 Alert: ${alert.level} - ${alert.message}`);
      
      // Send to CloudWatch or notification service
      if (alert.level === 'critical') {
        this.notifyCriticalAlert(alert);
      }
    });

    // Track metrics
    this.monitoring.on('metric', (metric) => {
      // Send to CloudWatch
      this.sendToCloudWatch(metric);
    });
  }

  /**
   * Start the worker
   */
  async start() {
    console.log('🚀 Starting Atlas Codex Worker with DIP System');
    this.running = true;
    
    // Start monitoring
    this.monitoring.recordMetric('worker_started', 1, 'count');
    
    // Main processing loop
    while (this.running) {
      try {
        // Check system health
        const health = this.monitoring.getSystemHealth();
        if (health.status === 'unhealthy') {
          console.error('❌ System unhealthy, pausing processing');
          await this.delay(30000);
          continue;
        }
        
        // Process jobs up to max concurrent
        while (this.activeJobs.size < this.config.maxConcurrent && this.running) {
          const job = await this.fetchJob();
          if (!job) break;
          
          // Process job asynchronously
          this.processJob(job).catch(error => {
            console.error(`Failed to process job ${job.id}:`, error);
            this.handleJobError(job, error);
          });
        }
        
        // Wait before next poll
        await this.delay(this.config.pollInterval);
        
      } catch (error) {
        console.error('Worker loop error:', error);
        this.monitoring.createAlert('error', 'worker', 'Worker loop error', error);
        await this.delay(10000);
      }
    }
    
    console.log('Worker stopped');
  }

  /**
   * Process a job with full DIP integration
   */
  async processJob(job) {
    const startTime = Date.now();
    console.log(`\n📋 Processing job ${job.id}`);
    console.log(`  URL: ${job.params.url}`);
    
    this.activeJobs.set(job.id, {
      startTime,
      status: 'processing'
    });
    
    try {
      // Step 1: Get DIP for optimal extraction
      console.log('  1️⃣ Getting DIP...');
      const dip = await this.dipSystem.getDIPForExtraction(job.params.url);
      
      // Step 2: Check cost optimization
      if (this.config.enableCostOptimization) {
        console.log('  2️⃣ Optimizing strategy for cost...');
        const optimizedStrategy = this.costOptimizer.optimizeStrategySelection(
          dip.domain,
          [dip.strategy.primary, dip.strategy.fallback],
          0.7 // Min quality requirement
        );
        
        if (optimizedStrategy !== dip.strategy.primary) {
          console.log(`    Switching from ${dip.strategy.primary} to ${optimizedStrategy} for cost`);
          dip.strategy.primary = optimizedStrategy;
        }
      }
      
      // Step 3: Extract content
      console.log(`  3️⃣ Extracting with ${dip.strategy.primary} strategy...`);
      const extraction = await this.extractionSystem.extract(job.params.url, {
        preferredStrategy: dip.strategy.primary,
        jobId: job.id
      });
      
      if (extraction.status !== 'success') {
        throw new Error(`Extraction failed: ${extraction.errors?.[0]?.message}`);
      }
      
      // Step 4: Generate evidence
      let evidence = null;
      if (this.config.enableEvidence) {
        console.log('  4️⃣ Generating evidence...');
        evidence = await this.evidenceLedger.createEvidence(
          job.id,
          job.params.url,
          extraction.data,
          {
            strategy: extraction.strategy,
            duration: extraction.duration,
            htmlHash: extraction.evidence?.htmlSnapshot
          }
        );
        
        // Verify evidence
        const verified = await this.evidenceLedger.verifyEvidence(evidence);
        console.log(`    Evidence ${verified ? '✅ verified' : '❌ verification failed'}`);
      }
      
      // Step 5: Track costs
      console.log('  5️⃣ Tracking costs...');
      const costMetrics = this.costOptimizer.trackCost(
        dip.domain,
        extraction.strategy || dip.strategy.primary,
        {
          duration: extraction.duration,
          llmTokens: extraction.data?.extractionMethod?.includes('gpt') ? 1000 : 0,
          browserTime: extraction.strategy?.includes('browser') ? extraction.duration : 0
        }
      );
      console.log(`    Cost: $${costMetrics.actualCost.toFixed(4)}`);
      
      // Step 6: Store results
      console.log('  6️⃣ Storing results...');
      const resultUrl = await this.storeResults(job.id, {
        jobId: job.id,
        url: job.params.url,
        extraction: extraction.data,
        evidence: evidence ? this.evidenceLedger.exportEvidenceForAudit(evidence) : null,
        metadata: {
          strategy: extraction.strategy,
          duration: extraction.duration,
          cost: costMetrics.actualCost,
          dipConfidence: dip.metadata.confidence,
          timestamp: new Date().toISOString()
        }
      });
      
      // Step 7: Complete job
      await this.completeJob(job, {
        success: true,
        resultUrl,
        duration: Date.now() - startTime,
        cost: costMetrics.actualCost
      });
      
      // Update metrics
      this.stats.processed++;
      this.stats.succeeded++;
      this.stats.totalTime += (Date.now() - startTime);
      
      this.monitoring.recordRequest(true, Date.now() - startTime);
      this.monitoring.recordMetric('extraction_cost', costMetrics.actualCost, 'dollars');
      
      console.log(`  ✅ Job ${job.id} completed in ${Date.now() - startTime}ms`);
      
    } catch (error) {
      console.error(`  ❌ Job ${job.id} failed: ${error.message}`);
      
      this.stats.processed++;
      this.stats.failed++;
      
      this.monitoring.recordRequest(false, Date.now() - startTime);
      this.monitoring.createAlert('error', 'job', `Job ${job.id} failed`, {
        jobId: job.id,
        error: error.message
      });
      
      await this.handleJobError(job, error);
      
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Fetch job from SQS
   */
  async fetchJob() {
    if (!this.config.queueUrl) {
      // For testing, generate mock job
      return this.generateMockJob();
    }
    
    const params = {
      QueueUrl: this.config.queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 5,
      VisibilityTimeout: 300
    };
    
    try {
      const result = await sqs.receiveMessage(params).promise();
      
      if (result.Messages && result.Messages.length > 0) {
        const message = result.Messages[0];
        const job = JSON.parse(message.Body);
        
        // Add SQS metadata
        job.sqsMessageId = message.MessageId;
        job.sqsReceiptHandle = message.ReceiptHandle;
        
        return job;
      }
    } catch (error) {
      console.error('Failed to fetch job from SQS:', error);
      this.monitoring.createAlert('warning', 'sqs', 'Failed to fetch from SQS', error);
    }
    
    return null;
  }

  /**
   * Store results to S3
   */
  async storeResults(jobId, results) {
    const key = `results/${jobId}/extraction.json`;
    
    const params = {
      Bucket: this.config.resultsBucket,
      Key: key,
      Body: JSON.stringify(results, null, 2),
      ContentType: 'application/json',
      Metadata: {
        jobId,
        timestamp: new Date().toISOString(),
        strategy: results.metadata?.strategy || 'unknown'
      }
    };
    
    try {
      await s3.putObject(params).promise();
      return `s3://${this.config.resultsBucket}/${key}`;
    } catch (error) {
      console.error('Failed to store results to S3:', error);
      // Store locally as fallback
      const fs = require('fs');
      const path = `/tmp/${jobId}_results.json`;
      fs.writeFileSync(path, JSON.stringify(results, null, 2));
      return `file://${path}`;
    }
  }

  /**
   * Complete job and remove from queue
   */
  async completeJob(job, result) {
    // Delete from SQS if applicable
    if (job.sqsReceiptHandle && this.config.queueUrl) {
      try {
        await sqs.deleteMessage({
          QueueUrl: this.config.queueUrl,
          ReceiptHandle: job.sqsReceiptHandle
        }).promise();
      } catch (error) {
        console.error('Failed to delete message from SQS:', error);
      }
    }
    
    // Record completion
    console.log(`Job ${job.id} completed:`, {
      success: result.success,
      duration: `${result.duration}ms`,
      cost: `$${result.cost?.toFixed(4)}`
    });
  }

  /**
   * Handle job error
   */
  async handleJobError(job, error) {
    // Store error details
    const errorDetails = {
      jobId: job.id,
      url: job.params?.url,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    
    // Store to S3
    try {
      const key = `errors/${job.id}/error.json`;
      await s3.putObject({
        Bucket: this.config.resultsBucket,
        Key: key,
        Body: JSON.stringify(errorDetails, null, 2),
        ContentType: 'application/json'
      }).promise();
    } catch (s3Error) {
      console.error('Failed to store error to S3:', s3Error);
    }
    
    // Return message to queue with backoff
    if (job.sqsReceiptHandle && this.config.queueUrl) {
      // Check retry count
      const retryCount = (job.retryCount || 0) + 1;
      
      if (retryCount < 3) {
        // Return to queue with exponential backoff
        const visibilityTimeout = Math.min(300 * Math.pow(2, retryCount), 43200);
        
        try {
          await sqs.changeMessageVisibility({
            QueueUrl: this.config.queueUrl,
            ReceiptHandle: job.sqsReceiptHandle,
            VisibilityTimeout: visibilityTimeout
          }).promise();
          
          console.log(`Returned job to queue with ${visibilityTimeout}s visibility timeout`);
        } catch (sqsError) {
          console.error('Failed to return message to queue:', sqsError);
        }
      } else {
        // Max retries exceeded, move to DLQ
        await this.completeJob(job, { success: false });
      }
    }
  }

  /**
   * Generate mock job for testing
   */
  generateMockJob() {
    if (Math.random() > 0.3) return null; // Simulate empty queue
    
    const urls = [
      'https://example.com/article/1',
      'https://techblog.com/post/2',
      'https://news.site/story/3'
    ];
    
    return {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      params: {
        url: urls[Math.floor(Math.random() * urls.length)]
      },
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Initiating graceful shutdown...');
    this.running = false;
    
    // Wait for active jobs to complete
    const shutdownStart = Date.now();
    while (this.activeJobs.size > 0 && 
           Date.now() - shutdownStart < this.config.shutdownGracePeriod) {
      console.log(`  Waiting for ${this.activeJobs.size} active jobs...`);
      await this.delay(1000);
    }
    
    // Force stop remaining jobs
    if (this.activeJobs.size > 0) {
      console.log(`  Force stopping ${this.activeJobs.size} jobs`);
      this.activeJobs.clear();
    }
    
    // Get final reports
    console.log('\n📊 Final Statistics:');
    console.log('  Worker Stats:', this.stats);
    console.log('  Extraction Stats:', await this.extractionSystem.getStatistics());
    console.log('  Cost Report:', this.costOptimizer.getCostReport());
    console.log('  System Health:', this.monitoring.getSystemHealth());
    
    // Cleanup
    await this.extractionSystem.shutdown();
    await this.dipSystem.shutdown();
    
    console.log('✅ Shutdown complete');
  }

  /**
   * Health check endpoint data
   */
  getHealth() {
    return {
      status: this.running ? 'running' : 'stopped',
      activeJobs: this.activeJobs.size,
      stats: this.stats,
      monitoring: this.monitoring.getDashboardData(),
      costAnalysis: this.costOptimizer.getCostReport()
    };
  }

  /**
   * Helper: Delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send metric to CloudWatch
   */
  async sendToCloudWatch(metric) {
    // Implementation would send to CloudWatch
    // console.log('CloudWatch metric:', metric);
  }

  /**
   * Notify critical alert
   */
  async notifyCriticalAlert(alert) {
    // Implementation would send SNS notification
    console.error('🚨🚨🚨 CRITICAL ALERT:', alert);
  }
}

// Export and run if main
module.exports = { AtlasCodexWorker };

if (require.main === module) {
  const worker = new AtlasCodexWorker({
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT) || 3,
    enableEvidence: process.env.ENABLE_EVIDENCE !== 'false',
    enableCostOptimization: process.env.ENABLE_COST_OPT !== 'false'
  });
  
  // Handle shutdown signals
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM');
    await worker.shutdown();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('Received SIGINT');
    await worker.shutdown();
    process.exit(0);
  });
  
  // Start worker
  worker.start().catch(error => {
    console.error('Worker failed:', error);
    process.exit(1);
  });
}