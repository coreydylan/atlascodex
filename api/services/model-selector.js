// api/services/model-selector.js
const ModelSelector = {
  models: {
    'gpt-5': { 
      inputPrice: 1.25, 
      outputPrice: 10, 
      maxTokens: 128000,
      bestFor: 'complex reasoning, production workloads'
    },
    'gpt-5-mini': { 
      inputPrice: 0.25, 
      outputPrice: 2, 
      maxTokens: 64000,
      bestFor: 'balanced performance and cost'
    },
    'gpt-5-nano': { 
      inputPrice: 0.05, 
      outputPrice: 0.40, 
      maxTokens: 32000,
      bestFor: 'high-volume, simple tasks'
    }
  },

  select(requirements) {
    const { complexity, budget, latency, accuracy } = requirements;
    
    // High accuracy or complex reasoning required
    if (accuracy > 0.95 || complexity > 0.8) {
      return 'gpt-5';
    }
    
    // Budget conscious with moderate requirements
    if (budget < 0.001 && complexity < 0.3) {
      return 'gpt-5-nano';
    }
    
    // Default to balanced option
    return 'gpt-5-mini';
  },

  estimateCost(model, inputTokens, outputTokens) {
    const modelConfig = this.models[model];
    const inputCost = (inputTokens / 1_000_000) * modelConfig.inputPrice;
    const outputCost = (outputTokens / 1_000_000) * modelConfig.outputPrice;
    return { inputCost, outputCost, total: inputCost + outputCost };
  }
};

module.exports = ModelSelector;