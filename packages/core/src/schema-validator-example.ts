/**
 * Example usage of the JSON Schema Draft 2020-12 Validation System
 * This file demonstrates the comprehensive validation capabilities
 */

import {
  SchemaValidator,
  createStrictSchemaValidator,
  createStrictSchema,
  EnhancedContract,
  ValidationConfig,
  CONTRACT_V02_SCHEMA,
  DEFAULT_VALIDATION_CONFIG
} from './schema-validator';

/**
 * Example 1: Basic schema validation with phantom field detection
 */
export function exampleBasicValidation() {
  console.log('=== Example 1: Basic Schema Validation ===');
  
  const validator = createStrictSchemaValidator();
  
  // Create a strict schema
  const userSchema = createStrictSchema({
    name: { type: 'string' },
    age: { type: 'number', minimum: 0 },
    email: { type: 'string', format: 'email' },
    profile: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bio: { type: 'string' },
        website: { type: 'string', format: 'uri' }
      }
    }
  }, ['name', 'age']);
  
  // Valid data
  const validUser = {
    name: 'Alice Smith',
    age: 30,
    email: 'alice@example.com',
    profile: {
      bio: 'Software engineer',
      website: 'https://alice.dev'
    }
  };
  
  // Invalid data with phantom fields
  const invalidUser = {
    name: 'Bob Jones',
    age: 25,
    email: 'bob@example.com',
    profile: {
      bio: 'Designer',
      website: 'https://bob.design',
      socialMedia: 'twitter.com/bob' // This is a phantom field!
    },
    extraField: 'not allowed' // This is also a phantom field!
  };
  
  const validResult = validator.validateSchema(validUser, userSchema);
  const invalidResult = validator.validateSchema(invalidUser, userSchema);
  
  console.log('Valid user result:', {
    isValid: validResult.isValid,
    phantomFields: validResult.phantomFields,
    extraProperties: validResult.extraProperties
  });
  
  console.log('Invalid user result:', {
    isValid: invalidResult.isValid,
    phantomFields: invalidResult.phantomFields,
    extraProperties: invalidResult.extraProperties
  });
  
  return { validResult, invalidResult };
}

/**
 * Example 2: Enhanced contract creation with deterministic metadata
 */
export function exampleEnhancedContract() {
  console.log('\n=== Example 2: Enhanced Contract Creation ===');
  
  const validator = createStrictSchemaValidator({
    seed: 12345, // Custom deterministic seed
    temperature: 0 // Ensures deterministic behavior
  });
  
  const productSchema = createStrictSchema({
    id: { type: 'string' },
    name: { type: 'string' },
    price: { type: 'number', minimum: 0 },
    category: { type: 'string', enum: ['electronics', 'clothing', 'books'] },
    inStock: { type: 'boolean' }
  }, ['id', 'name', 'price']);
  
  const productData = {
    id: 'prod-001',
    name: 'Wireless Headphones',
    price: 99.99,
    category: 'electronics',
    inStock: true
  };
  
  const contract = validator.createEnhancedContract(productData, productSchema);
  
  console.log('Contract metadata:', contract.metadata);
  console.log('Contract validation:', contract.validationResults);
  
  // Validate the contract itself against the V02 schema
  const contractValidation = validator.validateContract(contract);
  console.log('Contract validation result:', contractValidation);
  
  return contract;
}

/**
 * Example 3: Zero phantom fields guarantee
 */
export function exampleZeroPhantomGuarantee() {
  console.log('\n=== Example 3: Zero Phantom Fields Guarantee ===');
  
  const validator = createStrictSchemaValidator();
  
  const orderSchema = createStrictSchema({
    orderId: { type: 'string' },
    customerId: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'number', minimum: 1 },
          price: { type: 'number', minimum: 0 }
        },
        required: ['productId', 'quantity', 'price']
      }
    },
    total: { type: 'number', minimum: 0 }
  }, ['orderId', 'customerId', 'items', 'total']);
  
  const cleanOrder = {
    orderId: 'order-123',
    customerId: 'cust-456',
    items: [
      { productId: 'prod-001', quantity: 2, price: 99.99 },
      { productId: 'prod-002', quantity: 1, price: 49.99 }
    ],
    total: 249.97
  };
  
  const dirtyOrder = {
    orderId: 'order-124',
    customerId: 'cust-457',
    items: [
      { 
        productId: 'prod-003', 
        quantity: 1, 
        price: 79.99,
        discount: 10 // Phantom field in item!
      }
    ],
    total: 79.99,
    notes: 'Rush delivery' // Phantom field at root level!
  };
  
  const cleanResult = validator.validateWithZeroPhantomFields(cleanOrder, orderSchema);
  const dirtyResult = validator.validateWithZeroPhantomFields(dirtyOrder, orderSchema);
  
  console.log('Clean order (zero phantom guarantee):', {
    isValid: cleanResult.isValid,
    guaranteesMet: cleanResult.guaranteesMet,
    phantomFieldsCount: cleanResult.phantomFieldsCount
  });
  
  console.log('Dirty order (phantom fields detected):', {
    isValid: dirtyResult.isValid,
    guaranteesMet: dirtyResult.guaranteesMet,
    phantomFieldsCount: dirtyResult.phantomFieldsCount
  });
  
  return { cleanResult, dirtyResult };
}

/**
 * Example 4: Abstraction handler for contract abstention
 */
export function exampleAbstractionHandler() {
  console.log('\n=== Example 4: Abstraction Handler ===');
  
  const validator = createStrictSchemaValidator();
  const abstractionHandler = validator.getAbstractionHandler();
  
  // Register abstention for specific schemas
  abstractionHandler.registerAbstention(
    'sensitive-data-schema',
    'Data contains sensitive information - validation abstained for security',
    () => console.log('Abstention callback executed for sensitive data')
  );
  
  const sensitiveSchema = createStrictSchema({
    username: { type: 'string' },
    password: { type: 'string' },
    ssn: { type: 'string' }
  });
  sensitiveSchema.$id = 'sensitive-data-schema';
  
  const sensitiveData = {
    username: 'user123',
    password: 'secret123',
    ssn: '123-45-6789'
  };
  
  const result = validator.validateSchema(sensitiveData, sensitiveSchema);
  
  console.log('Sensitive data validation result:', {
    isValid: result.isValid,
    abstained: result.errors?.[0]?.keyword === 'abstention',
    message: result.errors?.[0]?.message
  });
  
  // Clear abstentions
  abstractionHandler.clearAbstentions();
  
  return result;
}

/**
 * Example 5: Custom validation configuration
 */
export function exampleCustomConfiguration() {
  console.log('\n=== Example 5: Custom Validation Configuration ===');
  
  const customConfig: Partial<ValidationConfig> = {
    strict: true,
    removeAdditional: true, // Remove phantom fields instead of just detecting them
    useDefaults: true,
    coerceTypes: false,
    seed: 99999,
    temperature: 0
  };
  
  const validator = createStrictSchemaValidator(customConfig);
  
  const configSchema = createStrictSchema({
    name: { type: 'string', default: 'Anonymous' },
    age: { type: 'number', minimum: 0 },
    active: { type: 'boolean', default: true }
  }, ['age']);
  
  const incompleteData = {
    age: 25,
    extraField: 'will be removed'
  };
  
  const result = validator.validateSchema(incompleteData, configSchema);
  
  console.log('Custom config validation:', {
    isValid: result.isValid,
    phantomFields: result.phantomFields,
    config: validator.getConfig()
  });
  
  return result;
}

/**
 * Run all examples
 */
export function runAllExamples() {
  console.log('🚀 JSON Schema Draft 2020-12 Validation System Examples\n');
  
  exampleBasicValidation();
  exampleEnhancedContract();
  exampleZeroPhantomGuarantee();
  exampleAbstractionHandler();
  exampleCustomConfiguration();
  
  console.log('\n✅ All examples completed successfully!');
  console.log('\n📋 Key Features Demonstrated:');
  console.log('- Strict JSON Schema validation with phantom field detection');
  console.log('- Enhanced contracts with reproducibility metadata');
  console.log('- Zero phantom fields guarantee with comprehensive checking');
  console.log('- Abstraction handler for contract abstention scenarios');
  console.log('- Custom validation configurations with deterministic behavior');
  console.log('- Full compliance with production requirements');
}

// Export individual examples for testing
export default {
  exampleBasicValidation,
  exampleEnhancedContract,
  exampleZeroPhantomGuarantee,
  exampleAbstractionHandler,
  exampleCustomConfiguration,
  runAllExamples
};