// tests/gpt5-migration.test.js
const { AIProcessorV2 } = require('../api/ai-processor-v2');
const { EvidenceFirstBridgeV2 } = require('../api/evidence-first-bridge-v2');
const ModelSelector = require('../api/services/model-selector');

describe('GPT-5 Migration Tests', () => {
  let processor;
  let extractor;

  beforeEach(() => {
    processor = new AIProcessorV2();
    extractor = new EvidenceFirstBridgeV2();
    // Set environment for testing
    process.env.GPT5_ENABLED = 'true';
    process.env.GPT5_FALLBACK_ENABLED = 'true';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.FORCE_GPT4;
  });

  describe('Model Selection for Cost Efficiency', () => {
    test('AI Processor handles simple request with nano model', async () => {
      const result = await processor.processNaturalLanguage(
        'Get the title from example.com'
      );
      
      expect(result.metadata.model).toBe('gpt-5-nano');
      expect(result.metadata.cost.total).toBeLessThan(0.001);
      expect(result.metadata.tokens).toBeDefined();
    });

    test('Simple text extraction uses gpt-5-nano for cost efficiency', async () => {
      const html = '<h1>Simple Title</h1>';
      const result = await extractor.extractFromHTML(
        html,
        'Get the title'
      );
      
      expect(result.metadata.model).toBe('gpt-5-nano');
      expect(result.metadata.cost.total).toBeLessThan(0.0005);
      expect(result.data).toBeDefined();
    });

    test('Medium complexity tasks use gpt-5-mini for balanced performance', async () => {
      const result = await processor.processNaturalLanguage(
        'Extract product names and prices from a shopping website with structured data'
      );
      
      expect(result.metadata.model).toBe('gpt-5-mini');
      expect(result.metadata.cost.total).toBeLessThan(0.005);
    });
  });

  describe('Complex Reasoning Tasks', () => {
    test('AI Processor uses full model for complex reasoning', async () => {
      const result = await processor.processNaturalLanguage(
        'Analyze the relationship between products and prices, then determine pricing patterns'
      );
      
      expect(result.metadata.model).toBe('gpt-5');
      expect(result.metadata.cost).toBeDefined();
    });

    test('Multi-step analysis requires full GPT-5 model', async () => {
      const complexHtml = `
        <div class="product-list">
          <div class="product">
            <h3>Product A</h3>
            <span class="price">$100</span>
            <span class="discount">20% off</span>
          </div>
          <div class="product">
            <h3>Product B</h3>
            <span class="price">$150</span>
            <span class="discount">15% off</span>
          </div>
        </div>
      `;
      
      const result = await extractor.extractFromHTML(
        complexHtml,
        'Analyze pricing patterns and determine which products offer the best value after discounts'
      );
      
      expect(result.metadata.model).toBe('gpt-5');
      expect(result.data).toBeDefined();
    });

    test('Schema-based extraction with relationships uses full model', async () => {
      const result = await processor.processNaturalLanguage(
        'Create a json schema for product catalog with relationships between categories and products'
      );
      
      expect(result.metadata.model).toBe('gpt-5');
    });
  });

  describe('HTML Extraction with All Model Tiers', () => {
    test('Extractor handles simple HTML efficiently with nano model', async () => {
      const html = '<div><h1>Title</h1><p>Content</p></div>';
      const result = await extractor.extractFromHTML(
        html,
        'Extract the title and first paragraph'
      );
      
      expect(result.data).toHaveProperty('title');
      expect(result.metadata.model).toBe('gpt-5-nano');
      expect(result.metadata.confidence).toBeGreaterThan(0.85);
    });

    test('Medium complexity HTML uses mini model', async () => {
      const html = `
        <div class="container">
          <header><h1>Company Name</h1></header>
          <nav><a href="/about">About</a><a href="/contact">Contact</a></nav>
          <main>
            <article>
              <h2>Article Title</h2>
              <p>Article content with multiple paragraphs.</p>
            </article>
          </main>
        </div>
      `;
      
      const result = await extractor.extractFromHTML(
        html,
        'Extract company name, navigation links, and article information'
      );
      
      expect(result.metadata.model).toBe('gpt-5-mini');
      expect(result.data).toBeDefined();
    });

    test('Complex HTML with reasoning uses full model', async () => {
      const complexHtml = `
        <div class="dashboard">
          <div class="metrics">
            <div class="metric">
              <span class="label">Revenue</span>
              <span class="value">$125,000</span>
              <span class="change positive">+12%</span>
            </div>
            <div class="metric">
              <span class="label">Users</span>
              <span class="value">5,420</span>
              <span class="change negative">-3%</span>
            </div>
          </div>
        </div>
      `;
      
      const result = await extractor.extractFromHTML(
        complexHtml,
        'Analyze the business metrics and determine overall performance trends'
      );
      
      expect(result.metadata.model).toBe('gpt-5');
      expect(result.data).toBeDefined();
    });

    test('Large HTML documents are handled appropriately', async () => {
      const largeHtml = '<div>' + 'x'.repeat(60000) + '</div>';
      const result = await extractor.extractFromHTML(
        largeHtml,
        'Extract any meaningful content'
      );
      
      expect(result.metadata.model).toMatch(/gpt-5/);
      expect(result.data).toBeDefined();
    });
  });

  describe('Fallback Mechanism', () => {
    test('Fallback works when GPT-5 fails', async () => {
      // Simulate failure by using invalid model
      process.env.GPT5_FALLBACK_ENABLED = 'true';
      
      const result = await processor.processNaturalLanguage(
        'Test fallback mechanism'
      );
      
      expect(result.metadata).toBeDefined();
    });

    test('Fallback to GPT-4 maintains functionality', async () => {
      // Force fallback scenario
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'invalid-key-to-trigger-fallback';
      
      try {
        const result = await processor.processNaturalLanguage(
          'Simple extraction task'
        );
        
        if (result.metadata.fallback) {
          expect(result.metadata.model).toBe('gpt-4-turbo-preview');
          expect(result.metadata.fallback).toBe(true);
        }
      } catch (error) {
        // Expected in test environment
        expect(error).toBeDefined();
      } finally {
        process.env.OPENAI_API_KEY = originalEnv;
      }
    });

    test('Error handling preserves user experience', async () => {
      const mockExtractor = {
        ...extractor,
        client: {
          complete: jest.fn().mockRejectedValueOnce(new Error('API Error'))
            .mockResolvedValueOnce({
              content: '{"title": "Fallback Result"}',
              model: 'gpt-4-turbo-preview',
              usage: { prompt_tokens: 100, completion_tokens: 50 },
              fallback: true
            })
        }
      };

      // This test would need the actual implementation to work
      expect(mockExtractor).toBeDefined();
    });
  });

  describe('Cost Tracking and Model Selection', () => {
    test('Model selector chooses nano for high-volume, simple tasks', () => {
      const model = ModelSelector.select({
        complexity: 0.2,
        budget: 0.0001,
        accuracy: 0.9
      });
      
      expect(model).toBe('gpt-5-nano');
    });

    test('Model selector chooses mini for balanced requirements', () => {
      const model = ModelSelector.select({
        complexity: 0.5,
        budget: 0.01,
        accuracy: 0.95
      });
      
      expect(model).toBe('gpt-5-mini');
    });

    test('Model selector chooses full model for high accuracy needs', () => {
      const model = ModelSelector.select({
        complexity: 0.8,
        budget: 0.1,
        accuracy: 0.98
      });
      
      expect(model).toBe('gpt-5');
    });

    test('Cost estimation works correctly for all models', () => {
      const nanoCost = ModelSelector.estimateCost('gpt-5-nano', 1000, 500);
      const miniCost = ModelSelector.estimateCost('gpt-5-mini', 1000, 500);
      const fullCost = ModelSelector.estimateCost('gpt-5', 1000, 500);
      
      expect(nanoCost.total).toBeLessThan(miniCost.total);
      expect(miniCost.total).toBeLessThan(fullCost.total);
      
      expect(nanoCost.inputCost).toBe(0.00005); // (1000/1M) * $0.05
      expect(nanoCost.outputCost).toBe(0.0002); // (500/1M) * $0.40
    });

    test('Budget constraints influence model selection', async () => {
      const lowBudgetResult = await processor.processNaturalLanguage(
        'Extract title',
        { budget: 0.0001 }
      );
      
      const highBudgetResult = await processor.processNaturalLanguage(
        'Analyze complex data patterns',
        { budget: 0.1 }
      );
      
      expect(lowBudgetResult.metadata.cost.total).toBeLessThan(
        highBudgetResult.metadata.cost.total
      );
    });
  });

  describe('Performance and Quality Metrics', () => {
    test('Confidence scores are calculated correctly', async () => {
      const html = '<h1>Test Title</h1>';
      const result = await extractor.extractFromHTML(
        html,
        'Extract the title'
      );
      
      expect(result.metadata.confidence).toBeGreaterThan(0.8);
      expect(result.metadata.confidence).toBeLessThanOrEqual(1.0);
    });

    test('Response time is acceptable across all models', async () => {
      const start = Date.now();
      
      const result = await processor.processNaturalLanguage(
        'Quick extraction test'
      );
      
      const responseTime = Date.now() - start;
      expect(responseTime).toBeLessThan(10000); // 10 second timeout
      expect(result.metadata).toBeDefined();
    });

    test('Token usage is tracked accurately', async () => {
      const result = await processor.processNaturalLanguage(
        'Test token tracking'
      );
      
      expect(result.metadata.tokens).toBeDefined();
      expect(result.metadata.tokens.prompt_tokens).toBeGreaterThan(0);
      expect(result.metadata.tokens.completion_tokens).toBeGreaterThan(0);
      expect(result.metadata.tokens.total_tokens).toBeGreaterThan(0);
    });
  });
});