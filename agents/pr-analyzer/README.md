# Atlas Codex PR Analyzer Agent

## 🤖 Overview

The Atlas Codex PR Analyzer is a specialized Claude AI agent designed to review and analyze pull requests for the Atlas Codex web extraction system. It provides comprehensive code review, security analysis, and ensures the integrity of critical extraction functionality.

## 🚀 Features

- **Automated PR Review**: Comprehensive analysis of code changes
- **Security Scanning**: Detects vulnerabilities and exposed secrets
- **Performance Analysis**: Identifies performance bottlenecks and memory issues
- **Extraction Logic Validation**: Protects navigation-aware and Evidence-First systems
- **Code Quality Enforcement**: Ensures coding standards and best practices
- **Breaking Change Detection**: Identifies API compatibility issues

## 📦 Installation & Setup

### 1. Using with Claude Code

To use this agent with Claude Code, simply reference the agent prompt:

```bash
# In your conversation with Claude Code:
"Please review this PR using the Atlas Codex PR Analyzer agent from agents/pr-analyzer/AGENT_PROMPT.md"
```

### 2. GitHub Actions Integration

Create `.github/workflows/pr-review.yml`:

```yaml
name: PR Review with Claude Agent

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  claude-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Invoke Claude PR Analyzer
        run: |
          # Add your Claude API integration here
          # Reference: agents/pr-analyzer/AGENT_PROMPT.md
```

### 3. Manual Invocation

You can manually invoke the agent by providing it with:
1. The PR diff (`git diff main...feature-branch`)
2. The agent prompt from `AGENT_PROMPT.md`
3. The repository context

## 🎯 Usage Examples

### Basic PR Review

```markdown
User: Please review PR #123 that modifies the extraction logic

Agent: *Reads AGENT_PROMPT.md and analyzes the PR*

## 📊 PR Analysis: Update Navigation-Aware Extraction

### 📋 Summary
This PR modifies the navigation-aware extraction system to improve multi-page detection...

### ⚠️ Risk Assessment
- **Risk Level**: High
- **Impact Scope**: System-wide
- **Breaking Changes**: No

[Full review continues...]
```

### Security-Focused Review

```bash
/security-check PR #456
```

The agent will focus specifically on:
- API key exposure
- Input validation
- XSS vulnerabilities
- SQL injection risks
- CORS configuration

### Performance Analysis

```bash
/performance-check PR #789
```

Analyzes:
- Lambda timeout settings
- Memory allocation
- Circular dependencies
- Async/await patterns
- Resource cleanup

## 🛡️ Protected Systems

The agent specifically protects these critical components:

### 1. Navigation-Aware Extraction
- **File**: `api/evidence-first-bridge.js`
- **Methods**: `performNavigationAwareExtraction`, `shouldUseMultiPageExtraction`
- **Protection**: Prevents removal or breaking changes

### 2. Evidence-First System
- **Pattern**: Template matching and intelligent routing
- **Validation**: Ensures extraction strategies remain intact

### 3. API Compatibility
- **Endpoints**: All `/api/*` routes
- **CORS**: Headers and preflight handling
- **Response Format**: Consistent error and success responses

## 📝 Review Commands

The agent responds to these commands:

| Command | Description |
|---------|-------------|
| `/review` | Standard comprehensive PR review |
| `/security-check` | Focus on security vulnerabilities |
| `/performance-check` | Focus on performance issues |
| `/extraction-check` | Validate extraction logic integrity |
| `/quick-review` | Brief assessment for small changes |
| `/suggest-tests` | Recommend test cases for the changes |

## 🔍 Review Criteria

### Code Quality
- ✅ Formatting and linting
- ✅ Naming conventions
- ✅ Documentation
- ✅ Error handling

### Functionality
- ✅ Extraction logic validation
- ✅ API compatibility
- ✅ CORS configuration
- ✅ Error boundaries

### Security
- ✅ No exposed secrets
- ✅ Input sanitization
- ✅ Dependency vulnerabilities
- ✅ Authentication/authorization

### Performance
- ✅ Lambda timeout configuration
- ✅ Memory usage
- ✅ No circular dependencies
- ✅ Async pattern usage

## 📊 Output Format

The agent provides structured reviews with:

1. **Summary**: Overview of changes
2. **Risk Assessment**: Impact and severity
3. **Detailed Review**: Line-by-line analysis
4. **Issues Found**: Categorized by severity
5. **Recommendations**: Actionable improvements
6. **Approval Status**: Clear decision with conditions

## 🔧 Configuration

The agent configuration is stored in `agent-spec.json`:

```json
{
  "name": "atlas-codex-pr-analyzer",
  "version": "1.0.0",
  "type": "pull-request-analyzer",
  "capabilities": {
    "tools": ["Read", "Grep", "Glob", "Bash", "WebFetch", "Task"]
  }
}
```

## 🚨 Critical Files

The agent pays special attention to:

1. `api/evidence-first-bridge.js` - Core extraction engine
2. `api/lambda.js` - API handler
3. `api/worker-enhanced.js` - Plan-based system
4. `serverless.yml` - Infrastructure
5. `packages/frontend/src/App.tsx` - Frontend

## 💡 Best Practices

### For PR Authors

1. **Provide Clear Description**: Explain what and why
2. **Keep PRs Focused**: One feature/fix per PR
3. **Update Documentation**: Include relevant doc changes
4. **Test Your Changes**: Ensure extraction still works
5. **Check for Secrets**: Never commit API keys

### For Reviewers

1. **Use the Agent First**: Let it catch common issues
2. **Focus on Logic**: Agent handles style/formatting
3. **Test Critical Paths**: Manually test extraction
4. **Verify Backwards Compatibility**: Check API contracts

## 🔄 Integration with CI/CD

The agent can be integrated into your CI/CD pipeline:

```yaml
# .github/workflows/ci.yml
- name: PR Analysis
  if: github.event_name == 'pull_request'
  run: |
    # Invoke agent analysis
    # Block merge if CHANGES_REQUESTED
```

## 📈 Metrics

The agent tracks:
- Review accuracy
- Issues caught vs missed
- False positive rate
- Average review time
- Critical bug prevention

## 🤝 Contributing

To improve the agent:

1. Update `AGENT_PROMPT.md` with new patterns
2. Add new review criteria to `agent-spec.json`
3. Test with sample PRs
4. Document new capabilities

## 📚 Resources

- [Atlas Codex Documentation](../START_HERE/README.md)
- [Development Workflow](../DEVELOPMENT_WORKFLOW.md)
- [Claude AI Documentation](https://docs.anthropic.com)

## 🐛 Known Limitations

- Cannot execute code (static analysis only)
- Requires clear PR descriptions
- May need human verification for complex logic
- Limited to file-based analysis

## 📞 Support

For issues or improvements:
- Open an issue in the repository
- Tag with `agent-improvement`
- Provide example PRs for testing

---

*Atlas Codex PR Analyzer v1.0.0*
*Protecting extraction integrity since 2025*