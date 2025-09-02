# Development Guide 🛠️

This guide covers everything you need to know for developing with Atlas Codex.

## 🏗️ Repository Structure

```
atlas-codex/
├── packages/                    # Monorepo packages
│   ├── core/                   # Shared types and utilities
│   │   ├── src/
│   │   │   └── index.ts       # Zod schemas, utilities
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── api/                    # API server and Lambda handler  
│   │   ├── server.js          # Fastify development server
│   │   ├── handler.js         # AWS Lambda handler
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── worker/                 # GPT-5 extraction engine
│   │   ├── worker.js          # Main worker with GPT-5 integration
│   │   ├── package.json
│   │   └── Dockerfile
│   └── frontend/               # React dashboard
│       ├── src/
│       ├── package.json  
│       ├── Dockerfile
│       └── nginx.conf
├── infrastructure/             # Infrastructure as Code
│   ├── terraform/             # AWS resources
│   │   ├── main.tf
│   │   └── environments/
│   │       ├── dev.tfvars
│   │       ├── staging.tfvars
│   │       └── prod.tfvars
│   └── docker/
│       └── docker-compose.dev.yml
├── scripts/                    # Automation scripts
│   ├── setup.sh              # Environment setup
│   └── deploy.sh              # Deployment script
├── docs/                       # Documentation
│   ├── GPT5_INTEGRATION_GUIDE.md
│   ├── DEVELOPMENT_GUIDE.md
│   └── DEPLOYMENT_GUIDE.md
├── .github/workflows/          # CI/CD pipeline
│   └── ci.yml
├── .env.example               # Environment template
├── .env.dev                  # Development config
├── .env.staging              # Staging config
├── .env.prod                 # Production config
├── lerna.json                # Monorepo configuration
└── package.json              # Root package configuration
```

## 🚀 Getting Started

### Prerequisites

Ensure you have these installed:

- **Node.js 20.x or higher** - `node --version`
- **npm 9.x or higher** - `npm --version`
- **Docker & Docker Compose** - `docker --version`
- **Git** - `git --version`

For deployment:
- **AWS CLI** - `aws --version`
- **Terraform** (optional) - `terraform --version`

### Initial Setup

```bash
# Clone the repository
git clone <repo-url>
cd atlas-codex

# Run the automated setup
./scripts/setup.sh

# This script will:
# 1. Check Node.js version compatibility
# 2. Install all dependencies  
# 3. Bootstrap monorepo packages
# 4. Build core package
# 5. Copy .env.dev to .env
# 6. Start local services (Redis, LocalStack)
```

### Manual Setup (if needed)

```bash
# Install root dependencies
npm install

# Bootstrap all packages
npm run bootstrap

# Build core package (required by other packages)
cd packages/core
npm run build
cd ../..

# Set up environment
cp .env.dev .env
# Edit .env and add your OPENAI_API_KEY

# Start local services
docker-compose -f infrastructure/docker/docker-compose.dev.yml up -d redis localstack
```

## 🔧 Development Workflow

### Starting Development Environment

```bash
# Start all services in development mode
npm run dev

# This starts:
# - API server on http://localhost:3000
# - Worker process monitoring SQS
# - Frontend on http://localhost:5173
# - Redis on localhost:6379
# - LocalStack (AWS services) on localhost:4566
```

### Working with Individual Packages

```bash
# Work on core package
cd packages/core
npm run dev          # TypeScript watch mode
npm run build        # Build to dist/
npm run test         # Run tests

# Work on API  
cd packages/api
npm run dev          # Start Fastify server with hot reload
npm run test         # Run API tests

# Work on worker
cd packages/worker
npm run dev          # Start worker in development mode
node worker.js       # Run worker directly

# Work on frontend
cd packages/frontend  
npm run dev          # Start Vite dev server
npm run build        # Build for production
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run tests for specific package
cd packages/core && npm test
cd packages/api && npm test
cd packages/worker && npm test
```

### Manual Testing

```bash
# Test API endpoints
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d '{
    "url": "https://example.com",
    "scrapeOptions": {
      "formats": ["markdown", "html"]
    }
  }'

# Test GPT-5 extraction
cd packages/worker
node test-gpt5-extraction.js

# Test health endpoints
curl http://localhost:3000/health
```

## 📦 Package Management

### Adding Dependencies

```bash
# Add to root (build tools, shared devDependencies)
npm install -D typescript

# Add to specific package
cd packages/api
npm install fastify

# Add to all packages
lerna add lodash

# Add to specific packages only
lerna add react --scope="@atlas-codex/frontend"
```

### Inter-package Dependencies

```bash
# Reference other packages in package.json
{
  "dependencies": {
    "@atlas-codex/core": "^1.0.0"
  }
}

# Import in code
import { ScrapeJobSchema } from '@atlas-codex/core';
```

### Managing Versions

```bash
# Update all package versions
lerna version

# Update with conventional commits
lerna version --conventional-commits

# Publish packages (if public)
lerna publish
```

## 🔀 Git Workflow

### Branch Strategy

- `main` - Production releases
- `develop` - Development branch
- `feature/*` - Feature branches
- `hotfix/*` - Critical fixes

### Creating Features

```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/add-evidence-ledger

# Make changes and commit
git add .
git commit -m "feat: add evidence ledger system"

# Push and create PR
git push origin feature/add-evidence-ledger
# Create PR to develop branch
```

### Commit Convention

Use conventional commits:

```bash
feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting, missing semicolons, etc
refactor: code change that neither fixes a bug nor adds a feature
test: adding tests
chore: updating build tasks, package manager configs, etc
```

## 🏗️ Build Process

### Building All Packages

```bash
# Build all packages in dependency order
npm run build

# This runs:
# 1. packages/core - TypeScript compilation
# 2. packages/api - No build step (Node.js)
# 3. packages/worker - No build step (Node.js) 
# 4. packages/frontend - Vite build
```

### Package-specific Builds

```bash
# Core package (TypeScript)
cd packages/core
npm run build        # Compiles src/ to dist/
npm run dev         # Watch mode

# Frontend package (Vite)
cd packages/frontend
npm run build       # Creates dist/ folder
npm run preview     # Preview production build
```

## 🐳 Docker Development

### Local Development with Docker

```bash
# Start all services with Docker
docker-compose -f infrastructure/docker/docker-compose.dev.yml up

# Start specific services
docker-compose -f infrastructure/docker/docker-compose.dev.yml up redis localstack

# View logs
docker-compose logs -f worker
docker-compose logs -f api

# Rebuild services
docker-compose build worker
docker-compose up -d worker
```

### Building Production Images

```bash
# Build worker image
cd packages/worker
docker build -t atlas-codex-worker .

# Build API image  
cd packages/api
docker build -t atlas-codex-api .

# Build frontend image
cd packages/frontend
docker build -t atlas-codex-frontend .
```

## 🌍 Environment Management

### Environment Files

- `.env` - Local development (copied from .env.dev)
- `.env.dev` - Development defaults with LocalStack
- `.env.staging` - Staging environment with real AWS
- `.env.prod` - Production environment with monitoring

### Key Environment Variables

```bash
# Core settings
NODE_ENV=development
LOG_LEVEL=debug

# OpenAI API
OPENAI_API_KEY=sk-...

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=790856971687

# Database Tables
DYNAMODB_JOBS_TABLE=atlas-codex-jobs-dev
DYNAMODB_DIPS_TABLE=atlas-codex-dips-dev
DYNAMODB_EVIDENCE_TABLE=atlas-codex-evidence-dev

# Feature Flags
ENABLE_GPT5=true
ENABLE_EVIDENCE_LEDGER=true
ENABLE_DIPS=true

# Cost Controls
MAX_LLM_PERCENT=0.25
MAX_COST_PER_PAGE=0.01
```

### Switching Environments

```bash
# Switch to staging
cp .env.staging .env

# Switch back to development  
cp .env.dev .env

# Or use environment-specific commands
NODE_ENV=staging npm run dev
```

## 🔧 Debugging

### Debug Modes

```bash
# Enable debug logging
export LOG_LEVEL=debug
npm run dev

# Debug specific components
export DEBUG=worker,api
npm run dev

# Debug GPT-5 calls
export DEBUG_GPT5=true
cd packages/worker && node worker.js
```

### Common Debug Scenarios

**API not responding**
```bash
# Check if services are running
curl http://localhost:3000/health
docker-compose ps

# Check logs
docker-compose logs api
```

**Worker not processing jobs**
```bash
# Check worker logs
docker-compose logs worker

# Check SQS queue
aws sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/atlas-codex-jobs-dev \
  --attribute-names ApproximateNumberOfMessages
```

**GPT-5 API errors**
```bash
# Check API key is set
echo $OPENAI_API_KEY

# Test GPT-5 connection
cd packages/worker
node -e "
const OpenAI = require('openai');
const client = new OpenAI();
client.models.list().then(console.log).catch(console.error);
"
```

**Database connection issues**
```bash
# Check LocalStack is running
curl http://localhost:4566/health

# List DynamoDB tables
aws dynamodb list-tables --endpoint-url http://localhost:4566
```

## 📊 Code Quality

### Linting and Formatting

```bash
# Run linting across all packages
npm run lint

# Fix linting issues
npm run lint -- --fix

# Type checking
npm run typecheck
```

### Pre-commit Hooks

Set up pre-commit hooks to ensure code quality:

```bash
# Install husky
npm install -D husky

# Set up pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm run typecheck"
```

### Code Style Guidelines

- Use TypeScript for new code when possible
- Follow existing code patterns in each package
- Add JSDoc comments for public APIs
- Use Zod schemas for data validation
- Implement proper error handling with try/catch

## 🚀 Performance Optimization

### Development Performance

```bash
# Use Docker for consistent environment
npm run docker:up

# Enable Node.js performance monitoring
NODE_ENV=development npm run dev

# Monitor memory usage
node --inspect packages/worker/worker.js
```

### Profiling

```bash
# Profile API endpoints
curl -w "@curl-format.txt" -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Profile worker processing
time node packages/worker/worker.js
```

## 🔐 Security Best Practices

### Secrets Management

```bash
# Never commit real API keys
# Use .env files (which are gitignored)
# In production, use AWS Secrets Manager or similar
```

### Container Security

```bash
# Run containers as non-root user (already configured)
# Regularly update base images
# Use multi-stage builds to minimize attack surface
```

### API Security

```bash
# Always require API keys for production
# Rate limit requests (configured in api/server.js)
# Validate all inputs with Zod schemas
```

## 📚 Learning Resources

### Atlas Codex Specific

- [GPT-5 Integration Guide](./GPT5_INTEGRATION_GUIDE.md) - Detailed GPT-5 usage
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Production deployment
- [API Reference](./API_REFERENCE.md) - Complete API documentation

### External Resources

- [Lerna Documentation](https://lerna.js.org/) - Monorepo management
- [Fastify Documentation](https://fastify.dev/) - API framework
- [Playwright Documentation](https://playwright.dev/) - Browser automation
- [OpenAI API Documentation](https://platform.openai.com/docs/) - GPT-5 API

## 🆘 Getting Help

### Troubleshooting Steps

1. **Check the logs** - `docker-compose logs <service>`
2. **Verify environment variables** - `printenv | grep ATLAS`
3. **Test individual components** - Use curl/manual testing
4. **Check service health** - `curl http://localhost:3000/health`
5. **Restart services** - `docker-compose restart`

### Common Issues and Solutions

**"Module not found" errors**
```bash
# Clean and reinstall
npm run clean
npm install
npm run bootstrap
```

**"Permission denied" on scripts**
```bash
chmod +x scripts/setup.sh
chmod +x scripts/deploy.sh
```

**Port already in use**
```bash
# Find and kill process
lsof -ti:3000 | xargs kill
```

### Support Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and community support
- **Documentation** - Check docs/ folder for detailed guides