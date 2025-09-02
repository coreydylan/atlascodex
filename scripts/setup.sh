#!/bin/bash

# Atlas Codex Setup Script
set -e

echo "🚀 Setting up Atlas Codex development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20.x or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -c2-)
REQUIRED_VERSION="20.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
    echo "✅ Node.js version $NODE_VERSION is compatible"
else
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js 20.x or higher."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Bootstrap packages
echo "🔗 Bootstrapping monorepo packages..."
npm run bootstrap

# Build core package first
echo "🏗️ Building core package..."
cd packages/core && npm run build && cd ../..

# Copy environment file
if [ ! -f .env ]; then
    echo "📋 Creating .env file from .env.dev template..."
    cp .env.dev .env
    echo "⚠️  Please update .env with your actual API keys!"
fi

# Start local services
echo "🐳 Starting local services with Docker..."
if command -v docker-compose &> /dev/null; then
    docker-compose -f infrastructure/docker/docker-compose.dev.yml up -d redis localstack
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    docker compose -f infrastructure/docker/docker-compose.dev.yml up -d redis localstack
else
    echo "⚠️  Docker not found. Local services will need to be started manually."
fi

echo ""
echo "✅ Setup complete! Next steps:"
echo ""
echo "1. Update .env with your OpenAI API key"
echo "2. Run 'npm run dev' to start all services"
echo "3. Visit http://localhost:5173 for the frontend"
echo "4. Visit http://localhost:3000/health for API health check"
echo ""
echo "📚 Commands:"
echo "  npm run dev              - Start all services in development mode"
echo "  npm run build           - Build all packages"
echo "  npm run test            - Run all tests"
echo "  npm run lint            - Run linting"
echo "  npm run docker:up       - Start all services with Docker"
echo ""