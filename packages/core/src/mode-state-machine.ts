/**
 * Contract Mode State Machine
 * Implements strict/soft mode behavior with crystal clear state logic
 * 
 * STRICT MODE: Drop entities with missing required fields
 * SOFT MODE: Demote fields with low support rates, update contract schema
 */

import { ContractV02Schema, ProcessingResult } from './types';

// ===== CORE TYPES =====

export interface ModeStateMachineOptions {
  mode: 'strict' | 'soft';
  supportRateThreshold: number; // Default: 0.6 (60%)
  enableMetadataReporting: boolean;
}

export interface EntityData {
  [fieldName: string]: any;
}

export interface FieldSupportRate {
  fieldName: string;
  supportRate: number;
  totalEntities: number;
  entitiesWithField: number;
}

export interface ContractModeMetadata {
  mode: 'strict' | 'soft';
  rows_dropped_count: number;
  fields_omitted: string[];
  field_support_rates: FieldSupportRate[];
  schema_changes?: {
    fieldsRemovedFromRequired: string[];
    fieldsKeptInProperties: string[];
  };
  processing_summary: {
    input_entities: number;
    output_entities: number;
    fields_analyzed: number;
    fields_below_threshold: number;
  };
}

export interface ModeProcessingResult {
  success: boolean;
  entities: EntityData[];
  contract: ContractV02Schema;
  metadata: ContractModeMetadata;
}

// ===== CUSTOM ERRORS =====

export class StrictModeFailureError extends Error {
  public readonly droppedCount: number;
  public readonly originalCount: number;
  
  constructor(droppedCount: number, originalCount: number, message?: string) {
    super(message || `Strict mode failed: ALL ${originalCount} entities dropped due to missing required fields`);
    this.name = 'StrictModeFailureError';
    this.droppedCount = droppedCount;
    this.originalCount = originalCount;
  }
}

// ===== MAIN STATE MACHINE =====

export class ContractModeStateMachine {
  private options: ModeStateMachineOptions;
  
  constructor(options: Partial<ModeStateMachineOptions> = {}) {
    this.options = {
      mode: options.mode || 'soft',
      supportRateThreshold: options.supportRateThreshold || 0.6,
      enableMetadataReporting: options.enableMetadataReporting ?? true
    };
  }

  /**
   * Main processing entry point - applies strict/soft mode logic
   */
  async processEntitiesWithMode(
    entities: EntityData[],
    contract: ContractV02Schema
  ): Promise<ModeProcessingResult> {
    
    if (!entities || entities.length === 0) {
      return this.createEmptyResult(contract, 'No entities provided for processing');
    }

    try {
      // Step 1: Calculate field support rates for all fields
      const supportRates = this.calculateSupportRates(entities, contract);
      
      // Step 2: Apply mode-specific processing
      let processedEntities: EntityData[];
      let updatedContract = { ...contract };
      let droppedCount = 0;
      let omittedFields: string[] = [];

      if (this.options.mode === 'strict') {
        const strictResult = this.handleStrictMode(entities, contract, supportRates);
        processedEntities = strictResult.entities;
        droppedCount = strictResult.droppedCount;
      } else {
        const softResult = this.handleSoftMode(entities, contract, supportRates);
        processedEntities = softResult.entities;
        updatedContract = softResult.contract;
        omittedFields = softResult.omittedFields;
      }

      // Step 3: Build comprehensive metadata
      const metadata = this.buildMetadata(
        entities.length,
        processedEntities.length,
        droppedCount,
        omittedFields,
        supportRates,
        updatedContract !== contract ? {
          fieldsRemovedFromRequired: omittedFields,
          fieldsKeptInProperties: omittedFields // Same fields, just demoted
        } : undefined
      );

      return {
        success: true,
        entities: processedEntities,
        contract: updatedContract,
        metadata
      };

    } catch (error) {
      if (error instanceof StrictModeFailureError) {
        // Re-throw strict mode failures with full context
        throw error;
      }
      
      throw new Error(`Mode processing failed: ${error.message}`);
    }
  }

  /**
   * STRICT MODE: Drop entities with missing required fields
   */
  handleStrictMode(
    entities: EntityData[],
    contract: ContractV02Schema,
    supportRates: FieldSupportRate[]
  ): { entities: EntityData[]; droppedCount: number } {
    
    const requiredFields = contract.output_schema.items.required || [];
    const validEntities: EntityData[] = [];
    let droppedCount = 0;

    for (const entity of entities) {
      let hasAllRequired = true;
      
      // Check if entity has ALL required fields with non-null values
      for (const requiredField of requiredFields) {
        const fieldValue = entity[requiredField];
        if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
          hasAllRequired = false;
          break;
        }
      }

      if (hasAllRequired) {
        validEntities.push(entity);
      } else {
        droppedCount++;
      }
    }

    // STRICT MODE FAILURE: If ALL entities are dropped, throw error
    if (validEntities.length === 0 && entities.length > 0) {
      throw new StrictModeFailureError(
        droppedCount, 
        entities.length,
        `Strict mode validation failed: All ${entities.length} entities dropped. Required fields: ${requiredFields.join(', ')}`
      );
    }

    return {
      entities: validEntities,
      droppedCount
    };
  }

  /**
   * SOFT MODE: Demote fields with low support rates
   */
  handleSoftMode(
    entities: EntityData[],
    contract: ContractV02Schema,
    supportRates: FieldSupportRate[]
  ): { entities: EntityData[]; contract: ContractV02Schema; omittedFields: string[] } {
    
    // Find fields with support rates below threshold
    const lowSupportFields = supportRates
      .filter(rate => rate.supportRate < this.options.supportRateThreshold)
      .map(rate => rate.fieldName);

    if (lowSupportFields.length === 0) {
      // No fields to demote, return as-is
      return {
        entities,
        contract,
        omittedFields: []
      };
    }

    // Create updated contract with demoted fields
    const updatedContract = this.updateContractSchema(contract, lowSupportFields);

    // Process entities - remove low support fields from output
    const processedEntities = entities.map(entity => {
      const cleanedEntity = { ...entity };
      
      for (const fieldName of lowSupportFields) {
        delete cleanedEntity[fieldName];
      }
      
      return cleanedEntity;
    });

    return {
      entities: processedEntities,
      contract: updatedContract,
      omittedFields: lowSupportFields
    };
  }

  /**
   * Calculate support rates for all fields in the contract
   */
  calculateSupportRates(entities: EntityData[], contract: ContractV02Schema): FieldSupportRate[] {
    const allFields = Object.keys(contract.output_schema.items.properties || {});
    const supportRates: FieldSupportRate[] = [];

    for (const fieldName of allFields) {
      let entitiesWithField = 0;

      // Count entities that have this field with a non-null value
      for (const entity of entities) {
        const fieldValue = entity[fieldName];
        if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
          entitiesWithField++;
        }
      }

      const supportRate = entities.length > 0 ? entitiesWithField / entities.length : 0;

      supportRates.push({
        fieldName,
        supportRate,
        totalEntities: entities.length,
        entitiesWithField
      });
    }

    return supportRates.sort((a, b) => b.supportRate - a.supportRate); // Sort by support rate desc
  }

  /**
   * Update contract schema by removing low-support fields from required array
   * but keeping them in properties for potential future use
   */
  private updateContractSchema(
    contract: ContractV02Schema,
    fieldsToRemoveFromRequired: string[]
  ): ContractV02Schema {
    
    const updatedContract = JSON.parse(JSON.stringify(contract)); // Deep clone
    
    // Remove fields from required array
    if (updatedContract.output_schema.items.required) {
      updatedContract.output_schema.items.required = 
        updatedContract.output_schema.items.required.filter(
          (fieldName: string) => !fieldsToRemoveFromRequired.includes(fieldName)
        );
    }

    // Fields remain in properties schema for potential future extraction
    // This preserves the schema definition while making fields optional

    // Update contract ID to reflect changes
    updatedContract.contract_id = `${contract.contract_id}_soft_mode_${Date.now()}`;

    return updatedContract;
  }

  /**
   * Build comprehensive metadata for transparency and debugging
   */
  private buildMetadata(
    inputCount: number,
    outputCount: number,
    droppedCount: number,
    omittedFields: string[],
    supportRates: FieldSupportRate[],
    schemaChanges?: {
      fieldsRemovedFromRequired: string[];
      fieldsKeptInProperties: string[];
    }
  ): ContractModeMetadata {
    
    const fieldsBelowThreshold = supportRates.filter(
      rate => rate.supportRate < this.options.supportRateThreshold
    ).length;

    return {
      mode: this.options.mode,
      rows_dropped_count: droppedCount,
      fields_omitted: omittedFields,
      field_support_rates: supportRates,
      schema_changes: schemaChanges,
      processing_summary: {
        input_entities: inputCount,
        output_entities: outputCount,
        fields_analyzed: supportRates.length,
        fields_below_threshold: fieldsBelowThreshold
      }
    };
  }

  /**
   * Create empty result for edge cases
   */
  private createEmptyResult(contract: ContractV02Schema, reason: string): ModeProcessingResult {
    return {
      success: false,
      entities: [],
      contract,
      metadata: {
        mode: this.options.mode,
        rows_dropped_count: 0,
        fields_omitted: [],
        field_support_rates: [],
        processing_summary: {
          input_entities: 0,
          output_entities: 0,
          fields_analyzed: 0,
          fields_below_threshold: 0
        }
      }
    };
  }

  // ===== UTILITY METHODS =====

  /**
   * Change mode at runtime
   */
  setMode(mode: 'strict' | 'soft'): void {
    this.options.mode = mode;
  }

  /**
   * Change support rate threshold at runtime
   */
  setSupportRateThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Support rate threshold must be between 0 and 1');
    }
    this.options.supportRateThreshold = threshold;
  }

  /**
   * Get current configuration
   */
  getConfiguration(): ModeStateMachineOptions {
    return { ...this.options };
  }

  /**
   * Validate entities match contract schema structure
   */
  validateContractCompatibility(entities: EntityData[], contract: ContractV02Schema): {
    compatible: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    if (!contract.output_schema?.items?.properties) {
      issues.push('Contract missing output schema properties definition');
      return { compatible: false, issues };
    }

    const contractFields = Object.keys(contract.output_schema.items.properties);
    
    if (entities.length > 0) {
      const sampleEntity = entities[0];
      const entityFields = Object.keys(sampleEntity);
      
      // Check if sample entity has any fields not defined in contract
      const extraFields = entityFields.filter(field => !contractFields.includes(field));
      if (extraFields.length > 0) {
        issues.push(`Entity contains fields not in contract: ${extraFields.join(', ')}`);
      }
    }

    return {
      compatible: issues.length === 0,
      issues
    };
  }

  /**
   * Generate processing report for debugging
   */
  generateProcessingReport(result: ModeProcessingResult): string {
    const { metadata } = result;
    const lines: string[] = [];
    
    lines.push('=== CONTRACT MODE PROCESSING REPORT ===');
    lines.push(`Mode: ${metadata.mode.toUpperCase()}`);
    lines.push(`Input Entities: ${metadata.processing_summary.input_entities}`);
    lines.push(`Output Entities: ${metadata.processing_summary.output_entities}`);
    lines.push(`Rows Dropped: ${metadata.rows_dropped_count}`);
    lines.push(`Fields Omitted: ${metadata.fields_omitted.length > 0 ? metadata.fields_omitted.join(', ') : 'None'}`);
    lines.push('');
    
    lines.push('Field Support Rates:');
    for (const rate of metadata.field_support_rates) {
      const percentage = (rate.supportRate * 100).toFixed(1);
      const status = rate.supportRate >= this.options.supportRateThreshold ? 'PASS' : 'FAIL';
      lines.push(`  ${rate.fieldName}: ${percentage}% (${rate.entitiesWithField}/${rate.totalEntities}) [${status}]`);
    }
    
    if (metadata.schema_changes) {
      lines.push('');
      lines.push('Schema Changes:');
      lines.push(`  Fields removed from required: ${metadata.schema_changes.fieldsRemovedFromRequired.join(', ')}`);
      lines.push(`  Fields kept in properties: ${metadata.schema_changes.fieldsKeptInProperties.join(', ')}`);
    }
    
    return lines.join('\n');
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Factory function for creating mode state machine instances
 */
export function createModeStateMachine(mode: 'strict' | 'soft', options?: Partial<ModeStateMachineOptions>): ContractModeStateMachine {
  return new ContractModeStateMachine({
    mode,
    ...options
  });
}

/**
 * Quick strict mode processing
 */
export async function processInStrictMode(
  entities: EntityData[],
  contract: ContractV02Schema,
  options?: Partial<ModeStateMachineOptions>
): Promise<ModeProcessingResult> {
  const machine = createModeStateMachine('strict', options);
  return machine.processEntitiesWithMode(entities, contract);
}

/**
 * Quick soft mode processing
 */
export async function processInSoftMode(
  entities: EntityData[],
  contract: ContractV02Schema,
  options?: Partial<ModeStateMachineOptions>
): Promise<ModeProcessingResult> {
  const machine = createModeStateMachine('soft', options);
  return machine.processEntitiesWithMode(entities, contract);
}

// Export everything needed for external use
export {
  ContractModeStateMachine as default,
  // Types
  type ModeStateMachineOptions,
  type EntityData,
  type FieldSupportRate,
  type ContractModeMetadata,
  type ModeProcessingResult
};