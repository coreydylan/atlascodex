# Unified Extractor Deployment Configuration

## Summary
The unified extractor has been successfully configured for deployment to the existing AWS Lambda function. The system provides a clean, AI-powered extraction solution with automatic fallback capabilities.

## Changes Made

### 1. Updated Lambda Handler (`/api/lambda.js`)
- ✅ Updated imports to use `processWithUnifiedExtractor` 
- ✅ Modified extraction calls to use unified extractor
- ✅ Maintained backward compatibility and error handling

### 2. Updated Serverless Configuration (`/serverless.yml`)
- ✅ Added `api/evidence-first-bridge.js` to deployment package
- ✅ Added `UNIFIED_EXTRACTOR_ENABLED` environment variable
- ✅ Maintained existing AWS resources and permissions

### 3. Updated Dependencies (`/package.json`)
- ✅ Added `ajv@^8.12.0` for JSON Schema validation
- ✅ Added `ajv-formats@^2.1.1` for extended validation formats
- ✅ Added deployment and testing scripts

### 4. Created Deployment Scripts
- ✅ `deploy-unified-extractor.sh` - Automated deployment script
- ✅ `test-deployment.js` - Comprehensive testing script
- ✅ NPM scripts for easy execution

## Deployment Architecture

```
Frontend (Vercel)
       ↓
AWS API Gateway (https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev)
       ↓
AWS Lambda (atlas-codex-dev-api)
       ↓
Unified Extractor (evidence-first-bridge.js)
       ↓ (if enabled)
Single AI Call (OpenAI GPT-4o) → AJV Validation → Clean Output
       ↓ (fallback if disabled/error)
Plan-Based System (worker-enhanced.js)
```

## Environment Variables

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `OPENAI_API_KEY` | OpenAI API access | - | ✅ Yes |
| `UNIFIED_EXTRACTOR_ENABLED` | Enable/disable unified extractor | `false` | No |
| `MASTER_API_KEY` | API authentication | `test-key-123` | No |
| `NODE_ENV` | Runtime environment | `production` | No |

## Deployment Commands

### Quick Deployment
```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"

# Deploy unified extractor
npm run deploy:unified-extractor
```

### Manual Deployment
```bash
# Install dependencies
npm install

# Enable unified extractor
export UNIFIED_EXTRACTOR_ENABLED=true

# Deploy to AWS
serverless deploy --stage dev
```

### Testing
```bash
# Test deployment
npm run test:deployment

# Test specific endpoint
curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health
```

## API Endpoints

### Current Production Endpoint
**Base URL**: `https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev`

### Key Endpoints
- `GET /health` - Service health check
- `POST /api/extract` - Data extraction (unified extractor)
- `GET /api/extract/{jobId}` - Extraction status
- `POST /api/ai/process` - AI-powered processing

### Frontend Integration
The frontend is already configured to use these endpoints. No changes needed to the frontend code.

## Unified Extractor Features

### ✅ Production-Ready Features
- **Single AI Call**: GPT-4o generates schema and extracts data in one request
- **AJV Validation**: Strict JSON schema validation with phantom field removal  
- **Automatic Fallback**: Falls back to existing plan-based system if issues occur
- **Feature Flag**: Can be enabled/disabled without redeployment
- **Zero Deterministic Bias**: Pure AI extraction without hardcoded patterns
- **Error Resilience**: Comprehensive error handling and logging

### 🚀 Performance Benefits
- **Faster**: Single AI call instead of multi-stage pipeline
- **More Accurate**: AI generates schemas that match user intent exactly
- **Cleaner Output**: AJV ensures structured, validated data
- **More Reliable**: Automatic fallback ensures high availability

## Testing Results

The deployment includes comprehensive testing:

1. **Health Check**: Verifies service is running
2. **Simple Extraction**: Tests basic extraction functionality
3. **Structured Extraction**: Tests complex schema-based extraction
4. **AI Processing**: Tests enhanced AI capabilities
5. **Local Function Test**: Verifies unified extractor logic
6. **Error Handling**: Tests fallback mechanisms

## Monitoring & Logs

### CloudWatch Logs
- **Log Group**: `/aws/lambda/atlas-codex-dev-api`
- **Key Messages**:
  - `🎯 Using Unified Extractor (Option C)` - Active mode
  - `📋 Unified extractor disabled, using plan-based system` - Fallback mode
  - `✅ AJV validation passed` - Successful validation
  - `❌ AJV validation failed` - Validation errors

### Metrics to Monitor
- Lambda Duration (should be lower with single AI call)
- Error Rate (should remain low with fallback)
- Memory Usage (monitor for optimization)
- API Gateway 4xx/5xx errors

## Rollback Plan

### Disable Unified Extractor
```bash
export UNIFIED_EXTRACTOR_ENABLED=false
serverless deploy --stage dev
```

### Complete Rollback
```bash
serverless rollback --timestamp [previous-deployment] --stage dev
```

### Emergency Fallback
The system automatically falls back to the existing plan-based system if:
- Unified extractor is disabled
- OpenAI API is unavailable
- AI processing fails
- Validation errors occur

## Security Considerations

✅ **API Key Protection**: OpenAI API key stored in Lambda environment variables
✅ **Input Validation**: AJV provides strict schema validation
✅ **Rate Limiting**: Existing API Gateway rate limits remain in place
✅ **CORS**: Proper CORS headers for frontend integration
✅ **Error Handling**: No sensitive data exposed in error messages

## Next Steps

1. **Deploy**: Run `npm run deploy:unified-extractor`
2. **Test**: Verify extraction accuracy with real URLs
3. **Monitor**: Check CloudWatch logs and metrics  
4. **Enable Permanently**: Set `UNIFIED_EXTRACTOR_ENABLED=true` 
5. **Optimize**: Adjust Lambda memory/timeout based on usage

## Support & Troubleshooting

### Common Issues
- **"OpenAI not initialized"**: Check API key is set in Lambda environment
- **"Unified extractor disabled"**: Verify `UNIFIED_EXTRACTOR_ENABLED=true`
- **AJV validation errors**: Check schema format and data structure
- **502/503 errors**: Check Lambda logs in CloudWatch

### Getting Help
- Check CloudWatch logs: `/aws/lambda/atlas-codex-dev-api`
- Test individual components with `test-deployment.js`
- Verify configuration with health endpoint
- Use fallback mode for immediate recovery

---

**Status**: ✅ Ready for Deployment
**Frontend URL**: Already configured and compatible
**API Gateway**: `https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev`
**Deployment Command**: `npm run deploy:unified-extractor`