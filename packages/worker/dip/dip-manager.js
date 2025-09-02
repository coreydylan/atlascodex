// Atlas Codex - DIP Management System
// Manages lifecycle, storage, and optimization of Domain Intelligence Profiles

const { DIPService } = require('../../core/src/dip-service');
const { DIPCreator } = require('./dip-creator');
const crypto = require('crypto');

class DIPManager {
  constructor(options = {}) {
    this.dipService = new DIPService(options.dynamodb);
    this.dipCreator = new DIPCreator(options.creator);
    
    this.config = {
      maxDIPAge: options.maxDIPAge || 7 * 24 * 60 * 60 * 1000, // 7 days
      minConfidenceThreshold: options.minConfidenceThreshold || 0.6,
      autoUpdate: options.autoUpdate !== false,
      cacheEnabled: options.cacheEnabled !== false,
      maxCacheSize: options.maxCacheSize || 100,
      ...options
    };
    
    // In-memory cache for frequently accessed DIPs
    this.cache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    
    // DIP usage tracking
    this.usageTracking = new Map();
  }

  /**
   * Get or create DIP for a domain
   */
  async getDIP(domain, options = {}) {
    console.log(`📂 Retrieving DIP for ${domain}`);
    
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache(domain);
      if (cached && !this.isDIPStale(cached, options.maxAge)) {
        console.log('  ✅ DIP found in cache');
        this.trackUsage(domain, 'cache_hit');
        return cached;
      }
    }
    
    // Check database
    let dip = await this.dipService.getDIP(domain);
    
    if (dip) {
      console.log('  ✅ DIP found in database');
      
      // Check if DIP needs refresh
      if (await this.shouldRefreshDIP(dip, options)) {
        console.log('  🔄 DIP needs refresh');
        dip = await this.refreshDIP(dip, options);
      }
      
      // Cache the DIP
      if (this.config.cacheEnabled) {
        this.addToCache(domain, dip);
      }
      
      this.trackUsage(domain, 'database_hit');
      return dip;
    }
    
    // Create new DIP
    console.log('  🆕 Creating new DIP');
    dip = await this.createNewDIP(domain, options.initialUrl);
    
    // Save to database
    await this.dipService.saveDIP(dip);
    
    // Cache the new DIP
    if (this.config.cacheEnabled) {
      this.addToCache(domain, dip);
    }
    
    this.trackUsage(domain, 'created');
    return dip;
  }

  /**
   * Create a new DIP
   */
  async createNewDIP(domain, initialUrl) {
    const dip = await this.dipCreator.createDIP(domain, initialUrl);
    
    // Add management metadata
    dip.management = {
      createdBy: 'DIPManager',
      version: '1.0.0',
      usageCount: 0,
      lastAccessed: new Date().toISOString(),
      updateHistory: []
    };
    
    // Generate DIP ID
    dip.id = this.generateDIPId(domain, dip.createdAt);
    
    // Validate DIP quality
    if (dip.metadata.confidenceScore < this.config.minConfidenceThreshold) {
      console.warn(`  ⚠️ Low confidence DIP created (${(dip.metadata.confidenceScore * 100).toFixed(1)}%)`);
      dip.metadata.warnings = ['Low confidence - may need manual review'];
    }
    
    return dip;
  }

  /**
   * Refresh an existing DIP
   */
  async refreshDIP(existingDIP, options = {}) {
    console.log(`  🔄 Refreshing DIP for ${existingDIP.domain}`);
    
    const refreshStart = Date.now();
    
    try {
      // Create a fresh DIP
      const newDIP = await this.dipCreator.createDIP(
        existingDIP.domain, 
        options.initialUrl
      );
      
      // Merge with existing DIP
      const mergedDIP = this.mergeDIPs(existingDIP, newDIP);
      
      // Update management metadata
      mergedDIP.management.updateHistory.push({
        timestamp: new Date().toISOString(),
        type: 'refresh',
        duration: Date.now() - refreshStart,
        changes: this.detectChanges(existingDIP, newDIP)
      });
      
      // Save updated DIP
      await this.dipService.saveDIP(mergedDIP);
      
      return mergedDIP;
      
    } catch (error) {
      console.error(`  ❌ Failed to refresh DIP: ${error.message}`);
      
      // Return existing DIP with error notation
      existingDIP.metadata.lastRefreshError = {
        timestamp: new Date().toISOString(),
        error: error.message
      };
      
      return existingDIP;
    }
  }

  /**
   * Merge two DIPs intelligently
   */
  mergeDIPs(existingDIP, newDIP) {
    const merged = {
      ...existingDIP,
      ...newDIP,
      id: existingDIP.id, // Preserve original ID
      createdAt: existingDIP.createdAt, // Preserve original creation date
      lastUpdated: new Date().toISOString(),
      management: existingDIP.management
    };
    
    // Merge extraction strategies (keep successful ones)
    const strategies = new Map();
    
    existingDIP.extractionStrategies?.forEach(s => {
      if (s.success) strategies.set(s.id, s);
    });
    
    newDIP.extractionStrategies?.forEach(s => {
      if (s.success) {
        const existing = strategies.get(s.id);
        if (!existing || s.quality > existing.quality) {
          strategies.set(s.id, s);
        }
      }
    });
    
    merged.extractionStrategies = Array.from(strategies.values());
    
    // Update optimal strategy if new one is better
    if (newDIP.optimalStrategy && 
        (!existingDIP.optimalStrategy || 
         newDIP.optimalStrategy.confidence > existingDIP.optimalStrategy.confidence)) {
      merged.optimalStrategy = newDIP.optimalStrategy;
    }
    
    // Merge performance metrics (weighted average)
    if (existingDIP.performanceMetrics && newDIP.performanceMetrics) {
      const weight = 0.7; // Weight towards new data
      merged.performanceMetrics = {
        avgExtractionTime: 
          existingDIP.performanceMetrics.avgExtractionTime * (1 - weight) +
          newDIP.performanceMetrics.avgExtractionTime * weight,
        successRate:
          existingDIP.performanceMetrics.successRate * (1 - weight) +
          newDIP.performanceMetrics.successRate * weight,
        qualityScore:
          existingDIP.performanceMetrics.qualityScore * (1 - weight) +
          newDIP.performanceMetrics.qualityScore * weight,
        reliabilityScore:
          existingDIP.performanceMetrics.reliabilityScore * (1 - weight) +
          newDIP.performanceMetrics.reliabilityScore * weight,
        scalability: newDIP.performanceMetrics.scalability
      };
    }
    
    // Update metadata
    merged.metadata = {
      ...newDIP.metadata,
      updateCount: (existingDIP.metadata.updateCount || 0) + 1,
      originalAnalysisTime: existingDIP.metadata.analysisTime,
      totalAnalysisTime: 
        (existingDIP.metadata.totalAnalysisTime || existingDIP.metadata.analysisTime) + 
        newDIP.metadata.analysisTime
    };
    
    return merged;
  }

  /**
   * Detect changes between DIPs
   */
  detectChanges(oldDIP, newDIP) {
    const changes = [];
    
    // Check framework changes
    if (oldDIP.siteStructure?.framework?.primary !== newDIP.siteStructure?.framework?.primary) {
      changes.push({
        type: 'framework',
        old: oldDIP.siteStructure?.framework?.primary,
        new: newDIP.siteStructure?.framework?.primary
      });
    }
    
    // Check rendering type changes
    if (oldDIP.siteStructure?.rendering?.type !== newDIP.siteStructure?.rendering?.type) {
      changes.push({
        type: 'rendering',
        old: oldDIP.siteStructure?.rendering?.type,
        new: newDIP.siteStructure?.rendering?.type
      });
    }
    
    // Check optimal strategy changes
    if (oldDIP.optimalStrategy?.strategyId !== newDIP.optimalStrategy?.strategyId) {
      changes.push({
        type: 'optimal_strategy',
        old: oldDIP.optimalStrategy?.strategyId,
        new: newDIP.optimalStrategy?.strategyId
      });
    }
    
    // Check rate limit changes
    if (oldDIP.constraints?.rateLimit?.hasLimit !== newDIP.constraints?.rateLimit?.hasLimit) {
      changes.push({
        type: 'rate_limit',
        old: oldDIP.constraints?.rateLimit?.hasLimit,
        new: newDIP.constraints?.rateLimit?.hasLimit
      });
    }
    
    return changes;
  }

  /**
   * Check if DIP should be refreshed
   */
  async shouldRefreshDIP(dip, options = {}) {
    // Force refresh if requested
    if (options.forceRefresh) return true;
    
    // Check if stale
    if (this.isDIPStale(dip, options.maxAge)) return true;
    
    // Check if low confidence
    if (dip.metadata.confidenceScore < this.config.minConfidenceThreshold) return true;
    
    // Check if frequently used and not recently updated
    const usage = this.usageTracking.get(dip.domain);
    if (usage && usage.count > 10 && !this.isRecentlyUpdated(dip)) {
      return true;
    }
    
    // Check for refresh errors
    if (dip.metadata.lastRefreshError) {
      const errorAge = Date.now() - new Date(dip.metadata.lastRefreshError.timestamp).getTime();
      if (errorAge > 60 * 60 * 1000) { // Retry after 1 hour
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if DIP is stale
   */
  isDIPStale(dip, maxAge) {
    const age = maxAge || this.config.maxDIPAge;
    const dipAge = Date.now() - new Date(dip.lastUpdated || dip.createdAt).getTime();
    return dipAge > age;
  }

  /**
   * Check if DIP was recently updated
   */
  isRecentlyUpdated(dip) {
    const updateAge = Date.now() - new Date(dip.lastUpdated || dip.createdAt).getTime();
    return updateAge < 24 * 60 * 60 * 1000; // Less than 24 hours
  }

  /**
   * Generate unique DIP ID
   */
  generateDIPId(domain, timestamp) {
    const hash = crypto.createHash('sha256');
    hash.update(`${domain}:${timestamp}`);
    return `dip_${hash.digest('hex').substring(0, 12)}`;
  }

  /**
   * Cache management
   */
  addToCache(domain, dip) {
    // Enforce cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictFromCache();
    }
    
    this.cache.set(domain, {
      dip,
      timestamp: Date.now(),
      hits: 0
    });
  }

  getFromCache(domain) {
    const cached = this.cache.get(domain);
    if (cached) {
      cached.hits++;
      this.cacheStats.hits++;
      return cached.dip;
    }
    this.cacheStats.misses++;
    return null;
  }

  evictFromCache() {
    // LRU eviction - remove least recently used
    let oldestDomain = null;
    let oldestTime = Infinity;
    
    for (const [domain, cached] of this.cache) {
      if (cached.timestamp < oldestTime) {
        oldestTime = cached.timestamp;
        oldestDomain = domain;
      }
    }
    
    if (oldestDomain) {
      this.cache.delete(oldestDomain);
      this.cacheStats.evictions++;
    }
  }

  /**
   * Usage tracking
   */
  trackUsage(domain, type) {
    if (!this.usageTracking.has(domain)) {
      this.usageTracking.set(domain, {
        count: 0,
        types: {},
        firstAccess: Date.now(),
        lastAccess: Date.now()
      });
    }
    
    const usage = this.usageTracking.get(domain);
    usage.count++;
    usage.types[type] = (usage.types[type] || 0) + 1;
    usage.lastAccess = Date.now();
  }

  /**
   * Get DIP statistics
   */
  async getStatistics() {
    const stats = {
      cache: {
        size: this.cache.size,
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        evictions: this.cacheStats.evictions,
        hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)
      },
      usage: {
        totalDomains: this.usageTracking.size,
        totalRequests: 0,
        topDomains: []
      },
      database: {
        totalDIPs: 0 // Would query from database
      }
    };
    
    // Calculate usage stats
    const domainUsage = [];
    for (const [domain, usage] of this.usageTracking) {
      stats.usage.totalRequests += usage.count;
      domainUsage.push({ domain, count: usage.count });
    }
    
    // Get top domains
    stats.usage.topDomains = domainUsage
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return stats;
  }

  /**
   * Optimize DIPs based on usage patterns
   */
  async optimizeDIPs() {
    console.log('🔧 Optimizing DIPs based on usage patterns');
    
    const optimizations = [];
    
    // Find frequently used DIPs that need optimization
    for (const [domain, usage] of this.usageTracking) {
      if (usage.count > 50) {
        const dip = await this.getDIP(domain);
        
        // Check if we can optimize the strategy
        if (dip.performanceMetrics?.avgExtractionTime > 5000) {
          optimizations.push({
            domain,
            type: 'performance',
            recommendation: 'Consider caching or faster extraction strategy'
          });
        }
        
        if (dip.costProfile?.estimatedCostPerExtraction > 0.20) {
          optimizations.push({
            domain,
            type: 'cost',
            recommendation: 'High cost per extraction - optimize strategy'
          });
        }
      }
    }
    
    // Preload frequently accessed DIPs into cache
    const frequentDomains = Array.from(this.usageTracking.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([domain]) => domain);
    
    for (const domain of frequentDomains) {
      if (!this.cache.has(domain)) {
        const dip = await this.dipService.getDIP(domain);
        if (dip) {
          this.addToCache(domain, dip);
        }
      }
    }
    
    return {
      optimizations,
      preloadedDomains: frequentDomains.length,
      cacheOptimized: true
    };
  }

  /**
   * Export DIP for analysis
   */
  exportDIP(dip) {
    return {
      domain: dip.domain,
      id: dip.id,
      version: dip.version,
      created: dip.createdAt,
      updated: dip.lastUpdated,
      confidence: dip.metadata.confidenceScore,
      optimalStrategy: dip.optimalStrategy?.strategyId,
      framework: dip.siteStructure?.framework?.primary,
      renderingType: dip.siteStructure?.rendering?.type,
      hasRateLimit: dip.constraints?.rateLimit?.hasLimit,
      estimatedCost: dip.costProfile?.estimatedCostPerExtraction,
      avgExtractionTime: dip.performanceMetrics?.avgExtractionTime,
      successRate: dip.performanceMetrics?.successRate
    };
  }

  /**
   * Batch operations
   */
  async batchGetDIPs(domains) {
    console.log(`📦 Batch retrieving ${domains.length} DIPs`);
    
    const results = await Promise.all(
      domains.map(domain => 
        this.getDIP(domain).catch(error => ({
          domain,
          error: error.message
        }))
      )
    );
    
    return results;
  }

  async batchUpdateDIPs(domains) {
    console.log(`🔄 Batch updating ${domains.length} DIPs`);
    
    const results = await Promise.all(
      domains.map(async domain => {
        try {
          const dip = await this.getDIP(domain);
          if (dip) {
            return await this.refreshDIP(dip);
          }
          return { domain, error: 'DIP not found' };
        } catch (error) {
          return { domain, error: error.message };
        }
      })
    );
    
    return results;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.dipCreator.cleanup();
    
    // Save usage statistics
    const stats = await this.getStatistics();
    console.log('📊 Final DIP Manager Statistics:', stats);
  }
}

module.exports = { DIPManager };