#!/bin/bash
set -e

echo "🚀 Deploying simple API to ECS..."

REGION="us-west-2"
CLUSTER="atlas-codex"
SERVICE="atlas-api"

# Build and push to ECR
cd packages/api

# Create ECR repository if needed
aws ecr describe-repositories --repository-names atlas-simple-api --region $REGION 2>/dev/null || \
  aws ecr create-repository --repository-name atlas-simple-api --region $REGION

# Get login token
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin 790856971687.dkr.ecr.$REGION.amazonaws.com

# Build and push
docker build -f Dockerfile.simple -t atlas-simple-api .
docker tag atlas-simple-api:latest 790856971687.dkr.ecr.$REGION.amazonaws.com/atlas-simple-api:latest
docker push 790856971687.dkr.ecr.$REGION.amazonaws.com/atlas-simple-api:latest

cd ../..

# Create task definition
cat > task-def-simple.json <<EOF
{
  "family": "atlas-simple-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "790856971687.dkr.ecr.$REGION.amazonaws.com/atlas-simple-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "PORT", "value": "3000"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/atlas-simple-api",
          "awslogs-region": "$REGION",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Create log group
aws logs create-log-group --log-group-name /ecs/atlas-simple-api --region $REGION 2>/dev/null || true

# Register task
aws ecs register-task-definition --cli-input-json file://task-def-simple.json --region $REGION

# Get VPC info
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text --region $REGION)
SUBNET_1=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=availability-zone,Values=${REGION}a" --query "Subnets[0].SubnetId" --output text --region $REGION)
SUBNET_2=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=availability-zone,Values=${REGION}b" --query "Subnets[0].SubnetId" --output text --region $REGION)

# Get target group ARN
TG_ARN=$(aws elbv2 describe-target-groups --names atlas-codex-api-tg --query "TargetGroups[0].TargetGroupArn" --output text --region $REGION 2>/dev/null || echo "")

if [ -z "$TG_ARN" ]; then
  echo "Creating target group..."
  TG_ARN=$(aws elbv2 create-target-group \
    --name atlas-codex-api-tg \
    --protocol HTTP \
    --port 3000 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path /health \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text \
    --region $REGION)
fi

# Create or update service
aws ecs create-service \
  --cluster $CLUSTER \
  --service-name $SERVICE \
  --task-definition atlas-simple-api \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=api,containerPort=3000" \
  --region $REGION 2>/dev/null || \
aws ecs update-service \
  --cluster $CLUSTER \
  --service $SERVICE \
  --task-definition atlas-simple-api \
  --desired-count 1 \
  --region $REGION

echo "✅ Deployed! Service will be available at https://api.atlascivica.com in 2-3 minutes"