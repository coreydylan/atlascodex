#!/bin/bash

echo "🚀 Vercel GitHub Integration Setup"
echo "==================================="
echo ""
echo "This will configure Vercel to automatically deploy your frontend"
echo ""

# Check if we're logged in to Vercel
if ! vercel whoami 2>/dev/null; then
    echo "📝 Please log in to Vercel:"
    vercel login
fi

echo ""
echo "Linking project to Vercel..."

# Link the project
vercel link --yes || {
    echo "⚠️  Project may already be linked"
}

echo ""
echo "Setting up environment variables..."

# Set environment variables for all environments
vercel env add VITE_API_URL production < /dev/stdin <<< "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/prod"
vercel env add VITE_API_URL preview < /dev/stdin <<< "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev"
vercel env add VITE_API_URL development < /dev/stdin <<< "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev"

# API Keys (you'll need to update these with your actual keys)
echo "prod-28d4434781ec4cef8b68b00a8e84a6f49d133aab1e605504604a088e33ac97f2" | vercel env add VITE_API_KEY production
echo "dev-e41d8c40f0bc54fcc590dc54b7ebe138344afe9dc41690c38bd99c838116405c" | vercel env add VITE_API_KEY preview
echo "dev-e41d8c40f0bc54fcc590dc54b7ebe138344afe9dc41690c38bd99c838116405c" | vercel env add VITE_API_KEY development

# Environment names
echo "production" | vercel env add VITE_ENVIRONMENT production
echo "development" | vercel env add VITE_ENVIRONMENT preview
echo "development" | vercel env add VITE_ENVIRONMENT development

echo ""
echo "Connecting to GitHub..."

# This will open a browser to connect GitHub
vercel git connect

echo ""
echo "✅ Vercel setup complete!"
echo ""
echo "Configuration Summary:"
echo "----------------------"
echo "Production Branch: production"
echo "Preview Branch: main"
echo "Production URL: https://atlas-codex.vercel.app"
echo "Dev/Preview URL: https://atlas-codex-dev.vercel.app"
echo ""
echo "Environment Variables Set:"
echo "- VITE_API_URL (different per environment)"
echo "- VITE_API_KEY (different per environment)"
echo "- VITE_ENVIRONMENT (different per environment)"
echo ""
echo "Next: Push to main or production branch to trigger deployment!"
