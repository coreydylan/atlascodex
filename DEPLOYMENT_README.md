# 🚀 Atlas Codex - Deployment & Usage Guide

## ✅ **Current Live System Status**

Your Atlas Codex system is **FULLY OPERATIONAL** with all improvements deployed!

### **🌐 Live Endpoints**
- **Frontend**: https://atlas-codex-5okrrcejn-experial.vercel.app
- **API**: https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev
- **Health Check**: https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health

### **✅ Recent Fixes Applied**
1. **Malformed Data Issue** - RESOLVED ✅
   - No more "Cannot read properties of undefined" errors
   - Clean, structured JSON extraction instead of concatenated strings
   - Proper person separation for team member extractions

2. **UI Clarity Issue** - RESOLVED ✅  
   - Clear labeled sections instead of confusing tabs
   - Visual status indicators (✅ success, ⏳ processing, ❌ error)
   - Better error messages and data quality warnings

3. **Frontend-API Connection** - FIXED ✅
   - Updated API keys to match deployed Lambda
   - Frontend now successfully connects to improved extraction system

## 🎯 **How to Use Your System**

### **Method 1: Web Interface (Easiest)**

1. **Go to your frontend**: https://atlas-codex-5okrrcejn-experial.vercel.app
2. **Enter a URL** in the input field
3. **Add extraction instructions** like:
   - "get the name, title, and bio for each team member"
   - "extract all product prices and descriptions"  
   - "find all article titles and publication dates"
4. **Click Extract** and see results in clear, organized sections

### **Method 2: Direct API (Advanced)**

```bash
# Test the health endpoint
curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health

# Extract data from any website
curl -X POST "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract" \
  -H "Content-Type: application/json" \
  -H "x-api-key: atlas-prod-key-2024" \
  -d '{
    "url": "https://vmota.org/people",
    "extractionInstructions": "get the name, title, and bio for each team member",
    "formats": ["structured"]
  }'
```

### **Method 3: Natural Language Mode**

Your system supports natural language processing! Try these in the frontend:

- "Extract team members from https://company.com/about"
- "Get product pricing from https://shop.com/products" 
- "Find all news articles from https://news.com"

## 🏗️ **System Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR LIVE SYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend (Vercel) ←─── Users interact here                    │
│  atlas-codex-ebn0ge4c7-experial.vercel.app                    │
│                 │                                               │
│                 ▼                                               │
│  Lambda API (AWS) ←─── Improved extraction engine             │
│  gxi4vg8gla.execute-api.us-west-2.amazonaws.com               │
│                 │                                               │
│                 ▼                                               │
│  Processing Pipeline:                                           │
│  ┌─────────────────────────────────────────────────────┐      │
│  │ 1. Plan-Based System                                │      │
│  │ 2. Domain Intelligence Profiles (DIP)              │      │
│  │ 3. Multi-Strategy Extraction                        │      │
│  │ 4. Evidence & Verification                          │      │
│  │ 5. Quality Validation                               │      │
│  └─────────────────────────────────────────────────────┘      │
│                                                                 │
│  Backend Services (ECS) ←─── Heavy processing & storage       │
│  - Worker Pool                                                 │
│  - Evidence Ledger                                             │
│  - DIP Engine                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 **Deployment Methods**

### **Option 1: Git-Based Deployment (Automated)**

**Setup once, deploy forever:**

1. **Set up GitHub secrets** (one-time):
   ```bash
   ./setup-github-secrets.sh
   ```

2. **Deploy to staging:**
   ```bash
   git checkout main
   git push origin main
   # ✅ Automatically deploys Lambda + ECS + Frontend
   ```

3. **Deploy to production:**
   ```bash
   git checkout production
   git merge main
   git push origin production  
   # ✅ Full production deployment with health checks
   ```

### **Option 2: Direct AWS Deployment (Manual)**

**For quick fixes and updates:**

```bash
# Deploy Lambda only
serverless deploy --stage dev
serverless deploy --stage production

# Deploy ECS services
aws ecs update-service --cluster atlas-staging --service atlas-api --force-new-deployment

# Deploy Frontend (automatic via Vercel git integration)
```

## 📋 **Configuration Files**

### **Frontend Configuration**
```javascript
// packages/frontend/vercel.json
{
  "env": {
    "REACT_APP_API_URL": "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev",
    "REACT_APP_API_KEY": "atlas-prod-key-2024"
  }
}
```

### **Lambda Configuration**
```yaml
# serverless.yml
service: atlas-codex
provider:
  name: aws
  runtime: nodejs20.x
  region: us-west-2
  
functions:
  api:
    handler: api/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
```

### **Environment Variables**
```bash
# .env.production
OPENAI_API_KEY=your-openai-api-key-here
API_KEY=atlas-prod-key-2024
AWS_REGION=us-west-2
```

## 🔍 **Monitoring & Debugging**

### **Health Checks**
```bash
# Check all systems
curl https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/health
curl https://atlas-codex-o9zq4sesd-experial.vercel.app

# Test extraction  
curl -X POST "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract" \
  -H "Content-Type: application/json" \
  -H "x-api-key: atlas-prod-key-2024" \
  -d '{"url": "https://example.com"}'
```

### **View Logs**
```bash
# Lambda logs
aws logs tail /aws/lambda/atlas-codex-dev-api --follow

# GitHub Actions (for deployments)
gh run list
gh run view {run-id} --log

# ECS logs
aws logs tail /ecs/atlas-api --follow
```

### **Common Issues & Quick Fixes**

#### **401 Authentication Error**
```bash
# Problem: Frontend getting 401 errors
# Solution: API key mismatch (FIXED in latest deployment)

# Verify API key in frontend
grep REACT_APP_API_KEY packages/frontend/vercel.json
# Should show: "atlas-prod-key-2024"
```

#### **Extraction Not Working**
```bash
# Test API directly
curl -X POST "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract" \
  -H "x-api-key: atlas-prod-key-2024" \
  -d '{"url": "https://httpbin.org/json"}'

# Check logs for errors
aws logs tail /aws/lambda/atlas-codex-dev-api --since 5m
```

#### **Frontend Not Loading**
```bash
# Check Vercel deployment
vercel --prod ls

# Verify environment variables
vercel env ls
```

## 📊 **Usage Examples**

### **Team Member Extraction**
```javascript
// Frontend or API
{
  "url": "https://company.com/team",
  "extractionInstructions": "get the name, title, and bio for each team member",
  "formats": ["structured"]
}

// Expected output:
{
  "people": [
    {
      "name": "John Smith",
      "title": "CEO", 
      "bio": "John has 15 years of experience..."
    }
  ]
}
```

### **Product Catalog**
```javascript
{
  "url": "https://shop.com/products",
  "extractionInstructions": "extract product names, prices, and descriptions",
  "formats": ["structured"]  
}
```

### **News Articles**
```javascript
{
  "url": "https://news.com",
  "extractionInstructions": "get article titles, authors, and publication dates",
  "formats": ["structured"]
}
```

## 🎯 **Next Steps**

### **Immediate Use (Ready Now)**
1. ✅ **Test your live system** - Go to the frontend URL and try extractions
2. ✅ **Try different websites** - Test various content types
3. ✅ **Use natural language** - Describe what you want in plain English

### **Optional Enhancements**
1. 🔧 **Custom domain** - Set up your own domain (e.g., extractdata.com)
2. 🔧 **Rate limiting** - Add usage quotas and API rate limits
3. 🔧 **Monitoring dashboard** - CloudWatch or custom analytics
4. 🔧 **Batch processing** - Handle multiple URLs simultaneously

### **Advanced Features**
1. 🚀 **Custom extraction templates** - Pre-built patterns for common use cases
2. 🚀 **Real-time WebSocket** - Live progress updates during extraction
3. 🚀 **Webhook integration** - Send results to other systems
4. 🚀 **Data export** - CSV, Excel, database integration

---

## 🎉 **Your System is Ready!**

**✅ Fully operational extraction system**  
**✅ Improved data quality and error handling**  
**✅ Clear, user-friendly interface**  
**✅ Enterprise-grade deployment pipeline**  
**✅ Real-time monitoring and debugging**

**Start extracting data now**: https://atlas-codex-5okrrcejn-experial.vercel.app 🚀