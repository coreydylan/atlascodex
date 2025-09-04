# Unified Extractor Deployment Guide

## Overview
This guide will deploy the Unified Extractor to your existing AWS Lambda function, enabling the frontend → AWS API Gateway → Lambda → Unified Extractor chain to work end-to-end.

## Prerequisites

1. **OpenAI API Key**: Required for the unified extractor
2. **AWS CLI configured**: For deployment to Lambda
3. **Node.js 20+**: Runtime environment
4. **Serverless Framework**: For deployment

## Quick Deployment

### 1. Set Environment Variables
```bash
export OPENAI_API_KEY="your-openai-api-key-here"
export UNIFIED_EXTRACTOR_ENABLED=true
export MASTER_API_KEY="test-key-123"  # Or your custom API key
```

### 2. Run the Deployment Script
```bash
./deploy-unified-extractor.sh
```

This script will:
- ✅ Check prerequisites
- 📦 Install dependencies (including AJV validation)
- 🚀 Deploy to AWS Lambda
- 🧪 Test the deployment
- 📊 Provide endpoint URLs and testing commands

## Manual Deployment

If you prefer manual deployment:

### 1. Install Dependencies
```bash
npm install
npm install -g serverless
```

### 2. Configure Environment
```bash
export OPENAI_API_KEY="your-api-key"
export UNIFIED_EXTRACTOR_ENABLED=true
```

### 3. Deploy to AWS
```bash
serverless deploy --stage dev
```

## Deployment Configuration

### Files Updated
- `/api/lambda.js` - Lambda handler now uses unified extractor
- `/serverless.yml` - Includes unified extractor files and environment variables
- `/package.json` - Added AJV validation dependencies

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `UNIFIED_EXTRACTOR_ENABLED` | Enable/disable unified extractor | `false` |
| `OPENAI_API_KEY` | OpenAI API key for AI processing | Required |
| `MASTER_API_KEY` | API authentication key | `test-key-123` |

### Lambda Configuration
- **Runtime**: Node.js 20.x
- **Region**: us-west-2
- **Memory**: 1024MB
- **Timeout**: 30 seconds
- **API Gateway**: https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev

## API Endpoints

### Health Check
```bash
GET /health
```
Returns service status and feature availability.

### Extract Data (Unified Extractor)
```bash
POST /api/extract
Content-Type: application/json
X-Api-Key: test-key-123

{
  "url": "https://example.com",
  "extractionInstructions": "Extract the page title and main content",
  "outputSchema": {
    "type": "object", 
    "properties": {
      "title": {"type": "string"},
      "content": {"type": "string"}
    }
  }
}
```

### Get Extraction Status
```bash
GET /api/extract/{jobId}
```

### AI-Powered Processing
```bash
POST /api/ai/process
Content-Type: application/json

{
  "prompt": "Extract contact information from https://example.com",
  "autoExecute": true
}
```

## Testing the Deployment

### 1. Health Check
```bash
curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health
```

Expected response:
```json
{
  "status": "healthy",
  "message": "Atlas Codex API is running!",
  "features": {
    "dynamodb": true,
    "sqs": true,
    "s3": true,
    "playwright": false
  }
}
```

### 2. Test Unified Extractor
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: test-key-123" \
  -d '{
    "url": "https://example.com",
    "extractionInstructions": "Extract the page title and description"
  }' \
  https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract
```

Expected response:
```json
{
  "jobId": "extract_1693872000000_abc123def",
  "status": "completed",
  "message": "Extraction completed", 
  "result": {
    "success": true,
    "data": [...],
    "metadata": {
      "processingMethod": "unified_extractor_option_c",
      "unifiedExtractor": true,
      "fallbackUsed": false
    }
  }
}
```

## Frontend Integration

The frontend at your existing URL should now work with the unified extractor. The API endpoints remain the same:

- **API Base**: `https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev`
- **Extract Endpoint**: `POST /api/extract`
- **Health Check**: `GET /health`

## Unified Extractor Features

### ✅ What's Included
- **Single AI Call**: GPT-4o generates schema and extracts data in one request
- **AJV Validation**: Strict JSON schema validation with phantom field removal
- **Clean Fallback**: Falls back to existing plan-based system if unified extractor fails
- **Feature Flag**: Can be enabled/disabled via environment variable
- **Zero Deterministic Bias**: Pure AI extraction without hardcoded patterns

### ⚡ Performance Benefits
- **Faster Processing**: Single AI call instead of multi-stage pipeline
- **Better Accuracy**: AI-generated schemas match user intent exactly
- **Cleaner Output**: AJV validation ensures structured, validated data
- **Reliability**: Automatic fallback ensures high availability

## Troubleshooting

### Common Issues

**1. "OpenAI not initialized" Error**
- Ensure `OPENAI_API_KEY` is set in Lambda environment
- Verify API key has sufficient credits

**2. "Unified extractor disabled" Message**
- Set `UNIFIED_EXTRACTOR_ENABLED=true` in Lambda environment
- Redeploy with correct environment variable

**3. AJV Validation Errors**
- Check that output schema is valid JSON Schema
- Ensure extracted data matches the schema structure

**4. API Gateway 502/503 Errors**
- Check Lambda logs in CloudWatch
- Verify all dependencies are included in deployment package
- Ensure Lambda has sufficient memory/timeout

### Monitoring

**CloudWatch Logs**: Check `/aws/lambda/atlas-codex-dev-api` for detailed logs

**Key Log Messages**:
- `🎯 Using Unified Extractor (Option C)` - Unified extractor active
- `📋 Unified extractor disabled, using plan-based system` - Fallback mode
- `✅ AJV validation passed` - Successful validation
- `❌ AJV validation failed` - Schema validation issues

## Rollback Plan

If issues occur, you can quickly disable the unified extractor:

```bash
# Disable unified extractor (uses plan-based fallback)
export UNIFIED_EXTRACTOR_ENABLED=false
serverless deploy --stage dev
```

Or redeploy the previous version:
```bash
serverless rollback --timestamp [timestamp] --stage dev
```

## Next Steps

1. **Monitor Performance**: Watch CloudWatch metrics for latency/errors
2. **Test Thoroughly**: Verify extraction accuracy across different sites
3. **Enable Globally**: Set `UNIFIED_EXTRACTOR_ENABLED=true` permanently
4. **Scale Resources**: Increase Lambda memory/timeout if needed
5. **Add Monitoring**: Set up CloudWatch alarms for failures

## Support

- Check CloudWatch logs for detailed error messages
- Verify all environment variables are set correctly
- Test individual components (OpenAI API, AJV validation, etc.)
- Use the health check endpoint to verify service status

The unified extractor is now deployed and ready to process extraction requests from your frontend! 🚀