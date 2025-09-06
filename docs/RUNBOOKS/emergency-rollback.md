# Emergency Rollback Procedure

**⚠️ USE THIS WHEN: Extraction is broken, API is timing out, or results are incorrect**

## 🚨 Quick Rollback (< 2 minutes)

### Option 1: Lambda Alias Rollback (Instant, No Code Change)

```bash
# Check current prod version
aws lambda get-alias --function-name atlas-codex-dev-api --name prod

# List recent versions (find the last working one)
aws lambda list-versions-by-function --function-name atlas-codex-dev-api --max-items 10

# INSTANT ROLLBACK to stable version 45
aws lambda update-alias --function-name atlas-codex-dev-api --name prod --function-version 45

# Verify it's working
curl -s https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health | jq '.'
```

## 🔧 Full Code Rollback (5 minutes)

```bash
# 1. Checkout stable tag
git checkout v1.0.0-stable-navigation

# 2. Deploy (this takes ~90 seconds)
bash deploy-production.sh

# 3. Verify deployment
bash scripts/test-stable.sh --env prod
```

## 📦 Restore from S3 Backup (10 minutes)

```bash
# 1. Download backup
aws s3 cp s3://atlas-codex-backups-202509/stable/v1.0.0/atlas-codex-stable-20250903-233145.tar.gz .

# 2. Verify checksum
echo "624fcd4987ef2bec76818367a08b66fb2d320d8b44577af3429bac10d19492e0  atlas-codex-stable-20250903-233145.tar.gz" | sha256sum -c

# 3. Extract
tar -xzf atlas-codex-stable-20250903-233145.tar.gz

# 4. Deploy
bash deploy-production.sh
```

## ✅ Verification Steps

### 1. Quick Health Check
```bash
curl -s https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health
```

### 2. Test VMOTA Extraction (Should return 6)
```bash
curl -s "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/ai/process" \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key-123" \
  -d '{
    "prompt": "extract team members from vmota.org/people",
    "autoExecute": true,
    "UNIFIED_EXTRACTOR_ENABLED": true
  }' | jq '.result.data | length'
```

### 3. Monitor CloudWatch
```bash
aws logs tail /aws/lambda/atlas-codex-dev-api --follow --format short --since 5m
```

### 4. Check Error Rates
```bash
# Look for error patterns
aws logs filter-log-events \
  --log-group-name /aws/lambda/atlas-codex-dev-api \
  --start-time $(date -u -d '5 minutes ago' +%s)000 \
  --filter-pattern "ERROR"
```

## 📊 Expected Metrics After Rollback

- Health check: < 1 second response
- VMOTA test: Returns exactly 6 team members  
- SD Union Tribune: Returns 50+ headlines
- Error rate: < 5%
- Lambda duration: < 30s average

## 🔍 Root Cause Investigation (After Stabilization)

1. Compare Lambda versions:
```bash
# What changed?
aws lambda get-function --function-name atlas-codex-dev-api --qualifier 45 > stable.json
aws lambda get-function --function-name atlas-codex-dev-api --qualifier $LATEST > broken.json
diff stable.json broken.json
```

2. Check recent commits:
```bash
git log --oneline -10
```

3. Review CloudWatch Insights:
```bash
# Run in AWS Console CloudWatch Insights
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 50
```

## 📞 Escalation

If rollback doesn't fix the issue:

1. **Primary Contact**: [Your Name/Contact]
2. **AWS Support**: Case via AWS Console
3. **OpenAI Status**: https://status.openai.com

## 🔐 Important Notes

- **DO NOT** modify environment variables during rollback
- **DO NOT** delete any Lambda versions
- **ALWAYS** verify with test suite after rollback
- **DOCUMENT** the incident in `docs/INCIDENTS/` folder

## Known Working Configuration

- Lambda Version: 45
- Git Tag: v1.0.0-stable-navigation  
- Confirmed Working: 2024-09-04 23:31 UTC
- Navigation-aware extraction: ENABLED
- Multi-page crawling: OPERATIONAL