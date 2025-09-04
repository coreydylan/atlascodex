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
      outputFormat = 'text'
    } = params;

    // Select optimal model
    const model = ModelSelector.select({ 
      complexity, 
      budget, 
      accuracy: requiresReasoning ? 0.98 : 0.9 
    });

    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages,
        temperature: 0.3,
        max_tokens: this.getMaxTokens(model),
        reasoning: requiresReasoning,
        response_format: outputFormat === 'json' 
          ? { type: 'json_object' } 
          : undefined,
        verbosity: process.env.NODE_ENV === 'development' ? 'verbose' : 'minimal'
      });

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
}

module.exports = GPT5Client;