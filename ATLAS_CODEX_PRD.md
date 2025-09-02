# Atlas Codex - Product Requirements Document
## Next-Generation Web Scraping & Browser Orchestration Platform

---

## Executive Summary

Atlas Codex is a high-performance web scraping and browser orchestration platform designed to match and exceed Hyperbrowser's capabilities while being 50% more cost-effective. It provides managed browser sessions, structured data extraction, intelligent crawling, and seamless AI agent integrations through a developer-first API.

**Core Value Proposition:** Industrial-strength web scraping with evidence-based extraction, sub-500ms browser spin-up, and native AI tool integrations - at half the cost of existing solutions.

---

## Product Vision

Build the fastest, most reliable browser orchestration platform that becomes the default choice for AI agents and developers needing to extract structured data from the web at scale.

**Key Differentiators:**
- Evidence-first extraction with immutable provenance
- Intelligent escalation (HTTP → Network snoop → Browser only when needed)
- Pre-warmed browser pools for <300ms context creation
- Native MCP server and AI framework integrations
- 50% lower cost through efficient resource utilization

---

## Core Features & Capabilities

### 1. Browser Session Management

#### 1.1 Session Lifecycle
```
POST /api/sessions       # Create new browser session
GET  /api/sessions/{id}  # Get session details
DELETE /api/sessions/{id} # Terminate session
```

**Features:**
- Isolated browser containers with sub-500ms spin-up
- Persistent browser pools with fresh contexts per job
- Session profiles for maintaining logged-in states
- Automatic cleanup and resource management
- Support for Playwright, Puppeteer, and Selenium

#### 1.2 Performance Targets
- Cold start: <500ms
- Warm context: <300ms
- Concurrent sessions: 1000+ per region
- Session persistence: Up to 24 hours

### 2. Extraction API

#### 2.1 Structured Data Extraction
```
POST /api/extract
{
  "urls": ["https://example.com/*"],
  "schema": { /* JSON Schema */ },
  "prompt": "Extract pricing information",
  "depth": 2,
  "model": "gpt-4-mini"
}
```

**Capabilities:**
- Schema-driven extraction with strict JSON validation
- Multi-page crawling with wildcard support
- Automatic pagination handling
- PDF and document parsing
- Table extraction and normalization

#### 2.2 Evidence System
Every extracted field includes:
- `evidence_id`: Immutable reference
- `source_url`: Origin URL
- `selector`: CSS/XPath selector
- `snippet`: Text excerpt
- `screenshot_url`: Visual proof
- `content_hash`: SHA256 hash
- `fetched_at`: Timestamp
- `confidence_score`: 0-1 reliability metric

### 3. Intelligent Crawling

#### 3.1 Escalation Pipeline
```
1. HEAD request → Check ETag/Last-Modified
2. GET without JS → Direct HTTP fetch
3. Network snoop → Intercept API calls
4. Browser render → Full Playwright/Puppeteer
```

**Optimization Rules:**
- Skip browser for 60-70% of pages
- Detect and use JSON endpoints directly
- Cache unchanged content based on ETag
- Abort unnecessary resources (images, ads, analytics)

#### 3.2 Crawl Management
```
POST /api/crawl
{
  "urls": ["https://site.com/*"],
  "depth": 3,
  "max_pages": 1000,
  "obey_robots": true,
  "priority_rules": { /* custom scoring */ }
}
```

**Features:**
- Link discovery and prioritization
- Domain-specific rate limiting
- Robots.txt compliance
- Sitemap parsing
- Change detection and monitoring

### 4. Stealth & Anti-Bot Capabilities

#### 4.1 Browser Fingerprinting
- Realistic browser profiles (UA, viewport, timezone)
- WebGL and Canvas fingerprint randomization
- Font list management
- WebRTC leak prevention
- Consistent browser behavior patterns

#### 4.2 Proxy Management
- Residential proxy rotation
- Sticky sessions per domain
- Geographic targeting
- Automatic failover on 403/429
- IP reputation monitoring

#### 4.3 CAPTCHA Handling
- Automatic detection (reCAPTCHA v2/v3, hCaptcha, Turnstile)
- Integrated solving services
- Human-in-the-loop fallback
- Solution caching
- Rate limit awareness

### 5. Performance Optimizations

#### 5.1 Resource Management
```javascript
// Abort rules configuration
{
  "block_resources": ["image", "media", "font"],
  "block_domains": ["*.doubleclick.net", "*.google-analytics.com"],
  "allow_list": ["api.*.com", "*.json"]
}
```

#### 5.2 Smart Waiting
- Selector-based waiting (not timeouts)
- Network idle detection
- Custom wait conditions
- Maximum time budgets
- Early termination on success

#### 5.3 Caching Strategy
- ETag/Last-Modified tracking
- Content hash comparison
- Tiered cache (memory → Redis → S3)
- Automatic cache invalidation
- Delta updates only

### 6. Developer Experience

#### 6.1 SDKs
```python
# Python SDK
from atlas_codex import Client

client = Client(api_key="...")
result = client.extract(
    url="https://example.com",
    schema=MySchema,
    use_browser=True
)
```

```javascript
// Node.js SDK
const { AtlasCodex } = require('@atlas-codex/sdk');

const client = new AtlasCodex({ apiKey: '...' });
const result = await client.extract({
    url: 'https://example.com',
    schema: schema
});
```

#### 6.2 Monitoring & Debugging
- Session recordings (rrweb format)
- HAR file exports
- Network request logs
- Screenshot capture at key points
- Error replay functionality
- Performance metrics per request

### 7. AI Framework Integrations

#### 7.1 MCP (Model Context Protocol) Server
```json
{
  "name": "atlas-codex",
  "tools": [
    {
      "name": "browse",
      "description": "Navigate to URL and interact with page"
    },
    {
      "name": "extract",
      "description": "Extract structured data from URLs"
    },
    {
      "name": "crawl",
      "description": "Discover and extract from multiple pages"
    },
    {
      "name": "screenshot",
      "description": "Capture page screenshots"
    }
  ]
}
```

#### 7.2 Native Integrations
- **LangChain:** Tools and document loaders
- **CrewAI:** Agent tools
- **OpenAI:** Function calling compatible
- **Anthropic:** Computer Use compatible
- **AutoGPT:** Plugin support

### 8. API Specifications

#### 8.1 Core Endpoints

**Extract Endpoint**
```
POST /api/extract
GET  /api/extract/{job_id}
GET  /api/extract/{job_id}/status
```

**Crawl Endpoint**
```
POST /api/crawl
GET  /api/crawl/{job_id}
GET  /api/crawl/{job_id}/links
```

**Session Management**
```
POST   /api/sessions
GET    /api/sessions
GET    /api/sessions/{id}
DELETE /api/sessions/{id}
POST   /api/sessions/{id}/interact
```

**Evidence & Artifacts**
```
GET /api/evidence/{evidence_id}
GET /api/artifacts/{artifact_id}
POST /api/diff
```

#### 8.2 Webhook Support
```json
{
  "webhook_url": "https://your-app.com/webhook",
  "webhook_events": ["job.completed", "job.failed"],
  "webhook_hmac_secret": "secret_key"
}
```

### 9. Pricing & Billing Model

#### 9.1 Credit System
- **1 credit** = 1 page fetched + extracted
- **Browser usage**: 2x credits when browser required
- **CAPTCHA solving**: 5 credits per solve
- **Proxy usage**: 0.1 credit per MB

#### 9.2 Pricing Tiers
```
Free:     1,000 credits/month    | 1 browser    | $0
Starter:  25,000 credits/month   | 10 browsers  | $25
Growth:   100,000 credits/month  | 50 browsers  | $75
Scale:    500,000 credits/month  | 200 browsers | $250
Enterprise: Custom               | Unlimited    | Custom
```

#### 9.3 Cost Advantages vs Hyperbrowser
- 50% lower base pricing
- No hidden proxy charges
- Transparent CAPTCHA costs
- Volume discounts
- Prepaid credit packages

---

## Technical Architecture

### Infrastructure Stack

```yaml
Core Services:
  API: FastAPI + Pydantic validation
  Queue: SQS + Redis
  Workers: Playwright on ECS Fargate
  Storage: S3 (artifacts) + DynamoDB (evidence)
  Database: PostgreSQL (jobs, metrics)
  Cache: Redis with tiered eviction

Browser Orchestration:
  Pools: Pre-warmed Chromium containers
  Contexts: Isolated per job
  Profiles: Persistent for stateful sessions
  Scaling: Auto-scale based on queue depth

Performance:
  CDN: CloudFront for artifacts
  Regions: US-East, US-West, EU-West
  Load Balancing: ALB with health checks
  Monitoring: CloudWatch + Grafana
```

### Security & Compliance

- **Encryption:** TLS 1.3 for transit, AES-256 for storage
- **Authentication:** API keys with HMAC signatures
- **Rate Limiting:** Per-key and per-domain limits
- **Isolation:** Separate browser contexts per customer
- **Compliance:** GDPR-ready, SOC2 path planned
- **Robots.txt:** Respected by default, override with flag

---

## Implementation Roadmap

### Phase 1: Core Platform (Weeks 1-4)
- [ ] Basic browser orchestration with Playwright
- [ ] Extract API with schema validation
- [ ] Evidence system with S3 storage
- [ ] Python & Node.js SDKs
- [ ] Basic stealth capabilities

### Phase 2: Scale & Performance (Weeks 5-8)
- [ ] Pre-warmed browser pools
- [ ] Intelligent escalation pipeline
- [ ] Proxy rotation system
- [ ] CAPTCHA detection & solving
- [ ] Redis caching layer

### Phase 3: AI Integrations (Weeks 9-12)
- [ ] MCP server implementation
- [ ] LangChain tools
- [ ] OpenAI function calling
- [ ] Webhook system
- [ ] Session recordings

### Phase 4: Advanced Features (Weeks 13-16)
- [ ] Custom browser profiles
- [ ] Advanced fingerprinting
- [ ] Network request interception
- [ ] PDF/document parsing
- [ ] Change monitoring

### Phase 5: Enterprise Features (Weeks 17-20)
- [ ] VPC deployment option
- [ ] Custom rate limits
- [ ] Priority queues
- [ ] Dedicated pools
- [ ] SLA guarantees

---

## Success Metrics

### Performance KPIs
- **Browser spin-up:** <500ms p50, <1s p99
- **Extract latency:** <2s p50 with browser
- **Success rate:** >95% on standard sites
- **Uptime:** 99.9% API availability

### Business KPIs
- **Cost per extraction:** <$0.001 at scale
- **Gross margin:** >70%
- **Customer acquisition cost:** <$100
- **Monthly churn:** <5%

### Technical KPIs
- **Evidence coverage:** 100% of extracted data
- **Cache hit rate:** >40%
- **Browser reuse:** >60% of requests
- **CAPTCHA solve rate:** >90%

---

## Competitive Analysis

### vs Hyperbrowser
**Advantages:**
- 50% lower cost
- Evidence-based extraction
- Faster browser spin-up
- Better caching strategy
- Webhook support

**Parity:**
- MCP server
- Session management
- Stealth capabilities
- SDK quality

### vs Apify/Browserless
**Advantages:**
- Native AI integrations
- Evidence system
- Smarter escalation
- Better pricing model

### vs Building In-House
**Advantages:**
- No infrastructure management
- Instant scaling
- Maintained stealth techniques
- Pooled proxy costs
- Continuous improvements

---

## Appendix: API Examples

### Example: Extract with Schema
```bash
curl -X POST https://api.atlascodex.com/v1/extract \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://example.com/products/*"],
    "schema": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "price": {"type": "number"},
        "availability": {"type": "boolean"}
      }
    },
    "depth": 2,
    "use_browser": "auto"
  }'
```

### Example: Monitor Changes
```python
from atlas_codex import Client

client = Client(api_key="...")

# Set up monitoring
monitor = client.monitor(
    url="https://example.com/pricing",
    check_interval="1h",
    webhook_url="https://your-app.com/webhook"
)

# Receive webhooks when content changes
```

### Example: MCP Integration
```javascript
// Use with Claude or other MCP-compatible tools
const response = await mcp.call('atlas-codex', 'extract', {
  url: 'https://example.com',
  schema: productSchema
});
```

---

*Atlas Codex - Industrial-strength web scraping, built for the AI era.*