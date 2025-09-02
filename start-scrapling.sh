#!/bin/bash

# Atlas Codex - Start Scrapling Service

echo "🕷️ Starting Scrapling Service for Atlas Codex..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📚 Installing Python dependencies..."
pip install -r requirements.txt

# Start the Scrapling service
echo "🚀 Starting Scrapling service on port 8001..."
echo "📝 Logs will be displayed below. Press Ctrl+C to stop."
echo "---------------------------------------------------"

python packages/core/src/scrapling-service.py