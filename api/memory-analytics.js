/**
 * Memory Analytics API for Atlas Codex
 * 
 * Provides endpoints for accessing extraction memory insights, statistics, and monthly analytics.
 * Designed to be integrated with the main Lambda handler.
 */

const extractionMemory = require('./services/extraction-memory');

class MemoryAnalyticsAPI {
  constructor() {
    this.routes = {
      '/memory/stats': this.getMemoryStats.bind(this),
      '/memory/insights': this.getMonthlyInsights.bind(this),
      '/memory/similar': this.findSimilarExtractions.bind(this),
      '/memory/optimizations': this.getOptimizations.bind(this),
      '/memory/health': this.getHealthCheck.bind(this)
    };
  }

  /**
   * Route handler for memory analytics endpoints
   */
  async handleRequest(path, method, body, headers) {
    try {
      // Check API key
      const apiKey = headers['x-api-key'] || headers['X-API-Key'];
      if (!this.isValidApiKey(apiKey)) {
        return {
          statusCode: 401,
          body: JSON.stringify({
            success: false,
            error: 'Invalid or missing API key'
          })
        };
      }

      // Find matching route
      const handler = this.routes[path];
      if (!handler) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            error: 'Memory analytics endpoint not found'
          })
        };
      }

      // Execute handler
      const result = await handler(body, method);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
        },
        body: JSON.stringify({
          success: true,
          ...result
        })
      };
    } catch (error) {
      console.error('Memory analytics API error:', error);
      
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Internal server error',
          message: error.message
        })
      };
    }
  }

  /**
   * Check if API key is valid
   */
  isValidApiKey(apiKey) {
    const validKeys = [
      'dev-e41d8c40f0bc54fcc590dc54b7ebe138344afe9dc41690c38bd99c838116405c',
      'prod-28d4434781ec4cef8b68b00a8e84a6f49d133aab1e605504604a088e33ac97f2',
      'test-key-123',
      process.env.MASTER_API_KEY
    ].filter(Boolean);

    return validKeys.includes(apiKey);
  }

  /**
   * GET /memory/stats - Get memory system statistics
   */
  async getMemoryStats(body, method) {
    const stats = extractionMemory.getStats();
    
    return {
      data: {
        memories: {
          total: stats.totalMemories,
          optimizationPatterns: stats.optimizationPatterns,
          failurePatterns: stats.failurePatterns
        },
        performance: stats.performanceMetrics,
        system: {
          memoryUsage: stats.memoryUsage,
          uptime: process.uptime()
        },
        lastUpdate: new Date().toISOString()
      }
    };
  }

  /**
   * GET /memory/insights - Get monthly insights and learning progress
   */
  async getMonthlyInsights(body, method) {
    const insights = await extractionMemory.generateMonthlyInsights();
    
    return {
      data: insights,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * POST /memory/similar - Find similar extractions for a given pattern
   */
  async findSimilarExtractions(body, method) {
    if (method !== 'POST') {
      throw new Error('Similar extractions endpoint requires POST method');
    }

    const {
      url,
      extractionInstructions,
      schema,
      limit = 5,
      threshold = 0.7
    } = body;

    if (!url || !extractionInstructions) {
      throw new Error('URL and extractionInstructions are required');
    }

    const similar = await extractionMemory.findSimilarExtractions({
      url,
      extractionInstructions,
      schema,
      metadata: {}
    }, limit, threshold);

    return {
      data: {
        query: { url, extractionInstructions, limit, threshold },
        similar: similar.map(s => ({
          id: s.memory.id,
          similarity: s.similarity,
          relevanceScore: s.relevanceScore,
          pattern: {
            url: s.memory.pattern.url,
            domain: s.memory.pattern.domain,
            instructions: s.memory.pattern.extractionInstructions,
            type: s.memory.pattern.metadata?.extractionType
          },
          result: {
            success: s.memory.result.success,
            itemCount: s.memory.result.itemCount,
            processingTime: s.memory.result.processingTime,
            qualityScore: s.memory.qualityScore
          },
          timestamp: s.memory.timestamp,
          timesReferenced: s.memory.timesReferenced
        }))
      }
    };
  }

  /**
   * POST /memory/optimizations - Get optimization suggestions for a pattern
   */
  async getOptimizations(body, method) {
    if (method !== 'POST') {
      throw new Error('Optimizations endpoint requires POST method');
    }

    const { url, extractionInstructions, schema } = body;

    if (!url || !extractionInstructions) {
      throw new Error('URL and extractionInstructions are required');
    }

    const optimizations = await extractionMemory.getSuggestedOptimizations({
      url,
      extractionInstructions,
      schema,
      metadata: {}
    });

    return {
      data: {
        query: { url, extractionInstructions },
        optimizations: {
          suggestions: optimizations.suggestions,
          confidence: optimizations.confidence,
          reasoning: optimizations.reasoning,
          basedOn: optimizations.basedOn
        }
      }
    };
  }

  /**
   * GET /memory/health - Health check for memory system
   */
  async getHealthCheck(body, method) {
    const stats = extractionMemory.getStats();
    const health = {
      status: 'healthy',
      checks: {
        memorySystem: stats.totalMemories >= 0 ? 'ok' : 'error',
        embeddingService: 'ok', // Could add more sophisticated check
        fileStorage: 'ok' // Could check file system access
      },
      metrics: {
        totalMemories: stats.totalMemories,
        successRate: stats.performanceMetrics.totalExtractions > 0 ? 
          stats.performanceMetrics.successfulExtractions / stats.performanceMetrics.totalExtractions : 0,
        avgProcessingTime: stats.performanceMetrics.averageProcessingTime
      },
      version: '1.0.0',
      timestamp: new Date().toISOString()
    };

    // Determine overall health
    const hasErrors = Object.values(health.checks).some(check => check === 'error');
    health.status = hasErrors ? 'degraded' : 'healthy';

    return { data: health };
  }

  /**
   * Get available endpoints for documentation
   */
  getEndpoints() {
    return {
      endpoints: [
        {
          path: '/memory/stats',
          method: 'GET',
          description: 'Get memory system statistics and performance metrics'
        },
        {
          path: '/memory/insights', 
          method: 'GET',
          description: 'Get monthly insights and learning progress analysis'
        },
        {
          path: '/memory/similar',
          method: 'POST',
          description: 'Find similar past extractions for a given pattern',
          body: {
            url: 'string (required)',
            extractionInstructions: 'string (required)',
            schema: 'object (optional)',
            limit: 'number (optional, default: 5)',
            threshold: 'number (optional, default: 0.7)'
          }
        },
        {
          path: '/memory/optimizations',
          method: 'POST', 
          description: 'Get optimization suggestions for an extraction pattern',
          body: {
            url: 'string (required)',
            extractionInstructions: 'string (required)',
            schema: 'object (optional)'
          }
        },
        {
          path: '/memory/health',
          method: 'GET',
          description: 'Health check for the memory system'
        }
      ]
    };
  }
}

// Export singleton instance
module.exports = new MemoryAnalyticsAPI();