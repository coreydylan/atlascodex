# 🚀 START HERE - Atlas Codex AI Agent Onboarding

Welcome AI Agent! This is your comprehensive guide to working with the Atlas Codex repository. **Read this entire document before making any changes to the codebase.**

## 🎯 Your Mission

Atlas Codex is a sophisticated AI-powered web extraction and analysis system. You are working with a production system that:
- Extracts structured data from websites using AI
- Handles navigation-aware multi-page extraction
- Has automated CI/CD pipelines
- Deploys to AWS Lambda (backend) and Vercel (frontend)

## 📖 MANDATORY READING ORDER

Read these documents in this exact order before starting any work:

### 1. Core Understanding (Read First)
- [`./01-PROJECT-OVERVIEW.md`](./01-PROJECT-OVERVIEW.md) - What Atlas Codex does
- [`./02-ARCHITECTURE.md`](./02-ARCHITECTURE.md) - System architecture and components
- [`./03-CURRENT-STATE.md`](./03-CURRENT-STATE.md) - Current deployment status

### 2. Development Guidelines (Read Second)
- [`../CLAUDE.md`](../CLAUDE.md) - **CRITICAL**: AI-specific development instructions
- [`../DEVELOPMENT_WORKFLOW.md`](../DEVELOPMENT_WORKFLOW.md) - Complete development process
- [`./04-DEVELOPMENT-RULES.md`](./04-DEVELOPMENT-RULES.md) - Rules you MUST follow

### 3. Emergency Information (Read Third)
- [`./05-CRITICAL-INFO.md`](./05-CRITICAL-INFO.md) - DO NOT BREAK THESE THINGS
- [`../docs/RUNBOOKS/emergency-rollback.md`](../docs/RUNBOOKS/emergency-rollback.md) - Emergency procedures

## ⚠️ CRITICAL WARNINGS

### NEVER DO THESE THINGS:
1. **NEVER** modify `api/evidence-first-bridge.js` without understanding navigation-aware extraction
2. **NEVER** remove the navigation detection logic - it's CRITICAL for multi-page extraction
3. **NEVER** push directly to `production` branch - always use PRs
4. **NEVER** change Lambda timeout below 60 seconds
5. **NEVER** modify API key validation without checking both test and production keys

### ALWAYS DO THESE THINGS:
1. **ALWAYS** use git worktrees for new features (see CLAUDE.md)
2. **ALWAYS** run tests before creating PRs
3. **ALWAYS** check if CI/CD pipeline is passing before starting work
4. **ALWAYS** preserve navigation-aware extraction functionality
5. **ALWAYS** use the TodoWrite tool to track your progress

## 🔧 Quick Setup Check

Before starting any work, verify the system status:

```bash
# Check current branch
git branch --show-current

# Check CI/CD status
gh run list --limit 3

# Check Lambda function status
aws lambda get-function --function-name atlas-codex-dev-api --query 'Configuration.State' --output text

# Check if tests pass
npm test
```

## 🏗️ Repository Structure

```
atlascodex/
├── START_HERE/           # You are here - onboarding docs
├── api/                  # Backend Lambda functions
│   ├── evidence-first-bridge.js  # CRITICAL: Navigation-aware extraction
│   ├── lambda.js         # Lambda handler
│   └── templates/        # Extraction templates
├── .github/workflows/    # CI/CD pipelines
├── docs/                 # Documentation
│   ├── DEPLOYMENT.md     # Deployment guide
│   └── RUNBOOKS/         # Emergency procedures
├── scripts/              # Utility scripts
├── CLAUDE.md            # AI agent instructions
├── DEVELOPMENT_WORKFLOW.md  # Dev process
└── serverless.yml       # Lambda configuration
```

## 🚦 Current System Status

As of your onboarding:
- **Production**: Stable at Lambda Version 45 (Git tag: v1.0.0-stable-navigation)
- **Development**: Auto-deploys from `main` branch
- **CI/CD**: GitHub Actions + Vercel auto-deployment
- **Critical Feature**: Navigation-aware extraction is WORKING - DO NOT BREAK IT

## 📝 Your First Steps

1. **Read all documents** in the order specified above
2. **Check system status** using the commands provided
3. **Review recent commits** to understand recent changes:
   ```bash
   git log --oneline -10
   ```
4. **Check for any failing tests or CI/CD issues**:
   ```bash
   gh run list --limit 5
   ```
5. **Use TodoWrite tool** to create your task list based on user requirements

## 🎓 Key Concepts You Must Understand

### Navigation-Aware Extraction
The system can detect and crawl multi-page content. This is CRITICAL for sites like:
- San Diego Union Tribune (extracts 58 headlines across pages)
- VMOTA (extracts 6 team members)
- Any paginated content

### Deployment Pipeline
- Push to `main` → Auto-deploy to development
- PR to `production` → Review → Canary deployment (10% traffic) → Full rollout
- Automatic rollback on high error rates

### API Keys
- Development: `dev-e41d8c40f0bc54fcc590dc54b7ebe138344afe9dc41690c38bd99c838116405c`
- Production: `prod-28d4434781ec4cef8b68b00a8e84a6f49d133aab1e605504604a088e33ac97f2`
- Test key: `test-key-123` (accepted in dev)

## 💬 Communication Guidelines

When working on Atlas Codex:
1. **Be concise** - Keep responses short and actionable
2. **Show progress** - Use TodoWrite to track tasks
3. **Explain changes** - Always explain what you're modifying and why
4. **Test everything** - Never assume code works without testing
5. **Document changes** - Update relevant documentation

## 🆘 Getting Help

If you encounter issues:
1. First, check [`./05-CRITICAL-INFO.md`](./05-CRITICAL-INFO.md)
2. Review error logs: `aws logs tail /aws/lambda/atlas-codex-dev-api --follow`
3. Check GitHub Actions: `gh run list --limit 5`
4. Refer to emergency procedures in `docs/RUNBOOKS/`

## ✅ Confirmation Checklist

Before you start working, confirm you have:
- [ ] Read all documents in the specified order
- [ ] Understood the navigation-aware extraction importance
- [ ] Reviewed the development workflow
- [ ] Checked current system status
- [ ] Set up your TodoWrite task list

---

**IMPORTANT**: If the user asks you to work on Atlas Codex, your FIRST response should be:
"I'll start by reviewing the START_HERE documentation to understand the system properly."

Then actually read the documents and follow the instructions.

Welcome to Atlas Codex! Let's build something amazing while keeping the system stable. 🚀