/**
 * Evidence-First Adaptive Extraction System Types
 * Core type definitions for the Evidence-First system based on the plan
 */

// Re-export the main types that are already defined in other files
export type {
  FieldSpec,
  SchemaContract,
  FieldKind,
  FieldType,
  DOMEvidence,
  DetectionResult,
  ValidationResult,
  ContractGenerationOptions
} from '../schema-contracts';

export type {
  DisplaySpec,
  DataCharacteristics,
  EntityTypeClassification
} from '../adaptive-display';

export type {
  ProcessingOptions,
  ExtractionContext,
  DOMAnalysisResult
} from '../evidence-first-processor';

// Additional types specific to the Evidence-First system
export interface EvidenceTrack {
  type: 'deterministic' | 'llm_augmented';
  confidence: number;
  source: string;
  fields: Record<string, any>;
  metadata: {
    extractionMethod: string;
    processingTime: number;
    fieldsFound?: number;
    fieldsRequested?: number;
    errors?: string[];
    modelUsed?: string;
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

export interface ContractGenerationContext {
  userQuery: string;
  url: string;
  contentSample: string;
  existingTemplates?: SchemaContract[];
}

// Contract v0.2 Schema definitions
export interface ContractV02Schema {
  contract_id: string;
  contract_version?: string;
  mode: "strict" | "soft";
  output_schema: {
    type: "array";
    minItems?: number;
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

// Processing result types
export interface EvidenceFirstResult {
  success: boolean;
  data: any[];
  contract?: ContractV02Schema;
  adaptiveDisplay?: DisplaySpec;
  metadata: {
    processingMethod: string;
    schemaContract?: {
      entity: string;
      negotiation?: any;
      evidence?: any;
    };
    evidenceFirst?: boolean;
    displayGenerated?: boolean;
    processingTime?: number;
    error?: string;
  };
}

// Anchor and DOM handling types
export interface AnchorReference {
  anchor_id: string;
  selector: string;
  text_content: string;
  dom_path: string;
  confidence: number;
}

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