# Option C: Unified Extractor Guide

## Overview

The Unified Extractor is a clean, simple replacement for the complex Evidence-First multi-layer system. It implements a production-ready extraction system with:

- **Single AI call** with structured output (no multi-track processing)
- **AJV validation** with strict schema enforcement  
- **No deterministic heuristics** or department-specific logic
- **Clean fallback** to existing plan-based system
- **Feature flag** to enable/disable (default: OFF)
- **Zero deterministic leakage** - pure AI extraction only

## Quick Start

### 1. Enable the Unified Extractor

```bash
export UNIFIED_EXTRACTOR_ENABLED=true
```

**Important**: The feature flag has a HARD DEFAULT of `false`. The unified extractor must be explicitly enabled.

### 2. Basic Usage

```javascript
const { processWithUnifiedExtractor } = require('./api/evidence-first-bridge');

const result = await processWithUnifiedExtractor(htmlContent, {
    extractionInstructions: 'extract all department names',
    url: 'https://example.com'
});

console.log(result.data); // Clean extracted data
console.log(result.metadata.unifiedExtractor); // true if unified extractor was used
```

## How It Works

### 1. Schema Generation
The system analyzes the user's natural language query and generates a clean JSON Schema:

```javascript
// Query: "extract department names"
// Generated Schema:
{
  "type": "array",
  "items": { "type": "string" },
  "minItems": 1,
  "description": "List of names or categories"
}

// Query: "extract staff names and emails" 
// Generated Schema:
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Name or title" },
      "email": { "type": "string", "format": "email", "description": "Email address" }
    },
    "required": ["name"],
    "additionalProperties": false,
    "unevaluatedProperties": false
  },
  "minItems": 1
}
```

### 2. Single AI Call
One call to GPT-4o with structured output and strict JSON schema compliance:

- Temperature: 0 (deterministic)
- Response format: JSON object
- Strict schema validation
- No multi-track processing

### 3. AJV Validation
Strict validation with phantom field prevention:

```javascript
const ajv = new Ajv({ 
  strict: true,
  allErrors: true,
  removeAdditional: true, // Remove phantom fields
  useDefaults: false,
  coerceTypes: false
});
```

### 4. Clean Fallback
If anything fails, the system cleanly falls back to the existing plan-based system:

- OpenAI API unavailable
- AJV validation fails
- JSON parsing errors
- Any other exceptions

## Configuration

### Environment Variables

```bash
# Enable/disable the unified extractor (HARD DEFAULT = false)
UNIFIED_EXTRACTOR_ENABLED=true

# OpenAI API key (required for AI extraction)
OPENAI_API_KEY=sk-...
```

### Feature Flag Behavior

| `UNIFIED_EXTRACTOR_ENABLED` | Behavior |
|----------------------------|----------|
| `true` | Use unified extractor if possible, fallback to plan-based |
| `false` (default) | Always use plan-based system |
| Not set | Always use plan-based system |

## API Reference

### Main Functions

#### `processWithUnifiedExtractor(htmlContent, params)`
- **htmlContent**: Raw HTML content to extract from
- **params**: Extraction parameters
  - `extractionInstructions`: Natural language extraction query
  - `url`: Source URL (optional, for context)

#### Return Format

```javascript
{
  success: true,
  data: [...], // Clean extracted data
  metadata: {
    processingMethod: 'unified_extractor_option_c',
    unifiedExtractor: true,
    processingTime: 1500,
    schema: {...}, // Generated JSON schema
    validation: {
      valid: true,
      phantomFieldsRemoved: 0,
      originalDataLength: 5
    },
    fallbackUsed: false
  }
}
```

## Testing

### Run Tests

```bash
# Test with feature flag disabled (default)
node test-unified-extractor.js

# Test with feature flag enabled
node test-unified-extractor-enabled.js
```

### Example Test Output

```
🎯 Using Unified Extractor (Option C)
📋 Generated JSON Schema: {
  "type": "array",
  "items": { "type": "string" },
  "minItems": 1,
  "description": "List of names or categories"
}
✅ AJV validation passed
Success: true
Processing method: unified_extractor_option_c
Data: ["Computer Science", "Biology", "Physics", "Mathematics", "Chemistry"]
```

## Key Benefits

### 1. Simplicity
- Single AI call instead of complex multi-layer processing
- No deterministic heuristics or department-specific logic
- Clean, readable codebase

### 2. Reliability  
- AJV validation prevents phantom fields
- Graceful fallback to proven plan-based system
- Feature flag allows safe rollout

### 3. Performance
- Single API call instead of multiple tracks
- No complex schema negotiation
- Fast processing times

### 4. Maintainability
- Zero deterministic leakage
- Clean separation of concerns
- Easy to test and debug

## Migration Path

The unified extractor is designed as a drop-in replacement:

1. **Phase 1**: Deploy with feature flag OFF (default behavior)
2. **Phase 2**: Enable for testing with `UNIFIED_EXTRACTOR_ENABLED=true`  
3. **Phase 3**: Monitor performance and accuracy
4. **Phase 4**: Make it the default if performance is satisfactory

## Troubleshooting

### Common Issues

1. **"Unified extractor disabled"**
   - Solution: Set `UNIFIED_EXTRACTOR_ENABLED=true`

2. **"OpenAI not initialized"**
   - Solution: Set `OPENAI_API_KEY` environment variable

3. **"AJV validation failed"**
   - The system automatically falls back to plan-based system
   - Check logs for specific validation errors

4. **Empty results**
   - Check if the HTML content contains the requested data
   - Verify the extraction instructions are clear

### Debug Mode

Enable detailed logging:

```javascript
console.log('Feature flag:', UNIFIED_EXTRACTOR_ENABLED);
console.log('Generated schema:', result.metadata.schema);
console.log('Validation result:', result.metadata.validation);
```

## Production Deployment

### Recommended Settings

```bash
# Production environment
UNIFIED_EXTRACTOR_ENABLED=true
OPENAI_API_KEY=sk-your-production-key
NODE_ENV=production
```

### Monitoring

Monitor these metrics:
- Processing time (`metadata.processingTime`)
- Fallback usage (`metadata.fallbackUsed`)
- Validation success (`metadata.validation.valid`)
- Phantom fields removed (`metadata.validation.phantomFieldsRemoved`)

The unified extractor provides a clean, maintainable, and reliable alternative to complex multi-layer extraction systems while maintaining full backward compatibility.