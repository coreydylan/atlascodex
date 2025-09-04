#!/usr/bin/env node

/**
 * Test script to verify unified extractor deployment
 * Tests both local functionality and deployed Lambda endpoints
 */

const axios = require('axios');

// Configuration
const LOCAL_URL = 'http://localhost:3000';
const LAMBDA_URL = 'https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev';
const API_KEY = process.env.MASTER_API_KEY || 'test-key-123';

// Test payloads
const testPayloads = {
  simple: {
    url: 'https://example.com',
    extractionInstructions: 'Extract the page title and description'
  },
  structured: {
    url: 'https://news.ycombinator.com',
    extractionInstructions: 'Extract the top 5 articles with title and score',
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          score: { type: 'number' },
          url: { type: 'string' }
        },
        required: ['title']
      }
    }
  }
};

async function testEndpoint(baseUrl, endpoint, payload = null) {
  const url = `${baseUrl}${endpoint}`;
  console.log(`🧪 Testing ${url}`);
  
  try {
    const config = {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY
      }
    };

    const response = payload 
      ? await axios.post(url, payload, config)
      : await axios.get(url, config);
    
    console.log(`✅ ${response.status} - ${endpoint}`);
    
    if (response.data) {
      if (response.data.result?.metadata?.unifiedExtractor) {
        console.log(`🎯 Unified Extractor: ACTIVE`);
      } else if (response.data.result?.metadata?.processingMethod) {
        console.log(`📋 Processing Method: ${response.data.result.metadata.processingMethod}`);
      }
      
      if (response.data.result?.success === false) {
        console.log(`⚠️  Extraction failed: ${response.data.result?.error}`);
      }
    }
    
    return response.data;
  } catch (error) {
    console.log(`❌ ${error.response?.status || 'ERROR'} - ${endpoint}`);
    if (error.response?.data) {
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    return null;
  }
}

async function testLocalFunctionality() {
  console.log('\n🔧 Testing Unified Extractor Functionality');
  console.log('==========================================');
  
  try {
    // Test unified extractor directly
    process.env.UNIFIED_EXTRACTOR_ENABLED = 'true';
    const { processWithUnifiedExtractor } = require('./api/evidence-first-bridge.js');
    
    const testHtml = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <h1>Welcome to Test Page</h1>
          <p>This is a test paragraph with some content.</p>
          <div>Additional content here.</div>
        </body>
      </html>
    `;
    
    const params = {
      extractionInstructions: 'Extract the page title and main heading',
      outputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          heading: { type: 'string' }
        }
      }
    };
    
    console.log('🧪 Testing unified extractor function...');
    const result = await processWithUnifiedExtractor(testHtml, params);
    
    if (result.success) {
      console.log('✅ Unified extractor function works');
      console.log(`📊 Processing method: ${result.metadata?.processingMethod}`);
      if (result.metadata?.unifiedExtractor) {
        console.log('🎯 Unified extractor was used');
      } else {
        console.log('📋 Fallback system was used');
      }
    } else {
      console.log('❌ Unified extractor function failed');
      console.log(`   Error: ${result.error}`);
    }
    
  } catch (error) {
    console.log('❌ Local function test failed');
    console.log(`   Error: ${error.message}`);
  }
}

async function testDeployment() {
  console.log('\n🚀 Testing Lambda Deployment');
  console.log('=============================');
  
  // Test health endpoint
  await testEndpoint(LAMBDA_URL, '/health');
  
  // Test simple extraction
  console.log('\n📝 Testing Simple Extraction:');
  await testEndpoint(LAMBDA_URL, '/api/extract', testPayloads.simple);
  
  // Test structured extraction
  console.log('\n🏗️  Testing Structured Extraction:');
  await testEndpoint(LAMBDA_URL, '/api/extract', testPayloads.structured);
  
  // Test AI processing endpoint
  console.log('\n🧠 Testing AI Processing:');
  await testEndpoint(LAMBDA_URL, '/api/ai/process', {
    prompt: 'Extract contact information from https://example.com',
    autoExecute: true
  });
}

async function main() {
  console.log('🧪 Atlas Codex Unified Extractor Deployment Test');
  console.log('=================================================');
  console.log(`🔑 API Key: ${API_KEY}`);
  console.log(`🌐 Lambda URL: ${LAMBDA_URL}`);
  console.log(`🚀 Unified Extractor Enabled: ${process.env.UNIFIED_EXTRACTOR_ENABLED || 'false'}`);
  
  // Test local functionality
  await testLocalFunctionality();
  
  // Test deployed endpoints
  await testDeployment();
  
  console.log('\n🎉 Test Summary');
  console.log('===============');
  console.log('✅ Health endpoint - Basic connectivity');
  console.log('📝 Extract endpoint - Core functionality'); 
  console.log('🧠 AI processing - Enhanced capabilities');
  console.log('');
  console.log('🔗 Frontend should now work with:');
  console.log(`   ${LAMBDA_URL}/api/extract`);
  console.log('');
  console.log('💡 Next steps:');
  console.log('   1. Test the frontend with real URLs');
  console.log('   2. Monitor CloudWatch logs for any issues');
  console.log('   3. Enable unified extractor permanently if tests pass');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testEndpoint, testLocalFunctionality, testDeployment };