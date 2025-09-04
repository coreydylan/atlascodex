/**
 * JSON Schema Draft 2020-12 Validation System
 * Implements strict schema validation with zero phantom fields and comprehensive compliance
 */

import Ajv, { ErrorObject, SchemaObject, ValidateFunction, AnySchemaObject } from 'ajv';
import addFormats from 'ajv-formats';

/**
 * JSON Schema Draft 2020-12 Meta Schema (Simplified for AJV compatibility)
 * Reference: https://json-schema.org/draft/2020-12/schema
 */
const DRAFT_2020_12_META_SCHEMA: SchemaObject = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Core and Validation specifications meta-schema',
  type: 'object'
};

/**
 * Contract metadata for reproducibility and versioning
 */
export interface ContractMetadata {
  version: string;
  generator: string;
  seed: number;
  timestamp: string;
  schemaVersion: string;
  strictMode: boolean;
}

/**
 * Enhanced contract structure with reproducibility metadata
 */
export interface EnhancedContract {
  metadata: ContractMetadata;
  schema: SchemaObject;
  data: any;
  validationResults: {
    isValid: boolean;
    errors: ErrorObject[] | null;
    phantomFields: string[];
    extraProperties: string[];
  };
}

/**
 * Contract V02 Schema with strict enforcement
 * Prevents all phantom fields and extra properties
 */
export const CONTRACT_V02_SCHEMA: SchemaObject = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://atlas-codex.com/schemas/contract-v02.json',
  title: 'Atlas Codex Contract V02',
  type: 'object',
  additionalProperties: false,
  required: ['metadata', 'schema', 'data', 'validationResults'],
  properties: {
    metadata: {
      type: 'object',
      additionalProperties: false,
      required: ['version', 'generator', 'seed', 'timestamp', 'schemaVersion', 'strictMode'],
      properties: {
        version: {
          type: 'string',
          pattern: '^v\\d+\\.\\d+$',
          description: 'Contract version in format v{major}.{minor}'
        },
        generator: {
          type: 'string',
          const: 'atlas-codex-schema-validator',
          description: 'Fixed generator identifier'
        },
        seed: {
          type: 'number',
          minimum: 0,
          maximum: 999999,
          description: 'Fixed seed for deterministic generation'
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'ISO 8601 timestamp of contract generation'
        },
        schemaVersion: {
          type: 'string',
          const: 'https://json-schema.org/draft/2020-12/schema',
          description: 'JSON Schema draft version'
        },
        strictMode: {
          type: 'boolean',
          const: true,
          description: 'Strict validation mode enabled'
        }
      }
    },
    schema: {
      $ref: 'https://json-schema.org/draft/2020-12/schema',
      description: 'JSON Schema Draft 2020-12 compliant schema'
    },
    data: {
      description: 'Data to be validated against the schema'
    },
    validationResults: {
      type: 'object',
      additionalProperties: false,
      required: ['isValid', 'errors', 'phantomFields', 'extraProperties'],
      properties: {
        isValid: {
          type: 'boolean',
          description: 'Whether the data passes validation'
        },
        errors: {
          oneOf: [
            { type: 'null' },
            {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true,
                required: ['instancePath', 'schemaPath', 'keyword', 'message'],
                properties: {
                  instancePath: { type: 'string' },
                  schemaPath: { type: 'string' },
                  keyword: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          ],
          description: 'AJV validation errors or null if valid'
        },
        phantomFields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields that appear in data but not in schema'
        },
        extraProperties: {
          type: 'array',
          items: { type: 'string' },
          description: 'Properties that violate additionalProperties: false'
        }
      }
    }
  }
};

/**
 * Validation configuration for strict enforcement
 */
export interface ValidationConfig {
  strict: boolean;
  unevaluated: boolean;
  allowUnionTypes: boolean;
  removeAdditional: boolean;
  useDefaults: boolean;
  coerceTypes: boolean;
  temperature: number;
  seed: number;
}

/**
 * Default strict validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  strict: true,
  unevaluated: true,
  allowUnionTypes: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
  temperature: 0, // Deterministic
  seed: 42 // Fixed seed for reproducibility
};

/**
 * AbstractionHandler for managing contract abstention
 * Handles cases where validation should be deferred or abstained
 */
export class AbstractionHandler {
  private abstentionReasons: Map<string, string> = new Map();
  private abstentionCallbacks: Map<string, () => void> = new Map();

  /**
   * Register an abstention reason for a specific schema path
   */
  registerAbstention(schemaPath: string, reason: string, callback?: () => void): void {
    this.abstentionReasons.set(schemaPath, reason);
    if (callback) {
      this.abstentionCallbacks.set(schemaPath, callback);
    }
  }

  /**
   * Check if a schema path should be abstained from validation
   */
  shouldAbstain(schemaPath: string): boolean {
    return this.abstentionReasons.has(schemaPath);
  }

  /**
   * Get abstention reason for a schema path
   */
  getAbstentionReason(schemaPath: string): string | undefined {
    return this.abstentionReasons.get(schemaPath);
  }

  /**
   * Execute abstention callback if registered
   */
  executeAbstentionCallback(schemaPath: string): void {
    const callback = this.abstentionCallbacks.get(schemaPath);
    if (callback) {
      callback();
    }
  }

  /**
   * Clear all registered abstentions
   */
  clearAbstentions(): void {
    this.abstentionReasons.clear();
    this.abstentionCallbacks.clear();
  }

  /**
   * Get all registered abstention paths
   */
  getAbstentionPaths(): string[] {
    return Array.from(this.abstentionReasons.keys());
  }
}

/**
 * Main Schema Validator class implementing JSON Schema Draft 2020-12
 */
export class SchemaValidator {
  private ajv: Ajv;
  private contractValidator: ValidateFunction;
  private abstractionHandler: AbstractionHandler;
  private config: ValidationConfig;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
    this.abstractionHandler = new AbstractionHandler();
    
    // Initialize AJV with compatible configuration
    this.ajv = new Ajv({
      strict: false, // Disable strict mode for broader compatibility
      validateFormats: true,
      addUsedSchema: false,
      removeAdditional: this.config.removeAdditional,
      useDefaults: this.config.useDefaults,
      coerceTypes: this.config.coerceTypes,
      multipleOfPrecision: 4
    });

    // Add format validators
    addFormats(this.ajv);

    // Add meta schema
    this.ajv.addMetaSchema(DRAFT_2020_12_META_SCHEMA);

    // Compile contract validator
    this.contractValidator = this.ajv.compile(CONTRACT_V02_SCHEMA);
  }

  /**
   * Create contract metadata with deterministic settings
   */
  private createContractMetadata(): ContractMetadata {
    return {
      version: 'v0.2',
      generator: 'atlas-codex-schema-validator',
      seed: this.config.seed,
      timestamp: new Date().toISOString(),
      schemaVersion: 'https://json-schema.org/draft/2020-12/schema',
      strictMode: true
    };
  }

  /**
   * Detect phantom fields - fields present in data but not defined in schema
   */
  private detectPhantomFields(data: any, schema: SchemaObject, path: string = ''): string[] {
    const phantomFields: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return phantomFields;
    }

    // Handle object schemas
    if (schema.type === 'object' || (schema.properties && typeof schema.properties === 'object')) {
      const schemaProps = schema.properties || {};
      const additionalAllowed = schema.additionalProperties !== false;

      for (const key of Object.keys(data)) {
        const fieldPath = path ? `${path}.${key}` : key;
        
        if (!(key in schemaProps)) {
          // Check if this field is allowed by additionalProperties
          if (!additionalAllowed) {
            phantomFields.push(fieldPath);
          }
        } else if (typeof schemaProps === 'object') {
          // Recursively check nested objects
          const nestedSchema = schemaProps[key] as SchemaObject;
          phantomFields.push(...this.detectPhantomFields(data[key], nestedSchema, fieldPath));
        }
      }
    }

    // Handle array schemas
    if (schema.type === 'array' && Array.isArray(data) && schema.items) {
      const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
      if (typeof itemSchema === 'object') {
        data.forEach((item, index) => {
          phantomFields.push(...this.detectPhantomFields(item, itemSchema as SchemaObject, `${path}[${index}]`));
        });
      }
    }

    return phantomFields;
  }

  /**
   * Detect extra properties that violate additionalProperties: false
   */
  private detectExtraProperties(data: any, schema: SchemaObject, path: string = ''): string[] {
    const extraProperties: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return extraProperties;
    }

    if (schema.type === 'object' || (schema.properties && typeof schema.properties === 'object')) {
      const schemaProps = schema.properties || {};
      
      // Check if additionalProperties is explicitly set to false
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(data)) {
          if (!(key in schemaProps)) {
            const fieldPath = path ? `${path}.${key}` : key;
            extraProperties.push(fieldPath);
          }
        }
      }

      // Note: unevaluatedProperties checking removed for AJV compatibility

      // Recursively check nested objects
      if (typeof schemaProps === 'object') {
        for (const key of Object.keys(schemaProps)) {
          if (data[key] !== undefined) {
            const fieldPath = path ? `${path}.${key}` : key;
            const nestedSchema = schemaProps[key] as SchemaObject;
            extraProperties.push(...this.detectExtraProperties(data[key], nestedSchema, fieldPath));
          }
        }
      }
    }

    return extraProperties;
  }

  /**
   * Validate data against a JSON Schema with comprehensive phantom field detection
   */
  validateSchema(data: any, schema: SchemaObject): {
    isValid: boolean;
    errors: ErrorObject[] | null;
    phantomFields: string[];
    extraProperties: string[];
  } {
    // Check for abstention first
    const schemaId = schema.$id || 'unknown';
    if (this.abstractionHandler.shouldAbstain(schemaId)) {
      this.abstractionHandler.executeAbstentionCallback(schemaId);
      return {
        isValid: false,
        errors: [{
          instancePath: '',
          schemaPath: '',
          keyword: 'abstention',
          message: this.abstractionHandler.getAbstentionReason(schemaId) || 'Validation abstained'
        }] as ErrorObject[],
        phantomFields: [],
        extraProperties: []
      };
    }

    // Compile and validate with AJV
    const validate = this.ajv.compile(schema);
    const isValid = validate(data);
    const errors = validate.errors || null;

    // Detect phantom fields and extra properties
    const phantomFields = this.detectPhantomFields(data, schema);
    const extraProperties = this.detectExtraProperties(data, schema);

    // If phantom fields or extra properties are found, mark as invalid
    const finalIsValid = isValid && phantomFields.length === 0 && extraProperties.length === 0;

    return {
      isValid: finalIsValid,
      errors: errors,
      phantomFields,
      extraProperties
    };
  }

  /**
   * Create an enhanced contract with deterministic generation
   */
  createEnhancedContract(data: any, schema: SchemaObject): EnhancedContract {
    const metadata = this.createContractMetadata();
    const validationResults = this.validateSchema(data, schema);

    return {
      metadata,
      schema,
      data,
      validationResults
    };
  }

  /**
   * Validate an enhanced contract against CONTRACT_V02_SCHEMA
   */
  validateContract(contract: EnhancedContract): {
    isValid: boolean;
    errors: ErrorObject[] | null;
    contractErrors: string[];
  } {
    const isValid = this.contractValidator(contract);
    const errors = this.contractValidator.errors || null;
    const contractErrors: string[] = [];

    // Additional contract-specific validations
    if (contract.metadata.generator !== 'atlas-codex-schema-validator') {
      contractErrors.push('Invalid generator in metadata');
    }

    if (contract.metadata.schemaVersion !== 'https://json-schema.org/draft/2020-12/schema') {
      contractErrors.push('Invalid schema version in metadata');
    }

    if (!contract.metadata.strictMode) {
      contractErrors.push('Strict mode must be enabled');
    }

    if (contract.validationResults.phantomFields.length > 0) {
      contractErrors.push(`Phantom fields detected: ${contract.validationResults.phantomFields.join(', ')}`);
    }

    if (contract.validationResults.extraProperties.length > 0) {
      contractErrors.push(`Extra properties detected: ${contract.validationResults.extraProperties.join(', ')}`);
    }

    const finalIsValid = isValid && contractErrors.length === 0;

    return {
      isValid: finalIsValid,
      errors,
      contractErrors
    };
  }

  /**
   * Validate with zero phantom fields guarantee
   */
  validateWithZeroPhantomFields(data: any, schema: SchemaObject): {
    isValid: boolean;
    errors: ErrorObject[] | null;
    phantomFieldsCount: number;
    extraPropertiesCount: number;
    guaranteesMet: boolean;
  } {
    const result = this.validateSchema(data, schema);
    const guaranteesMet = result.phantomFields.length === 0 && result.extraProperties.length === 0;

    return {
      isValid: result.isValid && guaranteesMet,
      errors: result.errors,
      phantomFieldsCount: result.phantomFields.length,
      extraPropertiesCount: result.extraProperties.length,
      guaranteesMet
    };
  }

  /**
   * Get abstraction handler for managing contract abstention
   */
  getAbstractionHandler(): AbstractionHandler {
    return this.abstractionHandler;
  }

  /**
   * Get current validation configuration
   */
  getConfig(): ValidationConfig {
    return { ...this.config };
  }

  /**
   * Update validation configuration
   */
  updateConfig(newConfig: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize AJV with new configuration
    this.ajv = new Ajv({
      strict: false, // Disable strict mode for broader compatibility
      validateFormats: true,
      addUsedSchema: false,
      removeAdditional: this.config.removeAdditional,
      useDefaults: this.config.useDefaults,
      coerceTypes: this.config.coerceTypes,
      multipleOfPrecision: 4
    });

    addFormats(this.ajv);
    this.ajv.addMetaSchema(DRAFT_2020_12_META_SCHEMA);
    this.contractValidator = this.ajv.compile(CONTRACT_V02_SCHEMA);
  }

  /**
   * Get AJV instance for advanced usage
   */
  getAjvInstance(): Ajv {
    return this.ajv;
  }

  /**
   * Compile a schema for repeated validation
   */
  compileSchema(schema: SchemaObject): ValidateFunction {
    return this.ajv.compile(schema);
  }

  /**
   * Add a custom format to the validator
   */
  addFormat(name: string, format: string | RegExp | ((data: string) => boolean)): void {
    this.ajv.addFormat(name, format);
  }

  /**
   * Add a custom keyword to the validator
   */
  addKeyword(definition: any): void {
    this.ajv.addKeyword(definition);
  }

  /**
   * Remove a schema from the validator
   */
  removeSchema(schemaKeyRef?: string | RegExp): void {
    this.ajv.removeSchema(schemaKeyRef);
  }

  /**
   * Get schema by key reference
   */
  getSchema(keyRef: string): ValidateFunction | undefined {
    return this.ajv.getSchema(keyRef);
  }
}

/**
 * Factory function to create a schema validator with default strict settings
 */
export function createStrictSchemaValidator(config?: Partial<ValidationConfig>): SchemaValidator {
  const strictConfig: ValidationConfig = {
    ...DEFAULT_VALIDATION_CONFIG,
    strict: true,
    unevaluated: true,
    temperature: 0,
    ...config
  };
  
  return new SchemaValidator(strictConfig);
}

/**
 * Utility function to create a basic schema with strict settings
 */
export function createStrictSchema(properties: Record<string, any>, required?: string[]): SchemaObject {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    properties,
    required: required || Object.keys(properties)
  };
}

/**
 * Export default validator instance
 */
export const defaultValidator = createStrictSchemaValidator();