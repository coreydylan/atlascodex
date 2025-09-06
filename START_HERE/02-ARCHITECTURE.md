# System Architecture - Atlas Codex

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│   User/Client   │────▶│   Vercel CDN     │────▶│   API Gateway   │
│                 │     │   (Frontend)     │     │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Lambda Function                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              evidence-first-bridge.js                    │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │  Navigation  │  │   Unified    │  │    Schema    │  │   │
│  │  │   Detector   │──│  Extractor   │──│  Validator   │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
            ┌──────────────────────────┐
            │     OpenAI GPT-4o        │
            │   (Intelligence Layer)    │
            └──────────────────────────┘
```

## Component Details

### 1. Frontend Layer (Vercel)
- **Technology**: Static HTML/JS
- **Deployment**: Vercel CDN
- **Features**:
  - Simple test interface
  - API integration
  - Real-time extraction testing
- **Auto-deployment**: On push to main/production branches

### 2. API Gateway
- **Service**: AWS API Gateway
- **Endpoints**:
  - `/health` - Health check
  - `/api/extract` - Main extraction endpoint
  - `/api/ai_process` - AI processing endpoint
- **Authentication**: API key validation
- **Rate Limiting**: Configured per endpoint

### 3. Lambda Function
- **Runtime**: Node.js 18.x
- **Memory**: 1024 MB
- **Timeout**: 60 seconds (critical for multi-page)
- **Handler**: `api/lambda.handler`
- **Environment Variables**:
  - `OPENAI_API_KEY`
  - `MASTER_API_KEY`
  - `UNIFIED_EXTRACTOR_ENABLED`

### 4. Core Extraction Engine

#### Navigation Detector
```javascript
shouldUseMultiPageExtraction(params, htmlContent) {
  // Detects pagination patterns
  // Identifies multi-page content
  // Returns extraction strategy
}
```

#### Unified Extractor
```javascript
class UnifiedExtractor {
  // Handles AI-powered extraction
  // Manages OpenAI integration
  // Processes extraction instructions
}
```

#### Schema Validator
- Uses AJV (Another JSON Schema Validator)
- Validates extracted data
- Ensures data quality
- Provides error details

## Data Flow

### Single Page Extraction
1. Client sends extraction request
2. Lambda validates API key
3. Fetches target URL content
4. Sends to GPT-4o with instructions
5. Validates response against schema
6. Returns structured data

### Multi-Page Extraction (Navigation-Aware)
1. Client sends extraction request
2. Lambda validates API key
3. Fetches initial page
4. **Detects navigation patterns**
5. **Crawls all related pages**
6. **Aggregates content**
7. Sends combined content to GPT-4o
8. Validates complete dataset
9. Returns comprehensive results

## Deployment Architecture

### CI/CD Pipeline
```
GitHub Push → GitHub Actions → AWS Lambda + Vercel
     │              │                    │
     ▼              ▼                    ▼
   Tests      Build & Deploy      Auto-deploy
```

### Environment Strategy
- **Development**: `main` branch → `atlas-codex-dev-api`
- **Production**: `production` branch → `atlas-codex-prod-api`
- **Canary Deployment**: 10% traffic for 2 minutes
- **Auto-rollback**: On error threshold exceeded

## Key Technologies

### Backend Stack
- **Node.js 18.x**: Runtime environment
- **Serverless Framework v3**: Deployment and configuration
- **AWS SDK**: AWS service integration
- **OpenAI SDK**: GPT-4o integration
- **AJV**: Schema validation
- **Cheerio**: HTML parsing

### Infrastructure
- **AWS Lambda**: Serverless compute
- **API Gateway**: REST API management
- **CloudWatch**: Logging and monitoring
- **GitHub Actions**: CI/CD automation
- **Vercel**: Frontend hosting

### Development Tools
- **Git Worktrees**: Feature isolation
- **GitHub CLI**: PR and workflow management
- **AWS CLI**: Infrastructure management
- **Serverless CLI**: Deployment management

## Security Architecture

### API Security
- API key validation on all endpoints
- Separate keys for dev/prod environments
- Rate limiting per API key
- Request validation

### Infrastructure Security
- IAM roles with least privilege
- Encrypted environment variables
- VPC isolation (if needed)
- CloudWatch monitoring

### Code Security
- No secrets in code
- Environment variable management
- Secure key rotation
- Audit logging

## Performance Characteristics

### Response Times
- Simple extraction: 5-10 seconds
- Multi-page extraction: 20-60 seconds
- Health check: < 1 second

### Scalability
- Lambda auto-scaling
- Concurrent execution limit: 1000
- API Gateway throttling: 10,000 req/s
- Memory allocation: 1024 MB

### Reliability
- 99.95% Lambda SLA
- Automatic retry on failures
- Dead letter queue for failed requests
- CloudWatch alarms for monitoring

## Monitoring & Observability

### CloudWatch Metrics
- Lambda invocations
- Error rates
- Duration metrics
- Throttle counts

### Application Logs
- Structured JSON logging
- Request/response tracking
- Error stack traces
- Performance metrics

### Alarms
- High error rate (> 5%)
- Long duration (> 50s)
- Throttling detected
- Memory usage > 90%

## Critical Design Decisions

1. **60-second timeout**: Required for multi-page extraction
2. **Navigation detection**: Automatic multi-page discovery
3. **Unified extractor**: Single AI interface for all extractions
4. **Schema validation**: Ensures data quality
5. **Serverless architecture**: Cost-effective scaling

## Architecture Constraints

- Lambda 15-minute maximum timeout
- API Gateway 29-second timeout
- 6 MB response size limit
- 10 MB request size limit
- Cold start latency (~2 seconds)

This architecture is optimized for reliability, scalability, and maintainability while preserving the critical navigation-aware extraction capability.