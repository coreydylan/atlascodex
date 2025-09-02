#!/bin/bash

# Build and push worker Docker image to ECR
# Run this on an EC2 instance or Cloud9 with Docker installed

set -e

echo "🚀 Building and pushing Atlas Codex Worker Docker image"

# Variables
REGION="us-west-2"
ACCOUNT_ID="790856971687"
REPO_NAME="atlas-codex-worker"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}"

# Download deployment package from S3
echo "📥 Downloading deployment package..."
aws s3 cp s3://atlas-codex-artifacts-1756627961036/deployments/worker-deployment.zip . --region ${REGION}
unzip -o worker-deployment.zip

# Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URI}

# Build Docker image
echo "🏗️ Building Docker image..."
docker build -f Dockerfile.worker -t ${REPO_NAME} .

# Tag image
echo "🏷️ Tagging image..."
docker tag ${REPO_NAME}:latest ${ECR_URI}:latest

# Push to ECR
echo "📤 Pushing to ECR..."
docker push ${ECR_URI}:latest

# Force ECS service update
echo "🔄 Updating ECS service..."
aws ecs update-service \
  --cluster atlas-codex-cluster \
  --service atlas-codex-worker-service \
  --force-new-deployment \
  --region ${REGION}

echo "✅ Build and deployment complete!"