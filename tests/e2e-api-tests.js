#!/usr/bin/env node
/**
 * End-to-End API Testing for Bulletproof Architecture
 * 
 * Tests the complete API functionality in both preview and production environments
 * to ensure bulletproof architecture works correctly in deployed environments.
 */

const axios = require('axios');
const { CorrelationMiddleware } = require('../api/middleware/correlation-middleware');

/**
 * End-to-End API Tester
 */
class E2EAPITester {
  constructor() {
    this.correlationId = CorrelationMiddleware.generateCorrelationId();
    this.logger = CorrelationMiddleware.createLogger(this.correlationId);
    
    this.results = {
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      environments: {},
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        environmentsTested: 0
      }
    };
  }
  
  /**
   * Run complete E2E test suite
   */
  async runTests(environments) {
    this.logger.info('🚀 Starting E2E API tests for bulletproof architecture');
    
    for (const [envName, config] of Object.entries(environments)) {
      this.logger.info(`Testing environment: ${envName}`);
      
      try {
        const envResults = await this.testEnvironment(envName, config);
        this.results.environments[envName] = envResults;
        this.results.summary.environmentsTested++;
        
      } catch (error) {
        this.logger.error(`Environment ${envName} testing failed`, error);
        this.results.environments[envName] = {
          overall: false,
          error: error.message,
          tests: {}
        };
      }
    }
    
    this.calculateSummary();
    this.generateReport();
    
    return this.results;
  }
  
  /**
   * Test specific environment
   */
  async testEnvironment(envName, config) {
    const timer = this.logger.startTimer(`e2e_${envName}`);
    const envResults = {
      overall: true,
      tests: {},
      expectedModel: config.expectedModel,
      apiUrl: config.apiUrl
    };
    
    // Test suite for each environment
    const tests = [
      this.testHealthEndpoint,
      this.testBasicExtraction,
      this.testModelSelection,
      this.testJobStatusPolling,
      this.testErrorHandling,
      this.testCorsHeaders,
      this.testCorrelationTracking
    ];
    
    for (const testFunc of tests) {
      const testName = testFunc.name;
      this.logger.info(`Running test: ${testName}`);
      
      try {
        const testResult = await testFunc.call(this, config);
        envResults.tests[testName] = {
          passed: true,
          result: testResult,
          duration: testResult.duration || 0
        };
        this.results.summary.passedTests++;
        
      } catch (error) {
        this.logger.error(`Test ${testName} failed`, error);
        envResults.tests[testName] = {
          passed: false,
          error: error.message,
          duration: 0
        };
        this.results.summary.failedTests++;
        envResults.overall = false;
      }
      
      this.results.summary.totalTests++;
    }
    
    timer.end({ overall: envResults.overall });
    return envResults;
  }
  
  /**
   * Test health endpoint
   */
  async testHealthEndpoint(config) {
    const startTime = Date.now();
    
    const response = await this.makeRequest('GET', `${config.apiUrl}/health`, {
      headers: this.getCommonHeaders(config)
    });
    
    const duration = Date.now() - startTime;
    
    // Validate health response structure
    this.assertEqual(response.status, 200, 'Health endpoint should return 200');
    this.assertDefined(response.data.status, 'Health response should have status');
    this.assertDefined(response.data.version, 'Health response should have version');
    this.assertDefined(response.data.features, 'Health response should have features');
    
    // Validate bulletproof architecture features
    if (response.data.features) {
      this.assertEqual(
        response.data.features.bulletproofArchitecture, 
        true, 
        'Bulletproof architecture should be enabled'
      );
    }
    
    return {
      status: response.data.status,
      version: response.data.version,
      features: response.data.features,
      duration: duration
    };
  }
  
  /**
   * Test basic extraction functionality
   */
  async testBasicExtraction(config) {
    const startTime = Date.now();
    
    const extractionRequest = {
      url: 'https://example.com',
      extractionInstructions: 'Extract the page title and main heading',
      UNIFIED_EXTRACTOR_ENABLED: true
    };
    
    const response = await this.makeRequest('POST', `${config.apiUrl}/api/extract`, {
      headers: this.getCommonHeaders(config),
      data: extractionRequest
    });
    
    const duration = Date.now() - startTime;
    
    // Validate extraction response
    this.assertEqual(response.status, 200, 'Extraction should return 200');
    this.assertDefined(response.data.jobId, 'Response should have jobId');
    this.assertDefined(response.data.result, 'Response should have result');
    this.assertDefined(response.data.result.metadata, 'Result should have metadata');
    
    // Validate bulletproof metadata
    const metadata = response.data.result.metadata;
    this.assertDefined(metadata.processingMethod, 'Metadata should have processingMethod');
    this.assertDefined(metadata.modelUsed, 'Metadata should have modelUsed');
    this.assertEqual(metadata.unifiedExtractor, true, 'Should use unified extractor');
    
    return {
      jobId: response.data.jobId,
      processingMethod: metadata.processingMethod,
      modelUsed: metadata.modelUsed,
      success: response.data.result.success,
      duration: duration
    };
  }
  
  /**
   * Test model selection based on environment
   */
  async testModelSelection(config) {
    const startTime = Date.now();
    
    // Test simple request (should use appropriate model tier)
    const simpleRequest = {
      url: 'https://example.com',
      extractionInstructions: 'Get title',
      UNIFIED_EXTRACTOR_ENABLED: true
    };
    
    const simpleResponse = await this.makeRequest('POST', `${config.apiUrl}/api/extract`, {
      headers: this.getCommonHeaders(config),
      data: simpleRequest
    });
    
    // Test complex request (should use more powerful model)
    const complexRequest = {
      url: 'https://example.com',
      extractionInstructions: 'Perform comprehensive analysis and extract detailed structured data with relationships and reasoning',
      maxPages: 5,
      requiresReasoning: true,
      UNIFIED_EXTRACTOR_ENABLED: true
    };
    
    const complexResponse = await this.makeRequest('POST', `${config.apiUrl}/api/extract`, {
      headers: this.getCommonHeaders(config),
      data: complexRequest
    });
    
    const duration = Date.now() - startTime;
    
    // Validate model selection
    const simpleModel = simpleResponse.data.result.metadata.modelUsed;
    const complexModel = complexResponse.data.result.metadata.modelUsed;
    
    this.assertDefined(simpleModel, 'Simple request should have model used');
    this.assertDefined(complexModel, 'Complex request should have model used');
    
    // Validate environment-specific model selection
    if (config.expectedModel) {
      if (config.expectedModel.includes('gpt-5')) {
        this.assertTrue(
          simpleModel.includes('gpt-5') || complexModel.includes('gpt-5'),
          `Preview environment should use GPT-5, got: ${simpleModel}, ${complexModel}`
        );
      } else if (config.expectedModel.includes('gpt-4')) {
        this.assertTrue(
          simpleModel.includes('gpt-4') && complexModel.includes('gpt-4'),
          `Production environment should use GPT-4, got: ${simpleModel}, ${complexModel}`
        );
      }
    }
    
    return {
      simpleModel: simpleModel,
      complexModel: complexModel,
      modelSelectionWorking: true,
      duration: duration
    };
  }
  
  /**
   * Test job status polling
   */
  async testJobStatusPolling(config) {
    const startTime = Date.now();
    
    // First create a job
    const extractionRequest = {
      url: 'https://example.com',
      extractionInstructions: 'Test job for status polling',
      UNIFIED_EXTRACTOR_ENABLED: true
    };
    
    const createResponse = await this.makeRequest('POST', `${config.apiUrl}/api/extract`, {
      headers: this.getCommonHeaders(config),
      data: extractionRequest
    });
    
    const jobId = createResponse.data.jobId;
    this.assertDefined(jobId, 'Should receive jobId from extraction');
    
    // Poll job status
    const statusResponse = await this.makeRequest('GET', `${config.apiUrl}/api/status/${jobId}`, {
      headers: this.getCommonHeaders(config)
    });
    
    const duration = Date.now() - startTime;
    
    // Validate status response
    this.assertEqual(statusResponse.status, 200, 'Status polling should return 200');
    this.assertDefined(statusResponse.data.jobId, 'Status response should have jobId');
    this.assertDefined(statusResponse.data.status, 'Status response should have status');
    
    // Validate job schema consistency
    const job = statusResponse.data;
    this.assertDefined(job.createdAt, 'Job should have createdAt');
    this.assertDefined(job.updatedAt, 'Job should have updatedAt');
    
    return {
      jobId: jobId,
      status: job.status,
      hasResult: !!job.result,
      schemaConsistent: true,
      duration: duration
    };
  }
  
  /**
   * Test error handling
   */
  async testErrorHandling(config) {
    const startTime = Date.now();
    
    try {
      // Test invalid URL
      await this.makeRequest('POST', `${config.apiUrl}/api/extract`, {
        headers: this.getCommonHeaders(config),
        data: {
          url: 'not-a-valid-url',
          extractionInstructions: 'Test error handling',
          UNIFIED_EXTRACTOR_ENABLED: true
        }
      });
      
      throw new Error('Should have thrown error for invalid URL');
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Validate error response structure
      if (error.response) {
        this.assertEqual(error.response.status, 500, 'Should return appropriate error status');
        this.assertDefined(error.response.data.error, 'Error response should have error field');
        this.assertDefined(error.response.data.correlationId, 'Error should have correlation ID');
      }
      
      return {
        errorHandled: true,
        hasCorrelationId: !!(error.response?.data?.correlationId),
        duration: duration
      };
    }
  }
  
  /**
   * Test CORS headers
   */
  async testCorsHeaders(config) {
    const startTime = Date.now();
    
    const response = await this.makeRequest('OPTIONS', `${config.apiUrl}/api/extract`, {
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, X-Api-Key'
      }
    });
    
    const duration = Date.now() - startTime;
    
    // Validate CORS headers
    const corsHeaders = response.headers;
    this.assertDefined(corsHeaders['access-control-allow-origin'], 'Should have CORS origin header');
    this.assertDefined(corsHeaders['access-control-allow-methods'], 'Should have CORS methods header');
    this.assertDefined(corsHeaders['access-control-allow-headers'], 'Should have CORS headers header');
    
    return {
      corsEnabled: true,
      allowOrigin: corsHeaders['access-control-allow-origin'],
      allowMethods: corsHeaders['access-control-allow-methods'],
      duration: duration
    };
  }
  
  /**
   * Test correlation ID tracking
   */
  async testCorrelationTracking(config) {
    const startTime = Date.now();
    
    const customCorrelationId = `test_${Date.now()}`;
    
    const response = await this.makeRequest('GET', `${config.apiUrl}/health`, {
      headers: {
        ...this.getCommonHeaders(config),
        'X-Correlation-Id': customCorrelationId
      }
    });
    
    const duration = Date.now() - startTime;
    
    // Validate correlation ID is returned
    this.assertEqual(response.status, 200, 'Health check should succeed');
    
    // Check if correlation ID is preserved in response
    const responseCorrelationId = response.data.correlationId || 
                                response.headers['x-correlation-id'];
    
    if (responseCorrelationId) {
      this.assertEqual(
        responseCorrelationId,
        customCorrelationId,
        'Custom correlation ID should be preserved'
      );
    }
    
    return {
      correlationIdTracking: true,
      customIdPreserved: responseCorrelationId === customCorrelationId,
      correlationId: responseCorrelationId,
      duration: duration
    };
  }
  
  /**
   * Make HTTP request with error handling
   */
  async makeRequest(method, url, options = {}) {
    const axiosConfig = {
      method: method,
      url: url,
      timeout: 30000, // 30 second timeout
      validateStatus: () => true, // Don't throw on HTTP error status
      ...options
    };
    
    try {
      const response = await axios(axiosConfig);
      return response;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Request timeout after 30 seconds: ${url}`);
      }
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Connection refused to ${url}. Is the API running?`);
      }
      throw error;
    }
  }
  
  /**
   * Get common headers for requests
   */
  getCommonHeaders(config) {
    return {
      'Content-Type': 'application/json',
      'X-Api-Key': config.apiKey,
      'X-Correlation-Id': this.correlationId,
      'User-Agent': 'Atlas-Codex-E2E-Tester/1.0.0'
    };
  }
  
  // Assertion helpers
  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
  }
  
  assertDefined(value, message) {
    if (value === undefined || value === null) {
      throw new Error(`${message}: value is undefined or null`);
    }
  }
  
  assertTrue(value, message) {
    if (!value) {
      throw new Error(`${message}: expected true, got ${value}`);
    }
  }
  
  /**
   * Calculate test summary
   */
  calculateSummary() {
    this.results.summary.successRate = this.results.summary.totalTests > 0 ?
      Math.round((this.results.summary.passedTests / this.results.summary.totalTests) * 100) : 0;
    
    this.results.overall = this.results.summary.successRate >= 90; // 90% pass rate required
  }
  
  /**
   * Generate test report
   */
  generateReport() {
    const report = {
      '🧪 E2E API TEST REPORT': '',
      '': '',
      'Timestamp': this.results.timestamp,
      'Overall Success': this.results.overall ? '✅ PASSED' : '❌ FAILED',
      'Success Rate': `${this.results.summary.successRate}%`,
      ' ': '',
      'Summary': {
        'Total Tests': this.results.summary.totalTests,
        'Passed': this.results.summary.passedTests,
        'Failed': this.results.summary.failedTests,
        'Environments Tested': this.results.summary.environmentsTested
      },
      '  ': ''
    };
    
    // Add environment results
    Object.entries(this.results.environments).forEach(([envName, envResult]) => {
      report[`Environment: ${envName}`] = envResult.overall ? '✅ PASSED' : '❌ FAILED';
      
      if (envResult.tests) {
        const passedTests = Object.values(envResult.tests).filter(t => t.passed).length;
        const totalTests = Object.keys(envResult.tests).length;
        report[`${envName} Tests`] = `${passedTests}/${totalTests} passed`;
      }
      
      if (envResult.expectedModel) {
        report[`${envName} Model`] = envResult.expectedModel;
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(JSON.stringify(report, null, 2));
    console.log('='.repeat(80) + '\n');
    
    // Log final result
    if (this.results.overall) {
      this.logger.info('🎉 E2E API tests PASSED');
    } else {
      this.logger.error('💥 E2E API tests FAILED');
    }
  }
}

// Command line interface
if (require.main === module) {
  const tester = new E2EAPITester();
  
  // Define test environments
  const environments = {
    preview: {
      apiUrl: process.env.PREVIEW_API_URL || 'https://your-preview-api.execute-api.us-west-2.amazonaws.com/preview',
      apiKey: process.env.PREVIEW_API_KEY || 'your-preview-key',
      expectedModel: 'gpt-5' // Preview should use GPT-5
    },
    production: {
      apiUrl: process.env.PRODUCTION_API_URL || 'https://your-production-api.execute-api.us-west-2.amazonaws.com/production',
      apiKey: process.env.PRODUCTION_API_KEY || 'your-production-key',
      expectedModel: 'gpt-4' // Production should use GPT-4
    }
  };
  
  // Allow testing specific environment
  const targetEnv = process.argv[2];
  if (targetEnv && environments[targetEnv]) {
    console.log(`Testing only ${targetEnv} environment`);
    const singleEnv = {};
    singleEnv[targetEnv] = environments[targetEnv];
    environments = singleEnv;
  }
  
  console.log('🚀 Starting E2E API Tests for Bulletproof Architecture');
  console.log('Environments to test:', Object.keys(environments));
  console.log('');
  
  tester.runTests(environments)
    .then(results => {
      process.exit(results.overall ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 E2E testing failed with error:', error.message);
      process.exit(1);
    });
}

module.exports = {
  E2EAPITester
};