# Contributing to Atlas Codex 🤝

Thank you for your interest in contributing to Atlas Codex! This guide will help you get started with contributing to our intelligent web scraping platform.

## 🎯 Code of Conduct

We are committed to providing a welcoming and inclusive experience for everyone. Please read and follow our code of conduct:

- Be respectful and inclusive
- Use welcoming and inclusive language
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other community members

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 20.x or higher
- Docker and Docker Compose
- Git
- AWS CLI (for deployment contributions)
- OpenAI API key with GPT-5 access

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/your-username/atlas-codex.git
cd atlas-codex

# Run setup script
./scripts/setup.sh

# Create your feature branch
git checkout -b feature/your-feature-name
```

## 🏗️ Project Structure

Understanding the codebase:

```
atlas-codex/
├── packages/
│   ├── core/      # Shared types and utilities
│   ├── api/       # API server and Lambda handlers
│   ├── worker/    # GPT-5 extraction engine
│   └── frontend/  # React dashboard
├── infrastructure/ # Terraform and Docker configs
├── scripts/       # Automation scripts
└── docs/         # Documentation
```

## 📝 Types of Contributions

### 🐛 Bug Reports

**Before submitting a bug report:**

1. Check if the bug has already been reported in [Issues](https://github.com/atlas-codex/atlas-codex/issues)
2. Try to reproduce the bug in the latest version
3. Check if it's a configuration issue by reviewing the documentation

**Good bug reports include:**

```markdown
## Bug Description
Brief description of the issue

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should have happened

## Actual Behavior
What actually happened

## Environment
- Node.js version:
- OS:
- Atlas Codex version:
- GPT-5 model used:

## Additional Context
Logs, screenshots, or other relevant information
```

### 💡 Feature Requests

**Before submitting a feature request:**

1. Check existing [Issues](https://github.com/atlas-codex/atlas-codex/issues) and [Discussions](https://github.com/atlas-codex/atlas-codex/discussions)
2. Consider if it fits with Atlas Codex's goals
3. Think about the impact on existing users

**Good feature requests include:**

```markdown
## Feature Description
Clear description of the proposed feature

## Use Case
Why is this feature needed? What problem does it solve?

## Proposed Solution
How do you envision this working?

## Alternatives Considered
What other approaches did you consider?

## Additional Context
Mockups, examples, or related issues
```

### 🔧 Code Contributions

#### Development Workflow

1. **Fork the repository** on GitHub
2. **Create a feature branch** from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes** following our coding standards
4. **Add tests** for new functionality
5. **Update documentation** as needed
6. **Run the test suite**:
   ```bash
   npm run test
   npm run lint
   npm run typecheck
   ```
7. **Commit your changes** using conventional commits:
   ```bash
   git commit -m "feat: add amazing new feature"
   ```
8. **Push to your fork**:
   ```bash
   git push origin feature/amazing-feature
   ```
9. **Create a Pull Request** to the `develop` branch

#### Coding Standards

**JavaScript/TypeScript Style:**
- Use TypeScript for new code when possible
- Follow existing code patterns in each package
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Use Zod schemas for data validation

**Code Examples:**

```typescript
// ✅ Good: TypeScript with proper typing
interface ExtractionResult {
  data: Record<string, unknown>;
  confidence: number;
  model: string;
}

async function extractData(url: string): Promise<ExtractionResult> {
  // Implementation
}

// ✅ Good: JSDoc for public functions
/**
 * Extracts structured data from a webpage using GPT-5
 * @param url - The webpage URL to extract from
 * @param schema - JSON schema defining expected output
 * @returns Promise resolving to extraction result
 */
export async function extractStructuredData(
  url: string, 
  schema: JsonSchema
): Promise<ExtractionResult> {
  // Implementation
}
```

**Git Commit Convention:**

We use [Conventional Commits](https://conventionalcommits.org/):

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code formatting (no logic changes)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tools

Examples:
```bash
feat: add GPT-5 context caching for cost optimization
fix: resolve worker hanging on large document synthesis
docs: update API reference with new extraction parameters
```

#### Testing Requirements

**Unit Tests:**
```bash
# Run all tests
npm run test

# Run specific package tests
cd packages/core && npm test
cd packages/worker && npm test
```

**Integration Tests:**
```bash
# Test API endpoints
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d '{"url": "https://example.com"}'
```

**Required for Pull Requests:**
- All existing tests must pass
- New functionality must include tests
- Test coverage should not decrease significantly
- Manual testing instructions in PR description

### 📚 Documentation Contributions

Good documentation is crucial for Atlas Codex. We welcome contributions to:

- API documentation
- Setup and deployment guides
- Code examples and tutorials
- Architecture explanations

**Documentation Standards:**
- Use clear, concise language
- Include practical examples
- Test all code examples
- Update table of contents when needed
- Follow existing formatting patterns

## 🔍 Code Review Process

### Pull Request Guidelines

**Before submitting:**
- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated if needed
- [ ] No merge conflicts with target branch
- [ ] PR description explains the change

**PR Description Template:**
```markdown
## Summary
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Added tests for new functionality
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings introduced
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs tests and linting
2. **Code Review**: Maintainers review for:
   - Code quality and style
   - Test coverage
   - Performance implications
   - Security considerations
   - Documentation completeness
3. **Feedback**: Reviewers provide constructive feedback
4. **Iteration**: Contributors address feedback
5. **Approval**: Once approved, changes are merged

### Review Criteria

**Code Quality:**
- Follows established patterns
- Handles errors appropriately
- Uses appropriate data structures
- Considers performance implications

**Security:**
- No hardcoded secrets
- Proper input validation
- Secure default configurations
- No introduction of vulnerabilities

**Performance:**
- Efficient algorithms
- Appropriate caching strategies
- Minimal resource usage
- Considers cost implications (especially for GPT-5 usage)

## 🛡️ Security Contributions

### Reporting Security Issues

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead:
1. Email security concerns to: security@atlascodex.ai
2. Include detailed reproduction steps
3. Allow reasonable time for fixes before disclosure

### Security Guidelines

When contributing:
- Never commit API keys or secrets
- Use environment variables for configuration
- Validate all user inputs
- Follow principle of least privilege
- Review dependencies for known vulnerabilities

## 🎯 Specialized Contributions

### GPT-5 Integration

When working on GPT-5 features:

- **Parameter Usage**: Use only supported parameters (`verbosity`, `reasoning_effort`)
- **Cost Optimization**: Implement context caching where possible
- **Error Handling**: Robust retry logic with exponential backoff
- **Model Selection**: Use appropriate model tier for task complexity

```javascript
// ✅ Good: Proper GPT-5 integration
const response = await openai.chat.completions.create({
  model: 'gpt-5-nano',
  verbosity: 'low',
  reasoning_effort: 'minimal',
  response_format: {
    type: 'json_schema',
    json_schema: schema
  }
});
```

### Infrastructure Contributions

When working on deployment/infrastructure:

- Test changes in development environment first
- Include rollback procedures
- Document configuration changes
- Consider cost implications
- Ensure backward compatibility

### Frontend Contributions

For UI/UX contributions:

- Follow existing design patterns
- Ensure responsive design
- Add proper error handling
- Include loading states
- Test across different browsers

## 📊 Performance Guidelines

### Cost Optimization

Atlas Codex prioritizes cost efficiency:

- **LLM Usage**: Keep below environment limits (15% in production)
- **Context Caching**: Structure prompts for maximum cache hits
- **Model Selection**: Use smallest appropriate model
- **Resource Management**: Clean up unused resources

### Response Time

Target performance metrics:

- **API Responses**: < 5 seconds for most requests
- **Simple Extraction**: 1-3 seconds with GPT-5-nano
- **Complex Analysis**: < 30 seconds with reasonable limits
- **Browser Rendering**: Optimize for sub-500ms startup

## 🏆 Recognition

Contributors are recognized through:

- **GitHub Contributors**: Automatic recognition in repository
- **Release Notes**: Major contributions highlighted in releases
- **Documentation**: Contributors credited in relevant documentation
- **Community**: Recognition in community channels

## 📞 Getting Help

### Communication Channels

- **GitHub Discussions**: General questions and ideas
- **GitHub Issues**: Bug reports and specific problems
- **Email**: security@atlascodex.ai for security issues

### Mentorship

New contributors can:

- Look for "good first issue" labels
- Ask questions in GitHub Discussions
- Request feedback on draft pull requests
- Join community discussions

## 📋 Contribution Checklist

Before submitting contributions:

- [ ] **Code**: Follows style guidelines and patterns
- [ ] **Tests**: All tests pass, new functionality tested
- [ ] **Documentation**: Updated relevant documentation
- [ ] **Performance**: Considered cost and performance implications
- [ ] **Security**: No secrets committed, proper validation
- [ ] **Compatibility**: No breaking changes without discussion
- [ ] **Review**: Self-reviewed all changes

## 🎉 Thank You!

Every contribution, no matter how small, helps make Atlas Codex better for everyone. We appreciate your time and effort in contributing to the project.

---

**Questions?** Feel free to ask in [GitHub Discussions](https://github.com/atlas-codex/atlas-codex/discussions) or create an issue for specific problems.