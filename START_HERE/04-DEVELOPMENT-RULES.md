# Development Rules - Atlas Codex

## 🚫 ABSOLUTE RULES - NEVER BREAK THESE

### 1. NEVER Remove Navigation-Aware Extraction
```javascript
// This code is CRITICAL - DO NOT REMOVE
shouldUseMultiPageExtraction(params, htmlContent) {
  // Navigation detection logic
}
performNavigationAwareExtraction() {
  // Multi-page crawling
}
```

### 2. NEVER Push Directly to Protected Branches
```bash
# WRONG - Never do this
git push origin main

# RIGHT - Always use PRs
git checkout -b feature/my-feature
git push origin feature/my-feature
gh pr create
```

### 3. NEVER Change Critical Configurations
- Lambda timeout: Keep at 60 seconds minimum
- Memory: Keep at 1024 MB minimum
- API key validation: Must accept test-key-123
- Serverless version: Use v3, NOT v4

### 4. NEVER Commit Secrets
```javascript
// WRONG
const apiKey = "sk-proj-actual-key-here"

// RIGHT
const apiKey = process.env.OPENAI_API_KEY
```

### 5. NEVER Skip Tests
```bash
# Always run tests before PR
npm test
npm run test:accuracy
```

## ✅ ALWAYS DO THESE THINGS

### 1. ALWAYS Use Git Worktrees for Features
```bash
# Create feature branch in worktree
git worktree add -b feature/new-feature ../atlascodex-new-feature origin/main
cd ../atlascodex-new-feature

# Work in isolation
# ... make changes ...

# Push and create PR
git push origin feature/new-feature
gh pr create
```

### 2. ALWAYS Test Navigation-Aware Extraction
```bash
# Test San Diego Union Tribune (should return 58 headlines)
curl -X POST https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract \
  -H "x-api-key: test-key-123" \
  -d '{"url": "https://www.sandiegouniontribune.com", ...}'
```

### 3. ALWAYS Use TodoWrite Tool
```javascript
// Start every session with todos
TodoWrite.create([
  { content: "Review START_HERE docs", status: "in_progress" },
  { content: "Implement feature X", status: "pending" },
  { content: "Test changes", status: "pending" },
  { content: "Create PR", status: "pending" }
])
```

### 4. ALWAYS Check CI/CD Before Starting
```bash
# Check pipeline status
gh run list --limit 3

# Ensure main is passing
git checkout main
git pull origin main
```

### 5. ALWAYS Document Breaking Changes
```markdown
## Breaking Changes
- Changed API response format
- Modified schema structure
- Updated endpoint paths
```

## 📋 Development Workflow Checklist

### Before Starting
- [ ] Read START_HERE documentation
- [ ] Check CI/CD status: `gh run list`
- [ ] Pull latest main: `git pull origin main`
- [ ] Create worktree: `git worktree add ...`
- [ ] Set up TodoWrite tasks

### During Development
- [ ] Write tests FIRST (TDD)
- [ ] Preserve navigation-aware extraction
- [ ] Follow existing code patterns
- [ ] Update documentation
- [ ] Test locally: `npm test`

### Before Creating PR
- [ ] Run all tests: `npm test`
- [ ] Test extraction endpoints
- [ ] Check for console.logs
- [ ] Update CHANGELOG.md
- [ ] Self-review code changes

### PR Description Must Include
- [ ] What changed and why
- [ ] Testing performed
- [ ] Breaking changes (if any)
- [ ] Performance impact
- [ ] Screenshots/logs if relevant

## 🏗️ Code Standards

### JavaScript/TypeScript
```javascript
// Use async/await, not callbacks
async function extractData(url) {
  try {
    const result = await fetchContent(url)
    return processResult(result)
  } catch (error) {
    logger.error('Extraction failed', { url, error })
    throw error
  }
}

// Always handle errors
// Always log important operations
// Always validate input
```

### API Responses
```javascript
// Success response
{
  success: true,
  data: extractedData,
  metadata: {
    pages: 3,
    extractionTime: 1234
  }
}

// Error response
{
  success: false,
  error: {
    message: "Clear error message",
    code: "EXTRACTION_FAILED",
    details: {}
  }
}
```

### Testing Standards
```javascript
// Test file naming
extraction.test.js
navigation.test.js

// Test structure
describe('Navigation-Aware Extraction', () => {
  it('should detect multi-page content', async () => {
    // Test implementation
  })
  
  it('should extract from all pages', async () => {
    // Test implementation
  })
})
```

## 🔍 Code Review Checklist

Before approving any PR, ensure:
- [ ] Navigation-aware extraction still works
- [ ] Tests pass
- [ ] No hardcoded secrets
- [ ] Documentation updated
- [ ] No breaking changes (or properly documented)
- [ ] Performance acceptable (< 60s)
- [ ] Error handling present
- [ ] Logging adequate

## 🚨 Emergency Procedures

### If You Break Production
1. **STOP** - Don't panic
2. **Rollback immediately**:
   ```bash
   aws lambda update-alias \
     --function-name atlas-codex-prod-api \
     --name prod \
     --function-version 45
   ```
3. **Verify rollback**:
   ```bash
   curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/prod/health
   ```
4. **Document what happened**

### If Tests Fail
1. Check if navigation-aware extraction is affected
2. Review recent changes: `git log --oneline -5`
3. Run specific test: `npm test -- --grep "navigation"`
4. Fix or revert changes

### If CI/CD Fails
1. Check GitHub Actions logs
2. Verify Serverless configuration
3. Check AWS credentials
4. Ensure using Serverless v3

## 🎯 Quality Gates

Code must pass ALL quality gates:

1. **Unit Tests**: 100% pass rate
2. **Integration Tests**: Must test extraction
3. **Navigation Test**: San Diego Union Tribune = 58 headlines
4. **Performance**: Response < 60 seconds
5. **Security**: No exposed secrets
6. **Documentation**: Updated for changes
7. **Code Review**: Approved by reviewer

## 📝 Commit Message Format

```
type(scope): description

- Detail 1
- Detail 2

Breaking Change: Description (if applicable)
```

Types: feat, fix, docs, style, refactor, test, chore

## 🔐 Security Rules

1. **Never log sensitive data**
2. **Validate all inputs**
3. **Sanitize error messages**
4. **Use environment variables for secrets**
5. **Keep dependencies updated**
6. **Review security advisories**

## 🎓 Learning Resources

- AWS Lambda Best Practices
- Serverless Framework v3 Docs
- OpenAI API Documentation
- Git Worktree Guide
- GitHub Actions Documentation

Remember: **The navigation-aware extraction is the heart of Atlas Codex. Protect it at all costs!**