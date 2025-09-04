# Stable Version Configuration

Version: v1.0.0-stable-navigation  
Date: 2024-09-04  
Status: PRODUCTION STABLE  
Git Tag: v1.0.0-stable-navigation  
Lambda Version: 45  
Lambda Aliases: prod (v45), staging (v45)  

## Configuration

- **Runtime**: Node.js 20.x
- **Lambda Timeout**: 60 seconds
- **Lambda Memory**: 1024 MB
- **Region**: us-west-2
- **API Gateway**: https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev

## Environment Variables

⚠️ **NEVER commit actual API keys to this file**

- `OPENAI_API_KEY`: Stored in AWS SSM at `/atlas/prod/openai_api_key` (or env var)
- `MASTER_API_KEY`: Stored in AWS SSM at `/atlas/prod/master_api_key` (or env var)
- `UNIFIED_EXTRACTOR_ENABLED`: "true"
- `AWS_REGION`: "us-west-2"

## Test Benchmarks

These are the golden tests that confirm the system is working:

| Test Case | Expected Result | Actual Result | Status |
|-----------|----------------|---------------|--------|
| vmota.org/people | 6 team members | 6 | ✅ |
| sandiegouniontribune.com headlines | 50+ items | 58 | ✅ |
| nytimes.com extraction | < 30 seconds | ~15s | ✅ |
| Health check response | < 5 seconds | < 1s | ✅ |

## Critical Files

| File | Lines | Checksum | Purpose |
|------|-------|----------|---------|
| api/evidence-first-bridge.js | 723 | [in backup] | Navigation-aware extraction engine |
| api/lambda.js | 467 | [in backup] | API handler with key validation |
| api/worker-enhanced.js | 6800+ | [in backup] | Contains performCrawl function |
| serverless.yml | 308 | [in backup] | Lambda configuration |
| package.json | [locked] | [in backup] | Dependency versions |

## Backup Locations

- **S3 Archive**: `s3://atlas-codex-backups-202509/stable/v1.0.0/`
- **Archive Checksum**: `624fcd4987ef2bec76818367a08b66fb2d320d8b44577af3429bac10d19492e0`
- **DynamoDB PITR**: Enabled with 35-day retention
- **S3 Versioning**: Enabled on backup bucket

## Key Features Working

1. **Navigation-Aware Extraction**: Fully operational
2. **Multi-Page Crawling**: Handles pagination automatically
3. **Unified Extractor**: GPT-4o integration working
4. **AJV Validation**: Schema enforcement active
5. **Fallback System**: Plan-based fallback operational
6. **API Authentication**: Multiple keys supported

## Quick Rollback Commands

```bash
# Rollback Lambda to this version
aws lambda update-alias --function-name atlas-codex-dev-api --name prod --function-version 45

# Rollback code to this tag
git checkout v1.0.0-stable-navigation
bash deploy-production.sh

# Restore from S3 backup
aws s3 cp s3://atlas-codex-backups-202509/stable/v1.0.0/atlas-codex-stable-20250903-233145.tar.gz .
tar -xzf atlas-codex-stable-20250903-233145.tar.gz
```

## Monitoring

- CloudWatch Logs: `/aws/lambda/atlas-codex-dev-api`
- Error threshold: < 5%
- Duration threshold: < 30s for standard extractions
- Navigation extractions may take longer (up to 60s)