#!/bin/bash

echo "🚀 Atlas Codex Worker Starting..."
echo "📦 Container ID: $(hostname)"
echo "🔧 Node Version: $(node --version)"
echo "🌐 Playwright Browsers: $PLAYWRIGHT_BROWSERS_PATH"

# Check if required environment variables are set
if [ -z "$QUEUE_URL" ]; then
    echo "❌ Error: QUEUE_URL environment variable is not set"
    exit 1
fi

if [ -z "$AWS_REGION" ]; then
    export AWS_REGION="us-west-2"
    echo "⚠️  Warning: AWS_REGION not set, defaulting to us-west-2"
fi

echo "📊 Queue URL: $QUEUE_URL"
echo "🌍 AWS Region: $AWS_REGION"

# Start the worker
echo "🎯 Starting worker process..."
node api/worker.js