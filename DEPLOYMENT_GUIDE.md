# Atlas Codex - Complete Git-Based Deployment Guide

## 🎯 Overview
Atlas Codex now uses **100% Git-based deployments** with full version control. Every component (ECS services, Lambda functions, and frontend) automatically deploys via GitHub Actions when you push to specific branches.

## 🏗️ Architecture

### Dual Deployment System
- **ECS Services**: Containerized applications (API, Worker, Frontend)
- **Lambda Functions**: Serverless API for immediate response and compatibility

### Environment Strategy
- **`main` branch** → **Staging Environment**
- **`production` branch** → **Production Environment**
- **Feature branches** → Run tests only (no deployment)

## 🚀 Deployment Workflow

### Staging Deployment (main branch)
```bash
git checkout main
git merge feature-branch
git push origin main
```

**Triggers:**
1. ✅ Run tests and linting
2. 🐳 Build and push Docker images
3. ⚡ Deploy Lambda to staging
4. 🏗️ Deploy ECS services to staging
5. 🧪 Run health checks

### Production Deployment (production branch)
```bash
git checkout production
git merge main  # Promote staging to production
git push origin production
```

**Triggers:**
1. ✅ Run tests and linting
2. 🐳 Build and push Docker images
3. ⚡ Deploy Lambda to production
4. 🏗️ Deploy ECS services to production
5. 🧪 Run comprehensive smoke tests
6. 📱 Send Slack notification

## 🔐 Required GitHub Secrets

### AWS Credentials
```
AWS_ACCESS_KEY_ID          # Main AWS access key
AWS_SECRET_ACCESS_KEY      # Main AWS secret key
```

### API Keys
```
OPENAI_API_KEY            # OpenAI API for extraction processing
MASTER_API_KEY_STAGING    # API key for staging environment
MASTER_API_KEY_PRODUCTION # API key for production environment
```

### Notifications
```
SLACK_WEBHOOK             # Slack webhook for deployment notifications
```

### Docker Registry
```
DOCKER_USERNAME           # Docker Hub username
DOCKER_PASSWORD           # Docker Hub password/token
```

## 📋 Environment Configuration

### Staging Environment
- **ECS Cluster**: `atlas-staging`
- **Lambda Stage**: `staging`
- **API Gateway**: `https://{api-id}.execute-api.us-west-2.amazonaws.com/staging`

### Production Environment
- **ECS Cluster**: `atlas-production`
- **Lambda Stage**: `production`
- **API Gateway**: `https://{api-id}.execute-api.us-west-2.amazonaws.com/production`

## 🔄 Deployment Process

### 1. Code Changes
```bash
# Create feature branch
git checkout -b feature/improved-extraction
# Make changes, commit
git commit -m "feat: improve extraction accuracy"
# Push for testing
git push origin feature/improved-extraction
```

### 2. Staging Deployment
```bash
# Merge to main for staging deployment
git checkout main
git merge feature/improved-extraction
git push origin main  # 🚀 Auto-deploys to staging
```

### 3. Production Deployment
```bash
# After testing staging, promote to production
git checkout production
git merge main
git push origin production  # 🚀 Auto-deploys to production
```

## 🧪 Health Checks & Monitoring

### Automatic Health Checks
- **Lambda Health**: `GET /health` endpoint
- **ECS Services**: Service stability checks
- **API Gateway**: Response validation
- **Frontend**: Page load validation

### Manual Testing
```bash
# Test staging
curl https://api-id.execute-api.us-west-2.amazonaws.com/staging/health

# Test production
curl https://api-id.execute-api.us-west-2.amazonaws.com/production/health
```

## 🔒 Security Best Practices

### Version Control
- ✅ All changes tracked in Git
- ✅ Branch protection on `main` and `production`
- ✅ Required reviews for production changes
- ✅ Signed commits for security

### Secrets Management
- ✅ All secrets stored in GitHub Secrets
- ✅ No hardcoded credentials in code
- ✅ Environment-specific API keys
- ✅ Encrypted environment variables

### Deployment Security
- ✅ IAM roles with minimal permissions
- ✅ Separate staging/production AWS accounts
- ✅ Audit logging for all deployments
- ✅ Rollback capability via Git

## 📊 Monitoring & Rollback

### Deployment Status
- **GitHub Actions**: Full deployment logs and status
- **AWS CloudWatch**: Service and function metrics
- **Slack**: Real-time deployment notifications

### Rollback Strategy
```bash
# Emergency rollback via Git
git checkout production
git revert HEAD  # Revert last commit
git push origin production  # Auto-deploys previous version

# Or rollback to specific version
git reset --hard {previous-commit-hash}
git push --force-with-lease origin production
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Failed Lambda Deployment
```bash
# Check serverless.yml configuration
# Verify AWS credentials in secrets
# Check CloudWatch logs for errors
```

#### 2. ECS Service Deployment Issues
```bash
# Check task definition compatibility
# Verify Docker image availability
# Check service capacity and resources
```

#### 3. Build Failures
```bash
# Check test results in GitHub Actions
# Verify package.json dependencies
# Check Docker build logs
```

### Debug Commands
```bash
# View deployment logs
gh run list
gh run view {run-id}

# Check service status
aws ecs describe-services --cluster atlas-staging --services atlas-api
```

## 📈 Best Practices

### Development Workflow
1. **Feature branches**: Always work in feature branches
2. **Small commits**: Make atomic, focused commits
3. **Clear messages**: Use conventional commit messages
4. **Test locally**: Run tests before pushing
5. **Review changes**: Use pull requests for main/production

### Deployment Practices
1. **Staging first**: Always test in staging before production
2. **Monitor deployments**: Watch health checks and logs
3. **Quick rollbacks**: Be ready to rollback if issues arise
4. **Document changes**: Update documentation with each release

### Version Control
1. **Tag releases**: Tag production deployments
2. **Clean history**: Squash feature commits when merging
3. **Protect branches**: Use branch protection rules
4. **Sign commits**: Use GPG signing for security

## 🎉 Benefits

### Developer Experience
- **One-click deployments**: Just push to deploy
- **Full automation**: No manual deployment steps
- **Consistent environments**: Same process for all stages
- **Easy rollbacks**: Git-based version control

### Operations
- **Audit trail**: Complete deployment history in Git
- **Security**: No manual credential handling
- **Reliability**: Automated testing and health checks
- **Scalability**: Easy to add new environments

### Business
- **Faster releases**: Automated deployment pipeline
- **Lower risk**: Tested staging before production
- **Better uptime**: Quick rollbacks and health monitoring
- **Cost efficient**: No manual deployment overhead

---

## 🚀 Ready to Deploy!

Your Atlas Codex project now has enterprise-grade Git-based deployments with:

✅ **Automated CI/CD pipeline**
✅ **Multi-environment support**
✅ **Security best practices**
✅ **Health monitoring**
✅ **Easy rollbacks**
✅ **Full audit trail**

Just push your code and watch it deploy automatically!