# Contributing to Atlas Codex

## 🚀 Development Workflow

### Branch Strategy

```
stable-production (protected)
    ↑
    main (staging)
    ↑  
    feature/your-feature
```

- **`stable-production`**: Protected branch, production code only
- **`main`**: Development/staging branch
- **Feature branches**: `feature/`, `fix/`, `docs/` prefixes

### Making Changes

1. **Create feature branch from main**
```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

2. **Make changes and test locally**
```bash
npm test                        # Run unit tests
bash scripts/test-stable.sh    # Run golden tests
```

3. **Commit with conventional commits**
```bash
git add .
git commit -m "feat: add new extraction feature"
# Types: feat, fix, docs, style, refactor, test, chore
```

4. **Push and create PR**
```bash
git push origin feature/your-feature-name
# Create PR on GitHub to main branch
```

5. **After PR approval and merge to main**
- Automatic deployment to staging
- Run staging tests
- Create PR from main to stable-production for production deploy

## 🛠 Local Development Setup

### Prerequisites

- Node.js 20.x LTS (use `nvm use 20`)
- AWS CLI configured (`aws configure`)
- npm 10.x

### Installation

```bash
# Clone repository
git clone https://github.com/coreydylan/atlascodex.git
cd atlascodex

# Install dependencies (use ci for exact versions)
npm ci

# Set up environment
cp .env.example .env
# Edit .env and add your API keys (NEVER commit this file!)
```

### Environment Variables

Create `.env` file (gitignored):
```bash
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
MASTER_API_KEY=test-key-123
UNIFIED_EXTRACTOR_ENABLED=true
AWS_PROFILE=default
STAGE=dev
```

## 🧪 Testing

### Test Types

```bash
npm test                    # Unit tests (fast)
npm run test:integration   # Integration tests with fixtures
npm run test:smoke        # Live API tests (requires keys)
bash scripts/test-stable.sh # Golden tests for stability
```

### Before Committing

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Type check (when TypeScript is added)
npm run typecheck

# Run all tests
npm run test:all
```

## 📝 Code Standards

### JavaScript/Node.js

- ES6+ features
- Async/await over callbacks
- Descriptive variable names
- JSDoc comments for functions

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Code style (formatting, semicolons)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

### File Organization

```
atlas-codex/
├── api/                 # Lambda functions
│   ├── lambda.js       # Main API handler
│   ├── evidence-first-bridge.js  # Extraction engine
│   └── worker-enhanced.js        # Processing logic
├── scripts/            # Utility scripts
├── tests/              # Test files
├── docs/               # Documentation
└── serverless.yml      # AWS configuration
```

## 🔐 Security

### NEVER Commit:

- API keys or tokens
- AWS credentials  
- Personal information
- `.env` files
- Passwords or secrets

### Use Instead:

- AWS SSM Parameter Store for production
- Environment variables for local dev
- `.env.example` with dummy values

### Security Checklist:

- [ ] No hardcoded secrets
- [ ] API keys in environment variables
- [ ] Validated all user inputs
- [ ] Sanitized outputs
- [ ] Rate limiting considered
- [ ] Error messages don't leak sensitive info

## 🚢 Deployment Process

### To Staging (main branch)

1. Merge PR to main
2. Automatic deployment via GitHub Actions
3. Verify at staging URL
4. Run staging tests

### To Production (stable-production)

1. Create PR from main to stable-production
2. Require approval from maintainer
3. Automatic canary deployment (10% → 100%)
4. Monitor CloudWatch for errors
5. Rollback if needed (see docs/RUNBOOKS)

## 📊 Monitoring

### Key Metrics to Watch

- Error rate < 5%
- p95 latency < 30s
- Successful extractions > 95%
- Lambda memory usage < 80%

### Where to Monitor

- CloudWatch Dashboards
- Lambda function metrics
- API Gateway metrics
- Application logs

## 🆘 Getting Help

### Documentation

- `README.md` - Overview and quick start
- `STABLE_VERSION.md` - Current stable configuration
- `docs/RUNBOOKS/` - Emergency procedures
- `docs/API.md` - API documentation

### Support Channels

- GitHub Issues for bugs
- GitHub Discussions for questions
- Slack channel (if applicable)

## 📜 License

This project is proprietary. See LICENSE file.

## 🙏 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Document your work