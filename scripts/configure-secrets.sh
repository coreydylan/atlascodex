#!/bin/bash

# Atlas Codex - GitHub Secrets Configuration Script
echo "🔐 Configuring GitHub Secrets for Atlas Codex CI/CD"
echo "===================================================="
echo ""

# Check if we're in the right repo
if ! git remote -v | grep -q "coreydylan/atlascodex"; then
    echo "❌ Error: Not in the atlascodex repository"
    exit 1
fi

# Function to safely set a secret
set_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    
    if [ -n "$SECRET_VALUE" ]; then
        echo "$SECRET_VALUE" | gh secret set "$SECRET_NAME"
        echo "✅ Set $SECRET_NAME"
    else
        echo "⚠️  Skipped $SECRET_NAME (no value provided)"
    fi
}

echo "Setting AWS credentials..."
# Try to get AWS credentials from environment or AWS CLI config
AWS_ACCESS_KEY=$(aws configure get aws_access_key_id 2>/dev/null)
AWS_SECRET_KEY=$(aws configure get aws_secret_access_key 2>/dev/null)

if [ -n "$AWS_ACCESS_KEY" ] && [ -n "$AWS_SECRET_KEY" ]; then
    set_secret "AWS_ACCESS_KEY_ID" "$AWS_ACCESS_KEY"
    set_secret "AWS_SECRET_ACCESS_KEY" "$AWS_SECRET_KEY"
else
    echo "⚠️  AWS credentials not found in AWS CLI config"
    echo "   Please set them manually in GitHub Settings"
fi

echo ""
echo "Setting OpenAI API key..."
# Check for OpenAI key in environment
if [ -n "$OPENAI_API_KEY" ]; then
    set_secret "OPENAI_API_KEY" "$OPENAI_API_KEY"
else
    echo "⚠️  OPENAI_API_KEY not found in environment"
    echo "   Please set it manually in GitHub Settings"
fi

echo ""
echo "Setting API keys for environments..."
# Generate secure API keys
DEV_KEY="dev-$(openssl rand -hex 32)"
PROD_KEY="prod-$(openssl rand -hex 32)"

set_secret "DEV_MASTER_API_KEY" "$DEV_KEY"
set_secret "PROD_MASTER_API_KEY" "$PROD_KEY"

echo ""
echo "📝 Summary:"
echo "-----------"
echo "Development API Key: $DEV_KEY"
echo "Production API Key: $PROD_KEY"
echo ""
echo "Save these keys securely! You'll need them for API access."
echo ""
echo "Next steps:"
echo "1. Go to https://github.com/coreydylan/atlascodex/settings/environments"
echo "2. Create 'development' environment (no restrictions)"
echo "3. Create 'production' environment with:"
echo "   - Required reviewers: 1"
echo "   - Deployment branches: Selected branches → production"
echo ""
echo "✅ Secrets configuration complete!"
