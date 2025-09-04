# Project Overview - Atlas Codex

## What is Atlas Codex?

Atlas Codex is an advanced AI-powered web extraction system that intelligently extracts structured data from websites. It combines web scraping with GPT-4 to understand and extract information based on natural language instructions.

## Core Capabilities

### 1. Intelligent Extraction
- Uses GPT-4o to understand extraction requirements
- Converts natural language instructions to structured data
- Handles complex, nested data structures
- Validates extracted data against schemas

### 2. Navigation-Aware Extraction (CRITICAL FEATURE)
- **Automatically detects multi-page content**
- **Crawls paginated results** (e.g., news articles, team pages)
- **Maintains context across pages**
- **Critical for sites like San Diego Union Tribune (58 headlines)**

### 3. Schema-Based Validation
- Uses AJV for JSON schema validation
- Ensures data quality and consistency
- Provides detailed error reporting
- Supports complex nested schemas

## Key Components

### Backend (AWS Lambda)
- **evidence-first-bridge.js**: Core extraction engine with navigation support
- **lambda.js**: API handler and routing
- **templates/**: Pre-built extraction templates
- Deployed via Serverless Framework
- 60-second timeout (critical for multi-page extraction)

### Frontend (Vercel)
- Simple HTML interface for testing
- Direct API integration
- Auto-deploys from GitHub

### Infrastructure
- **AWS Lambda**: Serverless compute
- **API Gateway**: RESTful API
- **CloudWatch**: Logging and monitoring
- **GitHub Actions**: CI/CD pipeline
- **Vercel**: Frontend hosting

## Business Value

Atlas Codex enables:
1. **Automated data collection** from any website
2. **Structured data extraction** without writing scrapers
3. **Multi-page content aggregation** automatically
4. **High accuracy** through AI understanding
5. **Scalable processing** via serverless architecture

## Current Production Use

The system is actively used for:
- News article extraction (San Diego Union Tribune)
- Team member data collection (VMOTA)
- Product information gathering
- Research data compilation
- Content aggregation

## Success Metrics

- **San Diego Union Tribune**: Successfully extracts 58 headlines
- **VMOTA**: Extracts 6 team members (was 6, now showing 4 - possible site change)
- **Response time**: Under 30 seconds for most extractions
- **Accuracy**: High precision with schema validation

## Critical Dependencies

1. **OpenAI API**: GPT-4o for intelligence
2. **Navigation Detection**: Multi-page crawling logic
3. **AWS Services**: Lambda, API Gateway
4. **Node.js Runtime**: Version 18.x
5. **Serverless Framework**: v3 (not v4 - authentication issues)

## Important Context

This system was stabilized after a critical incident where navigation-aware extraction was accidentally removed. The current stable version (Lambda Version 45, Git tag v1.0.0-stable-navigation) has this feature restored and working correctly.

**The navigation-aware extraction is the KEY differentiator and MUST be preserved.**