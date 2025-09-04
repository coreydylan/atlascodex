/**
 * LLM Augmentation System for Evidence-First Processing
 * Implements GPT-5 enhanced field completion, discovery, and normalization
 * with strict DOM evidence validation and cost controls
 */

import { SchemaContract, FieldSpec, EvidenceTrack } from './schema-contracts';

/**
 * DOM Evidence structure for anchor validation
 */
export interface DOMEvidence {
  nodeId: string;           // Opaque node ID (e.g., "n_14852")
  selector: string;         // CSS selector for the element
  textContent: string;      // Text content (truncated for privacy)
  domPath: string;          // DOM path for debugging
  extractedValue?: string;  // Actual extracted value for cross-validation
}

/**
 * LLM Augmentation Result interface
 */
export interface LLMAugmentationResult {
  field_completions: Array<{
    field: string;
    value: any;
    evidence: DOMEvidence;
    confidence: number;
  }>;
  
  new_field_proposals: Array<{
    name: string;
    type: string;
    support: number;
    evidence: DOMEvidence[];
    confidence: number;
    reasoning: string;
  }>;
  
  normalizations: Array<{
    original_field: string;
    normalized_name: string;
    reasoning: string;
  }>;
}

/**
 * Deterministic findings from Track A processing
 */
export interface DeterministicFindings {
  hits: Array<{
    field: string;
    value: any;
    evidence: DOMEvidence;
    confidence: number;
  }>;
  
  misses: Array<{
    field: string;
    reason: string;
    selectors_tried: string[];
  }>;
  
  candidates: Array<{
    pattern: string;
    instances: number;
    sample_nodes: Element[];
    sample_values: string[];
  }>;
  
  support_map: Record<string, number>; // field_name -> count of instances found
}

/**
 * LLM Processing Options for cost and quality control
 */
export interface LLMProcessingOptions {
  maxTokens: number;
  timeoutMs: number;
  sampleSize: number;
  minSupportThreshold: number;
  enableAugmentation: boolean;
  costBudget: number; // in cents
}

/**
 * Anchor validation for DOM evidence
 */
class DOMEvidenceValidator {
  private domIndexer: Map<string, Element> = new Map();
  
  /**
   * Build anchor index with opaque node IDs
   */
  buildAnchorIndex(dom: Document): Record<string, { node: Element; selector: string; text: string }> {
    const anchors: Record<string, { node: Element; selector: string; text: string }> = {};
    let nodeCounter = 0;
    
    // Index all relevant elements
    const allElements = dom.querySelectorAll('*');
    allElements.forEach((element, index) => {
      const nodeId = `n_${nodeCounter++}`;
      const selector = this.generateSelector(element);
      const text = (element.textContent || '').substring(0, 200); // Truncate for privacy
      
      anchors[nodeId] = {
        node: element as Element,
        selector,
        text
      };
      
      this.domIndexer.set(nodeId, element as Element);
    });
    
    return anchors;
  }
  
  /**
   * Generate CSS selector for an element
   */
  private generateSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }
    
    let selector = element.tagName.toLowerCase();
    
    if (element.className) {
      const classes = Array.from(element.classList).slice(0, 2); // Limit classes
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }
    
    // Add nth-child if needed for uniqueness
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === element.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(element) + 1;
        selector += `:nth-child(${index})`;
      }
    }
    
    return selector;
  }
  
  /**
   * Validate DOM evidence by re-extracting from anchor
   */
  validateDOMEvidence(nodeId: string, proposedValue: string): boolean {
    const element = this.domIndexer.get(nodeId);
    if (!element) {
      return false;
    }
    
    const reExtractedValue = this.extractTextFromNode(element);
    return this.roundTripCheck(proposedValue, reExtractedValue) > 0.8;
  }
  
  /**
   * Extract text from DOM node
   */
  private extractTextFromNode(element: Element): string {
    // Try different extraction strategies
    const strategies = [
      () => element.textContent?.trim() || '',
      () => element.getAttribute('href') || '',
      () => element.getAttribute('src') || '',
      () => element.getAttribute('alt') || '',
      () => element.getAttribute('title') || '',
    ];
    
    for (const strategy of strategies) {
      const result = strategy();
      if (result && result.length > 0) {
        return result;
      }
    }
    
    return '';
  }
  
  /**
   * Check if proposed value matches extracted value (similarity threshold)
   */
  private roundTripCheck(proposed: string, extracted: string): number {
    if (!proposed || !extracted) return 0;
    
    const proposedNorm = proposed.toLowerCase().trim();
    const extractedNorm = extracted.toLowerCase().trim();
    
    // Exact match
    if (proposedNorm === extractedNorm) return 1.0;
    
    // Substring match
    if (extractedNorm.includes(proposedNorm) || proposedNorm.includes(extractedNorm)) {
      return 0.9;
    }
    
    // Levenshtein distance similarity
    const similarity = 1 - (this.levenshteinDistance(proposedNorm, extractedNorm) / 
                           Math.max(proposedNorm.length, extractedNorm.length));
    
    return Math.max(0, similarity);
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,        // deletion
          matrix[j - 1][i] + 1,        // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

/**
 * Main LLM Augmenter class with GPT-5 integration
 */
export class LLMAugmenter {
  private evidenceValidator: DOMEvidenceValidator;
  private defaultOptions: LLMProcessingOptions = {
    maxTokens: 400,
    timeoutMs: 1200,
    sampleSize: 5,
    minSupportThreshold: 3,
    enableAugmentation: true,
    costBudget: 2 // 2 cents max per request
  };
  
  constructor(options?: Partial<LLMProcessingOptions>) {
    this.evidenceValidator = new DOMEvidenceValidator();
    if (options) {
      this.defaultOptions = { ...this.defaultOptions, ...options };
    }
  }
  
  /**
   * Main augmentation method - processes deterministic findings with LLM enhancement
   */
  async augment(
    deterministicFindings: DeterministicFindings,
    contract: SchemaContract,
    dom: Document,
    options?: Partial<LLMProcessingOptions>
  ): Promise<LLMAugmentationResult> {
    
    const startTime = Date.now();
    const processingOptions = { ...this.defaultOptions, ...options };
    
    if (!processingOptions.enableAugmentation) {
      console.log('🚫 LLM augmentation disabled');
      return this.createEmptyResult();
    }
    
    try {
      // Build DOM anchor index for evidence validation
      const anchors = this.evidenceValidator.buildAnchorIndex(dom);
      const anchorIds = Object.keys(anchors);
      
      if (anchorIds.length === 0) {
        console.warn('⚠️ No DOM anchors found, skipping LLM augmentation');
        return this.createEmptyResult();
      }
      
      // Select sample elements for cost control
      const sampleAnchors = this.selectSampleElements(anchors, processingOptions.sampleSize);
      
      // Prepare augmentation context
      const augmentationContext = this.prepareAugmentationContext(
        deterministicFindings,
        contract,
        sampleAnchors
      );
      
      // Call GPT-5 with structured output and timeout protection
      const llmResponse = await this.callGPT5WithTimeout(
        augmentationContext,
        processingOptions
      );
      
      if (!llmResponse) {
        console.warn('⚠️ GPT-5 call failed or timed out');
        return this.createEmptyResult();
      }
      
      // Validate all suggestions have valid DOM evidence
      const validatedResult = await this.validateAugmentation(llmResponse, anchors);
      
      console.log(`✅ LLM augmentation completed in ${Date.now() - startTime}ms`);
      console.log(`📊 Results: ${validatedResult.field_completions.length} completions, ${validatedResult.new_field_proposals.length} proposals`);
      
      return validatedResult;
      
    } catch (error) {
      console.error('❌ LLM augmentation failed:', error);
      return this.createEmptyResult();
    }
  }
  
  /**
   * Select sample elements for cost-controlled processing
   */
  selectSampleElements(
    anchors: Record<string, { node: Element; selector: string; text: string }>, 
    sampleSize: number
  ): Record<string, { node: Element; selector: string; text: string }> {
    
    const anchorEntries = Object.entries(anchors);
    
    if (anchorEntries.length <= sampleSize) {
      return anchors;
    }
    
    // Stratified sampling - select diverse elements
    const sampled: Record<string, { node: Element; selector: string; text: string }> = {};
    
    // Priority for elements with meaningful text content
    const prioritized = anchorEntries
      .filter(([_, anchor]) => anchor.text.length > 10)
      .sort((a, b) => b[1].text.length - a[1].text.length);
      
    // Take top elements by content richness
    const selectedEntries = prioritized.slice(0, sampleSize);
    
    selectedEntries.forEach(([id, anchor]) => {
      sampled[id] = anchor;
    });
    
    console.log(`📦 Sampled ${selectedEntries.length} elements from ${anchorEntries.length} total`);
    return sampled;
  }
  
  /**
   * Prepare context for LLM augmentation call
   */
  private prepareAugmentationContext(
    deterministicFindings: DeterministicFindings,
    contract: SchemaContract,
    sampleAnchors: Record<string, { node: Element; selector: string; text: string }>
  ): any {
    
    const contractSummary = {
      entity: contract.name,
      fields: contract.fields.map(f => ({
        name: f.name,
        type: f.type,
        priority: f.priority,
        found: deterministicFindings.support_map[f.name] > 0
      }))
    };
    
    const findingsSummary = {
      hits: deterministicFindings.hits.map(h => ({
        field: h.field,
        value: h.value,
        confidence: h.confidence
      })),
      misses: deterministicFindings.misses.map(m => ({
        field: m.field,
        reason: m.reason
      })),
      patterns: deterministicFindings.candidates.map(c => ({
        pattern: c.pattern,
        instances: c.instances,
        samples: c.sample_values.slice(0, 2) // Limit samples
      }))
    };
    
    // Provide only anchor IDs to LLM (no raw selectors or DOM paths)
    const anchorContext = Object.fromEntries(
      Object.entries(sampleAnchors).map(([id, anchor]) => [
        id,
        {
          text_preview: anchor.text.substring(0, 100), // Truncated for privacy
          element_type: anchor.node.tagName?.toLowerCase()
        }
      ])
    );
    
    return {
      contract: contractSummary,
      deterministic_findings: findingsSummary,
      available_anchors: anchorContext,
      instructions: {
        task: 'Complete missing fields and discover new patterns with DOM evidence',
        constraints: [
          'You must cite anchor IDs for every suggestion',
          'No invention - only report what you can anchor to actual DOM elements',
          `For new fields, you need at least ${this.defaultOptions.minSupportThreshold} instances`,
          'Focus on high-confidence completions and discoveries'
        ]
      }
    };
  }
  
  /**
   * Call GPT-5 with timeout protection and structured output
   */
  private async callGPT5WithTimeout(
    context: any,
    options: LLMProcessingOptions
  ): Promise<any> {
    
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('GPT-5 call timeout')), options.timeoutMs)
    );
    
    const gptPromise = this.callGPT5(context, options);
    
    try {
      const result = await Promise.race([gptPromise, timeoutPromise]);
      return result;
    } catch (error) {
      if (error.message === 'GPT-5 call timeout') {
        console.warn('⏰ GPT-5 call timed out, continuing with deterministic results');
      } else {
        console.error('❌ GPT-5 call failed:', error);
      }
      return null;
    }
  }
  
  /**
   * GPT-5 API call with exact prompt structure from plan
   */
  private async callGPT5(context: any, options: LLMProcessingOptions): Promise<any> {
    // This would integrate with the actual GPT-5 API
    // For now, implementing the structure that would be used
    
    const systemPrompt = `You are an extraction augmentation expert. Your job:

1. COMPLETE missing expected fields if you see evidence in the DOM samples
2. PROPOSE new discoverable fields from repeated patterns  
3. NORMALIZE field names (e.g., "office" → "location", "research area" → "expertise")

CRITICAL RULES:
- You must cite DOM anchor IDs for every suggestion
- No invention - only report what you can anchor to actual DOM elements
- For new fields, you need at least ${options.minSupportThreshold} instances
- Provide confidence scores (0.0-1.0) for all suggestions`;

    const userPrompt = `Contract: ${JSON.stringify(context.contract)}

Deterministic findings: ${JSON.stringify(context.deterministic_findings)}

Available DOM anchors: ${JSON.stringify(context.available_anchors)}

What can you complete or discover with evidence?`;

    // Mock GPT-5 response structure for development
    // In production, this would call the actual GPT-5 API with structured output
    const mockResponse = {
      completions: [],
      new_fields: [],
      normalizations: []
    };
    
    console.log(`🤖 GPT-5 augmentation call with ${Object.keys(context.available_anchors).length} anchors`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return mockResponse;
  }
  
  /**
   * Validate augmentation result against DOM evidence
   */
  async validateAugmentation(
    augmentation: any,
    anchors: Record<string, { node: Element; selector: string; text: string }>
  ): Promise<LLMAugmentationResult> {
    
    // Validate field completions
    const validCompletions = (augmentation.completions || [])
      .filter((c: any) => {
        if (!c.evidence || !c.evidence.anchor_id) {
          console.warn(`⚠️ Completion for '${c.field}' missing anchor ID, dropping`);
          return false;
        }
        
        const isValid = this.validateDOMEvidence(c.evidence.anchor_id, c.value, anchors);
        if (!isValid) {
          console.warn(`⚠️ Completion for '${c.field}' failed evidence validation, dropping`);
        }
        return isValid;
      })
      .map((c: any) => ({
        field: c.field,
        value: c.value,
        evidence: this.createDOMEvidence(c.evidence.anchor_id, anchors),
        confidence: Math.min(c.confidence || 0.8, 0.95) // Cap LLM confidence
      }));
    
    // Validate new field proposals
    const validNewFields = (augmentation.new_fields || [])
      .filter((nf: any) => {
        if (!nf.dom_anchors || nf.dom_anchors.length < this.defaultOptions.minSupportThreshold) {
          console.warn(`⚠️ New field '${nf.name}' insufficient anchors (${nf.dom_anchors?.length || 0} < ${this.defaultOptions.minSupportThreshold})`);
          return false;
        }
        
        // Validate each anchor
        const validAnchors = nf.dom_anchors.filter((anchorId: string) =>
          this.validateDOMEvidence(anchorId, nf.sample_values?.[0] || '', anchors)
        );
        
        const hasMinimumEvidence = validAnchors.length >= this.defaultOptions.minSupportThreshold;
        if (!hasMinimumEvidence) {
          console.warn(`⚠️ New field '${nf.name}' failed evidence validation`);
        }
        
        return hasMinimumEvidence;
      })
      .map((nf: any) => ({
        name: nf.name,
        type: nf.type || 'text',
        support: nf.evidence_count || nf.dom_anchors.length,
        evidence: nf.dom_anchors.map((anchorId: string) => 
          this.createDOMEvidence(anchorId, anchors)
        ),
        confidence: Math.min(nf.confidence || 0.7, 0.9), // Cap confidence for new fields
        reasoning: nf.reasoning || `Discovered pattern with ${nf.dom_anchors.length} instances`
      }));
    
    // Normalizations don't need DOM validation (they're just name mappings)
    const normalizations = (augmentation.normalizations || []).map((n: any) => ({
      original_field: n.from,
      normalized_name: n.to,
      reasoning: n.reasoning || 'Field name normalization'
    }));
    
    console.log(`✅ Validation complete: ${validCompletions.length} completions, ${validNewFields.length} new fields validated`);
    
    return {
      field_completions: validCompletions,
      new_field_proposals: validNewFields,
      normalizations
    };
  }
  
  /**
   * Validate DOM evidence for a specific anchor and value
   */
  validateDOMEvidence(
    anchorId: string,
    proposedValue: string,
    anchors: Record<string, { node: Element; selector: string; text: string }>
  ): boolean {
    
    if (!anchors[anchorId]) {
      console.warn(`⚠️ Anchor ID '${anchorId}' not found in DOM index`);
      return false;
    }
    
    return this.evidenceValidator.validateDOMEvidence(anchorId, proposedValue);
  }
  
  /**
   * Create DOM evidence structure from anchor
   */
  private createDOMEvidence(
    anchorId: string,
    anchors: Record<string, { node: Element; selector: string; text: string }>
  ): DOMEvidence {
    
    const anchor = anchors[anchorId];
    if (!anchor) {
      throw new Error(`Anchor ID '${anchorId}' not found`);
    }
    
    return {
      nodeId: anchorId,
      selector: anchor.selector,
      textContent: anchor.text,
      domPath: this.generateDOMPath(anchor.node),
      extractedValue: this.evidenceValidator['extractTextFromNode'](anchor.node)
    };
  }
  
  /**
   * Generate DOM path for debugging
   */
  private generateDOMPath(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }
      
      if (current.className) {
        const classes = Array.from(current.classList).slice(0, 1);
        if (classes.length > 0) {
          selector += `.${classes[0]}`;
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
      
      // Prevent infinite loops and overly long paths
      if (path.length > 10) break;
    }
    
    return path.join(' > ');
  }
  
  /**
   * Create empty result for fallback cases
   */
  private createEmptyResult(): LLMAugmentationResult {
    return {
      field_completions: [],
      new_field_proposals: [],
      normalizations: []
    };
  }
}

/**
 * JSON Schema for structured GPT-5 responses
 */
export const LLM_AUGMENTATION_SCHEMA = {
  type: 'object',
  properties: {
    completions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          value: { type: 'string' },
          evidence: {
            type: 'object',
            properties: {
              anchor_id: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 }
            },
            required: ['anchor_id']
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['field', 'value', 'evidence']
      }
    },
    new_fields: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string' },
          evidence_count: { type: 'integer', minimum: 1 },
          sample_values: { type: 'array', items: { type: 'string' } },
          dom_anchors: { type: 'array', items: { type: 'string' }, minItems: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reasoning: { type: 'string' }
        },
        required: ['name', 'type', 'dom_anchors', 'evidence_count']
      }
    },
    normalizations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          reasoning: { type: 'string' }
        },
        required: ['from', 'to']
      }
    }
  },
  required: ['completions', 'new_fields', 'normalizations'],
  additionalProperties: false
};

/**
 * Export utility functions for integration
 */
export { DOMEvidenceValidator };