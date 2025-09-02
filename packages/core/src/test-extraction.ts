// Atlas Codex - Test Extraction Service Integration
// Run with: npx ts-node packages/core/src/test-extraction.ts

import { extractionService } from './extraction-service';
import { z } from 'zod';

async function testExtractionStrategies() {
  console.log('🧪 Testing Atlas Codex Extraction Service Integration\n');
  
  const testUrls = [
    'https://example.com',
    'https://news.ycombinator.com',
    'https://github.com/trending'
  ];

  // Test 1: Firecrawl Markdown Extraction
  console.log('📄 Test 1: Firecrawl Markdown Extraction');
  try {
    const result = await extractionService.extract({
      url: testUrls[0],
      strategy: 'firecrawl_markdown'
    });
    
    console.log(`✅ Success: ${result.success}`);
    console.log(`📊 Strategy: ${result.strategy}`);
    console.log(`💰 Cost: $${result.metadata.cost.toFixed(6)}`);
    console.log(`⏱️ Time: ${result.metadata.extractionTime.toFixed(2)}s`);
    console.log(`📝 Content length: ${result.markdown?.length || 0} chars\n`);
  } catch (error) {
    const err = error as Error;
    console.error(`❌ Error: ${err.message}\n`);
  }

  // Test 2: Firecrawl Structured Extraction
  console.log('🔍 Test 2: Firecrawl Structured Extraction');
  
  const ArticleSchema = z.object({
    title: z.string(),
    author: z.string().optional(),
    content: z.string(),
    links: z.array(z.string()).optional()
  });
  
  try {
    const result = await extractionService.extract({
      url: testUrls[1],
      strategy: 'firecrawl_extract',
      extractSchema: ArticleSchema,
      extractPrompt: 'Extract the main article information including title, author, content summary, and any important links.'
    });
    
    console.log(`✅ Success: ${result.success}`);
    console.log(`📊 Strategy: ${result.strategy}`);
    console.log(`💰 Cost: $${result.metadata.cost.toFixed(6)}`);
    console.log(`⏱️ Time: ${result.metadata.extractionTime.toFixed(2)}s`);
    if (result.data) {
      console.log(`📋 Extracted data:`, JSON.stringify(result.data, null, 2).substring(0, 200) + '...\n');
    }
  } catch (error) {
    const err = error as Error;
    console.error(`❌ Error: ${err.message}\n`);
  }

  // Test 3: Scrapling Adaptive (if service is running)
  console.log('🕷️ Test 3: Scrapling Adaptive Extraction');
  try {
    const result = await extractionService.extract({
      url: testUrls[2],
      strategy: 'scrapling_adaptive',
      selectors: {
        title: 'h1',
        repos: '.Box-row h2 a',
        descriptions: '.Box-row p'
      }
    });
    
    console.log(`✅ Success: ${result.success}`);
    console.log(`📊 Strategy: ${result.strategy}`);
    console.log(`💰 Cost: $${result.metadata.cost.toFixed(6)}`);
    console.log(`⏱️ Time: ${result.metadata.extractionTime.toFixed(2)}s`);
    if (result.metadata.adaptiveSelectors) {
      console.log(`🔄 Adaptive selectors saved:`, result.metadata.adaptiveSelectors);
    }
    if (result.data) {
      console.log(`📋 Extracted data keys:`, Object.keys(result.data).join(', '), '\n');
    }
  } catch (error) {
    const err = error as Error;
    console.error(`❌ Error: ${err.message}`);
    console.log('ℹ️ Note: Scrapling service may not be running. Start it with: python packages/core/src/scrapling-service.py\n');
  }

  // Test 4: Auto-strategy Selection
  console.log('🤖 Test 4: Automatic Strategy Selection');
  try {
    const result = await extractionService.extract({
      url: testUrls[0]
      // No strategy specified - let the service choose
    });
    
    console.log(`✅ Success: ${result.success}`);
    console.log(`📊 Auto-selected strategy: ${result.strategy}`);
    console.log(`💰 Cost: $${result.metadata.cost.toFixed(6)}`);
    console.log(`⏱️ Time: ${result.metadata.extractionTime.toFixed(2)}s\n`);
  } catch (error) {
    const err = error as Error;
    console.error(`❌ Error: ${err.message}\n`);
  }

  // Test 5: Fallback Chain
  console.log('🔗 Test 5: Testing Fallback Chain');
  try {
    const result = await extractionService.extract({
      url: 'https://this-will-trigger-fallback-invalid-domain-12345.com',
      strategy: 'scrapling_stealth' // Will fail and trigger fallback
    });
    
    console.log(`✅ Success: ${result.success}`);
    console.log(`📊 Final strategy used: ${result.strategy}`);
    if (result.error) {
      console.log(`⚠️ Error: ${result.error}\n`);
    }
  } catch (error) {
    const err = error as Error;
    console.error(`❌ Error: ${err.message}\n`);
  }

  console.log('✨ Testing complete!');
  
  // Test 6: Check service health
  console.log('\n🏥 Service Health Checks:');
  
  // Check Firecrawl
  try {
    const { firecrawlService } = await import('./firecrawl-service');
    const health = await firecrawlService.healthCheck();
    console.log(`Firecrawl: ${health.status} (API Key Valid: ${health.apiKeyValid})`);
  } catch (error) {
    const err = error as Error;
    console.log(`Firecrawl: Error - ${err.message}`);
  }
  
  // Check Scrapling
  try {
    const axios = await import('axios');
    const response = await axios.default.get('http://localhost:8001/health');
    console.log(`Scrapling: ${response.data.status}`);
  } catch (error) {
    console.log(`Scrapling: Not running (start with: python packages/core/src/scrapling-service.py)`);
  }
}

// Run tests
testExtractionStrategies().catch(console.error);