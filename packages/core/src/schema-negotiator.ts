/**
 * Evidence-First Schema Negotiator
 * Core decision engine for intelligent field inclusion based on evidence
 */

// Core interfaces for negotiation results
export interface NegotiationResult {
  status: "success" | "error";
  final_schema: FieldSpec[];
  changes: {
    pruned: Array<{ field: string; reason: string; support: number }>;
    added: Array<{ field: string; support: number; source: "discovery" | "completion" }>;
    demoted: Array<{ field: string; from: string; to: string; support: number }>;
  };
  evidence_summary: {
    total_support: number;
    field_coverage: Record<string, number>;
    reliability_score: number;
  };
  reason?: string;
}

// Field specification with all necessary extraction metadata
export interface FieldSpec {
  name: string;
  kind: "required" | "expected" | "optional" | "discoverable";
  type: "string" | "email" | "url" | "enum" | "richtext" | "array" | "number" | "boolean";
  detector: Detector;
  extractor: Extractor;
  validators: Validator[];
  min_support?: number;
}

// Schema contract governing extraction behavior
export interface SchemaContract {
  entity: string;
  fields: FieldSpec[];
  governance: {
    allowNewFields: boolean;
    newFieldPolicy: "evidence_first" | "strict";
    min_support_threshold: number;
    max_discoverable_fields: number;
  };
}

// Deterministic findings from Track A processing
export interface DeterministicFindings {
  hits: Array<{ field: string; value: any; evidence: DOMEvidence; confidence: number }>;
  misses: Array<{ field: string; reason: string; selectors_tried: string[] }>;
  candidates: Array<{ pattern: string; instances: number; sample_nodes: Element[] }>;
  support_map: Record<string, number>; // field_name -> count of instances found
}

// LLM augmentation results from Track B processing
export interface LLMAugmentationResult {
  field_completions: Array<{ field: string; value: any; evidence: DOMEvidence }>;
  new_field_proposals: Array<{ 
    name: string; 
    type: string; 
    support: number; 
    evidence: DOMEvidence[]; 
    confidence: number;
    dom_anchors: string[];
  }>;
  normalizations: Array<{ original_field: string; normalized_name: string; reasoning: string }>;
}

// DOM evidence structure
export interface DOMEvidence {
  selector: string;
  textContent?: string;
  dom_path: string;
  confidence?: number;
}

// Base interfaces for detectors, extractors, and validators
export interface Detector {
  detect(dom: Document): Promise<Array<{ element: Element; selector: string; confidence: number }>>;
  getSelectors(): string[];
}

export interface Extractor {
  extract(element: Element): Promise<any>;
}

export interface Validator {
  validate(value: any): { valid: boolean; reason?: string };
}

// Generic implementations for discovered fields
export class GenericDetector implements Detector {
  constructor(private anchors: string[]) {}

  async detect(dom: Document): Promise<Array<{ element: Element; selector: string; confidence: number }>> {
    const results = [];
    
    for (const anchor of this.anchors) {
      try {
        const elements = dom.querySelectorAll(anchor);
        elements.forEach((element, index) => {
          results.push({
            element: element as Element,
            selector: anchor,
            confidence: 0.8 - (index * 0.1) // Diminishing confidence
          });
        });
      } catch (error) {
        console.warn(`Invalid selector: ${anchor}`, error);
      }
    }
    
    return results;
  }

  getSelectors(): string[] {
    return this.anchors;
  }
}

export class GenericExtractor implements Extractor {
  async extract(element: Element): Promise<any> {
    // Extract text content, cleaning whitespace
    const text = element.textContent?.trim() || '';
    
    // Check for href attribute for links
    if (element.hasAttribute('href')) {
      return element.getAttribute('href');
    }
    
    // Check for src attribute for images
    if (element.hasAttribute('src')) {
      return element.getAttribute('src');
    }
    
    // Return cleaned text content
    return text;
  }
}

// Validator implementations for different types
export class MinLengthValidator implements Validator {
  constructor(private minLength: number) {}

  validate(value: any): { valid: boolean; reason?: string } {
    if (typeof value !== 'string') {
      return { valid: false, reason: 'Value must be a string' };
    }
    
    if (value.length < this.minLength) {
      return { valid: false, reason: `Minimum length ${this.minLength} not met` };
    }
    
    return { valid: true };
  }
}

export class MaxLengthValidator implements Validator {
  constructor(private maxLength: number) {}

  validate(value: any): { valid: boolean; reason?: string } {
    if (typeof value !== 'string') {
      return { valid: false, reason: 'Value must be a string' };
    }
    
    if (value.length > this.maxLength) {
      return { valid: false, reason: `Maximum length ${this.maxLength} exceeded` };
    }
    
    return { valid: true };
  }
}

export class URLFormatValidator implements Validator {
  validate(value: any): { valid: boolean; reason?: string } {
    if (typeof value !== 'string') {
      return { valid: false, reason: 'URL must be a string' };
    }
    
    try {
      new URL(value);
      return { valid: true };
    } catch {
      // Check for relative URLs
      if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
        return { valid: true };
      }
      
      return { valid: false, reason: 'Invalid URL format' };
    }
  }
}

export class EmailFormatValidator implements Validator {
  validate(value: any): { valid: boolean; reason?: string } {
    if (typeof value !== 'string') {
      return { valid: false, reason: 'Email must be a string' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { valid: false, reason: 'Invalid email format' };
    }
    
    return { valid: true };
  }
}

export class NumericValidator implements Validator {
  validate(value: any): { valid: boolean; reason?: string } {
    const num = Number(value);
    if (isNaN(num)) {
      return { valid: false, reason: 'Value must be numeric' };
    }
    
    return { valid: true };
  }
}

/**
 * Evidence-First Schema Negotiator
 * 
 * The core decision engine that processes contracts and findings to produce
 * optimal schemas based on actual evidence from the page.
 */
export class EvidenceFirstNegotiator {
  
  /**
   * Negotiate final schema based on contract and evidence
   * 
   * This is the primary method that implements the evidence-first logic:
   * 1. Validates required fields have sufficient evidence
   * 2. Prunes expected fields with zero evidence
   * 3. Demotes weak fields based on support percentages
   * 4. Promotes discoverable fields meeting evidence thresholds
   */
  negotiate(
    contract: SchemaContract,
    deterministicFindings: DeterministicFindings,
    augmentationResult: LLMAugmentationResult
  ): NegotiationResult {
    
    const finalFields: FieldSpec[] = [];
    const changes = { pruned: [], added: [], demoted: [] };
    
    // 1. Process required fields - must exist or fail extraction
    for (const field of contract.fields.filter(f => f.kind === "required")) {
      const support = deterministicFindings.support_map[field.name] || 0;
      
      if (support === 0) {
        const missInfo = deterministicFindings.misses.find(m => m.field === field.name);
        return {
          status: "error",
          final_schema: [],
          changes,
          evidence_summary: { 
            total_support: 0, 
            field_coverage: {}, 
            reliability_score: 0 
          },
          reason: `Missing required field: ${field.name}. Selectors tried: ${
            missInfo?.selectors_tried.join(", ") || "none"
          }`
        };
      }
      
      finalFields.push(field);
    }

    // 2. Process expected fields - prune if zero evidence, demote if weak
    const baselineSupport = this.calculateBaselineSupport(deterministicFindings.support_map);
    
    for (const field of contract.fields.filter(f => f.kind === "expected")) {
      const support = deterministicFindings.support_map[field.name] || 0;
      const supportPercentage = baselineSupport > 0 ? support / baselineSupport : 0;
      
      // Prune fields with zero evidence
      if (support === 0) {
        changes.pruned.push({
          field: field.name,
          reason: "zero_evidence_found",
          support: 0
        });
        continue;
      }
      
      // Demote to optional if weak support (less than 30% of baseline)
      if (supportPercentage < 0.3) {
        const demotedField = { ...field, kind: "optional" as const };
        finalFields.push(demotedField);
        changes.demoted.push({
          field: field.name,
          from: "expected",
          to: "optional", 
          support: supportPercentage
        });
      } else {
        finalFields.push(field);
      }
    }

    // 3. Process field completions from LLM augmentation
    for (const completion of augmentationResult.field_completions) {
      // Find the field in expected fields that was missing
      const missedField = contract.fields.find(f => 
        f.name === completion.field && f.kind === "expected"
      );
      
      if (missedField && !finalFields.some(f => f.name === completion.field)) {
        // Add the field back as optional since it was completed by LLM
        const completedField = { ...missedField, kind: "optional" as const };
        finalFields.push(completedField);
        changes.added.push({
          field: completion.field,
          support: 1, // LLM completion counts as 1 support
          source: "completion"
        });
      }
    }

    // 4. Promote discoverable fields with sufficient evidence
    if (contract.governance.allowNewFields) {
      const promotedCount = changes.added.filter(a => a.source === "discovery").length;
      const remainingSlots = contract.governance.max_discoverable_fields - promotedCount;
      
      // Sort proposals by support descending
      const sortedProposals = [...augmentationResult.new_field_proposals]
        .sort((a, b) => b.support - a.support);
      
      for (const proposal of sortedProposals.slice(0, remainingSlots)) {
        if (proposal.support >= contract.governance.min_support_threshold) {
          const newField: FieldSpec = {
            name: proposal.name,
            kind: "expected",
            type: proposal.type as any,
            detector: new GenericDetector(proposal.dom_anchors),
            extractor: new GenericExtractor(),
            validators: this.getValidatorsForType(proposal.type),
            min_support: proposal.support
          };
          
          finalFields.push(newField);
          changes.added.push({
            field: proposal.name,
            support: proposal.support,
            source: "discovery"
          });
        }
      }
    }

    // 5. Apply field normalizations
    for (const normalization of augmentationResult.normalizations) {
      const fieldIndex = finalFields.findIndex(f => f.name === normalization.original_field);
      if (fieldIndex !== -1) {
        finalFields[fieldIndex] = {
          ...finalFields[fieldIndex],
          name: normalization.normalized_name
        };
        
        // Update changes tracking
        const changeIndex = changes.added.findIndex(c => c.field === normalization.original_field);
        if (changeIndex !== -1) {
          changes.added[changeIndex].field = normalization.normalized_name;
        }
      }
    }

    // 6. Calculate evidence summary for transparency
    const totalSupport = Object.values(deterministicFindings.support_map).reduce((a, b) => a + b, 0);
    const fieldCoverage = deterministicFindings.support_map;
    const reliabilityScore = this.calculateReliabilityScore(finalFields, deterministicFindings);

    return {
      status: "success",
      final_schema: finalFields,
      changes,
      evidence_summary: {
        total_support: totalSupport,
        field_coverage: fieldCoverage,
        reliability_score: reliabilityScore
      }
    };
  }

  /**
   * Get appropriate validators for a field type
   */
  private getValidatorsForType(type: string): Validator[] {
    const validators: Validator[] = [];
    
    switch (type.toLowerCase()) {
      case 'email':
        validators.push(new EmailFormatValidator());
        validators.push(new MinLengthValidator(5));
        validators.push(new MaxLengthValidator(100));
        break;
        
      case 'url':
        validators.push(new URLFormatValidator());
        validators.push(new MaxLengthValidator(500));
        break;
        
      case 'string':
        validators.push(new MinLengthValidator(1));
        validators.push(new MaxLengthValidator(1000));
        break;
        
      case 'richtext':
        validators.push(new MinLengthValidator(10));
        validators.push(new MaxLengthValidator(5000));
        break;
        
      case 'number':
        validators.push(new NumericValidator());
        break;
        
      default:
        // Basic validation for unknown types
        validators.push(new MinLengthValidator(1));
        validators.push(new MaxLengthValidator(1000));
        break;
    }
    
    return validators;
  }

  /**
   * Calculate baseline support for relative percentage calculations
   */
  private calculateBaselineSupport(supportMap: Record<string, number>): number {
    const supportValues = Object.values(supportMap).filter(v => v > 0);
    if (supportValues.length === 0) return 0;
    
    // Use the maximum support as baseline (most successful field)
    return Math.max(...supportValues);
  }

  /**
   * Calculate reliability score based on field support and evidence quality
   */
  private calculateReliabilityScore(
    finalFields: FieldSpec[], 
    deterministicFindings: DeterministicFindings
  ): number {
    if (finalFields.length === 0) return 0;
    
    let totalReliability = 0;
    let totalWeight = 0;
    
    for (const field of finalFields) {
      const support = deterministicFindings.support_map[field.name] || 0;
      const weight = this.getFieldWeight(field.kind);
      
      // Calculate field reliability (0-1)
      let fieldReliability = 0;
      if (support > 0) {
        // Base reliability from support count (normalized to 0-1)
        fieldReliability = Math.min(support / 10, 1.0);
        
        // Boost for required fields that have support
        if (field.kind === "required") {
          fieldReliability = Math.min(fieldReliability + 0.2, 1.0);
        }
      }
      
      totalReliability += fieldReliability * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? totalReliability / totalWeight : 0;
  }

  /**
   * Get weight for different field kinds in reliability calculation
   */
  private getFieldWeight(kind: FieldSpec['kind']): number {
    switch (kind) {
      case 'required': return 3.0;
      case 'expected': return 2.0;
      case 'optional': return 1.0;
      case 'discoverable': return 0.5;
      default: return 1.0;
    }
  }
}

/**
 * Helper function to create a basic schema contract for testing
 */
export function createBasicContract(
  entity: string,
  requiredFields: string[],
  expectedFields: string[] = [],
  governance: Partial<SchemaContract['governance']> = {}
): SchemaContract {
  const fields: FieldSpec[] = [];
  
  // Add required fields
  for (const fieldName of requiredFields) {
    fields.push({
      name: fieldName,
      kind: "required",
      type: "string",
      detector: new GenericDetector([`.${fieldName}`, `[data-${fieldName}]`, `#${fieldName}`]),
      extractor: new GenericExtractor(),
      validators: [new MinLengthValidator(1), new MaxLengthValidator(500)]
    });
  }
  
  // Add expected fields
  for (const fieldName of expectedFields) {
    fields.push({
      name: fieldName,
      kind: "expected",
      type: "string",
      detector: new GenericDetector([`.${fieldName}`, `[data-${fieldName}]`, `#${fieldName}`]),
      extractor: new GenericExtractor(),
      validators: [new MinLengthValidator(1), new MaxLengthValidator(500)]
    });
  }
  
  return {
    entity,
    fields,
    governance: {
      allowNewFields: true,
      newFieldPolicy: "evidence_first",
      min_support_threshold: 3,
      max_discoverable_fields: 5,
      ...governance
    }
  };
}

/**
 * Export utility for error handling
 */
export class SchemaNegotiationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SchemaNegotiationError';
  }
}