#!/bin/bash

echo "Testing Force Multi-Page Feature"
echo "================================"

API_URL="https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev"
API_KEY="test-key-123"

echo ""
echo "Test 1: Standard extraction (should use single-page)"
echo "------------------------------------------------------"
curl -X POST "$API_URL/api/extract" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "url": "https://nytimes.com",
    "extractionInstructions": "extract top 5 headlines",
    "UNIFIED_EXTRACTOR_ENABLED": true
  }' | jq '.result.metadata.processingMethod'

echo ""
echo "Test 2: Force Multi-Page extraction (should use navigation-aware)"
echo "-----------------------------------------------------------------"
curl -X POST "$API_URL/api/extract" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "url": "https://nytimes.com",
    "extractionInstructions": "extract top 5 headlines",
    "UNIFIED_EXTRACTOR_ENABLED": true,
    "forceMultiPage": true
  }' | jq '.result.metadata.processingMethod'

echo ""
echo "Test 3: Force Multi-Page with AI mode"
echo "--------------------------------------"
curl -X POST "$API_URL/api/ai/process" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "prompt": "get the top 5 headlines from nytimes.com",
    "autoExecute": true,
    "UNIFIED_EXTRACTOR_ENABLED": true,
    "forceMultiPage": true
  }' | jq '.result.metadata'