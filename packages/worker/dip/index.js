// Atlas Codex - DIP Module
// Central module for Domain Intelligence Profile management

const { DIPCreator } = require('./dip-creator');
const { DIPManager } = require('./dip-manager');
const { DIPService } = require('../../core/src/dip-service');

/**
 * Main DIP system interface
 */
class DIPSystem {
  constructor(options = {}) {
    this.manager = new DIPManager(options);
    this.creator = this.manager.dipCreator;
    this.service = this.manager.dipService;
    
    this.config = {
      autoOptimize: options.autoOptimize !== false,
      optimizationInterval: options.optimizationInterval || 60 * 60 * 1000, // 1 hour
      metricsEnabled: options.metricsEnabled !== false,
      ...options
    };
    
    this.metrics = {
      totalDIPsCreated: 0,
      totalDIPsRetrieved: 0,
      totalDIPsUpdated: 0,
      avgCreationTime: 0,
      avgRetrievalTime: 0
    };
    
    // Start auto-optimization if enabled
    if (this.config.autoOptimize) {
      this.startAutoOptimization();
    }
  }

  /**
   * Primary interface - get DIP for extraction
   */
  async getDIPForExtraction(url, options = {}) {
    const startTime = Date.now();
    const domain = new URL(url).hostname;
    
    console.log(`🎯 Getting DIP for extraction: ${domain}`);
    
    try {
      // Get or create DIP
      const dip = await this.manager.getDIP(domain, {
        initialUrl: url,
        ...options
      });
      
      // Track metrics
      const retrievalTime = Date.now() - startTime;
      this.updateMetrics('retrieval', retrievalTime);
      
      // Return extraction-ready format
      return this.formatForExtraction(dip);
      
    } catch (error) {
      console.error(`❌ Failed to get DIP: ${error.message}`);
      
      // Return fallback DIP
      return this.createFallbackDIP(domain, url);
    }
  }

  /**
   * Format DIP for extraction use
   */
  formatForExtraction(dip) {
    return {
      domain: dip.domain,
      strategy: {
        primary: dip.optimalStrategy?.strategyId || 'browser_render',
        fallback: dip.optimalStrategy?.fallback || 'browser_js',
        confidence: dip.optimalStrategy?.confidence || 0.5
      },
      constraints: {
        rateLimit: dip.constraints?.rateLimit?.recommendedDelay || 1000,
        maxRequests: dip.constraints?.rateLimit?.maxRequestsPerMinute || 60,
        requiresAuth: dip.constraints?.authentication?.required || false,
        disallowedPaths: dip.constraints?.robots?.disallowedPaths || []
      },
      selectors: dip.siteStructure?.patterns?.selectors || {},
      framework: dip.siteStructure?.framework?.primary || 'unknown',
      renderingType: dip.siteStructure?.rendering?.type || 'unknown',
      performance: {
        avgTime: dip.performanceMetrics?.avgExtractionTime || 3000,
        successRate: dip.performanceMetrics?.successRate || 0.8
      },
      cost: {
        estimated: dip.costProfile?.estimatedCostPerExtraction || 0.10
      },
      metadata: {
        dipId: dip.id,
        confidence: dip.metadata?.confidenceScore || 0.5,
        age: Date.now() - new Date(dip.lastUpdated || dip.createdAt).getTime()
      }
    };
  }

  /**
   * Create fallback DIP when retrieval fails
   */
  createFallbackDIP(domain, url) {
    return {
      domain,
      strategy: {
        primary: 'browser_render',
        fallback: 'browser_js',
        confidence: 0.3
      },
      constraints: {
        rateLimit: 2000,
        maxRequests: 30,
        requiresAuth: false,
        disallowedPaths: []
      },
      selectors: {},
      framework: 'unknown',
      renderingType: 'unknown',
      performance: {
        avgTime: 5000,
        successRate: 0.5
      },
      cost: {
        estimated: 0.15
      },
      metadata: {
        dipId: 'fallback',
        confidence: 0.3,
        age: 0,
        isFallback: true
      }
    };
  }

  /**
   * Update DIP after extraction
   */
  async updateDIPFromExtraction(domain, extractionResult) {
    console.log(`📝 Updating DIP from extraction result`);
    
    try {
      const dip = await this.manager.getDIP(domain);
      
      if (!dip) {
        console.error('DIP not found for update');
        return;
      }
      
      // Update performance metrics
      const metrics = dip.performanceMetrics || {};
      const count = dip.metadata?.extractionCount || 0;
      
      // Update running averages
      if (extractionResult.duration) {
        metrics.avgExtractionTime = 
          (metrics.avgExtractionTime * count + extractionResult.duration) / (count + 1);
      }
      
      if (extractionResult.success !== undefined) {
        const successCount = Math.round(metrics.successRate * count);
        const newSuccessCount = successCount + (extractionResult.success ? 1 : 0);
        metrics.successRate = newSuccessCount / (count + 1);
      }
      
      // Update metadata
      dip.metadata.extractionCount = count + 1;
      dip.metadata.lastExtraction = {
        timestamp: new Date().toISOString(),
        success: extractionResult.success,
        strategy: extractionResult.strategy,
        duration: extractionResult.duration,
        cost: extractionResult.cost
      };
      
      // Update usage in management
      if (dip.management) {
        dip.management.usageCount++;
        dip.management.lastAccessed = new Date().toISOString();
      }
      
      // Save updated DIP
      await this.service.saveDIP(dip);
      
      // Update metrics
      this.metrics.totalDIPsUpdated++;
      
      console.log(`  ✅ DIP updated successfully`);
      
    } catch (error) {
      console.error(`  ❌ Failed to update DIP: ${error.message}`);
    }
  }

  /**
   * Batch process multiple domains
   */
  async batchProcessDomains(domains, options = {}) {
    console.log(`📦 Batch processing ${domains.length} domains`);
    
    const results = {
      successful: [],
      failed: [],
      stats: {
        totalTime: 0,
        avgTime: 0,
        successRate: 0
      }
    };
    
    const startTime = Date.now();
    
    // Process in batches to avoid overwhelming the system
    const batchSize = options.batchSize || 5;
    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async domain => {
          try {
            const dip = await this.manager.getDIP(domain, options);
            return { domain, success: true, dip: this.manager.exportDIP(dip) };
          } catch (error) {
            return { domain, success: false, error: error.message };
          }
        })
      );
      
      batchResults.forEach(result => {
        if (result.success) {
          results.successful.push(result);
        } else {
          results.failed.push(result);
        }
      });
    }
    
    // Calculate statistics
    results.stats.totalTime = Date.now() - startTime;
    results.stats.avgTime = results.stats.totalTime / domains.length;
    results.stats.successRate = results.successful.length / domains.length;
    
    console.log(`  ✅ Batch complete: ${results.successful.length}/${domains.length} successful`);
    
    return results;
  }

  /**
   * Get system health and statistics
   */
  async getSystemHealth() {
    const managerStats = await this.manager.getStatistics();
    
    return {
      status: 'healthy',
      metrics: this.metrics,
      manager: managerStats,
      optimization: {
        enabled: this.config.autoOptimize,
        lastRun: this.lastOptimization,
        nextRun: this.nextOptimization
      }
    };
  }

  /**
   * Update metrics
   */
  updateMetrics(type, value) {
    if (!this.config.metricsEnabled) return;
    
    switch (type) {
      case 'creation':
        this.metrics.totalDIPsCreated++;
        this.metrics.avgCreationTime = 
          (this.metrics.avgCreationTime * (this.metrics.totalDIPsCreated - 1) + value) / 
          this.metrics.totalDIPsCreated;
        break;
        
      case 'retrieval':
        this.metrics.totalDIPsRetrieved++;
        this.metrics.avgRetrievalTime = 
          (this.metrics.avgRetrievalTime * (this.metrics.totalDIPsRetrieved - 1) + value) / 
          this.metrics.totalDIPsRetrieved;
        break;
    }
  }

  /**
   * Start auto-optimization
   */
  startAutoOptimization() {
    console.log('🤖 Starting DIP auto-optimization');
    
    this.optimizationTimer = setInterval(async () => {
      console.log('🔧 Running scheduled DIP optimization');
      
      try {
        const results = await this.manager.optimizeDIPs();
        this.lastOptimization = new Date().toISOString();
        this.nextOptimization = new Date(Date.now() + this.config.optimizationInterval).toISOString();
        
        console.log(`  ✅ Optimization complete: ${results.optimizations.length} recommendations`);
        
      } catch (error) {
        console.error(`  ❌ Optimization failed: ${error.message}`);
      }
    }, this.config.optimizationInterval);
    
    this.nextOptimization = new Date(Date.now() + this.config.optimizationInterval).toISOString();
  }

  /**
   * Stop auto-optimization
   */
  stopAutoOptimization() {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = null;
      console.log('🛑 Stopped DIP auto-optimization');
    }
  }

  /**
   * Manual optimization trigger
   */
  async optimize() {
    console.log('🔧 Running manual DIP optimization');
    
    const results = await this.manager.optimizeDIPs();
    
    return {
      timestamp: new Date().toISOString(),
      optimizations: results.optimizations,
      preloadedDomains: results.preloadedDomains,
      cacheOptimized: results.cacheOptimized
    };
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.manager.cache.clear();
    this.manager.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    console.log('🧹 Cleared all DIP caches');
  }

  /**
   * Export DIP for a domain
   */
  async exportDIP(domain) {
    const dip = await this.manager.getDIP(domain);
    return this.manager.exportDIP(dip);
  }

  /**
   * Import DIP (for migration or backup restore)
   */
  async importDIP(dipData) {
    console.log(`📥 Importing DIP for ${dipData.domain}`);
    
    try {
      // Validate DIP structure
      if (!dipData.domain || !dipData.version) {
        throw new Error('Invalid DIP data structure');
      }
      
      // Save to database
      await this.service.saveDIP(dipData);
      
      // Add to cache if enabled
      if (this.config.cacheEnabled) {
        this.manager.addToCache(dipData.domain, dipData);
      }
      
      console.log(`  ✅ DIP imported successfully`);
      return true;
      
    } catch (error) {
      console.error(`  ❌ Failed to import DIP: ${error.message}`);
      return false;
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down DIP system');
    
    // Stop auto-optimization
    this.stopAutoOptimization();
    
    // Save final statistics
    const stats = await this.getSystemHealth();
    console.log('📊 Final system statistics:', stats);
    
    // Cleanup resources
    await this.manager.cleanup();
    
    console.log('✅ DIP system shutdown complete');
  }
}

// Export everything
module.exports = {
  DIPSystem,
  DIPManager,
  DIPCreator,
  DIPService
};