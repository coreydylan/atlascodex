#!/bin/bash

# Test script to validate production fixes
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Testing Atlas Codex Production Fixes${NC}"
echo "========================================="

# Test 1: Health Check
echo -e "\n${YELLOW}Test 1: Health Check${NC}"
HEALTH_RESPONSE=$(curl -s https://s7vo1vic8b.execute-api.us-west-2.amazonaws.com/production/health)
if echo "$HEALTH_RESPONSE" | grep -q "\"healthy\":true"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "$HEALTH_RESPONSE"
fi

# Test 2: Create extraction job
echo -e "\n${YELLOW}Test 2: Creating extraction job${NC}"
JOB_RESPONSE=$(curl -s -X POST https://s7vo1vic8b.execute-api.us-west-2.amazonaws.com/production/api/extract \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-123" \
  -d '{
    "url": "https://example.com",
    "extractionInstructions": "Extract the page title and main heading"
  }')

if echo "$JOB_RESPONSE" | grep -q "jobId"; then
    JOB_ID=$(echo "$JOB_RESPONSE" | grep -o '"jobId":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✓ Job created successfully: $JOB_ID${NC}"
    
    # Test 3: Poll job status
    echo -e "\n${YELLOW}Test 3: Polling job status${NC}"
    sleep 2
    
    STATUS_RESPONSE=$(curl -s https://s7vo1vic8b.execute-api.us-west-2.amazonaws.com/production/api/extract/$JOB_ID \
      -H "x-api-key: test-api-key-123")
    
    if echo "$STATUS_RESPONSE" | grep -q "status"; then
        echo -e "${GREEN}✓ Job polling works!${NC}"
        echo "Status response: $STATUS_RESPONSE" | head -1
    else
        echo -e "${RED}✗ Job polling failed${NC}"
        echo "$STATUS_RESPONSE"
    fi
else
    echo -e "${RED}✗ Job creation failed${NC}"
    echo "$JOB_RESPONSE"
fi

# Test 4: Check DynamoDB table
echo -e "\n${YELLOW}Test 4: Checking DynamoDB table${NC}"
TABLE_CHECK=$(aws dynamodb describe-table --table-name atlas-codex-jobs-production 2>&1)
if echo "$TABLE_CHECK" | grep -q "TableStatus"; then
    echo -e "${GREEN}✓ DynamoDB table exists and is accessible${NC}"
else
    echo -e "${RED}✗ DynamoDB table check failed${NC}"
fi

echo -e "\n${GREEN}=========================================${NC}"
echo -e "${GREEN}Production Fix Validation Complete!${NC}"