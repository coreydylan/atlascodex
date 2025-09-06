#!/usr/bin/env node

/**
 * Environment Variable Sync Script
 * Ensures all environment variables are synchronized across all configuration files
 */

const fs = require('fs');
const path = require('path');

const ENV = process.argv[2] || 'development';

const environments = {
  development: {
    API_URL: 'https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev',
    API_KEY: 'test-key-123',
    MASTER_API_KEY: 'test-key-123',
    WEBSOCKET_URL: 'wss://dev-websocket.atlascodex.com',
    DYNAMODB_SUFFIX: 'dev',
    STAGE: 'dev',
    NODE_ENV: 'development'
  },
  production: {
    API_URL: 'https://s7vo1vic8b.execute-api.us-west-2.amazonaws.com/production',
    API_KEY: 'atlas-prod-key-2024',
    MASTER_API_KEY: process.env.MASTER_API_KEY || 'atlas-prod-key-2024',
    WEBSOCKET_URL: 'wss://prod-websocket.atlascodex.com',
    DYNAMODB_SUFFIX: 'production',
    STAGE: 'production',
    NODE_ENV: 'production'
  }
};

const config = environments[ENV];

if (!config) {
  console.error(`Unknown environment: ${ENV}`);
  console.log('Usage: node sync-env.js [development|production]');
  process.exit(1);
}

console.log(`🔄 Syncing environment variables for: ${ENV}`);

// 1. Update root vercel.json
const vercelConfig = {
  version: 2,
  buildCommand: "cd packages/frontend && npm run build",
  outputDirectory: "packages/frontend/dist",
  env: {
    VITE_API_URL: config.API_URL,
    VITE_API_KEY: config.API_KEY,
    VITE_ENVIRONMENT: ENV
  },
  build: {
    env: {
      VITE_API_URL: config.API_URL,
      VITE_API_KEY: config.API_KEY,
      VITE_ENVIRONMENT: ENV
    }
  },
  headers: [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
      ]
    }
  ]
};

fs.writeFileSync(
  path.join(__dirname, '..', 'vercel.json'),
  JSON.stringify(vercelConfig, null, 2)
);
console.log('✅ Updated vercel.json');

// 2. Create .env files for frontend
const frontendEnv = `VITE_API_URL=${config.API_URL}
VITE_API_KEY=${config.API_KEY}
VITE_ENVIRONMENT=${ENV}
`;

fs.writeFileSync(
  path.join(__dirname, '..', 'packages', 'frontend', `.env.${ENV}`),
  frontendEnv
);
console.log(`✅ Updated packages/frontend/.env.${ENV}`);

// 3. Create .env for backend/Lambda
const backendEnv = `NODE_ENV=${config.NODE_ENV}
MASTER_API_KEY=${config.MASTER_API_KEY}
DYNAMODB_TABLE_SUFFIX=${config.DYNAMODB_SUFFIX}
STAGE=${config.STAGE}
API_URL=${config.API_URL}
`;

fs.writeFileSync(
  path.join(__dirname, '..', `.env.${ENV}`),
  backendEnv
);
console.log(`✅ Updated root .env.${ENV}`);

// 4. Update serverless environment variables
const serverlessPath = path.join(__dirname, '..', 'serverless.yml');
let serverlessContent = fs.readFileSync(serverlessPath, 'utf8');

// Update stage
serverlessContent = serverlessContent.replace(
  /stage:\s*\${opt:stage,\s*'[^']*'}/,
  `stage: \${opt:stage, '${config.STAGE}'}`
);

// Ensure environment variables are set
const envSection = `  environment:
    NODE_ENV: ${config.NODE_ENV}
    MASTER_API_KEY: ${config.MASTER_API_KEY}
    STAGE: ${config.STAGE}`;

// Check if environment section exists and update it
if (serverlessContent.includes('  environment:')) {
  serverlessContent = serverlessContent.replace(
    /  environment:[\s\S]*?(?=\n\w|\n$)/,
    envSection
  );
} else {
  // Add environment section after provider
  serverlessContent = serverlessContent.replace(
    /(provider:[\s\S]*?runtime:[^\n]*)/,
    `$1\n${envSection}`
  );
}

fs.writeFileSync(serverlessPath, serverlessContent);
console.log('✅ Updated serverless.yml environment variables');

console.log(`
🎉 Environment sync complete for ${ENV}!

To use these variables:
- Frontend (Vite): import.meta.env.VITE_API_URL
- Backend (Node): process.env.MASTER_API_KEY
- Vercel Deploy: Automatically uses vercel.json
- Serverless Deploy: serverless deploy --stage ${config.STAGE}
`);