# GPT-5 Migration Tests

This directory contains comprehensive tests for the GPT-5 migration implementation in Atlas Codex.

## Test Overview

The `gpt5-migration.test.js` file validates the following aspects of the GPT-5 migration:

### Model Selection for Cost Efficiency
- Tests that simple requests use `gpt-5-nano` for optimal cost efficiency
- Tests that medium complexity tasks use `gpt-5-mini` for balanced performance
- Validates cost calculations and budget constraints

### Complex Reasoning Tasks
- Tests that complex reasoning tasks use the full `gpt-5` model
- Validates multi-step analysis capabilities
- Tests schema-based extraction with relationships

### HTML Extraction with All Model Tiers
- Tests simple HTML extraction with nano model
- Tests medium complexity HTML with mini model  
- Tests complex HTML analysis with full model
- Tests handling of large HTML documents

### Fallback Mechanism
- Tests fallback to GPT-4 when GPT-5 fails
- Tests error handling and user experience preservation
- Validates fallback functionality maintains service quality

### Cost Tracking and Model Selection
- Tests ModelSelector logic for different complexity scenarios
- Validates cost estimation accuracy across all models
- Tests budget constraint influence on model selection

### Performance and Quality Metrics
- Tests confidence score calculations
- Validates response time requirements
- Tests token usage tracking accuracy

## Running the Tests

### Run All Migration Tests
```bash
npm run test:gpt5
```

### Run Tests in Watch Mode
```bash
npm run test:gpt5:watch
```

### Run All Tests
```bash
npm test
```

### Run Tests with Verbose Output
```bash
VERBOSE_TESTS=true npm run test:gpt5
```

## Test Environment Setup

The tests require the following environment variables:
- `OPENAI_API_KEY` - OpenAI API key with GPT-5 access
- `GPT5_ENABLED=true` - Enable GPT-5 functionality
- `GPT5_FALLBACK_ENABLED=true` - Enable fallback to GPT-4
- `GPT5_REASONING_ENABLED=true` - Enable reasoning mode

## Test Data and Mocking

Tests use realistic HTML samples and extraction scenarios to validate:
- Simple text extraction
- Complex product catalogs
- Business metrics dashboards
- Multi-page navigation patterns

## Prerequisites

Before running tests, ensure:
1. All GPT-5 migration code is implemented (Steps 1-6)
2. OpenAI SDK is updated to v4.52.0+
3. Jest is installed (`npm install`)
4. Environment variables are configured

## Test Coverage

The test suite covers:
- ✅ Model selection logic
- ✅ Cost optimization
- ✅ Fallback mechanisms
- ✅ HTML extraction accuracy
- ✅ Performance metrics
- ✅ Error handling
- ✅ Token tracking
- ✅ Budget constraints

## Expected Results

All tests should pass before deploying the GPT-5 migration to production. The tests validate that:

1. **Cost efficiency**: Nano model used for simple tasks (< $0.001)
2. **Performance**: Full model used for complex reasoning
3. **Reliability**: Fallback works when GPT-5 is unavailable
4. **Quality**: Extraction accuracy maintained across all models
5. **Tracking**: Costs and usage are accurately tracked

## Troubleshooting

### Common Issues

**Tests fail with API errors**
- Verify `OPENAI_API_KEY` is valid and has GPT-5 access
- Check OpenAI API status and rate limits

**Model selection tests fail**
- Ensure ModelSelector service is properly implemented
- Verify complexity assessment logic

**Fallback tests fail**
- Check that `GPT5_FALLBACK_ENABLED=true`
- Verify GPT-4 fallback implementation

### Debug Mode

Run tests with additional logging:
```bash
DEBUG=true VERBOSE_TESTS=true npm run test:gpt5
```