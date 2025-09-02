#!/bin/bash
# Atlas Codex Production Deployment Script

set -e

echo "🚀 Atlas Codex Production Deployment"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
AWS_REGION=${AWS_REGION:-us-west-2}
AWS_ACCOUNT=${AWS_ACCOUNT:-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")}
PROJECT_NAME="atlas-codex"
ENVIRONMENT="production"

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    local missing=()
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        missing+=("AWS CLI")
    fi
    
    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        missing+=("Terraform")
    fi
    
    # Check Vercel CLI
    if ! command -v vercel &> /dev/null; then
        missing+=("Vercel CLI")
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing+=("Docker")
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}Missing required tools: ${missing[*]}${NC}"
        echo ""
        echo "Install missing tools:"
        echo "  AWS CLI: brew install awscli"
        echo "  Terraform: brew install terraform"
        echo "  Vercel CLI: npm i -g vercel"
        echo "  Docker: https://docker.com"
        exit 1
    fi
    
    echo -e "${GREEN}✓ All prerequisites installed${NC}"
}

# Setup AWS credentials
setup_aws() {
    echo ""
    echo "🔐 Setting up AWS..."
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${YELLOW}AWS credentials not configured${NC}"
        echo "Please run: aws configure"
        exit 1
    fi
    
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    echo -e "${GREEN}✓ AWS Account: $AWS_ACCOUNT${NC}"
    echo -e "${GREEN}✓ Region: $AWS_REGION${NC}"
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {
    echo ""
    echo "🏗️  Deploying AWS Infrastructure..."
    
    cd terraform
    
    # Initialize Terraform
    echo "Initializing Terraform..."
    terraform init -upgrade
    
    # Create workspace for production
    terraform workspace select production 2>/dev/null || terraform workspace new production
    
    # Plan deployment
    echo "Planning infrastructure changes..."
    terraform plan -var="environment=$ENVIRONMENT" -out=tfplan
    
    # Apply changes
    echo -e "${YELLOW}Applying infrastructure changes...${NC}"
    terraform apply tfplan
    
    # Get outputs
    echo ""
    echo "📤 Getting infrastructure outputs..."
    
    ALB_DNS=$(terraform output -raw alb_dns_name 2>/dev/null || echo "")
    ECR_API=$(terraform output -raw ecr_repository_api 2>/dev/null || echo "")
    ECR_WORKER=$(terraform output -raw ecr_repository_worker 2>/dev/null || echo "")
    
    cd ..
    
    echo -e "${GREEN}✓ Infrastructure deployed${NC}"
}

# Build and push Docker images
deploy_docker_images() {
    echo ""
    echo "🐳 Building and pushing Docker images..."
    
    # Login to ECR
    echo "Logging into ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com
    
    # Build and push API
    echo "Building API image..."
    docker build -t $PROJECT_NAME-api ./packages/api
    docker tag $PROJECT_NAME-api:latest $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-api:latest
    docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-api:latest
    
    # Build and push Worker
    echo "Building Worker image..."
    docker build -t $PROJECT_NAME-worker ./packages/worker
    docker tag $PROJECT_NAME-worker:latest $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-worker:latest
    docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-worker:latest
    
    echo -e "${GREEN}✓ Docker images deployed to ECR${NC}"
}

# Deploy ECS services
deploy_ecs_services() {
    echo ""
    echo "☁️  Deploying ECS services..."
    
    # Update API service
    echo "Updating API service..."
    aws ecs update-service \
        --cluster $PROJECT_NAME-cluster \
        --service $PROJECT_NAME-api \
        --force-new-deployment \
        --region $AWS_REGION
    
    # Update Worker service
    echo "Updating Worker service..."
    aws ecs update-service \
        --cluster $PROJECT_NAME-cluster \
        --service $PROJECT_NAME-worker \
        --force-new-deployment \
        --region $AWS_REGION
    
    # Wait for services to stabilize
    echo "Waiting for services to stabilize..."
    aws ecs wait services-stable \
        --cluster $PROJECT_NAME-cluster \
        --services $PROJECT_NAME-api $PROJECT_NAME-worker \
        --region $AWS_REGION
    
    echo -e "${GREEN}✓ ECS services deployed${NC}"
}

# Deploy frontend to Vercel
deploy_frontend() {
    echo ""
    echo "▲ Deploying frontend to Vercel..."
    
    cd packages/frontend
    
    # Build frontend
    echo "Building frontend..."
    npm run build
    
    # Deploy to Vercel
    echo "Deploying to Vercel..."
    vercel --prod --yes
    
    cd ../..
    
    echo -e "${GREEN}✓ Frontend deployed to Vercel${NC}"
}

# Setup CloudFlare DNS (optional)
setup_dns() {
    echo ""
    echo "🌐 DNS Configuration"
    echo "==================="
    echo ""
    echo "Please configure the following DNS records:"
    echo ""
    echo "1. API Backend (Route 53 or CloudFlare):"
    echo "   Type: CNAME"
    echo "   Name: api.atlascodex.com"
    echo "   Value: $ALB_DNS"
    echo ""
    echo "2. Frontend (Vercel handles this automatically)"
    echo "   Type: CNAME"
    echo "   Name: app.atlascodex.com"
    echo "   Value: cname.vercel-dns.com"
    echo ""
}

# Run health checks
run_health_checks() {
    echo ""
    echo "🏥 Running health checks..."
    
    # Wait a bit for DNS to propagate
    echo "Waiting for services to be ready..."
    sleep 30
    
    # Check API health
    echo "Checking API health..."
    if curl -f -s "http://$ALB_DNS/health" > /dev/null; then
        echo -e "${GREEN}✓ API is healthy${NC}"
    else
        echo -e "${YELLOW}⚠ API health check failed (DNS may still be propagating)${NC}"
    fi
    
    # Check frontend
    echo "Checking frontend..."
    VERCEL_URL=$(vercel ls --json 2>/dev/null | jq -r '.[0].url' || echo "app.atlascodex.com")
    if curl -f -s "https://$VERCEL_URL" > /dev/null; then
        echo -e "${GREEN}✓ Frontend is accessible${NC}"
    else
        echo -e "${YELLOW}⚠ Frontend check failed${NC}"
    fi
}

# Setup monitoring
setup_monitoring() {
    echo ""
    echo "📊 Setting up monitoring..."
    
    # Create CloudWatch dashboard
    aws cloudwatch put-dashboard \
        --dashboard-name "$PROJECT_NAME-production" \
        --dashboard-body file://monitoring/cloudwatch-dashboard.json \
        --region $AWS_REGION 2>/dev/null || true
    
    # Setup alarms
    aws cloudwatch put-metric-alarm \
        --alarm-name "$PROJECT_NAME-api-cpu-high" \
        --alarm-description "API CPU utilization too high" \
        --metric-name CPUUtilization \
        --namespace AWS/ECS \
        --statistic Average \
        --period 300 \
        --threshold 80 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 2 \
        --region $AWS_REGION 2>/dev/null || true
    
    echo -e "${GREEN}✓ Monitoring configured${NC}"
}

# Main deployment flow
main() {
    echo -e "${BLUE}Starting production deployment...${NC}"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Setup AWS
    setup_aws
    
    # Deploy infrastructure
    deploy_infrastructure
    
    # Build and push Docker images
    deploy_docker_images
    
    # Deploy ECS services
    deploy_ecs_services
    
    # Deploy frontend
    deploy_frontend
    
    # Setup DNS instructions
    setup_dns
    
    # Setup monitoring
    setup_monitoring
    
    # Run health checks
    run_health_checks
    
    echo ""
    echo "===================================="
    echo -e "${GREEN}🎉 Deployment Complete!${NC}"
    echo "===================================="
    echo ""
    echo "📝 Next Steps:"
    echo "1. Configure DNS records as shown above"
    echo "2. Update API keys in production"
    echo "3. Enable SSL certificates"
    echo "4. Configure backup strategy"
    echo "5. Setup error tracking (Sentry)"
    echo ""
    echo "🔗 Access URLs:"
    echo "   API: http://$ALB_DNS (configure DNS: api.atlascodex.com)"
    echo "   App: https://$VERCEL_URL"
    echo ""
    echo "📊 Monitoring:"
    echo "   CloudWatch: https://console.aws.amazon.com/cloudwatch"
    echo "   Vercel Dashboard: https://vercel.com/dashboard"
    echo ""
}

# Error handling
trap 'echo -e "\n${RED}Deployment failed!${NC}"; exit 1' ERR

# Run main deployment
main