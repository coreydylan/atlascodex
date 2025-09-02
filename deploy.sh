#!/bin/bash
# Atlas Codex Deployment Script

set -e

echo "🚀 Atlas Codex Deployment Script"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check environment
if [ -z "$1" ]; then
    echo -e "${RED}Error: Please specify environment (local|docker|k8s|aws)${NC}"
    echo "Usage: ./deploy.sh <environment> [options]"
    exit 1
fi

ENVIRONMENT=$1

# Function to check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js is not installed${NC}"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}npm is not installed${NC}"
        exit 1
    fi
    
    # Check Docker for non-local deployments
    if [ "$ENVIRONMENT" != "local" ]; then
        if ! command -v docker &> /dev/null; then
            echo -e "${RED}Docker is not installed${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}All prerequisites met!${NC}"
}

# Function to setup environment variables
setup_env() {
    if [ ! -f .env ]; then
        echo "Creating .env file..."
        cat > .env << EOF
# Atlas Codex Environment Variables
NODE_ENV=${NODE_ENV:-development}
API_PORT=3000
REDIS_URL=redis://localhost:6379

# API Keys
OPENAI_API_KEY=${OPENAI_API_KEY:-your-openai-key}
API_KEY=${API_KEY:-atlas-dev-key-123}

# AWS Configuration (for production)
AWS_REGION=${AWS_REGION:-us-west-2}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-your-key}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-your-secret}

# Worker Configuration
WORKER_CONCURRENCY=5
MAX_RETRIES=3
JOB_TIMEOUT=300000

# Frontend Configuration
REACT_APP_API_URL=${REACT_APP_API_URL:-http://localhost:3000}
EOF
        echo -e "${YELLOW}Please edit .env file with your actual API keys${NC}"
    fi
}

# Local deployment
deploy_local() {
    echo "Starting local deployment..."
    
    # Install dependencies
    echo "Installing dependencies..."
    npm install
    npm run bootstrap
    
    # Start Redis
    echo "Starting Redis..."
    if command -v redis-server &> /dev/null; then
        redis-server --daemonize yes
    else
        docker-compose up -d redis
    fi
    
    # Build packages
    echo "Building packages..."
    npm run build
    
    # Start services
    echo "Starting services..."
    npm run dev &
    
    echo -e "${GREEN}Local deployment complete!${NC}"
    echo "Access the application at: http://localhost:3001"
    echo "API endpoint: http://localhost:3000"
}

# Docker deployment
deploy_docker() {
    echo "Starting Docker deployment..."
    
    # Build images
    echo "Building Docker images..."
    docker build -t atlas-api ./packages/api
    docker build -t atlas-worker ./packages/worker
    docker build -t atlas-frontend ./packages/frontend
    
    # Start services
    echo "Starting Docker services..."
    docker-compose up -d
    
    # Wait for services
    echo "Waiting for services to start..."
    sleep 10
    
    # Check health
    echo "Checking service health..."
    curl -f http://localhost:3000/health || echo -e "${YELLOW}API not ready yet${NC}"
    
    echo -e "${GREEN}Docker deployment complete!${NC}"
    echo "Access the application at: http://localhost:3001"
    echo "API endpoint: http://localhost:3000"
}

# Kubernetes deployment
deploy_k8s() {
    echo "Starting Kubernetes deployment..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}kubectl is not installed${NC}"
        exit 1
    fi
    
    # Build and push images
    echo "Building and pushing Docker images..."
    REGISTRY=${REGISTRY:-localhost:5000}
    
    docker build -t $REGISTRY/atlas-api ./packages/api
    docker build -t $REGISTRY/atlas-worker ./packages/worker
    docker build -t $REGISTRY/atlas-frontend ./packages/frontend
    
    docker push $REGISTRY/atlas-api
    docker push $REGISTRY/atlas-worker
    docker push $REGISTRY/atlas-frontend
    
    # Apply Kubernetes manifests
    echo "Applying Kubernetes manifests..."
    kubectl apply -f kubernetes/
    
    # Wait for pods
    echo "Waiting for pods to be ready..."
    kubectl wait --for=condition=ready pod -l app=atlas-api -n atlas-codex --timeout=300s
    
    # Get service info
    echo "Getting service information..."
    kubectl get services -n atlas-codex
    
    echo -e "${GREEN}Kubernetes deployment complete!${NC}"
}

# AWS deployment
deploy_aws() {
    echo "Starting AWS deployment..."
    
    # Check terraform
    if ! command -v terraform &> /dev/null; then
        echo -e "${RED}Terraform is not installed${NC}"
        exit 1
    fi
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}AWS CLI is not installed${NC}"
        exit 1
    fi
    
    # Build images
    echo "Building Docker images..."
    docker build -t atlas-api ./packages/api
    docker build -t atlas-worker ./packages/worker
    docker build -t atlas-frontend ./packages/frontend
    
    # Push to ECR
    echo "Pushing to ECR..."
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=${AWS_REGION:-us-west-2}
    ECR_REGISTRY=$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com
    
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    
    docker tag atlas-api:latest $ECR_REGISTRY/atlas-api:latest
    docker tag atlas-worker:latest $ECR_REGISTRY/atlas-worker:latest
    docker tag atlas-frontend:latest $ECR_REGISTRY/atlas-frontend:latest
    
    docker push $ECR_REGISTRY/atlas-api:latest
    docker push $ECR_REGISTRY/atlas-worker:latest
    docker push $ECR_REGISTRY/atlas-frontend:latest
    
    # Deploy infrastructure
    echo "Deploying infrastructure with Terraform..."
    cd terraform
    terraform init
    terraform plan -out=tfplan
    terraform apply tfplan
    
    # Get outputs
    API_URL=$(terraform output -raw api_url)
    APP_URL=$(terraform output -raw app_url)
    
    cd ..
    
    echo -e "${GREEN}AWS deployment complete!${NC}"
    echo "API endpoint: $API_URL"
    echo "Application URL: $APP_URL"
}

# Health check function
health_check() {
    echo "Running health check..."
    
    API_URL=${API_URL:-http://localhost:3000}
    
    response=$(curl -s -w "\n%{http_code}" $API_URL/health)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" == "200" ]; then
        echo -e "${GREEN}API is healthy!${NC}"
        echo "$body" | jq '.'
    else
        echo -e "${RED}API health check failed with status $http_code${NC}"
        exit 1
    fi
}

# Cleanup function
cleanup() {
    echo "Cleaning up..."
    
    case $ENVIRONMENT in
        local)
            pkill -f "npm run dev" || true
            redis-cli shutdown || true
            ;;
        docker)
            docker-compose down
            ;;
        k8s)
            kubectl delete -f kubernetes/ || true
            ;;
        aws)
            cd terraform
            terraform destroy -auto-approve
            cd ..
            ;;
    esac
    
    echo -e "${GREEN}Cleanup complete!${NC}"
}

# Main execution
main() {
    check_prerequisites
    setup_env
    
    case $ENVIRONMENT in
        local)
            deploy_local
            ;;
        docker)
            deploy_docker
            ;;
        k8s|kubernetes)
            deploy_k8s
            ;;
        aws)
            deploy_aws
            ;;
        health)
            health_check
            ;;
        cleanup)
            cleanup
            ;;
        *)
            echo -e "${RED}Unknown environment: $ENVIRONMENT${NC}"
            echo "Valid options: local, docker, k8s, aws, health, cleanup"
            exit 1
            ;;
    esac
}

# Trap for cleanup on exit
trap 'echo -e "\n${YELLOW}Deployment interrupted${NC}"' INT

# Run main function
main

echo ""
echo "================================"
echo "Deployment script completed!"
echo "For help, visit: https://github.com/atlascodex/docs"