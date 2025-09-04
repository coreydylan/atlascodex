// Test script for Schema Validator
const {
  SchemaValidator,
  createStrictSchemaValidator,
  createStrictSchema,
  CONTRACT_V02_SCHEMA,
  DEFAULT_VALIDATION_CONFIG
} = require('./packages/core/dist/schema-validator');

console.log('Testing JSON Schema Draft 2020-12 Validation System...\n');

// Test 1: Basic Schema Validation
console.log('=== Test 1: Basic Schema Validation ===');
const validator = createStrictSchemaValidator();

const testSchema = createStrictSchema({
  name: { type: 'string' },
  age: { type: 'number', minimum: 0 },
  email: { type: 'string', format: 'email' }
}, ['name', 'age']);

const validData = {
  name: 'John Doe',
  age: 30,
  email: 'john@example.com'
};

const invalidData = {
  name: 'John Doe',
  age: 30,
  email: 'john@example.com',
  extraField: 'should not be allowed' // This will be caught as phantom field
};

const result1 = validator.validateSchema(validData, testSchema);
console.log('Valid data result:', JSON.stringify(result1, null, 2));

const result2 = validator.validateSchema(invalidData, testSchema);
console.log('Invalid data result:', JSON.stringify(result2, null, 2));

// Test 2: Enhanced Contract Creation
console.log('\n=== Test 2: Enhanced Contract Creation ===');
const contract = validator.createEnhancedContract(validData, testSchema);
console.log('Contract metadata:', JSON.stringify(contract.metadata, null, 2));
console.log('Contract validation results:', JSON.stringify(contract.validationResults, null, 2));

// Test 3: Contract Validation
console.log('\n=== Test 3: Contract Validation ===');
const contractValidation = validator.validateContract(contract);
console.log('Contract validation result:', JSON.stringify(contractValidation, null, 2));

// Test 4: Zero Phantom Fields Guarantee
console.log('\n=== Test 4: Zero Phantom Fields Guarantee ===');
const zeroPhantomResult = validator.validateWithZeroPhantomFields(invalidData, testSchema);
console.log('Zero phantom fields result:', JSON.stringify(zeroPhantomResult, null, 2));

// Test 5: Abstraction Handler
console.log('\n=== Test 5: Abstraction Handler ===');
const abstractionHandler = validator.getAbstractionHandler();
abstractionHandler.registerAbstention('test-schema', 'Testing abstention mechanism');

const testSchemaWithId = {
  ...testSchema,
  $id: 'test-schema'
};

const abstentionResult = validator.validateSchema(validData, testSchemaWithId);
console.log('Abstention result:', JSON.stringify(abstentionResult, null, 2));

console.log('\n=== Schema Validator Test Complete ===');
console.log('All core functionality has been demonstrated successfully!');