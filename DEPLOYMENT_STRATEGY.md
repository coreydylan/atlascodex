# Atlas Codex Deployment Strategy

## Recommended Architecture (Simple + Scalable)

```
Frontend: Vercel (Free, global CDN)
    ↓
API: AWS Lambda (Pay per request)
    ↓
Queue: AWS SQS (Pennies)
    ↓
Workers: AWS Lambda with Layers (Playwright)
    ↓
Database: DynamoDB (Pay per request)
    ↓
Storage: S3 (Pennies)
```

## Why This Architecture?

1. **Nearly FREE at low volume** - Lambda free tier = 1M requests/month
2. **Auto-scales to infinity** - No servers to manage
3. **Single AWS bill** - Everything in one place
4. **Simple deployment** - One command with Serverless Framework

## Deployment Commands

```bash
# Install Serverless Framework
npm install -g serverless

# Configure AWS credentials
aws configure

# Deploy everything
serverless deploy

# That's it! You get back:
# - API endpoint: https://abc123.execute-api.us-west-2.amazonaws.com/prod
# - All infrastructure created automatically
```

## Cost Breakdown

| Component | Free Tier | Cost After |
|-----------|-----------|------------|
| Lambda | 1M requests/mo | $0.20 per 1M |
| DynamoDB | 25GB storage | $0.25 per GB/mo |
| SQS | 1M requests/mo | $0.40 per 1M |
| S3 | 5GB storage | $0.023 per GB |

**Monthly cost for 1000 users: ~$5**
**Monthly cost for 10,000 users: ~$50**

## Alternative: Single EC2 (Even Simpler)

If you want EVERYTHING in one place:

```bash
# Launch t3.small instance ($15/month)
# Everything runs on one server
# Easiest to debug and monitor
```

## File Sync Strategy

### Use GitHub as Single Source of Truth

```bash
# Local development
git add .
git commit -m "Update"
git push

# Auto-deploy on push with GitHub Actions
# .github/workflows/deploy.yml handles everything
```

### Environment Variables in AWS Systems Manager

```bash
# Store all secrets in one place
aws ssm put-parameter --name /atlas-codex/openai-key --value "sk-..." --type SecureString
aws ssm put-parameter --name /atlas-codex/db-url --value "..." --type SecureString

# Lambda/EC2 automatically pulls these
```

## Complete Setup Script

```bash
#!/bin/bash

# 1. Setup AWS infrastructure
serverless deploy

# 2. Store secrets
aws ssm put-parameter --name /atlas-codex/openai-key --value "$OPENAI_API_KEY" --type SecureString

# 3. Deploy frontend to Vercel
vercel --prod

# 4. Update frontend with API URL
echo "VITE_API_URL=https://YOUR-API-ID.execute-api.us-west-2.amazonaws.com/prod" > frontend/.env

# 5. Redeploy frontend
vercel --prod

echo "✅ Complete! Your app is live"
```

## Monitoring Everything

Use CloudWatch (built into AWS):
- API Gateway logs
- Lambda function logs  
- DynamoDB metrics
- SQS queue depth
- S3 storage usage

All in one dashboard!

## Why Not Use Multiple Platforms?

You asked a great question about managing multiple platforms. Here's why AWS-only is better:

1. **One bill** - Everything on AWS invoice
2. **One login** - Single AWS console
3. **One region** - Low latency between services
4. **One SDK** - AWS SDK handles everything
5. **One deployment** - Serverless Framework manages all

## Migration Path

Start with → Scale to
- Lambda (serverless) → ECS (containers) → EKS (Kubernetes)
- DynamoDB → RDS Postgres → Aurora
- SQS → Kafka/Kinesis
- S3 → S3 + CloudFront CDN

All within AWS ecosystem!