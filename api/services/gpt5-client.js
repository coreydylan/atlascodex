// api/services/gpt5-client.js
const OpenAI = require('openai');
const ModelSelector = require('./model-selector');

class GPT5Client {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.fallbackEnabled = process.env.GPT5_FALLBACK_ENABLED === 'true';
  }

  async complete(params) {
    const { 
      messages, 
      complexity = 0.5, 
      budget = 0.01, 
      requiresReasoning = false,
      outputFormat = 'text',
      outputSchema = null  // NEW: JSON Schema for structured outputs
    } = params;

    // Select optimal model
    const model = ModelSelector.select({ 
      complexity, 
      budget, 
      accuracy: requiresReasoning ? 0.98 : 0.9 
    });

    try {
      // Use correct parameter based on model
      const isGPT5 = model.includes('gpt-5');
      const tokenParam = isGPT5 ? 'max_completion_tokens' : 'max_tokens';
      
      const requestParams = {
        model,
        messages,
        // GPT-5 only supports default temperature
        [tokenParam]: this.getMaxTokens(model),
        // Structured outputs with guaranteed schema compliance
        response_format: outputSchema 
          ? { 
              type: 'json_schema',
              json_schema: {
                name: 'extraction_response',
                strict: true,  // Guarantee 100% schema compliance
                schema: outputSchema
              }
            }
          : outputFormat === 'json' 
            ? { type: 'json_object' } 
            : undefined
      };
      
      // Add temperature for non-GPT-5 models only
      if (!isGPT5) {
        requestParams.temperature = 0.3;
      }
      
      // Note: reasoning_effort and verbosity may be added in future GPT-5 updates
      
      const response = await this.openai.chat.completions.create(requestParams);

      return {
        content: response.choices[0].message.content,
        model,
        usage: response.usage,
        cost: ModelSelector.estimateCost(
          model, 
          response.usage.prompt_tokens, 
          response.usage.completion_tokens
        )
      };
    } catch (error) {
      if (this.fallbackEnabled) {
        return this.fallback(params, error);
      }
      throw error;
    }
  }

  async fallback(params, originalError) {
    console.log('GPT-5 failed, falling back to GPT-4:', originalError.message);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: params.messages,
      temperature: 0.3,
      max_tokens: 4000
    });

    return {
      content: response.choices[0].message.content,
      model: 'gpt-4-turbo-preview',
      usage: response.usage,
      fallback: true
    };
  }

  getMaxTokens(model) {
    const limits = {
      'gpt-5': 128000,
      'gpt-5-mini': 64000,
      'gpt-5-nano': 32000
    };
    return limits[model] || 16000;
  }

  /**
   * Get verbosity setting based on task complexity
   * GPT-5 supports: low, medium (default), high
   */
  getVerbosity(complexity) {
    if (complexity < 0.3) return 'low';      // Simple tasks - concise answers
    if (complexity < 0.7) return 'medium';   // Standard tasks - balanced
    return 'high';                           // Complex tasks - comprehensive
  }
}

module.exports = GPT5Client;