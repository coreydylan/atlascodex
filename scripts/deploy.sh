#!/bin/bash

# Atlas Codex Deployment Script
set -e

ENVIRONMENT=${1:-dev}
VALID_ENVS=("dev" "staging" "prod")

if [[ ! " ${VALID_ENVS[@]} " =~ " ${ENVIRONMENT} " ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Valid environments: ${VALID_ENVS[@]}"
    exit 1
fi

echo "🚀 Deploying Atlas Codex to $ENVIRONMENT environment..."

# Build all packages
echo "🏗️ Building packages..."
npm run build

# Deploy infrastructure
echo "🏗️ Deploying infrastructure to $ENVIRONMENT..."
cd infrastructure/terraform

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
    terraform init
fi

# Select workspace
terraform workspace select $ENVIRONMENT 2>/dev/null || terraform workspace new $ENVIRONMENT

# Apply infrastructure
terraform apply -var-file="environments/${ENVIRONMENT}.tfvars" -auto-approve

cd ../..

# Build and push Docker images if not dev
if [ "$ENVIRONMENT" != "dev" ]; then
    echo "🐳 Building and pushing Docker images..."
    
    # Login to ECR
    aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 790856971687.dkr.ecr.us-east-1.amazonaws.com
    
    # Build worker image
    docker build -t atlas-codex-worker:$ENVIRONMENT packages/worker/
    docker tag atlas-codex-worker:$ENVIRONMENT 790856971687.dkr.ecr.us-east-1.amazonaws.com/atlas-codex-worker:$ENVIRONMENT
    docker push 790856971687.dkr.ecr.us-east-1.amazonaws.com/atlas-codex-worker:$ENVIRONMENT
fi

# Deploy Lambda functions
echo "⚡ Deploying Lambda functions..."
cd packages/api
if [ "$ENVIRONMENT" = "dev" ]; then
    npm run deploy:dev
elif [ "$ENVIRONMENT" = "staging" ]; then
    npm run deploy:staging
else
    npm run deploy:prod
fi
cd ../..

echo "✅ Deployment to $ENVIRONMENT complete!"

if [ "$ENVIRONMENT" = "dev" ]; then
    echo "🌐 Development API: http://localhost:3000"
    echo "🌐 Development Frontend: http://localhost:5173"
elif [ "$ENVIRONMENT" = "staging" ]; then
    echo "🌐 Staging API: https://api-staging.atlascodex.ai"
    echo "🌐 Staging Frontend: https://staging.atlascodex.ai"
else
    echo "🌐 Production API: https://api.atlascodex.ai"
    echo "🌐 Production Frontend: https://atlascodex.ai"
fi