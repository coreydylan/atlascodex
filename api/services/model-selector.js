// api/services/model-selector.js
const ModelSelector = {
  models: {
    'gpt-4o': { 
      inputPrice: 2.50, 
      outputPrice: 10, 
      maxTokens: 128000,
      bestFor: 'complex reasoning, production workloads'
    },
    'gpt-4o-mini': { 
      inputPrice: 0.15, 
      outputPrice: 0.60, 
      maxTokens: 128000,
      bestFor: 'balanced performance and cost'
    },
    'gpt-4-turbo': { 
      inputPrice: 10, 
      outputPrice: 30, 
      maxTokens: 128000,
      bestFor: 'highest quality reasoning'
    }
  },

  select(requirements) {
    const { complexity, budget, latency, accuracy } = requirements;
    
    // High accuracy or complex reasoning required
    if (accuracy > 0.95 || complexity > 0.8) {
      return 'gpt-4-turbo';
    }
    
    // Budget conscious with moderate requirements
    if (budget < 0.001 && complexity < 0.3) {
      return 'gpt-4o-mini';
    }
    
    // Default to balanced option
    return 'gpt-4o';
  },

  estimateCost(model, inputTokens, outputTokens) {
    const modelConfig = this.models[model];
    const inputCost = (inputTokens / 1_000_000) * modelConfig.inputPrice;
    const outputCost = (outputTokens / 1_000_000) * modelConfig.outputPrice;
    return { inputCost, outputCost, total: inputCost + outputCost };
  }
};

module.exports = ModelSelector;