#!/bin/bash

# Deploy production Lambda function with minimal package size

echo "Creating production deployment package..."

# Create temp directory for deployment
rm -rf /tmp/atlas-deploy
mkdir -p /tmp/atlas-deploy

# Copy only necessary API files
cp -r api /tmp/atlas-deploy/
cp package.json /tmp/atlas-deploy/
cp package-lock.json /tmp/atlas-deploy/
cp serverless.yml /tmp/atlas-deploy/

# Move to temp directory
cd /tmp/atlas-deploy

# Install only production dependencies
echo "Installing production dependencies only..."
npm ci --production --omit=dev

# Remove unnecessary files
echo "Removing unnecessary files..."
find . -name "*.md" -delete
find . -name "*.txt" -delete
find . -name ".DS_Store" -delete
find . -name "test" -type d -exec rm -rf {} +
find . -name "tests" -type d -exec rm -rf {} +
find . -name "example" -type d -exec rm -rf {} +
find . -name "examples" -type d -exec rm -rf {} +
find . -name ".github" -type d -exec rm -rf {} +

# Remove large unnecessary dependencies if they exist
rm -rf node_modules/playwright-core
rm -rf node_modules/@types
rm -rf node_modules/typescript
rm -rf node_modules/nodemon
rm -rf node_modules/concurrently
rm -rf node_modules/serverless-offline

# Check package size
echo "Package size:"
du -sh .

# Deploy
echo "Deploying to AWS Lambda..."
npx serverless deploy --stage dev

echo "Deployment complete!"
