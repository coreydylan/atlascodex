// Atlas Codex - Strategy Management Module
// Central module for extraction strategy testing and selection

const { StrategyTester } = require('./strategy-tester');
const { StrategySelector } = require('./strategy-selector');
const { FallbackChain } = require('./fallback-chain');

class StrategyManager {
  constructor(options = {}) {
    this.tester = new StrategyTester(options.tester);
    this.selector = new StrategySelector();
    this.fallbackChain = new FallbackChain(options.fallback);
    
    this.config = {
      enableTesting: options.enableTesting !== false,
      testSampleSize: options.testSampleSize || 3,
      cacheResults: options.cacheResults !== false,
      maxCostPerExtraction: options.maxCostPerExtraction || 1.00,
      ...options
    };
    
    this.cache = new Map();
  }

  /**
   * Main entry point - determine and execute optimal strategy
   */
  async extractWithOptimalStrategy(url, siteAnalysis, options = {}) {
    console.log(`📊 Determining optimal extraction strategy for ${url}`);
    
    const domain = new URL(url).hostname;
    
    // Check cache
    if (this.config.cacheResults) {
      const cached = this.getCachedStrategy(domain);
      if (cached && !this.isCacheStale(cached)) {
        console.log(`  Using cached strategy: ${cached.strategy.primary.id}`);
        return await this.executeStrategy(url, cached.strategy, options);
      }
    }
    
    // Select strategy based on analysis
    const selection = await this.selector.selectStrategy(siteAnalysis, {
      maxCost: options.maxCost || this.config.maxCostPerExtraction,
      preferredStrategy: options.preferredStrategy
    });
    
    // Run tests if enabled and confidence is low
    if (this.config.enableTesting && selection.confidence < 0.7) {
      console.log(`  Low confidence (${(selection.confidence * 100).toFixed(1)}%) - running tests`);
      const testResults = await this.runStrategyTests(url, siteAnalysis);
      
      // Update selection based on test results
      if (testResults.optimal) {
        selection.primary = {
          id: testResults.optimal.strategyId,
          reason: 'Selected based on test results'
        };
        selection.confidence = testResults.optimal.quality;
      }
    }
    
    // Cache the selection
    if (this.config.cacheResults) {
      this.cacheStrategy(domain, selection);
    }
    
    // Execute with fallback chain
    return await this.executeStrategy(url, selection, options);
  }

  /**
   * Run strategy tests on sample URLs
   */
  async runStrategyTests(url, siteAnalysis) {
    console.log(`🧪 Running strategy tests...`);
    
    // Test on the main URL
    const testResults = await this.tester.testAllStrategies(url);
    
    // If we have more URLs from the site, test those too
    if (siteAnalysis.sampleUrls && siteAnalysis.sampleUrls.length > 0) {
      const additionalTests = [];
      
      for (let i = 0; i < Math.min(this.config.testSampleSize - 1, siteAnalysis.sampleUrls.length); i++) {
        additionalTests.push(
          this.tester.testAllStrategies(siteAnalysis.sampleUrls[i])
        );
      }
      
      const additionalResults = await Promise.all(additionalTests);
      
      // Aggregate results
      testResults.aggregated = this.aggregateTestResults([testResults, ...additionalResults]);
    }
    
    return testResults;
  }

  /**
   * Execute strategy with fallback support
   */
  async executeStrategy(url, selection, options = {}) {
    console.log(`🚀 Executing strategy: ${selection.primary.id}`);
    
    // Determine fallback chain type
    const chainType = this.determineChainType(selection, options);
    
    // Execute with fallback chain
    const execution = await this.fallbackChain.execute(url, chainType, {
      primaryStrategy: selection.primary.id,
      fallbackStrategy: selection.fallback.id,
      emergencyFallback: options.emergencyFallback !== false,
      ...options
    });
    
    // Update performance metrics
    if (execution.success && execution.finalStrategy) {
      const framework = selection.siteProfile?.framework || 'unknown';
      this.selector.updatePerformance(
        framework,
        execution.finalStrategy,
        true,
        {
          time: execution.duration,
          cost: execution.totalCost
        }
      );
    }
    
    // Log execution summary
    console.log(`  ${execution.success ? '✅' : '❌'} Extraction ${execution.success ? 'succeeded' : 'failed'}`);
    console.log(`  Strategy: ${execution.finalStrategy || 'none'}`);
    console.log(`  Duration: ${execution.duration}ms`);
    console.log(`  Cost: $${execution.totalCost.toFixed(3)}`);
    console.log(`  Attempts: ${execution.attempts.length}`);
    
    return execution;
  }

  /**
   * Determine which fallback chain to use
   */
  determineChainType(selection, options) {
    // User preference
    if (options.chainType) {
      return options.chainType;
    }
    
    // Based on requirements
    if (options.prioritizeSpeed) {
      return 'fast';
    }
    
    if (options.prioritizeQuality) {
      return 'quality';
    }
    
    if (options.minimizeCost) {
      return 'cost_optimized';
    }
    
    // Based on confidence
    if (selection.confidence < 0.5) {
      return 'robust';
    }
    
    // Default
    return 'balanced';
  }

  /**
   * Aggregate test results from multiple URLs
   */
  aggregateTestResults(results) {
    const aggregated = {
      strategies: {},
      optimal: null
    };
    
    // Aggregate by strategy
    results.forEach(result => {
      result.strategies.forEach(strategy => {
        if (!aggregated.strategies[strategy.strategyId]) {
          aggregated.strategies[strategy.strategyId] = {
            strategyId: strategy.strategyId,
            name: strategy.name,
            tests: [],
            avgQuality: 0,
            avgTime: 0,
            avgCost: 0,
            successRate: 0
          };
        }
        
        aggregated.strategies[strategy.strategyId].tests.push(strategy);
      });
    });
    
    // Calculate averages
    Object.values(aggregated.strategies).forEach(strategy => {
      const successful = strategy.tests.filter(t => t.success);
      
      strategy.successRate = successful.length / strategy.tests.length;
      
      if (successful.length > 0) {
        strategy.avgQuality = successful.reduce((sum, t) => sum + t.quality, 0) / successful.length;
        strategy.avgTime = successful.reduce((sum, t) => sum + t.executionTime, 0) / successful.length;
        strategy.avgCost = successful.reduce((sum, t) => sum + t.cost, 0) / successful.length;
      }
    });
    
    // Select optimal
    const viableStrategies = Object.values(aggregated.strategies)
      .filter(s => s.successRate > 0.5 && s.avgQuality > 0.6);
    
    if (viableStrategies.length > 0) {
      // Score based on quality, cost, and time
      viableStrategies.forEach(s => {
        s.score = (s.avgQuality * 0.5) + 
                 ((1 - s.avgCost) * 0.3) + 
                 ((1 - s.avgTime / 30000) * 0.2);
      });
      
      aggregated.optimal = viableStrategies.reduce((best, current) => 
        current.score > best.score ? current : best
      );
    }
    
    return aggregated;
  }

  /**
   * Cache strategy selection
   */
  cacheStrategy(domain, selection) {
    this.cache.set(domain, {
      selection,
      timestamp: Date.now(),
      hits: 0
    });
  }

  /**
   * Get cached strategy
   */
  getCachedStrategy(domain) {
    const cached = this.cache.get(domain);
    if (cached) {
      cached.hits++;
      return {
        strategy: cached.selection,
        age: Date.now() - cached.timestamp,
        hits: cached.hits
      };
    }
    return null;
  }

  /**
   * Check if cache is stale
   */
  isCacheStale(cached) {
    // Cache expires after 24 hours
    const maxAge = 24 * 60 * 60 * 1000;
    return cached.age > maxAge;
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const report = {
      strategyTests: this.tester.strategies.size,
      selectionsMode: this.selector.selectionHistory.size,
      chainExecutions: this.fallbackChain.executionHistory.length,
      cachedDomains: this.cache.size,
      chains: {}
    };
    
    // Get chain statistics
    for (const [chainName] of this.fallbackChain.chains) {
      report.chains[chainName] = this.fallbackChain.getChainStats(chainName) || {
        executions: 0,
        successRate: 0
      };
    }
    
    return report;
  }

  /**
   * Optimize strategies based on performance
   */
  async optimizeStrategies() {
    console.log('🔧 Optimizing strategies based on performance data...');
    
    const optimizations = [];
    
    // Optimize each fallback chain
    for (const [chainName] of this.fallbackChain.chains) {
      const optimization = this.fallbackChain.optimizeChain(chainName);
      if (optimization) {
        optimizations.push(optimization);
      }
    }
    
    return {
      optimizations,
      report: this.getPerformanceReport()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.tester.cleanup();
  }
}

// Export all strategy components
module.exports = {
  StrategyManager,
  StrategyTester,
  StrategySelector,
  FallbackChain
};