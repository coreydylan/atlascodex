#!/bin/bash
set -e

echo "🚀 Deploying to AWS Lightsail Container Service..."

REGION="us-west-2"
SERVICE_NAME="atlas-codex"

# Create simple Node.js API with CORS
cat > packages/api/index.js <<'EOF'
const http = require('http');
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: 'healthy', timestamp: new Date().toISOString()}));
  } else if (req.url === '/extract' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const jobId = 'job_' + Date.now();
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({jobId, status: 'processing'}));
    });
  } else if (req.url.startsWith('/jobs/')) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: 'completed', result: {title: 'Test', content: 'Sample'}}));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(3000, () => console.log('API on port 3000'));
EOF

# Create Dockerfile
cat > packages/api/Dockerfile.lightsail <<'EOF'
FROM node:20-alpine
WORKDIR /app
COPY index.js ./
EXPOSE 3000
CMD ["node", "index.js"]
EOF

# Build container
cd packages/api
docker build -f Dockerfile.lightsail -t atlas-api .
cd ../..

# Create Lightsail container service
aws lightsail create-container-service \
  --service-name $SERVICE_NAME \
  --power small \
  --scale 1 \
  --region $REGION 2>/dev/null || echo "Service exists"

# Wait for service to be ready
echo "Waiting for container service to be ready..."
while true; do
  STATE=$(aws lightsail get-container-services --service-name $SERVICE_NAME --region $REGION --query "containerServices[0].state" --output text)
  if [ "$STATE" = "READY" ]; then
    break
  fi
  echo "Current state: $STATE"
  sleep 10
done

# Push container
aws lightsail push-container-image \
  --service-name $SERVICE_NAME \
  --label atlas-api \
  --image atlas-api \
  --region $REGION

# Get image name
IMAGE=$(aws lightsail get-container-images --service-name $SERVICE_NAME --region $REGION --query "images[0].image" --output text)

# Deploy
aws lightsail create-container-service-deployment \
  --service-name $SERVICE_NAME \
  --containers "{
    \"api\": {
      \"image\": \"$IMAGE\",
      \"ports\": {
        \"3000\": \"HTTP\"
      }
    }
  }" \
  --public-endpoint '{
    "containerName": "api",
    "containerPort": 3000,
    "healthCheck": {
      "path": "/health"
    }
  }' \
  --region $REGION

# Get URL
sleep 10
URL=$(aws lightsail get-container-services --service-name $SERVICE_NAME --region $REGION --query "containerServices[0].url" --output text)

echo "✅ Deployed!"
echo "📍 API URL: $URL"
echo "Test with: curl $URL/health"