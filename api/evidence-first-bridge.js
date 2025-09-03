/**
 * Evidence-First Bridge for Lambda Integration
 * CommonJS wrapper for the TypeScript evidence-first system
 */

const { processWithPlanBasedSystem } = require('./worker-enhanced');

/**
 * Evidence-First Enhanced Processor (CommonJS implementation)
 * Bridges the gap between evidence-first processing and the existing plan-based system
 */
class EvidenceFirstProcessor {
  constructor() {
    this.coreTemplates = this.initializeCoreTemplates();
  }

  /**
   * Main processing method - enhanced version of processWithPlanBasedSystem
   */
  async processWithEvidenceFirst(htmlContent, params) {
    const startTime = Date.now();
    
    try {
      // Determine if we should use evidence-first processing
      if (params.useEvidenceFirst !== false && this.shouldUseEvidenceFirst(params)) {
        console.log('🧠 Using Evidence-First enhanced processing');
        return await this.runEvidenceFirstEnhanced(htmlContent, params);
      } else {
        console.log('📋 Using standard Plan-Based processing');
        return await processWithPlanBasedSystem(htmlContent, params);
      }
    } catch (error) {
      console.error('Evidence-first processing failed, falling back:', error.message);
      // Always fallback to plan-based system
      return await processWithPlanBasedSystem(htmlContent, params);
    }
  }

  /**
   * Enhanced evidence-first processing
   */
  async runEvidenceFirstEnhanced(htmlContent, params) {
    const startTime = Date.now();

    // Step 1: Generate schema contract from query
    const contract = this.generateSchemaContract(params.extractionInstructions, params.url);
    console.log(`📋 Generated schema contract: ${contract.name} (${contract.fields.length} fields)`);

    // Step 2: Run deterministic track (DOM analysis)
    const deterministicResult = this.runDeterministicExtraction(htmlContent, contract);
    console.log(`🔍 Deterministic track found ${Object.keys(deterministicResult.fields).length} fields with confidence ${deterministicResult.confidence.toFixed(2)}`);

    // Step 3: Enhance parameters with contract insights
    const enhancedParams = this.enhanceParamsWithContract(params, contract, deterministicResult);

    // Step 4: Run plan-based system with enhanced context
    const planResult = await processWithPlanBasedSystem(htmlContent, enhancedParams);

    // Step 5: Schema negotiation and final compilation
    const finalResult = this.negotiateAndCompileResults(contract, deterministicResult, planResult);

    return {
      ...planResult,
      success: finalResult.success,
      data: finalResult.data,
      metadata: {
        ...planResult.metadata,
        processingMethod: 'evidence_first_enhanced',
        schemaContract: {
          id: contract.id,
          name: contract.name,
          fieldsGenerated: contract.fields.length,
          confidence: contract.confidence
        },
        deterministicTrack: {
          confidence: deterministicResult.confidence,
          fieldsFound: Object.keys(deterministicResult.fields).length
        },
        evidenceFirst: {
          contractGenerated: true,
          schemaNegotiated: true,
          totalProcessingTime: Date.now() - startTime,
          enhancementApplied: true
        }
      }
    };
  }

  /**
   * Determine if evidence-first processing should be used
   */
  shouldUseEvidenceFirst(params) {
    const query = (params.extractionInstructions || '').toLowerCase();

    // Use evidence-first for ambiguous or complex queries
    const ambiguousPatterns = [
      /\b(extract|get|find|list)\b.*\b(all|any|different|various)\b/i,
      /\b(names?|information|data|details)\b.*(?!person|people|staff|team|employee)/i,
      /\b(departments?|categories?|sections?|types?)\b/i,
      /(what|which|how many).*(?:are|is|on)/i,
      /just.*names?.*of.*different/i // Specific pattern like "just the names of the different departments"
    ];

    const isAmbiguous = ambiguousPatterns.some(pattern => pattern.test(query));

    // Check for queries that don't fit standard templates well
    const standardTemplateKeywords = [
      'team member', 'staff profile', 'employee directory',
      'product listing', 'price list', 'shop items',
      'news article', 'story headlines',
      'event calendar', 'schedule'
    ];

    const hasStandardKeywords = standardTemplateKeywords.some(keyword => query.includes(keyword));

    console.log(`Query analysis: ambiguous=${isAmbiguous}, standardKeywords=${hasStandardKeywords}`);
    
    return isAmbiguous || !hasStandardKeywords;
  }

  /**
   * Generate schema contract from user query
   */
  generateSchemaContract(extractionInstructions, url) {
    const query = extractionInstructions.toLowerCase();
    const contractId = `contract_${Date.now()}`;

    // Analyze query intent and generate appropriate fields
    const fields = this.inferFieldsFromQuery(query);
    const domain = this.inferDomainFromQuery(query, url);
    const confidence = this.calculateContractConfidence(query, fields);

    return {
      id: contractId,
      name: `Evidence-Based Contract: ${extractionInstructions.substring(0, 40)}...`,
      description: `Generated from query: "${extractionInstructions}"`,
      fields: fields,
      domain: domain,
      confidence: confidence,
      metadata: {
        source: 'evidence_first_generated',
        created: new Date().toISOString(),
        userQuery: extractionInstructions
      }
    };
  }

  /**
   * Infer fields from natural language query
   */
  inferFieldsFromQuery(query) {
    const fields = [];

    // Core field patterns with priorities
    const fieldPatterns = [
      {
        pattern: /\b(name|title|headline|header)\b/i,
        field: { name: 'name', type: 'text', priority: 'required', description: 'Name or title' }
      },
      {
        pattern: /\b(description|summary|content|details|about)\b/i,
        field: { name: 'description', type: 'text', priority: 'expected', description: 'Description or content' }
      },
      {
        pattern: /\b(url|link|href|website)\b/i,
        field: { name: 'url', type: 'url', priority: 'expected', description: 'Associated URL' }
      },
      {
        pattern: /\b(category|section|type|department|division)\b/i,
        field: { name: 'category', type: 'text', priority: 'required', description: 'Category or classification' }
      },
      {
        pattern: /\b(price|cost|amount|fee|value)\b/i,
        field: { name: 'price', type: 'text', priority: 'required', description: 'Price or cost' }
      },
      {
        pattern: /\b(date|time|when|schedule)\b/i,
        field: { name: 'date', type: 'date', priority: 'expected', description: 'Date or time' }
      },
      {
        pattern: /\b(author|creator|by|written)\b/i,
        field: { name: 'author', type: 'text', priority: 'discoverable', description: 'Author or creator' }
      },
      {
        pattern: /\b(image|photo|picture|img)\b/i,
        field: { name: 'image', type: 'image', priority: 'discoverable', description: 'Associated image' }
      },
      {
        pattern: /\b(email|contact|mail)\b/i,
        field: { name: 'email', type: 'email', priority: 'discoverable', description: 'Email contact' }
      },
      {
        pattern: /\b(phone|number|tel)\b/i,
        field: { name: 'phone', type: 'phone', priority: 'discoverable', description: 'Phone number' }
      }
    ];

    // Apply patterns to query
    fieldPatterns.forEach(({ pattern, field }) => {
      if (pattern.test(query)) {
        fields.push({
          ...field,
          extractionHints: {
            keywords: pattern.source.match(/\\b\(([^)]+)\)\\b/)?.[1].split('|') || [field.name]
          }
        });
      }
    });

    // Special handling for department/category queries
    if (query.includes('department') || query.includes('different')) {
      fields.push({
        name: 'departments',
        type: 'array',
        priority: 'required',
        description: 'List of departments or categories',
        extractionHints: {
          keywords: ['department', 'division', 'section', 'category'],
          structure: 'list'
        }
      });
    }

    // If no specific fields inferred, use generic structure
    if (fields.length === 0) {
      fields.push(
        {
          name: 'title',
          type: 'text',
          priority: 'required',
          description: 'Main title or identifier'
        },
        {
          name: 'content',
          type: 'text',
          priority: 'expected',
          description: 'Main content or description'
        }
      );
    }

    return fields;
  }

  /**
   * Infer domain from query and URL
   */
  inferDomainFromQuery(query, url = '') {
    if (url.includes('news') || query.includes('article') || query.includes('news')) return 'news';
    if (url.includes('shop') || query.includes('product') || query.includes('price')) return 'commerce';
    if (url.includes('event') || query.includes('event') || query.includes('calendar')) return 'events';
    if (url.includes('edu') || query.includes('department') || query.includes('faculty')) return 'academic';
    if (query.includes('team') || query.includes('people') || query.includes('staff')) return 'people';
    
    return 'general';
  }

  /**
   * Calculate confidence for generated contract
   */
  calculateContractConfidence(query, fields) {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence for specific field matches
    const requiredFields = fields.filter(f => f.priority === 'required').length;
    confidence += Math.min(requiredFields * 0.1, 0.3);
    
    // Increase confidence for clear intent signals
    if (query.includes('extract') || query.includes('get') || query.includes('list')) {
      confidence += 0.1;
    }
    
    // Domain-specific confidence boost
    if (this.inferDomainFromQuery(query) !== 'general') {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 0.9); // Cap at 90%
  }

  /**
   * Run deterministic extraction (DOM-based)
   */
  runDeterministicExtraction(htmlContent, contract) {
    const fields = {};
    let totalConfidence = 0;
    let fieldsFound = 0;

    // Simple deterministic extraction using text patterns
    contract.fields.forEach(field => {
      const result = this.extractFieldDeterministically(field, htmlContent);
      if (result.found) {
        fields[field.name] = result.value;
        totalConfidence += result.confidence;
        fieldsFound++;
      }
    });

    return {
      type: 'deterministic',
      confidence: fieldsFound > 0 ? totalConfidence / fieldsFound : 0,
      fields: fields,
      fieldsFound: fieldsFound,
      metadata: {
        extractionMethod: 'dom_text_analysis',
        processingTime: 50 // Approximate
      }
    };
  }

  /**
   * Extract single field using deterministic methods
   */
  extractFieldDeterministically(field, htmlContent) {
    const hints = field.extractionHints;
    if (!hints?.keywords?.length) {
      return { found: false, value: null, confidence: 0 };
    }

    // Special handling for departments/lists
    if (field.name === 'departments' || field.type === 'array') {
      return this.extractListData(htmlContent, hints.keywords);
    }

    // Pattern-based extraction for text fields
    for (const keyword of hints.keywords) {
      const patterns = [
        new RegExp(`<[^>]*>${keyword}[:\\s]*([^<\n]+)<`, 'i'),
        new RegExp(`${keyword}[:\\s]*([^<\n]+)`, 'i'),
        new RegExp(`<h[1-6][^>]*>([^<]*${keyword}[^<]*)</h`, 'i')
      ];

      for (const pattern of patterns) {
        const match = htmlContent.match(pattern);
        if (match && match[1].trim()) {
          return {
            found: true,
            value: match[1].trim(),
            confidence: 0.7
          };
        }
      }
    }

    return { found: false, value: null, confidence: 0 };
  }

  /**
   * Extract list data (for departments, categories, etc.)
   */
  extractListData(htmlContent, keywords) {
    const listItems = [];
    
    // Look for list structures
    const listPatterns = [
      /<li[^>]*>([^<]+)</gi,
      /<option[^>]*>([^<]+)</gi,
      /<a[^>]*href[^>]*>([^<]+)</gi
    ];

    for (const pattern of listPatterns) {
      let match;
      while ((match = pattern.exec(htmlContent)) !== null) {
        const item = match[1].trim();
        if (item.length > 2 && keywords.some(keyword => 
          item.toLowerCase().includes(keyword.toLowerCase()) ||
          htmlContent.substring(match.index - 100, match.index + 100).toLowerCase().includes(keyword.toLowerCase())
        )) {
          listItems.push(item);
        }
      }
    }

    // Look for comma-separated lists in text
    const textPattern = new RegExp(`((?:[A-Z][^,]{2,}(?:,\\s*)){2,}[A-Z][^,]{2,})`, 'g');
    let textMatch;
    while ((textMatch = textPattern.exec(htmlContent)) !== null) {
      const items = textMatch[1].split(',').map(item => item.trim());
      if (items.length > 2) {
        listItems.push(...items);
      }
    }

    if (listItems.length > 0) {
      return {
        found: true,
        value: [...new Set(listItems)], // Remove duplicates
        confidence: 0.8
      };
    }

    return { found: false, value: null, confidence: 0 };
  }

  /**
   * Enhance parameters with contract insights
   */
  enhanceParamsWithContract(originalParams, contract, deterministicResult) {
    const requiredFields = contract.fields.filter(f => f.priority === 'required').map(f => f.name);
    const expectedFields = contract.fields.filter(f => f.priority === 'expected').map(f => f.name);
    const discoverableFields = contract.fields.filter(f => f.priority === 'discoverable').map(f => f.name);

    // Enhanced extraction instructions
    const enhancedInstructions = `${originalParams.extractionInstructions}

[EVIDENCE-FIRST CONTRACT GUIDANCE]
Contract: ${contract.name}
Domain: ${contract.domain}

REQUIRED FIELDS (must extract): ${requiredFields.join(', ')}
EXPECTED FIELDS (should extract if available): ${expectedFields.join(', ')}
DISCOVERABLE FIELDS (extract if found): ${discoverableFields.join(', ')}

DETERMINISTIC FINDINGS:
${Object.keys(deterministicResult.fields).length > 0 ? 
  Object.entries(deterministicResult.fields).map(([key, value]) => 
    `- ${key}: ${Array.isArray(value) ? `[${value.length} items]` : value.toString().substring(0, 50)}`
  ).join('\n') :
  '- No deterministic findings'
}

EXTRACTION STRATEGY:
1. Focus on evidence-based extraction - only extract fields with clear evidence
2. For list fields, look for structured data (ul/ol, nav menus, category lists)
3. Prioritize content that matches the user's specific request
4. Avoid hallucination - abstain if no clear evidence exists`;

    // Enhanced output schema
    const outputSchema = {
      type: 'object',
      properties: {},
      required: requiredFields
    };

    contract.fields.forEach(field => {
      outputSchema.properties[field.name] = {
        type: field.type === 'text' ? 'string' : field.type,
        description: field.description
      };

      if (field.type === 'array') {
        outputSchema.properties[field.name] = {
          type: 'array',
          items: { type: 'string' },
          description: field.description
        };
      }
    });

    return {
      ...originalParams,
      extractionInstructions: enhancedInstructions,
      outputSchema: outputSchema,
      evidenceContext: {
        contract: contract,
        deterministicFindings: deterministicResult.fields,
        highConfidenceFields: Object.keys(deterministicResult.fields)
      }
    };
  }

  /**
   * Negotiate schema and compile final results
   */
  negotiateAndCompileResults(contract, deterministicResult, planResult) {
    const planData = planResult.data || {};
    const deterministicData = deterministicResult.fields || {};

    // Merge results with evidence-first priority
    const finalData = { ...planData };

    // Override with high-confidence deterministic findings
    Object.entries(deterministicData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        finalData[key] = value;
      }
    });

    // Add metadata about evidence-first processing
    finalData._evidence = {
      contractId: contract.id,
      deterministicFields: Object.keys(deterministicData),
      planFields: Object.keys(planData),
      mergedFields: Object.keys(finalData).filter(k => !k.startsWith('_')),
      confidence: Math.max(deterministicResult.confidence, planResult.metadata?.confidence || 0.8)
    };

    return {
      success: Object.keys(finalData).filter(k => !k.startsWith('_')).length > 0,
      data: finalData,
      confidence: finalData._evidence.confidence
    };
  }

  /**
   * Initialize core templates (simplified version)
   */
  initializeCoreTemplates() {
    return [
      {
        name: 'People Directory',
        domain: 'people',
        keywords: ['team', 'staff', 'employee', 'member', 'person', 'profile']
      },
      {
        name: 'Product Catalog',
        domain: 'commerce',
        keywords: ['product', 'item', 'buy', 'price', 'shop', 'store']
      },
      {
        name: 'News Articles',
        domain: 'news',
        keywords: ['article', 'news', 'story', 'headline', 'report']
      },
      {
        name: 'Event Listings',
        domain: 'events',
        keywords: ['event', 'calendar', 'schedule', 'date', 'time']
      },
      {
        name: 'Academic Departments',
        domain: 'academic',
        keywords: ['department', 'faculty', 'research', 'academic', 'school']
      }
    ];
  }
}

// Create global instance
const evidenceFirstProcessor = new EvidenceFirstProcessor();

/**
 * Enhanced processing function that replaces direct processWithPlanBasedSystem calls
 */
async function processWithEvidenceFirstSystem(htmlContent, params) {
  return await evidenceFirstProcessor.processWithEvidenceFirst(htmlContent, params);
}

module.exports = {
  processWithEvidenceFirstSystem,
  EvidenceFirstProcessor
};