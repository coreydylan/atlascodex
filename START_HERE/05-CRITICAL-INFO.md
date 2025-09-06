# CRITICAL INFORMATION - DO NOT BREAK THESE

## 🔴 CRITICAL FEATURES - NEVER REMOVE

### 1. Navigation-Aware Extraction
**File**: `api/evidence-first-bridge.js`
**Lines**: ~200-350

This is THE MOST CRITICAL feature of Atlas Codex. It enables:
- Multi-page content extraction
- Pagination handling
- Automatic crawling

**TEST**: San Diego Union Tribune must return 58 headlines
```bash
# This MUST work and return 58 headlines
curl -X POST https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract \
  -H "x-api-key: test-key-123" \
  -d '{"url": "https://www.sandiegouniontribune.com", ...}'
```

### 2. Lambda Timeout Configuration
**File**: `serverless.yml`
**Current**: 60 seconds
**Minimum**: 60 seconds

```yaml
# NEVER reduce this below 60
timeout: 60
```

Multi-page extraction requires time. Reducing timeout breaks the system.

### 3. API Key Validation
**File**: `api/lambda.js`
**Function**: `validateApiKey()`

Must accept ALL of these keys:
- `test-key-123` (development testing)
- `dev-e41d8c40f0bc54fcc590dc54b7ebe138344afe9dc41690c38bd99c838116405c`
- `prod-28d4434781ec4cef8b68b00a8e84a6f49d133aab1e605504604a088e33ac97f2`

## 🛑 NEVER CHANGE THESE FILES WITHOUT UNDERSTANDING

### Core Extraction Engine
```
api/evidence-first-bridge.js  # Navigation detection & extraction
api/lambda.js                  # API routing & validation
serverless.yml                 # Lambda configuration
```

### CI/CD Pipeline
```
.github/workflows/deploy.yml   # Deployment automation
vercel.json                    # Frontend configuration
```

## ⚠️ STABLE VERSION REFERENCE

If something breaks, revert to:
- **Lambda Version**: 45
- **Git Tag**: `v1.0.0-stable-navigation`
- **Git Commit**: `e5941a0` (navigation restoration)

### Emergency Rollback Command
```bash
# Instant production rollback
aws lambda update-alias \
  --function-name atlas-codex-prod-api \
  --name prod \
  --function-version 45
```

## 🔥 RECENT INCIDENT HISTORY

### The Great Navigation Deletion (Sept 3, 2025)
**What Happened**: Navigation-aware extraction was accidentally removed
**Impact**: San Diego Union Tribune returned 0 headlines instead of 58
**Root Cause**: Misidentified navigation code as problematic
**Resolution**: Restored from commit e5941a0
**Lesson**: NEVER remove navigation detection logic

## 📊 CRITICAL METRICS TO MONITOR

### Must Always Pass
1. **San Diego Union Tribune**: 58 headlines
2. **Lambda execution time**: < 60 seconds
3. **API response**: Success with data
4. **Health check**: Returns 200 OK

### Warning Signs
- Headlines count drops significantly
- Timeout errors increase
- Navigation detection returns false for known multi-page sites
- Memory usage exceeds 900 MB

## 🚨 PRODUCTION HOTFIXES

If you need to fix production immediately:

### Option 1: Lambda Alias Rollback (Instant)
```bash
# Roll back to known good version
aws lambda update-alias \
  --function-name atlas-codex-prod-api \
  --name prod \
  --function-version 45
```

### Option 2: Emergency Deploy (5 minutes)
```bash
# Deploy directly (use with extreme caution)
serverless deploy --stage prod --force
```

### Option 3: GitHub Revert (10 minutes)
```bash
# Revert last deployment
git revert HEAD
git push origin production
# CI/CD will auto-deploy
```

## 🔐 SECRET MANAGEMENT

### Never Expose These
- OpenAI API Key (starts with `sk-proj-`)
- AWS Access Keys
- Master API Keys

### Where Secrets Live
- **GitHub Secrets**: CI/CD deployment
- **Lambda Environment**: Runtime access
- **Local .env**: Never commit!

## 🏥 HEALTH CHECK ENDPOINTS

### Quick System Check
```bash
# Development
curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health

# Production
curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/prod/health
```

### Full Extraction Test
```bash
# Should complete in < 30 seconds with 58 headlines
time curl -X POST https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key-123" \
  -d '{
    "url": "https://www.sandiegouniontribune.com",
    "extractionInstructions": "Extract all news headlines",
    "schema": {
      "type": "object",
      "properties": {
        "headlines": {
          "type": "array",
          "items": {"type": "string"}
        }
      }
    }
  }'
```

## 💀 THINGS THAT WILL BREAK PRODUCTION

1. **Removing navigation detection code**
2. **Reducing Lambda timeout below 60s**
3. **Breaking API key validation**
4. **Changing OpenAI model without testing**
5. **Modifying schema validation incorrectly**
6. **Deleting error handling**
7. **Removing retry logic**

## 🆘 WHO TO CONTACT

### If You Break Production
1. First: Try emergency rollback
2. Check CloudWatch logs
3. Review recent deployments
4. Check GitHub Actions logs

### Monitoring Commands
```bash
# Watch Lambda logs
aws logs tail /aws/lambda/atlas-codex-prod-api --follow

# Check recent deployments
gh run list --limit 5

# View Lambda configuration
aws lambda get-function-configuration --function-name atlas-codex-prod-api
```

## 📝 POST-INCIDENT CHECKLIST

After any production incident:
- [ ] System restored to working state
- [ ] Root cause identified
- [ ] Metrics verified (58 headlines test)
- [ ] Documentation updated
- [ ] Lessons learned documented
- [ ] Tests added to prevent recurrence

## 🏆 GOLDEN RULES

1. **Test extraction before deploying**
2. **Never remove code you don't understand**
3. **Navigation-aware extraction is sacred**
4. **When in doubt, don't deploy**
5. **Always have a rollback plan**

Remember: **Atlas Codex serves real users in production. Treat it with respect.**