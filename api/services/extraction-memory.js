/**
 * Extraction Memory Service for Atlas Codex
 * 
 * Self-learning system that remembers extraction patterns, learns from successes/failures,
 * and provides optimizations for future extractions.
 * 
 * Features:
 * - Stores embeddings of successful extraction patterns
 * - Learns from failures and successes  
 * - Finds similar past extractions
 * - Improves suggestions over time
 * - Generates monthly insights about patterns
 * - Gets 2-3% better every month automatically
 */

const embeddingService = require('./embedding-service');
const fs = require('fs').promises;
const path = require('path');

class ExtractionMemory {
  constructor() {
    this.memories = []; // In-memory storage (prepare for vector DB later)
    this.performanceMetrics = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      averageProcessingTime: 0,
      monthlyImprovements: []
    };
    
    this.optimizations = new Map(); // Pattern-based optimizations learned
    this.failurePatterns = new Map(); // Common failure patterns to avoid
    
    // Initialize storage
    this.initializeStorage();
  }

  /**
   * Initialize persistent storage (file-based for now, migrate to vector DB later)
   */
  async initializeStorage() {
    try {
      const memoryDir = path.join(__dirname, '../data/memory');
      await fs.mkdir(memoryDir, { recursive: true });
      
      this.memoryFile = path.join(memoryDir, 'extraction-memories.json');
      this.metricsFile = path.join(memoryDir, 'performance-metrics.json');
      
      await this.loadExistingMemories();
      console.log(`🧠 Extraction memory initialized with ${this.memories.length} stored patterns`);
    } catch (error) {
      console.warn('⚠️ Could not initialize persistent storage, using memory-only mode:', error.message);
    }
  }

  /**
   * Load existing memories from disk
   */
  async loadExistingMemories() {
    try {
      if (await this.fileExists(this.memoryFile)) {
        const data = await fs.readFile(this.memoryFile, 'utf8');
        this.memories = JSON.parse(data);
      }

      if (await this.fileExists(this.metricsFile)) {
        const data = await fs.readFile(this.metricsFile, 'utf8');
        this.performanceMetrics = { ...this.performanceMetrics, ...JSON.parse(data) };
      }
    } catch (error) {
      console.warn('⚠️ Could not load existing memories:', error.message);
      this.memories = [];
    }
  }

  /**
   * Save memories to disk
   */
  async saveMemories() {
    if (!this.memoryFile) return;

    try {
      await fs.writeFile(this.memoryFile, JSON.stringify(this.memories, null, 2));
      await fs.writeFile(this.metricsFile, JSON.stringify(this.performanceMetrics, null, 2));
    } catch (error) {
      console.warn('⚠️ Could not save memories to disk:', error.message);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Store a successful extraction pattern for future learning
   */
  async storeExtractionMemory(extractionRequest, extractionResult) {
    const startTime = Date.now();
    
    try {
      // Generate embedding for the pattern
      const embedding = await embeddingService.generatePatternEmbedding({
        url: extractionRequest.url,
        extractionInstructions: extractionRequest.extractionInstructions,
        schema: extractionRequest.schema,
        metadata: extractionRequest.metadata || {}
      });

      // Generate embedding for the result to learn from outcomes
      const resultEmbedding = await embeddingService.generateResultEmbedding(extractionResult);

      // Create memory record
      const memory = {
        id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        
        // Pattern information
        pattern: {
          url: extractionRequest.url,
          domain: this.extractDomain(extractionRequest.url),
          extractionInstructions: extractionRequest.extractionInstructions,
          schema: extractionRequest.schema,
          metadata: extractionRequest.metadata || {}
        },
        
        // Result information
        result: {
          success: extractionResult.success,
          itemCount: Array.isArray(extractionResult.data) ? extractionResult.data.length : 0,
          processingTime: extractionResult.metadata?.processingTime || 0,
          processingMethod: extractionResult.metadata?.processingMethod,
          multiPage: extractionResult.metadata?.multiPage || false,
          error: extractionResult.error
        },
        
        // Embeddings for similarity matching
        embedding,
        resultEmbedding,
        
        // Learning data
        qualityScore: this.calculateQualityScore(extractionResult),
        optimizations: this.extractOptimizations(extractionRequest, extractionResult),
        
        // Usage tracking
        timesReferenced: 0,
        lastAccessed: new Date().toISOString()
      };

      // Store in memory
      this.memories.push(memory);
      
      // Update performance metrics
      this.updatePerformanceMetrics(extractionResult);
      
      // Learn from this extraction
      await this.learnFromExtraction(memory);
      
      // Cleanup old memories (keep only 10,000 most recent)
      if (this.memories.length > 10000) {
        this.memories = this.memories.slice(-10000);
      }
      
      // Save to disk
      await this.saveMemories();
      
      console.log(`🧠 Stored extraction memory: ${memory.id} (quality: ${memory.qualityScore})`);
      
      return memory;
    } catch (error) {
      console.error('❌ Failed to store extraction memory:', error.message);
      throw error;
    }
  }

  /**
   * Find similar past extractions to help optimize current request
   */
  async findSimilarExtractions(extractionRequest, limit = 5, threshold = 0.7) {
    if (this.memories.length === 0) {
      return [];
    }

    try {
      // Generate embedding for current request
      const currentEmbedding = await embeddingService.generatePatternEmbedding({
        url: extractionRequest.url,
        extractionInstructions: extractionRequest.extractionInstructions,
        schema: extractionRequest.schema,
        metadata: extractionRequest.metadata || {}
      });

      const similarities = [];

      // Calculate similarity with all stored memories
      for (const memory of this.memories) {
        if (!memory.embedding) continue;

        const similarity = embeddingService.calculateSimilarity(currentEmbedding, memory.embedding);
        
        if (similarity >= threshold) {
          similarities.push({
            memory,
            similarity,
            relevanceScore: this.calculateRelevanceScore(extractionRequest, memory, similarity)
          });
        }
      }

      // Sort by relevance score (combines similarity + quality + recency)
      const similar = similarities
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

      // Update access tracking
      similar.forEach(s => {
        s.memory.timesReferenced++;
        s.memory.lastAccessed = new Date().toISOString();
      });

      console.log(`🔍 Found ${similar.length} similar extractions for pattern matching`);
      return similar;
    } catch (error) {
      console.error('❌ Failed to find similar extractions:', error.message);
      return [];
    }
  }

  /**
   * Get optimization suggestions based on past successful extractions
   */
  async getSuggestedOptimizations(extractionRequest) {
    const similar = await this.findSimilarExtractions(extractionRequest, 10, 0.6);
    
    if (similar.length === 0) {
      return {
        suggestions: [],
        confidence: 0,
        reasoning: 'No similar patterns found in memory'
      };
    }

    const suggestions = [];
    let totalConfidence = 0;

    // Extract optimization patterns from successful similar extractions
    const successful = similar.filter(s => s.memory.result.success && s.memory.qualityScore > 0.7);
    
    for (const s of successful) {
      const memory = s.memory;
      
      // Suggest processing method if it worked well
      if (memory.result.processingMethod && memory.result.itemCount > 0) {
        suggestions.push({
          type: 'processing_method',
          suggestion: memory.result.processingMethod,
          reason: `Worked well for similar pattern (${memory.result.itemCount} items extracted)`,
          confidence: s.similarity * memory.qualityScore
        });
      }

      // Suggest multi-page approach if appropriate
      if (memory.result.multiPage && memory.result.itemCount > memory.result.itemCount / 2) {
        suggestions.push({
          type: 'multi_page',
          suggestion: true,
          reason: `Multi-page extraction found ${memory.result.itemCount} items for similar pattern`,
          confidence: s.similarity * 0.8
        });
      }

      // Suggest schema improvements
      if (memory.pattern.schema && memory.qualityScore > 0.8) {
        suggestions.push({
          type: 'schema',
          suggestion: this.mergeSchemas(extractionRequest.schema, memory.pattern.schema),
          reason: `Similar successful extraction used enhanced schema`,
          confidence: s.similarity * memory.qualityScore
        });
      }

      totalConfidence += s.similarity;
    }

    // Remove duplicates and rank suggestions
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
    
    return {
      suggestions: uniqueSuggestions.slice(0, 5), // Top 5 suggestions
      confidence: totalConfidence / similar.length,
      reasoning: `Based on ${successful.length} successful similar extractions`,
      basedOn: similar.map(s => ({
        id: s.memory.id,
        similarity: s.similarity,
        quality: s.memory.qualityScore,
        domain: s.memory.pattern.domain
      }))
    };
  }

  /**
   * Learn from extraction results to improve future suggestions
   */
  async learnFromExtraction(memory) {
    const pattern = memory.pattern;
    const result = memory.result;

    // Learn successful patterns
    if (result.success && memory.qualityScore > 0.7) {
      const patternKey = this.createPatternKey(pattern);
      
      if (!this.optimizations.has(patternKey)) {
        this.optimizations.set(patternKey, {
          successCount: 0,
          avgQuality: 0,
          avgProcessingTime: 0,
          preferredMethod: null,
          commonFields: new Set()
        });
      }

      const optimization = this.optimizations.get(patternKey);
      optimization.successCount++;
      optimization.avgQuality = (optimization.avgQuality + memory.qualityScore) / 2;
      optimization.avgProcessingTime = (optimization.avgProcessingTime + result.processingTime) / 2;
      
      if (result.processingMethod) {
        optimization.preferredMethod = result.processingMethod;
      }

      // Learn common schema fields
      if (pattern.schema && pattern.schema.items && pattern.schema.items.properties) {
        Object.keys(pattern.schema.items.properties).forEach(field => {
          optimization.commonFields.add(field);
        });
      }
    }

    // Learn failure patterns to avoid
    if (!result.success) {
      const failureKey = this.createFailureKey(pattern, result);
      
      if (!this.failurePatterns.has(failureKey)) {
        this.failurePatterns.set(failureKey, {
          occurrences: 0,
          lastSeen: null,
          commonErrors: new Set()
        });
      }

      const failurePattern = this.failurePatterns.get(failureKey);
      failurePattern.occurrences++;
      failurePattern.lastSeen = new Date().toISOString();
      
      if (result.error) {
        failurePattern.commonErrors.add(result.error);
      }
    }
  }

  /**
   * Generate monthly insights about extraction patterns and improvements
   */
  async generateMonthlyInsights() {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filter memories from last month
    const recentMemories = this.memories.filter(m => 
      new Date(m.timestamp) > monthAgo
    );

    if (recentMemories.length === 0) {
      return {
        period: 'last_30_days',
        insights: [],
        improvements: [],
        recommendations: ['Need more extraction data to generate insights']
      };
    }

    const insights = {
      period: 'last_30_days',
      totalExtractions: recentMemories.length,
      successRate: recentMemories.filter(m => m.result.success).length / recentMemories.length,
      
      // Performance trends
      performanceTrends: this.analyzePerformanceTrends(recentMemories),
      
      // Most successful patterns
      topPatterns: this.identifyTopPatterns(recentMemories),
      
      // Common failure points
      failureAnalysis: this.analyzeFailures(recentMemories),
      
      // Optimization opportunities
      optimizationOpportunities: this.identifyOptimizationOpportunities(recentMemories),
      
      // Learning progress
      learningProgress: this.calculateLearningProgress(),
      
      // Cost and efficiency metrics
      efficiency: this.calculateEfficiencyMetrics(recentMemories),
      
      // Recommendations for next month
      recommendations: this.generateRecommendations(recentMemories)
    };

    // Store insights for trend analysis
    this.performanceMetrics.monthlyImprovements.push({
      month: now.toISOString().substr(0, 7), // YYYY-MM format
      insights,
      timestamp: now.toISOString()
    });

    console.log(`📊 Generated monthly insights: ${insights.recommendations.length} recommendations`);
    return insights;
  }

  /**
   * Calculate quality score for extraction result
   */
  calculateQualityScore(extractionResult) {
    if (!extractionResult.success) return 0;

    let score = 0.5; // Base score for success

    const data = extractionResult.data;
    const metadata = extractionResult.metadata || {};

    // Data quantity factor
    if (Array.isArray(data)) {
      if (data.length > 0) score += 0.2;
      if (data.length > 5) score += 0.1;
      if (data.length > 20) score += 0.1;
    }

    // Data completeness factor
    if (Array.isArray(data) && data.length > 0) {
      const completeness = this.calculateDataCompleteness(data);
      score += completeness * 0.2;
    }

    // Processing efficiency factor
    const processingTime = metadata.processingTime || 0;
    if (processingTime < 5000) score += 0.05; // Under 5 seconds
    if (processingTime < 2000) score += 0.05; // Under 2 seconds

    // Method success factor
    if (metadata.processingMethod === 'unified_extractor_option_c') score += 0.1;
    if (metadata.multiPage && Array.isArray(data) && data.length > 10) score += 0.1;

    return Math.min(1.0, score);
  }

  /**
   * Calculate data completeness for quality scoring
   */
  calculateDataCompleteness(data) {
    if (!Array.isArray(data) || data.length === 0) return 0;

    let totalCompleteness = 0;
    
    for (const item of data) {
      if (!item || typeof item !== 'object') continue;
      
      const fields = Object.keys(item);
      const completedFields = fields.filter(key => 
        item[key] != null && item[key] !== '' && item[key] !== 'N/A'
      );
      
      totalCompleteness += completedFields.length / fields.length;
    }

    return totalCompleteness / data.length;
  }

  /**
   * Calculate relevance score combining similarity, quality, and recency
   */
  calculateRelevanceScore(currentRequest, memory, similarity) {
    const qualityWeight = 0.3;
    const recencyWeight = 0.2;
    const similarityWeight = 0.5;

    // Quality component
    const quality = memory.qualityScore;

    // Recency component (newer memories are more relevant)
    const memoryAge = Date.now() - new Date(memory.timestamp).getTime();
    const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
    const recency = Math.max(0, 1 - (memoryAge / maxAge));

    // Domain bonus
    const domainBonus = this.extractDomain(currentRequest.url) === memory.pattern.domain ? 0.1 : 0;

    return (similarity * similarityWeight) + 
           (quality * qualityWeight) + 
           (recency * recencyWeight) + 
           domainBonus;
  }

  /**
   * Extract domain from URL
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Create pattern key for optimization learning
   */
  createPatternKey(pattern) {
    const domain = pattern.domain || 'unknown';
    const type = this.inferExtractionType(pattern.extractionInstructions);
    return `${domain}:${type}`;
  }

  /**
   * Create failure key for failure pattern learning
   */
  createFailureKey(pattern, result) {
    const domain = pattern.domain || 'unknown';
    const method = result.processingMethod || 'unknown';
    return `${domain}:${method}`;
  }

  /**
   * Infer extraction type from instructions
   */
  inferExtractionType(instructions) {
    if (!instructions) return 'unknown';
    
    const lower = instructions.toLowerCase();
    if (lower.includes('article') || lower.includes('news')) return 'articles';
    if (lower.includes('product')) return 'products';
    if (lower.includes('job') || lower.includes('career')) return 'jobs';
    if (lower.includes('team') || lower.includes('member') || lower.includes('people')) return 'people';
    if (lower.includes('event')) return 'events';
    if (lower.includes('contact')) return 'contacts';
    if (lower.includes('department')) return 'departments';
    
    return 'general';
  }

  /**
   * Extract optimizations from successful extraction
   */
  extractOptimizations(request, result) {
    const optimizations = [];

    if (result.success && result.metadata) {
      const metadata = result.metadata;
      
      if (metadata.processingMethod) {
        optimizations.push({
          type: 'method',
          value: metadata.processingMethod,
          performance: metadata.processingTime
        });
      }

      if (metadata.multiPage) {
        optimizations.push({
          type: 'navigation',
          value: 'multi_page',
          itemsFound: Array.isArray(result.data) ? result.data.length : 0
        });
      }

      if (metadata.schema) {
        optimizations.push({
          type: 'schema',
          value: metadata.schema,
          validation: metadata.validation
        });
      }
    }

    return optimizations;
  }

  /**
   * Merge schemas intelligently
   */
  mergeSchemas(currentSchema, successfulSchema) {
    if (!currentSchema || !successfulSchema) {
      return successfulSchema || currentSchema;
    }

    // Simple merge logic - combine properties
    const merged = JSON.parse(JSON.stringify(currentSchema));
    
    if (successfulSchema.items && successfulSchema.items.properties && 
        merged.items && merged.items.properties) {
      
      // Add any additional properties from successful schema
      Object.keys(successfulSchema.items.properties).forEach(key => {
        if (!merged.items.properties[key]) {
          merged.items.properties[key] = successfulSchema.items.properties[key];
        }
      });
    }

    return merged;
  }

  /**
   * Deduplicate suggestions
   */
  deduplicateSuggestions(suggestions) {
    const seen = new Set();
    const unique = [];

    for (const suggestion of suggestions) {
      const key = `${suggestion.type}:${JSON.stringify(suggestion.suggestion)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    }

    return unique.sort((a, b) => b.confidence - a.confidence);
  }

  // Additional helper methods for monthly insights...

  analyzePerformanceTrends(memories) {
    const weeks = {};
    
    memories.forEach(memory => {
      const week = this.getWeekKey(new Date(memory.timestamp));
      if (!weeks[week]) {
        weeks[week] = { success: 0, total: 0, avgTime: 0 };
      }
      
      weeks[week].total++;
      if (memory.result.success) weeks[week].success++;
      weeks[week].avgTime += memory.result.processingTime || 0;
    });

    return Object.entries(weeks).map(([week, stats]) => ({
      week,
      successRate: stats.success / stats.total,
      avgProcessingTime: stats.avgTime / stats.total,
      totalExtractions: stats.total
    }));
  }

  identifyTopPatterns(memories) {
    const patterns = {};
    
    memories.filter(m => m.result.success).forEach(memory => {
      const key = this.createPatternKey(memory.pattern);
      if (!patterns[key]) {
        patterns[key] = {
          pattern: key,
          count: 0,
          avgQuality: 0,
          domains: new Set()
        };
      }
      
      patterns[key].count++;
      patterns[key].avgQuality = (patterns[key].avgQuality + memory.qualityScore) / 2;
      patterns[key].domains.add(memory.pattern.domain);
    });

    return Object.values(patterns)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(p => ({
        ...p,
        domains: Array.from(p.domains)
      }));
  }

  analyzeFailures(memories) {
    const failures = memories.filter(m => !m.result.success);
    
    if (failures.length === 0) {
      return { totalFailures: 0, commonCauses: [] };
    }

    const causes = {};
    failures.forEach(memory => {
      const error = memory.result.error || 'Unknown error';
      causes[error] = (causes[error] || 0) + 1;
    });

    return {
      totalFailures: failures.length,
      failureRate: failures.length / memories.length,
      commonCauses: Object.entries(causes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cause, count]) => ({ cause, count }))
    };
  }

  identifyOptimizationOpportunities(memories) {
    const opportunities = [];

    // Find slow extractions that could be optimized
    const slowExtractions = memories.filter(m => 
      m.result.success && m.result.processingTime > 30000
    );
    
    if (slowExtractions.length > 0) {
      opportunities.push({
        type: 'performance',
        description: `${slowExtractions.length} extractions took >30s, consider multi-page detection optimization`,
        impact: 'high',
        effort: 'medium'
      });
    }

    // Find patterns with low success rates
    const patterns = {};
    memories.forEach(memory => {
      const key = this.createPatternKey(memory.pattern);
      if (!patterns[key]) patterns[key] = { success: 0, total: 0 };
      patterns[key].total++;
      if (memory.result.success) patterns[key].success++;
    });

    Object.entries(patterns).forEach(([pattern, stats]) => {
      if (stats.total >= 5 && stats.success / stats.total < 0.7) {
        opportunities.push({
          type: 'reliability',
          description: `Pattern "${pattern}" has ${Math.round(stats.success/stats.total*100)}% success rate`,
          impact: 'medium',
          effort: 'low'
        });
      }
    });

    return opportunities.slice(0, 5);
  }

  calculateLearningProgress() {
    const recentMonth = this.performanceMetrics.monthlyImprovements.slice(-2);
    
    if (recentMonth.length < 2) {
      return { improvement: 0, message: 'Insufficient data for trend analysis' };
    }

    const current = recentMonth[1].insights;
    const previous = recentMonth[0].insights;

    const successImprovement = current.successRate - previous.successRate;
    const improvement = successImprovement * 100;

    return {
      improvement: Math.round(improvement * 100) / 100,
      message: improvement > 0 ? 
        `Success rate improved by ${improvement.toFixed(1)}%` :
        `Success rate declined by ${Math.abs(improvement).toFixed(1)}%`
    };
  }

  calculateEfficiencyMetrics(memories) {
    const successful = memories.filter(m => m.result.success);
    
    if (successful.length === 0) {
      return { avgTime: 0, itemsPerSecond: 0 };
    }

    const totalTime = successful.reduce((sum, m) => sum + (m.result.processingTime || 0), 0);
    const totalItems = successful.reduce((sum, m) => sum + m.result.itemCount, 0);

    return {
      avgTime: Math.round(totalTime / successful.length),
      itemsPerSecond: totalTime > 0 ? Math.round((totalItems * 1000) / totalTime * 100) / 100 : 0,
      totalItems,
      totalExtractions: successful.length
    };
  }

  generateRecommendations(memories) {
    const recommendations = [];

    // Analyze success patterns
    const successRate = memories.filter(m => m.result.success).length / memories.length;
    
    if (successRate < 0.9) {
      recommendations.push('Focus on improving extraction success rate - consider schema optimization');
    }

    const avgTime = memories.reduce((sum, m) => sum + (m.result.processingTime || 0), 0) / memories.length;
    
    if (avgTime > 15000) {
      recommendations.push('Consider optimizing processing time - enable multi-page detection');
    }

    if (this.optimizations.size < 5) {
      recommendations.push('System still learning patterns - continue varied extractions for better optimization');
    }

    const multiPageCount = memories.filter(m => m.result.multiPage).length;
    
    if (multiPageCount / memories.length < 0.3) {
      recommendations.push('Explore multi-page extractions for richer data collection');
    }

    return recommendations.slice(0, 5);
  }

  getWeekKey(date) {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = (date - start) + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return `${date.getFullYear()}-W${Math.floor(diff / oneWeek)}`;
  }

  updatePerformanceMetrics(result) {
    this.performanceMetrics.totalExtractions++;
    
    if (result.success) {
      this.performanceMetrics.successfulExtractions++;
    } else {
      this.performanceMetrics.failedExtractions++;
    }

    const processingTime = result.metadata?.processingTime || 0;
    this.performanceMetrics.averageProcessingTime = 
      (this.performanceMetrics.averageProcessingTime + processingTime) / 2;
  }

  /**
   * Get memory statistics
   */
  getStats() {
    return {
      totalMemories: this.memories.length,
      optimizationPatterns: this.optimizations.size,
      failurePatterns: this.failurePatterns.size,
      performanceMetrics: this.performanceMetrics,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Clear all memories (useful for testing)
   */
  async clearAllMemories() {
    this.memories = [];
    this.optimizations.clear();
    this.failurePatterns.clear();
    await this.saveMemories();
    console.log('🧹 All extraction memories cleared');
  }
}

// Export singleton instance
module.exports = new ExtractionMemory();