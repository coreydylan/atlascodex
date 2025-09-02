#!/bin/bash

# Simple EC2 deployment for Atlas Codex
set -e

echo "🚀 Deploying Atlas Codex to AWS EC2..."

REGION="us-west-2"
INSTANCE_TYPE="t3.small"
KEY_NAME="atlas-codex-key"

# Step 1: Create key pair if it doesn't exist
echo "Creating key pair..."
aws ec2 create-key-pair --key-name $KEY_NAME --query 'KeyMaterial' --output text --region $REGION > atlas-codex.pem 2>/dev/null || echo "Key exists"
chmod 400 atlas-codex.pem 2>/dev/null || true

# Step 2: Get latest Amazon Linux 2 AMI
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" \
  --query 'Images[0].ImageId' \
  --output text \
  --region $REGION)

echo "Using AMI: $AMI_ID"

# Step 3: Create security group
echo "Creating security group..."
SG_ID=$(aws ec2 create-security-group \
  --group-name atlas-codex-sg \
  --description "Atlas Codex Security Group" \
  --query 'GroupId' \
  --output text \
  --region $REGION 2>/dev/null || \
  aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=atlas-codex-sg" \
  --query 'SecurityGroups[0].GroupId' \
  --output text \
  --region $REGION)

# Allow SSH and HTTP
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0 --region $REGION 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 3000 --cidr 0.0.0.0/0 --region $REGION 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0 --region $REGION 2>/dev/null || true

# Step 4: Launch instance with simple Node.js setup
echo "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type $INSTANCE_TYPE \
  --key-name $KEY_NAME \
  --security-group-ids $SG_ID \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=atlas-codex-api}]' \
  --query 'Instances[0].InstanceId' \
  --output text \
  --region $REGION \
  --user-data '#!/bin/bash
yum update -y
curl -sL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs git
cd /home/ec2-user
cat > server.js <<EOF
const http = require("http");
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.url === "/health") {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify({status: "healthy", timestamp: new Date().toISOString()}));
  } else if (req.url === "/extract" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const jobId = "job_" + Date.now();
      res.writeHead(200, {"Content-Type": "application/json"});
      res.end(JSON.stringify({jobId, status: "processing"}));
    });
  } else if (req.url.startsWith("/jobs/")) {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify({status: "completed", result: {title: "Test", content: "Sample extraction"}}));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(3000, "0.0.0.0", () => console.log("API running on port 3000"));
EOF
nohup node server.js > api.log 2>&1 &')

echo "Instance launched: $INSTANCE_ID"
echo "Waiting for instance to be running..."

aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text \
  --region $REGION)

echo ""
echo "✅ Atlas Codex API deployed to EC2!"
echo "📍 Instance ID: $INSTANCE_ID"
echo "📍 Public IP: $PUBLIC_IP"
echo "📍 API Endpoint: http://$PUBLIC_IP:3000"
echo ""
echo "Wait 1-2 minutes for setup, then test with:"
echo "  curl http://$PUBLIC_IP:3000/health"