/**
 * Evidence-First Processor
 * Implements two-track processing with schema negotiation
 */

import { 
  SchemaContract, 
  FieldSpec, 
  EvidenceTrack, 
  SchemaEvidence, 
  ContractGenerationContext,
  SchemaContractGenerator 
} from './schema-contracts';

export interface ProcessingOptions {
  enableLLMTrack: boolean;
  maxProcessingTime: number;
  confidenceThreshold: number;
  fallbackStrategy: 'abstain' | 'partial' | 'template_default';
}

export interface ExtractionContext {
  url: string;
  html: string;
  userQuery: string;
  existingContracts?: SchemaContract[];
  options?: Partial<ProcessingOptions>;
}

export interface DOMAnalysisResult {
  elements: Array<{
    selector: string;
    text: string;
    attributes: Record<string, string>;
    type: 'link' | 'text' | 'image' | 'list' | 'table' | 'form';
    confidence: number;
  }>;
  structure: {
    hasLists: boolean;
    hasTable: boolean;
    hasForms: boolean;
    repeatingPatterns: string[];
  };
  metadata: {
    domain: string;
    title: string;
    description?: string;
    language?: string;
  };
}

/**
 * Evidence-First Processor - Core Implementation
 */
export class EvidenceFirstProcessor {
  private contractGenerator: SchemaContractGenerator;
  private defaultOptions: ProcessingOptions = {
    enableLLMTrack: true,
    maxProcessingTime: 10000, // 10 seconds
    confidenceThreshold: 0.6,
    fallbackStrategy: 'partial'
  };

  constructor(existingContracts: SchemaContract[] = []) {
    this.contractGenerator = new SchemaContractGenerator(existingContracts);
  }

  /**
   * Main processing entry point - Evidence-First Extraction
   */
  async processExtraction(context: ExtractionContext): Promise<SchemaEvidence> {
    const startTime = Date.now();
    const options = { ...this.defaultOptions, ...context.options };

    try {
      // Step 1: Generate schema contract from user query
      const contract = await this.generateSchemaContract(context);
      console.log(`📋 Generated schema contract: ${contract.name} (${contract.fields.length} fields)`);

      // Step 2: Execute two-track processing
      const deterministicTrack = await this.runDeterministicTrack(context, contract);
      const llmTrack = options.enableLLMTrack 
        ? await this.runLLMTrack(context, contract, deterministicTrack)
        : undefined;

      // Step 3: Evidence-based schema negotiation
      const evidence = await this.negotiateSchema(
        contract,
        deterministicTrack,
        llmTrack,
        context
      );

      // Step 4: Final data compilation
      const finalData = this.compileFinalData(evidence, deterministicTrack, llmTrack);

      return {
        contractId: contract.id,
        deterministicTrack,
        llmTrack,
        negotiatedSchema: evidence,
        finalData,
        metadata: {
          totalProcessingTime: Date.now() - startTime,
          trackComparison: llmTrack ? this.compareTrackResults(deterministicTrack, llmTrack) : undefined
        }
      };

    } catch (error) {
      console.error('Evidence-first processing failed:', error);
      throw new Error(`Evidence-first processing failed: ${error.message}`);
    }
  }

  /**
   * Generate schema contract from user context
   */
  private async generateSchemaContract(context: ExtractionContext): Promise<SchemaContract> {
    const generationContext: ContractGenerationContext = {
      userQuery: context.userQuery,
      url: context.url,
      contentSample: context.html.substring(0, 2000),
      existingTemplates: context.existingContracts
    };

    return await this.contractGenerator.generateContract(generationContext);
  }

  /**
   * Deterministic Track: DOM-based analysis with heuristics
   */
  private async runDeterministicTrack(
    context: ExtractionContext, 
    contract: SchemaContract
  ): Promise<EvidenceTrack> {
    const startTime = Date.now();
    
    try {
      // Parse HTML and analyze DOM structure
      const domAnalysis = this.analyzeDOMStructure(context.html);
      
      // Extract fields based on contract specifications
      const extractedFields: Record<string, any> = {};
      let totalConfidence = 0;
      let fieldCount = 0;

      for (const field of contract.fields) {
        const fieldResult = this.extractFieldDeterministically(field, domAnalysis, context.html);
        if (fieldResult.found) {
          extractedFields[field.name] = fieldResult.value;
          totalConfidence += fieldResult.confidence;
          fieldCount++;
        }
      }

      const averageConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;

      return {
        type: 'deterministic',
        confidence: Math.min(averageConfidence, 0.95), // Cap at 95% for deterministic
        source: 'dom_analysis',
        fields: extractedFields,
        metadata: {
          extractionMethod: 'rule_based_dom',
          processingTime: Date.now() - startTime,
          fieldsFound: fieldCount,
          fieldsRequested: contract.fields.length
        }
      };

    } catch (error) {
      return {
        type: 'deterministic',
        confidence: 0,
        source: 'dom_analysis',
        fields: {},
        metadata: {
          extractionMethod: 'rule_based_dom',
          processingTime: Date.now() - startTime,
          errors: [error.message]
        }
      };
    }
  }

  /**
   * LLM Augmentation Track: Bounded AI enhancement
   */
  private async runLLMTrack(
    context: ExtractionContext,
    contract: SchemaContract,
    deterministicTrack: EvidenceTrack
  ): Promise<EvidenceTrack> {
    const startTime = Date.now();

    try {
      // Only use LLM track if deterministic track has gaps or low confidence
      const shouldEnhance = deterministicTrack.confidence < 0.7 || 
                           Object.keys(deterministicTrack.fields).length < contract.fields.filter(f => f.priority === 'required').length;

      if (!shouldEnhance) {
        console.log('🚫 LLM track skipped - deterministic track sufficient');
        return {
          type: 'llm_augmented',
          confidence: deterministicTrack.confidence,
          source: 'skipped_sufficient_deterministic',
          fields: {},
          metadata: {
            extractionMethod: 'skipped',
            processingTime: Date.now() - startTime
          }
        };
      }

      // Use existing plan-based system for LLM processing
      const llmResult = await this.callPlanBasedSystem(context, contract);

      return {
        type: 'llm_augmented',
        confidence: llmResult.confidence || 0.8,
        source: 'plan_based_system',
        fields: llmResult.data || {},
        metadata: {
          extractionMethod: 'plan_based_llm',
          processingTime: Date.now() - startTime,
          modelUsed: 'gpt-4'
        }
      };

    } catch (error) {
      console.warn('LLM track failed, continuing with deterministic only:', error.message);
      return {
        type: 'llm_augmented',
        confidence: 0,
        source: 'plan_based_system',
        fields: {},
        metadata: {
          extractionMethod: 'plan_based_llm',
          processingTime: Date.now() - startTime,
          errors: [error.message]
        }
      };
    }
  }

  /**
   * Evidence-based schema negotiation
   */
  private async negotiateSchema(
    originalContract: SchemaContract,
    deterministicTrack: EvidenceTrack,
    llmTrack?: EvidenceTrack,
    context?: ExtractionContext
  ): Promise<SchemaContract> {
    const foundFields = new Set([
      ...Object.keys(deterministicTrack.fields),
      ...(llmTrack ? Object.keys(llmTrack.fields) : [])
    ]);

    // Prune absent required fields that weren't found with high confidence
    const prunedFields = originalContract.fields.filter(field => {
      if (field.priority === 'required' && !foundFields.has(field.name)) {
        console.log(`⚠️ Pruning required field '${field.name}' - no evidence found`);
        return false;
      }
      return true;
    });

    // Promote discoverable fields that were found with high confidence
    const promotedFields = prunedFields.map(field => {
      if (field.priority === 'discoverable' && foundFields.has(field.name)) {
        const evidence = deterministicTrack.fields[field.name] || (llmTrack?.fields[field.name]);
        const confidence = this.getFieldConfidence(field.name, deterministicTrack, llmTrack);
        
        if (confidence > 0.8) {
          console.log(`⬆️ Promoting field '${field.name}' from discoverable to expected`);
          return { ...field, priority: 'expected' as const };
        }
      }
      return field;
    });

    // Add discovered fields not in original contract
    const discoveredFields: FieldSpec[] = [];
    const allFoundFields = {
      ...deterministicTrack.fields,
      ...(llmTrack?.fields || {})
    };

    for (const [fieldName, fieldValue] of Object.entries(allFoundFields)) {
      if (!originalContract.fields.find(f => f.name === fieldName)) {
        discoveredFields.push({
          name: fieldName,
          type: this.inferFieldType(fieldValue),
          priority: 'discoverable',
          description: `Discovered during extraction`,
          extractionHints: {
            keywords: [fieldName]
          }
        });
      }
    }

    return {
      ...originalContract,
      id: `negotiated_${originalContract.id}`,
      name: `${originalContract.name} (Evidence-Negotiated)`,
      fields: [...promotedFields, ...discoveredFields],
      metadata: {
        ...originalContract.metadata,
        confidence: Math.max(deterministicTrack.confidence, llmTrack?.confidence || 0),
        source: 'hybrid'
      }
    };
  }

  /**
   * Analyze DOM structure for deterministic extraction
   */
  private analyzeDOMStructure(html: string): DOMAnalysisResult {
    // Simplified DOM analysis - in production, use a proper HTML parser
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    
    return {
      elements: [],
      structure: {
        hasLists: html.includes('<ul>') || html.includes('<ol>'),
        hasTable: html.includes('<table>'),
        hasForms: html.includes('<form>'),
        repeatingPatterns: []
      },
      metadata: {
        domain: 'general',
        title: titleMatch?.[1] || 'Untitled',
        description: descMatch?.[1],
        language: 'en'
      }
    };
  }

  /**
   * Extract field using deterministic methods
   */
  private extractFieldDeterministically(
    field: FieldSpec, 
    domAnalysis: DOMAnalysisResult, 
    html: string
  ): { found: boolean; value: any; confidence: number } {
    const hints = field.extractionHints;
    
    if (!hints?.keywords?.length) {
      return { found: false, value: null, confidence: 0 };
    }

    // Simple pattern matching for demonstration
    for (const keyword of hints.keywords) {
      const pattern = new RegExp(`${keyword}[:\\s]*([^<\n]+)`, 'i');
      const match = html.match(pattern);
      
      if (match) {
        return {
          found: true,
          value: match[1].trim(),
          confidence: 0.7
        };
      }
    }

    return { found: false, value: null, confidence: 0 };
  }

  /**
   * Call existing plan-based system for LLM processing
   */
  private async callPlanBasedSystem(context: ExtractionContext, contract: SchemaContract): Promise<any> {
    // This would integrate with the existing worker-enhanced.js system
    // For now, return a mock response that follows the expected structure
    return {
      success: true,
      confidence: 0.8,
      data: {
        title: "Sample extracted title",
        description: "Sample extracted description"
      }
    };
  }

  /**
   * Compare results from both tracks
   */
  private compareTrackResults(deterministicTrack: EvidenceTrack, llmTrack: EvidenceTrack) {
    const detFields = Object.keys(deterministicTrack.fields);
    const llmFields = Object.keys(llmTrack.fields);
    const allFields = new Set([...detFields, ...llmFields]);
    
    let agreements = 0;
    let conflicts = [];
    
    for (const field of allFields) {
      const detValue = deterministicTrack.fields[field];
      const llmValue = llmTrack.fields[field];
      
      if (detValue && llmValue) {
        if (detValue === llmValue) {
          agreements++;
        } else {
          conflicts.push(`${field}: det="${detValue}" vs llm="${llmValue}"`);
        }
      }
    }
    
    return {
      agreement: agreements / allFields.size,
      conflicts,
      resolutions: [] // Would implement resolution strategies
    };
  }

  /**
   * Get confidence for a specific field across tracks
   */
  private getFieldConfidence(fieldName: string, deterministicTrack: EvidenceTrack, llmTrack?: EvidenceTrack): number {
    const detHasField = deterministicTrack.fields.hasOwnProperty(fieldName);
    const llmHasField = llmTrack?.fields.hasOwnProperty(fieldName);
    
    if (detHasField && llmHasField) {
      return Math.max(deterministicTrack.confidence, llmTrack.confidence);
    } else if (detHasField) {
      return deterministicTrack.confidence;
    } else if (llmHasField) {
      return llmTrack.confidence * 0.8; // Slightly lower confidence for LLM-only
    }
    
    return 0;
  }

  /**
   * Infer field type from value
   */
  private inferFieldType(value: any): string {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'string') {
      if (value.match(/^https?:\/\//)) return 'url';
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) return 'date';
      if (value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return 'email';
      if (value.match(/^\+?[\d\s()-]+$/)) return 'phone';
    }
    return 'text';
  }

  /**
   * Compile final data from both tracks
   */
  private compileFinalData(
    negotiatedSchema: SchemaContract,
    deterministicTrack: EvidenceTrack,
    llmTrack?: EvidenceTrack
  ): Record<string, any> {
    const finalData: Record<string, any> = {};
    
    for (const field of negotiatedSchema.fields) {
      const detValue = deterministicTrack.fields[field.name];
      const llmValue = llmTrack?.fields[field.name];
      
      // Priority: deterministic > LLM > null
      if (detValue !== undefined) {
        finalData[field.name] = detValue;
      } else if (llmValue !== undefined) {
        finalData[field.name] = llmValue;
      } else if (field.priority === 'required') {
        finalData[field.name] = null; // Explicit null for missing required fields
      }
    }
    
    return finalData;
  }
}