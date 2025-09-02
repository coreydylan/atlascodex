# Atlas Codex - Hyperbrowser API Compatibility Guide

## Core API Functions (100% Compatible)

Atlas Codex implements the exact same API as Hyperbrowser, so customers can switch with a simple URL change:

```javascript
// Hyperbrowser
const client = new Hyperbrowser({ apiKey: "..." });

// Atlas Codex - Drop-in replacement
const client = new AtlasCodex({ apiKey: "..." });
// OR just change the base URL
const client = new Hyperbrowser({ 
  apiKey: "...",
  baseUrl: "https://api.atlascodex.com" 
});
```

## 1. SCRAPE API - Single Page Extraction

### Endpoint
```
POST /api/scrape
GET  /api/scrape/{jobId}
```

### Request Format
```javascript
{
  "url": "https://example.com",
  "sessionOptions": {
    "useProxy": true,           // Use proxy rotation
    "solveCaptchas": true,      // Auto-solve CAPTCHAs
    "proxyCountry": "US",       // Proxy location
    "locales": ["en-US"],       // Browser locale
    "blockAds": true,           // Block advertisements
    "stealth": true             // Enable stealth mode
  },
  "scrapeOptions": {
    "formats": ["markdown", "html", "links", "screenshot"],
    "onlyMainContent": true,    // Strip nav/footer
    "includeTags": ["article", "main"],
    "excludeTags": ["nav", "footer", "aside"],
    "waitFor": 2000,            // Wait milliseconds
    "timeout": 30000,           // Total timeout
    "headers": {                // Custom headers
      "User-Agent": "Custom/1.0"
    }
  }
}
```

### Response Format
```javascript
{
  "jobId": "job_abc123",
  "status": "completed",  // pending|running|completed|failed
  "data": {
    "url": "https://example.com",
    "metadata": {
      "title": "Page Title",
      "description": "Meta description",
      "language": "en",
      "author": "Author Name",
      "publishedTime": "2024-01-01T00:00:00Z",
      "modifiedTime": "2024-01-02T00:00:00Z",
      "keywords": ["keyword1", "keyword2"]
    },
    "markdown": "# Main Content\n\nFormatted as markdown...",
    "html": "<html>...</html>",
    "links": [
      {"text": "Link Text", "href": "https://..."}
    ],
    "screenshot": "https://storage.atlascodex.com/screenshots/abc123.png",
    "evidence": {  // Atlas Codex addition
      "hash": "sha256:...",
      "timestamp": "2024-01-01T00:00:00Z",
      "certificate": "tls_cert_hash"
    }
  },
  "error": null,
  "credits": 1
}
```

## 2. CRAWL API - Multi-Page Discovery

### Endpoint
```
POST /api/crawl
GET  /api/crawl/{jobId}
GET  /api/crawl/{jobId}/pages
```

### Request Format
```javascript
{
  "url": "https://example.com",
  "maxPages": 100,                    // Maximum pages to crawl
  "depth": 3,                         // Link depth to follow
  "includePatterns": ["/blog/*"],    // URL patterns to include
  "excludePatterns": ["/admin/*"],   // URL patterns to exclude
  "followLinks": true,                // Follow discovered links
  "sameDomain": true,                 // Stay on same domain
  "respectRobotsTxt": true,           // Obey robots.txt
  "crawlSpeed": "normal",             // slow|normal|fast
  "sessionOptions": { /* same as scrape */ },
  "scrapeOptions": { /* same as scrape */ }
}
```

### Response Format
```javascript
{
  "jobId": "crawl_xyz789",
  "status": "completed",
  "stats": {
    "totalPages": 47,
    "successfulPages": 45,
    "failedPages": 2,
    "totalLinks": 312,
    "duration": 45000,  // milliseconds
    "credits": 47
  },
  "pages": [
    {
      "url": "https://example.com/page1",
      "status": "success",
      "data": { /* same as scrape response */ }
    },
    // ... more pages
  ],
  "siteMap": {  // Atlas Codex addition
    "nodes": [/* page relationships */],
    "edges": [/* link connections */]
  }
}
```

## 3. EXTRACT API - AI-Powered Structured Extraction

### Endpoint
```
POST /api/extract
GET  /api/extract/{jobId}
```

### Request Format
```javascript
{
  "url": "https://example.com",
  "schema": {
    // JSON Schema or Zod schema
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "price": { "type": "number" },
      "features": {
        "type": "array",
        "items": { "type": "string" }
      },
      "availability": { "type": "boolean" }
    },
    "required": ["title", "price"]
  },
  "prompt": "Extract product information from this e-commerce page",
  "model": "gpt-4o-mini",  // gpt-4o|gpt-4o-mini|claude-3.5
  "examples": [  // Optional few-shot examples
    {
      "input": "Sample HTML",
      "output": { "title": "Product", "price": 99.99 }
    }
  ],
  "sessionOptions": { /* same as scrape */ }
}
```

### Response Format
```javascript
{
  "jobId": "extract_qrs456",
  "status": "completed",
  "data": {
    "url": "https://example.com",
    "extracted": {
      "title": "Premium Widget",
      "price": 149.99,
      "features": ["Waterproof", "Bluetooth", "USB-C"],
      "availability": true
    },
    "confidence": 0.95,  // Atlas Codex addition
    "evidence": {        // Atlas Codex addition
      "selectors": {
        "title": "h1.product-title",
        "price": "span.price",
        "features": "ul.features li"
      },
      "screenshot": "https://...",
      "hash": "sha256:..."
    }
  },
  "tokens": 1250,
  "credits": 3
}
```

## 4. BATCH API - Multiple URLs (Ultra Plan)

### Endpoint
```
POST /api/batch/scrape
POST /api/batch/extract
```

### Request Format
```javascript
{
  "urls": [
    "https://example.com/page1",
    "https://example.com/page2",
    // ... up to 1000 URLs
  ],
  "options": { /* same options for all URLs */ }
}
```

## 5. SESSION API - Browser Session Management

### Endpoints
```
POST /api/sessions          # Create session
GET  /api/sessions/{id}     # Get session info
DELETE /api/sessions/{id}   # Destroy session
POST /api/sessions/{id}/execute  # Run script
```

### Create Session
```javascript
POST /api/sessions
{
  "browserType": "chromium",  // chromium|firefox|webkit
  "persistent": true,          // Keep session alive
  "profile": {                 // Optional saved profile
    "id": "profile_123",
    "cookies": [/* ... */],
    "localStorage": {/* ... */}
  },
  "options": {
    "headless": true,
    "viewport": { "width": 1920, "height": 1080 },
    "userAgent": "Custom User Agent",
    "proxy": { /* proxy config */ }
  }
}

Response:
{
  "sessionId": "sess_abc123",
  "wsEndpoint": "wss://browser.atlascodex.com/session/abc123",
  "cdpEndpoint": "https://cdp.atlascodex.com/session/abc123",
  "status": "ready",
  "expiresAt": "2024-01-01T01:00:00Z"
}
```

## SDK Usage Examples

### JavaScript/TypeScript
```javascript
import { AtlasCodex } from '@atlascodex/sdk';

const client = new AtlasCodex({ 
  apiKey: process.env.ATLAS_CODEX_API_KEY 
});

// Simple scrape
const result = await client.scrape.startAndWait({
  url: 'https://example.com',
  scrapeOptions: {
    formats: ['markdown', 'screenshot']
  }
});

// Extract with schema
const product = await client.extract.startAndWait({
  url: 'https://shop.com/product',
  schema: productSchema,
  model: 'gpt-4o-mini'
});

// Crawl entire site
const site = await client.crawl.startAndWait({
  url: 'https://blog.com',
  maxPages: 50,
  includePatterns: ['/posts/*']
});
```

### Python
```python
from atlascodex import AtlasCodex

client = AtlasCodex(api_key="...")

# Scrape
result = client.scrape.start_and_wait(
    url="https://example.com",
    scrape_options={
        "formats": ["markdown", "links"]
    }
)

# Extract
data = client.extract.start_and_wait(
    url="https://example.com",
    schema=schema,
    prompt="Extract contact information"
)
```

## Use Cases & Customer Integration

### 1. AI Agents & LLMs
```javascript
// LangChain Integration
import { AtlasCodexLoader } from '@atlascodex/langchain';

const loader = new AtlasCodexLoader({
  urls: ['https://docs.example.com'],
  mode: 'crawl',
  maxPages: 100
});

const docs = await loader.load();
```

### 2. E-commerce Price Monitoring
```javascript
// Monitor competitor prices
const monitor = await client.extract.schedule({
  url: 'https://competitor.com/product',
  schema: priceSchema,
  schedule: '0 */6 * * *',  // Every 6 hours
  webhook: 'https://myapp.com/price-change'
});
```

### 3. Lead Generation
```javascript
// Extract business contacts
const leads = await client.crawl.startAndWait({
  url: 'https://directory.com',
  maxPages: 500,
  extract: {
    schema: contactSchema,
    prompt: "Extract business contact information"
  }
});
```

### 4. Content Aggregation
```javascript
// Aggregate news articles
const news = await client.crawl.startAndWait({
  url: 'https://news-site.com',
  includePatterns: ['/articles/*'],
  scrapeOptions: {
    onlyMainContent: true,
    formats: ['markdown']
  }
});
```

### 5. Market Research
```javascript
// Extract product reviews
const reviews = await client.extract.startAndWait({
  url: 'https://reviews.com/product',
  schema: reviewSchema,
  prompt: "Extract all customer reviews with ratings"
});
```

## MCP (Model Context Protocol) Integration

```javascript
// MCP Server tools available
{
  "tools": [
    {
      "name": "browse",
      "description": "Navigate and interact with web pages",
      "parameters": {
        "url": "string",
        "actions": ["click", "type", "scroll"]
      }
    },
    {
      "name": "scrape",
      "description": "Extract content from a URL",
      "parameters": {
        "url": "string",
        "format": "markdown|html|links"
      }
    },
    {
      "name": "extract",
      "description": "Extract structured data using AI",
      "parameters": {
        "url": "string",
        "schema": "object",
        "prompt": "string"
      }
    },
    {
      "name": "crawl",
      "description": "Crawl multiple pages",
      "parameters": {
        "url": "string",
        "maxPages": "number",
        "patterns": "array"
      }
    }
  ]
}
```

## Webhooks for Real-time Updates

```javascript
// Configure webhooks for job completion
POST /api/webhooks
{
  "url": "https://myapp.com/webhook",
  "events": ["job.completed", "job.failed"],
  "secret": "webhook_secret_key"
}

// Webhook payload
{
  "event": "job.completed",
  "jobId": "job_123",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": { /* job result */ },
  "signature": "hmac_sha256_signature"
}
```

## Rate Limits & Quotas

```javascript
// Response headers include rate limit info
{
  "X-RateLimit-Limit": "100",      // Requests per minute
  "X-RateLimit-Remaining": "95",
  "X-RateLimit-Reset": "1704067260",
  "X-Credits-Remaining": "4521",
  "X-Credits-Reset": "2024-02-01T00:00:00Z"
}
```

## Error Handling

```javascript
// Standard error response
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "details": {
      "limit": 100,
      "reset": 1704067260
    }
  },
  "jobId": null,
  "status": "failed"
}

// Error codes
- INVALID_URL
- RATE_LIMIT_EXCEEDED  
- INSUFFICIENT_CREDITS
- TIMEOUT
- CAPTCHA_FAILED
- PROXY_ERROR
- BROWSER_ERROR
- EXTRACTION_FAILED
```

## Migration from Hyperbrowser

```javascript
// Step 1: Change import
// From: import { Hyperbrowser } from '@hyperbrowser/sdk';
// To:   import { AtlasCodex } from '@atlascodex/sdk';

// Step 2: Update initialization
const client = new AtlasCodex({
  apiKey: process.env.ATLAS_CODEX_API_KEY,
  // Optional: Keep using Hyperbrowser SDK
  baseUrl: 'https://api.atlascodex.com'
});

// Step 3: Your code works exactly the same!
const result = await client.scrape.startAndWait({
  url: 'https://example.com'
});
```

This is 100% API compatible with Hyperbrowser, but with our performance improvements and evidence system built in!