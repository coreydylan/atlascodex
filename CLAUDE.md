# Atlas Codex - Claude Code Development Guide

> **Comprehensive development workflow and best practices for Claude Code when working with Atlas Codex**

This document provides Claude Code with specific instructions for developing, testing, and deploying features in the Atlas Codex project. Follow these guidelines for efficient and safe development.

## 🚨 CRITICAL: GPT-5 Migration in Progress

**BEFORE TOUCHING ANY AI/LLM OPERATIONS:**

1. **MUST READ FIRST**: Review the complete GPT-5 documentation in `/gpt5-training/`
   - [GPT-5 Training Center](./gpt5-training/README.md) - Core concepts and capabilities
   - [Refactoring Report](./gpt5-training/REFACTORING_REPORT.md) - Current state analysis
   - [Migration Guide](./gpt5-training/migration-guide/step-by-step.md) - Implementation steps
   - [Extraction Patterns](./gpt5-training/cookbook-examples/extraction-patterns.js) - Code patterns

2. **Current AI Operations Status**:
   - GPT-4 Turbo in `api/ai-processor.js` - MIGRATING TO GPT-5
   - GPT-4o in `api/evidence-first-bridge.js` - MIGRATING TO GPT-5
   - Cost optimization through tiered GPT-5 models (nano/mini/full)

3. **GPT-5 Model Selection Guide**:
   ```javascript
   // Use GPT-5-nano ($0.05/1M input) for:
   - Simple extractions < 5000 chars
   - Basic text processing
   - High-volume operations
   
   // Use GPT-5-mini ($0.25/1M input) for:
   - Standard extractions
   - Moderate complexity
   - Cost-performance balance
   
   // Use GPT-5 ($1.25/1M input) for:
   - Complex reasoning tasks
   - Multi-page analysis
   - High-accuracy requirements
   ```

4. **Migration Checklist**:
   - [ ] Check GPT-5 documentation first
   - [ ] Use model selector service
   - [ ] Implement fallback chain
   - [ ] Enable reasoning mode when needed
   - [ ] Test with all three model tiers
   - [ ] Monitor cost metrics

## Repository Overview

Atlas Codex is a production-ready AI-powered web extraction platform with the following architecture:

- **Backend**: AWS Lambda functions (Node.js 20.x)
- **Frontend**: React + Vite + TypeScript (deployed on Vercel)
- **Database**: DynamoDB for jobs, S3 for artifacts
- **CI/CD**: GitHub Actions with automated deployment pipeline
- **Monitoring**: CloudWatch logs and metrics

## Development Workflow for Claude Code

### 1. Getting Started

Before making any changes, understand the current project structure:

```bash
# Get current working directory and repository status
pwd
git status
git branch -a

# Check if there are any running background processes
# Kill any unnecessary background processes first
```

### 2. Feature Development with Git Worktrees

**Always use git worktrees for new features to avoid conflicts:**

```bash
# 1. Create a new feature branch using git worktree
git worktree add ../atlas-feature-name feature/feature-name

# 2. Switch to the new worktree directory
cd ../atlas-feature-name

# 3. Install dependencies in the isolated environment
npm install
npm run bootstrap

# 4. Verify the development environment
npm run typecheck
npm run lint
```

### 3. Branch Naming Conventions

Use these prefixes for branches:

- `feature/` - New features (e.g., `feature/multi-page-extraction`)
- `fix/` - Bug fixes (e.g., `fix/websocket-connection-error`)
- `docs/` - Documentation updates (e.g., `docs/api-reference-update`)
- `refactor/` - Code refactoring (e.g., `refactor/extraction-engine`)
- `test/` - Test improvements (e.g., `test/accuracy-regression`)

### 4. Development Best Practices

#### Code Quality Checklist
- [ ] Run `npm run lint` before committing
- [ ] Run `npm run typecheck` for TypeScript validation
- [ ] Test changes with `npm run test`
- [ ] Test extraction functionality with `npm run test:unified-extractor`
- [ ] Validate production readiness with `npm run validate:production-ready`

#### File Modification Guidelines

**Backend Development:**
```bash
# Main API handler
/Users/coreydylan/Developer/atlascodex/api/lambda.js

# Unified extraction engine (core logic)
/Users/coreydylan/Developer/atlascodex/api/evidence-first-bridge.js

# Worker functions for background processing
/Users/coreydylan/Developer/atlascodex/api/worker-enhanced.js

# WebSocket connection handlers
/Users/coreydylan/Developer/atlascodex/api/websocket.js

# Worker templates
/Users/coreydylan/Developer/atlascodex/api/templates/
```

**Frontend Development:**
```bash
# Main React application
/Users/coreydylan/Developer/atlascodex/packages/frontend/src/App.tsx

# React components
/Users/coreydylan/Developer/atlascodex/packages/frontend/src/components/

# Frontend package configuration
/Users/coreydylan/Developer/atlascodex/packages/frontend/package.json
```

### 5. Testing Strategy

#### Local Testing
```bash
# 1. Run all tests
npm run test
npm run lint
npm run typecheck

# 2. Test frontend locally
cd packages/frontend
npm run dev
# Frontend available at http://localhost:5173

# 3. Test API endpoints
curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health

# 4. Test extraction functionality
npm run test:unified-extractor:enabled

# 5. Validate extraction accuracy
npm run test:accuracy:critical
```

#### API Testing
```bash
# Health check
curl -f https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health

# Basic extraction test
curl -X POST https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key-123" \
  -d '{
    "url": "https://example.com",
    "extractionInstructions": "Extract title and description",
    "UNIFIED_EXTRACTOR_ENABLED": true
  }'
```

### 6. Deployment Process

#### Development Environment Deployment

The main branch automatically deploys to development. To test changes:

```bash
# 1. Commit changes
git add .
git commit -m "feat: add new extraction feature"

# 2. Push to feature branch for PR
git push origin feature/feature-name

# 3. Create pull request
gh pr create --title "Add new extraction feature" --body "Description of changes"

# 4. Once merged to main, deployment is automatic
```

#### Manual Development Deployment (if needed)
```bash
# Deploy to development environment
npm run deploy:dev

# Monitor deployment
aws logs tail /aws/lambda/atlas-codex-dev-api --follow --since 2m
```

### 7. Production Deployment

Production deployments use the production branch with canary rollouts:

```bash
# 1. Merge main to production branch
git checkout production
git merge main
git push origin production

# 2. Monitor deployment via GitHub Actions
gh run list --workflow=deploy.yml

# 3. Watch deployment progress
gh run watch [RUN_ID] --exit-status
```

### 8. Monitoring and Troubleshooting

#### CloudWatch Logs
```bash
# Development logs
aws logs tail /aws/lambda/atlas-codex-dev-api --follow

# Production logs
aws logs tail /aws/lambda/atlas-codex-prod-api --follow

# Filter for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/atlas-codex-dev-api \
  --filter-pattern "ERROR"
```

#### Health Checks
```bash
# Development health
curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health

# Production health
curl https://atlas-codex-api.com/health
```

### 9. Pull Request Process

#### Before Creating PR
- [ ] All tests pass locally
- [ ] Code follows existing patterns
- [ ] Documentation updated if needed
- [ ] No sensitive information in code
- [ ] Extraction accuracy tests pass

#### PR Creation
```bash
# Create PR with comprehensive description
gh pr create \
  --title "feat: implement multi-page extraction enhancement" \
  --body "$(cat <<'EOF'
## Summary
- Added support for dynamic pagination detection
- Improved extraction accuracy for large datasets
- Added timeout handling for slow responses

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass  
- [ ] Manual testing completed
- [ ] Accuracy regression tests pass

## Deployment
- [ ] Safe for development deployment
- [ ] No breaking changes
- [ ] Environment variables unchanged
EOF
)"
```

### 10. Emergency Procedures

#### Rollback Production
```bash
# Trigger emergency rollback
gh workflow run deploy.yml

# Or manual rollback to stable version
aws lambda update-alias \
  --function-name atlas-codex-prod-api \
  --name prod \
  --function-version 45
```

#### Debug Production Issues
```bash
# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=atlas-codex-prod-api \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# View recent error logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/atlas-codex-prod-api \
  --start-time $(date -d '30 minutes ago' +%s)000 \
  --filter-pattern "ERROR"
```

## File Structure Reference

### Key Files to Understand

```bash
# Configuration Files
/Users/coreydylan/Developer/atlascodex/serverless.yml          # AWS deployment config
/Users/coreydylan/Developer/atlascodex/package.json           # Root dependencies
/Users/coreydylan/Developer/atlascodex/deploy-production.sh   # Production deployment script

# GitHub Actions
/Users/coreydylan/Developer/atlascodex/.github/workflows/deploy.yml  # Main CI/CD pipeline
/Users/coreydylan/Developer/atlascodex/.github/workflows/ci.yml       # Legacy CI config

# Frontend
/Users/coreydylan/Developer/atlascodex/packages/frontend/package.json # Frontend dependencies
/Users/coreydylan/Developer/atlascodex/packages/frontend/src/App.tsx  # Main React component

# Backend API
/Users/coreydylan/Developer/atlascodex/api/lambda.js                  # Main request handler
/Users/coreydylan/Developer/atlascodex/api/evidence-first-bridge.js   # Core extraction engine
/Users/coreydylan/Developer/atlascodex/api/worker-enhanced.js         # Background worker
```

### Environment Variables

```bash
# Required for deployment
OPENAI_API_KEY=sk-xxx...
MASTER_API_KEY=your-api-key
UNIFIED_EXTRACTOR_ENABLED=true

# AWS Credentials (for GitHub Actions)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
```

## Common Tasks for Claude Code

### Adding New Extraction Features

1. **Modify core extraction logic:**
   ```bash
   # Edit the main extraction engine
   vim /Users/coreydylan/Developer/atlascodex/api/evidence-first-bridge.js
   
   # Key functions to update:
   # - shouldUseMultiPageExtraction()
   # - performNavigationAwareExtraction()
   # - extractDataFromPage()
   ```

2. **Add new navigation patterns:**
   ```bash
   # Update navigation detection patterns
   # Look for: pagination detection, link following, content extraction
   ```

3. **Test the changes:**
   ```bash
   npm run test:unified-extractor:enabled
   npm run test:accuracy:critical
   ```

### Frontend Component Updates

1. **Add new UI components:**
   ```bash
   # Create new component
   vim /Users/coreydylan/Developer/atlascodex/packages/frontend/src/components/NewComponent.tsx
   
   # Update main app
   vim /Users/coreydylan/Developer/atlascodex/packages/frontend/src/App.tsx
   ```

2. **Test frontend changes:**
   ```bash
   cd packages/frontend
   npm run dev
   npm run build
   npm run typecheck
   ```

### API Endpoint Changes

1. **Add new endpoints:**
   ```bash
   # Update main handler
   vim /Users/coreydylan/Developer/atlascodex/api/lambda.js
   
   # Follow existing patterns for error handling
   # Update API documentation in README.md
   ```

2. **Test new endpoints:**
   ```bash
   # Deploy to development
   npm run deploy:dev
   
   # Test with curl
   curl -X POST https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/new-endpoint
   ```

## Security Guidelines

1. **Never commit sensitive information:**
   - API keys should use environment variables
   - No hardcoded credentials in source code
   - Use GitHub secrets for deployment

2. **Validate all inputs:**
   - Use existing validation patterns
   - Sanitize user inputs
   - Follow AJV schema validation patterns

3. **Error handling:**
   - Don't expose internal errors to users
   - Log errors to CloudWatch
   - Use existing error handling patterns

## Performance Guidelines

1. **Lambda optimization:**
   - Keep cold start time minimal
   - Use connection pooling where possible
   - Optimize package size

2. **Frontend optimization:**
   - Use React best practices
   - Minimize bundle size
   - Optimize component re-renders

3. **Extraction efficiency:**
   - Set appropriate timeouts
   - Use pagination wisely
   - Cache results when possible

## Troubleshooting Common Issues

### Deployment Failures
```bash
# Check GitHub Actions logs
gh run list --workflow=deploy.yml
gh run view [RUN_ID] --log

# Check AWS deployment logs
aws logs tail /aws/lambda/atlas-codex-dev-api --since 10m
```

### Extraction Failures
```bash
# Test with debug logging
UNIFIED_EXTRACTOR_ENABLED=true node test-unified-extractor-enabled.js

# Check extraction patterns
curl -X POST https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key-123" \
  -d '{"url":"https://test-site.com","extractionInstructions":"debug test"}'
```

### Frontend Issues
```bash
# Check frontend logs
cd packages/frontend
npm run dev

# Build issues
npm run build
npm run typecheck
```

---

**Remember**: Always use git worktrees for feature development, test thoroughly, and follow the CI/CD pipeline for deployments. When in doubt, check the README.md for additional context and the deployment pipeline status in GitHub Actions.