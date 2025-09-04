# AI Agent Quick Start Instructions

## 🎯 How to Use This Folder

When a user tells you: **"Read the START_HERE folder before getting started"**, follow these steps:

### Step 1: Acknowledge
Respond with:
> "I'll start by reviewing the START_HERE documentation to understand the Atlas Codex system properly."

### Step 2: Read Documents in Order
1. Start with `README.md` in this folder
2. Follow the reading order specified
3. Pay special attention to CRITICAL warnings

### Step 3: Create Your Task List
Use the TodoWrite tool immediately:
```javascript
TodoWrite([
  { content: "Read START_HERE documentation", status: "completed" },
  { content: "Check system status", status: "in_progress" },
  { content: "Understand user requirements", status: "pending" },
  { content: "Plan implementation", status: "pending" },
  { content: "Execute changes", status: "pending" }
])
```

### Step 4: Verify System Status
Run these commands before any work:
```bash
# Check branch
git branch --show-current

# Check CI/CD
gh run list --limit 3

# Check Lambda
aws lambda get-function --function-name atlas-codex-dev-api --query 'Configuration.State'
```

## 🚀 Quick Reference Commands

### For Development Work
```bash
# Create feature branch with worktree
git worktree add -b feature/your-feature ../atlascodex-your-feature origin/main
cd ../atlascodex-your-feature

# Test your changes
npm test
npm run test:accuracy

# Create PR
git push origin feature/your-feature
gh pr create --title "feat: Your feature" --body "Description"
```

### For Testing Extraction
```bash
# Test navigation-aware extraction (MUST return 58 headlines)
curl -X POST https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key-123" \
  -d '{
    "url": "https://www.sandiegouniontribune.com",
    "extractionInstructions": "Extract all news headlines",
    "schema": {
      "type": "object",
      "properties": {
        "headlines": {"type": "array", "items": {"type": "string"}}
      }
    }
  }'
```

### For Emergency Situations
```bash
# Instant rollback to stable version
aws lambda update-alias \
  --function-name atlas-codex-prod-api \
  --name prod \
  --function-version 45

# Check logs
aws logs tail /aws/lambda/atlas-codex-prod-api --follow
```

## 📋 Common User Requests and Responses

### "Add a new feature"
1. Read START_HERE docs
2. Create worktree for feature
3. Implement with tests
4. Create PR for review

### "Fix the extraction"
1. VERIFY navigation-aware extraction is working
2. Test with San Diego Union Tribune (58 headlines)
3. Check Lambda timeout (must be 60s)
4. Review recent changes

### "Deploy to production"
1. Ensure all tests pass
2. Create PR from main to production
3. Wait for approval
4. Monitor canary deployment

### "Something is broken"
1. Check 05-CRITICAL-INFO.md
2. Run emergency rollback if needed
3. Check CloudWatch logs
4. Document the incident

## ⚠️ Red Flags to Watch For

If you see any of these, STOP and investigate:
- San Diego Union Tribune returns < 58 headlines
- Lambda timeout < 60 seconds
- Navigation detection removed or modified
- API key validation changed
- Tests failing

## 🎓 Key Files to Remember

```
api/evidence-first-bridge.js  # CRITICAL - Navigation-aware extraction
api/lambda.js                  # API handler
serverless.yml                 # Lambda config (timeout: 60)
.github/workflows/deploy.yml   # CI/CD pipeline
CLAUDE.md                      # Your detailed instructions
DEVELOPMENT_WORKFLOW.md        # Complete dev process
```

## 💡 Pro Tips for AI Agents

1. **Always use TodoWrite** - It helps track progress and shows professionalism
2. **Test extraction first** - Verify the system works before making changes
3. **Use git worktrees** - Isolate features from main codebase
4. **Create comprehensive PRs** - Include tests, docs, and detailed descriptions
5. **Monitor deployments** - Watch GitHub Actions and CloudWatch
6. **Document everything** - Update relevant docs when making changes
7. **Ask for clarification** - Better to ask than break production

## 🏁 Your First Response Template

When starting work on Atlas Codex, your first response should be:

```markdown
I'll start by reviewing the START_HERE documentation to understand the Atlas Codex system properly.

Let me check the current system status and set up my task list:

[Run status checks]
[Create TodoWrite list]
[Confirm understanding of requirements]

Based on the documentation, Atlas Codex is a navigation-aware extraction system that's currently stable in production. The key feature is multi-page extraction which must be preserved.

I'm ready to help with [user's request]. Let me create a plan...
```

## 🔗 Quick Links

- **Repository**: https://github.com/coreydylan/atlascodex
- **Dev API**: https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev
- **Prod API**: https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/prod
- **GitHub Actions**: https://github.com/coreydylan/atlascodex/actions
- **Frontend**: Vercel auto-deployment

---

**Remember**: You're working on a production system. Be careful, test everything, and always preserve the navigation-aware extraction feature!