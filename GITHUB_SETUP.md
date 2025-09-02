# GitHub Repository Setup Guide

## Create Repository

1. **Go to GitHub and create a new repository**:
   - Repository name: `atlas-codex`
   - Description: "Drop-in Hyperbrowser replacement with GPT-5 intelligence and Domain Intelligence Profiles (DIPs)"
   - Private repository (initially)
   - Do NOT initialize with README, .gitignore, or license

2. **After creating, run these commands**:

```bash
# Add the remote repository
git remote add origin https://github.com/YOUR_USERNAME/atlas-codex.git

# Push develop branch
git checkout develop
git push -u origin develop

# Push main branch  
git checkout main
git push -u origin main

# Set main as default branch on GitHub
# Go to Settings → Branches → Default branch → Change to 'main'
```

## Configure Branch Protection

In GitHub repository settings:

### Main Branch Protection
1. Go to Settings → Branches
2. Add rule for `main`:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators
   - ✅ Restrict who can push to matching branches

### Develop Branch Protection
1. Add rule for `develop`:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging

## Configure Secrets

In Settings → Secrets and variables → Actions, add:

```
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
OPENAI_API_KEY=<your-openai-key>
DATADOG_API_KEY=<optional>
SENTRY_DSN=<optional>
```

## Enable GitHub Actions

1. Go to Actions tab
2. Enable workflows
3. The CI/CD pipeline will run automatically on push

## Webhook Configuration (Optional)

For deployment notifications:

1. Settings → Webhooks → Add webhook
2. Payload URL: Your monitoring endpoint
3. Content type: application/json
4. Events: Push, Pull Request, Deployment

## Team Access (if applicable)

1. Settings → Manage access
2. Invite collaborators
3. Set appropriate permissions:
   - Write: Developers
   - Admin: DevOps/Lead
   - Read: Stakeholders

## After Setup Complete

Verify everything is working:

```bash
# Test push to develop
git checkout develop
echo "# Test" >> TEST.md
git add TEST.md
git commit -m "test: verify CI/CD pipeline"
git push origin develop

# Check GitHub Actions tab for pipeline execution
# Should see test, build, and deploy-dev jobs running

# Clean up test file
git rm TEST.md
git commit -m "chore: remove test file"
git push origin develop
```

## Local Development After GitHub Setup

```bash
# Ensure you're on develop for new features
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/dip-infrastructure

# Make changes, then push
git add .
git commit -m "feat: add DIP infrastructure"
git push origin feature/dip-infrastructure

# Create Pull Request on GitHub
# Target: develop branch
```

## Production Deployment

For production deployments, merge to main with `[PROD]` tag:

```bash
git checkout main
git merge develop
git commit -m "release: v1.1.0 [PROD]"
git push origin main
```

This will trigger the production deployment pipeline.