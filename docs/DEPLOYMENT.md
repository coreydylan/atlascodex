# Deployment Guide - Atlas Codex

## 🚀 Automatic Deployment Overview

Atlas Codex uses GitHub Actions for CI/CD with automatic deployments to both AWS Lambda and Vercel.

```
GitHub → GitHub Actions → AWS Lambda (Backend)
                       ↘ Vercel (Frontend)
```

## 📋 Deployment Flow

### Branch Strategy

| Branch | Environment | Auto Deploy | URL |
|--------|------------|-------------|-----|
| `main` | Development/Staging | ✅ Yes | https://atlas-codex-dev.vercel.app |
| `production` | Production | ✅ Yes | https://atlas-codex.vercel.app |
| Feature branches | Preview | ✅ Vercel only | Preview URLs |

### Deployment Triggers

1. **Push to `main`** → Deploys to Development
   - AWS Lambda: `atlas-codex-dev-api`
   - Vercel: Development preview
   - Tests run automatically

2. **Push to `production`** → Deploys to Production
   - AWS Lambda: `atlas-codex-prod-api` 
   - Canary deployment (10% traffic for 2 min)
   - Auto-rollback on errors
   - Vercel: Production site

3. **Pull Request** → Tests only
   - No deployment
   - Vercel preview URL created
   - Must pass tests to merge

## 🔧 Initial Setup

### 1. GitHub Secrets Configuration

Run the setup script:
```bash
bash scripts/setup-github-secrets.sh
```

Or manually add these secrets at https://github.com/coreydylan/atlascodex/settings/secrets/actions:

| Secret | Description | Example |
|--------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key | AKIA... |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret | wJal... |
| `OPENAI_API_KEY` | OpenAI API key | sk-proj-... |
| `DEV_MASTER_API_KEY` | Dev environment API key | Generated |
| `PROD_MASTER_API_KEY` | Production API key | Generated |

### 2. Create Production Branch

```bash
# Create production branch from stable main
git checkout main
git pull origin main
git checkout -b production
git push origin production
```

### 3. GitHub Environment Protection

1. Go to Settings → Environments
2. Create **development** environment:
   - No restrictions
   
3. Create **production** environment:
   - ✅ Required reviewers: 1
   - ✅ Only protected branches
   - ✅ Deployment protection rules

### 4. Branch Protection Rules

#### Main Branch
- Settings → Branches → Add rule
- Branch pattern: `main`
- ✅ Require pull request reviews
- ✅ Require status checks to pass
- ✅ Require branches to be up to date

#### Production Branch
- Branch pattern: `production`
- ✅ Require pull request reviews (2 reviewers)
- ✅ Restrict who can push
- ✅ Require status checks
- ✅ Include administrators

### 5. Vercel Setup

1. **Connect GitHub Repository**:
   ```bash
   vercel link
   vercel git connect
   ```

2. **Configure Environment Variables** in Vercel Dashboard:
   - `api-url`: Your API endpoint
   - `api-key`: Your API key
   - `environment`: dev/prod

3. **Branch Deployments**:
   - Production Branch: `production`
   - Preview Branches: All others

## 🚢 Deployment Process

### Development Deployment

```bash
# Make changes
git add .
git commit -m "feat: your feature"
git push origin main

# Automatic deployment starts
# Monitor at: https://github.com/coreydylan/atlascodex/actions
```

### Production Deployment

```bash
# From main branch (tested)
git checkout main
git pull origin main

# Create PR to production
git checkout production
git pull origin production
git merge main
git push origin production

# Or via GitHub UI:
# Create PR from main → production
# Requires approval
# Auto-deploys after merge
```

### Canary Deployment (Production)

Production deployments use canary releases:

1. New version gets 10% traffic
2. Monitors for 2 minutes
3. If errors < threshold → Promotes to 100%
4. If errors > threshold → Auto rollback

## 🔄 Rollback Procedures

### Automatic Rollback

Production deployments auto-rollback if:
- Error rate > 5 errors in 2 minutes
- Health check fails
- Tests fail

### Manual Rollback

1. **Via GitHub Actions**:
   ```bash
   # Go to Actions tab
   # Select "Deploy Atlas Codex"
   # Click "Run workflow"
   # Select "rollback" job
   ```

2. **Via AWS CLI**:
   ```bash
   # Rollback to stable version 45
   aws lambda update-alias \
     --function-name atlas-codex-prod-api \
     --name prod \
     --function-version 45
   ```

3. **Via Script**:
   ```bash
   # Check docs/RUNBOOKS/emergency-rollback.md
   ```

## 📊 Monitoring Deployments

### GitHub Actions
- https://github.com/coreydylan/atlascodex/actions
- Real-time logs
- Success/failure notifications

### AWS CloudWatch
```bash
# Watch Lambda logs
aws logs tail /aws/lambda/atlas-codex-dev-api --follow

# Check metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=atlas-codex-prod-api \
  --start-time 2024-09-04T00:00:00Z \
  --end-time 2024-09-04T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### Vercel Dashboard
- https://vercel.com/dashboard
- Deployment history
- Preview URLs
- Analytics

## 🧪 Testing in CI/CD

Tests run automatically on every push:

1. **Validation Tests**:
   - Serverless config valid
   - Dependencies installed
   - No syntax errors

2. **Smoke Tests** (after deployment):
   - Health endpoint responds
   - Basic extraction works
   - API authentication works

3. **Golden Tests** (production only):
   - VMOTA returns 6 members
   - Response times < 30s
   - Error rate < 5%

## 🔑 Security Best Practices

1. **Never commit secrets** - Use GitHub Secrets
2. **Rotate API keys** quarterly
3. **Use different keys** for dev/prod
4. **Monitor AWS costs** - Set billing alerts
5. **Review deployments** - Require approval for production

## 🐛 Troubleshooting

### Deployment Fails

```bash
# Check GitHub Actions logs
# https://github.com/coreydylan/atlascodex/actions

# Check serverless logs
serverless logs --function api --stage dev --tail

# Validate config locally
serverless print --stage dev
```

### Lambda Timeout

```bash
# Increase timeout in serverless.yml
# Current: 60 seconds
# Max: 900 seconds (15 minutes)
```

### Vercel Build Error

```bash
# Check build logs in Vercel dashboard
# Ensure vercel.json is valid
vercel --prod --debug
```

## 📈 Performance Optimization

1. **Lambda Reserved Concurrency**: Set in serverless.yml
2. **Lambda Memory**: Currently 1024 MB
3. **API Gateway Caching**: Enable for GET requests
4. **CloudFront CDN**: For static assets

## 🎯 Next Steps

After initial setup:

1. ✅ Test development deployment
2. ✅ Test production deployment with canary
3. ✅ Verify rollback works
4. ✅ Set up monitoring alerts
5. ✅ Document team procedures

## 📞 Support

- **Deployment Issues**: Check GitHub Actions logs
- **AWS Issues**: CloudWatch logs
- **Vercel Issues**: Vercel dashboard
- **Emergency**: See `docs/RUNBOOKS/emergency-rollback.md`