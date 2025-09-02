# Atlas Codex Complete Tutorial

## Introduction

Atlas Codex is a revolutionary web data extraction system that learns and adapts with each use. This tutorial will walk you through everything from basic extraction to advanced enterprise deployment.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding DIPs](#understanding-dips)
3. [Extraction Strategies](#extraction-strategies)
4. [API Usage](#api-usage)
5. [Frontend Guide](#frontend-guide)
6. [Advanced Features](#advanced-features)
7. [Production Deployment](#production-deployment)
8. [Best Practices](#best-practices)

## Getting Started

### Step 1: Environment Setup

First, set up your development environment:

```bash
# 1. Install prerequisites
brew install node redis docker kubectl terraform

# 2. Clone the repository
git clone https://github.com/yourusername/atlascodex.git
cd atlascodex

# 3. Install dependencies
npm install
npm run bootstrap

# 4. Configure environment
cat > .env << EOF
OPENAI_API_KEY=your-openai-key
API_KEY=atlas-dev-key-123
REDIS_URL=redis://localhost:6379
AWS_REGION=us-west-2
NODE_ENV=development
EOF
```

### Step 2: Start Local Services

```bash
# Start Redis
docker-compose up -d redis

# Start API server
npm run dev:api

# In another terminal, start workers
npm run dev:worker

# In another terminal, start frontend
npm run dev:frontend
```

### Step 3: Your First Extraction

```bash
# Using curl
curl -X POST http://localhost:3000/extract \
  -H "Content-Type: application/json" \
  -H "x-api-key: atlas-dev-key-123" \
  -d '{"url": "https://example.com"}'
```

## Understanding DIPs

### What are Domain Intelligence Profiles?

DIPs are Atlas Codex's learning mechanism. When you first extract from a domain, the system:

1. **Analyzes the site** - Framework detection, rendering type
2. **Tests strategies** - Runs multiple extraction methods
3. **Learns patterns** - Identifies optimal approaches
4. **Stores intelligence** - Saves for future use

### DIP Creation Process

```javascript
// When Atlas encounters a new domain
async function createDIP(domain) {
  // 1. Check robots.txt
  const robotsRules = await checkRobotsTxt(domain);
  
  // 2. Detect technology stack
  const tech = await detectTechnology(domain);
  // Returns: { framework: 'React', rendering: 'SPA', ... }
  
  // 3. Test extraction strategies
  const strategies = await testStrategies(domain);
  // Tests all 6 strategies, measures performance
  
  // 4. Analyze rate limits
  const rateLimit = await detectRateLimit(domain);
  
  // 5. Create comprehensive profile
  return {
    domain,
    technology: tech,
    optimalStrategy: strategies.best,
    rateLimit,
    robotsRules,
    createdAt: new Date()
  };
}
```

### Viewing DIPs

Access DIPs through the API:

```bash
# Get DIP for a domain
curl http://localhost:3000/dips/example.com \
  -H "x-api-key: atlas-dev-key-123"

# List all DIPs
curl http://localhost:3000/dips \
  -H "x-api-key: atlas-dev-key-123"
```

## Extraction Strategies

### Strategy Comparison

| Strategy | Speed | Cost | Use Case |
|----------|-------|------|----------|
| static_fetch | ⚡⚡⚡ | $0.01 | Simple HTML sites |
| browser_render | ⚡⚡ | $0.05 | JavaScript sites |
| browser_js | ⚡ | $0.08 | Complex interactions |
| hybrid_smart | ⚡⚡ | $0.06 | Adaptive approach |
| gpt5_direct | ⚡ | $0.15 | AI extraction |
| gpt5_reasoning | ⚡ | $0.25 | Complex analysis |

### Strategy Examples

#### Static Fetch
Best for server-rendered content:

```javascript
// Extract from a blog
const result = await extract({
  url: 'https://blog.example.com/article',
  strategy: 'static_fetch'
});
```

#### Browser Render
For JavaScript-heavy sites:

```javascript
// Extract from SPA
const result = await extract({
  url: 'https://app.example.com/dashboard',
  strategy: 'browser_render',
  options: {
    waitForSelector: '.data-loaded'
  }
});
```

#### GPT-5 Reasoning
For complex analysis:

```javascript
// Extract and analyze
const result = await extract({
  url: 'https://report.example.com',
  strategy: 'gpt5_reasoning',
  options: {
    prompt: 'Extract key financial metrics and trends'
  }
});
```

## API Usage

### Basic API Client

```javascript
class AtlasClient {
  constructor(apiKey, baseUrl = 'http://localhost:3000') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async extract(url, options = {}) {
    const response = await fetch(`${this.baseUrl}/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({ url, ...options })
    });
    return response.json();
  }

  async createJob(url, options = {}) {
    const response = await fetch(`${this.baseUrl}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({ url, options })
    });
    return response.json();
  }

  async getJobStatus(jobId) {
    const response = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
      headers: { 'x-api-key': this.apiKey }
    });
    return response.json();
  }

  async waitForJob(jobId, pollInterval = 2000) {
    while (true) {
      const status = await this.getJobStatus(jobId);
      if (status.status === 'completed') {
        return await this.getJobResult(jobId);
      }
      if (status.status === 'failed') {
        throw new Error(status.error);
      }
      await new Promise(r => setTimeout(r, pollInterval));
    }
  }
}

// Usage
const client = new AtlasClient('your-api-key');
const result = await client.extract('https://example.com');
```

### Batch Processing

```javascript
async function batchExtract(urls) {
  const client = new AtlasClient('your-api-key');
  
  // Create batch job
  const response = await fetch(`${client.baseUrl}/jobs/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': client.apiKey
    },
    body: JSON.stringify({
      urls,
      options: { strategy: 'auto' }
    })
  });
  
  const { jobs } = await response.json();
  
  // Wait for all jobs
  const results = await Promise.all(
    jobs.map(job => client.waitForJob(job.id))
  );
  
  return results;
}

// Extract from 100 URLs
const urls = Array.from({ length: 100 }, (_, i) => 
  `https://example.com/page-${i}`
);
const results = await batchExtract(urls);
```

## Frontend Guide

### Dashboard Overview

The Atlas Codex frontend provides:

1. **Real-time monitoring** - System health, active jobs
2. **Extraction interface** - Single and batch modes
3. **DIP management** - View and edit profiles
4. **Analytics** - Cost tracking, performance metrics

### Using the Extraction Panel

1. Navigate to the Extract tab
2. Enter URL(s) to extract
3. Select strategy (or use auto)
4. Configure options if needed
5. Click "Start Extraction"
6. Monitor progress in real-time

### Managing DIPs

1. Go to DIPs tab
2. Search for domain
3. View current profile
4. Edit strategy if needed
5. Force refresh to re-learn

### Analyzing Performance

The Analytics tab shows:

- Extraction success rates
- Strategy effectiveness
- Cost breakdown
- Performance trends

## Advanced Features

### Custom Selectors

Extract specific elements:

```javascript
const result = await client.extract('https://shop.example.com', {
  strategy: 'browser_render',
  selectors: {
    productName: 'h1.product-title',
    price: 'span.price',
    availability: '.stock-status',
    images: 'img.product-image@src',  // @src gets attribute
    reviews: '.review-item*'           // * gets all matches
  }
});
```

### JavaScript Execution

Run custom JavaScript:

```javascript
const result = await client.extract('https://app.example.com', {
  strategy: 'browser_js',
  javascript: `
    // Wait for data to load
    await page.waitForSelector('.data-table');
    
    // Extract custom data
    const data = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.row')).map(row => ({
        id: row.dataset.id,
        value: row.querySelector('.value').textContent
      }));
    });
    
    return data;
  `
});
```

### Evidence Verification

Verify extraction integrity:

```javascript
const crypto = require('crypto');

function verifyEvidence(result) {
  // Verify content hash
  const hash = crypto.createHash('sha256')
    .update(result.content)
    .digest('hex');
  
  if (hash !== result.evidence.contentHash) {
    throw new Error('Content hash mismatch');
  }
  
  // Verify evidence chain
  let previousHash = null;
  for (const block of result.evidence.chain) {
    if (previousHash && block.previousHash !== previousHash) {
      throw new Error('Evidence chain broken');
    }
    previousHash = block.hash;
  }
  
  return true;
}
```

### Webhook Integration

Set up webhooks for job completion:

```javascript
const result = await client.createJob('https://example.com', {
  options: {
    webhook: {
      url: 'https://your-server.com/webhook',
      headers: {
        'Authorization': 'Bearer your-token'
      }
    }
  }
});
```

## Production Deployment

### Docker Deployment

```bash
# Build images
docker build -t atlas-api ./packages/api
docker build -t atlas-worker ./packages/worker
docker build -t atlas-frontend ./packages/frontend

# Run with Docker Compose
docker-compose up -d
```

### Kubernetes Deployment

```bash
# Apply configurations
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/secrets.yaml
kubectl apply -f kubernetes/deployment.yaml

# Check status
kubectl get pods -n atlas-codex
kubectl get services -n atlas-codex

# Scale workers
kubectl scale deployment atlas-worker --replicas=10 -n atlas-codex
```

### AWS Deployment

```bash
# Deploy infrastructure
cd terraform
terraform init
terraform plan
terraform apply

# Get outputs
terraform output -json > ../deployment-info.json

# Deploy application
aws ecs update-service --cluster atlas-cluster \
  --service atlas-api --force-new-deployment
```

### Environment Variables

Production environment variables:

```bash
# API Server
NODE_ENV=production
API_PORT=3000
REDIS_URL=redis://redis-cluster:6379
OPENAI_API_KEY=sk-prod-xxx
API_KEY=generate-secure-key
CORS_ORIGINS=https://app.atlascodex.com

# Workers
WORKER_CONCURRENCY=10
MAX_RETRIES=3
JOB_TIMEOUT=300000
BROWSER_POOL_SIZE=5

# Frontend
REACT_APP_API_URL=https://api.atlascodex.com
REACT_APP_ENVIRONMENT=production
```

## Best Practices

### 1. DIP Management

- Let DIPs age for 24h before manual edits
- Review failed extractions weekly
- Export DIPs for backup

### 2. Cost Optimization

- Use batch processing for multiple URLs
- Enable caching for repeated extractions
- Monitor GPT-5 usage (<15% target)

### 3. Rate Limiting

- Respect robots.txt always
- Implement exponential backoff
- Use domain-specific delays

### 4. Error Handling

```javascript
async function robustExtract(url, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.extract(url);
    } catch (error) {
      lastError = error;
      
      // Exponential backoff
      const delay = Math.pow(2, i) * 1000;
      await new Promise(r => setTimeout(r, delay));
      
      // Try different strategy
      if (i === 1) {
        url = { url, strategy: 'browser_render' };
      }
    }
  }
  
  throw lastError;
}
```

### 5. Monitoring

Set up alerts for:

- Extraction failures > 5%
- Queue depth > 1000
- Worker utilization > 80%
- Cost per extraction > $0.10

### 6. Security

- Rotate API keys monthly
- Use environment-specific keys
- Enable audit logging
- Implement IP whitelisting

## Troubleshooting Guide

### Common Issues

**Q: Extraction returns empty content**
```bash
# Check DIP strategy
curl http://localhost:3000/dips/example.com

# Force strategy update
curl -X POST http://localhost:3000/dips/example.com/refresh
```

**Q: Jobs stuck in queue**
```bash
# Check worker status
docker logs atlas-worker

# Check Redis queue
redis-cli LLEN atlas:queue:pending
```

**Q: High extraction costs**
```bash
# Analyze strategy usage
curl http://localhost:3000/metrics/strategies

# Review cost breakdown
curl http://localhost:3000/costs?period=7d
```

**Q: GPT-5 timeouts**
```javascript
// Adjust timeout and parameters
const result = await client.extract(url, {
  strategy: 'gpt5_reasoning',
  options: {
    timeout: 60000,
    gpt5: {
      verbosity: 'low',
      reasoning_effort: 'medium'
    }
  }
});
```

## Example Projects

### 1. E-commerce Price Monitor

```javascript
async function monitorPrices(products) {
  const client = new AtlasClient(API_KEY);
  
  const results = await Promise.all(
    products.map(async product => {
      const data = await client.extract(product.url, {
        selectors: {
          price: product.priceSelector,
          availability: product.stockSelector
        }
      });
      
      return {
        ...product,
        currentPrice: parseFloat(data.price),
        inStock: data.availability.includes('In Stock'),
        timestamp: new Date()
      };
    })
  );
  
  // Save to database
  await saveResults(results);
  
  // Check for price drops
  const drops = results.filter(r => 
    r.currentPrice < r.targetPrice
  );
  
  if (drops.length > 0) {
    await sendAlerts(drops);
  }
}
```

### 2. News Aggregator

```javascript
async function aggregateNews(sources) {
  const client = new AtlasClient(API_KEY);
  
  const articles = [];
  
  for (const source of sources) {
    const result = await client.extract(source.url, {
      strategy: 'gpt5_reasoning',
      options: {
        prompt: 'Extract headlines, summaries, and publication dates'
      }
    });
    
    articles.push(...result.articles.map(a => ({
      ...a,
      source: source.name
    })));
  }
  
  // Sort by date
  articles.sort((a, b) => b.date - a.date);
  
  return articles;
}
```

### 3. Competitor Analysis

```javascript
async function analyzeCompetitors(competitors) {
  const client = new AtlasClient(API_KEY);
  
  const analyses = await Promise.all(
    competitors.map(async comp => {
      // Extract homepage
      const homepage = await client.extract(comp.url, {
        strategy: 'gpt5_reasoning',
        options: {
          prompt: 'Analyze value propositions, features, and pricing'
        }
      });
      
      // Extract specific pages
      const pricing = await client.extract(`${comp.url}/pricing`);
      const features = await client.extract(`${comp.url}/features`);
      
      return {
        company: comp.name,
        analysis: homepage,
        pricing: pricing,
        features: features,
        extractedAt: new Date()
      };
    })
  );
  
  // Generate report
  return generateCompetitiveReport(analyses);
}
```

## Conclusion

Atlas Codex represents the future of web data extraction - intelligent, adaptive, and powerful. With DIPs learning from every interaction, multi-strategy extraction, and comprehensive evidence tracking, you have everything needed for enterprise-grade data extraction.

For questions and support:
- GitHub Issues: https://github.com/atlascodex/issues
- Discord: https://discord.gg/atlascodex
- Email: support@atlascodex.com

Happy extracting!