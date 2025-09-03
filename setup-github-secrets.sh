#!/bin/bash
# Atlas Codex - GitHub Secrets Setup Script

set -e

echo "🔐 Atlas Codex - GitHub Secrets Setup"
echo "====================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}GitHub CLI (gh) is not installed.${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated with GitHub
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Please authenticate with GitHub CLI first:${NC}"
    echo "gh auth login"
    exit 1
fi

echo -e "${BLUE}This script will help you set up the required GitHub secrets for automated deployment.${NC}"
echo ""

# Function to set a secret
set_secret() {
    local secret_name=$1
    local description=$2
    local is_sensitive=$3
    
    echo -e "${YELLOW}Setting up: $secret_name${NC}"
    echo "Description: $description"
    
    if [[ $is_sensitive == "true" ]]; then
        echo -n "Enter value (input hidden): "
        read -s secret_value
        echo
    else
        echo -n "Enter value: "
        read secret_value
    fi
    
    if [[ -n "$secret_value" ]]; then
        echo "$secret_value" | gh secret set "$secret_name"
        echo -e "${GREEN}✓ $secret_name set successfully${NC}"
    else
        echo -e "${RED}✗ Skipped $secret_name (empty value)${NC}"
    fi
    echo ""
}

# AWS Credentials
echo -e "${BLUE}=== AWS Credentials ===${NC}"
set_secret "AWS_ACCESS_KEY_ID" "AWS Access Key ID for deployment" true
set_secret "AWS_SECRET_ACCESS_KEY" "AWS Secret Access Key for deployment" true

# API Keys
echo -e "${BLUE}=== API Keys ===${NC}"
set_secret "OPENAI_API_KEY" "OpenAI API key for GPT-5 extraction" true
set_secret "MASTER_API_KEY_STAGING" "Master API key for staging environment" true
set_secret "MASTER_API_KEY_PRODUCTION" "Master API key for production environment" true

# Docker Registry
echo -e "${BLUE}=== Docker Registry ===${NC}"
set_secret "DOCKER_USERNAME" "Docker Hub username" false
set_secret "DOCKER_PASSWORD" "Docker Hub password or access token" true

# Slack Notifications (optional)
echo -e "${BLUE}=== Notifications (Optional) ===${NC}"
echo -e "${YELLOW}Slack webhook for deployment notifications (optional):${NC}"
echo -n "Enter Slack webhook URL (or press Enter to skip): "
read slack_webhook

if [[ -n "$slack_webhook" ]]; then
    echo "$slack_webhook" | gh secret set "SLACK_WEBHOOK"
    echo -e "${GREEN}✓ SLACK_WEBHOOK set successfully${NC}"
else
    echo -e "${YELLOW}✓ Skipped Slack webhook (optional)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 GitHub Secrets Setup Complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Verify all secrets are set: gh secret list"
echo "2. Push to 'main' branch to trigger staging deployment"
echo "3. Push to 'production' branch to trigger production deployment"
echo ""
echo -e "${BLUE}View deployment status:${NC}"
echo "- GitHub Actions: https://github.com/$(gh repo view --json owner,name -q '.owner.login + \"/\" + .name')/actions"
echo "- Repository settings: https://github.com/$(gh repo view --json owner,name -q '.owner.login + \"/\" + .name')/settings/secrets/actions"
echo ""
echo -e "${YELLOW}⚠️  Security Notes:${NC}"
echo "- Never commit secrets to your repository"
echo "- Regularly rotate API keys and tokens"
echo "- Use different keys for staging and production"
echo "- Review secret access in repository settings"