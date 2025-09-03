# 🚀 Quick Deployment Guide - Fix Malformed Data NOW

## ✅ What's Ready
- **Lambda function updated** with improved extraction system
- **All Phase 1 fixes applied**: null safety, schema conformance, person separation
- **UI improvements** for clear result display
- **Deployment scripts prepared**

## 🎯 Deploy in 3 Steps

### Step 1: Get Your AWS Credentials
You'll need your AWS Access Key and Secret Key. If you don't have them:
1. Go to AWS Console → IAM → Users → Your User → Security credentials
2. Create new access key if needed
3. Note down both Access Key ID and Secret Access Key

### Step 2: Run the Deployment
```bash
cd /Users/coreydylan/Developer/atlascodex
./deploy-now.sh
```

When prompted:
- Choose **y** to enter credentials
- Enter your **AWS_ACCESS_KEY_ID**
- Enter your **AWS_SECRET_ACCESS_KEY** (input will be hidden)

### Step 3: Test the Fix
After deployment completes, test the extraction:
```bash
curl -X POST "https://YOUR-API-ID.execute-api.us-west-2.amazonaws.com/dev/api/extract" \
  -H "Content-Type: application/json" \
  -H "x-api-key: atlas-prod-key-2024" \
  -d '{
    "url": "https://vmota.org/people", 
    "extractionInstructions": "get the name, title, and bio for each team member",
    "formats": ["structured"]
  }'
```

## 🎉 Expected Results

**Before (Malformed):**
```json
{
  "people": [
    {"name": "Katrina Bruins Executive Director Katrina is a seasoned...", "title": "", "bio": ""}
  ]
}
```

**After (Fixed):**
```json
{
  "people": [
    {
      "name": "Katrina Bruins",
      "title": "Executive Director", 
      "bio": "Katrina is a seasoned nonprofit leader with over a decade of experience..."
    },
    {
      "name": "Lauryn Dove",
      "title": "Administrative Assistant",
      "bio": "Lauryn is a visual artist with a teaching background..."
    }
  ]
}
```

## 🔧 Alternative: Use Existing AWS Profile

If you already have AWS CLI configured:
```bash
# Check existing profiles
aws configure list-profiles

# Use existing profile
export AWS_PROFILE=your-profile-name
./deploy-now.sh
```

## 🚨 If Deployment Fails

### Common Issues:
1. **AWS Permissions**: Ensure your user has Lambda, API Gateway, CloudFormation permissions
2. **Region Mismatch**: We're deploying to us-west-2 (same as your current Lambda)
3. **Node Version**: Ensure you're using Node 20+

### Quick Fixes:
```bash
# Fix permissions - attach these AWS managed policies to your IAM user:
# - AWSLambdaFullAccess
# - AmazonAPIGatewayAdministrator  
# - CloudFormationFullAccess

# Fix Node version
nvm use 20  # or install Node 20

# Manual Lambda deployment
cd /Users/coreydylan/Developer/atlascodex
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
serverless deploy --stage dev --verbose
```

## 📍 Current Status

Your Lambda at `https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev` is still using the **old extraction system**. After this deployment, it will use our **improved system** with:

✅ **Fixed person separation** - no more concatenated strings
✅ **Null safety** - no more "Cannot read properties of undefined" errors  
✅ **Schema conformance** - clean, structured JSON objects
✅ **Immediate processing** - no queuing delays

---

## ⚡ Ready to Deploy?

Run this command and follow the prompts:
```bash
./deploy-now.sh
```

The deployment takes about 2-3 minutes and will completely fix your malformed data issue! 🎯