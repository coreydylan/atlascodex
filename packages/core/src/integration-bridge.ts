/**
 * Evidence-First Integration Bridge
 * Connects the TypeScript Evidence-First system with the existing CommonJS API
 */

import { JSDOM } from 'jsdom';
import { EvidenceFirstProcessor } from './evidence-first-processor';
import { generateSchemaContract } from './schema-contracts';
import { EvidenceFirstResult, ContractV02Schema } from './types/evidence-first';
import { AdaptiveDisplayGenerator, DisplaySpec } from './adaptive-display';

export interface IntegrationOptions {
  useEvidenceFirst?: boolean;
  maxProcessingTime?: number;
  enableLLMTrack?: boolean;
  fallbackStrategy?: 'abstain' | 'partial' | 'template_default';
}

export interface LegacyProcessingParams {
  extractionInstructions: string;
  url?: string;
  outputSchema?: any;
  useEvidenceFirst?: boolean;
}

/**
 * Main integration class that bridges TypeScript Evidence-First system
 * with the existing CommonJS worker system
 */
export class EvidenceFirstIntegrationBridge {
  private processor: EvidenceFirstProcessor;
  private displayGenerator: AdaptiveDisplayGenerator;

  constructor() {
    this.processor = new EvidenceFirstProcessor();
    this.displayGenerator = new AdaptiveDisplayGenerator();
  }

  /**
   * Process content using Evidence-First system
   * Compatible with existing API structure
   */
  async processWithEvidenceFirst(
    htmlContent: string,
    params: LegacyProcessingParams,
    options: IntegrationOptions = {}
  ): Promise<EvidenceFirstResult> {
    const startTime = Date.now();

    try {
      // Parse HTML content using JSDOM
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;

      // Phase 1: Generate Schema Contract
      console.log('🔬 Bridge: Generating Schema Contract');
      const contract = await generateSchemaContract(
        params.extractionInstructions,
        htmlContent
      );

      // Phase 2: Process with Evidence-First system
      console.log('🔍 Bridge: Processing with Evidence-First system');
      const processingContext = {
        url: params.url || '',
        html: htmlContent,
        userQuery: params.extractionInstructions,
        options: {
          enableLLMTrack: options.enableLLMTrack !== false,
          maxProcessingTime: options.maxProcessingTime || 10000,
          confidenceThreshold: 0.6,
          fallbackStrategy: options.fallbackStrategy || 'partial'
        }
      };

      const evidence = await this.processor.processExtraction(processingContext);

      // Phase 3: Convert to legacy-compatible format
      const legacyResult = this.convertToLegacyFormat(evidence, contract, params);

      console.log('✅ Bridge: Evidence-First processing complete', {
        processingTime: Date.now() - startTime,
        fieldsFound: Object.keys(evidence.finalData).length,
        confidence: evidence.negotiatedSchema.metadata?.confidence || 0
      });

      // Phase 4: Generate Adaptive Display from Final Schema
      const formattedData = this.formatOutputData(evidence.finalData, contract.entity);
      let adaptiveDisplay: DisplaySpec | null = null;
      
      if (formattedData.length > 0 && evidence.negotiatedSchema.fields) {
        try {
          console.log('🎨 Bridge: Generating adaptive display specification');
          adaptiveDisplay = await this.displayGenerator.generateFromSchema(
            evidence.negotiatedSchema.fields,
            formattedData,
            params.extractionInstructions
          );
        } catch (displayError) {
          console.warn('⚠️ Bridge: Adaptive display generation failed:', displayError);
          // Continue without display spec - not critical for core extraction
        }
      }

      return {
        success: true,
        data: formattedData,
        contract: this.buildContractV02Schema(contract, evidence),
        adaptiveDisplay,
        metadata: {
          processingMethod: 'evidence_first_bridge',
          schemaContract: {
            entity: contract.entity,
            negotiation: evidence.negotiatedSchema.fields.length,
            evidence: evidence.deterministicTrack.confidence
          },
          evidenceFirst: true,
          processingTime: Date.now() - startTime,
          displayGenerated: adaptiveDisplay !== null
        }
      };

    } catch (error) {
      console.error('❌ Bridge: Evidence-First processing failed:', error);
      
      return {
        success: false,
        data: [],
        metadata: {
          processingMethod: 'evidence_first_bridge_failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Determine if Evidence-First processing should be used
   */
  shouldUseEvidenceFirst(params: LegacyProcessingParams): boolean {
    const query = (params.extractionInstructions || '').toLowerCase();

    // Use evidence-first for ambiguous or complex queries
    const ambiguousPatterns = [
      /\b(extract|get|find|list)\b.*\b(all|any|different|various)\b/i,
      /\b(names?|information|data|details)\b.*(?!person|people|staff|team|employee)/i,
      /\b(departments?|categories?|sections?|types?)\b/i,
      /(what|which|how many).*(?:are|is|on)/i,
      /just.*names?.*of.*different/i
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

    console.log(`Bridge: Query analysis - ambiguous=${isAmbiguous}, standardKeywords=${hasStandardKeywords}`);
    
    return isAmbiguous || !hasStandardKeywords;
  }

  /**
   * Format output data based on entity type
   */
  private formatOutputData(finalData: Record<string, any>, entityType: string): any[] {
    // If finalData is already an array, return it
    if (Array.isArray(finalData)) {
      return finalData;
    }

    // If it's a single object, wrap in array
    if (typeof finalData === 'object' && finalData !== null) {
      // Check if it contains array data under a key
      const arrayKey = Object.keys(finalData).find(key => Array.isArray(finalData[key]));
      if (arrayKey) {
        return finalData[arrayKey];
      }
      
      return [finalData];
    }

    // Fallback: empty array
    return [];
  }

  /**
   * Convert Evidence-First result to legacy format
   */
  private convertToLegacyFormat(evidence: any, contract: any, params: LegacyProcessingParams) {
    return {
      success: true,
      data: evidence.finalData,
      confidence: evidence.deterministicTrack.confidence,
      metadata: {
        processingMethod: 'evidence_first_typescript',
        schemaContract: {
          id: contract.id || 'generated',
          entity: contract.entity,
          fieldsCount: contract.fields.length
        },
        processingTime: evidence.metadata.totalProcessingTime
      }
    };
  }

  /**
   * Build Contract v0.2 schema from Evidence-First results
   */
  private buildContractV02Schema(contract: any, evidence: any): ContractV02Schema {
    const finalFields = evidence.negotiatedSchema.fields || contract.fields;
    const properties: Record<string, any> = {};
    const required: string[] = [];

    finalFields.forEach((field: any) => {
      properties[field.name] = {
        type: this.mapFieldTypeToJsonSchema(field.type),
        description: field.description || `${field.name} field`
      };
      
      if (field.kind === 'required') {
        required.push(field.name);
      }
    });

    return {
      contract_id: contract.id || `evidence_first_${Date.now()}`,
      contract_version: '0.2',
      mode: 'soft', // Default to soft mode for Evidence-First
      output_schema: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties,
          required: required.length > 0 ? required : ['name'], // Fallback to name
          additionalProperties: false,
          unevaluatedProperties: false
        }
      },
      evidence_policy: {
        require_anchors: true,
        min_anchors_per_field: 1
      },
      missing_policy: {
        required: 'drop_entity',
        expected: 'omit_field'
      }
    };
  }

  /**
   * Map Evidence-First field types to JSON Schema types
   */
  private mapFieldTypeToJsonSchema(fieldType: string): string {
    switch (fieldType) {
      case 'richtext':
      case 'email':
      case 'url':
      case 'phone':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'array';
      case 'date':
        return 'string'; // Date as ISO string
      default:
        return 'string';
    }
  }
}

// Export singleton instance for easy use
export const evidenceFirstBridge = new EvidenceFirstIntegrationBridge();

/**
 * Main processing function for compatibility with existing API
 */
export async function processWithEvidenceFirstBridge(
  htmlContent: string,
  params: LegacyProcessingParams,
  options: IntegrationOptions = {}
): Promise<EvidenceFirstResult> {
  return await evidenceFirstBridge.processWithEvidenceFirst(htmlContent, params, options);
}