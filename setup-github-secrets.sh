#!/bin/bash

# Setup GitHub Secrets for Atlas Codex
# This ensures deployments always have the right environment variables

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔐 Setting up GitHub Secrets for Atlas Codex${NC}"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) not found. Please install it first:${NC}"
    echo "brew install gh"
    exit 1
fi

# Check if we're in the right repo
if ! git remote -v | grep -q "atlascodex"; then
    echo -e "${RED}❌ Not in the atlascodex repository${NC}"
    exit 1
fi

# Load from .env file
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

echo -e "${YELLOW}Loading secrets from .env file...${NC}"
source .env

# Function to set a secret
set_secret() {
    local name=$1
    local value=$2
    
    if [ -z "$value" ]; then
        echo -e "${RED}❌ $name is empty, skipping${NC}"
        return
    fi
    
    echo -e "${YELLOW}Setting $name...${NC}"
    echo "$value" | gh secret set "$name" 2>/dev/null && \
        echo -e "${GREEN}✅ $name set successfully${NC}" || \
        echo -e "${RED}❌ Failed to set $name${NC}"
}

# Set all required secrets
echo -e "${YELLOW}📝 Setting GitHub repository secrets...${NC}"

set_secret "OPENAI_API_KEY" "$OPENAI_API_KEY"
set_secret "AWS_ACCESS_KEY_ID" "$AWS_ACCESS_KEY_ID"
set_secret "AWS_SECRET_ACCESS_KEY" "$AWS_SECRET_ACCESS_KEY"
set_secret "DEV_MASTER_API_KEY" "${MASTER_API_KEY:-test-key-123}"
set_secret "PROD_MASTER_API_KEY" "${MASTER_API_KEY:-test-key-123}"

# List current secrets (names only, not values)
echo -e "${YELLOW}📋 Current GitHub Secrets:${NC}"
gh secret list

echo -e "${GREEN}✅ GitHub Secrets setup complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Push to main branch to trigger dev deployment"
echo "2. Merge to production branch to trigger production deployment"
echo "3. All deployments will now have the correct environment variables!"