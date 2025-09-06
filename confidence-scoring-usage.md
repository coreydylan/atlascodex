# Confidence Scoring System - Usage Guide

## Overview

The Atlas Codex confidence scoring system provides intelligent quality assessment for all extractions, helping users understand extraction reliability and providing alternatives when confidence is low.

## Key Features

### 1. Automatic Confidence Scoring
Every extraction receives a confidence score from 0.0 to 1.0 based on:

- **Model Used**: GPT-5 (0.98) > GPT-5-mini (0.95) > GPT-5-nano (0.90) > GPT-4o (0.92)
- **Data Completeness**: How many expected fields are populated
- **Schema Validation**: AJV validation results and phantom field removal
- **Pattern Recognition**: Consistency across extracted items
- **HTML Complexity**: Page structure and script content
- **Field Quality**: Value quality assessment (empty, HTML artifacts, etc.)

### 2. Alternative Generation
When confidence < 0.9, the system automatically generates alternatives using:

- **Different Models**: Try extraction with different AI model
- **Simplified Schema**: Focus on essential fields only  
- **Multiple Attempts**: Generate consensus from multiple extractions
- **Focused Content**: Extract from specific page sections
- **Pattern Fallback**: Use conservative extraction approach

### 3. Quality Levels
- **excellent** (≥0.95): Use with full confidence
- **high** (≥0.90): Use with confidence
- **good** (≥0.80): Minor review recommended
- **acceptable** (≥0.70): Manual review recommended  
- **questionable** (≥0.60): Manual review required
- **poor** (<0.60): Consider alternative methods

## Usage Examples

### Basic Usage with Evidence-First Bridge v5

```javascript
const { processWithBridgeV5 } = require('./api/evidence-first-bridge-v5');

const params = {
  url: 'https://example.com',
  extractionInstructions: 'Extract all product information',
  BRIDGE_V5_ENABLED: true  // Enable confidence scoring
};

const result = await processWithBridgeV5(htmlContent, params);

console.log('Primary Result:', result.primary);
console.log('Confidence:', result.confidence, '(' + result.qualityLevel + ')');
console.log('Recommendation:', result.recommendation);

if (result.alternatives) {
  console.log('Alternatives Available:', result.alternatives.length);
  result.alternatives.forEach((alt, i) => {
    console.log(`Alt ${i+1}: ${alt.strategy} - Confidence: ${alt.confidence}`);
  });
}
```

### Direct Confidence Scoring

```javascript
const { ConfidenceScorer } = require('./api/services/confidence-scorer');

const scorer = new ConfidenceScorer();
const extraction = {
  data: [
    { title: 'Product 1', price: '$19.99', available: true },
    { title: 'Product 2', price: '$29.99', available: false }
  ],
  schema: { /* your schema */ }
};

const confidenceResult = scorer.calculateConfidence(extraction, {
  model: 'gpt-4o',
  htmlContent: '<html>...</html>',
  validationResult: { valid: true, phantomFieldsRemoved: 0 }
});

console.log('Score:', confidenceResult.score);
console.log('Factors:', confidenceResult.factors);
console.log('Breakdown:', confidenceResult.breakdown);
```

### Alternative Generation

```javascript
const { AlternativeGenerator } = require('./api/services/alternative-generator');

const generator = new AlternativeGenerator();
const alternatives = await generator.generateAlternatives(primaryResult, {
  htmlContent: htmlContent,
  params: extractionParams,
  model: 'gpt-4o',
  confidenceScore: 0.65
});

console.log('Generated', alternatives.totalGenerated, 'alternatives');
console.log('Recommended Strategy:', alternatives.recommendedStrategy);

// Use best alternative if available
if (alternatives.alternatives.length > 0) {
  const bestAlternative = alternatives.alternatives[0];
  if (bestAlternative.confidence > primaryConfidence) {
    console.log('Using alternative:', bestAlternative.strategy);
    // Use bestAlternative.data
  }
}
```

## Result Format

### Enhanced Result Structure

```javascript
{
  // Primary extraction result
  primary: [
    { title: 'Item 1', description: 'Description 1' },
    { title: 'Item 2', description: 'Description 2' }
  ],
  
  // Confidence metrics
  confidence: 0.85,
  qualityLevel: 'good',
  
  // Metadata with detailed scoring
  metadata: {
    processingMethod: 'evidence_first_bridge_v5',
    model: 'gpt-4o',
    processingTime: 1250,
    confidence: {
      score: 0.85,
      qualityLevel: 'good',
      factors: {
        base: 0.92,
        schemaValidation: 0.95,
        dataCompleteness: 0.80,
        patternRecognition: 0.88,
        htmlComplexity: 0.75,
        extractionConsistency: 0.90,
        fieldQuality: 0.82,
        responseStructure: 0.95
      },
      breakdown: {
        baseScore: 0.92,
        adjustments: { /* detailed adjustments */ },
        totalAdjustment: -0.07
      }
    },
    alternatives: {
      count: 2,
      generated: true
    }
  },
  
  // Recommendations
  recommendation: 'Extraction quality is good. Minor review recommended for critical applications.',
  recommendedAction: 'manual_review_recommended',
  
  // Alternatives (if confidence < 0.9)
  alternatives: [
    {
      strategy: 'differentModel',
      data: [ /* alternative extraction */ ],
      confidence: 0.88,
      qualityLevel: 'good',
      model: 'gpt-4'
    },
    {
      strategy: 'simplifiedSchema', 
      data: [ /* simpler extraction */ ],
      confidence: 0.82,
      qualityLevel: 'good',
      model: 'gpt-4o'
    }
  ],
  
  success: true
}
```

## Decision Making Guide

### When to Use Primary Result
- Confidence ≥ 0.90: Use directly
- Confidence ≥ 0.80: Use with light review
- Confidence ≥ 0.70: Use with manual review

### When to Consider Alternatives  
- Primary confidence < 0.9 AND alternatives available
- Best alternative confidence > primary + 0.1
- Multiple alternatives with similar high confidence

### When to Require Manual Review
- All results have confidence < 0.7
- Conflicting alternatives with similar confidence
- High-stakes applications requiring certainty

## Integration with Existing System

### Feature Flag Control
```javascript
// Enable v5 features globally
process.env.BRIDGE_V5_ENABLED = 'true';

// Or per request
const params = {
  // ... other params
  BRIDGE_V5_ENABLED: true
};
```

### Backward Compatibility
The system maintains full backward compatibility. If v5 features are disabled, it falls back to the existing evidence-first-bridge.js system.

### Performance Impact
- Confidence scoring adds ~50-100ms processing time
- Alternative generation (when triggered) adds ~2-5 seconds
- Overall system performance improved through intelligent model selection

## Monitoring and Metrics

### Key Metrics to Track
- Average confidence scores over time
- Alternative generation frequency  
- User acceptance of alternatives
- Correlation between confidence and user satisfaction

### Logging
The system provides detailed logging for:
- Confidence calculation factors
- Alternative generation triggers
- Model selection decisions
- Fallback usage

## Future GPT-5 Integration

The system is designed for GPT-5 integration with:

### Intelligent Model Selection
```javascript
// Future GPT-5 model routing
if (complexity <= 0.3) {
  model = 'gpt-5-nano';    // $0.05/1M tokens
} else if (complexity <= 0.7) {
  model = 'gpt-5-mini';    // $0.25/1M tokens  
} else {
  model = 'gpt-5';         // $1.25/1M tokens
}
```

### Enhanced Reasoning
- GPT-5 reasoning mode for complex extractions
- Self-correction capabilities
- Improved pattern recognition

### Cost Optimization
- 97% cost reduction through tiered model selection
- Automatic complexity assessment
- Optimal model routing

The confidence scoring system provides the foundation for these advanced GPT-5 capabilities while working effectively with current models.