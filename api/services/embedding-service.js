/**
 * Embedding Service for Atlas Codex
 * 
 * Provides embedding generation and similarity calculations for extraction patterns
 * Uses OpenAI's text-embedding-3-small for cost-effectiveness and accuracy
 * Includes caching for performance optimization
 */

const crypto = require('crypto');

class EmbeddingService {
  constructor() {
    this.openai = null;
    this.cache = new Map(); // In-memory cache (production should use Redis)
    this.initializeOpenAI();
  }

  /**
   * Initialize OpenAI client for embeddings
   */
  initializeOpenAI() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey && apiKey.length > 10) {
        const OpenAI = require('openai');
        this.openai = new OpenAI({ apiKey });
        console.log('✅ Embedding service initialized with OpenAI');
      } else {
        console.warn('❌ OpenAI API key not found - embedding service will be disabled');
      }
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI for embeddings:', error.message);
    }
  }

  /**
   * Generate cache key for text content
   */
  getCacheKey(text) {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * Generate embedding for text content
   */
  async generateEmbedding(text) {
    if (!this.openai) {
      throw new Error('Embedding service not initialized - OpenAI client missing');
    }

    if (!text || typeof text !== 'string') {
      throw new Error('Text is required for embedding generation');
    }

    // Check cache first
    const cacheKey = this.getCacheKey(text);
    if (this.cache.has(cacheKey)) {
      console.log('📦 Using cached embedding');
      return this.cache.get(cacheKey);
    }

    try {
      console.log('🔄 Generating new embedding...');
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small', // Cost-effective, good quality
        input: text.substring(0, 8000), // Limit input size for cost control
        encoding_format: 'float'
      });

      const embedding = response.data[0].embedding;
      
      // Cache the result
      this.cache.set(cacheKey, embedding);
      
      // Prevent memory overflow (keep only 1000 most recent)
      if (this.cache.size > 1000) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      console.log(`✅ Generated embedding (${embedding.length} dimensions)`);
      return embedding;
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error.message);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateSimilarity(embedding1, embedding2) {
    if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
      throw new Error('Embeddings must be arrays');
    }

    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have same dimensions');
    }

    // Calculate dot product
    let dotProduct = 0;
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
    }

    // Calculate magnitudes
    let magnitude1 = 0;
    let magnitude2 = 0;
    for (let i = 0; i < embedding1.length; i++) {
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    // Avoid division by zero
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    // Calculate cosine similarity
    const similarity = dotProduct / (magnitude1 * magnitude2);
    return Math.max(-1, Math.min(1, similarity)); // Clamp to [-1, 1]
  }

  /**
   * Generate embedding for an extraction pattern
   * Combines URL, instructions, and schema into a unified representation
   */
  async generatePatternEmbedding(extractionPattern) {
    const {
      url = '',
      extractionInstructions = '',
      schema = {},
      metadata = {}
    } = extractionPattern;

    // Create a comprehensive text representation of the pattern
    const patternText = [
      `URL: ${url}`,
      `Instructions: ${extractionInstructions}`,
      `Schema: ${JSON.stringify(schema)}`,
      `Domain: ${this.extractDomain(url)}`,
      `Type: ${metadata.extractionType || 'unknown'}`,
      `Fields: ${this.extractSchemaFields(schema).join(', ')}`
    ].join(' | ');

    return await this.generateEmbedding(patternText);
  }

  /**
   * Find similar patterns based on embedding similarity
   */
  async findSimilarPatterns(targetPattern, storedPatterns, threshold = 0.7) {
    if (!Array.isArray(storedPatterns) || storedPatterns.length === 0) {
      return [];
    }

    const targetEmbedding = await this.generatePatternEmbedding(targetPattern);
    const similarities = [];

    for (const storedPattern of storedPatterns) {
      if (!storedPattern.embedding) {
        console.warn('Stored pattern missing embedding, skipping');
        continue;
      }

      const similarity = this.calculateSimilarity(targetEmbedding, storedPattern.embedding);
      
      if (similarity >= threshold) {
        similarities.push({
          pattern: storedPattern,
          similarity,
          matchReasons: this.analyzeMatchReasons(targetPattern, storedPattern, similarity)
        });
      }
    }

    // Sort by similarity (highest first)
    return similarities.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Extract domain from URL
   */
  extractDomain(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Extract field names from schema
   */
  extractSchemaFields(schema) {
    if (!schema || typeof schema !== 'object') {
      return [];
    }

    const fields = [];
    
    if (schema.items && schema.items.properties) {
      fields.push(...Object.keys(schema.items.properties));
    } else if (schema.properties) {
      fields.push(...Object.keys(schema.properties));
    }

    return fields;
  }

  /**
   * Analyze why two patterns match
   */
  analyzeMatchReasons(targetPattern, storedPattern, similarity) {
    const reasons = [];

    // Same domain
    if (this.extractDomain(targetPattern.url) === this.extractDomain(storedPattern.pattern.url)) {
      reasons.push('same_domain');
    }

    // Similar instructions
    const targetWords = (targetPattern.extractionInstructions || '').toLowerCase().split(/\s+/);
    const storedWords = (storedPattern.pattern.extractionInstructions || '').toLowerCase().split(/\s+/);
    const commonWords = targetWords.filter(word => storedWords.includes(word));
    
    if (commonWords.length > 0) {
      reasons.push('similar_instructions');
    }

    // Similar schema fields
    const targetFields = this.extractSchemaFields(targetPattern.schema);
    const storedFields = this.extractSchemaFields(storedPattern.pattern.schema);
    const commonFields = targetFields.filter(field => storedFields.includes(field));
    
    if (commonFields.length > 0) {
      reasons.push('similar_schema');
    }

    // High similarity score
    if (similarity > 0.9) {
      reasons.push('very_high_similarity');
    } else if (similarity > 0.8) {
      reasons.push('high_similarity');
    }

    return reasons;
  }

  /**
   * Generate embedding for extraction results to learn from success/failure patterns
   */
  async generateResultEmbedding(extractionResult) {
    const {
      success = false,
      data = [],
      metadata = {},
      error = null
    } = extractionResult;

    // Create result representation
    const resultText = [
      `Success: ${success}`,
      `Items: ${Array.isArray(data) ? data.length : 0}`,
      `Method: ${metadata.processingMethod || 'unknown'}`,
      `Time: ${metadata.processingTime || 0}ms`,
      `Error: ${error || 'none'}`,
      `Quality: ${this.assessDataQuality(data)}`
    ].join(' | ');

    return await this.generateEmbedding(resultText);
  }

  /**
   * Assess data quality for embedding purposes
   */
  assessDataQuality(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return 'no_data';
    }

    const completeness = data.reduce((total, item) => {
      if (!item || typeof item !== 'object') return total;
      const fields = Object.keys(item);
      const completedFields = fields.filter(key => item[key] != null && item[key] !== '');
      return total + (completedFields.length / fields.length);
    }, 0) / data.length;

    if (completeness > 0.9) return 'high_quality';
    if (completeness > 0.7) return 'medium_quality';
    if (completeness > 0.5) return 'low_quality';
    return 'poor_quality';
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Embedding cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 1000,
      hitRatio: this.hitCount / (this.hitCount + this.missCount) || 0
    };
  }
}

// Export singleton instance
module.exports = new EmbeddingService();