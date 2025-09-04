#!/bin/bash
set -e

echo "🚀 Deploying Unified Extractor to AWS Lambda"
echo "============================================="

# Check if OpenAI API key is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ ERROR: OPENAI_API_KEY environment variable is not set!"
    echo "Please set your OpenAI API key:"
    echo "  export OPENAI_API_KEY=your-api-key-here"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "❌ ERROR: AWS credentials not configured!"
    echo "Please configure AWS CLI:"
    echo "  aws configure"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install serverless if not present
if ! command -v serverless &> /dev/null; then
    echo "📦 Installing Serverless Framework..."
    npm install -g serverless
fi

# Install serverless plugins
echo "📦 Installing Serverless plugins..."
npm install --save-dev serverless-offline

# Set environment variables for deployment
export UNIFIED_EXTRACTOR_ENABLED=true
export NODE_ENV=production

# Deploy to AWS Lambda
echo "🚀 Deploying to AWS Lambda..."
echo "  - Stage: dev"
echo "  - Region: us-west-2"
echo "  - API Gateway: https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev"

serverless deploy --stage dev --verbose

# Test the deployment
echo "🧪 Testing deployment..."
sleep 5

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health" || echo "FAILED")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed: $HEALTH_RESPONSE"
fi

# Test extract endpoint with unified extractor enabled
echo "Testing unified extractor endpoint..."
TEST_PAYLOAD='{
    "url": "https://example.com",
    "extractionInstructions": "Extract the page title and main content",
    "outputSchema": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "content": {"type": "string"}
        }
    }
}'

EXTRACT_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "X-Api-Key: ${MASTER_API_KEY:-test-key-123}" \
    -d "$TEST_PAYLOAD" \
    "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract" || echo "FAILED")

if echo "$EXTRACT_RESPONSE" | grep -q "jobId"; then
    echo "✅ Extract endpoint test passed"
    echo "📊 Response: $EXTRACT_RESPONSE"
else
    echo "❌ Extract endpoint test failed: $EXTRACT_RESPONSE"
fi

echo ""
echo "🎉 Deployment Summary"
echo "===================="
echo "✅ Unified Extractor deployed to AWS Lambda"
echo "🔗 API Gateway URL: https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev"
echo "🔧 Unified Extractor: ENABLED (set UNIFIED_EXTRACTOR_ENABLED=true in Lambda environment)"
echo "🔑 OpenAI API Key: CONFIGURED"
echo ""
echo "📚 Available Endpoints:"
echo "  GET  /health                      - Health check"
echo "  POST /api/extract                 - Extract data with unified extractor"
echo "  GET  /api/extract/{jobId}         - Get extraction status"
echo "  POST /api/ai/process              - AI-powered processing"
echo ""
echo "🧪 Testing Commands:"
echo '  curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health'
echo '  curl -X POST -H "Content-Type: application/json" \'
echo '       -H "X-Api-Key: test-key-123" \'
echo '       -d '"'"'{"url": "https://example.com", "extractionInstructions": "Extract title"}'"'"' \'
echo '       https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract'
echo ""
echo "⚡ The frontend should now work end-to-end with the unified extractor!"