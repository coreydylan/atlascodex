/**
 * Core TypeScript Types for Evidence-First Adaptive Extraction System
 * Based on EVIDENCE_FIRST_ADAPTIVE_EXTRACTION_PLAN_2025_09_03.md
 */

// Core Field Specification Types
export type FieldKind = "required" | "expected" | "discoverable";
export type FieldType = "string" | "email" | "url" | "enum" | "richtext" | "array" | "number" | "date" | "image" | "phone";

export interface FieldSpec {
  name: string;
  kind: FieldKind;
  type: FieldType;
  detector: Detector;
  extractor: Extractor;
  validators: Validator[];
  min_support?: number;
}

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

// DOM Evidence Types
export interface DOMEvidence {
  selector: string;
  textContent?: string;
  dom_path: string;
  node_id?: string;
  confidence?: number;
}

// Deterministic Extraction Results
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
  }>;
  support_map: Record<string, number>;
}

// LLM Augmentation Types
export interface LLMAugmentationResult {
  field_completions: Array<{
    field: string;
    value: any;
    evidence: DOMEvidence;
  }>;
  new_field_proposals: Array<{
    name: string;
    type: string;
    support: number;
    evidence: DOMEvidence[];
    confidence: number;
  }>;
  normalizations: Array<{
    original_field: string;
    normalized_name: string;
    reasoning: string;
  }>;
}

// Schema Negotiation Results
export interface NegotiationResult {
  status: "success" | "error";
  final_schema: FieldSpec[];
  changes: {
    pruned: Array<{
      field: string;
      reason: string;
      support: number;
    }>;
    added: Array<{
      field: string;
      support: number;
      source: "discovery" | "completion";
    }>;
    demoted: Array<{
      field: string;
      from: string;
      to: string;
      support: number;
    }>;
  };
  evidence_summary: {
    total_support: number;
    field_coverage: Record<string, number>;
    reliability_score: number;
  };
  reason?: string;
}

// Abstract Interfaces
export interface Detector {
  detect(dom: Document): Promise<Array<{
    element: Element;
    selector: string;
    confidence: number;
  }>>;
  getSelectors(): string[];
}

export interface Extractor {
  extract(element: Element): Promise<any>;
}

export interface Validator {
  validate(value: any): { valid: boolean; reason?: string };
}

// Contract Generation Types
export interface ContractGenerationOptions {
  response_format?: {
    type: "json_schema";
    json_schema: any;
  };
  max_tokens?: number;
  abstain_on_insufficient_evidence?: boolean;
}

export interface ContractV02Schema {
  contract_id: string;
  mode: "strict" | "soft";
  output_schema: {
    type: "array";
    items: {
      type: "object";
      properties: Record<string, any>;
      required: string[];
      additionalProperties: false;
      unevaluatedProperties: false;
    };
  };
  evidence_policy: {
    require_anchors: boolean;
    min_anchors_per_field: number;
  };
  missing_policy: {
    required: "drop_entity" | "fail_job";
    expected: "omit_field" | "null_field";
  };
}

// Evidence Types
export interface Evidence {
  anchor_id: string;
  selector: string;
  text_content: string;
  dom_path: string;
  confidence: number;
}

// Display Specification Types
export interface DisplaySpec {
  displayType: string;
  priorityFields: string[];
  secondaryFields: string[];
  layout: {
    type: string;
    spacing: string;
  };
  styling: {
    emphasize_custom_fields?: boolean;
  };
  reasoning: string;
}

// Processing Result Types
export interface ProcessingResult {
  success: boolean;
  data: any[];
  contract?: ContractV02Schema;
  metadata: {
    processingMethod: string;
    schemaContract?: {
      entity: string;
      negotiation: NegotiationResult['changes'];
      evidence: NegotiationResult['evidence_summary'];
    };
    evidenceFirst?: boolean;
    adaptiveDisplay?: DisplaySpec;
  };
}