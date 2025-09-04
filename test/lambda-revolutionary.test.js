/**
 * Test Suite for Revolutionary Lambda Handler
 * 
 * Tests the revolutionary Lambda handler functionality:
 * - Revolutionary extraction endpoint
 * - Revolutionary AI processing
 * - Feature flags and backward compatibility
 * - Error handling and fallbacks
 * - Response format transformation
 */

const { 
  handler, 
  handleRevolutionaryExtraction,
  handleRevolutionaryAIProcess,
  transformToRevolutionaryFormat,
  REVOLUTIONARY_FEATURES 
} = require('../api/lambda-revolutionary');

// Mock revolutionary extraction engine
jest.mock('../api/revolutionary-extraction-engine', () => ({
  RevolutionaryExtractionEngine: class {
    constructor() {
      this.revolutionaryExtract = jest.fn();
    }
  }
}));

// Mock existing evidence-first-bridge
jest.mock('../api/evidence-first-bridge', () => ({
  handler: jest.fn()
}));

describe('Revolutionary Lambda Handler', () => {
  let mockEvent, mockContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEvent = {
      pathParameters: { proxy: 'api/extract' },
      headers: { 'x-api-key': 'test-key-123' },
      body: JSON.stringify({
        url: 'https://test.com',
        extractionInstructions: 'Extract test data',
        schema: {
          type: 'array',
          items: { type: 'object', properties: { title: { type: 'string' } } }
        }
      }),
      requestContext: {
        identity: { sourceIp: '127.0.0.1' }
      }
    };

    mockContext = {};
  });

  describe('🚀 Main Handler Routing', () => {
    test('should route health check requests correctly', async () => {
      mockEvent.pathParameters = { proxy: 'health' };

      const response = await handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.service).toBe('Atlas Codex Revolutionary System');
      expect(body.revolutionary_engine).toBeDefined();
      expect(body.capabilities).toBeDefined();
    });

    test('should route extraction requests to revolutionary handler', async () => {
      const response = await handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(200);
      // Should reach revolutionary extraction logic
      expect(response.headers['X-Powered-By']).toContain('Revolutionary');
    });

    test('should route AI processing requests correctly', async () => {
      mockEvent.pathParameters = { proxy: 'api/ai/process' };
      mockEvent.body = JSON.stringify({
        prompt: 'Extract data from https://test.com',
        autoExecute: true
      });

      const response = await handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.processing_mode).toBeDefined();
    });

    test('should return 404 for unknown endpoints', async () => {
      mockEvent.pathParameters = { proxy: 'unknown/endpoint' };

      const response = await handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.available_endpoints).toBeDefined();
    });

    test('should return 401 for invalid API key', async () => {
      mockEvent.headers = { 'x-api-key': 'invalid-key' };

      const response = await handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('🔬 Revolutionary Extraction Handling', () => {
    test('should use revolutionary engine when enabled', async () => {
      // Mock revolutionary features enabled
      const originalEnabled = REVOLUTIONARY_FEATURES.ENABLED;
      REVOLUTIONARY_FEATURES.ENABLED = true;

      const mockRevolutionaryResult = {
        success: true,
        data: [{ title: 'Revolutionary Result' }],
        intelligence: {
          understanding: { intent: 'Test extraction' },
          confidence: 0.95,
          alternatives: [],
          insights: [{ type: 'success', message: 'High quality extraction' }]
        },
        revolution: {
          cost_savings: 94,
          model_used: 'gpt-5-mini',
          processing_time_ms: 1500,
          revolution_score: 87
        },
        metadata: { processingMethod: 'revolutionary_extraction_engine' },
        qa: {
          ask: async () => ({ answer: 'Test answer' })
        }
      };

      const { RevolutionaryExtractionEngine } = require('../api/revolutionary-extraction-engine');
      RevolutionaryExtractionEngine.prototype.revolutionaryExtract.mockResolvedValue(mockRevolutionaryResult);

      const requestData = {
        url: 'https://test.com',
        extractionInstructions: 'Extract test data'
      };

      const response = await handleRevolutionaryExtraction(requestData, mockEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.intelligence).toBeDefined();
      expect(body.intelligence.confidence).toBe(0.95);
      expect(body.optimization).toBeDefined();
      expect(body.optimization.cost_savings).toBe('94% vs GPT-4');
      expect(body.powered_by).toBe('Atlas Codex Revolutionary Engine v2.0');

      // Restore original setting
      REVOLUTIONARY_FEATURES.ENABLED = originalEnabled;
    });

    test('should fallback to existing system when revolutionary disabled', async () => {
      const originalEnabled = REVOLUTIONARY_FEATURES.ENABLED;
      REVOLUTIONARY_FEATURES.ENABLED = false;

      const mockExistingResult = {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: [{ title: 'Legacy Result' }],
          metadata: { processingMethod: 'evidence_first_bridge' }
        })
      };

      const evidenceFirstBridge = require('../api/evidence-first-bridge');
      evidenceFirstBridge.handler.mockResolvedValue(mockExistingResult);

      const requestData = {
        url: 'https://test.com',
        extractionInstructions: 'Extract test data'
      };

      const response = await handleRevolutionaryExtraction(requestData, mockEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.powered_by).toBe('Atlas Codex Legacy Bridge');
      expect(body.optimization.cost_savings).toBe('0% (legacy mode)');

      REVOLUTIONARY_FEATURES.ENABLED = originalEnabled;
    });

    test('should handle revolutionary engine errors gracefully', async () => {
      const originalEnabled = REVOLUTIONARY_FEATURES.ENABLED;
      REVOLUTIONARY_FEATURES.ENABLED = true;

      const { RevolutionaryExtractionEngine } = require('../api/revolutionary-extraction-engine');
      RevolutionaryExtractionEngine.prototype.revolutionaryExtract.mockRejectedValue(
        new Error('Revolutionary engine failed')
      );

      // Mock successful fallback
      const evidenceFirstBridge = require('../api/evidence-first-bridge');
      evidenceFirstBridge.handler.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: [{ title: 'Fallback Result' }]
        })
      });

      const requestData = {
        url: 'https://test.com',
        extractionInstructions: 'Extract test data'
      };

      const response = await handleRevolutionaryExtraction(requestData, mockEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.revolution_fallback).toBeDefined();
      expect(body.revolution_fallback.reason).toBe('revolutionary_engine_error');
      expect(body.revolution_fallback.fallback_used).toBe(true);

      REVOLUTIONARY_FEATURES.ENABLED = originalEnabled;
    });
  });

  describe('🧠 Revolutionary AI Processing', () => {
    test('should process AI requests with revolutionary engine', async () => {
      const originalEnabled = REVOLUTIONARY_FEATURES.ENABLED;
      REVOLUTIONARY_FEATURES.ENABLED = true;

      const mockRevolutionaryResult = {
        success: true,
        data: [{ title: 'AI Processed Result' }],
        intelligence: {
          understanding: { intent: 'AI processing request' },
          confidence: 0.92
        },
        revolution: {
          cost_savings: 96,
          model_used: 'gpt-5-nano'
        }
      };

      const { RevolutionaryExtractionEngine } = require('../api/revolutionary-extraction-engine');
      RevolutionaryExtractionEngine.prototype.revolutionaryExtract.mockResolvedValue(mockRevolutionaryResult);

      const requestData = {
        prompt: 'Extract articles from https://news.com',
        autoExecute: true
      };

      const response = await handleRevolutionaryAIProcess(requestData, mockEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.success).toBe(true);
      expect(body.message).toContain('Revolutionary AI processing completed');
      expect(body.processing_mode).toBe('revolutionary_ai');
      expect(body.result).toBeDefined();
      expect(body.revolution).toBeDefined();

      REVOLUTIONARY_FEATURES.ENABLED = originalEnabled;
    });

    test('should extract URL from AI prompts', async () => {
      const requestData = {
        prompt: 'Get me all the articles from https://techcrunch.com about AI',
        autoExecute: true
      };

      // Mock the revolutionary engine to capture the extracted URL
      const { RevolutionaryExtractionEngine } = require('../api/revolutionary-extraction-engine');
      let capturedRequest;
      RevolutionaryExtractionEngine.prototype.revolutionaryExtract.mockImplementation((request) => {
        capturedRequest = request;
        return Promise.resolve({
          success: true,
          data: [],
          intelligence: { confidence: 0.8 },
          revolution: { cost_savings: 90 }
        });
      });

      await handleRevolutionaryAIProcess(requestData, mockEvent);

      expect(capturedRequest.url).toBe('https://techcrunch.com');
      expect(capturedRequest.extractionInstructions).toContain('AI');
    });
  });

  describe('🎛️ Feature Flag Management', () => {
    test('should return comprehensive feature status', async () => {
      mockEvent.pathParameters = { proxy: 'revolutionary/features' };

      const response = await handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.revolutionary_features).toBeDefined();
      expect(body.description).toBeDefined();
      expect(body.configuration).toBeDefined();
      
      // Check all feature flags are present
      expect(body.revolutionary_features).toHaveProperty('ENABLED');
      expect(body.revolutionary_features).toHaveProperty('DEEP_REASONING');
      expect(body.revolutionary_features).toHaveProperty('MEMORY_LEARNING');
      expect(body.revolutionary_features).toHaveProperty('QA_INTERFACE');
      expect(body.revolutionary_features).toHaveProperty('PREDICTIVE_CRAWLING');
      expect(body.revolutionary_features).toHaveProperty('COST_OPTIMIZATION');
    });

    test('should return revolutionary system statistics', async () => {
      mockEvent.pathParameters = { proxy: 'revolutionary/stats' };

      const response = await handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.revolutionary_metrics).toBeDefined();
      expect(body.intelligence_usage).toBeDefined();
      expect(body.learning_progress).toBeDefined();
      expect(body.cost_analysis).toBeDefined();
      
      // Verify specific metrics
      expect(body.revolutionary_metrics.average_cost_savings).toContain('%');
      expect(body.cost_analysis.total_savings_usd).toContain('$');
      expect(body.learning_progress.monthly_improvement).toContain('%');
    });
  });

  describe('🔄 Response Format Transformation', () => {
    test('should transform revolutionary results correctly', () => {
      const revolutionaryResult = {
        success: true,
        data: [{ title: 'Test Article', author: 'Test Author' }],
        intelligence: {
          understanding: { intent: 'Article extraction', complexity: 0.6 },
          confidence: 0.94,
          alternatives: [{ approach: 'simplified', confidence_boost: 0.1 }],
          insights: [{ type: 'success', message: 'High quality extraction' }]
        },
        revolution: {
          cost_savings: 93,
          model_used: 'gpt-5-mini',
          processing_time_ms: 2100,
          revolution_score: 85
        },
        metadata: { processingMethod: 'revolutionary_extraction_engine' },
        qa: {
          ask: async () => ({ answer: 'Mock answer' })
        }
      };

      const originalRequest = {
        url: 'https://test.com',
        extractionInstructions: 'Extract articles'
      };

      const transformed = transformToRevolutionaryFormat(revolutionaryResult, originalRequest);

      expect(transformed.success).toBe(true);
      expect(transformed.data).toHaveLength(1);
      
      // Verify intelligence layer
      expect(transformed.intelligence.understanding.intent).toBe('Article extraction');
      expect(transformed.intelligence.confidence).toBe(0.94);
      expect(transformed.intelligence.alternatives).toHaveLength(1);
      expect(transformed.intelligence.insights).toHaveLength(1);
      expect(transformed.intelligence.qa).toBeDefined();
      
      // Verify optimization info
      expect(transformed.optimization.cost_savings).toBe('93% vs GPT-4');
      expect(transformed.optimization.model_used).toBe('gpt-5-mini');
      expect(transformed.optimization.revolution_score).toBe(85);
      
      expect(transformed.powered_by).toBe('Atlas Codex Revolutionary Engine v2.0');
    });

    test('should transform legacy results to revolutionary format', () => {
      const legacyResult = {
        success: true,
        data: [{ title: 'Legacy Article' }],
        metadata: {
          processingMethod: 'evidence_first_bridge',
          extraction_confidence: 0.85
        }
      };

      const transformed = transformToRevolutionaryFormat(legacyResult, {});

      expect(transformed.success).toBe(true);
      expect(transformed.intelligence.understanding.intent).toBe('Legacy extraction mode');
      expect(transformed.intelligence.confidence).toBe(0.85);
      expect(transformed.optimization.cost_savings).toBe('0% (legacy mode)');
      expect(transformed.optimization.model_used).toBe('gpt-4o-legacy');
      expect(transformed.powered_by).toBe('Atlas Codex Legacy Bridge');
    });
  });

  describe('🔒 Security & Validation', () => {
    test('should validate API keys correctly', async () => {
      const validKeys = [
        'test-key-123',
        'dev-e41d8c40f0bc54fcc590dc54b7ebe138344afe9dc41690c38bd99c838116405c',
        'prod-28d4434781ec4cef8b68b00a8e84a6f49d133aab1e605504604a088e33ac97f2'
      ];

      for (const key of validKeys) {
        mockEvent.headers = { 'x-api-key': key };
        const response = await handler(mockEvent, mockContext);
        expect(response.statusCode).not.toBe(401);
      }
    });

    test('should parse request body correctly', async () => {
      mockEvent.body = JSON.stringify({
        url: 'https://complex-test.com',
        extractionInstructions: 'Complex extraction',
        schema: { type: 'object' },
        maxPages: 5,
        params: {
          waitFor: 3000,
          onlyMainContent: false
        },
        revolutionary_options: {
          deep_reasoning: true
        }
      });

      // Mock successful processing to verify parsing
      const { RevolutionaryExtractionEngine } = require('../api/revolutionary-extraction-engine');
      let capturedRequest;
      RevolutionaryExtractionEngine.prototype.revolutionaryExtract.mockImplementation((request) => {
        capturedRequest = request;
        return Promise.resolve({
          success: true,
          data: [],
          intelligence: { confidence: 0.8 },
          revolution: { cost_savings: 90 }
        });
      });

      await handler(mockEvent, mockContext);

      expect(capturedRequest.url).toBe('https://complex-test.com');
      expect(capturedRequest.maxPages).toBe(5);
    });
  });

  describe('⚠️ Error Handling', () => {
    test('should handle JSON parsing errors gracefully', async () => {
      mockEvent.body = 'invalid json{';

      const response = await handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    test('should handle missing extraction system gracefully', async () => {
      // Mock both revolutionary and existing systems failing
      const { RevolutionaryExtractionEngine } = require('../api/revolutionary-extraction-engine');
      RevolutionaryExtractionEngine.prototype.revolutionaryExtract.mockRejectedValue(
        new Error('Revolutionary failed')
      );

      const evidenceFirstBridge = require('../api/evidence-first-bridge');
      evidenceFirstBridge.handler.mockRejectedValue(new Error('Legacy failed'));

      const requestData = {
        url: 'https://test.com',
        extractionInstructions: 'Extract data'
      };

      const response = await handleRevolutionaryExtraction(requestData, mockEvent);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.revolution_fallback.reason).toBe('revolutionary_engine_error');
    });

    test('should include proper CORS headers', async () => {
      const response = await handler(mockEvent, mockContext);

      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('📊 Integration & Performance', () => {
    test('should maintain backward compatibility', async () => {
      // Test with legacy request format
      mockEvent.body = JSON.stringify({
        url: 'https://legacy-test.com',
        extractionInstructions: 'Extract legacy data',
        UNIFIED_EXTRACTOR_ENABLED: true
      });

      const response = await handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBeDefined();
    });

    test('should handle high-volume concurrent requests', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const event = {
          ...mockEvent,
          body: JSON.stringify({
            url: `https://test-${i}.com`,
            extractionInstructions: `Extract data ${i}`
          })
        };
        promises.push(handler(event, mockContext));
      }

      const results = await Promise.all(promises);
      
      results.forEach(response => {
        expect(response.statusCode).toBe(200);
      });
    });
  });
});

describe('🔧 Utility Functions', () => {
  test('should extract URLs from prompts correctly', () => {
    const { handler } = require('../api/lambda-revolutionary');
    
    // This would need to be exported if we want to test it directly
    // For now, we test it through the AI processing functionality
  });

  test('should create proper response format', async () => {
    mockEvent.pathParameters = { proxy: 'health' };
    
    const response = await handler(mockEvent, {});
    
    expect(response).toHaveProperty('statusCode');
    expect(response).toHaveProperty('headers');
    expect(response).toHaveProperty('body');
    expect(response.headers['Content-Type']).toBe('application/json');
  });
});

module.exports = {
  mockEvent: () => mockEvent
};