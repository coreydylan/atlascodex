# Atlas Codex Documentation 📚

Welcome to the Atlas Codex documentation. This directory contains comprehensive guides for developing, deploying, and maintaining the Atlas Codex platform.

## 📖 Documentation Structure

### Core Guides

| Document | Description | Audience |
|----------|-------------|----------|
| [**README.md**](../README.md) | Project overview and quick start | All users |
| [**GPT-5 Integration Guide**](./GPT5_INTEGRATION_GUIDE.md) | Detailed GPT-5 API specifications and best practices | Developers |
| [**Development Guide**](./DEVELOPMENT_GUIDE.md) | Complete development workflow and tooling | Developers |
| [**API Reference**](./API_REFERENCE.md) | Complete API documentation with examples | API users |
| [**Deployment Guide**](./DEPLOYMENT_GUIDE.md) | Production deployment procedures | DevOps/SysAdmin |

## 🎯 Quick Navigation

### For Developers

**Getting Started:**
1. [Project Overview](../README.md#architecture-overview) - Understand the system
2. [Development Setup](./DEVELOPMENT_GUIDE.md#getting-started) - Set up your environment
3. [GPT-5 Integration](./GPT5_INTEGRATION_GUIDE.md#critical-parameter-changes) - Learn the AI system

**Building Features:**
1. [Repository Structure](./DEVELOPMENT_GUIDE.md#repository-structure) - Navigate the codebase
2. [Package Management](./DEVELOPMENT_GUIDE.md#package-management) - Work with monorepo
3. [Testing Guide](./DEVELOPMENT_GUIDE.md#testing) - Ensure code quality

### For API Users

**Integration:**
1. [API Reference](./API_REFERENCE.md#endpoints) - Complete endpoint documentation
2. [Authentication](./API_REFERENCE.md#authentication) - API key setup
3. [SDKs](./API_REFERENCE.md#sdks-and-integrations) - Language-specific libraries

**Use Cases:**
1. [Scraping](./API_REFERENCE.md#scraping) - Single page extraction
2. [AI Extraction](./API_REFERENCE.md#ai-extraction) - Structured data with GPT-5
3. [Crawling](./API_REFERENCE.md#web-crawling) - Multi-page workflows

### For DevOps/Deployment

**Environments:**
1. [Local Development](./DEPLOYMENT_GUIDE.md#local-development-deployment) - Docker setup
2. [Staging Deployment](./DEPLOYMENT_GUIDE.md#staging-deployment) - Testing environment  
3. [Production Deployment](./DEPLOYMENT_GUIDE.md#production-deployment) - Live environment

**Infrastructure:**
1. [Container Deployments](./DEPLOYMENT_GUIDE.md#container-deployments) - Docker/K8s
2. [Serverless Deployment](./DEPLOYMENT_GUIDE.md#serverless-deployment) - Lambda/Vercel
3. [Monitoring](./DEPLOYMENT_GUIDE.md#monitoring-and-logging) - Observability

## 🔍 Key Topics

### GPT-5 Integration

**Critical Changes in GPT-5:**
- ❌ `temperature`, `top_p` parameters no longer supported
- ✅ Use `verbosity` and `reasoning_effort` instead
- 🎯 Dynamic model selection (nano/mini/standard)
- 💰 Context caching for 90% cost savings

**Quick Reference:**
```javascript
// ✅ Correct GPT-5 usage
{
  model: 'gpt-5-nano',
  verbosity: 'low',
  reasoning_effort: 'minimal'
}

// ❌ Will cause API errors
{
  model: 'gpt-5',
  temperature: 0.7  // Unsupported parameter
}
```

### Architecture Philosophy

**"GPT-5 on a Leash":**
- **Evidence-First**: Cryptographic verification of all extractions
- **Cost Router**: Hard limits (<15% LLM usage) with hybrid approach
- **Domain Intelligence Profiles (DIPs)**: Learn optimal strategies per domain
- **Deterministic Rails**: DOM-first extraction, LLM fallback only when needed

### Development Workflow

**Monorepo Structure:**
```
packages/
├── core/      # Shared types and utilities
├── api/       # Fastify server + Lambda handler
├── worker/    # GPT-5 extraction engine
└── frontend/  # React dashboard
```

**Key Commands:**
```bash
npm run dev           # Start all services
npm run build         # Build all packages
npm run test          # Run all tests
./scripts/deploy.sh   # Deploy to environment
```

## 🚨 Important Notes

### Cost Management

**Environment Limits:**
- **Development**: 25% LLM usage, $0.01/page max
- **Staging**: 20% LLM usage, $0.005/page max  
- **Production**: 15% LLM usage, $0.002/page max

### GPT-5 Best Practices

**Model Selection:**
- **GPT-5-nano**: Simple extraction, 1-3 seconds, ~$0.001/call
- **GPT-5-mini**: Standard processing, 5-10 seconds, ~$0.01/call
- **GPT-5**: Complex analysis, 15-30 seconds, ~$0.05/call

**Performance Tips:**
- Structure prompts for context caching (90% cost reduction)
- Use appropriate `reasoning_effort` for task complexity
- Implement robust error handling with exponential backoff

### Security Guidelines

**API Keys:**
- Never commit real keys to repository
- Use environment variables or AWS Secrets Manager
- Rotate keys regularly

**Container Security:**
- Run as non-root user (configured in Dockerfiles)
- Use minimal base images (Alpine Linux)
- Regular security updates

## 🛠️ Troubleshooting

### Common Issues

**"Unsupported parameter" GPT-5 Error:**
```bash
# Problem: Using deprecated OpenAI parameters
# Solution: Use GPT-5 specific parameters (verbosity, reasoning_effort)
```

**LocalStack Connection Issues:**
```bash
# Check if LocalStack is running
docker-compose ps
curl http://localhost:4566/health
```

**Package Dependencies:**
```bash
# Clean and reinstall
npm run clean
npm install
npm run bootstrap
```

### Getting Help

1. **Check documentation** - Start with relevant guide above
2. **Search issues** - GitHub issues for known problems
3. **Debug logs** - Enable debug mode with `LOG_LEVEL=debug`
4. **Test components** - Isolate issues with manual testing

## 📚 External Resources

### Technologies Used

- **[Lerna](https://lerna.js.org/)** - Monorepo management
- **[Fastify](https://fastify.dev/)** - High-performance API framework
- **[Playwright](https://playwright.dev/)** - Browser automation
- **[OpenAI API](https://platform.openai.com/docs/)** - GPT-5 integration
- **[Terraform](https://terraform.io/)** - Infrastructure as Code
- **[AWS Services](https://docs.aws.amazon.com/)** - Cloud infrastructure

### Learning Resources

- **[GPT-5 API Documentation](https://platform.openai.com/docs/api-reference)** - Latest API changes
- **[AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)** - Serverless optimization
- **[Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)** - Container optimization

## 🔄 Keeping Up to Date

### Documentation Updates

This documentation is updated with each release. Key areas that change:

- **GPT-5 Integration** - API changes and new features
- **Deployment Procedures** - Infrastructure updates
- **Performance Optimizations** - Cost and speed improvements

### Release Notes

Check [CHANGELOG.md](../CHANGELOG.md) for detailed release information.

### Contributing to Documentation

1. **Fork the repository**
2. **Update relevant documentation**
3. **Test procedures you document**
4. **Submit pull request**

---

**Atlas Codex Documentation** - Last updated: January 2025  
For technical support, create an issue in the GitHub repository.