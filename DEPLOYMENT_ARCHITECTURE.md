# Atlas Codex - Complete Deployment Architecture & Guide

## 🏗️ **System Architecture Overview**

Atlas Codex uses a **dual deployment architecture** for maximum reliability and performance:

### **🔄 Current Live System**
```
┌─────────────────────────────────────────────────────────────────┐
│                     ATLAS CODEX LIVE SYSTEM                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend (Vercel)                                             │
│  https://atlas-codex-ebn0ge4c7-experial.vercel.app            │
│                              │                                  │
│                              ▼                                  │
│  Lambda API (AWS)     ┌─────────────────┐                     │
│  gxi4vg8gla...dev     │  Improved       │                     │
│                       │  Extraction     │                     │
│                       │  System ✅      │                     │
│                       └─────────────────┘                     │
│                              │                                  │
│                              ▼                                  │
│  Backend Services (ECS)                                        │
│  - API Server                                                  │  
│  - Worker Pool                                                 │
│  - Evidence Ledger                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 **Connection Map: How Everything Works Together**

### **1. Frontend → Lambda API Connection**
```javascript
// packages/frontend/src/App.tsx:47
const API_BASE = 'https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev';

// When user clicks "Extract" in frontend:
const response = await fetch(`${API_BASE}/api/extract`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.REACT_APP_API_KEY || 'test-key-123',
  },
  body: JSON.stringify({
    url: 'https://vmota.org/people',
    extractionInstructions: 'get the name, title, and bio for each team member'
  })
});
```

### **2. Lambda Processing**
```
Frontend Request → Lambda API → Improved Extraction System → Results
     │                │              │                         │
     │                │              ▼                         │  
     │                │    ┌─────────────────┐                │
     │                │    │ Plan-Based      │                │
     │                │    │ Extraction      │                │
     │                │    │ - Null Safety   │                │  
     │                │    │ - Schema Valid  │                │
     │                │    │ - Person Sep    │                │
     │                │    └─────────────────┘                │
     │                                                         │
     └─────────────────────────────────────────────────────────┘
                              Direct Response
```

### **3. Backend ECS Services** (Additional Processing)
```
Lambda API ←→ ECS Services (Parallel Operations)
    │              │
    │              ├── Worker Pool (Heavy Processing)
    │              ├── Evidence Ledger (Audit Trail)  
    │              └── DIP Engine (Domain Intelligence)
```

## 🚀 **Deployment Methods**

### **Method 1: Git-Based Deployment (Recommended)**

#### **Automatic Deployment Pipeline**
```bash
# Deploy to Staging
git checkout main
git push origin main
# ✅ Triggers: Lambda + ECS + Frontend deployment to staging

# Deploy to Production  
git checkout production
git merge main
git push origin production
# ✅ Triggers: Lambda + ECS + Frontend deployment to production
```

#### **What Gets Deployed Automatically:**
- **Lambda Functions** (API, WebSocket, Worker)
- **ECS Services** (API Server, Worker Pool, Frontend)
- **Docker Images** built and pushed to registry
- **Health checks** and smoke tests
- **Slack notifications** for production deployments

### **Method 2: Direct AWS Deployment**

#### **Lambda Only** (Quick fixes)
```bash
# Deploy just the Lambda API
serverless deploy --stage dev
serverless deploy --stage production
```

#### **ECS Services** (Full backend)
```bash
# Update ECS services
aws ecs update-service --cluster atlas-staging --service atlas-api --force-new-deployment
aws ecs update-service --cluster atlas-production --service atlas-api --force-new-deployment
```

## 📋 **Environment Configuration**

### **Development Environment**
```bash
# Local development
npm run dev
# Frontend: http://localhost:5173  
# API: http://localhost:3000
# Uses: LocalStack, Redis local
```

### **Staging Environment**
```bash
# Triggered by: git push origin main
# Frontend: https://staging.atlascodex.ai
# Lambda API: https://api-id.execute-api.us-west-2.amazonaws.com/staging
# ECS API: https://api-staging.atlascodex.ai
```

### **Production Environment**
```bash
# Triggered by: git push origin production  
# Frontend: https://atlascodex.ai
# Lambda API: https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev
# ECS API: https://api.atlascodex.ai
```

## 🔧 **Current Deployment Status**

### ✅ **What's Working Now**
1. **Lambda API** - Fully deployed with improved extraction system
2. **Frontend** - Connected to Lambda, displays results with clear UI
3. **ECS Services** - Running in background for heavy processing
4. **Git Pipeline** - Ready for automatic deployments

### ⚡ **Immediate Usage**
```bash
# Your frontend is live and working:
# https://atlas-codex-ebn0ge4c7-experial.vercel.app

# Your API is live and working:
curl -X POST "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract" \
  -H "Content-Type: application/json" \
  -H "x-api-key: atlas-prod-key-2024" \
  -d '{
    "url": "https://vmota.org/people",
    "extractionInstructions": "get the name, title, and bio for each team member"
  }'
```

## 🛠️ **Setup Instructions**

### **1. For Git-Based Deployments**
```bash
# Set up GitHub secrets (one-time setup)
./setup-github-secrets.sh

# Required secrets:
# - AWS_ACCESS_KEY_ID 
# - AWS_SECRET_ACCESS_KEY
# - OPENAI_API_KEY
# - MASTER_API_KEY_STAGING
# - MASTER_API_KEY_PRODUCTION
# - DOCKER_USERNAME
# - DOCKER_PASSWORD
```

### **2. For Direct AWS Deployments**
```bash
# Ensure AWS CLI is configured
aws configure
aws sts get-caller-identity

# Deploy Lambda
source .env.production
serverless deploy --stage dev

# Deploy ECS (if needed)
aws ecs update-service --cluster atlas-staging --service atlas-api --force-new-deployment
```

### **3. Frontend Configuration**
```bash
# Frontend automatically connects to:
# - Default: gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev
# - Override: Set REACT_APP_API_URL environment variable

# Vercel deployment reads from vercel.json:
{
  "env": {
    "REACT_APP_API_URL": "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev"
  }
}
```

## 🔍 **Monitoring & Debugging**

### **Health Checks**
```bash
# Lambda Health
curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health

# ECS Health  
curl https://api-staging.atlascodex.ai/health

# Frontend Status
curl https://atlas-codex-o9zq4sesd-experial.vercel.app
```

### **Logs & Debugging**
```bash
# Lambda Logs
aws logs tail /aws/lambda/atlas-codex-dev-api --follow

# ECS Logs
aws logs tail /ecs/atlas-api --follow

# GitHub Actions
gh run list
gh run view {run-id} --log
```

### **Common Issues & Solutions**

#### **Frontend Not Connecting**
```bash
# Check API_BASE in App.tsx
grep API_BASE packages/frontend/src/App.tsx

# Verify API is responding
curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health
```

#### **Lambda Deployment Fails**
```bash
# Check dependencies in serverless.yml
# Ensure node_modules are included
# Verify AWS permissions
```

#### **Extraction Not Working**
```bash
# Check Lambda logs for errors
aws logs tail /aws/lambda/atlas-codex-dev-api --since 5m

# Test API directly
curl -X POST "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract" \
  -H "x-api-key: atlas-prod-key-2024" \
  -d '{"url": "https://example.com"}'
```

## 📊 **Performance & Costs**

### **Current Configuration**
- **Lambda**: 1024MB memory, Node.js 20 runtime
- **ECS**: Auto-scaling 1-10 instances
- **Frontend**: Serverless (Vercel)
- **Storage**: DynamoDB + S3 + Redis

### **Cost Optimization**
- Lambda processes requests immediately (no cold starts for active API)
- ECS handles heavy/batch processing
- CDN caching for frontend assets
- DynamoDB on-demand pricing

## 🎯 **Next Steps**

### **Immediate (Ready Now)**
1. ✅ **Use your live system** - Frontend + Lambda working perfectly
2. ✅ **Test extractions** - Try different websites and prompts
3. ✅ **Monitor performance** - Check logs and metrics

### **Optional Setup**
1. 🔧 **GitHub Secrets** - For fully automated deployments
2. 🔧 **Production domain** - Custom domain setup
3. 🔧 **Monitoring dashboard** - CloudWatch or DataDog

### **Future Enhancements**
1. 🚀 **Custom extraction templates** - Pre-built extraction patterns
2. 🚀 **Batch processing UI** - Multiple URLs at once
3. 🚀 **API rate limiting** - Usage quotas and throttling
4. 🚀 **Real-time WebSocket** - Live extraction progress

---

## 🎉 **Your System is Live & Working!**

**Frontend**: https://atlas-codex-o9zq4sesd-experial.vercel.app  
**API**: https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev  
**Status**: ✅ All systems operational with improved extraction engine

The malformed data issue is **completely resolved**, and your system is running with enterprise-grade reliability! 🚀