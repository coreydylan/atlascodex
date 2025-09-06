# PR Analyzer Agent - Example Usage

## Example 1: Reviewing a Navigation System Change

### PR Description
```
PR #234: Optimize navigation-aware extraction
- Improved pagination detection
- Added new selector patterns
- Reduced timeout from 60s to 30s
```

### Agent Invocation
```bash
# Using Claude Code
"Please review PR #234 using the Atlas Codex PR Analyzer agent"

# Or with specific command
"/review PR #234"
```

### Agent Response
```markdown
## 📊 PR Analysis: Optimize navigation-aware extraction

### 📋 Summary
This PR attempts to optimize the navigation-aware extraction system by improving pagination detection and reducing timeout values.

### 🔍 Changes Overview
- **Files Modified**: 3 files
- **Lines Added**: +45
- **Lines Removed**: -23
- **Critical Files Affected**: api/evidence-first-bridge.js

### ⚠️ Risk Assessment
- **Risk Level**: HIGH
- **Impact Scope**: System-wide
- **Breaking Changes**: Yes - timeout reduction may break slow-loading sites

### 📝 Detailed Review

#### ✅ Positive Aspects
- Improved selector patterns for better pagination detection
- Added fallback mechanisms for navigation
- Better error messages for debugging

#### 🔧 Issues Found

**Critical Issues** (Must fix before merge)
1. Timeout reduction breaking slow sites
   - File: `api/evidence-first-bridge.js:156`
   - Problem: Reducing timeout to 30s will cause failures on slow-loading news sites
   - Suggestion: Keep 60s timeout or make it configurable per domain

2. Missing null check in navigation logic
   - File: `api/evidence-first-bridge.js:234`
   - Problem: `nextPageUrl` can be null causing TypeError
   - Suggestion: Add null check before URL manipulation

**Major Issues** (Should fix)
1. Selector pattern too broad
   - File: `api/evidence-first-bridge.js:89`
   - Pattern: `a[href*="page"]` will match unrelated links
   - Suggestion: Use more specific pattern like `a.pagination[href*="page"]`

### 💡 Recommendations

1. **Immediate Actions**:
   - Revert timeout change or make configurable
   - Add null safety checks
   - Narrow selector patterns

2. **Suggested Improvements**:
   - Add unit tests for new pagination patterns
   - Document selector pattern choices
   - Add performance metrics logging

### 📊 Approval Status

**Decision**: CHANGES_REQUESTED

**Conditions for Approval**:
- [ ] Restore 60s timeout or implement per-domain configuration
- [ ] Add null check for nextPageUrl
- [ ] Refine selector patterns to avoid false matches
- [ ] Add tests for pagination detection

---
*Reviewed by Atlas Codex PR Analyzer v1.0.0*
```

## Example 2: Security-Focused Review

### Command
```bash
/security-check PR #456
```

### PR Changes
```diff
+ const apiKey = "sk-proj-abc123xyz789"
+ const endpoint = `https://api.service.com/extract?key=${apiKey}`
```

### Agent Response
```markdown
## 🔐 Security Analysis: PR #456

### 🚨 CRITICAL SECURITY ISSUES FOUND

#### Issue 1: Hardcoded API Key
- **Severity**: CRITICAL
- **File**: `api/worker-enhanced.js:45`
- **Line**: `const apiKey = "sk-proj-abc123xyz789"`

**Impact**: Exposed API key in source code
**Fix Required**: 
```javascript
// Use environment variable instead
const apiKey = process.env.SERVICE_API_KEY
```

#### Issue 2: API Key in URL
- **Severity**: HIGH
- **File**: `api/worker-enhanced.js:46`
- **Risk**: API key visible in logs and network traces

**Fix Required**:
```javascript
// Use headers instead of query parameters
const response = await fetch(endpoint, {
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
})
```

### 📊 Approval Status

**Decision**: REJECTED - Security Violations

**Required Actions**:
1. Remove hardcoded API key immediately
2. Use environment variables
3. Move authentication to headers
4. Rotate the exposed API key

---
*Security scan by Atlas Codex PR Analyzer*
```

## Example 3: Performance Check

### Command
```bash
/performance-check PR #789
```

### PR with Performance Issues
```javascript
// Recursive function without depth limit
async function crawlPages(url, visited = new Set()) {
  visited.add(url);
  const links = await extractLinks(url);
  for (const link of links) {
    if (!visited.has(link)) {
      await crawlPages(link, visited); // No depth limit!
    }
  }
}
```

### Agent Response
```markdown
## ⚡ Performance Analysis: PR #789

### 🔴 Critical Performance Issues

#### Issue 1: Unbounded Recursion
- **File**: `api/crawler.js:23-31`
- **Problem**: Recursive crawling without depth limit
- **Impact**: Memory exhaustion, infinite loops, Lambda timeout

**Required Fix**:
```javascript
async function crawlPages(url, visited = new Set(), depth = 0, maxDepth = 3) {
  if (depth >= maxDepth) return;
  visited.add(url);
  const links = await extractLinks(url);
  
  // Process in batches to avoid memory issues
  const batch = links.slice(0, 10);
  await Promise.all(
    batch.map(link => {
      if (!visited.has(link)) {
        return crawlPages(link, visited, depth + 1, maxDepth);
      }
    })
  );
}
```

#### Issue 2: No Memory Cleanup
- **Problem**: Set grows unbounded
- **Solution**: Implement size limits

### 📊 Approval Status

**Decision**: CHANGES_REQUESTED

**Performance Requirements**:
- [ ] Add depth limiting
- [ ] Implement batch processing
- [ ] Add memory monitoring
- [ ] Set maximum visited set size

---
*Performance review by Atlas Codex PR Analyzer*
```

## Example 4: Quick Review for Documentation

### Command
```bash
/quick-review PR #101
```

### Simple Documentation PR
```diff
# README.md
+ ## New Feature: Unified Extractor
+ The unified extractor provides AI-powered extraction...
```

### Agent Response
```markdown
## ✅ Quick Review: PR #101

**Change Type**: Documentation
**Risk Level**: Low
**Files**: README.md (+3 lines)

**Review**: Documentation update looks good. Clear explanation of new feature.

**Decision**: APPROVED

---
*Quick review by Atlas Codex PR Analyzer*
```

## Example 5: Extraction Logic Validation

### Command
```bash
/extraction-check PR #567
```

### PR Modifying Core Extraction
```javascript
// Removing multi-page detection
function shouldUseMultiPageExtraction() {
  return false; // Disabled for performance
}
```

### Agent Response
```markdown
## 🚫 Extraction Logic Review: PR #567

### 🛑 BLOCKING ISSUE: Core Functionality Disabled

#### Critical Problem
- **File**: `api/evidence-first-bridge.js:445`
- **Change**: Multi-page extraction disabled
- **Impact**: Breaks extraction for 80% of news sites

This change removes the navigation-aware extraction capability which is ESSENTIAL for Atlas Codex functionality.

### Why This Cannot Be Merged

1. **San Diego Union Tribune**: Requires multi-page for 58 headlines
2. **News Sites**: Pagination is critical for complete extraction
3. **User Expectation**: System advertises multi-page capability

### Alternative Solutions

Instead of disabling, consider:
1. Make it configurable per domain
2. Add caching to improve performance
3. Implement smart detection to use only when needed

### 📊 Approval Status

**Decision**: REJECTED - Core Functionality Removal

This change would fundamentally break Atlas Codex's primary value proposition.

---
*Extraction integrity protected by Atlas Codex PR Analyzer*
```

## Example 6: Using with GitHub CLI

```bash
# Get PR diff and analyze
gh pr diff 123 > pr-123.diff

# Invoke Claude with the agent
echo "Please analyze this PR using the Atlas Codex PR Analyzer agent" | \
  claude-cli --agent agents/pr-analyzer/AGENT_PROMPT.md \
            --context pr-123.diff

# Post review as comment
gh pr comment 123 --body "$(cat review-output.md)"
```

## Example 7: Automated Workflow Integration

```yaml
# .github/workflows/pr-analysis.yml
name: Automated PR Analysis

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Get PR Diff
        run: |
          gh pr diff ${{ github.event.number }} > pr.diff
          
      - name: Analyze with Claude Agent
        run: |
          # Your Claude API integration
          # Uses agents/pr-analyzer/AGENT_PROMPT.md
          
      - name: Post Review
        if: always()
        run: |
          gh pr comment ${{ github.event.number }} \
            --body-file review.md
```

## Tips for Best Results

1. **Provide Context**: Include PR description and related issue numbers
2. **Use Specific Commands**: `/security-check` for security, `/performance-check` for performance
3. **Include Test Results**: Share test output if relevant
4. **Mention Dependencies**: Note if PR depends on other changes
5. **Highlight Breaking Changes**: Be explicit about API changes

---

*These examples demonstrate the Atlas Codex PR Analyzer's capabilities in protecting code quality and extraction integrity.*