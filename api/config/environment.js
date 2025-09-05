/**
 * Consolidated Environment Configuration for Atlas Codex
 * 
 * Single source of truth for all environment variables and configuration.
 * Addresses: Multiple configuration sources causing inconsistencies
 * Ensures: Runtime validation and consistent configuration across all components
 */

/**
 * Environment Configuration Manager
 * Consolidates all environment variables with validation and defaults
 */
class EnvironmentConfig {
  constructor() {
    this.config = null;
    this.validationErrors = [];
    this.load();
  }
  
  /**
   * Load and validate all environment configuration
   */
  load() {
    try {
      const rawConfig = this.loadRawConfig();
      const validatedConfig = this.validateConfig(rawConfig);
      const enrichedConfig = this.enrichConfig(validatedConfig);
      
      this.config = Object.freeze(enrichedConfig);
      
      // Log configuration summary (without secrets)
      this.logConfigurationSummary();
      
    } catch (error) {
      console.error('❌ Environment configuration failed:', error.message);
      throw new Error(`Environment configuration error: ${error.message}`);
    }
  }
  
  /**
   * Load raw configuration from environment variables
   */
  loadRawConfig() {
    return {
      // Core Environment
      nodeEnv: process.env.NODE_ENV,
      stage: process.env.STAGE || process.env.SERVERLESS_STAGE || 'dev',
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-west-2',
      
      // API Configuration
      masterApiKey: process.env.MASTER_API_KEY,
      corsOrigin: process.env.CORS_ORIGIN || '*',
      
      // AI/Model Configuration
      openaiApiKey: process.env.OPENAI_API_KEY,
      gpt5Enabled: process.env.GPT5_ENABLED,
      gpt5ModelSelection: process.env.GPT5_MODEL_SELECTION || 'auto',
      gpt5FallbackEnabled: process.env.GPT5_FALLBACK_ENABLED,
      gpt5ReasoningEnabled: process.env.GPT5_REASONING_ENABLED,
      forceGpt4: process.env.FORCE_GPT4,
      unifiedExtractorEnabled: process.env.UNIFIED_EXTRACTOR_ENABLED,
      defaultModelStrategy: process.env.DEFAULT_MODEL_STRATEGY,
      
      // AWS Resources
      queueUrl: process.env.QUEUE_URL,
      websocketApiEndpoint: process.env.WEBSOCKET_API_ENDPOINT,
      artifactsBucket: process.env.ARTIFACTS_BUCKET,
      connectionsTable: process.env.CONNECTIONS_TABLE,
      
      // Performance Configuration
      lambdaTimeout: process.env.LAMBDA_TIMEOUT,
      lambdaMemorySize: process.env.LAMBDA_MEMORY_SIZE,
      workerTimeout: process.env.WORKER_TIMEOUT,
      
      // Cost Management
      monthlyBudget: process.env.MONTHLY_BUDGET,
      costAlertsEnabled: process.env.COST_ALERTS_ENABLED,
      
      // Feature Flags
      featureFlags: {
        asyncProcessing: process.env.FEATURE_ASYNC_PROCESSING,
        batchProcessing: process.env.FEATURE_BATCH_PROCESSING,
        webhookSupport: process.env.FEATURE_WEBHOOK_SUPPORT,
        advancedLogging: process.env.FEATURE_ADVANCED_LOGGING
      }
    };
  }
  
  /**
   * Validate configuration with proper defaults and type conversion
   */
  validateConfig(rawConfig) {
    const config = {
      // Core Environment - Required
      nodeEnv: this.validateEnum(rawConfig.nodeEnv, ['development', 'production', 'test'], 'production'),
      stage: this.validateString(rawConfig.stage, 'dev'),
      region: this.validateString(rawConfig.region, 'us-west-2'),
      
      // API Configuration
      masterApiKey: this.validateRequired(rawConfig.masterApiKey, 'MASTER_API_KEY'),
      corsOrigin: this.validateString(rawConfig.corsOrigin, '*'),
      
      // AI/Model Configuration
      openaiApiKey: this.validateRequired(rawConfig.openaiApiKey, 'OPENAI_API_KEY'),
      gpt5Enabled: this.parseBoolean(rawConfig.gpt5Enabled, true),
      gpt5ModelSelection: this.validateEnum(rawConfig.gpt5ModelSelection, ['auto', 'nano', 'mini', 'full'], 'auto'),
      gpt5FallbackEnabled: this.parseBoolean(rawConfig.gpt5FallbackEnabled, true),
      gpt5ReasoningEnabled: this.parseBoolean(rawConfig.gpt5ReasoningEnabled, true),
      forceGpt4: this.parseBoolean(rawConfig.forceGpt4, false),
      unifiedExtractorEnabled: this.parseBoolean(rawConfig.unifiedExtractorEnabled, true),
      defaultModelStrategy: this.validateEnum(rawConfig.defaultModelStrategy, ['auto', 'gpt4_stable', 'gpt5_preview'], 'auto'),
      
      // AWS Resources
      queueUrl: rawConfig.queueUrl, // Optional - will be set if using SQS
      websocketApiEndpoint: rawConfig.websocketApiEndpoint,
      artifactsBucket: rawConfig.artifactsBucket,
      connectionsTable: rawConfig.connectionsTable,
      
      // Performance Configuration
      lambdaTimeout: this.validateInteger(rawConfig.lambdaTimeout, 300, 1, 900),
      lambdaMemorySize: this.validateInteger(rawConfig.lambdaMemorySize, 1024, 128, 10240),
      workerTimeout: this.validateInteger(rawConfig.workerTimeout, 280, 1, 900),
      
      // Cost Management
      monthlyBudget: this.validateFloat(rawConfig.monthlyBudget, 1000.0, 1.0, 100000.0),
      costAlertsEnabled: this.parseBoolean(rawConfig.costAlertsEnabled, true),
      
      // Feature Flags
      featureFlags: {
        asyncProcessing: this.parseBoolean(rawConfig.featureFlags.asyncProcessing, true),
        batchProcessing: this.parseBoolean(rawConfig.featureFlags.batchProcessing, false),
        webhookSupport: this.parseBoolean(rawConfig.featureFlags.webhookSupport, false),
        advancedLogging: this.parseBoolean(rawConfig.featureFlags.advancedLogging, true)
      }
    };
    
    // Validate configuration consistency
    this.validateConsistency(config);
    
    return config;
  }
  
  /**
   * Enrich configuration with computed values
   */
  enrichConfig(config) {
    const enriched = { ...config };
    
    // Compute derived values
    enriched.isProd = config.nodeEnv === 'production';
    enriched.isDev = config.nodeEnv === 'development';
    enriched.isTest = config.nodeEnv === 'test';
    
    // Table names with consistent naming
    enriched.dynamoTables = {
      jobs: `atlas-codex-jobs-${config.stage}`,
      connections: `atlas-codex-connections-${config.stage}`
    };
    
    // Queue names
    enriched.queueNames = {
      jobs: `atlas-codex-queue-${config.stage}`,
      deadLetter: `atlas-codex-dlq-${config.stage}`
    };
    
    // S3 bucket names
    enriched.s3Buckets = {
      artifacts: `atlas-codex-artifacts-${config.stage}`,
      logs: `atlas-codex-logs-${config.stage}`
    };
    
    // Model selection logic
    enriched.shouldUseGpt5 = this.shouldUseGpt5(config);
    enriched.defaultModel = this.getDefaultModel(config);
    
    // API endpoints
    enriched.apiEndpoints = {
      health: '/health',
      extract: '/api/extract',
      aiProcess: '/api/ai/process',
      status: '/api/status'
    };
    
    // Timeout configurations
    enriched.timeouts = {
      default: 120000, // 2 minutes
      worker: config.workerTimeout * 1000, // Convert to milliseconds
      api: config.lambdaTimeout * 1000,
      websocket: 300000 // 5 minutes
    };
    
    return enriched;
  }
  
  /**
   * Validate configuration consistency
   */
  validateConsistency(config) {
    const errors = [];
    
    // GPT-5 consistency checks
    if (config.gpt5Enabled && config.forceGpt4) {
      errors.push('Cannot enable both GPT-5 and force GPT-4');
    }
    
    // Production environment checks
    if (config.isProd) {
      if (config.masterApiKey === 'test-key-123') {
        errors.push('Production environment cannot use test API key');
      }
      if (!config.openaiApiKey || config.openaiApiKey.length < 10) {
        errors.push('Production environment requires valid OpenAI API key');
      }
    }
    
    // Memory and timeout consistency
    if (config.workerTimeout >= config.lambdaTimeout) {
      errors.push('Worker timeout must be less than Lambda timeout');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration consistency errors: ${errors.join('; ')}`);
    }
  }
  
  /**
   * Determine if GPT-5 should be used based on stage strategy
   */
  shouldUseGpt5(config) {
    // Explicit force GPT-4 (production safety)
    if (config.forceGpt4) return false;
    
    // Stage-specific model strategy
    const modelStrategy = config.defaultModelStrategy || 'auto';
    
    switch (modelStrategy) {
      case 'gpt4_stable':
        return false; // Production/staging uses stable GPT-4
      
      case 'gpt5_preview':
        return config.gpt5Enabled; // Preview/dev uses GPT-5 if available
      
      case 'auto':
      default:
        // Legacy auto-detection logic
        if (!config.gpt5Enabled) return false;
        // Conservative: production defaults to GPT-4 unless explicitly enabled
        if (config.isProd && !config.gpt5Enabled) return false;
        return true;
    }
  }
  
  /**
   * Get default model based on configuration
   */
  getDefaultModel(config) {
    if (this.shouldUseGpt5(config)) {
      switch (config.gpt5ModelSelection) {
        case 'nano': return 'gpt-5-nano';
        case 'mini': return 'gpt-5-mini';
        case 'full': return 'gpt-5';
        case 'auto': 
        default: return 'gpt-5-mini'; // Balanced default
      }
    }
    
    // GPT-4 fallback
    return config.isProd ? 'gpt-4o' : 'gpt-4-turbo';
  }
  
  // Validation helper methods
  validateRequired(value, name) {
    if (!value) {
      throw new Error(`Required environment variable ${name} is not set`);
    }
    return value;
  }
  
  validateString(value, defaultValue) {
    return typeof value === 'string' && value.length > 0 ? value : defaultValue;
  }
  
  validateEnum(value, allowedValues, defaultValue) {
    return allowedValues.includes(value) ? value : defaultValue;
  }
  
  validateInteger(value, defaultValue, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < min || parsed > max) {
      return defaultValue;
    }
    return parsed;
  }
  
  validateFloat(value, defaultValue, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < min || parsed > max) {
      return defaultValue;
    }
    return parsed;
  }
  
  parseBoolean(value, defaultValue) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      if (lower === 'false' || lower === '0' || lower === 'no') return false;
    }
    return defaultValue;
  }
  
  /**
   * Log configuration summary (without secrets)
   */
  logConfigurationSummary() {
    const summary = {
      environment: this.config.nodeEnv,
      stage: this.config.stage,
      region: this.config.region,
      gpt5Enabled: this.config.gpt5Enabled,
      defaultModel: this.config.defaultModel,
      unifiedExtractorEnabled: this.config.unifiedExtractorEnabled,
      features: this.config.featureFlags,
      tables: this.config.dynamoTables,
      timeouts: this.config.timeouts
    };
    
    console.log('🔧 Environment Configuration:', JSON.stringify(summary, null, 2));
  }
  
  /**
   * Get configuration
   */
  getConfig() {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }
  
  /**
   * Get specific configuration value
   */
  get(key) {
    return this.getConfig()[key];
  }
  
  /**
   * Check if running in production
   */
  isProd() {
    return this.get('isProd');
  }
  
  /**
   * Check if running in development
   */
  isDev() {
    return this.get('isDev');
  }
  
  /**
   * Get table name
   */
  getTableName(tableName) {
    return this.get('dynamoTables')[tableName];
  }
  
  /**
   * Get queue name
   */
  getQueueName(queueName) {
    return this.get('queueNames')[queueName];
  }
  
  /**
   * Get S3 bucket name
   */
  getBucketName(bucketName) {
    return this.get('s3Buckets')[bucketName];
  }
  
  /**
   * Validate environment at runtime
   */
  static validateEnvironment() {
    const config = new EnvironmentConfig();
    return config.getConfig();
  }
}

// Create singleton instance
let environmentInstance = null;

/**
 * Get environment configuration singleton
 */
function getEnvironmentConfig() {
  if (!environmentInstance) {
    environmentInstance = new EnvironmentConfig();
  }
  return environmentInstance.getConfig();
}

/**
 * Reset environment configuration (for testing)
 */
function resetEnvironmentConfig() {
  environmentInstance = null;
}

module.exports = {
  EnvironmentConfig,
  getEnvironmentConfig,
  resetEnvironmentConfig
};