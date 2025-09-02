# Atlas Codex - Intelligent Web Data Extraction System

Atlas Codex is an advanced, AI-powered web data extraction system that learns from each interaction to continuously improve extraction strategies. It features Domain Intelligence Profiles (DIPs), multi-strategy extraction, and comprehensive evidence tracking.

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose
- Redis (or use Docker)
- AWS account (for production deployment)
- OpenAI API key

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/atlascodex.git
cd atlascodex

# Install dependencies
npm install
npm run bootstrap

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start Redis
docker-compose up -d redis

# Start the system
npm run dev
```

### Production Deployment

```bash
# Build Docker images
npm run docker:build

# Deploy to Kubernetes
kubectl apply -f kubernetes/

# Or deploy to AWS
cd terraform
terraform init
terraform apply
```

## Key Features

### Domain Intelligence Profiles (DIPs)
- Automatic site learning and mapping
- Framework and technology detection
- Rate limit and robot.txt compliance
- Optimal strategy selection

### Multi-Strategy Extraction
1. **Static Fetch** - Fast HTML retrieval
2. **Browser Render** - JavaScript execution
3. **Browser JS** - Complex interactions
4. **Hybrid Smart** - Adaptive approach
5. **GPT-5 Direct** - AI-powered extraction
6. **GPT-5 Reasoning** - Advanced analysis

### Evidence & Verification
- Cryptographic content hashing
- Blockchain-style evidence chain
- Complete audit trail
- Integrity verification

### Cost Optimization
- Target: <15% LLM usage
- Smart caching system
- Strategy cost tracking
- Resource monitoring

## API Documentation

### Authentication
All API requests require an API key:
```
x-api-key: your-api-key
```

### Core Endpoints

#### Create Extraction Job
```bash
POST /jobs
{
  "url": "https://example.com",
  "options": {
    "strategy": "auto",
    "force": false
  }
}
```

#### Batch Extraction
```bash
POST /jobs/batch
{
  "urls": ["url1", "url2", "url3"],
  "options": {
    "strategy": "static_fetch"
  }
}
```

#### Get Job Status
```bash
GET /jobs/{jobId}
```

#### Get Job Result
```bash
GET /jobs/{jobId}/result
```

#### Direct Extraction
```bash
POST /extract
{
  "url": "https://example.com",
  "strategy": "browser_render"
}
```

#### Get Metrics
```bash
GET /metrics
```

#### Get Cost Analysis
```bash
GET /costs?domain=example.com&period=24h
```

## User Guide

### 1. Basic Extraction

The simplest way to extract data:

```javascript
// Using the API
const response = await fetch('http://api.atlascodex.com/extract', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key'
  },
  body: JSON.stringify({
    url: 'https://example.com/product'
  })
});

const data = await response.json();
```

### 2. Strategy Selection

Choose the right strategy for your needs:

- **auto** - Let Atlas Codex decide (recommended)
- **static_fetch** - For simple HTML pages ($0.01)
- **browser_render** - For JS-heavy sites ($0.05)
- **browser_js** - For complex interactions ($0.08)
- **hybrid_smart** - Best of both worlds ($0.06)
- **gpt5_direct** - AI extraction ($0.15)
- **gpt5_reasoning** - Advanced analysis ($0.25)

### 3. Batch Processing

Process multiple URLs efficiently:

```javascript
const response = await fetch('http://api.atlascodex.com/jobs/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key'
  },
  body: JSON.stringify({
    urls: [
      'https://site1.com/page1',
      'https://site2.com/page2',
      'https://site3.com/page3'
    ],
    options: {
      strategy: 'auto'
    }
  })
});
```

### 4. Monitoring Jobs

Track extraction progress:

```javascript
// Create job
const jobResponse = await createJob(url);
const { job } = await jobResponse.json();

// Poll for status
const checkStatus = async () => {
  const response = await fetch(`/jobs/${job.id}`, {
    headers: { 'x-api-key': apiKey }
  });
  const status = await response.json();
  
  if (status.status === 'completed') {
    // Get result
    const result = await fetch(`/jobs/${job.id}/result`, {
      headers: { 'x-api-key': apiKey }
    });
    return result.json();
  }
  
  // Continue polling
  setTimeout(checkStatus, 2000);
};
```

### 5. Using the Frontend

Access the web interface at `http://app.atlascodex.com`

**Dashboard Tab**
- System health monitoring
- Active job tracking
- Performance metrics
- Cost analysis

**Extract Tab**
- Single URL extraction
- Batch mode for multiple URLs
- Strategy selection
- Real-time progress

**DIPs Tab**
- View learned domain profiles
- Manually update strategies
- Export/import profiles

**Jobs Tab**
- Job history
- Result viewing
- Re-run failed jobs
- Export results

**Analytics Tab**
- Usage statistics
- Cost breakdown
- Performance trends
- Strategy effectiveness

## Advanced Usage

### Custom Headers

Add custom headers for authentication:

```javascript
{
  "url": "https://api.example.com/data",
  "options": {
    "headers": {
      "Authorization": "Bearer token",
      "X-Custom-Header": "value"
    }
  }
}
```

### Proxy Configuration

Route through proxies:

```javascript
{
  "url": "https://example.com",
  "options": {
    "proxy": "http://proxy.server:8080"
  }
}
```

### Content Selectors

Extract specific elements:

```javascript
{
  "url": "https://example.com",
  "options": {
    "selectors": {
      "title": "h1.product-title",
      "price": ".price-tag",
      "description": "#product-description"
    }
  }
}
```

### Evidence Verification

Verify extraction integrity:

```javascript
const result = await getJobResult(jobId);

// Verify evidence chain
const isValid = await verifyEvidence(result.evidence);

// Check content hash
const hash = createHash('sha256')
  .update(result.content)
  .digest('hex');
  
assert(hash === result.evidence.contentHash);
```

## Troubleshooting

### Common Issues

**Job Stuck in Processing**
- Check worker logs: `docker logs atlas-worker`
- Verify Redis connection
- Check resource limits

**High Costs**
- Review strategy usage in Analytics
- Enable DIP caching
- Use batch processing

**Extraction Failures**
- Check robots.txt compliance
- Verify rate limits
- Review error logs

**GPT-5 Hanging at 15%**
- Ensure correct parameters (verbosity, reasoning_effort)
- Check API key validity
- Monitor token usage

### Debug Mode

Enable detailed logging:

```bash
DEBUG=atlas:* npm start
```

### Health Checks

Monitor system health:

```bash
curl http://api.atlascodex.com/health
```

## Architecture

### System Components

1. **API Server** - RESTful API gateway
2. **Worker Pool** - Extraction processors
3. **Redis Queue** - Job management
4. **DIP Store** - Domain intelligence
5. **Evidence Ledger** - Audit trail
6. **Cost Optimizer** - Resource management

### Data Flow

1. Client submits extraction request
2. API creates job in queue
3. Worker picks up job
4. DIP system checks domain profile
5. Strategy executor runs extraction
6. Evidence system logs results
7. Client retrieves results

## Development

### Project Structure

```
atlascodex/
├── packages/
│   ├── api/          # API server
│   ├── worker/       # Extraction workers
│   ├── frontend/     # Web interface
│   ├── dip-engine/   # DIP system
│   ├── strategies/   # Extraction strategies
│   ├── evidence/     # Evidence ledger
│   └── shared/       # Common utilities
├── kubernetes/       # K8s manifests
├── terraform/        # AWS infrastructure
└── docker/          # Docker configs
```

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# API tests
node test-api.js

# E2E tests
npm run test:e2e
```

### Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Run tests
5. Submit pull request

## Security

### Best Practices

- Rotate API keys regularly
- Use environment variables
- Enable rate limiting
- Monitor suspicious activity
- Keep dependencies updated

### Compliance

- Respects robots.txt
- Follows rate limits
- GDPR compliant
- SOC2 ready

## Support

### Resources

- [API Reference](https://docs.atlascodex.com/api)
- [Video Tutorials](https://youtube.com/atlascodex)
- [Community Forum](https://forum.atlascodex.com)
- [GitHub Issues](https://github.com/atlascodex/issues)

### Contact

- Email: support@atlascodex.com
- Discord: https://discord.gg/atlascodex
- Twitter: @atlascodex

## License

MIT License - see LICENSE file for details

## Acknowledgments

- OpenAI for GPT-5 integration
- Playwright for browser automation
- Redis for queue management
- The open source community

---

Built with ❤️ by the Atlas Codex Team