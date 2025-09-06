# Vercel Deployment Configuration

## Current Issue
By default, Vercel treats the `main` branch as production. This causes confusion when you want separate dev/production environments.

## Recommended Setup

### 1. Configure Environment Variables in Vercel Dashboard

Go to your Vercel project settings and set up environment variables:

#### For Production (production branch):
```
VITE_API_URL = https://s7vo1vic8b.execute-api.us-west-2.amazonaws.com/production
VITE_API_KEY = atlas-prod-key-2024
VITE_ENVIRONMENT = production
```

#### For Preview/Development (main branch):
```
VITE_API_URL = https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev
VITE_API_KEY = test-key-123
VITE_ENVIRONMENT = development
```

### 2. Configure Git Integration

In Vercel Project Settings > Git:

1. **Production Branch**: Set to `production` (not `main`)
2. **Preview Branches**: Include `main` and feature branches
3. **Domains**:
   - Production: `atlascodex.vercel.app` → `production` branch
   - Preview: `dev-atlascodex.vercel.app` → `main` branch

### 3. Update vercel.json

The `vercel.json` now uses environment variable references (`@variable_name`) that pull from Vercel's dashboard:

```json
{
  "env": {
    "VITE_API_URL": "@vite_api_url",
    "VITE_API_KEY": "@vite_api_key",
    "VITE_ENVIRONMENT": "@environment"
  }
}
```

## How It Works

1. **Push to `main`** → Deploys to preview with dev API
2. **Push to `production`** → Deploys to production with production API
3. **Feature branches** → Deploy to preview environments

## Manual Override (Current Workaround)

Until you configure Vercel properly, you can manually control which API is used by editing `vercel.json`:

### For Dev:
```bash
# Update vercel.json to use dev API
sed -i '' 's|https://s7vo1vic8b.execute-api.us-west-2.amazonaws.com/production|https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev|g' vercel.json
git commit -am "Switch to dev environment"
git push origin main
```

### For Production:
```bash
# Update vercel.json to use production API
sed -i '' 's|https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev|https://s7vo1vic8b.execute-api.us-west-2.amazonaws.com/production|g' vercel.json
git commit -am "Switch to production environment"
git push origin main
```

## Next Steps

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `atlascodex` project
3. Go to Settings → Environment Variables
4. Add the variables listed above
5. Go to Settings → Git
6. Change Production Branch from `main` to `production`

This will properly separate your environments!