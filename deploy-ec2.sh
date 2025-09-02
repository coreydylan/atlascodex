#!/bin/bash

# Deploy everything to a single EC2 instance
# This is the SIMPLEST option - everything in one place

echo "🚀 Deploying Atlas Codex to EC2..."

# 1. Launch EC2 instance (t3.medium is enough to start)
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name your-key \
  --security-groups atlas-codex-sg \
  --user-data file://ec2-setup.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=atlas-codex}]' \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "Instance created: $INSTANCE_ID"

# 2. Wait for instance to be running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# 3. Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "Public IP: $PUBLIC_IP"

# 4. Setup security group
aws ec2 authorize-security-group-ingress \
  --group-name atlas-codex-sg \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-name atlas-codex-sg \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# 5. SSH and deploy
echo "Waiting for instance to be ready..."
sleep 30

ssh -i your-key.pem ubuntu@$PUBLIC_IP << 'EOF'
  # Install dependencies
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs docker.io docker-compose nginx certbot python3-certbot-nginx
  
  # Clone your repo
  git clone https://github.com/yourusername/atlas-codex.git
  cd atlas-codex
  
  # Install and start
  npm install
  npx playwright install-deps
  npx playwright install chromium
  
  # Start with PM2
  sudo npm install -g pm2
  pm2 start api/server.js --name atlas-api
  pm2 startup
  pm2 save
  
  # Setup Nginx
  sudo tee /etc/nginx/sites-available/atlas-codex << NGINX
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX
  
  sudo ln -s /etc/nginx/sites-available/atlas-codex /etc/nginx/sites-enabled/
  sudo nginx -t
  sudo systemctl restart nginx
  
  echo "✅ Deployment complete!"
EOF

echo "Atlas Codex is now running at http://$PUBLIC_IP"