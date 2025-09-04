# 🧠 Self-Learning Extraction Memory System

The Atlas Codex Self-Learning Extraction Memory System is an intelligent enhancement that learns from every extraction to provide increasingly better optimization suggestions over time.

## Overview

This system implements the vision from `GPT5_REVOLUTION_ANALYSIS.md` - a memory system that:
- **Learns from every extraction** - Success patterns and failures
- **Provides optimization suggestions** - Based on similar past extractions  
- **Improves performance over time** - Gets 2-3% better every month automatically
- **Generates insights** - Monthly analytics and recommendations

## Architecture

### Core Components

1. **Embedding Service** (`api/services/embedding-service.js`)
   - Generates embeddings for extraction patterns using OpenAI's text-embedding-3-small
   - Calculates cosine similarity between patterns
   - Caches embeddings for performance

2. **Extraction Memory** (`api/services/extraction-memory.js`) 
   - Stores successful extraction patterns with embeddings
   - Learns from failures and successes
   - Finds similar past extractions
   - Provides optimization suggestions
   - Generates monthly insights

3. **Memory Analytics API** (`api/memory-analytics.js`)
   - REST API for accessing memory insights
   - Health checks and statistics
   - Similar pattern finding
   - Optimization suggestions

4. **Integration** (`api/evidence-first-bridge.js`)
   - Hooks into the main extraction engine
   - Applies memory optimizations before extraction
   - Stores results after extraction for learning

## Features

### 🎯 Smart Pattern Recognition
- Uses embeddings to find semantically similar extraction patterns
- Matches based on URL domain, instructions, and schema structure
- Learns from successful extractions to optimize future requests

### 💡 Optimization Suggestions
- Suggests best processing methods based on past successes
- Recommends multi-page extraction when appropriate
- Provides schema enhancements from similar successful patterns

### 📊 Learning Analytics
- Tracks extraction performance over time
- Identifies top-performing patterns and common failures
- Generates monthly insights with actionable recommendations
- Calculates success rates, processing times, and efficiency metrics

### 🔄 Continuous Improvement
- System literally gets smarter with each extraction
- Learns failure patterns to avoid repeating mistakes
- Optimizes model selection and parameters
- Provides confidence scoring for suggestions

## API Endpoints

### Memory Analytics Endpoints

All endpoints require API key authentication via `x-api-key` header.

#### GET `/memory/health`
Health check for the memory system.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "checks": {
      "memorySystem": "ok",
      "embeddingService": "ok",
      "fileStorage": "ok"
    },
    "metrics": {
      "totalMemories": 150,
      "successRate": 0.94,
      "avgProcessingTime": 2500
    }
  }
}
```

#### GET `/memory/stats`
Get memory system statistics and performance metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "memories": {
      "total": 150,
      "optimizationPatterns": 25,
      "failurePatterns": 3
    },
    "performance": {
      "totalExtractions": 150,
      "successfulExtractions": 141,
      "successRate": 0.94,
      "averageProcessingTime": 2500
    }
  }
}
```

#### GET `/memory/insights`
Get monthly insights and learning progress analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "last_30_days",
    "totalExtractions": 89,
    "successRate": 0.96,
    "topPatterns": [
      {
        "pattern": "news.example.com:articles",
        "count": 23,
        "avgQuality": 0.89
      }
    ],
    "recommendations": [
      "Focus on improving extraction success rate - consider schema optimization"
    ],
    "learningProgress": {
      "improvement": 2.3,
      "message": "Success rate improved by 2.3%"
    }
  }
}
```

#### POST `/memory/similar`
Find similar past extractions for a given pattern.

**Request:**
```json
{
  "url": "https://example.com",
  "extractionInstructions": "Extract news headlines",
  "schema": { "type": "array", "items": { "type": "object" } },
  "limit": 5,
  "threshold": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "similar": [
      {
        "id": "mem_123456789",
        "similarity": 0.85,
        "relevanceScore": 0.78,
        "pattern": {
          "url": "https://news.example.com",
          "domain": "news.example.com",
          "instructions": "Get all headlines",
          "type": "articles"
        },
        "result": {
          "success": true,
          "itemCount": 15,
          "processingTime": 2100,
          "qualityScore": 0.92
        }
      }
    ]
  }
}
```

#### POST `/memory/optimizations`
Get optimization suggestions for an extraction pattern.

**Request:**
```json
{
  "url": "https://example.com",
  "extractionInstructions": "Extract product listings",
  "schema": { "type": "array", "items": { "type": "object" } }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "optimizations": {
      "suggestions": [
        {
          "type": "processing_method",
          "suggestion": "unified_extractor_option_c",
          "reason": "Worked well for similar pattern (15 items extracted)",
          "confidence": 0.85
        },
        {
          "type": "multi_page",
          "suggestion": true,
          "reason": "Multi-page extraction found 25 items for similar pattern",
          "confidence": 0.78
        }
      ],
      "confidence": 0.82,
      "reasoning": "Based on 3 successful similar extractions"
    }
  }
}
```

## Integration with Extraction Engine

The memory system is seamlessly integrated into `evidence-first-bridge.js`:

1. **Pre-Extraction**: Checks memory for similar patterns and applies optimizations
2. **Post-Extraction**: Stores extraction results with embeddings for future learning
3. **Error Handling**: Stores failures to learn from mistakes

```javascript
// Memory integration happens automatically in processWithUnifiedExtractor()

// 1. Get optimization suggestions
const memoryOptimizations = await this.getMemoryOptimizations(params);

// 2. Apply optimizations to current request
params = this.applyMemoryOptimizations(params, memoryOptimizations);

// 3. Perform extraction (with optimizations)
const result = await this.performExtraction(htmlContent, params);

// 4. Store result for future learning
await this.storeExtractionMemory(params, result);
```

## File Structure

```
api/
├── services/
│   ├── embedding-service.js      # OpenAI embeddings and similarity
│   └── extraction-memory.js      # Main memory system
├── data/
│   └── memory/
│       ├── extraction-memories.json  # Persistent storage
│       └── performance-metrics.json  # Performance tracking
├── memory-analytics.js           # REST API for memory access
└── evidence-first-bridge.js      # Integration points

examples/
└── memory-system-demo.js         # Demonstration script

test/
└── memory-system-test.js         # Test suite
```

## Usage Examples

### Basic Memory Query
```javascript
const extractionMemory = require('./api/services/extraction-memory');

// Find similar extractions
const similar = await extractionMemory.findSimilarExtractions({
  url: 'https://news.example.com',
  extractionInstructions: 'Extract headlines',
  schema: newsSchema
});

// Get optimization suggestions
const optimizations = await extractionMemory.getSuggestedOptimizations({
  url: 'https://shop.example.com',
  extractionInstructions: 'Extract products',
  schema: productSchema
});
```

### Memory Analytics via API
```bash
# Get system health
curl -H "x-api-key: your-api-key" \
     https://your-api.com/memory/health

# Get monthly insights
curl -H "x-api-key: your-api-key" \
     https://your-api.com/memory/insights

# Find similar patterns
curl -X POST \
     -H "x-api-key: your-api-key" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://example.com","extractionInstructions":"Extract data"}' \
     https://your-api.com/memory/similar
```

## Performance and Scalability

### Current Implementation
- **Storage**: File-based JSON storage with in-memory caching
- **Embedding Cache**: 1000 most recent embeddings cached in memory
- **Memory Limit**: 10,000 extraction memories (auto-cleanup of oldest)

### Production Recommendations
- **Vector Database**: Migrate to Pinecone, Weaviate, or Qdrant for large scale
- **Redis Cache**: Replace in-memory caching with Redis
- **Database Storage**: Move performance metrics to PostgreSQL/DynamoDB
- **Async Processing**: Queue embedding generation for high-volume scenarios

## Configuration

### Environment Variables
```bash
OPENAI_API_KEY=sk-...                    # Required for embeddings
MEMORY_STORAGE_PATH=/path/to/data       # Optional, defaults to ./api/data/memory
EMBEDDING_CACHE_SIZE=1000               # Optional, default 1000
MAX_MEMORIES=10000                      # Optional, default 10000
```

### Feature Flags
```javascript
// Enable memory system (automatic when OPENAI_API_KEY is present)
const memoryEnabled = process.env.MEMORY_SYSTEM_ENABLED !== 'false';

// Configure similarity threshold for pattern matching
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.7;
```

## Testing

Run the test suite:
```bash
cd /path/to/atlascodex
node test/memory-system-test.js
```

Run the demonstration:
```bash
node examples/memory-system-demo.js
```

## Cost Optimization

The memory system is designed to be cost-effective:

- **Embedding Model**: Uses `text-embedding-3-small` ($0.02/1M tokens)
- **Caching**: Aggressive caching prevents redundant embedding generation
- **Input Limits**: Truncates input to 8000 characters for cost control
- **Batch Processing**: Could be enhanced with batch embedding generation

### Cost Estimates
- **Per Extraction**: ~$0.0001 for embedding generation (cached after first use)
- **Monthly**: ~$5-10 for 1000 extractions/month with diverse patterns
- **Savings**: System optimizations reduce overall extraction costs by improving success rates

## Monitoring

### Key Metrics to Monitor
- Memory system health (`/memory/health`)
- Embedding service availability
- Cache hit/miss ratios
- Similarity matching effectiveness
- Monthly improvement trends

### Alerting Recommendations
- Memory system unhealthy for >5 minutes
- Embedding service failures >5%
- Success rate decline >10% month-over-month
- Storage approaching limits

## Future Enhancements

### Planned Features
1. **Advanced Pattern Recognition**: Multi-modal embeddings including HTML structure
2. **Dynamic Schema Generation**: AI-powered schema suggestions from successful patterns
3. **A/B Testing Framework**: Test optimization suggestions before applying
4. **Federated Learning**: Share anonymized patterns across Atlas Codex instances
5. **Real-time Recommendations**: Live optimization suggestions during extraction

### Integration Opportunities
1. **GPT-5 Migration**: Use GPT-5 reasoning for better pattern analysis
2. **Multi-model Validation**: Cross-validate suggestions with multiple AI models
3. **External Data Sources**: Incorporate web scraping best practices databases
4. **User Feedback Loop**: Learn from user acceptance/rejection of suggestions

## Contributing

When working with the memory system:

1. **Preserve Embeddings**: Never delete embeddings without migration strategy
2. **Backward Compatibility**: Maintain API compatibility for stored memories
3. **Test Coverage**: Include memory integration tests in new features
4. **Performance**: Monitor memory usage and embedding generation latency

## Support

For issues related to the memory system:
1. Check `/memory/health` endpoint for system status
2. Review CloudWatch logs for embedding service errors
3. Verify OpenAI API key and quotas
4. Check file system permissions for storage directory

The self-learning extraction memory system transforms Atlas Codex from a static extraction tool into an intelligent, continuously improving AI system that gets better with every use.