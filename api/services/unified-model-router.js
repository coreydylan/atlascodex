/**
 * Unified Model Router for Atlas Codex
 * 
 * Single model selection logic for GPT-4/GPT-5 routing.
 * Addresses: Multiple GPT-5 rollout mechanisms creating confusion
 * Ensures: Deterministic model selection with cost optimization
 */

const { getEnvironmentConfig } = require('../config/environment');

/**
 * Unified Model Router
 * Handles intelligent model selection based on request complexity and environment
 */
class UnifiedModelRouter {
  constructor() {
    this.config = getEnvironmentConfig();
    
    // Model pricing (per 1M tokens) - Updated as of GPT-5 release
    this.pricing = {
      'gpt-4': { input: 30.0, output: 60.0 },
      'gpt-4-turbo': { input: 10.0, output: 30.0 },
      'gpt-4o': { input: 5.0, output: 15.0 },
      'gpt-5': { input: 1.25, output: 10.0 },
      'gpt-5-mini': { input: 0.25, output: 2.0 },
      'gpt-5-nano': { input: 0.05, output: 0.5 }
    };
    
    // Model capabilities
    this.capabilities = {
      'gpt-4': { reasoning: 0.8, speed: 0.6, cost: 0.2 },
      'gpt-4-turbo': { reasoning: 0.8, speed: 0.7, cost: 0.5 },
      'gpt-4o': { reasoning: 0.8, speed: 0.8, cost: 0.7 },
      'gpt-5': { reasoning: 1.0, speed: 0.7, cost: 0.6 },
      'gpt-5-mini': { reasoning: 0.9, speed: 0.8, cost: 0.8 },
      'gpt-5-nano': { reasoning: 0.7, speed: 0.9, cost: 0.95 }
    };
  }
  
  /**
   * Select optimal model for request
   */
  selectModel(request, overrides = {}) {
    try {
      // Check for explicit model override
      if (overrides.modelOverride || request.modelOverride) {
        const override = overrides.modelOverride || request.modelOverride;
        this.validateModel(override);
        return override;
      }
      
      // Production safety: Force GPT-4 if configured
      if (this.config.isProd && this.config.forceGpt4) {
        return this.selectGpt4Model(request);
      }
      
      // GPT-5 routing
      if (this.config.shouldUseGpt5) {
        return this.selectGpt5Model(request);
      }
      
      // Fallback to GPT-4
      return this.selectGpt4Model(request);
      
    } catch (error) {
      console.warn('Model selection error, falling back to default:', error.message);
      return this.getDefaultModel();
    }
  }
  
  /**
   * Select GPT-5 model variant based on complexity
   */
  selectGpt5Model(request) {
    const complexity = this.calculateComplexity(request);
    const costSensitivity = this.calculateCostSensitivity(request);
    
    // High complexity or explicit reasoning request
    if (complexity >= 0.8 || request.requiresReasoning) {
      return 'gpt-5';
    }
    
    // Medium complexity with cost consideration
    if (complexity >= 0.4) {
      return costSensitivity >= 0.7 ? 'gpt-5-mini' : 'gpt-5';
    }
    
    // Low complexity - optimize for cost
    if (complexity >= 0.2) {
      return 'gpt-5-mini';
    }
    
    // Simple tasks
    return 'gpt-5-nano';
  }
  
  /**
   * Select GPT-4 model variant
   */
  selectGpt4Model(request) {
    const complexity = this.calculateComplexity(request);
    
    // High complexity
    if (complexity >= 0.7) {
      return this.config.isProd ? 'gpt-4o' : 'gpt-4-turbo';
    }
    
    // Medium complexity
    if (complexity >= 0.4) {
      return 'gpt-4o';
    }
    
    // Simple tasks
    return 'gpt-4o'; // Best cost/performance for GPT-4 family
  }
  
  /**
   * Calculate request complexity score (0-1)
   */
  calculateComplexity(request) {
    let complexity = 0.0;
    
    // Extraction instructions complexity
    const instructions = request.extractionInstructions || request.prompt || '';
    
    // Length factor
    const lengthFactor = Math.min(instructions.length / 1000, 1.0) * 0.3;
    complexity += lengthFactor;
    
    // Complexity keywords
    const complexityKeywords = [
      'analyze', 'reasoning', 'complex', 'detailed', 'comprehensive',
      'multi-step', 'relationship', 'pattern', 'structure', 'logic',
      'compare', 'contrast', 'evaluate', 'synthesize', 'infer'
    ];
    
    const keywordMatches = complexityKeywords.filter(keyword =>
      instructions.toLowerCase().includes(keyword)
    ).length;
    
    const keywordFactor = Math.min(keywordMatches / 3, 1.0) * 0.3;
    complexity += keywordFactor;
    
    // Multi-page factor
    if (request.maxPages && request.maxPages > 5) {
      complexity += 0.2;
    }
    
    // Depth factor
    if (request.maxDepth && request.maxDepth > 2) {
      complexity += 0.1;
    }
    
    // URL complexity (dynamic sites, e-commerce, etc.)
    const url = request.url || '';
    if (url.includes('shop') || url.includes('store') || url.includes('product')) {
      complexity += 0.1;
    }
    
    return Math.min(complexity, 1.0);
  }
  
  /**
   * Calculate cost sensitivity (0-1, higher = more cost sensitive)
   */
  calculateCostSensitivity(request) {
    let sensitivity = 0.5; // Default moderate sensitivity
    
    // Batch processing is more cost sensitive
    if (request.type === 'batch' || request.maxPages > 10) {
      sensitivity += 0.3;
    }
    
    // Development environment is more cost sensitive
    if (this.config.isDev) {
      sensitivity += 0.2;
    }
    
    // High volume requests
    if (request.estimatedVolume > 100) {
      sensitivity += 0.2;
    }
    
    return Math.min(sensitivity, 1.0);
  }
  
  /**
   * Get model configuration for OpenAI API
   */
  getModelConfig(model, request = {}) {
    const baseConfig = {
      model: model,
      temperature: this.getOptimalTemperature(model, request),
      max_tokens: this.getOptimalMaxTokens(model, request)
    };
    
    // Add response format for structured output
    if (request.responseFormat === 'json' || request.extractionInstructions) {
      baseConfig.response_format = { type: "json_object" };
    }
    
    // Add reasoning configuration for GPT-5
    if (model.startsWith('gpt-5') && this.config.gpt5ReasoningEnabled) {
      if (this.shouldUseReasoning(request)) {
        baseConfig.reasoning = true;
      }
    }
    
    return baseConfig;
  }
  
  /**
   * Determine optimal temperature for model and task
   */
  getOptimalTemperature(model, request) {
    // Extraction tasks need low temperature for consistency
    if (request.extractionInstructions) {
      return model.startsWith('gpt-5') ? 0.1 : 0.2;
    }
    
    // AI processing allows slightly higher creativity
    if (request.type === 'ai-process') {
      return 0.3;
    }
    
    // Default conservative temperature
    return 0.2;
  }
  
  /**
   * Determine optimal max_tokens for model
   */
  getOptimalMaxTokens(model, request) {
    // Large extraction tasks
    if (request.maxPages > 10) {
      return model.startsWith('gpt-5') ? 16000 : 8000;
    }
    
    // Standard extraction
    if (request.extractionInstructions) {
      return model.startsWith('gpt-5') ? 8000 : 4000;
    }
    
    // AI processing
    return 2000;
  }
  
  /**
   * Determine if reasoning mode should be used
   */
  shouldUseReasoning(request) {
    if (!this.config.gpt5ReasoningEnabled) return false;
    
    const complexity = this.calculateComplexity(request);
    
    // High complexity tasks benefit from reasoning
    if (complexity >= 0.8) return true;
    
    // Explicit reasoning requests
    if (request.requiresReasoning) return true;
    
    // Complex multi-page extractions
    if (request.maxPages > 20) return true;
    
    return false;
  }
  
  /**
   * Estimate cost for request
   */
  estimateCost(model, request) {
    const pricing = this.pricing[model];
    if (!pricing) return 0;
    
    // Rough token estimation based on complexity
    const complexity = this.calculateComplexity(request);
    const baseTokens = 1000;
    const inputTokens = Math.floor(baseTokens * (1 + complexity * 2));
    const outputTokens = Math.floor(baseTokens * (0.5 + complexity));
    
    // Apply multi-page multiplier
    const pageMultiplier = Math.min(request.maxPages || 1, 20);
    const totalInputTokens = inputTokens * pageMultiplier;
    const totalOutputTokens = outputTokens * pageMultiplier;
    
    // Calculate cost
    const inputCost = (totalInputTokens / 1000000) * pricing.input;
    const outputCost = (totalOutputTokens / 1000000) * pricing.output;
    
    return {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      inputCost: inputCost,
      outputCost: outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD'
    };
  }
  
  /**
   * Get fallback model chain
   */
  getFallbackChain(primaryModel) {
    const fallbackChains = {
      'gpt-5': ['gpt-5-mini', 'gpt-4o', 'gpt-4-turbo'],
      'gpt-5-mini': ['gpt-5-nano', 'gpt-4o'],
      'gpt-5-nano': ['gpt-4o'],
      'gpt-4o': ['gpt-4-turbo'],
      'gpt-4-turbo': ['gpt-4'],
      'gpt-4': []
    };
    
    return fallbackChains[primaryModel] || ['gpt-4o'];
  }
  
  /**
   * Validate model availability
   */
  validateModel(model) {
    const availableModels = Object.keys(this.pricing);
    if (!availableModels.includes(model)) {
      throw new Error(`Model ${model} is not available. Available models: ${availableModels.join(', ')}`);
    }
    
    // Additional validation for GPT-5 models
    if (model.startsWith('gpt-5') && !this.config.gpt5Enabled) {
      throw new Error(`GPT-5 models are not enabled in current environment`);
    }
    
    return true;
  }
  
  /**
   * Get default model based on environment
   */
  getDefaultModel() {
    return this.config.defaultModel;
  }
  
  /**
   * Get model performance metrics
   */
  getModelMetrics(model) {
    return {
      capabilities: this.capabilities[model] || this.capabilities['gpt-4o'],
      pricing: this.pricing[model] || this.pricing['gpt-4o'],
      fallbacks: this.getFallbackChain(model)
    };
  }
  
  /**
   * Select model with cost constraints
   */
  selectWithBudget(request, maxCost) {
    const models = Object.keys(this.pricing).sort((a, b) => {
      const costA = this.estimateCost(a, request).totalCost;
      const costB = this.estimateCost(b, request).totalCost;
      return costA - costB;
    });
    
    for (const model of models) {
      const cost = this.estimateCost(model, request);
      if (cost.totalCost <= maxCost) {
        return model;
      }
    }
    
    throw new Error(`No model available within budget of $${maxCost}`);
  }
}

// Singleton instance
let modelRouterInstance = null;

/**
 * Get unified model router singleton
 */
function getModelRouter() {
  if (!modelRouterInstance) {
    modelRouterInstance = new UnifiedModelRouter();
  }
  return modelRouterInstance;
}

/**
 * Reset model router (for testing)
 */
function resetModelRouter() {
  modelRouterInstance = null;
}

module.exports = {
  UnifiedModelRouter,
  getModelRouter,
  resetModelRouter
};