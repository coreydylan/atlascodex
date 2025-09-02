// Atlas Codex - Fallback Chain Execution
// Manages cascading fallback strategies for robust extraction

class FallbackChain {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 2000;
    this.timeout = options.timeout || 30000;
    this.chains = new Map();
    this.executionHistory = [];
    
    // Define default fallback chains
    this.defineDefaultChains();
  }

  /**
   * Define default fallback chains for different scenarios
   */
  defineDefaultChains() {
    // Fast chain - prioritize speed
    this.defineChain('fast', [
      { strategy: 'static_fetch', timeout: 5000 },
      { strategy: 'browser_render', timeout: 10000 },
      { strategy: 'hybrid_smart', timeout: 15000 }
    ]);

    // Quality chain - prioritize extraction quality
    this.defineChain('quality', [
      { strategy: 'browser_js', timeout: 15000 },
      { strategy: 'gpt5_direct', timeout: 20000 },
      { strategy: 'gpt5_reasoning', timeout: 25000 }
    ]);

    // Balanced chain - balance speed and quality
    this.defineChain('balanced', [
      { strategy: 'browser_render', timeout: 10000 },
      { strategy: 'browser_js', timeout: 15000 },
      { strategy: 'gpt5_direct', timeout: 20000 }
    ]);

    // Cost-optimized chain - minimize costs
    this.defineChain('cost_optimized', [
      { strategy: 'static_fetch', timeout: 5000 },
      { strategy: 'browser_render', timeout: 12000 },
      { strategy: 'browser_js', timeout: 18000 }
    ]);

    // Robust chain - maximum reliability
    this.defineChain('robust', [
      { strategy: 'hybrid_smart', timeout: 15000 },
      { strategy: 'gpt5_direct', timeout: 20000 },
      { strategy: 'gpt5_reasoning', timeout: 30000 }
    ]);
  }

  /**
   * Define a custom fallback chain
   */
  defineChain(name, strategies) {
    this.chains.set(name, {
      name,
      strategies,
      created: new Date().toISOString()
    });
  }

  /**
   * Execute extraction with fallback chain
   */
  async execute(url, chainName = 'balanced', options = {}) {
    console.log(`⛓️ Executing fallback chain: ${chainName} for ${url}`);
    
    const chain = this.chains.get(chainName);
    if (!chain) {
      throw new Error(`Fallback chain '${chainName}' not found`);
    }

    const execution = {
      url,
      chainName,
      startTime: Date.now(),
      attempts: [],
      result: null,
      success: false,
      totalCost: 0,
      finalStrategy: null
    };

    // Try each strategy in the chain
    for (let i = 0; i < chain.strategies.length; i++) {
      const strategyConfig = chain.strategies[i];
      const attempt = {
        strategy: strategyConfig.strategy,
        index: i,
        startTime: Date.now(),
        success: false,
        error: null,
        data: null,
        cost: 0
      };

      console.log(`  Attempt ${i + 1}/${chain.strategies.length}: ${strategyConfig.strategy}`);

      try {
        // Execute strategy with timeout
        const result = await this.executeStrategy(
          url, 
          strategyConfig.strategy,
          {
            ...options,
            timeout: strategyConfig.timeout || this.timeout
          }
        );

        // Validate result
        if (this.validateResult(result)) {
          attempt.success = true;
          attempt.data = result;
          attempt.cost = this.calculateCost(strategyConfig.strategy);
          execution.totalCost += attempt.cost;
          execution.attempts.push(attempt);
          execution.result = result;
          execution.success = true;
          execution.finalStrategy = strategyConfig.strategy;
          
          console.log(`    ✅ Success with ${strategyConfig.strategy}`);
          break;
        } else {
          attempt.error = 'Result validation failed';
          console.log(`    ⚠️ Invalid result from ${strategyConfig.strategy}`);
        }

      } catch (error) {
        attempt.error = error.message;
        attempt.cost = this.calculateCost(strategyConfig.strategy, true);
        execution.totalCost += attempt.cost;
        console.log(`    ❌ Failed: ${error.message}`);

        // Check if we should retry this strategy
        if (this.shouldRetry(error, i, chain.strategies.length)) {
          console.log(`    🔄 Retrying ${strategyConfig.strategy}...`);
          await this.delay(this.retryDelay);
          i--; // Retry the same strategy
          continue;
        }
      }

      execution.attempts.push(attempt);

      // Delay before next strategy (except for last one)
      if (i < chain.strategies.length - 1) {
        await this.delay(1000);
      }
    }

    // Record execution
    execution.endTime = Date.now();
    execution.duration = execution.endTime - execution.startTime;
    this.executionHistory.push(execution);

    // Handle complete failure
    if (!execution.success) {
      console.log(`  ❌ All strategies in chain failed`);
      execution.error = 'All strategies in fallback chain failed';
      
      // Try emergency fallback if configured
      if (options.emergencyFallback) {
        console.log(`  🚨 Attempting emergency fallback...`);
        execution.result = await this.emergencyFallback(url, execution);
        execution.success = !!execution.result;
      }
    }

    return execution;
  }

  /**
   * Execute a single strategy
   */
  async executeStrategy(url, strategyName, options = {}) {
    // This would integrate with the actual strategy implementations
    // For now, simulating strategy execution
    
    const strategyMap = {
      'static_fetch': () => this.simulateStaticFetch(url),
      'browser_render': () => this.simulateBrowserRender(url),
      'browser_js': () => this.simulateBrowserJS(url),
      'gpt5_direct': () => this.simulateGPT5Direct(url),
      'gpt5_reasoning': () => this.simulateGPT5Reasoning(url),
      'hybrid_smart': () => this.simulateHybridSmart(url)
    };

    const executor = strategyMap[strategyName];
    if (!executor) {
      throw new Error(`Unknown strategy: ${strategyName}`);
    }

    // Execute with timeout
    return await Promise.race([
      executor(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Strategy timeout')), options.timeout)
      )
    ]);
  }

  /**
   * Validate extraction result
   */
  validateResult(result) {
    if (!result) return false;
    
    // Basic validation criteria
    const hasContent = result.content && result.content.length > 100;
    const hasTitle = result.title && result.title.length > 0;
    const hasUrl = result.url && result.url.length > 0;
    
    // At least content or structured data
    const hasData = hasContent || (result.structured && result.structured.length > 0);
    
    return hasUrl && hasTitle && hasData;
  }

  /**
   * Determine if strategy should be retried
   */
  shouldRetry(error, attemptIndex, totalStrategies) {
    // Don't retry if it's the last strategy
    if (attemptIndex === totalStrategies - 1) return false;
    
    // Retry on transient errors
    const transientErrors = [
      'timeout',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'rate limit'
    ];
    
    return transientErrors.some(e => 
      error.message.toLowerCase().includes(e.toLowerCase())
    );
  }

  /**
   * Emergency fallback for complete chain failure
   */
  async emergencyFallback(url, execution) {
    console.log(`  🚨 Emergency fallback activated`);
    
    // Try to extract basic metadata at minimum
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000
      });
      
      const html = await response.text();
      const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || 'Unknown';
      
      return {
        url,
        title,
        content: 'Emergency extraction - limited content available',
        strategy: 'emergency',
        partial: true,
        error: 'Extracted with emergency fallback',
        attempts: execution.attempts.length
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate strategy cost
   */
  calculateCost(strategy, failed = false) {
    const costs = {
      'static_fetch': 0.01,
      'browser_render': 0.05,
      'browser_js': 0.08,
      'hybrid_smart': 0.15,
      'gpt5_direct': 0.50,
      'gpt5_reasoning': 0.75
    };
    
    const baseCost = costs[strategy] || 0.10;
    
    // Reduced cost for failures (partial execution)
    return failed ? baseCost * 0.3 : baseCost;
  }

  /**
   * Get optimal chain for site characteristics
   */
  selectOptimalChain(siteProfile) {
    // Select chain based on site profile
    if (siteProfile.renderingType === 'static') {
      return 'fast';
    }
    
    if (siteProfile.renderingType === 'spa') {
      return 'quality';
    }
    
    if (siteProfile.hasRateLimit) {
      return 'robust';
    }
    
    if (siteProfile.complexity === 'low') {
      return 'cost_optimized';
    }
    
    return 'balanced';
  }

  /**
   * Get chain performance statistics
   */
  getChainStats(chainName) {
    const chainExecutions = this.executionHistory.filter(e => 
      e.chainName === chainName
    );
    
    if (chainExecutions.length === 0) {
      return null;
    }
    
    const stats = {
      executions: chainExecutions.length,
      successes: chainExecutions.filter(e => e.success).length,
      failures: chainExecutions.filter(e => !e.success).length,
      avgDuration: 0,
      avgCost: 0,
      avgAttempts: 0,
      strategySuccess: {}
    };
    
    // Calculate averages
    let totalDuration = 0;
    let totalCost = 0;
    let totalAttempts = 0;
    
    chainExecutions.forEach(execution => {
      totalDuration += execution.duration || 0;
      totalCost += execution.totalCost || 0;
      totalAttempts += execution.attempts.length;
      
      // Track strategy success
      if (execution.finalStrategy) {
        stats.strategySuccess[execution.finalStrategy] = 
          (stats.strategySuccess[execution.finalStrategy] || 0) + 1;
      }
    });
    
    stats.avgDuration = totalDuration / chainExecutions.length;
    stats.avgCost = totalCost / chainExecutions.length;
    stats.avgAttempts = totalAttempts / chainExecutions.length;
    stats.successRate = stats.successes / stats.executions;
    
    return stats;
  }

  /**
   * Optimize chain based on performance
   */
  optimizeChain(chainName) {
    const stats = this.getChainStats(chainName);
    if (!stats || stats.executions < 10) {
      return null; // Not enough data
    }
    
    const chain = this.chains.get(chainName);
    if (!chain) return null;
    
    // Reorder strategies based on success rate
    const optimizedStrategies = [...chain.strategies].sort((a, b) => {
      const aSuccess = stats.strategySuccess[a.strategy] || 0;
      const bSuccess = stats.strategySuccess[b.strategy] || 0;
      return bSuccess - aSuccess;
    });
    
    // Create optimized chain
    const optimizedChainName = `${chainName}_optimized`;
    this.defineChain(optimizedChainName, optimizedStrategies);
    
    return {
      original: chainName,
      optimized: optimizedChainName,
      improvements: {
        reordered: true,
        basedOnExecutions: stats.executions
      }
    };
  }

  /**
   * Helper: Delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Simulation methods for testing
   */
  async simulateStaticFetch(url) {
    await this.delay(500);
    if (Math.random() > 0.7) throw new Error('Static fetch failed');
    return {
      url,
      title: 'Static Title',
      content: 'Static content extracted successfully',
      strategy: 'static_fetch'
    };
  }

  async simulateBrowserRender(url) {
    await this.delay(2000);
    if (Math.random() > 0.8) throw new Error('Browser render failed');
    return {
      url,
      title: 'Browser Title',
      content: 'Browser rendered content extracted successfully',
      strategy: 'browser_render'
    };
  }

  async simulateBrowserJS(url) {
    await this.delay(3000);
    if (Math.random() > 0.85) throw new Error('Browser JS failed');
    return {
      url,
      title: 'Browser JS Title',
      content: 'Full JavaScript rendered content',
      strategy: 'browser_js'
    };
  }

  async simulateGPT5Direct(url) {
    await this.delay(1500);
    if (Math.random() > 0.9) throw new Error('GPT-5 failed');
    return {
      url,
      title: 'GPT-5 Title',
      content: 'GPT-5 extracted and enhanced content',
      strategy: 'gpt5_direct'
    };
  }

  async simulateGPT5Reasoning(url) {
    await this.delay(2500);
    if (Math.random() > 0.95) throw new Error('GPT-5 reasoning failed');
    return {
      url,
      title: 'GPT-5 Reasoning Title',
      content: 'GPT-5 with advanced reasoning extraction',
      strategy: 'gpt5_reasoning'
    };
  }

  async simulateHybridSmart(url) {
    await this.delay(2000);
    if (Math.random() > 0.88) throw new Error('Hybrid failed');
    return {
      url,
      title: 'Hybrid Title',
      content: 'Hybrid smart extraction completed',
      strategy: 'hybrid_smart'
    };
  }
}

module.exports = { FallbackChain };