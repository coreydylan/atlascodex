// Atlas Codex - Integration Test Suite
// Validates the complete DIP-integrated system

const { AtlasCodexWorker } = require('../worker');
const { DIPSystem } = require('../worker/dip');
const { ExtractionSystem } = require('../worker/extraction');
const { EvidenceLedgerService } = require('../core/src/evidence-ledger');
const { CostOptimizer } = require('../core/src/cost-optimizer');
const { MonitoringService } = require('../core/src/monitoring');

class IntegrationTest {
  constructor() {
    this.testResults = [];
    this.failedTests = [];
  }

  async runAllTests() {
    console.log('🧪 Atlas Codex Integration Test Suite');
    console.log('=====================================\n');

    const tests = [
      this.testDIPCreation,
      this.testExtractionStrategies,
      this.testEvidenceGeneration,
      this.testCostOptimization,
      this.testFullWorkflow,
      this.testFailureRecovery,
      this.testPerformance
    ];

    for (const test of tests) {
      await this.runTest(test.bind(this));
    }

    this.printResults();
  }

  async runTest(testFn) {
    const testName = testFn.name;
    console.log(`\n📝 Running: ${testName}`);
    
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name: testName,
        status: 'passed',
        duration
      });
      
      console.log(`  ✅ Passed (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name: testName,
        status: 'failed',
        duration,
        error: error.message
      });
      
      this.failedTests.push({
        name: testName,
        error
      });
      
      console.log(`  ❌ Failed: ${error.message}`);
    }
  }

  /**
   * Test DIP creation and management
   */
  async testDIPCreation() {
    const dipSystem = new DIPSystem({
      autoOptimize: false
    });

    try {
      // Test DIP creation for new domain
      const dip = await dipSystem.getDIPForExtraction('https://example.com');
      
      this.assert(dip.domain === 'example.com', 'DIP domain mismatch');
      this.assert(dip.strategy, 'DIP missing strategy');
      this.assert(dip.strategy.primary, 'DIP missing primary strategy');
      this.assert(dip.constraints, 'DIP missing constraints');
      
      // Test DIP caching
      const cachedDip = await dipSystem.getDIPForExtraction('https://example.com');
      this.assert(cachedDip.metadata.dipId === dip.metadata.dipId, 'DIP not cached');
      
      await dipSystem.shutdown();
    } finally {
      await dipSystem.shutdown();
    }
  }

  /**
   * Test extraction strategies
   */
  async testExtractionStrategies() {
    const extractionSystem = new ExtractionSystem({
      enableCaching: false
    });

    try {
      // Mock URL for testing
      const testUrl = 'https://example.com/test';
      
      // Test static fetch strategy
      const staticResult = await extractionSystem.extractWithStrategy(
        testUrl,
        'static_fetch'
      );
      this.assert(staticResult.status === 'success', 'Static fetch failed');
      
      // Test browser render strategy
      const browserResult = await extractionSystem.extractWithStrategy(
        testUrl,
        'browser_render'
      );
      this.assert(browserResult.status === 'success', 'Browser render failed');
      
      // Validate extraction quality
      const validation = extractionSystem.validateExtraction(staticResult);
      this.assert(validation.valid, 'Extraction validation failed');
      
    } finally {
      await extractionSystem.shutdown();
    }
  }

  /**
   * Test evidence generation and verification
   */
  async testEvidenceGeneration() {
    const evidenceLedger = new EvidenceLedgerService({
      secret: 'test-secret'
    });

    const testData = {
      title: 'Test Page',
      content: 'Test content',
      url: 'https://example.com'
    };

    // Create evidence
    const evidence = await evidenceLedger.createEvidence(
      'test-job-1',
      'https://example.com',
      testData,
      {
        strategy: 'static_fetch',
        duration: 1000
      }
    );

    this.assert(evidence.id, 'Evidence ID missing');
    this.assert(evidence.proof.hash, 'Evidence hash missing');
    this.assert(evidence.proof.signature, 'Evidence signature missing');
    
    // Verify evidence
    const verified = await evidenceLedger.verifyEvidence(evidence);
    this.assert(verified, 'Evidence verification failed');
  }

  /**
   * Test cost optimization
   */
  async testCostOptimization() {
    const costOptimizer = new CostOptimizer();

    // Track some costs
    costOptimizer.trackCost('example.com', 'static_fetch', {
      duration: 500
    });

    costOptimizer.trackCost('example.com', 'browser_render', {
      duration: 2000,
      browserTime: 2000
    });

    costOptimizer.trackCost('example.com', 'gpt5_direct', {
      duration: 1500,
      llmTokens: 1000
    });

    // Analyze costs
    const analysis = costOptimizer.analyzeCosts('example.com');
    
    this.assert(analysis.totalCost > 0, 'Cost tracking failed');
    this.assert(analysis.avgCostPerExtraction > 0, 'Average cost calculation failed');
    this.assert(analysis.llmUsagePercent >= 0, 'LLM usage calculation failed');
    
    // Test optimization
    const optimized = costOptimizer.optimizeStrategySelection(
      'example.com',
      ['static_fetch', 'browser_render', 'gpt5_direct'],
      0.7
    );
    
    this.assert(optimized, 'Strategy optimization failed');
    
    // Get cost report
    const report = costOptimizer.getCostReport();
    this.assert(report.totalCost > 0, 'Cost report generation failed');
  }

  /**
   * Test complete workflow
   */
  async testFullWorkflow() {
    const worker = new AtlasCodexWorker({
      enableEvidence: true,
      enableCostOptimization: true,
      maxConcurrent: 1
    });

    try {
      // Create a test job
      const job = {
        id: 'test-job-full',
        params: {
          url: 'https://example.com'
        }
      };

      // Process the job
      await worker.processJob(job);
      
      // Check stats
      this.assert(worker.stats.processed > 0, 'Job not processed');
      this.assert(worker.stats.succeeded > 0, 'Job not successful');
      
      // Get health status
      const health = worker.getHealth();
      this.assert(health.status === 'running', 'Worker not healthy');
      
    } finally {
      await worker.shutdown();
    }
  }

  /**
   * Test failure recovery
   */
  async testFailureRecovery() {
    const extractionSystem = new ExtractionSystem();

    try {
      // Test with invalid URL
      const result = await extractionSystem.extract('invalid-url');
      
      this.assert(result.status === 'failed', 'Should have failed for invalid URL');
      this.assert(result.errors.length > 0, 'Should have error details');
      
      // Test fallback mechanism
      const fallbackTest = await extractionSystem.extract('https://nonexistent.example');
      this.assert(fallbackTest, 'Fallback should provide result');
      
    } finally {
      await extractionSystem.shutdown();
    }
  }

  /**
   * Test performance metrics
   */
  async testPerformance() {
    const monitoring = new MonitoringService();

    // Record some metrics
    monitoring.recordMetric('test_metric', 100, 'ms');
    monitoring.recordRequest(true, 150);
    monitoring.recordRequest(false, 5000);

    // Get system health
    const health = monitoring.getSystemHealth();
    
    this.assert(health.status, 'Health status missing');
    this.assert(health.metrics, 'Metrics missing');
    this.assert(health.metrics.errorRate >= 0, 'Error rate calculation failed');
    
    // Get dashboard data
    const dashboard = monitoring.getDashboardData();
    this.assert(dashboard.health, 'Dashboard health missing');
    this.assert(dashboard.metrics, 'Dashboard metrics missing');
    
    // Check for alerts
    monitoring.createAlert('warning', 'test', 'Test alert');
    const alerts = health.alerts;
    this.assert(Array.isArray(alerts), 'Alerts not tracked');
  }

  /**
   * Helper: Assert condition
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n=====================================');
    console.log('📊 Test Results Summary');
    console.log('=====================================\n');

    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const totalTime = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️ Total Time: ${totalTime}ms`);
    console.log(`📈 Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);

    if (this.failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.failedTests.forEach(test => {
        console.log(`  - ${test.name}: ${test.error.message}`);
      });
    }

    console.log('\n=====================================');
    
    if (failed === 0) {
      console.log('🎉 All tests passed! System ready for production.');
    } else {
      console.log('⚠️ Some tests failed. Please review and fix issues.');
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  const tester = new IntegrationTest();
  
  tester.runAllTests().then(() => {
    process.exit(tester.failedTests.length > 0 ? 1 : 0);
  }).catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { IntegrationTest };