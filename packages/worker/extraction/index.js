// Atlas Codex - Extraction Module
// Central module for intelligent content extraction

const { ExtractionEngine } = require('./extraction-engine');
const { GPT5Extractor } = require('./gpt5-extractor');

/**
 * Main extraction system interface
 */
class ExtractionSystem {
  constructor(options = {}) {
    this.engine = new ExtractionEngine(options.engine);
    this.gpt5Extractor = new GPT5Extractor(options.gpt5);
    
    this.config = {
      enableBatching: options.enableBatching !== false,
      batchSize: options.batchSize || 5,
      enableCaching: options.enableCaching !== false,
      cacheExpiry: options.cacheExpiry || 60 * 60 * 1000, // 1 hour
      maxConcurrent: options.maxConcurrent || 3,
      ...options
    };
    
    // Extraction cache
    this.cache = new Map();
    
    // Queue for batch processing
    this.queue = [];
    this.processing = false;
    
    // Statistics
    this.stats = {
      totalExtractions: 0,
      cachedExtractions: 0,
      batchedExtractions: 0,
      averageTime: 0,
      averageCost: 0
    };
  }

  /**
   * Extract content from URL
   */
  async extract(url, options = {}) {
    console.log(`📄 Extracting content from ${url}`);
    
    // Check cache
    if (this.config.enableCaching && !options.skipCache) {
      const cached = this.getFromCache(url);
      if (cached) {
        console.log('  ✅ Returning cached extraction');
        this.stats.cachedExtractions++;
        return cached;
      }
    }
    
    // Extract using engine
    const extraction = await this.engine.extract(url, options);
    
    // Cache successful extractions
    if (this.config.enableCaching && extraction.status === 'success') {
      this.addToCache(url, extraction);
    }
    
    // Update statistics
    this.updateStatistics(extraction);
    
    return extraction;
  }

  /**
   * Batch extract multiple URLs
   */
  async batchExtract(urls, options = {}) {
    console.log(`📦 Batch extracting ${urls.length} URLs`);
    
    const results = [];
    const startTime = Date.now();
    
    // Process in chunks
    for (let i = 0; i < urls.length; i += this.config.batchSize) {
      const batch = urls.slice(i, i + this.config.batchSize);
      
      const batchPromises = batch.map(url => 
        this.extract(url, options).catch(error => ({
          url,
          status: 'failed',
          error: error.message
        }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Progress update
      console.log(`  Progress: ${results.length}/${urls.length} completed`);
    }
    
    const totalTime = Date.now() - startTime;
    
    // Summary statistics
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const avgTime = totalTime / urls.length;
    
    console.log(`  ✅ Batch complete: ${successful} successful, ${failed} failed`);
    console.log(`  ⏱️ Total time: ${totalTime}ms (avg: ${avgTime.toFixed(0)}ms per URL)`);
    
    this.stats.batchedExtractions += urls.length;
    
    return {
      results,
      summary: {
        total: urls.length,
        successful,
        failed,
        totalTime,
        avgTime
      }
    };
  }

  /**
   * Extract with specific strategy
   */
  async extractWithStrategy(url, strategy, options = {}) {
    console.log(`🎯 Extracting with ${strategy} strategy`);
    
    // Override DIP strategy selection
    const extractionOptions = {
      ...options,
      preferredStrategy: strategy
    };
    
    return await this.extract(url, extractionOptions);
  }

  /**
   * Extract using GPT-5 directly
   */
  async extractWithGPT5(content, options = {}) {
    console.log('🤖 Direct GPT-5 extraction');
    
    return await this.gpt5Extractor.extract(content, options);
  }

  /**
   * Stream extraction for large batches
   */
  async *streamExtract(urls, options = {}) {
    console.log(`🌊 Stream extracting ${urls.length} URLs`);
    
    for (const url of urls) {
      try {
        const extraction = await this.extract(url, options);
        yield {
          success: true,
          extraction
        };
      } catch (error) {
        yield {
          success: false,
          url,
          error: error.message
        };
      }
    }
  }

  /**
   * Queue extraction for background processing
   */
  queueExtraction(url, options = {}, callback) {
    const task = {
      id: this.generateTaskId(),
      url,
      options,
      callback,
      status: 'queued',
      queuedAt: Date.now()
    };
    
    this.queue.push(task);
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
    
    return task.id;
  }

  /**
   * Process extraction queue
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    console.log(`⚙️ Processing extraction queue (${this.queue.length} items)`);
    
    while (this.queue.length > 0) {
      // Process up to maxConcurrent items in parallel
      const batch = this.queue.splice(0, this.config.maxConcurrent);
      
      const promises = batch.map(async task => {
        task.status = 'processing';
        task.startedAt = Date.now();
        
        try {
          const extraction = await this.extract(task.url, task.options);
          task.status = 'completed';
          task.result = extraction;
          
          if (task.callback) {
            task.callback(null, extraction);
          }
        } catch (error) {
          task.status = 'failed';
          task.error = error.message;
          
          if (task.callback) {
            task.callback(error, null);
          }
        }
        
        task.completedAt = Date.now();
        task.duration = task.completedAt - task.startedAt;
      });
      
      await Promise.all(promises);
    }
    
    this.processing = false;
    console.log('  ✅ Queue processing complete');
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      items: this.queue.map(task => ({
        id: task.id,
        url: task.url,
        status: task.status,
        queuedAt: task.queuedAt
      }))
    };
  }

  /**
   * Cache management
   */
  addToCache(url, extraction) {
    const cacheEntry = {
      extraction,
      timestamp: Date.now(),
      hits: 0
    };
    
    this.cache.set(url, cacheEntry);
    
    // Clean old cache entries
    this.cleanCache();
  }

  getFromCache(url) {
    const entry = this.cache.get(url);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.config.cacheExpiry) {
      this.cache.delete(url);
      return null;
    }
    
    entry.hits++;
    return entry.extraction;
  }

  cleanCache() {
    const now = Date.now();
    const expired = [];
    
    for (const [url, entry] of this.cache) {
      if (now - entry.timestamp > this.config.cacheExpiry) {
        expired.push(url);
      }
    }
    
    expired.forEach(url => this.cache.delete(url));
  }

  clearCache() {
    this.cache.clear();
    console.log('🧹 Extraction cache cleared');
  }

  /**
   * Statistics and monitoring
   */
  updateStatistics(extraction) {
    this.stats.totalExtractions++;
    
    // Update average time
    if (extraction.duration) {
      this.stats.averageTime = 
        (this.stats.averageTime * (this.stats.totalExtractions - 1) + extraction.duration) /
        this.stats.totalExtractions;
    }
    
    // Estimate cost based on strategy
    const costMap = {
      'static_fetch': 0.01,
      'browser_render': 0.05,
      'browser_js': 0.08,
      'gpt5_direct': 0.50,
      'gpt5_reasoning': 0.75,
      'hybrid_smart': 0.15
    };
    
    const cost = costMap[extraction.strategy] || 0.10;
    this.stats.averageCost = 
      (this.stats.averageCost * (this.stats.totalExtractions - 1) + cost) /
      this.stats.totalExtractions;
  }

  getStatistics() {
    const engineStats = this.engine.getStatistics();
    const gpt5Stats = this.gpt5Extractor.getStatistics();
    
    return {
      system: this.stats,
      engine: engineStats,
      gpt5: gpt5Stats,
      cache: {
        size: this.cache.size,
        hitRate: this.stats.totalExtractions > 0 ?
          this.stats.cachedExtractions / this.stats.totalExtractions : 0
      },
      queue: this.getQueueStatus()
    };
  }

  /**
   * Export extraction for analysis
   */
  exportExtraction(extraction) {
    return {
      id: extraction.id,
      url: extraction.url,
      status: extraction.status,
      timestamp: extraction.startTime,
      duration: extraction.duration,
      strategy: extraction.strategy,
      dipConfidence: extraction.dip?.confidence,
      dataCompleteness: extraction.metrics?.dataCompleteness,
      evidenceHash: extraction.evidence?.hash,
      contentLength: extraction.data?.content?.length || 0,
      imageCount: extraction.data?.images?.length || 0,
      linkCount: extraction.data?.links?.length || 0
    };
  }

  /**
   * Validate extraction quality
   */
  validateExtraction(extraction) {
    const validation = {
      valid: true,
      issues: [],
      quality: 0
    };
    
    // Check status
    if (extraction.status !== 'success') {
      validation.valid = false;
      validation.issues.push('Extraction failed');
      return validation;
    }
    
    // Check required fields
    if (!extraction.data?.url) {
      validation.issues.push('Missing URL');
      validation.valid = false;
    }
    
    if (!extraction.data?.title || extraction.data.title.length < 2) {
      validation.issues.push('Missing or invalid title');
    }
    
    if (!extraction.data?.content || extraction.data.content.length < 50) {
      validation.issues.push('Insufficient content');
    }
    
    // Calculate quality score
    let qualityPoints = 0;
    
    if (extraction.data?.title) qualityPoints += 20;
    if (extraction.data?.content?.length > 200) qualityPoints += 30;
    if (extraction.data?.description) qualityPoints += 10;
    if (extraction.data?.images?.length > 0) qualityPoints += 10;
    if (extraction.data?.links?.length > 0) qualityPoints += 10;
    if (extraction.data?.structured?.length > 0) qualityPoints += 10;
    if (extraction.evidence) qualityPoints += 10;
    
    validation.quality = qualityPoints / 100;
    
    return validation;
  }

  /**
   * Generate task ID
   */
  generateTaskId() {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down extraction system');
    
    // Wait for queue to complete
    if (this.processing) {
      console.log('  Waiting for queue to complete...');
      while (this.processing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Clear cache
    this.clearCache();
    
    // Get final statistics
    const stats = this.getStatistics();
    console.log('📊 Final extraction statistics:', stats);
    
    // Cleanup engine
    await this.engine.cleanup();
    
    console.log('✅ Extraction system shutdown complete');
  }
}

// Export everything
module.exports = {
  ExtractionSystem,
  ExtractionEngine,
  GPT5Extractor
};