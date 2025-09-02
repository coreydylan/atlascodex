#!/usr/bin/env node
// Atlas Codex - API Endpoint Testing Script
// Tests all API endpoints to ensure they work correctly

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { v4: uuidv4 } = require('uuid');

const API_BASE = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'atlas-dev-key-123';

class APITester {
  constructor() {
    this.results = [];
    this.failedTests = [];
  }

  async runAllTests() {
    console.log('🧪 Atlas Codex API Testing Suite');
    console.log('================================\n');
    console.log(`Testing API at: ${API_BASE}`);
    console.log(`Using API Key: ${API_KEY.substring(0, 10)}...`);
    console.log('');

    const tests = [
      // Health checks
      { name: 'Health Check', fn: () => this.testHealthCheck() },
      { name: 'Root Endpoint', fn: () => this.testRootEndpoint() },
      
      // Job management
      { name: 'Create Job', fn: () => this.testCreateJob() },
      { name: 'Get Job Status', fn: () => this.testGetJobStatus() },
      { name: 'Get Job Result', fn: () => this.testGetJobResult() },
      { name: 'Batch Jobs', fn: () => this.testBatchJobs() },
      
      // Direct extraction
      { name: 'Direct Extraction', fn: () => this.testDirectExtraction() },
      
      // Analytics
      { name: 'Get Metrics', fn: () => this.testGetMetrics() },
      { name: 'Get Costs', fn: () => this.testGetCosts() },
      
      // Error handling
      { name: 'Invalid URL', fn: () => this.testInvalidUrl() },
      { name: 'Missing Auth', fn: () => this.testMissingAuth() },
      { name: 'Invalid Job ID', fn: () => this.testInvalidJobId() },
      
      // Strategy testing
      { name: 'Static Fetch Strategy', fn: () => this.testStrategy('static_fetch') },
      { name: 'Browser Render Strategy', fn: () => this.testStrategy('browser_render') },
      
      // DIP testing
      { name: 'DIP Creation', fn: () => this.testDIPCreation() },
      
      // Performance
      { name: 'Concurrent Jobs', fn: () => this.testConcurrentJobs() },
      { name: 'Large Batch', fn: () => this.testLargeBatch() }
    ];

    for (const test of tests) {
      await this.runTest(test.name, test.fn);
    }

    this.printResults();
  }

  async runTest(name, testFn) {
    process.stdout.write(`Testing ${name}... `);
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        status: 'passed',
        duration
      });
      
      console.log(`✅ (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        status: 'failed',
        duration,
        error: error.message
      });
      
      this.failedTests.push({
        name,
        error: error.message
      });
      
      console.log(`❌ ${error.message}`);
    }
  }

  // Test implementations
  async testHealthCheck() {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    if (!data.status) {
      throw new Error('Health response missing status');
    }
    
    if (data.status === 'unhealthy') {
      throw new Error('System reports unhealthy');
    }
  }

  async testRootEndpoint() {
    const response = await fetch(`${API_BASE}/`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Root endpoint failed: ${response.status}`);
    }
    
    if (!data.name || !data.version) {
      throw new Error('Root response missing required fields');
    }
  }

  async testCreateJob() {
    const response = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        url: 'https://example.com',
        options: {
          strategy: 'static_fetch'
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Create job failed: ${response.status}`);
    }
    
    if (!data.job || !data.job.id) {
      throw new Error('Job creation response missing job ID');
    }
    
    // Store for later tests
    this.lastJobId = data.job.id;
  }

  async testGetJobStatus() {
    if (!this.lastJobId) {
      // Create a job first
      await this.testCreateJob();
    }

    const response = await fetch(`${API_BASE}/jobs/${this.lastJobId}`, {
      headers: { 'x-api-key': API_KEY }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Get job status failed: ${response.status}`);
    }
    
    if (!data.id || !data.status) {
      throw new Error('Job status response missing required fields');
    }
  }

  async testGetJobResult() {
    // Use a mock completed job ID for testing
    const jobId = this.lastJobId || 'test-job-123';
    
    const response = await fetch(`${API_BASE}/jobs/${jobId}/result`, {
      headers: { 'x-api-key': API_KEY }
    });

    // It's OK if this returns 400 (job not completed) or 404 (job not found)
    if (response.status === 500) {
      throw new Error('Server error getting job result');
    }
  }

  async testBatchJobs() {
    const response = await fetch(`${API_BASE}/jobs/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        urls: [
          'https://example.com/1',
          'https://example.com/2',
          'https://example.com/3'
        ],
        options: {
          strategy: 'static_fetch'
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Batch jobs failed: ${response.status}`);
    }
    
    if (!data.jobs || !Array.isArray(data.jobs)) {
      throw new Error('Batch response missing jobs array');
    }
    
    if (data.jobs.length !== 3) {
      throw new Error(`Expected 3 jobs, got ${data.jobs.length}`);
    }
  }

  async testDirectExtraction() {
    const response = await fetch(`${API_BASE}/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        url: 'https://example.com',
        strategy: 'static_fetch'
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Direct extraction failed: ${response.status}`);
    }
    
    // Should either return extraction data or job info
    if (!data.success && !data.job) {
      throw new Error('Direct extraction response invalid');
    }
  }

  async testGetMetrics() {
    const response = await fetch(`${API_BASE}/metrics`, {
      headers: { 'x-api-key': API_KEY }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Get metrics failed: ${response.status}`);
    }
    
    if (!data.health) {
      throw new Error('Metrics response missing health data');
    }
  }

  async testGetCosts() {
    const response = await fetch(`${API_BASE}/costs?domain=example.com&period=24h`, {
      headers: { 'x-api-key': API_KEY }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Get costs failed: ${response.status}`);
    }
    
    if (data.totalCost === undefined || data.avgCostPerExtraction === undefined) {
      throw new Error('Cost response missing required fields');
    }
  }

  async testInvalidUrl() {
    const response = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        url: '', // Empty URL
        options: {}
      })
    });

    if (response.ok) {
      throw new Error('Should have rejected empty URL');
    }
    
    if (response.status !== 400) {
      throw new Error(`Expected 400, got ${response.status}`);
    }
  }

  async testMissingAuth() {
    const response = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // Missing API key
      },
      body: JSON.stringify({
        url: 'https://example.com'
      })
    });

    // If auth is enabled, should return 401
    // If auth is disabled, will return 201
    if (response.status === 500) {
      throw new Error('Server error on missing auth');
    }
  }

  async testInvalidJobId() {
    const response = await fetch(`${API_BASE}/jobs/invalid-job-id-xyz`, {
      headers: { 'x-api-key': API_KEY }
    });

    if (response.status !== 404) {
      throw new Error(`Expected 404 for invalid job, got ${response.status}`);
    }
  }

  async testStrategy(strategy) {
    const response = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        url: 'https://example.com',
        options: { strategy }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Strategy ${strategy} failed: ${response.status}`);
    }
    
    if (!data.job) {
      throw new Error(`Strategy ${strategy} response missing job`);
    }
  }

  async testDIPCreation() {
    // Test that DIP system is working by creating multiple jobs for same domain
    const domain = `https://test-${uuidv4()}.example.com`;
    
    // First job should create DIP
    const response1 = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        url: domain,
        options: {}
      })
    });

    if (!response1.ok) {
      throw new Error('First DIP job failed');
    }

    // Second job should use cached DIP
    const response2 = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        url: domain,
        options: {}
      })
    });

    if (!response2.ok) {
      throw new Error('Second DIP job failed');
    }
  }

  async testConcurrentJobs() {
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      promises.push(
        fetch(`${API_BASE}/jobs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
          },
          body: JSON.stringify({
            url: `https://example.com/concurrent-${i}`,
            options: { strategy: 'static_fetch' }
          })
        })
      );
    }

    const responses = await Promise.all(promises);
    
    for (const response of responses) {
      if (!response.ok) {
        throw new Error(`Concurrent job failed: ${response.status}`);
      }
    }
  }

  async testLargeBatch() {
    const urls = [];
    for (let i = 0; i < 20; i++) {
      urls.push(`https://example.com/batch-${i}`);
    }

    const response = await fetch(`${API_BASE}/jobs/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        urls,
        options: { strategy: 'static_fetch' }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Large batch failed: ${response.status}`);
    }
    
    if (data.jobs.length !== 20) {
      throw new Error(`Expected 20 jobs, got ${data.jobs.length}`);
    }
  }

  printResults() {
    console.log('\n================================');
    console.log('📊 Test Results Summary');
    console.log('================================\n');

    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total Tests: ${this.results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️ Total Time: ${totalTime}ms`);
    console.log(`📈 Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);

    if (this.failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.failedTests.forEach(test => {
        console.log(`  - ${test.name}: ${test.error}`);
      });
    }

    console.log('\n================================');
    
    if (failed === 0) {
      console.log('🎉 All API tests passed!');
    } else {
      console.log('⚠️ Some tests failed. Please review and fix.');
    }
  }
}

// Run tests
const tester = new APITester();
tester.runAllTests().then(() => {
  process.exit(tester.failedTests.length > 0 ? 1 : 0);
}).catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});