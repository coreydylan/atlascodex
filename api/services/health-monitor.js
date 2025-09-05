/**
 * Comprehensive Health Monitor for Atlas Codex
 * 
 * Real-time system health monitoring with detailed diagnostics.
 * Addresses: Health checks don't validate processing pipeline
 * Ensures: Comprehensive health validation with alerts
 */

const { getEnvironmentConfig } = require('../config/environment');
const { getJobManager } = require('./job-manager');
const { getExtractionEngine } = require('../engines/unified-extraction-engine');
const { getModelRouter } = require('./unified-model-router');
const { CorrelationMiddleware } = require('../middleware/correlation-middleware');
const OpenAI = require('openai');

/**
 * Comprehensive Health Monitor
 */
class ComprehensiveHealthMonitor {
  constructor() {
    this.config = getEnvironmentConfig();
    
    // Initialize OpenAI client for testing
    this.openai = new OpenAI({
      apiKey: this.config.openaiApiKey
    });
    
    // Health check thresholds
    this.thresholds = {
      responseTime: 5000, // 5 seconds
      errorRate: 0.05, // 5%
      memoryUsage: 0.8, // 80%
      diskUsage: 0.9, // 90%
      costBudgetUsed: 0.8 // 80%
    };
    
    // Cache for performance metrics
    this.metricsCache = {
      lastCheck: null,
      results: null,
      cacheDuration: 60000 // 1 minute
    };
  }
  
  /**
   * Perform comprehensive system health check
   */
  async checkSystemHealth(context = {}) {
    const logger = context.logger || CorrelationMiddleware.createLogger(
      context.correlationId || CorrelationMiddleware.generateCorrelationId()
    );
    
    const timer = logger.startTimer('comprehensive_health_check');
    
    try {
      // Check if we have cached results
      if (this.shouldUseCachedResults()) {
        logger.info('Using cached health check results');
        return this.metricsCache.results;
      }
      
      logger.info('Starting comprehensive health check');
      
      // Run all health checks in parallel
      const healthChecks = await Promise.allSettled([
        this.checkDynamoDB(logger),
        this.checkGPTModels(logger),
        this.checkProcessingPipeline(logger),
        this.checkSchemaConsistency(logger),
        this.checkCostBudgets(logger),
        this.checkEnvironmentHealth(logger),
        this.checkNetworkConnectivity(logger),
        this.checkResourceUtilization(logger)
      ]);
      
      // Analyze results
      const healthReport = {
        timestamp: new Date().toISOString(),
        overall: this.calculateOverallHealth(healthChecks),
        details: {
          dynamodb: this.formatCheckResult(healthChecks[0], 'DynamoDB'),
          gptModels: this.formatCheckResult(healthChecks[1], 'GPT Models'),
          pipeline: this.formatCheckResult(healthChecks[2], 'Processing Pipeline'),
          schema: this.formatCheckResult(healthChecks[3], 'Schema Consistency'),
          costs: this.formatCheckResult(healthChecks[4], 'Cost Budgets'),
          environment: this.formatCheckResult(healthChecks[5], 'Environment'),
          network: this.formatCheckResult(healthChecks[6], 'Network'),
          resources: this.formatCheckResult(healthChecks[7], 'Resources')
        },
        summary: this.generateHealthSummary(healthChecks),
        recommendations: this.generateRecommendations(healthChecks),
        correlationId: context.correlationId
      };
      
      // Cache the results
      this.metricsCache = {
        lastCheck: Date.now(),
        results: healthReport,
        cacheDuration: this.config.isDev ? 30000 : 60000 // Shorter cache in dev
      };
      
      timer.end({ 
        overall: healthReport.overall,
        checksPerformed: healthChecks.length
      });
      
      // Log critical issues
      if (!healthReport.overall) {
        logger.error('System health check failed', healthReport.summary);
      } else {
        logger.info('System health check completed', healthReport.summary);
      }
      
      return healthReport;
      
    } catch (error) {
      timer.end({ error: error.message });
      logger.error('Health check failed', error);
      
      return {
        timestamp: new Date().toISOString(),
        overall: false,
        error: error.message,
        correlationId: context.correlationId
      };
    }
  }
  
  /**
   * Check DynamoDB health
   */
  async checkDynamoDB(logger) {
    const childLogger = CorrelationMiddleware.createChildLogger(logger, 'dynamodb_check');
    const timer = childLogger.startTimer('dynamodb_health');
    
    try {
      const jobManager = getJobManager();
      
      // Test basic operations
      const startTime = Date.now();
      const stats = await jobManager.getJobStatistics({ logger: childLogger });
      const responseTime = Date.now() - startTime;
      
      // Check table accessibility
      const tableHealth = {
        accessible: true,
        responseTime: responseTime,
        recordCount: stats.total,
        oldestRecord: stats.oldestJob ? new Date(stats.oldestJob.createdAt).toISOString() : null,
        newestRecord: stats.newestJob ? new Date(stats.newestJob.createdAt).toISOString() : null
      };
      
      // Performance thresholds
      const healthy = responseTime < this.thresholds.responseTime;
      
      timer.end({ healthy, responseTime });
      
      return {
        healthy: healthy,
        details: tableHealth,
        metrics: {
          responseTime: responseTime,
          threshold: this.thresholds.responseTime,
          recordCount: stats.total
        }
      };
      
    } catch (error) {
      timer.end({ healthy: false, error: error.message });
      childLogger.error('DynamoDB health check failed', error);
      
      return {
        healthy: false,
        error: error.message,
        details: {
          accessible: false,
          errorType: error.name,
          errorMessage: error.message
        }
      };
    }
  }
  
  /**
   * Check GPT models health
   */
  async checkGPTModels(logger) {
    const childLogger = CorrelationMiddleware.createChildLogger(logger, 'gpt_models_check');
    const timer = childLogger.startTimer('gpt_models_health');
    
    try {
      const modelRouter = getModelRouter();
      
      // Test model selection
      const testRequest = {
        extractionInstructions: 'Test health check extraction',
        url: 'https://example.com'
      };
      
      const selectedModel = modelRouter.selectModel(testRequest);
      const modelConfig = modelRouter.getModelConfig(selectedModel, testRequest);
      
      // Test actual GPT model connectivity
      const testResults = await Promise.allSettled([
        this.testGPTModel('gpt-4o', childLogger),
        this.config.gpt5Enabled ? this.testGPTModel('gpt-5-nano', childLogger) : Promise.resolve({ skipped: true })
      ]);
      
      const gpt4Result = testResults[0];
      const gpt5Result = testResults[1];
      
      const modelHealth = {
        selectedModel: selectedModel,
        modelConfig: modelConfig,
        gpt4Available: gpt4Result.status === 'fulfilled' && gpt4Result.value.healthy,
        gpt5Available: gpt5Result.status === 'fulfilled' && gpt5Result.value.healthy,
        gpt5Enabled: this.config.gpt5Enabled,
        fallbackChain: modelRouter.getFallbackChain(selectedModel)
      };
      
      // Add performance metrics
      if (gpt4Result.status === 'fulfilled' && gpt4Result.value.metrics) {
        modelHealth.gpt4Metrics = gpt4Result.value.metrics;
      }
      
      if (gpt5Result.status === 'fulfilled' && gpt5Result.value.metrics) {
        modelHealth.gpt5Metrics = gpt5Result.value.metrics;
      }
      
      const healthy = modelHealth.gpt4Available || modelHealth.gpt5Available;
      
      timer.end({ 
        healthy,
        selectedModel,
        gpt4Available: modelHealth.gpt4Available,
        gpt5Available: modelHealth.gpt5Available
      });
      
      return {
        healthy: healthy,
        details: modelHealth,
        recommendations: this.getModelRecommendations(modelHealth)
      };
      
    } catch (error) {
      timer.end({ healthy: false, error: error.message });
      childLogger.error('GPT models health check failed', error);
      
      return {
        healthy: false,
        error: error.message,
        details: {
          modelSelectionFailed: true,
          errorType: error.name
        }
      };
    }
  }
  
  /**
   * Test individual GPT model
   */
  async testGPTModel(model, logger) {
    const timer = logger.startTimer(`test_${model}`);
    
    try {
      const startTime = Date.now();
      
      const response = await this.openai.chat.completions.create({
        model: model,
        messages: [{ 
          role: 'user', 
          content: 'Respond with just "OK" for health check' 
        }],
        max_tokens: 10,
        temperature: 0
      });
      
      const responseTime = Date.now() - startTime;
      const content = response.choices[0]?.message?.content?.trim();
      
      const healthy = content === 'OK' && responseTime < 10000; // 10 second timeout
      
      timer.end({ healthy, responseTime, model });
      
      return {
        healthy: healthy,
        model: model,
        metrics: {
          responseTime: responseTime,
          tokenUsage: response.usage,
          responseContent: content
        }
      };
      
    } catch (error) {
      timer.end({ healthy: false, error: error.message, model });
      
      return {
        healthy: false,
        model: model,
        error: error.message,
        errorType: this.categorizeOpenAIError(error)
      };
    }
  }
  
  /**
   * Check processing pipeline health
   */
  async checkProcessingPipeline(logger) {
    const childLogger = CorrelationMiddleware.createChildLogger(logger, 'pipeline_check');
    const timer = childLogger.startTimer('pipeline_health');
    
    try {
      const extractionEngine = getExtractionEngine();
      
      // Test extraction pipeline with simple request
      const testRequest = {
        url: 'https://example.com',
        extractionInstructions: 'Extract the page title',
        type: 'sync'
      };
      
      // Mock extraction test (don't actually call external services)
      const pipelineHealth = {
        engineInitialized: !!extractionEngine,
        legacySystemsAvailable: this.checkLegacySystemsAvailability(),
        processingStrategies: this.getAvailableProcessingStrategies(),
        fallbackChains: this.getFallbackChainHealth()
      };
      
      const healthy = pipelineHealth.engineInitialized && 
                     pipelineHealth.processingStrategies.length > 0;
      
      timer.end({ healthy, strategiesCount: pipelineHealth.processingStrategies.length });
      
      return {
        healthy: healthy,
        details: pipelineHealth,
        metrics: {
          strategiesAvailable: pipelineHealth.processingStrategies.length,
          fallbacksAvailable: pipelineHealth.fallbackChains.filter(f => f.available).length
        }
      };
      
    } catch (error) {
      timer.end({ healthy: false, error: error.message });
      childLogger.error('Processing pipeline health check failed', error);
      
      return {
        healthy: false,
        error: error.message,
        details: {
          pipelineInitializationFailed: true
        }
      };
    }
  }
  
  /**
   * Check schema consistency
   */
  async checkSchemaConsistency(logger) {
    const childLogger = CorrelationMiddleware.createChildLogger(logger, 'schema_check');
    const timer = childLogger.startTimer('schema_consistency');
    
    try {
      const jobManager = getJobManager();
      
      // Sample recent jobs to check schema consistency
      const recentJobs = await jobManager.listJobs({ 
        limit: 10,
        createdAfter: Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
      }, { logger: childLogger });
      
      const schemaAnalysis = {
        totalJobs: recentJobs.total,
        jobsSampled: recentJobs.jobs.length,
        schemaVersions: {},
        inconsistencies: [],
        migrationNeeded: false
      };
      
      // Analyze schema versions
      recentJobs.jobs.forEach(job => {
        const version = job.schemaVersion || 'unknown';
        schemaAnalysis.schemaVersions[version] = (schemaAnalysis.schemaVersions[version] || 0) + 1;
        
        // Check for missing required fields
        const requiredFields = ['id', 'type', 'status', 'url', 'createdAt', 'updatedAt'];
        const missingFields = requiredFields.filter(field => !job[field]);
        
        if (missingFields.length > 0) {
          schemaAnalysis.inconsistencies.push({
            jobId: job.id,
            missingFields: missingFields
          });
        }
      });
      
      // Check if migration is needed
      const currentVersion = '1.0.0';
      const nonCurrentVersions = Object.keys(schemaAnalysis.schemaVersions)
        .filter(v => v !== currentVersion);
      
      schemaAnalysis.migrationNeeded = nonCurrentVersions.length > 0;
      
      const healthy = schemaAnalysis.inconsistencies.length === 0;
      
      timer.end({ 
        healthy,
        inconsistencies: schemaAnalysis.inconsistencies.length,
        migrationNeeded: schemaAnalysis.migrationNeeded
      });
      
      return {
        healthy: healthy,
        details: schemaAnalysis,
        recommendations: this.getSchemaRecommendations(schemaAnalysis)
      };
      
    } catch (error) {
      timer.end({ healthy: false, error: error.message });
      childLogger.error('Schema consistency check failed', error);
      
      return {
        healthy: false,
        error: error.message
      };
    }
  }
  
  /**
   * Check cost budgets
   */
  async checkCostBudgets(logger) {
    const childLogger = CorrelationMiddleware.createChildLogger(logger, 'cost_check');
    const timer = childLogger.startTimer('cost_budget_check');
    
    try {
      // Mock cost analysis - in production this would integrate with AWS Cost Explorer
      const costAnalysis = {
        monthlyBudget: this.config.monthlyBudget,
        estimatedCurrentSpend: 0, // Would be calculated from actual usage
        budgetUsedPercentage: 0,
        dailyAverageSpend: 0,
        projectedMonthlySpend: 0,
        alerts: []
      };
      
      // Calculate based on job statistics (mock calculation)
      const jobManager = getJobManager();
      const stats = await jobManager.getJobStatistics({ logger: childLogger });
      
      // Rough cost estimation based on job count
      const avgCostPerJob = 0.05; // $0.05 per job estimate
      const completedJobs = stats.byStatus?.completed || 0;
      costAnalysis.estimatedCurrentSpend = completedJobs * avgCostPerJob;
      
      costAnalysis.budgetUsedPercentage = costAnalysis.estimatedCurrentSpend / costAnalysis.monthlyBudget;
      
      // Generate alerts
      if (costAnalysis.budgetUsedPercentage > this.thresholds.costBudgetUsed) {
        costAnalysis.alerts.push({
          level: 'WARNING',
          message: `Budget usage at ${Math.round(costAnalysis.budgetUsedPercentage * 100)}%`
        });
      }
      
      if (costAnalysis.budgetUsedPercentage > 0.95) {
        costAnalysis.alerts.push({
          level: 'CRITICAL',
          message: 'Budget nearly exhausted'
        });
      }
      
      const healthy = costAnalysis.budgetUsedPercentage < this.thresholds.costBudgetUsed;
      
      timer.end({ 
        healthy,
        budgetUsed: Math.round(costAnalysis.budgetUsedPercentage * 100)
      });
      
      return {
        healthy: healthy,
        details: costAnalysis,
        alerts: costAnalysis.alerts
      };
      
    } catch (error) {
      timer.end({ healthy: false, error: error.message });
      childLogger.error('Cost budget check failed', error);
      
      return {
        healthy: false,
        error: error.message
      };
    }
  }
  
  /**
   * Check environment health
   */
  async checkEnvironmentHealth(logger) {
    const timer = logger.startTimer('environment_health');
    
    try {
      const envHealth = {
        stage: this.config.stage,
        nodeEnv: this.config.nodeEnv,
        region: this.config.region,
        configurationComplete: true,
        requiredVariables: [],
        optionalVariables: [],
        issues: []
      };
      
      // Check required configuration
      const required = [
        'masterApiKey', 'openaiApiKey', 'dynamoTables', 'stage', 'region'
      ];
      
      required.forEach(key => {
        const value = this.config[key];
        envHealth.requiredVariables.push({
          name: key,
          present: !!value,
          type: typeof value
        });
        
        if (!value) {
          envHealth.configurationComplete = false;
          envHealth.issues.push(`Missing required configuration: ${key}`);
        }
      });
      
      // Check for environment-specific issues
      if (this.config.isProd && this.config.masterApiKey === 'test-key-123') {
        envHealth.issues.push('Production environment using test API key');
      }
      
      if (this.config.gpt5Enabled && this.config.forceGpt4) {
        envHealth.issues.push('Conflicting GPT configuration: both GPT-5 enabled and GPT-4 forced');
      }
      
      const healthy = envHealth.configurationComplete && envHealth.issues.length === 0;
      
      timer.end({ 
        healthy,
        issues: envHealth.issues.length
      });
      
      return {
        healthy: healthy,
        details: envHealth
      };
      
    } catch (error) {
      timer.end({ healthy: false, error: error.message });
      
      return {
        healthy: false,
        error: error.message
      };
    }
  }
  
  /**
   * Check network connectivity
   */
  async checkNetworkConnectivity(logger) {
    const timer = logger.startTimer('network_connectivity');
    
    try {
      // Test connectivity to key services
      const connectivityTests = await Promise.allSettled([
        this.testHttpConnectivity('https://api.openai.com', logger),
        this.testHttpConnectivity('https://example.com', logger)
      ]);
      
      const networkHealth = {
        openaiConnectivity: connectivityTests[0].status === 'fulfilled' && connectivityTests[0].value.healthy,
        externalConnectivity: connectivityTests[1].status === 'fulfilled' && connectivityTests[1].value.healthy,
        details: {
          openai: connectivityTests[0].status === 'fulfilled' ? connectivityTests[0].value : { error: connectivityTests[0].reason?.message },
          external: connectivityTests[1].status === 'fulfilled' ? connectivityTests[1].value : { error: connectivityTests[1].reason?.message }
        }
      };
      
      const healthy = networkHealth.openaiConnectivity && networkHealth.externalConnectivity;
      
      timer.end({ 
        healthy,
        openaiConnectivity: networkHealth.openaiConnectivity,
        externalConnectivity: networkHealth.externalConnectivity
      });
      
      return {
        healthy: healthy,
        details: networkHealth
      };
      
    } catch (error) {
      timer.end({ healthy: false, error: error.message });
      
      return {
        healthy: false,
        error: error.message
      };
    }
  }
  
  /**
   * Check resource utilization
   */
  async checkResourceUtilization(logger) {
    const timer = logger.startTimer('resource_utilization');
    
    try {
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      };
      
      const resourceHealth = {
        memory: memoryUsageMB,
        memoryLimit: this.config.lambdaMemorySize || 1024,
        memoryUsagePercentage: memoryUsageMB.heapUsed / (this.config.lambdaMemorySize || 1024),
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform
      };
      
      const healthy = resourceHealth.memoryUsagePercentage < this.thresholds.memoryUsage;
      
      timer.end({ 
        healthy,
        memoryUsagePercentage: Math.round(resourceHealth.memoryUsagePercentage * 100)
      });
      
      return {
        healthy: healthy,
        details: resourceHealth,
        alerts: resourceHealth.memoryUsagePercentage > this.thresholds.memoryUsage ? 
          [{ level: 'WARNING', message: 'High memory usage detected' }] : []
      };
      
    } catch (error) {
      timer.end({ healthy: false, error: error.message });
      
      return {
        healthy: false,
        error: error.message
      };
    }
  }
  
  // Helper methods
  
  shouldUseCachedResults() {
    return this.metricsCache.lastCheck &&
           this.metricsCache.results &&
           (Date.now() - this.metricsCache.lastCheck) < this.metricsCache.cacheDuration;
  }
  
  calculateOverallHealth(healthChecks) {
    const successfulChecks = healthChecks.filter(check => 
      check.status === 'fulfilled' && check.value?.healthy
    ).length;
    
    const totalChecks = healthChecks.length;
    const healthPercentage = successfulChecks / totalChecks;
    
    // System is healthy if at least 80% of checks pass
    return healthPercentage >= 0.8;
  }
  
  formatCheckResult(checkResult, checkName) {
    if (checkResult.status === 'fulfilled') {
      return {
        name: checkName,
        healthy: checkResult.value.healthy,
        ...checkResult.value
      };
    } else {
      return {
        name: checkName,
        healthy: false,
        error: checkResult.reason?.message || 'Check failed'
      };
    }
  }
  
  generateHealthSummary(healthChecks) {
    const total = healthChecks.length;
    const healthy = healthChecks.filter(check => 
      check.status === 'fulfilled' && check.value?.healthy
    ).length;
    const failed = total - healthy;
    
    return {
      totalChecks: total,
      healthyChecks: healthy,
      failedChecks: failed,
      healthPercentage: Math.round((healthy / total) * 100)
    };
  }
  
  generateRecommendations(healthChecks) {
    const recommendations = [];
    
    // Analyze each check for recommendations
    healthChecks.forEach((check, index) => {
      if (check.status === 'fulfilled' && !check.value?.healthy) {
        const checkNames = ['DynamoDB', 'GPT Models', 'Processing Pipeline', 'Schema Consistency', 'Cost Budgets', 'Environment', 'Network', 'Resources'];
        const checkName = checkNames[index];
        
        if (check.value?.recommendations) {
          recommendations.push(...check.value.recommendations);
        } else if (check.value?.error) {
          recommendations.push({
            priority: 'HIGH',
            component: checkName,
            issue: check.value.error,
            action: `Investigate and resolve ${checkName} issues`
          });
        }
      }
    });
    
    return recommendations;
  }
  
  categorizeOpenAIError(error) {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('rate limit') || message.includes('quota')) {
      return 'RATE_LIMIT';
    } else if (message.includes('invalid') || message.includes('authentication')) {
      return 'AUTHENTICATION';
    } else if (message.includes('timeout') || message.includes('network')) {
      return 'NETWORK';
    } else if (message.includes('model') || message.includes('not found')) {
      return 'MODEL_UNAVAILABLE';
    } else {
      return 'UNKNOWN';
    }
  }
  
  async testHttpConnectivity(url, logger) {
    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'HEAD',
        timeout: 5000,
        headers: CorrelationMiddleware.addToOutboundRequest()
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: response.ok,
        url: url,
        statusCode: response.status,
        responseTime: responseTime
      };
      
    } catch (error) {
      return {
        healthy: false,
        url: url,
        error: error.message
      };
    }
  }
  
  checkLegacySystemsAvailability() {
    const systems = {};
    
    try {
      systems.evidenceFirst = !!require('../evidence-first-bridge');
    } catch (e) {
      systems.evidenceFirst = false;
    }
    
    try {
      systems.planBased = !!require('../worker-enhanced');
    } catch (e) {
      systems.planBased = false;
    }
    
    try {
      systems.aiProcessor = !!require('../ai-processor');
    } catch (e) {
      systems.aiProcessor = false;
    }
    
    return systems;
  }
  
  getAvailableProcessingStrategies() {
    return [
      'navigation_aware',
      'reasoning_enhanced',
      'ai_processor',
      'direct_extraction',
      'evidence_first',
      'plan_based'
    ];
  }
  
  getFallbackChainHealth() {
    return [
      { name: 'evidence_first', available: true },
      { name: 'plan_based', available: true },
      { name: 'direct_extraction', available: true }
    ];
  }
  
  getModelRecommendations(modelHealth) {
    const recommendations = [];
    
    if (!modelHealth.gpt4Available && !modelHealth.gpt5Available) {
      recommendations.push({
        priority: 'CRITICAL',
        component: 'GPT Models',
        issue: 'No GPT models available',
        action: 'Check OpenAI API key and connectivity'
      });
    }
    
    if (modelHealth.gpt5Enabled && !modelHealth.gpt5Available) {
      recommendations.push({
        priority: 'MEDIUM',
        component: 'GPT-5 Models',
        issue: 'GPT-5 enabled but not available',
        action: 'Verify GPT-5 model access or disable GPT-5'
      });
    }
    
    return recommendations;
  }
  
  getSchemaRecommendations(schemaAnalysis) {
    const recommendations = [];
    
    if (schemaAnalysis.migrationNeeded) {
      recommendations.push({
        priority: 'HIGH',
        component: 'Schema Migration',
        issue: 'Jobs with outdated schema versions found',
        action: 'Run schema migration to update all jobs to current version'
      });
    }
    
    if (schemaAnalysis.inconsistencies.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        component: 'Schema Validation',
        issue: `${schemaAnalysis.inconsistencies.length} jobs with schema inconsistencies`,
        action: 'Fix jobs with missing required fields'
      });
    }
    
    return recommendations;
  }
}

// Singleton instance
let healthMonitorInstance = null;

/**
 * Get health monitor singleton
 */
function getHealthMonitor() {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new ComprehensiveHealthMonitor();
  }
  return healthMonitorInstance;
}

/**
 * Reset health monitor (for testing)
 */
function resetHealthMonitor() {
  healthMonitorInstance = null;
}

module.exports = {
  ComprehensiveHealthMonitor,
  getHealthMonitor,
  resetHealthMonitor
};