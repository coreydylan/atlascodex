# Deployment Guide 🚀

Complete guide for deploying Atlas Codex to different environments.

## 🎯 Deployment Overview

Atlas Codex supports multiple deployment strategies:

1. **Development** - Local with Docker Compose + LocalStack
2. **Staging** - AWS with Terraform, limited resources
3. **Production** - AWS with full monitoring and scaling

## 📋 Prerequisites

### Required Tools

```bash
# Core tools
node --version          # 20.x or higher
npm --version          # 9.x or higher
docker --version       # 20.x or higher

# Deployment tools
aws --version          # AWS CLI v2
terraform --version    # 1.0 or higher

# Optional tools
kubectl --version      # For Kubernetes deployments
```

### AWS Setup

```bash
# Configure AWS CLI
aws configure

# Verify access
aws sts get-caller-identity

# Expected output:
{
    "UserId": "...",
    "Account": "790856971687",
    "Arn": "arn:aws:iam::790856971687:user/your-user"
}
```

### Environment Variables

Create `.env` files for each environment:

```bash
# Copy templates
cp .env.dev .env           # For local development
cp .env.staging .env       # For staging deployment  
cp .env.prod .env         # For production deployment

# Edit and add your actual API keys
OPENAI_API_KEY=sk-your-actual-key-here
```

## 🏠 Local Development Deployment

### Quick Start

```bash
# Automated setup
./scripts/setup.sh

# This will:
# 1. Install dependencies
# 2. Bootstrap packages
# 3. Start Redis and LocalStack
# 4. Copy .env.dev to .env
```

### Manual Local Setup

```bash
# Install dependencies
npm install
npm run bootstrap

# Build core package
cd packages/core && npm run build && cd ../..

# Start local services
docker-compose -f infrastructure/docker/docker-compose.dev.yml up -d

# Start development servers
npm run dev
```

### Verify Local Deployment

```bash
# Check services
curl http://localhost:3000/health
curl http://localhost:5173
curl http://localhost:6379 # Redis
curl http://localhost:4566/health # LocalStack

# Test API
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d '{"url": "https://example.com"}'
```

## 🧪 Staging Deployment

### Infrastructure Setup

```bash
# Initialize Terraform
cd infrastructure/terraform
terraform init

# Create staging workspace
terraform workspace new staging
terraform workspace select staging

# Plan infrastructure
terraform plan -var-file="environments/staging.tfvars"

# Apply infrastructure
terraform apply -var-file="environments/staging.tfvars"

# Note the outputs for next steps
terraform output
```

### Application Deployment

```bash
# Deploy using script
./scripts/deploy.sh staging

# Or manually:
npm run build
npm run deploy:infra:staging
npm run deploy:functions:staging
```

### Staging-Specific Configuration

```bash
# Staging environment limits
MAX_LLM_PERCENT=0.20      # 20% of pages can use LLM
MAX_COST_PER_PAGE=0.005   # Max $0.005 per page
RATE_LIMIT_MAX=500        # 500 requests per minute

# AWS Resources (created by Terraform)
DYNAMODB_JOBS_TABLE=atlas-codex-jobs-staging
ARTIFACTS_BUCKET=atlas-codex-artifacts-staging
QUEUE_URL=https://sqs.us-east-1.amazonaws.com/790856971687/atlas-codex-jobs-staging
```

### Verify Staging Deployment

```bash
# Check staging API
curl https://api-staging.atlascodex.ai/health

# Test staging extraction
curl -X POST https://api-staging.atlascodex.ai/api/scrape \
  -H "Authorization: Bearer your-staging-api-key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## 🌟 Production Deployment

### Pre-Production Checklist

- [ ] All tests passing in staging
- [ ] Performance testing completed
- [ ] Security review completed
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] Rollback plan documented

### Production Infrastructure

```bash
# Select production workspace
cd infrastructure/terraform
terraform workspace select prod

# Review production plan
terraform plan -var-file="environments/prod.tfvars"

# Apply with extra confirmation
terraform apply -var-file="environments/prod.tfvars"
```

### Production Application Deployment

```bash
# Deploy with production flag
./scripts/deploy.sh prod

# Or use GitHub Actions with [PROD] tag
git commit -m "release: v1.1.0 [PROD]"
git push origin main
```

### Production Configuration

```bash
# Production environment limits
MAX_LLM_PERCENT=0.15      # 15% max LLM usage
MAX_COST_PER_PAGE=0.002   # Max $0.002 per page  
RATE_LIMIT_MAX=100        # 100 requests per minute

# Enhanced monitoring
DATADOG_API_KEY=your-datadog-key
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=error           # Minimal logging
```

### Blue-Green Deployment

For zero-downtime production deployments:

```bash
# Create new version
terraform workspace new prod-blue
terraform apply -var-file="environments/prod.tfvars" \
  -var="environment_suffix=blue"

# Deploy application to blue
./scripts/deploy.sh prod-blue

# Test blue environment
./scripts/test-deployment.sh prod-blue

# Switch traffic to blue
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123EXAMPLE \
  --change-batch file://switch-to-blue.json

# Cleanup old green environment after validation
terraform workspace select prod-green
terraform destroy
```

## 🐳 Container Deployments

### Docker Images

Build and push production images:

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  790856971687.dkr.ecr.us-east-1.amazonaws.com

# Build worker image
cd packages/worker
docker build -t atlas-codex-worker:latest .
docker tag atlas-codex-worker:latest \
  790856971687.dkr.ecr.us-east-1.amazonaws.com/atlas-codex-worker:latest
docker push 790856971687.dkr.ecr.us-east-1.amazonaws.com/atlas-codex-worker:latest

# Build API image
cd packages/api
docker build -t atlas-codex-api:latest .
docker tag atlas-codex-api:latest \
  790856971687.dkr.ecr.us-east-1.amazonaws.com/atlas-codex-api:latest
docker push 790856971687.dkr.ecr.us-east-1.amazonaws.com/atlas-codex-api:latest
```

### ECS Deployment

```bash
# Update ECS service
aws ecs update-service \
  --cluster atlas-codex-prod \
  --service atlas-codex-worker \
  --force-new-deployment

# Monitor deployment
aws ecs describe-services \
  --cluster atlas-codex-prod \
  --services atlas-codex-worker
```

### Kubernetes Deployment

```yaml
# k8s/worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: atlas-codex-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: atlas-codex-worker
  template:
    metadata:
      labels:
        app: atlas-codex-worker
    spec:
      containers:
      - name: worker
        image: 790856971687.dkr.ecr.us-east-1.amazonaws.com/atlas-codex-worker:latest
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: atlas-codex-secrets
              key: openai-api-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/
kubectl rollout status deployment/atlas-codex-worker
```

## ⚡ Serverless Deployment

### AWS Lambda

```yaml
# serverless.yml
service: atlas-codex-api

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  environment:
    OPENAI_API_KEY: ${env:OPENAI_API_KEY}
    DYNAMODB_JOBS_TABLE: ${env:DYNAMODB_JOBS_TABLE}

functions:
  api:
    handler: handler.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true
    timeout: 30
    memorySize: 1024
```

```bash
# Deploy Lambda function
cd packages/api
npm install -g serverless
serverless deploy --stage prod
```

### Vercel Deployment

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "packages/api/server.js",
      "use": "@vercel/node"
    },
    {
      "src": "packages/frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "packages/api/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "packages/frontend/$1"
    }
  ]
}
```

```bash
# Deploy to Vercel
npm install -g vercel
vercel --prod
```

## 🔄 CI/CD Pipeline

### GitHub Actions

The repository includes a complete CI/CD pipeline in `.github/workflows/ci.yml`:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'npm'
    - run: npm ci
    - run: npm run bootstrap  
    - run: npm run test
    - run: npm run lint

  deploy-dev:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
    - run: npm run deploy:dev

  deploy-prod:
    needs: test
    if: contains(github.event.head_commit.message, '[PROD]')
    runs-on: ubuntu-latest
    steps:
    - run: npm run deploy:prod
```

### Required Secrets

Configure these secrets in your GitHub repository:

```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
OPENAI_API_KEY=sk-...
DATADOG_API_KEY=... (optional)
SENTRY_DSN=... (optional)
```

## 📊 Monitoring and Logging

### Health Checks

```bash
# API health check
curl https://api.atlascodex.ai/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00Z",
  "region": "us-east-1",
  "browsers": 10,
  "contexts": 25
}
```

### Application Metrics

```bash
# CloudWatch custom metrics
aws logs create-log-group --log-group-name /aws/lambda/atlas-codex-api
aws logs create-log-group --log-group-name /aws/ecs/atlas-codex-worker

# View metrics
aws cloudwatch get-metric-statistics \
  --namespace "Atlas Codex" \
  --metric-name "RequestCount" \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### Error Tracking

```javascript
// Sentry integration in production
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});

// Error reporting
Sentry.captureException(error);
```

## 🔒 Security Considerations

### Secrets Management

```bash
# Use AWS Secrets Manager in production
aws secretsmanager create-secret \
  --name "atlas-codex/openai-api-key" \
  --secret-string "sk-your-key-here"

# Update Lambda environment to use secret
aws lambda update-function-configuration \
  --function-name atlas-codex-api \
  --environment Variables='{
    "OPENAI_API_KEY_SECRET":"atlas-codex/openai-api-key"
  }'
```

### Network Security

```bash
# Configure VPC security groups
aws ec2 create-security-group \
  --group-name atlas-codex-api \
  --description "Atlas Codex API security group"

# Allow HTTPS only
aws ec2 authorize-security-group-ingress \
  --group-id sg-12345678 \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
```

### API Security

```javascript
// Rate limiting in production
const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: 'Too many requests, please try again later'
});

app.use('/api', rateLimiter);
```

## 🚨 Troubleshooting Deployments

### Common Issues

**1. Terraform State Lock**
```bash
# Force unlock if deployment fails
terraform force-unlock <lock-id>

# Or use DynamoDB directly
aws dynamodb delete-item \
  --table-name terraform-state-lock \
  --key '{"LockID":{"S":"atlas-codex-terraform-state/atlas-codex/terraform.tfstate"}}'
```

**2. Lambda Cold Start Issues**
```bash
# Enable provisioned concurrency
aws lambda put-provisioned-concurrency-config \
  --function-name atlas-codex-api \
  --qualifier '$LATEST' \
  --provisioned-concurrency-config ProvisionedConcurrencyCount=5
```

**3. ECS Task Failures**
```bash
# Debug ECS tasks
aws ecs describe-tasks \
  --cluster atlas-codex-prod \
  --tasks arn:aws:ecs:us-east-1:790856971687:task/...

# Check logs
aws logs get-log-events \
  --log-group-name /ecs/atlas-codex-worker \
  --log-stream-name ecs/worker/...
```

**4. Database Connection Issues**
```bash
# Check DynamoDB table status
aws dynamodb describe-table --table-name atlas-codex-jobs-prod

# Test connection
aws dynamodb scan --table-name atlas-codex-jobs-prod --limit 1
```

### Rollback Procedures

**Lambda Rollback**:
```bash
# List versions
aws lambda list-versions-by-function --function-name atlas-codex-api

# Rollback to previous version
aws lambda update-alias \
  --function-name atlas-codex-api \
  --name LIVE \
  --function-version 5
```

**ECS Rollback**:
```bash
# Update service to previous task definition
aws ecs update-service \
  --cluster atlas-codex-prod \
  --service atlas-codex-worker \
  --task-definition atlas-codex-worker:5
```

**Terraform Rollback**:
```bash
# Rollback infrastructure changes
terraform plan -target=aws_lambda_function.api \
  -var-file="environments/prod.tfvars"
terraform apply -target=aws_lambda_function.api \
  -var-file="environments/prod.tfvars"
```

## 🎯 Performance Tuning

### Lambda Optimization

```javascript
// Optimize Lambda cold starts
exports.handler = async (event, context) => {
  // Reuse connections
  if (!global.dbConnection) {
    global.dbConnection = new DynamoDB();
  }
  
  // Minimize initialization
  const response = await processRequest(event);
  return response;
};
```

### ECS Optimization

```yaml
# ECS task definition optimization
{
  "cpu": 1024,
  "memory": 2048,
  "networkMode": "awsvpc",
  "placementConstraints": [
    {
      "type": "memberOf",
      "expression": "attribute:ecs.instance-type =~ m5.*"
    }
  ]
}
```

### Database Optimization

```bash
# DynamoDB auto-scaling
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --resource-id table/atlas-codex-jobs-prod \
  --min-capacity 5 \
  --max-capacity 40000
```

## 📈 Scaling Considerations

### Horizontal Scaling

```bash
# ECS service scaling
aws ecs update-service \
  --cluster atlas-codex-prod \
  --service atlas-codex-worker \
  --desired-count 10

# Lambda concurrency
aws lambda put-reserved-concurrency-config \
  --function-name atlas-codex-api \
  --reserved-concurrency-config ReservedConcurrencyCount=100
```

### Auto Scaling

```yaml
# ECS auto-scaling policy
{
  "ScalingEnabled": true,
  "ScalingPolicyUpdateBehavior": "ROLLING_UPDATE",
  "MinCapacity": 2,
  "MaxCapacity": 50,
  "TargetValue": 70.0,
  "ScaleOutCooldown": 300,
  "ScaleInCooldown": 300
}
```

## 🔄 Maintenance

### Regular Tasks

```bash
# Weekly tasks
./scripts/rotate-logs.sh
./scripts/cleanup-old-jobs.sh
./scripts/update-dependencies.sh

# Monthly tasks  
./scripts/security-audit.sh
./scripts/cost-optimization-review.sh
./scripts/performance-review.sh
```

### Updates and Patches

```bash
# Update Node.js dependencies
npm audit
npm update

# Update Docker images
docker pull node:20-alpine
docker pull redis:7-alpine

# Update Terraform providers
terraform init -upgrade
```

This deployment guide provides comprehensive coverage of all deployment scenarios for Atlas Codex. Choose the appropriate deployment strategy based on your requirements and scale.