# Atlas Codex Generator System

A skill-based, learning extraction architecture that gets smarter over time instead of accumulating brittle site-specific rules.

## Architecture Overview

The Atlas Generator implements a composable, AI-native extraction system based on atomic skills that can be planned, executed, and improved through feedback loops.

### Core Components

1. **Skill Registry** - Domain-agnostic, atomic extraction skills
2. **Planner** - Generates skill-based execution plans  
3. **Executor** - Runs plans with budget controls and tracing
4. **Evaluator** - Critiques plans and scores execution results
5. **Learning System** - Continuous improvement through feedback

## Key Features

### ✅ **Composable Skills**
- 10+ atomic skills like `NormalizeUrl`, `DetectStructuredData`, `MapFields`
- Each skill has inputs, outputs, preconditions, postconditions, and costs
- Skills are swappable and reusable across domains

### ✅ **AI-Powered Planning** 
- Generates execution plans using skill composition
- No site-specific rules - only abstract schemas (news.article, commerce.product)
- Falls back to rule-based planning when AI unavailable

### ✅ **Budget-Aware Execution**
- Enforces time, token, and request budgets
- Returns partial results when budget exhausted
- Caching and optimization for expensive operations

### ✅ **Quality Assurance**
- Preflight critique validates plans before execution
- Post-execution evaluation with multi-metric scoring
- Confidence scoring and citation tracking

### ✅ **Continuous Learning**
- Records execution traces for improvement
- Identifies successful vs failed patterns
- Auto-flags poor performance for retraining

## Quick Start

```typescript
import { createAtlasGenerator } from './atlas-generator';

// Simple usage
const atlas = createAtlasGenerator();
const result = await atlas.extractArticles('https://nytimes.com');

// Custom task
const result = await atlas.extract({
  description: 'Extract top 10 tech articles with authors',
  url: 'https://techcrunch.com',
  intent: 'collect',
  domain: 'news'
}, { url: 'https://techcrunch.com' });

// With AI planning
const smartAtlas = createAtlasGenerator({
  openai_api_key: 'sk-...',
  use_ai_planner: true
});
```

## Skill System

### Available Skills

| Skill | Purpose | Inputs | Outputs |
|-------|---------|--------|---------|
| `NormalizeUrl` | Fix URL issues, resolve relative | url, baseUrl? | url, canonical |
| `DiscoverLinks` | Extract anchors with context | html, scope | links[], count |
| `RouteDomain` | Classify content type | url, context | contentClass, confidence |
| `DetectStructuredData` | Parse JSON-LD, microdata | html | graph[], found |
| `HarvestMeta` | Extract OG/Twitter meta | html | metadata{} |
| `InferSchema` | Propose JSON schema | examples, hint | schema{} |
| `MapFields` | Align fields to schema | source, targetSchema | mapped{}, confidence{} |
| `RankItems` | Top-N selection | items[], limit, criteria | ranked[] |
| `ValidateOutput` | Schema validation | data, schema | valid, data, errors[] |
| `CiteEvidence` | Add provenance | data, source | data with citations |

### Adding New Skills

```typescript
import { SkillRegistry } from './skill-registry';

SkillRegistry.register({
  name: 'MyCustomSkill',
  description: 'Does something useful',
  inputs: { text: 'string' },
  outputs: { result: 'string' },
  preconditions: ['text exists'],
  postconditions: ['result is formatted'],
  cost: { network: 0, cpu: 'low', tokens: 'none', time: 100 },
  failureModes: ['empty input'],
  implementation: async (input, context) => {
    // Your logic here
    return { result: input.text.toUpperCase(), confidence: 1.0 };
  }
});
```

## Planning System

### Plan Structure

```typescript
interface ExecutionPlan {
  task: string;
  target_schema: any;        // JSON Schema for output
  constraints: {             // Execution limits
    max_items?: number;
    max_time?: number;
    quality_threshold?: number;
  };
  plan: PlanStep[];          // Ordered skill execution
  estimated_cost: Cost;      // Resource estimates
  success_criteria: string[];
  failure_modes: string[];
  fallback_strategies: string[];
}
```

### Example Plan

```json
{
  "task": "Extract top 10 news articles",
  "target_schema": {
    "type": "array",
    "items": {
      "type": "object",
      "required": ["title", "url"],
      "properties": {
        "title": {"type": "string"},
        "url": {"type": "string"},
        "summary": {"type": "string"}
      }
    }
  },
  "plan": [
    {"use": "NormalizeUrl"},
    {"use": "DiscoverLinks", "with": {"scope": "document"}},
    {"use": "RouteDomain", "with": {"prefer": "article"}},
    {"use": "DetectStructuredData", "or": {"use": "HarvestMeta"}},
    {"use": "MapFields", "with": {"to": "target_schema"}},
    {"use": "RankItems"},
    {"use": "ValidateOutput", "repair": true},
    {"use": "CiteEvidence"}
  ]
}
```

## Evaluation & Learning

### Quality Metrics

- **Schema Validity** (0-1) - Output conforms to expected schema
- **Field Coverage** (0-1) - Required fields are present and populated
- **Precision** (0-1) - Field values are accurate and confident
- **Determinism** (0-1) - Results are reproducible
- **Cost Efficiency** (0-1) - Execution within budget estimates
- **Freshness** (0-1) - Content recency when applicable

### Learning Loop

1. **Preflight** - Validate plan before execution
2. **Runtime** - Execute with budget enforcement and tracing
3. **Post-mortem** - Score results and extract lessons
4. **Feedback** - Store traces for future plan improvement

## Integration Examples

### Lambda Integration

```javascript
const { processNaturalLanguage } = require('./atlas-generator-integration');

exports.handler = async (event) => {
  const { prompt } = JSON.parse(event.body);
  
  const result = await processNaturalLanguage(prompt, {
    apiKey: process.env.OPENAI_API_KEY
  });
  
  return {
    statusCode: 200,
    body: JSON.stringify(result)
  };
};
```

### Frontend Integration

```javascript
// Call AI processor endpoint
const response = await fetch('/api/ai/process', {
  method: 'POST',
  body: JSON.stringify({ 
    prompt: 'Get top 10 articles from nytimes.com',
    autoExecute: false 
  })
});

const plan = await response.json();

// Plan now includes extraction instructions and structured schema
// Worker will use these to return only requested data
```

## Benefits Over Rule-Based Systems

### ❌ Old Way (Brittle)
```javascript
// Site-specific rules that break over time
if (url.includes('nytimes')) {
  return extractNYTimesArticles(html);
} else if (url.includes('techcrunch')) {
  return extractTechCrunchArticles(html);
}
```

### ✅ New Way (Generative)
```javascript
// Composable skills that work across sites
const plan = [
  { use: 'DiscoverLinks' },
  { use: 'RouteDomain', with: { prefer: 'article' } },
  { use: 'DetectStructuredData' },
  { use: 'MapFields', with: { to: 'news.article' } }
];
```

## Performance

- **Latency**: 2-8 seconds typical extraction
- **Accuracy**: 85-95% field coverage on structured sites
- **Scalability**: Budget-controlled execution prevents runaway costs
- **Reliability**: Multiple fallback strategies per skill

## Future Roadmap

- [ ] Add more domain-specific skills (job postings, real estate, etc.)
- [ ] Implement skill fine-tuning based on success patterns  
- [ ] Add visual content extraction skills (images, videos)
- [ ] Browser automation skills for JavaScript-heavy sites
- [ ] Multi-language content support
- [ ] Real-time monitoring and alerting

## Contributing

1. Add new skills to the `SkillRegistry`
2. Extend planning templates for new domains
3. Improve evaluation metrics and learning algorithms
4. Add integration examples for different platforms

## License

MIT - See LICENSE file for details