# Contributing to Atlas Codex

Thank you for your interest in contributing to Atlas Codex! This guide will help you get started with contributing to our navigation-enhanced universal data extraction platform.

## 🚀 Quick Start for Contributors

### Prerequisites
- Node.js 20+ 
- Git
- AWS CLI (for backend development)
- Basic understanding of TypeScript, React, and serverless architecture

### Development Setup
1. **Fork & Clone**
   ```bash
   git clone https://github.com/YOUR-USERNAME/atlascodex.git
   cd atlascodex
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp lambda-env.json lambda-env.local.json
   # Edit lambda-env.local.json with your API keys
   ```

3. **Start Development**
   ```bash
   # Frontend development
   cd packages/frontend
   npm run dev
   
   # Backend testing (uses production API)
   curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health
   ```

## 🎯 How to Contribute

### Areas We Need Help With
- **Extraction Patterns**: New website structures and navigation patterns
- **Frontend Improvements**: UI/UX enhancements and new features
- **Documentation**: Examples, tutorials, and API documentation
- **Testing**: Test cases for different extraction scenarios
- **Performance**: Optimization of extraction speed and accuracy

### Contribution Types

#### 🐛 Bug Reports
- Use GitHub Issues with bug report template
- Include reproduction steps and expected vs actual behavior
- Test against production API when possible

#### ✨ Feature Requests
- Check existing issues first
- Describe the use case and expected outcome
- Consider if it fits the core extraction mission

#### 🔧 Code Contributions
- Fork → Feature Branch → Pull Request workflow
- Follow existing code patterns and naming conventions
- Include tests and documentation updates

## 🏗️ Architecture Understanding

### Critical Path (What You Need to Know)
```
User Request → Navigation Detection → Multi-Page Crawling → Unified Extraction → Results
```

### Key Files for Contributors
- **`api/evidence-first-bridge.js`**: Core extraction engine (most contributions here)
- **`api/lambda.js`**: Request routing and API endpoints
- **`packages/frontend/src/App.tsx`**: Main UI component
- **`api/worker-enhanced.js`**: Fallback extraction system

### Common Contribution Areas

#### 1. Adding New Extraction Patterns
**Location**: `api/evidence-first-bridge.js`
**Function**: `shouldUseMultiPageExtraction()`

Example: Adding support for infinite scroll detection
```javascript
// Add to paginationIndicators array
const paginationIndicators = [
  // ... existing patterns
  'load more', 'show more', 'see more results'
];
```

#### 2. Improving Navigation Detection  
**Location**: `api/evidence-first-bridge.js`
**Function**: `performNavigationAwareExtraction()`

Example: Adding new crawling strategies
```javascript
// Add to determineCrawlScope()
if (instructions.includes('comprehensive') || instructions.includes('complete')) {
  return 100; // Large scope
}
```

#### 3. Frontend Enhancements
**Location**: `packages/frontend/src/App.tsx` or `packages/frontend/src/components/`

Example: Adding new UI features
```typescript
// Follow existing patterns for state management
const [newFeature, setNewFeature] = useState(false);

// Use existing component patterns
<Label htmlFor="new-feature" className="text-sm font-medium">
  New Feature
</Label>
```

## 🧪 Testing Guidelines

### Before Submitting
1. **Production API Test**: Ensure your changes don't break existing functionality
   ```bash
   curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health
   ```

2. **Frontend Build Test**: Verify frontend builds successfully
   ```bash
   cd packages/frontend
   npm run build
   ```

3. **Extraction Test**: Test with real websites
   ```bash
   # Test your extraction improvements
   curl -X POST "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract" \
     -H "Content-Type: application/json" \
     -H "X-Api-Key: test-key-123" \
     -d '{"url": "https://example.com", "extractionInstructions": "test case", "UNIFIED_EXTRACTOR_ENABLED": true}'
   ```

### Test Cases to Consider
- **Single-page extraction**: Basic team/product pages
- **Multi-page extraction**: Paginated content
- **Navigation detection**: Sites with "Load More" or pagination
- **Error handling**: Invalid URLs, timeouts, parsing errors

## 📝 Coding Standards

### JavaScript/TypeScript
- **ES6+ syntax**: Use modern JavaScript features
- **Async/await**: Preferred over Promise chains
- **Error handling**: Comprehensive try-catch blocks
- **Logging**: Use descriptive console messages for debugging

### Code Style
```javascript
// Good
const extractionResult = await this.performUnifiedAIExtraction(htmlContent, {
  ...params,
  url: page.url
});

// Bad  
const result = await performAI(html, params);
```

### React Components
- **Functional components** with hooks
- **TypeScript interfaces** for props
- **Consistent naming**: PascalCase for components, camelCase for functions

```typescript
interface ExtractionPanelProps {
  isLoading: boolean;
  onExtract: (data: any) => void;
}

const ExtractionPanel: React.FC<ExtractionPanelProps> = ({ isLoading, onExtract }) => {
  // Component implementation
};
```

## 📋 Pull Request Process

### 1. Branch Naming
```bash
git checkout -b feature/add-infinite-scroll-detection
git checkout -b fix/pagination-bug
git checkout -b docs/update-api-examples
```

### 2. Commit Messages
Follow conventional commits:
```bash
feat: add infinite scroll detection to navigation system
fix: resolve pagination detection for numeric links  
docs: add examples for multi-page extraction API
```

### 3. PR Description Template
```markdown
## What This PR Does
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested against production API
- [ ] Frontend builds successfully
- [ ] Extraction works with test cases

## Examples
```bash
# Show how to test your changes
curl -X POST "..." -d '{...}'
```
```

### 4. Review Process
1. **Automated checks**: All tests must pass
2. **Code review**: At least one maintainer approval required
3. **Production test**: Changes tested against live system
4. **Documentation**: README and docs updated if needed

## 🔒 Security Considerations

### API Keys
- **Never commit API keys** to the repository
- Use environment variables and templates
- Test with dummy keys when possible

### Input Validation
- **Sanitize URLs** and user input
- **Validate extraction instructions** for harmful content
- **Rate limiting awareness** - don't abuse external APIs

### Error Information
- **Don't expose sensitive data** in error messages
- Log detailed errors server-side, return sanitized errors to clients

## 🎉 Recognition

Contributors will be:
- Added to the project's contributor list
- Mentioned in release notes for significant contributions
- Invited to contribute to project direction and roadmap discussions

### Types of Recognition
- **Code Contributors**: Direct code improvements and features
- **Documentation Contributors**: README, guides, examples
- **Community Contributors**: Issue triage, user support, testing
- **Idea Contributors**: Feature suggestions and architectural improvements

## 🆘 Getting Help

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Code Reviews**: Detailed feedback on pull requests

### Common Questions

**Q: How do I test extraction changes locally?**  
A: Use the production API endpoint for testing since local development uses the deployed backend.

**Q: What if my extraction pattern doesn't work for all sites?**  
A: That's okay! Extraction is inherently site-specific. Document the intended use case and limitations.

**Q: How do I add support for a new type of content?**  
A: Start by analyzing the HTML structure, then add detection patterns to `shouldUseMultiPageExtraction()` and extraction logic to the unified extractor.

**Q: Can I contribute without AWS setup?**  
A: Yes! Frontend contributions, documentation, and testing don't require AWS deployment. The production API is available for testing.

## 🚦 Development Best Practices

### Performance
- **Minimize API calls**: Batch operations when possible
- **Efficient DOM parsing**: Use targeted selectors
- **Memory management**: Clean up large objects and DOM references

### Reliability  
- **Graceful degradation**: Always have fallback strategies
- **Timeout handling**: Don't let requests hang indefinitely
- **Retry logic**: Handle temporary failures appropriately

### User Experience
- **Clear error messages**: Help users understand what went wrong
- **Progress indicators**: Show extraction progress for long operations
- **Result validation**: Ensure extracted data makes sense

---

Thank you for contributing to Atlas Codex! Together we're building the most powerful and flexible web extraction platform. 🚀