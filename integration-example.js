/**
 * Integration Example: Using Confidence Scoring in Atlas Codex
 * 
 * This example shows how to integrate the new confidence scoring system
 * into the existing Atlas Codex extraction pipeline.
 */

// Import confidence scoring system (with fallbacks)
let processWithBridgeV5, processWithUnifiedExtractor;

try {
  const bridgeV5 = require('./api/evidence-first-bridge-v5');
  processWithBridgeV5 = bridgeV5.processWithBridgeV5;
  console.log('✅ Bridge V5 with confidence scoring loaded');
} catch (error) {
  console.warn('❌ Bridge V5 not available:', error.message);
}

try {
  const bridge = require('./api/evidence-first-bridge');
  processWithUnifiedExtractor = bridge.processWithUnifiedExtractor;
  console.log('✅ Standard unified extractor loaded');
} catch (error) {
  console.warn('❌ Standard extractor not available:', error.message);
}

/**
 * Enhanced extraction function with confidence scoring
 */
async function performExtractionWithConfidence(htmlContent, params) {
  try {
    console.log('🚀 Starting extraction with confidence scoring...');
    
    if (processWithBridgeV5) {
      // Enable Bridge v5 for confidence scoring
      const enhancedParams = {
        ...params,
        BRIDGE_V5_ENABLED: true
      };
      
      // Perform extraction with confidence scoring
      const result = await processWithBridgeV5(htmlContent, enhancedParams);
      
      // Process the results based on confidence
      return processConfidenceResults(result);
    } else {
      console.log('⚠️ Bridge V5 not available, using mock confidence scoring');
      return mockConfidenceExtraction(htmlContent, params);
    }
    
  } catch (error) {
    console.error('❌ Confidence-enabled extraction failed:', error.message);
    
    if (processWithUnifiedExtractor) {
      // Fallback to standard extraction
      console.log('🔄 Falling back to standard extraction...');
      return await processWithUnifiedExtractor(htmlContent, params);
    } else {
      console.log('🔄 Using mock extraction for demo');
      return mockConfidenceExtraction(htmlContent, params);
    }
  }
}

/**
 * Mock extraction for demonstration purposes
 */
function mockConfidenceExtraction(htmlContent, params) {
  console.log('🎭 Running mock confidence extraction for demonstration');
  
  // Simulate extraction based on HTML content
  const mockData = [];
  const productMatches = htmlContent.match(/<h2>([^<]+)<\/h2>/g) || [];
  const priceMatches = htmlContent.match(/\$[\d,]+\.?\d*/g) || [];
  
  productMatches.forEach((match, index) => {
    const title = match.replace(/<\/?h2>/g, '');
    const price = priceMatches[index] || '$0.00';
    mockData.push({ title, price });
  });
  
  // Simulate confidence based on data quality
  const confidence = mockData.length > 0 ? 0.75 : 0.45;
  const qualityLevel = confidence >= 0.8 ? 'good' : confidence >= 0.6 ? 'acceptable' : 'questionable';
  
  // Create mock alternatives for low confidence
  const alternatives = confidence < 0.8 ? [
    {
      strategy: 'simplifiedSchema',
      confidence: 0.68,
      qualityLevel: 'acceptable',
      model: 'mock',
      data: mockData.map(item => ({ title: item.title })) // Simpler version
    }
  ] : [];
  
  return {
    primary: mockData,
    confidence,
    qualityLevel,
    alternatives,
    recommendation: confidence >= 0.8 ? 
      'Extraction quality is good. Minor review recommended for critical applications.' :
      'Extraction quality is acceptable. Manual review recommended for accuracy.',
    metadata: {
      processingMethod: 'mock_confidence_demo',
      model: 'mock',
      processingTime: 100,
      confidence: {
        score: confidence,
        qualityLevel,
        factors: {
          base: 0.85,
          dataCompleteness: mockData.length > 0 ? 0.8 : 0.2,
          patternRecognition: 0.7
        }
      },
      alternatives: {
        count: alternatives.length,
        generated: alternatives.length > 0
      }
    },
    success: true
  };
}

/**
 * Process extraction results based on confidence scores
 */
function processConfidenceResults(result) {
  const { confidence, qualityLevel, alternatives, recommendedAction } = result;
  
  console.log(`📊 Extraction Confidence: ${confidence} (${qualityLevel})`);
  console.log(`📋 Recommendation: ${result.recommendation}`);
  
  // Decision logic based on confidence
  if (confidence >= 0.90) {
    console.log('✅ High confidence - using primary result');
    return formatFinalResult(result, 'primary');
    
  } else if (confidence >= 0.80) {
    console.log('⚠️ Good confidence - flagging for light review');
    return formatFinalResult(result, 'primary', 'light_review');
    
  } else if (confidence >= 0.70) {
    console.log('⚠️ Acceptable confidence - requiring manual review');
    return formatFinalResult(result, 'primary', 'manual_review');
    
  } else if (alternatives && alternatives.length > 0) {
    console.log('🔄 Low primary confidence - evaluating alternatives');
    return evaluateAlternatives(result);
    
  } else {
    console.log('❌ Low confidence with no alternatives - flagging for manual processing');
    return formatFinalResult(result, 'primary', 'manual_processing');
  }
}

/**
 * Evaluate and select best alternative
 */
function evaluateAlternatives(result) {
  const { primary, confidence: primaryConfidence, alternatives } = result;
  
  // Find best alternative
  const bestAlternative = alternatives.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  );
  
  console.log(`🎯 Best alternative: ${bestAlternative.strategy} (confidence: ${bestAlternative.confidence})`);
  
  // Use alternative if significantly better
  if (bestAlternative.confidence > primaryConfidence + 0.1) {
    console.log('✅ Using best alternative');
    return formatFinalResult({
      ...result,
      primary: bestAlternative.data,
      confidence: bestAlternative.confidence,
      usedAlternative: bestAlternative.strategy
    }, 'alternative');
    
  } else if (alternatives.length >= 2) {
    console.log('🔄 Multiple similar alternatives - requiring manual comparison');
    return formatFinalResult(result, 'primary', 'compare_alternatives');
    
  } else {
    console.log('⚠️ Alternative not significantly better - using primary with review');
    return formatFinalResult(result, 'primary', 'manual_review');
  }
}

/**
 * Format final result for API response
 */
function formatFinalResult(result, source, reviewFlag = null) {
  const finalResult = {
    success: true,
    data: result.primary,
    
    // Confidence information
    confidence: {
      score: result.confidence,
      qualityLevel: result.qualityLevel,
      source: source // 'primary' or 'alternative'
    },
    
    // Processing metadata
    metadata: {
      ...result.metadata,
      confidenceScoring: true,
      reviewRequired: reviewFlag !== null,
      reviewType: reviewFlag,
      alternativesGenerated: result.alternatives ? result.alternatives.length : 0
    }
  };
  
  // Include alternatives in metadata if available
  if (result.alternatives && result.alternatives.length > 0) {
    finalResult.metadata.alternatives = result.alternatives.map(alt => ({
      strategy: alt.strategy,
      confidence: alt.confidence,
      itemCount: alt.data ? alt.data.length : 0
    }));
  }
  
  // Add review recommendations
  if (reviewFlag) {
    finalResult.review = {
      required: true,
      type: reviewFlag,
      reason: result.recommendation,
      priority: reviewFlag === 'manual_processing' ? 'high' : 
               reviewFlag === 'manual_review' ? 'medium' : 'low'
    };
  }
  
  return finalResult;
}

/**
 * Example usage in Lambda handler context
 */
async function handleExtractionRequest(event) {
  try {
    const { url, extractionInstructions, schema } = JSON.parse(event.body);
    
    // Fetch HTML content (simplified)
    const htmlContent = await fetchHtmlContent(url);
    
    // Prepare extraction parameters
    const params = {
      url,
      extractionInstructions,
      schema,
      // Add any other parameters
    };
    
    // Perform extraction with confidence scoring
    const result = await performExtractionWithConfidence(htmlContent, params);
    
    // Return API response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('❌ Extraction request failed:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Extraction failed',
        message: error.message
      })
    };
  }
}

/**
 * Simplified HTML fetching (replace with actual implementation)
 */
async function fetchHtmlContent(url) {
  // This would be replaced with your actual HTML fetching logic
  console.log(`📄 Fetching HTML from: ${url}`);
  return '<html><body>Sample content</body></html>';
}

/**
 * Batch processing example with confidence filtering
 */
async function processBatchWithConfidence(urls, extractionInstructions) {
  const results = [];
  const highConfidenceResults = [];
  const lowConfidenceResults = [];
  
  console.log(`🔄 Processing batch of ${urls.length} URLs with confidence scoring`);
  
  for (const url of urls) {
    try {
      const htmlContent = await fetchHtmlContent(url);
      const params = { url, extractionInstructions };
      
      const result = await performExtractionWithConfidence(htmlContent, params);
      results.push(result);
      
      // Categorize by confidence
      if (result.confidence.score >= 0.8) {
        highConfidenceResults.push(result);
      } else {
        lowConfidenceResults.push(result);
      }
      
    } catch (error) {
      console.error(`❌ Failed to process ${url}:`, error.message);
    }
  }
  
  console.log(`📊 Batch Results:`);
  console.log(`   Total processed: ${results.length}`);
  console.log(`   High confidence: ${highConfidenceResults.length}`);
  console.log(`   Low confidence: ${lowConfidenceResults.length}`);
  console.log(`   Success rate: ${((highConfidenceResults.length / results.length) * 100).toFixed(1)}%`);
  
  return {
    total: results.length,
    highConfidence: highConfidenceResults,
    lowConfidence: lowConfidenceResults,
    successRate: (highConfidenceResults.length / results.length) * 100
  };
}

module.exports = {
  performExtractionWithConfidence,
  handleExtractionRequest,
  processBatchWithConfidence,
  processConfidenceResults
};

// Example usage
if (require.main === module) {
  console.log('🧪 Running confidence scoring integration example...');
  
  // Example extraction
  const sampleHtml = `
    <div>
      <h2>Product 1</h2>
      <span class="price">$19.99</span>
      <p>Great product description</p>
    </div>
    <div>
      <h2>Product 2</h2>
      <span class="price">$29.99</span>
      <p>Another great product</p>
    </div>
  `;
  
  const sampleParams = {
    url: 'https://example.com/products',
    extractionInstructions: 'Extract all products with names and prices'
  };
  
  performExtractionWithConfidence(sampleHtml, sampleParams)
    .then(result => {
      console.log('✅ Example completed successfully!');
      console.log('📊 Final result:', JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('❌ Example failed:', error);
    });
}