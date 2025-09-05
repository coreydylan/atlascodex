#!/bin/bash

# Atlas Codex Deployment Script
# This ensures environment variables are always loaded before deployment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default to dev stage if not specified
STAGE=${1:-dev}

echo -e "${YELLOW}🚀 Deploying Atlas Codex to stage: $STAGE${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please create a .env file with your configuration"
    exit 1
fi

# Load environment variables from .env
echo -e "${YELLOW}📦 Loading environment variables from .env${NC}"
set -a  # Mark all new variables for export
source .env
set +a

# Verify critical environment variables
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}❌ Error: OPENAI_API_KEY not found in .env${NC}"
    exit 1
fi

if [ -z "$MASTER_API_KEY" ]; then
    echo -e "${RED}❌ Error: MASTER_API_KEY not found in .env${NC}"
    exit 1
fi

# Show what we're deploying (but hide sensitive data)
echo -e "${GREEN}✅ Environment variables loaded:${NC}"
echo "  OPENAI_API_KEY: ${OPENAI_API_KEY:0:20}..."
echo "  MASTER_API_KEY: ${MASTER_API_KEY:0:10}..."
echo "  STAGE: $STAGE"

# Set stage-specific variables
if [ "$STAGE" = "production" ]; then
    export GPT5_ENABLED=false
    export FORCE_GPT4=true
    export DEFAULT_MODEL_STRATEGY=gpt4_stable
    export MONTHLY_BUDGET=2000.0
    echo -e "${YELLOW}📝 Using production settings: GPT-4 stable${NC}"
elif [ "$STAGE" = "preview" ]; then
    export GPT5_ENABLED=true
    export FORCE_GPT4=false
    export DEFAULT_MODEL_STRATEGY=gpt5_preview
    export MONTHLY_BUDGET=500.0
    echo -e "${YELLOW}📝 Using preview settings: GPT-5 testing${NC}"
else
    export GPT5_ENABLED=true
    export FORCE_GPT4=false
    export DEFAULT_MODEL_STRATEGY=auto
    export MONTHLY_BUDGET=1000.0
    echo -e "${YELLOW}📝 Using dev settings: Auto model selection${NC}"
fi

# Deploy with serverless
echo -e "${YELLOW}🔧 Running serverless deploy...${NC}"
serverless deploy --stage $STAGE

# Verify deployment
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"
API_URL=$(serverless info --stage $STAGE --verbose 2>/dev/null | grep "ServiceEndpoint:" | cut -d' ' -f2)

if [ -n "$API_URL" ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo -e "${GREEN}API Endpoint: $API_URL${NC}"
    
    # Test health endpoint
    echo -e "${YELLOW}Testing health endpoint...${NC}"
    curl -s "$API_URL/health" | python3 -m json.tool || echo "Health check failed"
else
    echo -e "${RED}❌ Could not verify deployment${NC}"
fi

echo -e "${GREEN}🎉 Deployment complete for stage: $STAGE${NC}"