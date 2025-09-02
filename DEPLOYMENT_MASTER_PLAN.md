# Atlas Codex Deployment Master Plan
## Senior Developer's Prioritized Task List

> **Status**: Ready for execution  
> **Timeline**: 5-7 days for full production deployment  
> **Critical Path**: Items marked 🔥 must be completed before subsequent tasks

---

## Phase 0: Pre-Flight Checks (30 minutes)

### 🔥 CRITICAL - Environment Setup
- [ ] **ENV-001**: Verify AWS CLI is configured and has correct permissions
  ```bash
  aws sts get-caller-identity
  aws iam get-user
  ```
- [ ] **ENV-002**: Verify Node.js 20.x is installed
  ```bash
  node --version  # Should be 20.x
  npm --version   # Should be 10.x+
  ```
- [ ] **ENV-003**: Verify Serverless CLI is installed globally
  ```bash
  serverless --version  # Should be 3.x+
  ```
- [ ] **ENV-004**: Check current AWS region matches serverless.yml (us-west-2)
  ```bash
  aws configure get region
  ```

---

## Phase 1: Fix Core Package Build (Critical Path - Day 1)

### 🔥 CRITICAL - Dependencies & Build Fixes
- [ ] **CORE-001**: Install missing TypeScript dependencies
  ```bash
  cd packages/core
  npm install @aws-sdk/lib-dynamodb@^3.879.0
  npm install @aws-sdk/util-dynamodb@^3.879.0
  npm install --save-dev @types/turndown
  npm install turndown@^7.1.2
  npm install node-fetch@^3.3.2
  ```

- [ ] **CORE-002**: Fix Firecrawl API method calls (breaking changes)
  - [ ] Replace `scrapeUrl()` with `scrape()` in firecrawl-service.ts:80
  - [ ] Replace `scrapeUrl()` with `scrape()` in firecrawl-service.ts:136
  - [ ] Replace `scrapeUrl()` with `scrape()` in firecrawl-service.ts:344
  - [ ] Remove `crawlUrl()` - replace with `crawl()` in firecrawl-service.ts:250
  - [ ] Remove `mapUrl()` - replace with `map()` in firecrawl-service.ts:311
  - [ ] Fix search request - remove `lang` property from firecrawl-service.ts:202
  - [ ] Update search response - use `.data` instead of `.results` in firecrawl-service.ts:210,214

- [ ] **CORE-003**: Fix TypeScript type safety issues
  - [ ] Fix cost optimizer dynamic indexing in cost-optimizer.ts:68,95,245,246,276
    ```typescript
    // Change from: costs[strategy]
    // Change to: costs[strategy as keyof typeof costs] || 0
    ```
  - [ ] Fix error type handling - replace `unknown` with `Error` type:
    - [ ] dip-service.ts:70,118,182
    - [ ] test-extraction.ts:30,59,86,103,120,134
  - [ ] Fix DynamoDB command construction in evidence-ledger.ts:399
    - Replace `PutItemCommand` with `UpdateItemCommand`
  - [ ] Fix extraction service schema indexing in extraction-service.ts:315
  - [ ] Fix strategy array typing in extraction-service.ts:451

- [ ] **CORE-004**: Remove Playwright dependency (Lambda incompatible)
  - [ ] Remove langchain playwright import from extraction-service.ts:7
  - [ ] Replace browser rendering with Firecrawl for JavaScript-heavy pages
  - [ ] Update extraction strategies to exclude browser_render temporarily

- [ ] **CORE-005**: Verify build compiles successfully
  ```bash
  cd packages/core
  npm run build
  # Must complete without errors before proceeding
  ```

---

## Phase 2: Infrastructure Foundation (Day 1-2)

### 🔥 CRITICAL - Database & Queue Creation
- [ ] **INFRA-001**: Create DynamoDB tables (required for app to start)
  ```bash
  # Jobs table
  aws dynamodb create-table \
    --table-name atlas-codex-jobs \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-west-2

  # DIPs table
  aws dynamodb create-table \
    --table-name atlas-codex-dips-dev \
    --attribute-definitions AttributeName=domain,AttributeType=S \
    --key-schema AttributeName=domain,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-west-2

  # Connections table for WebSocket
  aws dynamodb create-table \
    --table-name atlas-codex-connections \
    --attribute-definitions AttributeName=connectionId,AttributeType=S \
    --key-schema AttributeName=connectionId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --time-to-live-specification AttributeName=ttl,Enabled=true \
    --region us-west-2
  ```

- [ ] **INFRA-002**: Create SQS queues
  ```bash
  # Main job queue
  aws sqs create-queue \
    --queue-name atlas-codex-queue \
    --attributes VisibilityTimeout=360,MessageRetentionPeriod=86400,ReceiveMessageWaitTimeSeconds=20 \
    --region us-west-2

  # Dead letter queue
  aws sqs create-queue \
    --queue-name atlas-codex-dlq \
    --attributes MessageRetentionPeriod=1209600 \
    --region us-west-2

  # Configure DLQ redrive policy
  aws sqs set-queue-attributes \
    --queue-url https://sqs.us-west-2.amazonaws.com/$(aws sts get-caller-identity --query Account --output text)/atlas-codex-queue \
    --attributes RedrivePolicy='{"deadLetterTargetArn":"arn:aws:sqs:us-west-2:$(aws sts get-caller-identity --query Account --output text):atlas-codex-dlq","maxReceiveCount":2}'
  ```

- [ ] **INFRA-003**: Verify infrastructure is created
  ```bash
  aws dynamodb list-tables --region us-west-2 | grep atlas-codex
  aws sqs list-queues --region us-west-2 | grep atlas-codex
  ```

### Environment Configuration
- [ ] **CONFIG-001**: Get API keys (required for real extraction)
  - [ ] Obtain OpenAI API key (for GPT-based extraction)
  - [ ] Obtain Firecrawl API key (for web scraping)
  - [ ] Store keys in environment variables or AWS Secrets Manager

- [ ] **CONFIG-002**: Create local environment file
  ```bash
  cat > .env.local << EOF
  NODE_ENV=development
  AWS_REGION=us-west-2
  MASTER_API_KEY=atlas-dev-key-2024
  OPENAI_API_KEY=your-openai-key-here
  FIRECRAWL_API_KEY=your-firecrawl-key-here
  DYNAMODB_DIPS_TABLE=atlas-codex-dips-dev
  EOF
  ```

---

## Phase 3: Lambda Optimization (Day 2)

### 🔥 CRITICAL - Reduce Deployment Size
- [ ] **OPT-001**: Create .serverlessignore for size reduction
  ```bash
  cat > .serverlessignore << 'EOF'
  # Dependencies (will use Lambda layers)
  node_modules/**
  packages/*/node_modules/**
  packages/frontend/**
  packages/worker/**
  packages/core/src/**
  
  # Development files
  *.test.js
  *.spec.js
  **/*.test.ts
  **/*.spec.ts
  .git/**
  .github/**
  .vscode/**
  *.md
  .env*
  
  # Build artifacts
  packages/*/dist/**
  packages/*/build/**
  *.log
  
  # Documentation
  docs/**
  README.md
  LICENSE
  kubernetes/**
  test/**
  tests/**
  EOF
  ```

- [ ] **OPT-002**: Update serverless.yml for optimized packaging
  ```yaml
  # Add to serverless.yml
  package:
    individually: true
    patterns:
      - '!**'
      - 'api/**'
      - 'packages/core/dist/**'
    excludeDevDependencies: true
  
  functions:
    api:
      handler: api/lambda.handler
      package:
        patterns:
          - 'api/lambda.js'
          - '!api/worker.js'
      memorySize: 512  # Reduced from 1024
      timeout: 15      # Reduced from 30
    
    worker:
      handler: api/worker.handler
      package:
        patterns:
          - 'api/worker.js'
          - 'packages/core/dist/**'
          - '!api/lambda.js'
      memorySize: 1024  # Reduced from 3008
      timeout: 240      # Reduced from 280
  ```

- [ ] **OPT-003**: Create Lambda layer for heavy dependencies
  ```bash
  mkdir -p layers/shared/nodejs
  cd layers/shared/nodejs
  npm init -y
  npm install @aws-sdk/client-dynamodb @aws-sdk/client-sqs @aws-sdk/client-s3
  npm install openai @mendable/firecrawl-js nanoid
  cd ../../../
  ```

- [ ] **OPT-004**: Add layer configuration to serverless.yml
  ```yaml
  layers:
    sharedDeps:
      path: layers/shared
      name: atlas-codex-shared-deps-${sls:stage}
      compatibleRuntimes:
        - nodejs20.x
      retain: false
  
  functions:
    api:
      layers:
        - { Ref: SharedDepsLambdaLayer }
    worker:
      layers:
        - { Ref: SharedDepsLambdaLayer }
  ```

---

## Phase 4: Fix API Implementation (Day 2-3)

### 🔥 CRITICAL - Replace Mock with Real Logic
- [ ] **API-001**: Fix worker.js imports (currently broken)
  ```javascript
  // Update api/worker.js imports
  const { DynamoDBClient, UpdateItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  
  // Fix these paths based on actual compiled output
  const ExtractionService = require('../packages/core/dist/extraction-service').ExtractionService;
  const FirecrawlService = require('../packages/core/dist/firecrawl-service').FirecrawlService;
  const DIPService = require('../packages/core/dist/dip-service').DIPService;
  ```

- [ ] **API-002**: Update lambda.js to remove hardcoded responses
  ```javascript
  // In api/lambda.js, replace this line:
  // res.end(JSON.stringify({status: 'completed', result: {title: 'Test', content: 'Sample'}}));
  
  // With actual job polling logic that checks DynamoDB for real results
  ```

- [ ] **API-003**: Implement proper job status endpoint
  ```javascript
  // Fix handleGetJob function to return real DynamoDB job data
  async function handleGetJob(jobId) {
    const result = await dynamodb.send(new GetItemCommand({
      TableName: 'atlas-codex-jobs',
      Key: { id: { S: jobId } }
    }));
    
    if (!result.Item) {
      return createResponse(404, { error: 'Job not found' });
    }
    
    const status = result.Item.status.S;
    const jobResult = result.Item.result?.S ? JSON.parse(result.Item.result.S) : null;
    
    return createResponse(200, {
      id: jobId,
      status: status,
      result: jobResult,
      updatedAt: result.Item.updatedAt.N
    });
  }
  ```

- [ ] **API-004**: Add WebSocket handlers implementation
  ```javascript
  // Create api/websocket.js
  const { DynamoDBClient, PutItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
  
  exports.connect = async (event) => {
    // Store connection ID in DynamoDB
  };
  
  exports.disconnect = async (event) => {
    // Remove connection ID from DynamoDB
  };
  
  exports.default = async (event) => {
    // Handle WebSocket messages
  };
  ```

---

## Phase 5: Test Initial Deployment (Day 3)

### 🔥 CRITICAL - First Deploy Test
- [ ] **DEPLOY-001**: Test serverless package size
  ```bash
  serverless package --stage dev
  ls -lh .serverless/*.zip  # Should be < 50MB each
  ```

- [ ] **DEPLOY-002**: Deploy to development stage
  ```bash
  serverless deploy --stage dev --verbose
  # Monitor for errors and size issues
  ```

- [ ] **DEPLOY-003**: Test health endpoint
  ```bash
  curl https://$(serverless info --stage dev --verbose | grep HttpApiUrl | cut -d' ' -f2)/health
  # Should return healthy status, not 404
  ```

- [ ] **DEPLOY-004**: Test extraction endpoint
  ```bash
  curl -X POST https://your-api-url/api/extract \
    -H "Content-Type: application/json" \
    -H "x-api-key: atlas-dev-key-2024" \
    -d '{"url": "https://example.com", "strategy": "auto"}'
  # Should return jobId, not "Test/Sample"
  ```

---

## Phase 6: Frontend Integration (Day 3-4)

### Fix API Connection Issues
- [ ] **FE-001**: Update API base URL in frontend
  ```typescript
  // In packages/frontend/src/App.tsx
  const API_BASE = process.env.REACT_APP_API_URL || 'https://YOUR-API-ID.execute-api.us-west-2.amazonaws.com/dev';
  ```

- [ ] **FE-002**: Fix API endpoint paths
  ```typescript
  // Change from: /extract
  // Change to: /api/extract
  
  // Change polling endpoint from: /jobs/{id}
  // Change to: /api/extract/{id}
  ```

- [ ] **FE-003**: Update API key configuration
  ```typescript
  // Use environment variable for API key
  const API_KEY = process.env.REACT_APP_API_KEY || 'atlas-dev-key-2024';
  
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  }
  ```

- [ ] **FE-004**: Test frontend-backend connection
  ```bash
  cd packages/frontend
  echo "REACT_APP_API_URL=https://your-api-url" > .env.local
  echo "REACT_APP_API_KEY=atlas-dev-key-2024" >> .env.local
  npm run dev
  # Test extraction on localhost:3000
  ```

- [ ] **FE-005**: Deploy frontend with new API URLs
  ```bash
  cd packages/frontend
  npm run build
  vercel --prod
  ```

### Add WebSocket Support (Optional but Recommended)
- [ ] **WS-001**: Add WebSocket connection for real-time updates
  ```typescript
  // Add to App.tsx
  const wsUrl = process.env.REACT_APP_WEBSOCKET_URL;
  const ws = new WebSocket(wsUrl);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'job_update') {
      updateJobStatus(data.jobId, data.status, data.result);
    }
  };
  ```

---

## Phase 7: Production Readiness (Day 4-5)

### Security & Configuration
- [ ] **SEC-001**: Set up AWS Secrets Manager for API keys
  ```bash
  aws secretsmanager create-secret \
    --name atlas-codex/api-keys \
    --description "API keys for Atlas Codex" \
    --secret-string '{"openai":"your-key","firecrawl":"your-key"}' \
    --region us-west-2
  ```

- [ ] **SEC-002**: Update Lambda to use Secrets Manager
  ```javascript
  const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
  
  async function getApiKeys() {
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
    const command = new GetSecretValueCommand({ SecretId: 'atlas-codex/api-keys' });
    const result = await client.send(command);
    return JSON.parse(result.SecretString);
  }
  ```

- [ ] **SEC-003**: Add proper CORS configuration
  ```javascript
  const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
  ```

### Error Handling & Monitoring
- [ ] **MON-001**: Add comprehensive error handling
  ```javascript
  // Add to all Lambda functions
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
  
  // Wrap all handlers with try-catch and proper logging
  ```

- [ ] **MON-002**: Add CloudWatch logging
  ```yaml
  # Add to serverless.yml
  provider:
    logs:
      httpApi: true
    environment:
      LOG_LEVEL: ${opt:stage, 'dev'}
  ```

- [ ] **MON-003**: Set up CloudWatch alarms
  ```yaml
  resources:
    Resources:
      ErrorAlarm:
        Type: AWS::CloudWatch::Alarm
        Properties:
          AlarmName: AtlasCodex-Errors-${opt:stage, 'dev'}
          AlarmDescription: Lambda function errors
          MetricName: Errors
          Namespace: AWS/Lambda
          Statistic: Sum
          Period: 300
          EvaluationPeriods: 2
          Threshold: 5
          ComparisonOperator: GreaterThanThreshold
  ```

---

## Phase 8: Deployment Automation (Day 5)

### GitHub Actions Setup
- [ ] **CI-001**: Add required secrets to GitHub repository
  - [ ] AWS_ACCESS_KEY_ID
  - [ ] AWS_SECRET_ACCESS_KEY
  - [ ] MASTER_API_KEY
  - [ ] OPENAI_API_KEY
  - [ ] FIRECRAWL_API_KEY

- [ ] **CI-002**: Update GitHub Actions workflow
  ```yaml
  # Update .github/workflows/deploy.yml
  - name: Deploy Backend
    run: |
      cd /
      npm ci
      cd packages/core && npm ci && npm run build
      cd ../../
      serverless deploy --stage ${{ github.ref == 'refs/heads/main' && 'prod' || 'dev' }}
    env:
      MASTER_API_KEY: ${{ secrets.MASTER_API_KEY }}
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      FIRECRAWL_API_KEY: ${{ secrets.FIRECRAWL_API_KEY }}
  
  - name: Deploy Frontend
    run: |
      cd packages/frontend
      echo "REACT_APP_API_URL=${{ steps.get-api-url.outputs.api_url }}" > .env.production
      npm ci && npm run build
      vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
  ```

- [ ] **CI-003**: Test automated deployment
  ```bash
  git add .
  git commit -m "feat: implement real extraction service [DEPLOY]"
  git push origin main
  # Monitor GitHub Actions for successful deployment
  ```

### Multi-Environment Setup
- [ ] **ENV-001**: Create staging environment
  ```bash
  serverless deploy --stage staging
  ```

- [ ] **ENV-002**: Create production environment configuration
  ```yaml
  # Create serverless.prod.yml
  service: atlas-codex-prod
  provider:
    environment:
      NODE_ENV: production
      MASTER_API_KEY: ${env:PROD_API_KEY}
      DYNAMODB_DIPS_TABLE: atlas-codex-dips-prod
  ```

---

## Phase 9: Performance Optimization (Day 6-7)

### Database Optimization
- [ ] **PERF-001**: Add DynamoDB indexes for common queries
  ```bash
  # Add GSI for domain-based queries
  aws dynamodb update-table \
    --table-name atlas-codex-dips-dev \
    --attribute-definitions AttributeName=domain,AttributeType=S AttributeName=lastUsed,AttributeType=N \
    --global-secondary-index-updates \
    '[{"Create":{"IndexName":"domain-lastUsed-index","KeySchema":[{"AttributeName":"domain","KeyType":"HASH"},{"AttributeName":"lastUsed","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"},"BillingMode":"PAY_PER_REQUEST"}}]'
  ```

- [ ] **PERF-002**: Add query optimization to DIP service
  ```typescript
  // Add projection expressions to reduce data transfer
  const params = {
    TableName: this.tableName,
    Key: { domain },
    ProjectionExpression: 'domain, optimalStrategy, confidence, lastUpdated',
    ConsistentRead: false // Use eventually consistent reads
  };
  ```

### Lambda Performance Tuning
- [ ] **PERF-003**: Add Lambda provisioned concurrency for API function
  ```yaml
  functions:
    api:
      provisionedConcurrency: 2  # Keep 2 instances warm
      reservedConcurrency: 10   # Limit max concurrent executions
  ```

- [ ] **PERF-004**: Implement result caching
  ```javascript
  // Add Redis caching layer (optional)
  // Or use Lambda memory caching for frequently accessed DIPs
  const dipCache = new Map();
  
  async function getCachedDIP(domain) {
    if (dipCache.has(domain)) {
      const cached = dipCache.get(domain);
      if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
        return cached.dip;
      }
    }
    // Fetch from DynamoDB if not cached or expired
  }
  ```

### Cost Optimization
- [ ] **COST-001**: Set up cost monitoring
  ```yaml
  # Add cost anomaly detection
  resources:
    Resources:
      CostAnomalyDetector:
        Type: AWS::CE::AnomalyDetector
        Properties:
          AnomalyDetectorName: AtlasCodexCostAnomaly
          MonitorType: DIMENSIONAL
          MonitorSpecification:
            DimensionKey: SERVICE
            Dimensions:
              - Key: SERVICE
                Values: [Lambda, DynamoDB, SQS, S3, ApiGateway]
  ```

- [ ] **COST-002**: Add budget alerts
  ```bash
  aws budgets create-budget \
    --account-id $(aws sts get-caller-identity --query Account --output text) \
    --budget '{
      "BudgetName": "AtlasCodex-Monthly",
      "BudgetLimit": {"Amount": "100", "Unit": "USD"},
      "TimeUnit": "MONTHLY",
      "BudgetType": "COST"
    }' \
    --notifications-with-subscribers '[{
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 80
      },
      "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "your-email@example.com"}]
    }]'
  ```

---

## Phase 10: Testing & Validation (Day 7)

### Integration Testing
- [ ] **TEST-001**: Create comprehensive test suite
  ```bash
  # Create test script
  cat > test-deployment.js << 'EOF'
  const fetch = require('node-fetch');
  const API_BASE = process.env.API_BASE_URL;
  const API_KEY = process.env.MASTER_API_KEY;
  
  async function testExtraction() {
    // Test job creation
    const response = await fetch(`${API_BASE}/api/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        url: 'https://example.com',
        strategy: 'auto'
      })
    });
    
    const job = await response.json();
    console.log('Job created:', job.jobId);
    
    // Poll for completion
    let status = 'pending';
    while (status === 'pending' || status === 'processing') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`${API_BASE}/api/extract/${job.jobId}`, {
        headers: { 'x-api-key': API_KEY }
      });
      
      const statusData = await statusResponse.json();
      status = statusData.status;
      console.log('Status:', status);
      
      if (status === 'completed') {
        console.log('Result:', statusData.result);
        break;
      }
    }
  }
  
  testExtraction().catch(console.error);
  EOF
  
  node test-deployment.js
  ```

- [ ] **TEST-002**: Load testing
  ```bash
  # Install artillery for load testing
  npm install -g artillery
  
  # Create load test config
  cat > load-test.yml << 'EOF'
  config:
    target: 'https://your-api-url'
    phases:
      - duration: 60
        arrivalRate: 5
  scenarios:
    - name: "Test extraction endpoint"
      requests:
        - post:
            url: "/api/extract"
            headers:
              x-api-key: "atlas-dev-key-2024"
              Content-Type: "application/json"
            json:
              url: "https://example.com"
              strategy: "auto"
  EOF
  
  artillery run load-test.yml
  ```

### Validation Checklist
- [ ] **VAL-001**: Verify all endpoints return real data (not mock)
- [ ] **VAL-002**: Confirm DIP system is learning and updating
- [ ] **VAL-003**: Test multiple extraction strategies work
- [ ] **VAL-004**: Validate cost tracking is functioning
- [ ] **VAL-005**: Confirm WebSocket updates are working
- [ ] **VAL-006**: Test error handling and recovery
- [ ] **VAL-007**: Validate frontend displays real extraction results

---

## Phase 11: Documentation & Handoff (Ongoing)

### Documentation
- [ ] **DOC-001**: Create API documentation
- [ ] **DOC-002**: Document deployment procedures
- [ ] **DOC-003**: Create troubleshooting guide
- [ ] **DOC-004**: Document cost optimization strategies

### Monitoring Dashboard Setup
- [ ] **DASH-001**: Set up CloudWatch dashboard
- [ ] **DASH-002**: Configure alerting rules
- [ ] **DASH-003**: Set up log aggregation
- [ ] **DASH-004**: Create performance monitoring

---

## 🚨 Critical Success Criteria

### Must Work Before Considering Complete:
1. **Build Success**: `npm run build` completes without errors
2. **Deployment Success**: Lambda functions deploy under 50MB each
3. **Database Connection**: All DynamoDB tables accessible
4. **Real Extractions**: API returns actual web content, not mock data
5. **Frontend Integration**: UI displays real extraction results
6. **Job Processing**: SQS workers process jobs end-to-end
7. **Cost Monitoring**: Tracking system shows actual extraction costs

### Definition of Done:
- [ ] Frontend shows real extraction data (not "Test/Sample")
- [ ] DIP system learns and optimizes extraction strategies
- [ ] Cost stays under $100/month for moderate usage
- [ ] Deployment completes in under 5 minutes
- [ ] Error rate stays under 1%
- [ ] API response time under 2 seconds for 95th percentile

---

## 🔧 Emergency Rollback Plan

If anything breaks during deployment:

```bash
# Rollback Lambda
serverless rollback --timestamp TIMESTAMP_FROM_DEPLOY_LOG

# Rollback frontend
vercel rollback

# Restore previous API configuration
git revert HEAD
git push origin main
```

---

## 🎯 Quick Wins (Do These First)

1. **Fix TypeScript build** (CORE-001 to CORE-005) - 2 hours
2. **Create infrastructure** (INFRA-001 to INFRA-003) - 1 hour  
3. **Deploy basic version** (DEPLOY-001 to DEPLOY-004) - 1 hour
4. **Test real extraction** (TEST-001) - 30 minutes

**Total time for basic working system: 4.5 hours**

---

*Generated by: Senior Development Team*  
*Priority: P0 (Critical - Business Blocking)*  
*Estimated Effort: 35-40 development hours over 5-7 days*