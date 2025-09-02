/**
 * Atlas Codex Skill Registry
 * Domain-agnostic, composable extraction skills that can be planned and executed
 */

export interface SkillInput {
  [key: string]: any;
}

export interface SkillOutput {
  [key: string]: any;
  confidence?: number;
  citations?: Citation[];
}

export interface Citation {
  url: string;
  selector?: string;
  jsonPath?: string;
  contentHash: string;
}

export interface SkillCost {
  network: number; // 0-10
  cpu: 'none' | 'low' | 'medium' | 'high';
  tokens: 'none' | 'low' | 'medium' | 'high';
  time: number; // estimated ms
}

export interface SkillDefinition {
  name: string;
  description: string;
  inputs: Record<string, string>; // param name -> type
  outputs: Record<string, string>; // field name -> type
  preconditions: string[];
  postconditions: string[];
  cost: SkillCost;
  failureModes: string[];
  repair?: string;
  implementation: (input: SkillInput, context: ExecutionContext) => Promise<SkillOutput>;
}

export interface ExecutionContext {
  budget: {
    maxTime: number;
    maxTokens: number;
    maxRequests: number;
    used: {
      time: number;
      tokens: number;
      requests: number;
    };
  };
  trace: ExecutionTrace[];
  cache: Map<string, any>;
}

export interface ExecutionTrace {
  skill: string;
  input: SkillInput;
  output: SkillOutput;
  startTime: number;
  endTime: number;
  cost: SkillCost;
  errors?: string[];
}

/**
 * Core Skill Implementations
 */

const skills: Map<string, SkillDefinition> = new Map();

// 1. NormalizeUrl - Fix URL issues, resolve relative, standardize
skills.set('NormalizeUrl', {
  name: 'NormalizeUrl',
  description: 'Fix wrapping, resolve relative URLs, standardize scheme/host',
  inputs: { url: 'string', baseUrl: 'string?' },
  outputs: { url: 'string', canonical: 'string?' },
  preconditions: ['url is string'],
  postconditions: ['url is absolute', 'url is valid'],
  cost: { network: 0, cpu: 'low', tokens: 'none', time: 10 },
  failureModes: ['invalid URL', 'cannot resolve relative'],
  repair: 'Return original if normalization fails',
  implementation: async (input) => {
    try {
      const base = input.baseUrl || input.url;
      const url = new URL(input.url, base);
      
      // Normalize protocol
      if (url.protocol === 'http:') {
        url.protocol = 'https:';
      }
      
      // Remove trailing slashes, fragments
      url.hash = '';
      if (url.pathname.endsWith('/') && url.pathname !== '/') {
        url.pathname = url.pathname.slice(0, -1);
      }
      
      return {
        url: url.toString(),
        canonical: url.toString(),
        confidence: 1.0
      };
    } catch (e) {
      return {
        url: input.url,
        confidence: 0.3,
        error: e.message
      };
    }
  }
});

// 2. DiscoverLinks - Extract anchors with context
skills.set('DiscoverLinks', {
  name: 'DiscoverLinks',
  description: 'Extract anchors + surrounding context vectors; de-dup canonical',
  inputs: { html: 'string', scope: 'string', source: 'string' },
  outputs: { links: 'array<Link>', count: 'number' },
  preconditions: ['html contains content'],
  postconditions: ['links have href and text', 'links are unique by canonical URL'],
  cost: { network: 0, cpu: 'medium', tokens: 'none', time: 100 },
  failureModes: ['no links found', 'malformed HTML'],
  implementation: async (input) => {
    const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    const links = new Map<string, any>();
    
    let match;
    while ((match = linkPattern.exec(input.html)) !== null) {
      const href = match[1];
      const text = match[2].trim();
      
      // Extract surrounding context (simplified)
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(input.html.length, match.index + match[0].length + 100);
      const context = input.html.substring(contextStart, contextEnd)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // De-duplicate by canonical URL
      const canonical = href.split('#')[0].split('?')[0];
      if (!links.has(canonical)) {
        links.set(canonical, {
          href,
          text,
          context,
          canonical,
          position: match.index
        });
      }
    }
    
    return {
      links: Array.from(links.values()),
      count: links.size,
      confidence: links.size > 0 ? 0.9 : 0.1
    };
  }
});

// 3. RouteDomain - Classify content type from URL and context
skills.set('RouteDomain', {
  name: 'RouteDomain',
  description: 'Infer content class (article, product, listing, nav, legal) from URL + context',
  inputs: { url: 'string', context: 'string?', classes: 'array<string>' },
  outputs: { contentClass: 'string', confidence: 'number' },
  preconditions: ['url is valid'],
  postconditions: ['contentClass is in provided classes'],
  cost: { network: 0, cpu: 'low', tokens: 'low', time: 50 },
  failureModes: ['ambiguous classification', 'unknown pattern'],
  repair: 'Default to most common class with low confidence',
  implementation: async (input) => {
    const url = input.url.toLowerCase();
    const context = (input.context || '').toLowerCase();
    
    // Pattern-based classification (learned, not hardcoded in production)
    const patterns = {
      article: [
        /\/article\//,
        /\/story\//,
        /\/news\//,
        /\/\d{4}\/\d{2}\/\d{2}\//,
        /\/post\//,
        /\/blog\//
      ],
      product: [
        /\/product\//,
        /\/item\//,
        /\/dp\//,  // Amazon
        /\/p\//,   // Common product path
        /\/shop\//
      ],
      listing: [
        /\/category\//,
        /\/search/,
        /\/browse/,
        /\/collections?\//,
        /\/topics?\//
      ],
      nav: [
        /\/about/,
        /\/contact/,
        /\/help/,
        /\/support/,
        /\/(home|index)/
      ],
      legal: [
        /\/privacy/,
        /\/terms/,
        /\/legal/,
        /\/disclaimer/,
        /\/cookies/
      ]
    };
    
    let bestClass = input.classes[0] || 'article';
    let bestScore = 0;
    
    for (const [className, classPatterns] of Object.entries(patterns)) {
      if (!input.classes.includes(className)) continue;
      
      let score = 0;
      for (const pattern of classPatterns) {
        if (pattern.test(url)) score += 2;
        if (context && pattern.test(context)) score += 1;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestClass = className;
      }
    }
    
    // Context-based boost
    if (context) {
      if (context.includes('read more') || context.includes('min read')) {
        if (bestClass === 'article') bestScore += 2;
      }
      if (context.includes('$') || context.includes('price') || context.includes('buy')) {
        if (bestClass === 'product') bestScore += 2;
      }
    }
    
    return {
      contentClass: bestClass,
      confidence: Math.min(1, bestScore / 5)
    };
  }
});

// 4. DetectStructuredData - Parse JSON-LD, Microdata, RDFa
skills.set('DetectStructuredData', {
  name: 'DetectStructuredData',
  description: 'Parse JSON-LD, Microdata, RDFa; yield typed graph',
  inputs: { html: 'string' },
  outputs: { graph: 'array<object>', found: 'boolean' },
  preconditions: ['content_type=text/html'],
  postconditions: ['graph items have @type, properties'],
  cost: { network: 0, cpu: 'low', tokens: 'none', time: 50 },
  failureModes: ['malformed JSON', 'missing @type', 'multiple conflicting nodes'],
  repair: 'Fallback to HarvestMeta; if multiple nodes, prefer NewsArticle > Article > BlogPosting',
  implementation: async (input) => {
    const graph = [];
    
    // Extract JSON-LD
    const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/gi;
    let match;
    
    while ((match = jsonLdPattern.exec(input.html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        if (Array.isArray(data)) {
          graph.push(...data);
        } else if (data) {
          graph.push(data);
        }
      } catch (e) {
        // Malformed JSON-LD, skip
      }
    }
    
    // Sort by preference
    const typePreference = ['NewsArticle', 'Article', 'BlogPosting', 'Product', 'WebPage'];
    graph.sort((a, b) => {
      const aIndex = typePreference.indexOf(a['@type']) ?? 999;
      const bIndex = typePreference.indexOf(b['@type']) ?? 999;
      return aIndex - bIndex;
    });
    
    return {
      graph,
      found: graph.length > 0,
      confidence: graph.length > 0 ? 0.95 : 0
    };
  }
});

// 5. HarvestMeta - Extract OG/Twitter/standard meta tags
skills.set('HarvestMeta', {
  name: 'HarvestMeta',
  description: 'OG/Twitter/standard meta; normalize',
  inputs: { html: 'string' },
  outputs: { metadata: 'object' },
  preconditions: ['html contains head section'],
  postconditions: ['metadata has title or description'],
  cost: { network: 0, cpu: 'low', tokens: 'none', time: 30 },
  failureModes: ['no meta tags', 'conflicting values'],
  implementation: async (input) => {
    const metadata: any = {};
    
    // Title
    const titleMatch = input.html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) metadata.title = titleMatch[1].trim();
    
    // Meta tags
    const metaPattern = /<meta\s+([^>]+)>/gi;
    let match;
    
    while ((match = metaPattern.exec(input.html)) !== null) {
      const attrs = match[1];
      
      // Extract property/name and content
      const propMatch = attrs.match(/(?:property|name)=["']([^"']+)["']/i);
      const contentMatch = attrs.match(/content=["']([^"']+)["']/i);
      
      if (propMatch && contentMatch) {
        const prop = propMatch[1];
        const content = contentMatch[1];
        
        // Map to normalized keys
        if (prop.startsWith('og:')) {
          metadata[prop] = content;
        } else if (prop.startsWith('twitter:')) {
          metadata[prop] = content;
        } else if (prop === 'description') {
          metadata.description = content;
        } else if (prop === 'author') {
          metadata.author = content;
        } else if (prop === 'keywords') {
          metadata.keywords = content.split(',').map(k => k.trim());
        }
      }
    }
    
    return {
      metadata,
      confidence: Object.keys(metadata).length > 2 ? 0.8 : 0.3
    };
  }
});

// 6. InferSchema - Propose JSON schema from examples and intent
skills.set('InferSchema', {
  name: 'InferSchema',
  description: 'Propose a JSON schema from examples + task intent',
  inputs: { examples: 'array<object>', hint: 'string', targetType: 'string' },
  outputs: { schema: 'object' },
  preconditions: ['examples or hint provided'],
  postconditions: ['schema is valid JSON Schema'],
  cost: { network: 0, cpu: 'medium', tokens: 'low', time: 100 },
  failureModes: ['insufficient examples', 'conflicting types'],
  implementation: async (input) => {
    // Schema library based on content type hints
    const schemaLibrary = {
      'news/article': {
        type: 'object',
        required: ['title', 'url'],
        properties: {
          title: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          summary: { type: 'string' },
          author: { type: 'string' },
          section: { type: 'string' },
          datePublished: { type: 'string', format: 'date-time' },
          image: { type: 'string', format: 'uri' }
        }
      },
      'commerce/product': {
        type: 'object',
        required: ['name', 'price'],
        properties: {
          name: { type: 'string' },
          price: { type: 'string' },
          currency: { type: 'string', default: 'USD' },
          rating: { type: 'number', minimum: 0, maximum: 5 },
          reviews: { type: 'integer', minimum: 0 },
          image: { type: 'string', format: 'uri' },
          availability: { type: 'string' }
        }
      },
      'events/listing': {
        type: 'object',
        required: ['name', 'startDate'],
        properties: {
          name: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          location: { type: 'string' },
          description: { type: 'string' },
          url: { type: 'string', format: 'uri' }
        }
      }
    };
    
    // Select based on hint
    const schema = schemaLibrary[input.hint] || schemaLibrary['news/article'];
    
    // Adapt based on examples if provided
    if (input.examples && input.examples.length > 0) {
      // Analyze examples to adjust schema (simplified)
      const allKeys = new Set<string>();
      input.examples.forEach(ex => {
        Object.keys(ex).forEach(key => allKeys.add(key));
      });
      
      // Add any missing properties from examples
      allKeys.forEach(key => {
        if (!schema.properties[key]) {
          schema.properties[key] = { type: 'string' };
        }
      });
    }
    
    return {
      schema,
      confidence: 0.85
    };
  }
});

// 7. MapFields - Align page fields to target schema
skills.set('MapFields', {
  name: 'MapFields',
  description: 'Align page fields → target schema with confidence per field',
  inputs: { source: 'object', targetSchema: 'object' },
  outputs: { mapped: 'object', fieldConfidence: 'object' },
  preconditions: ['source has data', 'targetSchema is valid'],
  postconditions: ['mapped conforms to targetSchema'],
  cost: { network: 0, cpu: 'low', tokens: 'none', time: 50 },
  failureModes: ['missing required fields', 'type mismatches'],
  repair: 'Use defaults or null for missing fields',
  implementation: async (input) => {
    const mapped: any = {};
    const fieldConfidence: any = {};
    const schema = input.targetSchema;
    
    // Map each schema field
    for (const [field, fieldSchema] of Object.entries(schema.properties || {})) {
      // Try multiple source locations
      const candidates = [
        input.source[field],
        input.source[field.toLowerCase()],
        input.source['og:' + field],
        input.source['twitter:' + field]
      ];
      
      let value = null;
      let confidence = 0;
      
      for (const candidate of candidates) {
        if (candidate !== undefined && candidate !== null) {
          value = candidate;
          confidence = 0.9;
          break;
        }
      }
      
      // Special field mappings
      if (!value) {
        if (field === 'summary' && input.source.description) {
          value = input.source.description;
          confidence = 0.7;
        } else if (field === 'author' && input.source.creator) {
          value = input.source.creator;
          confidence = 0.7;
        } else if (field === 'datePublished' && input.source.date) {
          value = input.source.date;
          confidence = 0.6;
        }
      }
      
      if (value !== null) {
        mapped[field] = value;
        fieldConfidence[field] = confidence;
      } else if (schema.required?.includes(field)) {
        mapped[field] = '';
        fieldConfidence[field] = 0;
      }
    }
    
    return {
      mapped,
      fieldConfidence,
      confidence: Object.values(fieldConfidence).reduce((a: number, b: number) => a + b, 0) / 
                  Object.keys(fieldConfidence).length
    };
  }
});

// 8. RankItems - Deterministic top-N selection
skills.set('RankItems', {
  name: 'RankItems',
  description: 'Deterministic top-N selection by multi-criteria',
  inputs: { items: 'array<object>', limit: 'number', criteria: 'object' },
  outputs: { ranked: 'array<object>' },
  preconditions: ['items is array'],
  postconditions: ['ranked.length <= limit', 'order is deterministic'],
  cost: { network: 0, cpu: 'low', tokens: 'none', time: 30 },
  failureModes: ['insufficient items'],
  implementation: async (input) => {
    const items = [...input.items];
    const limit = input.limit || 10;
    
    // Score each item
    items.forEach((item: any) => {
      let score = 0;
      
      // Position score (items appearing earlier are preferred)
      if (item.position !== undefined) {
        score += (1000 - item.position) / 1000;
      }
      
      // Completeness score
      const fields = Object.keys(item).filter(k => item[k] !== null && item[k] !== '');
      score += fields.length / 10;
      
      // Recency score if date available
      if (item.datePublished) {
        const date = new Date(item.datePublished);
        const age = Date.now() - date.getTime();
        const dayAge = age / (1000 * 60 * 60 * 24);
        score += Math.max(0, 30 - dayAge) / 30;
      }
      
      item._score = score;
    });
    
    // Sort by score, then by position for determinism
    items.sort((a: any, b: any) => {
      if (Math.abs(a._score - b._score) < 0.001) {
        return (a.position || 0) - (b.position || 0);
      }
      return b._score - a._score;
    });
    
    // Remove score field and limit
    const ranked = items.slice(0, limit);
    ranked.forEach((item: any) => delete item._score);
    
    return {
      ranked,
      confidence: 0.9
    };
  }
});

// 9. ValidateOutput - Schema and coherence validation
skills.set('ValidateOutput', {
  name: 'ValidateOutput',
  description: 'Schema/type/coherence checks; repair if possible',
  inputs: { data: 'object', schema: 'object', repair: 'boolean' },
  outputs: { valid: 'boolean', data: 'object', errors: 'array<string>' },
  preconditions: ['schema is valid JSON Schema'],
  postconditions: ['output indicates validity', 'errors are descriptive'],
  cost: { network: 0, cpu: 'low', tokens: 'none', time: 20 },
  failureModes: ['unrepairable schema violations'],
  implementation: async (input) => {
    const errors: string[] = [];
    let data = { ...input.data };
    const schema = input.schema;
    
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!data[field]) {
          errors.push(`Missing required field: ${field}`);
          if (input.repair) {
            data[field] = '';
          }
        }
      }
    }
    
    // Check types
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (data[field] !== undefined) {
          const expectedType = (fieldSchema as any).type;
          const actualType = Array.isArray(data[field]) ? 'array' : typeof data[field];
          
          if (expectedType && actualType !== expectedType) {
            errors.push(`Field ${field}: expected ${expectedType}, got ${actualType}`);
            if (input.repair) {
              // Attempt type coercion
              if (expectedType === 'string') {
                data[field] = String(data[field]);
              } else if (expectedType === 'number') {
                data[field] = Number(data[field]) || 0;
              }
            }
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      data,
      errors,
      confidence: errors.length === 0 ? 1.0 : 0.5
    };
  }
});

// 10. CiteEvidence - Attach provenance
skills.set('CiteEvidence', {
  name: 'CiteEvidence',
  description: 'Attach minimal provenance (url, selectors, hashes)',
  inputs: { data: 'object', source: 'string', selectors: 'object' },
  outputs: { data: 'object' },
  preconditions: ['data exists'],
  postconditions: ['data has _citations field'],
  cost: { network: 0, cpu: 'low', tokens: 'none', time: 10 },
  failureModes: [],
  implementation: async (input) => {
    const data = { ...input.data };
    
    // Generate content hash
    const hash = (str: string) => {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
      }
      return h.toString(16);
    };
    
    // Add citations
    const citations: Citation[] = [];
    for (const [field, value] of Object.entries(data)) {
      if (typeof value === 'string' && value) {
        citations.push({
          url: input.source,
          selector: input.selectors?.[field],
          contentHash: hash(value)
        });
      }
    }
    
    data._citations = citations;
    data._extractedAt = new Date().toISOString();
    data._source = input.source;
    
    return {
      data,
      confidence: 1.0
    };
  }
});

/**
 * Export the registry
 */
export const SkillRegistry = {
  get: (name: string) => skills.get(name),
  list: () => Array.from(skills.keys()),
  register: (skill: SkillDefinition) => skills.set(skill.name, skill),
  skills: Array.from(skills.values())
};