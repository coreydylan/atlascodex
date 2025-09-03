/**
 * Evidence-First Integration Layer
 * Bridges the evidence-first processor with existing plan-based system
 */

import { EvidenceFirstProcessor, ExtractionContext } from './evidence-first-processor';
import { SchemaContract } from './schema-contracts';

// Import existing templates/contracts
import { CORE_TEMPLATES } from './core-templates';

export interface EvidenceFirstExtractionParams {
  url: string;
  extractionInstructions: string;
  outputSchema?: any;
  device?: string;
  format?: string[];
  postProcessing?: string;
  useEvidenceFirst?: boolean;
}

export interface EvidenceFirstResult {
  success: boolean;
  data: any;
  metadata: {
    processingMethod: 'evidence_first' | 'plan_based_fallback';
    schemaContract: SchemaContract;
    deterministicTrackConfidence: number;
    llmTrackConfidence?: number;
    negotiatedFields: number;
    totalProcessingTime: number;
    evidenceFirst?: {
      contractGenerated: boolean;
      tracksExecuted: string[];
      schemaNegotiated: boolean;
      fieldsFound: string[];
      fieldsMissing: string[];
    };
  };
  trace?: any[];
  evaluation?: any;
}

/**
 * Evidence-First Enhanced Processor
 * Integrates with existing plan-based system while adding evidence-first capabilities
 */
export class EvidenceFirstIntegration {
  private evidenceProcessor: EvidenceFirstProcessor;
  private planBasedSystem: any; // Will be injected

  constructor() {
    // Convert core templates to schema contracts
    const schemaContracts = this.convertTemplatesToContracts(CORE_TEMPLATES);
    this.evidenceProcessor = new EvidenceFirstProcessor(schemaContracts);
  }

  /**
   * Main processing method that decides between evidence-first and plan-based approaches
   */
  async processExtractionWithEvidenceFirst(
    htmlContent: string,
    params: EvidenceFirstExtractionParams,
    planBasedProcessor: any
  ): Promise<EvidenceFirstResult> {
    const startTime = Date.now();
    this.planBasedSystem = planBasedProcessor;

    try {
      // Check if evidence-first processing is requested and beneficial
      if (params.useEvidenceFirst !== false && this.shouldUseEvidenceFirst(params)) {
        console.log('🧠 Using Evidence-First processing');
        return await this.runEvidenceFirstProcessing(htmlContent, params);
      } else {
        console.log('📋 Using Plan-Based processing (evidence-first disabled or not beneficial)');
        return await this.runPlanBasedFallback(htmlContent, params);
      }
    } catch (error) {
      console.error('Evidence-first integration failed:', error);
      // Always fallback to plan-based system on error
      return await this.runPlanBasedFallback(htmlContent, params);
    }
  }

  /**
   * Run full evidence-first processing
   */
  private async runEvidenceFirstProcessing(
    htmlContent: string,
    params: EvidenceFirstExtractionParams
  ): Promise<EvidenceFirstResult> {
    const startTime = Date.now();

    // Create extraction context for evidence-first processor
    const context: ExtractionContext = {
      url: params.url,
      html: htmlContent,
      userQuery: params.extractionInstructions,
      options: {
        enableLLMTrack: true,
        maxProcessingTime: 15000,
        confidenceThreshold: 0.6,
        fallbackStrategy: 'partial'
      }
    };

    // Execute evidence-first processing
    const evidence = await this.evidenceProcessor.processExtraction(context);

    // Convert schema contract to plan-based parameters
    const enhancedParams = this.convertContractToPlanParams(evidence.negotiatedSchema, params);

    // Execute enhanced plan-based processing with evidence-first context
    const planResult = await this.executePlanWithEvidenceContext(
      htmlContent,
      enhancedParams,
      evidence
    );

    // Compile final result
    return {
      success: planResult.success || false,
      data: this.mergeEvidenceWithPlanResult(evidence, planResult),
      metadata: {
        processingMethod: 'evidence_first',
        schemaContract: evidence.negotiatedSchema,
        deterministicTrackConfidence: evidence.deterministicTrack.confidence,
        llmTrackConfidence: evidence.llmTrack?.confidence,
        negotiatedFields: evidence.negotiatedSchema.fields.length,
        totalProcessingTime: Date.now() - startTime,
        evidenceFirst: {
          contractGenerated: true,
          tracksExecuted: [
            evidence.deterministicTrack.type,
            ...(evidence.llmTrack ? [evidence.llmTrack.type] : [])
          ],
          schemaNegotiated: true,
          fieldsFound: Object.keys(evidence.finalData),
          fieldsMissing: evidence.negotiatedSchema.fields
            .filter(f => f.priority === 'required' && !evidence.finalData[f.name])
            .map(f => f.name)
        }
      },
      trace: planResult.trace || [],
      evaluation: planResult.evaluation
    };
  }

  /**
   * Fallback to plan-based system
   */
  private async runPlanBasedFallback(
    htmlContent: string,
    params: EvidenceFirstExtractionParams
  ): Promise<EvidenceFirstResult> {
    const startTime = Date.now();

    // Call existing plan-based system directly
    const planResult = await this.planBasedSystem(htmlContent, params);

    return {
      success: planResult.success || false,
      data: planResult.data || {},
      metadata: {
        processingMethod: 'plan_based_fallback',
        schemaContract: this.createFallbackContract(params),
        deterministicTrackConfidence: 0.8, // Assume high confidence for plan-based
        totalProcessingTime: Date.now() - startTime
      },
      trace: planResult.trace || [],
      evaluation: planResult.evaluation
    };
  }

  /**
   * Determine if evidence-first processing would be beneficial
   */
  private shouldUseEvidenceFirst(params: EvidenceFirstExtractionParams): boolean {
    const query = params.extractionInstructions?.toLowerCase() || '';

    // Use evidence-first for ambiguous queries
    const ambiguousPatterns = [
      /\b(extract|get|find|list)\b.*\b(all|any|different|various)\b/i,
      /\b(names?|information|data|details)\b.*(?!person|people|staff|team|employee)/i,
      /\b(departments?|categories?|sections?|types?)\b/i,
      /(what|which|how many).*(?:are|is) (?:there|available|on)/i
    ];

    const isAmbiguous = ambiguousPatterns.some(pattern => pattern.test(query));

    // Use evidence-first for queries that don't fit standard templates
    const hasStandardTemplateKeywords = [
      'team member', 'staff', 'employee', 'person profile',
      'product', 'price', 'buy', 'shop',
      'article', 'news', 'story',
      'event', 'calendar', 'schedule'
    ].some(keyword => query.includes(keyword));

    return isAmbiguous || !hasStandardTemplateKeywords;
  }

  /**
   * Convert schema contract to plan-based parameters
   */
  private convertContractToPlanParams(
    contract: SchemaContract,
    originalParams: EvidenceFirstExtractionParams
  ): any {
    // Generate output schema from contract
    const outputSchema = {
      type: 'object',
      properties: {}
    };

    contract.fields.forEach(field => {
      outputSchema.properties[field.name] = {
        type: field.type === 'text' ? 'string' : field.type,
        description: field.description
      };

      if (field.validation) {
        if (field.validation.pattern) {
          outputSchema.properties[field.name].pattern = field.validation.pattern;
        }
        if (field.validation.enum) {
          outputSchema.properties[field.name].enum = field.validation.enum;
        }
      }
    });

    // Enhanced instructions that incorporate contract insights
    const enhancedInstructions = `${originalParams.extractionInstructions}

Schema Contract: ${contract.name}
Required Fields: ${contract.fields.filter(f => f.priority === 'required').map(f => f.name).join(', ')}
Expected Fields: ${contract.fields.filter(f => f.priority === 'expected').map(f => f.name).join(', ')}
Discoverable Fields: ${contract.fields.filter(f => f.priority === 'discoverable').map(f => f.name).join(', ')}

Field Extraction Hints:
${contract.fields.map(field => {
  if (field.extractionHints?.keywords) {
    return `- ${field.name}: Look for keywords ${field.extractionHints.keywords.join(', ')}`;
  }
  return `- ${field.name}: ${field.description || 'Extract as available'}`;
}).join('\n')}

Focus on evidence-based extraction - only extract fields that have clear evidence in the content.`;

    return {
      ...originalParams,
      extractionInstructions: enhancedInstructions,
      outputSchema,
      postProcessing: `${originalParams.postProcessing || ''}\n\nApply evidence-first principles: abstain from fields without clear evidence, promote discoverable fields found with high confidence.`
    };
  }

  /**
   * Execute plan with evidence context
   */
  private async executePlanWithEvidenceContext(
    htmlContent: string,
    enhancedParams: any,
    evidence: any
  ): Promise<any> {
    // Add evidence context to parameters
    const contextualParams = {
      ...enhancedParams,
      evidenceContext: {
        deterministicFindings: evidence.deterministicTrack.fields,
        llmFindings: evidence.llmTrack?.fields || {},
        contractId: evidence.contractId,
        highConfidenceFields: Object.keys(evidence.finalData).filter(key => 
          evidence.finalData[key] !== null && evidence.finalData[key] !== undefined
        )
      }
    };

    return await this.planBasedSystem(htmlContent, contextualParams);
  }

  /**
   * Merge evidence-first results with plan-based results
   */
  private mergeEvidenceWithPlanResult(evidence: any, planResult: any): any {
    const evidenceData = evidence.finalData || {};
    const planData = planResult.data || {};

    // Merge with evidence-first taking priority for high-confidence fields
    const mergedData = { ...planData };

    Object.keys(evidenceData).forEach(key => {
      if (evidenceData[key] !== null && evidenceData[key] !== undefined) {
        mergedData[key] = evidenceData[key];
      }
    });

    return {
      ...mergedData,
      _evidenceFirst: {
        contractUsed: evidence.negotiatedSchema.name,
        fieldsFromEvidence: Object.keys(evidenceData).length,
        fieldsFromPlan: Object.keys(planData).length,
        trackComparison: evidence.metadata.trackComparison
      }
    };
  }

  /**
   * Create fallback contract for plan-based processing
   */
  private createFallbackContract(params: EvidenceFirstExtractionParams): SchemaContract {
    return {
      id: 'fallback_contract',
      name: 'Plan-Based Fallback',
      description: 'Default contract when evidence-first is not used',
      fields: [
        {
          name: 'title',
          type: 'text',
          priority: 'required',
          description: 'Main content identifier'
        },
        {
          name: 'content',
          type: 'text', 
          priority: 'expected',
          description: 'Main extracted content'
        }
      ],
      metadata: {
        confidence: 0.8,
        source: 'template',
        created: new Date().toISOString(),
        userQuery: params.extractionInstructions
      },
      validation: {
        minRequiredFields: 1,
        allowAdditionalFields: true,
        strictMode: false
      }
    };
  }

  /**
   * Convert core templates to schema contracts
   */
  private convertTemplatesToContracts(coreTemplates: any[]): SchemaContract[] {
    return coreTemplates.map((template, index) => ({
      id: `core_template_${index}`,
      name: template.name || 'Core Template',
      description: template.description || 'Converted from core template',
      fields: this.extractFieldsFromTemplate(template),
      metadata: {
        confidence: 0.9,
        source: 'template',
        created: new Date().toISOString(),
        userQuery: '',
        domain: template.domain || 'general'
      },
      validation: {
        minRequiredFields: 1,
        allowAdditionalFields: true,
        strictMode: false
      }
    }));
  }

  /**
   * Extract fields from template format
   */
  private extractFieldsFromTemplate(template: any): any[] {
    // This would need to be implemented based on the actual CORE_TEMPLATES structure
    // For now, return basic fields
    return [
      {
        name: 'title',
        type: 'text',
        priority: 'required',
        description: 'Main title or name'
      },
      {
        name: 'description',
        type: 'text',
        priority: 'expected', 
        description: 'Content description'
      },
      {
        name: 'url',
        type: 'url',
        priority: 'discoverable',
        description: 'Associated URL'
      }
    ];
  }
}

/**
 * Factory function to create evidence-first integration
 */
export function createEvidenceFirstIntegration(): EvidenceFirstIntegration {
  return new EvidenceFirstIntegration();
}