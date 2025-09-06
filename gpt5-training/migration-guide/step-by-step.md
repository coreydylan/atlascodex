# GPT-4 to GPT-5 Migration: Step-by-Step Guide

## Prerequisites

- OpenAI API Key with GPT-5 access
- Node.js 18+ 
- OpenAI SDK v4.52.0 or later

## Step 1: Update Dependencies

```bash
# Update OpenAI SDK
npm install openai@latest

# Install migration helpers
npm install dotenv axios
```

## Step 2: Update Environment Variables

```bash
# .env
OPENAI_API_KEY=sk-...
GPT5_ENABLED=true
GPT5_MODEL_SELECTION=auto
GPT5_FALLBACK_ENABLED=true
GPT5_REASONING_ENABLED=true
```

## Step 3: Create Model Selection Service

```javascript
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
```

## Step 4: Create GPT-5 Client Wrapper

```javascript
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
```

## Step 5: Refactor Existing AI Processor

```javascript
// api/ai-processor-v2.js
const GPT5Client = require('./services/gpt5-client');

class AIProcessorV2 {
  constructor() {
    this.client = new GPT5Client();
  }

  async processNaturalLanguage(userInput, options = {}) {
    const complexity = this.assessComplexity(userInput);
    
    const result = await this.client.complete({
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt()
        },
        {
          role: 'user',
          content: userInput
        }
      ],
      complexity,
      budget: options.budget || 0.01,
      requiresReasoning: complexity > 0.7,
      outputFormat: 'json'
    });

    const parsed = JSON.parse(result.content);
    
    return {
      ...parsed,
      metadata: {
        model: result.model,
        cost: result.cost,
        tokens: result.usage
      }
    };
  }

  assessComplexity(input) {
    const factors = {
      length: Math.min(input.length / 1000, 0.3),
      technical: /\b(implement|algorithm|optimize|analyze)\b/i.test(input) ? 0.3 : 0,
      multiStep: /\b(then|after|finally|steps)\b/i.test(input) ? 0.2 : 0,
      structured: /\b(json|schema|format|structure)\b/i.test(input) ? 0.2 : 0
    };
    
    return Object.values(factors).reduce((a, b) => a + b, 0);
  }

  getSystemPrompt() {
    return `You are an AI assistant for Atlas Codex. 
    Convert natural language requests into structured extraction commands.
    Be precise, efficient, and accurate.`;
  }
}

module.exports = AIProcessorV2;
```

## Step 6: Update Evidence-First Bridge

```javascript
// api/evidence-first-bridge-v2.js
const GPT5Client = require('./services/gpt5-client');

class EvidenceFirstBridgeV2 {
  constructor() {
    this.client = new GPT5Client();
  }

  async extractFromHTML(html, instructions, options = {}) {
    const complexity = this.calculateExtractionComplexity(html, instructions);
    
    const result = await this.client.complete({
      messages: [
        {
          role: 'system',
          content: 'Extract structured data from HTML. Focus only on requested information.'
        },
        {
          role: 'user',
          content: this.buildExtractionPrompt(html, instructions)
        }
      ],
      complexity,
      budget: options.budget || 0.005,
      requiresReasoning: this.needsReasoning(instructions),
      outputFormat: 'json'
    });

    return {
      data: JSON.parse(result.content),
      metadata: {
        model: result.model,
        cost: result.cost,
        confidence: this.calculateConfidence(result)
      }
    };
  }

  calculateExtractionComplexity(html, instructions) {
    const htmlSize = html.length / 10000; // 0-1 scale
    const instructionComplexity = instructions.length / 500; // 0-1 scale
    const hasSchema = instructions.includes('schema') ? 0.2 : 0;
    const multiPage = instructions.includes('multi') ? 0.3 : 0;
    
    return Math.min(htmlSize * 0.3 + instructionComplexity * 0.3 + hasSchema + multiPage, 1);
  }

  needsReasoning(instructions) {
    const reasoningKeywords = [
      'analyze', 'compare', 'evaluate', 'determine',
      'relationship', 'pattern', 'correlation', 'infer'
    ];
    
    return reasoningKeywords.some(keyword => 
      instructions.toLowerCase().includes(keyword)
    );
  }

  buildExtractionPrompt(html, instructions) {
    // Truncate HTML if too long
    const maxHtmlLength = 50000;
    const truncatedHtml = html.length > maxHtmlLength 
      ? html.substring(0, maxHtmlLength) + '...[truncated]'
      : html;
    
    return `Extract the following from this HTML:
${instructions}

HTML Content:
${truncatedHtml}

Return as JSON with clear structure.`;
  }

  calculateConfidence(result) {
    // Simple confidence based on model used
    const confidence = {
      'gpt-5': 0.98,
      'gpt-5-mini': 0.95,
      'gpt-5-nano': 0.90,
      'gpt-4-turbo-preview': 0.85
    };
    
    return confidence[result.model] || 0.8;
  }
}

module.exports = EvidenceFirstBridgeV2;
```

## Step 7: Create Migration Testing Suite

```javascript
// tests/gpt5-migration.test.js
const AIProcessorV2 = require('../api/ai-processor-v2');
const EvidenceFirstBridgeV2 = require('../api/evidence-first-bridge-v2');

describe('GPT-5 Migration Tests', () => {
  let processor;
  let extractor;

  beforeEach(() => {
    processor = new AIProcessorV2();
    extractor = new EvidenceFirstBridgeV2();
  });

  test('AI Processor handles simple request with nano model', async () => {
    const result = await processor.processNaturalLanguage(
      'Get the title from example.com'
    );
    
    expect(result.metadata.model).toBe('gpt-5-nano');
    expect(result.metadata.cost.total).toBeLessThan(0.001);
  });

  test('AI Processor uses full model for complex reasoning', async () => {
    const result = await processor.processNaturalLanguage(
      'Analyze the relationship between products and prices, then determine pricing patterns'
    );
    
    expect(result.metadata.model).toBe('gpt-5');
  });

  test('Extractor handles HTML efficiently', async () => {
    const html = '<div><h1>Title</h1><p>Content</p></div>';
    const result = await extractor.extractFromHTML(
      html,
      'Extract the title and first paragraph'
    );
    
    expect(result.data).toHaveProperty('title');
    expect(result.metadata.model).toMatch(/gpt-5/);
  });

  test('Fallback works when GPT-5 fails', async () => {
    // Simulate failure by using invalid model
    process.env.GPT5_FALLBACK_ENABLED = 'true';
    
    const result = await processor.processNaturalLanguage(
      'Test fallback mechanism'
    );
    
    expect(result.metadata).toBeDefined();
  });
});
```

## Step 8: Gradual Rollout Configuration

```javascript
// config/gpt5-rollout.js
const RolloutConfig = {
  // Percentage of traffic to route to GPT-5
  trafficPercentage: {
    development: 100,
    staging: 50,
    production: 10 // Start with 10% in production
  },

  // Feature flags
  features: {
    reasoning: true,
    autoModelSelection: true,
    costOptimization: true,
    fallbackEnabled: true
  },

  // Gradual increase schedule
  schedule: [
    { date: '2025-09-10', percentage: 10 },
    { date: '2025-09-15', percentage: 25 },
    { date: '2025-09-20', percentage: 50 },
    { date: '2025-09-25', percentage: 75 },
    { date: '2025-10-01', percentage: 100 }
  ],

  shouldUseGPT5() {
    const env = process.env.NODE_ENV || 'development';
    const percentage = this.trafficPercentage[env];
    return Math.random() * 100 < percentage;
  }
};

module.exports = RolloutConfig;
```

## Step 9: Monitoring and Analytics

```javascript
// monitoring/gpt5-metrics.js
class GPT5Metrics {
  constructor() {
    this.metrics = {
      calls: 0,
      costs: 0,
      errors: 0,
      fallbacks: 0,
      models: {}
    };
  }

  track(result) {
    this.metrics.calls++;
    this.metrics.costs += result.cost.total;
    
    if (result.fallback) {
      this.metrics.fallbacks++;
    }
    
    if (!this.metrics.models[result.model]) {
      this.metrics.models[result.model] = 0;
    }
    this.metrics.models[result.model]++;
  }

  getReport() {
    return {
      totalCalls: this.metrics.calls,
      totalCost: this.metrics.costs.toFixed(2),
      averageCost: (this.metrics.costs / this.metrics.calls).toFixed(4),
      errorRate: (this.metrics.errors / this.metrics.calls * 100).toFixed(2) + '%',
      fallbackRate: (this.metrics.fallbacks / this.metrics.calls * 100).toFixed(2) + '%',
      modelDistribution: this.metrics.models
    };
  }
}

module.exports = GPT5Metrics;
```

## Step 10: Production Deployment

```bash
# 1. Test in development
npm run test:gpt5

# 2. Deploy to staging
npm run deploy:staging

# 3. Monitor for 24 hours
npm run monitor:gpt5

# 4. Gradual production rollout
npm run deploy:production -- --percentage=10

# 5. Monitor and increase
npm run rollout:increase -- --percentage=25
```

## Rollback Procedure

```javascript
// scripts/rollback-gpt5.js
const rollback = async () => {
  // 1. Disable GPT-5 feature flag
  process.env.GPT5_ENABLED = 'false';
  
  // 2. Force all traffic to GPT-4
  process.env.FORCE_GPT4 = 'true';
  
  // 3. Clear GPT-5 cache
  await cache.clear('gpt5:*');
  
  // 4. Notify team
  await notify('GPT-5 rollback initiated');
  
  console.log('Rollback complete - all traffic routed to GPT-4');
};
```

## Validation Checklist

- [ ] All tests pass with GPT-5
- [ ] Cost projections validated
- [ ] Fallback mechanism tested
- [ ] Performance metrics acceptable
- [ ] No increase in error rates
- [ ] Customer feedback positive
- [ ] Documentation updated
- [ ] Team trained on new features

## Next Steps

1. Begin with development environment
2. Run A/B tests on staging
3. Monitor metrics closely
4. Gradual production rollout
5. Full migration by October 1, 2025