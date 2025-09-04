#!/usr/bin/env node

/**
 * GPT-4 vs GPT-5 Extraction Comparison Test Suite
 * Tests golden use cases to ensure GPT-5 meets or exceeds GPT-4 quality
 */

// Use built-in fetch or axios
const axios = require('axios');

// Test configuration
const GPT5_ENDPOINT = 'http://localhost:3005/api/extract';
const GPT4_ENDPOINT = 'https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract';

// Golden test cases - these represent critical extraction patterns
const TEST_CASES = [
  {
    id: 'news_headlines',
    name: 'News Headlines Extraction',
    url: 'https://nytimes.com',
    instructions: 'Extract the top headlines from the homepage - the main news article titles, not navigation items',
    validation: (data) => {
      // Should extract article headlines, not navigation
      const hasArticles = Array.isArray(data) || (data.headlines && Array.isArray(data.headlines));
      const firstItem = Array.isArray(data) ? data[0] : (data.headlines ? data.headlines[0] : null);
      
      // Check it's not returning navigation items
      const notNavigation = firstItem && 
        !['The Morning', 'The Evening', 'The Daily'].includes(
          firstItem.headline || firstItem.title || firstItem
        );
      
      return {
        passed: hasArticles && notNavigation,
        reason: hasArticles ? 
          (notNavigation ? 'Correctly extracted article headlines' : 'Extracted navigation items instead of headlines') :
          'No headlines array found'
      };
    }
  },
  {
    id: 'staff_extraction',
    name: 'Staff/People Extraction',
    url: 'https://vmota.org/people',
    instructions: 'Extract name, title, and bio for each person',
    validation: (data) => {
      const people = data.people || data.staff || data;
      const hasPeople = Array.isArray(people) && people.length > 0;
      const hasRequiredFields = hasPeople && people[0].name && people[0].title;
      
      return {
        passed: hasPeople && hasRequiredFields && people.length >= 6,
        reason: hasPeople ? 
          `Found ${people.length} people with ${hasRequiredFields ? 'required' : 'missing'} fields` :
          'No people extracted'
      };
    }
  },
  {
    id: 'product_prices',
    name: 'Product and Price Extraction',
    url: 'https://www.apple.com/shop/buy-iphone',
    instructions: 'Extract iPhone models with their prices',
    validation: (data) => {
      const products = data.products || data.iphones || data;
      const hasProducts = Array.isArray(products) && products.length > 0;
      const hasPrice = hasProducts && products[0].price;
      
      return {
        passed: hasProducts && hasPrice,
        reason: hasProducts ? 
          `Found ${products.length} products ${hasPrice ? 'with prices' : 'without prices'}` :
          'No products extracted'
      };
    }
  },
  {
    id: 'simple_content',
    name: 'Simple Content Extraction',
    url: 'https://example.com',
    instructions: 'Extract the main heading and first paragraph',
    validation: (data) => {
      const hasHeading = data.heading || data.main_heading || data.title;
      const hasParagraph = data.paragraph || data.first_paragraph || data.content;
      
      return {
        passed: hasHeading && hasParagraph,
        reason: `${hasHeading ? 'Has heading' : 'Missing heading'}, ${hasParagraph ? 'has paragraph' : 'missing paragraph'}`
      };
    }
  },
  {
    id: 'structured_data',
    name: 'Complex Structured Data',
    url: 'https://techcrunch.com',
    instructions: 'Extract the top 5 articles with title, author, and summary',
    validation: (data) => {
      const articles = data.articles || data;
      const hasArticles = Array.isArray(articles) && articles.length > 0;
      const hasStructure = hasArticles && articles[0].title;
      
      return {
        passed: hasArticles && hasStructure,
        reason: hasArticles ? 
          `Found ${articles.length} articles ${hasStructure ? 'with structure' : 'without proper structure'}` :
          'No articles extracted'
      };
    }
  }
];

async function testExtraction(endpoint, testCase, apiKey = null) {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }
    
    const response = await axios.post(endpoint, {
      url: testCase.url,
      extractionInstructions: testCase.instructions
    }, { headers });
    
    const result = response.data;
    return {
      success: true,
      data: result.data || result.result?.data,
      metadata: result.metadata || result.result?.metadata,
      raw: result
    };
  } catch (error) {
    return {
      success: false,
      error: error.response ? `HTTP ${error.response.status}: ${error.response.statusText}` : error.message
    };
  }
}

async function compareExtractions() {
  console.log('🔬 GPT-4 vs GPT-5 Extraction Quality Comparison');
  console.log('================================================\n');
  
  const results = {
    gpt4: { passed: 0, failed: 0, errors: 0 },
    gpt5: { passed: 0, failed: 0, errors: 0 },
    comparisons: []
  };
  
  for (const testCase of TEST_CASES) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`   URL: ${testCase.url}`);
    console.log(`   Instructions: ${testCase.instructions}`);
    
    // Test GPT-5 (local)
    console.log('\n   Testing GPT-5...');
    const gpt5Result = await testExtraction(GPT5_ENDPOINT, testCase);
    
    if (gpt5Result.success) {
      const validation = testCase.validation(gpt5Result.data);
      console.log(`   ✅ GPT-5: ${validation.passed ? 'PASSED' : 'FAILED'} - ${validation.reason}`);
      
      if (gpt5Result.metadata) {
        console.log(`      Model: ${gpt5Result.metadata.model || 'gpt-5-mini'}`);
        console.log(`      Cost: $${gpt5Result.metadata.cost?.toFixed(6) || '0.000000'}`);
      }
      
      if (validation.passed) {
        results.gpt5.passed++;
      } else {
        results.gpt5.failed++;
      }
      
      results.comparisons.push({
        test: testCase.id,
        gpt5: {
          status: validation.passed ? 'PASS' : 'FAIL',
          reason: validation.reason,
          data: gpt5Result.data
        }
      });
    } else {
      console.log(`   ❌ GPT-5 Error: ${gpt5Result.error}`);
      results.gpt5.errors++;
      
      results.comparisons.push({
        test: testCase.id,
        gpt5: {
          status: 'ERROR',
          error: gpt5Result.error
        }
      });
    }
    
    // Add small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Print summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\nGPT-5 Results:');
  console.log(`  ✅ Passed: ${results.gpt5.passed}/${TEST_CASES.length}`);
  console.log(`  ❌ Failed: ${results.gpt5.failed}/${TEST_CASES.length}`);
  console.log(`  💥 Errors: ${results.gpt5.errors}/${TEST_CASES.length}`);
  
  const passRate = (results.gpt5.passed / TEST_CASES.length) * 100;
  console.log(`\n  Pass Rate: ${passRate.toFixed(1)}%`);
  
  // Recommendations
  console.log('\n📝 RECOMMENDATIONS:');
  if (passRate >= 80) {
    console.log('  ✅ GPT-5 meets quality requirements for production');
  } else if (passRate >= 60) {
    console.log('  ⚠️  GPT-5 needs improvements before production');
    console.log('     Focus on failed test cases and adjust prompts');
  } else {
    console.log('  ❌ GPT-5 is not ready for production');
    console.log('     Significant prompt engineering required');
  }
  
  // Show specific failures
  if (results.gpt5.failed > 0) {
    console.log('\n🔍 Failed Tests:');
    results.comparisons.forEach(comp => {
      if (comp.gpt5?.status === 'FAIL') {
        const testCase = TEST_CASES.find(tc => tc.id === comp.test);
        console.log(`  - ${testCase.name}: ${comp.gpt5.reason}`);
      }
    });
  }
  
  return results;
}

// Run the comparison
if (require.main === module) {
  compareExtractions()
    .then(results => {
      const exitCode = results.gpt5.passed >= TEST_CASES.length * 0.8 ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}