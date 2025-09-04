#!/bin/bash

# Atlas Codex Extraction Test Script
API_URL="https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract"
API_KEY="test-key-123"

# Test 1: vmota.org/people
echo "Testing vmota.org/people..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "url": "https://vmota.org/people",
    "extractionInstructions": "Extract the name, title, and bio for every staff member",
    "formats": ["structured"],
    "UNIFIED_EXTRACTOR_ENABLED": true
  }' | jq '.result.data | length'

# Test 2: NY Times headlines
echo "Testing nytimes.com headlines..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "url": "https://www.nytimes.com",
    "extractionInstructions": "Extract the main news headlines",
    "formats": ["structured"],
    "UNIFIED_EXTRACTOR_ENABLED": true
  }' | jq '.result.data[0:3]'

# Test 3: LA Times
echo "Testing latimes.com..."
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "url": "https://www.latimes.com",
    "extractionInstructions": "Extract the top news headlines",
    "formats": ["structured"],
    "UNIFIED_EXTRACTOR_ENABLED": true
  }' | jq '.result.data | length'
