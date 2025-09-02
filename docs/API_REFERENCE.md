# API Reference 📡

Complete API documentation for Atlas Codex.

## Base URL

- **Development**: `http://localhost:3000`
- **Staging**: `https://api-staging.atlascodex.ai`
- **Production**: `https://api.atlascodex.ai`

## Authentication

All API endpoints require an API key in the Authorization header:

```bash
Authorization: Bearer your-api-key-here
```

## Rate Limits

| Environment | Requests/Minute | Concurrent Jobs |
|-------------|-----------------|-----------------|
| Development | 1000 | 100 |
| Staging | 500 | 50 |
| Production | 100 | 10 |

## Response Format

All responses follow this structure:

```json
{
  "status": "success|error",
  "data": { ... },
  "message": "Human readable message",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

## Endpoints

### Health Check

#### `GET /health`

Check service health and status.

**Parameters**: None

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00Z",
  "region": "us-east-1",
  "message": "Atlas Codex API is running!",
  "browsers": 5,
  "contexts": 12
}
```

---

### Scraping

#### `POST /api/scrape`

Scrape a single webpage with optional browser rendering.

**Request Body**:
```json
{
  "url": "https://example.com",
  "scrapeOptions": {
    "timeout": 30000,
    "waitFor": 2000,
    "headers": {
      "User-Agent": "AtlasCodex/1.0"
    },
    "formats": ["html", "markdown", "screenshot"]
  },
  "sessionOptions": {
    "viewport": {
      "width": 1920,
      "height": 1080
    },
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "locale": "en-US",
    "forceRender": false,
    "blockAds": true
  }
}
```

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ | Target URL to scrape |
| `scrapeOptions.timeout` | number | ❌ | Max wait time in ms (default: 30000) |
| `scrapeOptions.waitFor` | number | ❌ | Additional wait time after page load |
| `scrapeOptions.headers` | object | ❌ | Custom HTTP headers |
| `scrapeOptions.formats` | array | ❌ | Output formats: html, markdown, screenshot |
| `sessionOptions.viewport` | object | ❌ | Browser viewport size |
| `sessionOptions.forceRender` | boolean | ❌ | Force browser usage (default: auto-detect) |
| `sessionOptions.blockAds` | boolean | ❌ | Block ads and trackers |

**Response**:
```json
{
  "jobId": "scrape_1704067200_abc123def",
  "status": "pending",
  "message": "Job queued successfully"
}
```

#### `GET /api/scrape/{jobId}`

Get scraping job status and results.

**Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jobId` | string | ✅ | Job ID from scrape request |

**Response** (Pending):
```json
{
  "id": "scrape_1704067200_abc123def",
  "type": "scrape",
  "status": "pending",
  "params": { ... },
  "createdAt": 1704067200000
}
```

**Response** (Completed):
```json
{
  "id": "scrape_1704067200_abc123def",
  "type": "scrape", 
  "status": "completed",
  "params": { ... },
  "result": {
    "url": "https://example.com",
    "metadata": {
      "title": "Example Page",
      "description": "An example webpage",
      "language": "en",
      "author": "Example Author"
    },
    "html": "<html>...</html>",
    "markdown": "# Example Page\n\nContent here...",
    "links": [
      {
        "href": "https://example.com/about",
        "text": "About Us"
      }
    ],
    "screenshot": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "evidence": {
      "hash": "sha256:abc123def456...",
      "timestamp": "2025-01-01T00:00:00Z",
      "browserUsed": true
    }
  },
  "createdAt": 1704067200000,
  "completedAt": 1704067205000
}
```

---

### AI Extraction

#### `POST /api/extract`

Extract structured data using GPT-5 AI models.

**Request Body**:
```json
{
  "url": "https://shop.example.com/product/123",
  "schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "price": { "type": "number" },
      "currency": { "type": "string" },
      "features": {
        "type": "array",
        "items": { "type": "string" }
      },
      "availability": {
        "type": "string",
        "enum": ["in_stock", "out_of_stock", "limited"]
      }
    },
    "required": ["title", "price"]
  },
  "prompt": "Extract product information from this e-commerce page. Focus on the main product being sold.",
  "model": "gpt-5-nano"
}
```

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ | Target URL to extract from |
| `schema` | object | ✅ | JSON schema defining expected output structure |
| `prompt` | string | ✅ | Instructions for the AI extraction |
| `model` | string | ❌ | GPT model: gpt-5-nano, gpt-5-mini, gpt-5 (auto-selected if not specified) |

**Response**:
```json
{
  "jobId": "extract_1704067200_xyz789abc",
  "status": "pending", 
  "message": "Extraction job queued"
}
```

#### `GET /api/extract/{jobId}`

Get extraction job status and results.

**Response** (Completed):
```json
{
  "id": "extract_1704067200_xyz789abc",
  "type": "extract",
  "status": "completed",
  "result": {
    "url": "https://shop.example.com/product/123",
    "extracted": {
      "title": "Premium Wireless Headphones",
      "price": 299.99,
      "currency": "USD",
      "features": [
        "Active Noise Cancellation",
        "40-hour battery life", 
        "Bluetooth 5.0"
      ],
      "availability": "in_stock"
    },
    "confidence": 0.95,
    "evidence": {
      "hash": "sha256:def456abc789...",
      "timestamp": "2025-01-01T00:00:00Z",
      "model": "gpt-5-nano",
      "tokens": 1250
    }
  },
  "createdAt": 1704067200000,
  "completedAt": 1704067208000
}
```

---

### Web Crawling

#### `POST /api/crawl`

Crawl multiple pages from a website.

**Request Body**:
```json
{
  "url": "https://blog.example.com",
  "maxPages": 10,
  "includePatterns": ["/posts/*", "/articles/*"],
  "excludePatterns": ["/admin/*", "*.pdf"],
  "followLinks": true,
  "scrapeOptions": {
    "formats": ["markdown"],
    "timeout": 30000
  }
}
```

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ | Starting URL for crawl |
| `maxPages` | number | ❌ | Maximum pages to crawl (default: 10, max: 100) |
| `includePatterns` | array | ❌ | URL patterns to include |
| `excludePatterns` | array | ❌ | URL patterns to exclude |
| `followLinks` | boolean | ❌ | Whether to follow discovered links |
| `scrapeOptions` | object | ❌ | Same options as scrape endpoint |

**Response**:
```json
{
  "jobId": "crawl_1704067200_mno456pqr",
  "status": "pending",
  "message": "Crawl job queued"
}
```

#### `GET /api/crawl/{jobId}`

Get crawling job status and results.

**Response** (Completed):
```json
{
  "id": "crawl_1704067200_mno456pqr", 
  "type": "crawl",
  "status": "completed",
  "result": {
    "stats": {
      "totalPages": 8,
      "successfulPages": 7,
      "failedPages": 1
    },
    "pages": [
      {
        "url": "https://blog.example.com/posts/article-1",
        "status": "success",
        "data": {
          "url": "https://blog.example.com/posts/article-1",
          "metadata": {
            "title": "How to Build APIs",
            "description": "A comprehensive guide..."
          },
          "markdown": "# How to Build APIs\n\nContent here...",
          "evidence": {
            "hash": "sha256:ghi789jkl012...",
            "timestamp": "2025-01-01T00:00:00Z"
          }
        }
      },
      {
        "url": "https://blog.example.com/posts/article-2", 
        "status": "failed",
        "error": "Request timeout"
      }
    ]
  },
  "createdAt": 1704067200000,
  "completedAt": 1704067245000
}
```

---

## Error Responses

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Malformed request body or parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 404 | `NOT_FOUND` | Job ID not found |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

### Error Response Format

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_REQUEST",
    "message": "URL is required",
    "details": {
      "field": "url",
      "reason": "missing_required_field"
    }
  },
  "timestamp": "2025-01-01T00:00:00Z"
}
```

---

## Job States

All asynchronous jobs follow this state machine:

```
pending → running → completed
           ↓
         failed
```

- **pending**: Job queued, waiting to start
- **running**: Job is being processed
- **completed**: Job finished successfully
- **failed**: Job encountered an error

---

## Best Practices

### Optimal Request Patterns

**For Simple Pages**:
```json
{
  "url": "https://example.com",
  "scrapeOptions": {
    "formats": ["markdown"]
  },
  "sessionOptions": {
    "forceRender": false
  }
}
```

**For Complex SPAs**:
```json
{
  "url": "https://app.example.com", 
  "scrapeOptions": {
    "waitFor": 3000,
    "formats": ["html", "markdown"]
  },
  "sessionOptions": {
    "forceRender": true,
    "blockAds": true
  }
}
```

**For AI Extraction**:
```json
{
  "url": "https://example.com",
  "schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "content": { "type": "string" }
    },
    "required": ["title"],
    "additionalProperties": false
  },
  "prompt": "Extract the main title and content from this page."
}
```

### Performance Tips

1. **Use appropriate formats**: Only request formats you need
2. **Set reasonable timeouts**: Don't use excessive timeout values
3. **Leverage auto-detection**: Let Atlas Codex decide when to use browser rendering
4. **Structure extraction schemas**: Well-defined schemas improve AI accuracy
5. **Poll job status efficiently**: Use exponential backoff for status polling

### Cost Optimization

1. **Use forceRender sparingly**: Browser rendering is more expensive
2. **Optimize extraction schemas**: Simpler schemas cost less to process
3. **Batch similar requests**: Group related URLs in crawl jobs
4. **Cache results**: Store extracted data to avoid re-processing

---

## SDKs and Integrations

### JavaScript/TypeScript

```bash
npm install @atlas-codex/sdk
```

```typescript
import { AtlasCodex } from '@atlas-codex/sdk';

const client = new AtlasCodex({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.atlascodex.ai'
});

// Simple scraping
const result = await client.scrape.startAndWait({
  url: 'https://example.com'
});

// AI extraction
const extracted = await client.extract.startAndWait({
  url: 'https://shop.example.com/product',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      price: { type: 'number' }
    }
  },
  prompt: 'Extract product info'
});
```

### Python

```bash
pip install atlascodex
```

```python
from atlascodex import AtlasCodex

client = AtlasCodex(api_key="your-api-key")

# Simple scraping
result = client.scrape.start_and_wait(
    url="https://example.com"
)

# AI extraction  
extracted = client.extract.start_and_wait(
    url="https://shop.example.com/product",
    schema={
        "type": "object", 
        "properties": {
            "title": {"type": "string"},
            "price": {"type": "number"}
        }
    },
    prompt="Extract product info"
)
```

### cURL Examples

**Simple Scrape**:
```bash
curl -X POST https://api.atlascodex.ai/api/scrape \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "scrapeOptions": {
      "formats": ["markdown"]
    }
  }'
```

**Check Job Status**:
```bash
curl -H "Authorization: Bearer your-api-key" \
  https://api.atlascodex.ai/api/scrape/scrape_1704067200_abc123def
```

**AI Extraction**:
```bash
curl -X POST https://api.atlascodex.ai/api/extract \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://shop.example.com/product",
    "schema": {
      "type": "object",
      "properties": {
        "title": {"type": "string"},
        "price": {"type": "number"}
      }
    },
    "prompt": "Extract product information"
  }'
```

---

## Webhook Support

### Configuration

Configure webhooks to receive job completion notifications:

```json
POST /api/webhooks
{
  "url": "https://your-app.com/webhook",
  "events": ["job.completed", "job.failed"],
  "secret": "your-webhook-secret"
}
```

### Webhook Payload

```json
{
  "event": "job.completed",
  "jobId": "scrape_1704067200_abc123def",
  "job": {
    "id": "scrape_1704067200_abc123def",
    "type": "scrape", 
    "status": "completed",
    "result": { ... }
  },
  "timestamp": "2025-01-01T00:00:00Z"
}
```

---

## Monitoring and Analytics

### Usage Metrics

Track your API usage through the dashboard or API:

```bash
GET /api/usage
{
  "period": "daily",
  "metrics": {
    "requests_count": 1250,
    "success_rate": 0.98,
    "avg_response_time": 2.3,
    "cost_total": 15.67
  }
}
```

### Cost Tracking

Monitor costs per job type:

```bash
GET /api/costs
{
  "breakdown": {
    "scraping": { "count": 800, "cost": 4.50 },
    "extraction": { "count": 200, "cost": 8.20 },
    "crawling": { "count": 50, "cost": 2.97 }
  },
  "total": 15.67
}
```