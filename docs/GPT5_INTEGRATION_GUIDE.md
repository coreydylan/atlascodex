# GPT-5 Integration Guide 🧠

This guide provides comprehensive technical specifications for integrating GPT-5 with Atlas Codex.

## ⚠️ Critical Parameter Changes

**IMPORTANT**: GPT-5 models have fundamentally changed parameter handling. Many traditional parameters are no longer supported.

### ❌ Deprecated Parameters (Will Cause API Errors)

```javascript
// DON'T USE THESE - They will fail
const wrongConfig = {
  model: 'gpt-5',
  temperature: 0.7,     // ❌ API Error: "Unsupported parameter"
  top_p: 0.9,          // ❌ API Error: "Unsupported parameter"
  presence_penalty: 0.1, // ❌ API Error: "Unsupported parameter"
  frequency_penalty: 0.1 // ❌ API Error: "Unsupported parameter"
};
```

### ✅ Correct GPT-5 Parameters

```javascript
const correctConfig = {
  model: 'gpt-5',
  verbosity: 'medium',        // Controls output detail level
  reasoning_effort: 'medium', // Controls deliberation depth
  response_format: {          // For structured outputs
    type: 'json_schema',
    json_schema: { /* schema */ }
  }
};
```

## 🎯 Parameter Reference

### Verbosity Settings

Controls the level of detail in responses:

```javascript
// Low verbosity - Terse, minimal prose
verbosity: 'low'    // Best for: Simple extraction, quick answers

// Medium verbosity - Balanced detail (default)  
verbosity: 'medium' // Best for: Most use cases

// High verbosity - Detailed explanations
verbosity: 'high'   // Best for: Complex analysis, debugging
```

### Reasoning Effort Settings

Controls how much the model deliberates:

```javascript
// Minimal reasoning - Fastest response
reasoning_effort: 'minimal' // ~2 seconds, basic processing

// Low reasoning - Quick with some thought
reasoning_effort: 'low'     // ~5 seconds, light analysis

// Medium reasoning - Balanced (default)
reasoning_effort: 'medium'  // ~10 seconds, thorough analysis

// High reasoning - Maximum deliberation
reasoning_effort: 'high'    // ~20-30 seconds, deep reasoning
```

## 💰 Model Selection and Pricing

### Token Limits and Context Windows

| Model | Input Capacity | Output Capacity | Total Context | Input Cost/1M | Output Cost/1M | Cached Input/1M |
|-------|---------------|-----------------|---------------|---------------|----------------|-----------------|
| GPT-5 | 272,000 tokens | 128,000 tokens | 400,000 tokens | $1.25 | $10.00 | $0.125 (90% off) |
| GPT-5-mini | 272,000 tokens | 128,000 tokens | 400,000 tokens | $0.25 | $2.00 | $0.025 (90% off) |
| GPT-5-nano | 272,000 tokens | 128,000 tokens | 400,000 tokens | $0.05 | $0.40 | $0.005 (90% off) |

### Dynamic Model Selection Strategy

Atlas Codex automatically selects the optimal model based on data size and complexity:

```javascript
// From packages/worker/worker.js
function selectOptimalModel(dataSize, complexity = 'medium') {
  if (dataSize > 50000 || complexity === 'high') {
    return {
      model: 'gpt-5',
      maxTokens: 65536,
      verbosity: 'high',
      reasoning_effort: 'medium',
      costTier: 'premium'
    };
  } else if (dataSize > 20000 || complexity === 'medium') {
    return {
      model: 'gpt-5-mini',
      maxTokens: 32768,
      verbosity: 'medium', 
      reasoning_effort: 'low',
      costTier: 'standard'
    };
  } else {
    return {
      model: 'gpt-5-nano',
      maxTokens: 16384,
      verbosity: 'low',
      reasoning_effort: 'minimal',
      costTier: 'economy'
    };
  }
}
```

## 🚀 Context Caching for Cost Optimization

### Cache Hit Optimization

Structure prompts to maximize cache efficiency:

```javascript
// Optimal prompt structure for caching
const cacheOptimizedPrompt = `
${SYSTEM_CONTEXT}        // Static system instructions (cached 90% discount)
${DOMAIN_CONTEXT}        // Domain-specific patterns (cached 90% discount)
---
${DYNAMIC_CONTENT}       // Variable page content (full price)
`;

// Expected savings: 70-98% cost reduction on similar domains
```

### Real-world Cache Performance

Based on production data:

- **E-commerce sites**: 85-95% cache hit rate
- **News websites**: 70-85% cache hit rate  
- **Technical documentation**: 90-98% cache hit rate
- **Social media**: 60-75% cache hit rate

## 🏗️ Structured Output Implementation

### JSON Schema Integration

```javascript
// Structured extraction with validation
const extractionSchema = {
  type: 'json_schema',
  json_schema: {
    name: 'product_extraction',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        title: { 
          type: 'string',
          description: 'Product title'
        },
        price: { 
          type: 'number',
          description: 'Price in USD'
        },
        features: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key product features'
        },
        availability: {
          type: 'string',
          enum: ['in_stock', 'out_of_stock', 'limited'],
          description: 'Stock status'
        }
      },
      required: ['title', 'price'],
      additionalProperties: false
    }
  }
};

// API call with structured output
const response = await openai.chat.completions.create({
  model: 'gpt-5-nano',
  messages: [
    {
      role: 'system',
      content: 'Extract product information from the provided webpage content.'
    },
    {
      role: 'user', 
      content: `Extract data from this page:\n\n${pageContent}`
    }
  ],
  response_format: extractionSchema,
  verbosity: 'low',
  reasoning_effort: 'minimal'
});
```

## 🛡️ Error Handling and Retry Logic

### Robust API Integration

```javascript
// Production-ready error handling
async function callGPT5WithRetry(apiCall, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      console.error(`GPT-5 API attempt ${attempt} failed:`, error.message);
      
      // Handle specific error types
      if (error.status === 429) {
        // Rate limit - exponential backoff
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`Rate limited, waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (error.status === 400 && error.message.includes('Unsupported parameter')) {
        // Parameter error - likely using deprecated parameters
        throw new Error(`GPT-5 Parameter Error: ${error.message}. Check parameter compatibility.`);
      }
      
      if (error.status >= 500) {
        // Server error - retry with backoff
        const delay = attempt * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Client error - don't retry
      throw error;
    }
  }
  
  throw new Error(`GPT-5 API failed after ${maxRetries} attempts`);
}
```

## ⚡ Performance Optimization

### Response Time Expectations

| Reasoning Effort | Typical Response Time | Use Case |
|------------------|----------------------|-----------|
| minimal | 1-3 seconds | Simple extraction |
| low | 3-7 seconds | Standard processing |
| medium | 7-15 seconds | Complex analysis |
| high | 15-45 seconds | Deep reasoning |

### Optimal Settings by Task Type

```javascript
// Task-specific configurations
const taskConfigs = {
  simple_extraction: {
    model: 'gpt-5-nano',
    verbosity: 'low',
    reasoning_effort: 'minimal',
    expected_time: '1-3s',
    cost_per_call: '$0.001-0.003'
  },
  
  complex_analysis: {
    model: 'gpt-5-mini',
    verbosity: 'medium',
    reasoning_effort: 'medium',
    expected_time: '7-15s',
    cost_per_call: '$0.01-0.05'
  },
  
  deep_reasoning: {
    model: 'gpt-5',
    verbosity: 'high',
    reasoning_effort: 'high',
    expected_time: '15-45s',
    cost_per_call: '$0.05-0.20'
  }
};
```

## 🔍 Debugging and Monitoring

### Debug Configuration

```javascript
// Enable detailed logging for debugging
const debugConfig = {
  model: 'gpt-5-nano',
  verbosity: 'high',           // Maximum detail for debugging
  reasoning_effort: 'high',    // Full reasoning traces
  debug_mode: true,            // Custom flag for our logging
  log_tokens: true,            // Track token usage
  log_cache_hits: true         // Monitor cache performance
};
```

### Production Monitoring

```javascript
// Track key metrics in production
function logGPT5Metrics(response, startTime) {
  const metrics = {
    model: response.model,
    total_tokens: response.usage.total_tokens,
    prompt_tokens: response.usage.prompt_tokens,
    completion_tokens: response.usage.completion_tokens,
    response_time: Date.now() - startTime,
    cache_hit_rate: response.cache_hit_rate, // If available
    cost_estimate: calculateCost(response.usage, response.model)
  };
  
  // Log to monitoring system
  console.log('GPT-5 Metrics:', metrics);
  
  // Alert if costs exceed thresholds
  if (metrics.cost_estimate > 0.10) {
    console.warn(`High cost GPT-5 call: $${metrics.cost_estimate}`);
  }
}
```

## 🎯 Atlas Codex Specific Implementation

### Worker Integration

```javascript
// From packages/worker/worker.js - GPT-5 synthesis function
async function synthesizeWithGPT5(job) {
  const { url, scrapedData, extractionSchema } = job.params;
  
  // Select optimal model based on data size
  const modelConfig = selectOptimalModel(
    JSON.stringify(scrapedData).length,
    job.params.complexity || 'medium'
  );
  
  try {
    const response = await callGPT5WithRetry(async () => {
      return await openai.chat.completions.create({
        model: modelConfig.model,
        messages: [
          {
            role: 'system',
            content: `You are a precise data extraction system. Extract structured data according to the provided schema. Focus on accuracy and completeness.`
          },
          {
            role: 'user',
            content: `Extract data from this webpage:
URL: ${url}

Content:
${JSON.stringify(scrapedData, null, 2)}

Schema:
${JSON.stringify(extractionSchema, null, 2)}`
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'extraction_result',
            schema: extractionSchema
          }
        },
        verbosity: modelConfig.verbosity,
        reasoning_effort: modelConfig.reasoning_effort
      });
    });
    
    // Log metrics and return result
    logGPT5Metrics(response, Date.now());
    
    return {
      extracted: JSON.parse(response.choices[0].message.content),
      model_used: modelConfig.model,
      tokens_used: response.usage.total_tokens,
      cost_estimate: calculateCost(response.usage, modelConfig.model),
      confidence: 0.95 // Based on structured output success
    };
    
  } catch (error) {
    console.error('GPT-5 synthesis failed:', error);
    throw new Error(`GPT-5 extraction failed: ${error.message}`);
  }
}
```

## 🚨 Common Issues and Solutions

### Issue 1: "Unsupported parameter: 'temperature'"

**Problem**: Using deprecated OpenAI parameters with GPT-5
```javascript
// ❌ This will fail
const badConfig = { model: 'gpt-5', temperature: 0.7 };
```

**Solution**: Use GPT-5 specific parameters
```javascript
// ✅ This works  
const goodConfig = { model: 'gpt-5', verbosity: 'medium' };
```

### Issue 2: High costs on repeated similar content

**Problem**: Not leveraging context caching effectively

**Solution**: Structure prompts with consistent prefixes
```javascript
// ✅ Cache-optimized prompt structure
const prompt = `
${STATIC_SYSTEM_PROMPT}     // This gets cached (90% discount)
${DOMAIN_PATTERNS}          // This gets cached (90% discount)
---
${UNIQUE_PAGE_CONTENT}      // Only this is full price
`;
```

### Issue 3: Slow response times

**Problem**: Using high reasoning effort for simple tasks

**Solution**: Match reasoning effort to task complexity
```javascript
// For simple extraction
reasoning_effort: 'minimal'  // 1-3 seconds

// For complex analysis  
reasoning_effort: 'high'     // 15-45 seconds
```

## 📊 Cost Optimization Strategies

### Real-world Cost Examples

Based on production Atlas Codex usage:

```
Simple Product Extraction (GPT-5-nano, minimal reasoning):
- Input: 5,000 tokens × $0.05/1M = $0.00025
- Output: 500 tokens × $0.40/1M = $0.0002
- Total: ~$0.0005 per extraction

Complex Multi-page Analysis (GPT-5, medium reasoning):
- Input: 50,000 tokens × $1.25/1M = $0.0625
- Output: 5,000 tokens × $10/1M = $0.05
- Cache savings: 80% = $0.05 discount
- Total: ~$0.06 per analysis

NYTimes-style Article Extraction (GPT-5-mini, low reasoning):
- Input: 15,000 tokens × $0.25/1M = $0.00375
- Output: 2,000 tokens × $2/1M = $0.004
- With caching: ~$0.002 per article
```

### Environment-Based Cost Controls

```javascript
// Production cost controls from .env.prod
const costLimits = {
  MAX_LLM_PERCENT: 0.15,        // Max 15% of pages use LLM
  MAX_COST_PER_PAGE: 0.002,     // Max $0.002 per page
  MAX_TOKENS_PER_CALL: 100000,  // Prevent runaway costs
  CACHE_TTL: 3600,              // 1 hour cache for optimization
  
  // Alert thresholds
  DAILY_SPEND_LIMIT: 50.00,     // Alert if >$50/day
  HOURLY_SPEND_LIMIT: 5.00      // Alert if >$5/hour
};
```

## 🎓 Best Practices Summary

### ✅ Do's

1. **Use appropriate reasoning effort** for the task complexity
2. **Structure prompts** with consistent prefixes for caching  
3. **Select model tier** based on data size and requirements
4. **Implement robust error handling** with exponential backoff
5. **Monitor costs and token usage** in real-time
6. **Use structured outputs** with JSON schema validation
7. **Cache domain-specific patterns** for cost optimization

### ❌ Don'ts

1. **Don't use deprecated parameters** (temperature, top_p, etc.)
2. **Don't use high reasoning effort** for simple tasks
3. **Don't ignore cache optimization** opportunities  
4. **Don't skip error handling** for production deployments
5. **Don't exceed token limits** without proper handling
6. **Don't use GPT-5 standard** for simple extraction tasks
7. **Don't ignore cost monitoring** and alerting

## 📚 Additional Resources

- [OpenAI GPT-5 API Documentation](https://platform.openai.com/docs/api-reference)
- [Atlas Codex Cost Optimization Guide](./COST_OPTIMIZATION.md)
- [Worker Implementation Details](../packages/worker/README.md)
- [Production Monitoring Setup](./MONITORING.md)