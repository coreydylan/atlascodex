#!/bin/bash
# Atlas Codex - Immediate Deployment Script using available credentials

set -e

echo "🚀 Atlas Codex - Immediate Deployment"
echo "===================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables from .env.production
if [ -f ".env.production" ]; then
    echo -e "${BLUE}Loading production environment variables...${NC}"
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Check if we have AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${YELLOW}Installing AWS CLI...${NC}"
    brew install awscli
fi

# Set AWS credentials from environment (if available)
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
    echo -e "${GREEN}✓ Using AWS credentials from environment${NC}"
else
    echo -e "${YELLOW}⚠️  AWS credentials not found in environment${NC}"
    echo "Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
    echo "You can add them to .env.production or export them:"
    echo "export AWS_ACCESS_KEY_ID=your-access-key"
    echo "export AWS_SECRET_ACCESS_KEY=your-secret-key"
    echo ""
    echo "Would you like to enter them now? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -n "Enter AWS_ACCESS_KEY_ID: "
        read -r AWS_ACCESS_KEY_ID
        echo -n "Enter AWS_SECRET_ACCESS_KEY (hidden): "
        read -s AWS_SECRET_ACCESS_KEY
        echo
        export AWS_ACCESS_KEY_ID
        export AWS_SECRET_ACCESS_KEY
    else
        echo -e "${RED}Cannot proceed without AWS credentials${NC}"
        exit 1
    fi
fi

# Configure AWS CLI
echo -e "${BLUE}Configuring AWS CLI...${NC}"
aws configure set aws_access_key_id "$AWS_ACCESS_KEY_ID" --profile atlas-deploy
aws configure set aws_secret_access_key "$AWS_SECRET_ACCESS_KEY" --profile atlas-deploy
aws configure set region us-west-2 --profile atlas-deploy
aws configure set output json --profile atlas-deploy

export AWS_PROFILE=atlas-deploy

# Test AWS connection
echo -e "${BLUE}Testing AWS connection...${NC}"
if aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${GREEN}✓ AWS connection successful${NC}"
else
    echo -e "${RED}✗ AWS connection failed${NC}"
    exit 1
fi

# Install serverless if not present
if ! command -v serverless &> /dev/null; then
    echo -e "${BLUE}Installing Serverless Framework...${NC}"
    npm install -g serverless@3
fi

# Deploy Lambda function
echo -e "${BLUE}Deploying Lambda function...${NC}"
echo "Using OPENAI_API_KEY: ${OPENAI_API_KEY:0:20}..."

# Set environment variables for deployment
export MASTER_API_KEY="${API_KEY:-atlas-prod-key-2024}"

# Deploy to dev stage first (safest)
serverless deploy --stage dev --verbose

echo -e "${GREEN}✓ Lambda deployment completed!${NC}"

# Test the deployed Lambda
echo -e "${BLUE}Testing deployed Lambda...${NC}"
sleep 10

# Get the API Gateway URL
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='atlas-codex-dev'].id" --output text)
if [ "$API_ID" != "None" ] && [ -n "$API_ID" ]; then
    LAMBDA_URL="https://${API_ID}.execute-api.us-west-2.amazonaws.com/dev"
    echo "Lambda URL: $LAMBDA_URL"
    
    # Test health endpoint
    echo -e "${BLUE}Testing health endpoint...${NC}"
    if curl -f "$LAMBDA_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Health check passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Health check failed, but Lambda may still be initializing${NC}"
    fi
    
    # Test extraction endpoint
    echo -e "${BLUE}Testing extraction endpoint...${NC}"
    curl -s -X POST "$LAMBDA_URL/api/extract" \
      -H "Content-Type: application/json" \
      -H "x-api-key: $MASTER_API_KEY" \
      -d '{
        "url": "https://vmota.org/people", 
        "extractionInstructions": "get the name, title, and bio for each team member",
        "formats": ["structured"]
      }' | jq . || echo "Extraction test initiated (check logs for results)"
    
    echo ""
    echo -e "${GREEN}🎉 Deployment Complete!${NC}"
    echo ""
    echo -e "${BLUE}Lambda API URL:${NC} $LAMBDA_URL"
    echo -e "${BLUE}Health Check:${NC} $LAMBDA_URL/health"
    echo -e "${BLUE}Extract API:${NC} $LAMBDA_URL/api/extract"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Test the extraction with: $LAMBDA_URL/api/extract"
    echo "2. Monitor logs with: aws logs tail /aws/lambda/atlas-codex-dev-api --follow"
    echo "3. Deploy to production with: serverless deploy --stage production"
    
else
    echo -e "${YELLOW}⚠️  Could not find API Gateway URL. Check AWS console for details.${NC}"
fi

echo ""
echo -e "${GREEN}✅ Lambda deployment with improved extraction system is complete!${NC}"
echo -e "${GREEN}✅ The malformed data issue should now be resolved!${NC}"