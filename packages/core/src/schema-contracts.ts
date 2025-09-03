/**
 * Evidence-First Schema Contracts System
 * Implements schema contracts that serve as priors, not prisons
 */

export type FieldType = 'text' | 'number' | 'url' | 'date' | 'email' | 'phone' | 'image' | 'boolean' | 'array' | 'object';

export type FieldPriority = 'required' | 'expected' | 'discoverable';

export interface FieldSpec {
  name: string;
  type: FieldType;
  priority: FieldPriority;
  description?: string;
  examples?: string[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    enum?: string[];
  };
  extractionHints?: {
    selectors?: string[];
    keywords?: string[];
    negativeKeywords?: string[];
  };
}

export interface SchemaContract {
  id: string;
  name: string;
  description: string;
  fields: FieldSpec[];
  metadata: {
    domain?: string;
    confidence: number;
    source: 'template' | 'generated' | 'hybrid';
    created: string;
    userQuery: string;
  };
  validation: {
    minRequiredFields: number;
    allowAdditionalFields: boolean;
    strictMode: boolean;
  };
}

export interface ContractGenerationContext {
  userQuery: string;
  url?: string;
  contentSample?: string;
  existingTemplates?: SchemaContract[];
  userPreferences?: {
    verbosity: 'minimal' | 'standard' | 'detailed';
    format: 'structured' | 'narrative' | 'mixed';
  };
}

export interface EvidenceTrack {
  type: 'deterministic' | 'llm_augmented';
  confidence: number;
  source: string;
  fields: Record<string, any>;
  metadata: {
    extractionMethod: string;
    processingTime: number;
    errors?: string[];
  };
}

export interface SchemaEvidence {
  contractId: string;
  deterministicTrack: EvidenceTrack;
  llmTrack?: EvidenceTrack;
  negotiatedSchema: SchemaContract;
  finalData: Record<string, any>;
  metadata: {
    totalProcessingTime: number;
    trackComparison?: {
      agreement: number;
      conflicts: string[];
      resolutions: string[];
    };
  };
}

/**
 * Schema Contract Generator
 * Converts user queries into structured schema contracts
 */
export class SchemaContractGenerator {
  private readonly existingContracts: Map<string, SchemaContract> = new Map();

  constructor(existingContracts: SchemaContract[] = []) {
    existingContracts.forEach(contract => {
      this.existingContracts.set(contract.id, contract);
    });
  }

  /**
   * Generate schema contract from user query and context
   */
  async generateContract(context: ContractGenerationContext): Promise<SchemaContract> {
    const query = context.userQuery.toLowerCase();
    
    // First, check for existing template matches
    const templateMatch = this.findBestTemplateMatch(context);
    if (templateMatch && templateMatch.confidence > 0.8) {
      return this.adaptTemplateToQuery(templateMatch.contract, context);
    }

    // Generate new contract based on query analysis
    return this.generateNewContract(context);
  }

  /**
   * Find best matching template contract
   */
  private findBestTemplateMatch(context: ContractGenerationContext): { contract: SchemaContract, confidence: number } | null {
    const query = context.userQuery.toLowerCase();
    let bestMatch: { contract: SchemaContract, confidence: number } | null = null;

    for (const contract of this.existingContracts.values()) {
      const confidence = this.calculateTemplateConfidence(query, contract);
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { contract, confidence };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate confidence score for template matching
   */
  private calculateTemplateConfidence(query: string, contract: SchemaContract): number {
    let score = 0;
    
    // Domain matching
    if (contract.metadata.domain) {
      const domainKeywords = this.getDomainKeywords(contract.metadata.domain);
      const domainMatches = domainKeywords.filter(keyword => query.includes(keyword)).length;
      score += (domainMatches / domainKeywords.length) * 0.3;
    }

    // Field semantic matching
    const fieldMatches = contract.fields.filter(field => {
      const fieldKeywords = [field.name, ...(field.examples || [])];
      return fieldKeywords.some(keyword => query.includes(keyword.toLowerCase()));
    }).length;
    score += (fieldMatches / contract.fields.length) * 0.4;

    // Description matching
    if (contract.description) {
      const descWords = contract.description.toLowerCase().split(' ');
      const queryWords = query.split(' ');
      const commonWords = descWords.filter(word => queryWords.includes(word)).length;
      score += (commonWords / Math.max(descWords.length, queryWords.length)) * 0.3;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Adapt existing template to specific query
   */
  private adaptTemplateToQuery(baseContract: SchemaContract, context: ContractGenerationContext): SchemaContract {
    const query = context.userQuery.toLowerCase();
    
    // Adjust field priorities based on query
    const adaptedFields = baseContract.fields.map(field => {
      const isExplicitlyMentioned = query.includes(field.name.toLowerCase()) || 
        (field.examples && field.examples.some(ex => query.includes(ex.toLowerCase())));
      
      if (isExplicitlyMentioned && field.priority === 'discoverable') {
        return { ...field, priority: 'expected' as FieldPriority };
      }
      return field;
    });

    // Add query-specific fields
    const additionalFields = this.inferFieldsFromQuery(context.userQuery);
    
    return {
      ...baseContract,
      id: `adapted_${baseContract.id}_${Date.now()}`,
      name: `${baseContract.name} (Adapted)`,
      fields: [...adaptedFields, ...additionalFields],
      metadata: {
        ...baseContract.metadata,
        source: 'hybrid',
        created: new Date().toISOString(),
        userQuery: context.userQuery,
        confidence: 0.9
      }
    };
  }

  /**
   * Generate completely new contract from query
   */
  private generateNewContract(context: ContractGenerationContext): SchemaContract {
    const query = context.userQuery;
    const inferredFields = this.inferFieldsFromQuery(query);
    const domain = this.inferDomain(query, context.url);

    return {
      id: `generated_${Date.now()}`,
      name: `Custom Extraction: ${query.substring(0, 50)}...`,
      description: `Generated schema for: ${query}`,
      fields: inferredFields,
      metadata: {
        domain,
        confidence: 0.7,
        source: 'generated',
        created: new Date().toISOString(),
        userQuery: query
      },
      validation: {
        minRequiredFields: Math.min(2, inferredFields.filter(f => f.priority === 'required').length),
        allowAdditionalFields: true,
        strictMode: false
      }
    };
  }

  /**
   * Infer fields from natural language query
   */
  private inferFieldsFromQuery(query: string): FieldSpec[] {
    const fields: FieldSpec[] = [];
    const queryLower = query.toLowerCase();

    // Common field patterns
    const fieldPatterns: Array<{ pattern: RegExp; field: Partial<FieldSpec> }> = [
      {
        pattern: /\b(name|title|headline|header)\b/i,
        field: { name: 'name', type: 'text', priority: 'required' }
      },
      {
        pattern: /\b(description|summary|content|text|body)\b/i,
        field: { name: 'description', type: 'text', priority: 'expected' }
      },
      {
        pattern: /\b(url|link|href)\b/i,
        field: { name: 'url', type: 'url', priority: 'expected' }
      },
      {
        pattern: /\b(price|cost|amount|fee)\b/i,
        field: { name: 'price', type: 'text', priority: 'required' }
      },
      {
        pattern: /\b(date|time|when|schedule)\b/i,
        field: { name: 'date', type: 'date', priority: 'expected' }
      },
      {
        pattern: /\b(email|contact)\b/i,
        field: { name: 'email', type: 'email', priority: 'discoverable' }
      },
      {
        pattern: /\b(phone|number)\b/i,
        field: { name: 'phone', type: 'phone', priority: 'discoverable' }
      },
      {
        pattern: /\b(image|photo|picture)\b/i,
        field: { name: 'image', type: 'image', priority: 'discoverable' }
      },
      {
        pattern: /\b(author|creator|by)\b/i,
        field: { name: 'author', type: 'text', priority: 'expected' }
      },
      {
        pattern: /\b(category|section|type|department)\b/i,
        field: { name: 'category', type: 'text', priority: 'expected' }
      }
    ];

    fieldPatterns.forEach(({ pattern, field }) => {
      if (pattern.test(queryLower)) {
        fields.push({
          name: field.name!,
          type: field.type!,
          priority: field.priority!,
          description: `Inferred from query: "${query}"`,
          extractionHints: {
            keywords: pattern.source.match(/\\b\(([^)]+)\)\\b/)?.[1].split('|') || []
          }
        });
      }
    });

    // If no fields inferred, provide basic structure
    if (fields.length === 0) {
      fields.push(
        {
          name: 'title',
          type: 'text',
          priority: 'required',
          description: 'Main identifier or name'
        },
        {
          name: 'content',
          type: 'text',
          priority: 'expected',
          description: 'Main content or description'
        },
        {
          name: 'metadata',
          type: 'object',
          priority: 'discoverable',
          description: 'Additional discovered fields'
        }
      );
    }

    return fields;
  }

  /**
   * Infer domain from query and URL
   */
  private inferDomain(query: string, url?: string): string {
    const queryLower = query.toLowerCase();
    
    if (url) {
      if (url.includes('news') || url.includes('article')) return 'news';
      if (url.includes('shop') || url.includes('store') || url.includes('product')) return 'commerce';
      if (url.includes('event') || url.includes('calendar')) return 'events';
      if (url.includes('job') || url.includes('career')) return 'jobs';
      if (url.includes('edu') || url.includes('academic')) return 'academic';
    }

    if (queryLower.includes('article') || queryLower.includes('news')) return 'news';
    if (queryLower.includes('product') || queryLower.includes('price') || queryLower.includes('buy')) return 'commerce';
    if (queryLower.includes('event') || queryLower.includes('schedule')) return 'events';
    if (queryLower.includes('job') || queryLower.includes('position') || queryLower.includes('career')) return 'jobs';
    if (queryLower.includes('course') || queryLower.includes('research') || queryLower.includes('academic')) return 'academic';

    return 'general';
  }

  /**
   * Get domain-specific keywords for matching
   */
  private getDomainKeywords(domain: string): string[] {
    const domainKeywords: Record<string, string[]> = {
      'news': ['article', 'news', 'story', 'headline', 'report'],
      'commerce': ['product', 'price', 'buy', 'shop', 'store', 'item'],
      'events': ['event', 'calendar', 'schedule', 'date', 'time'],
      'jobs': ['job', 'position', 'career', 'role', 'employment'],
      'academic': ['research', 'paper', 'study', 'course', 'faculty', 'department'],
      'people': ['person', 'profile', 'team', 'member', 'staff', 'employee']
    };

    return domainKeywords[domain] || [];
  }
}