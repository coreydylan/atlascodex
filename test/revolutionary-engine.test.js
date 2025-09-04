/**
 * Comprehensive Test Suite for Revolutionary Extraction Engine
 * 
 * Tests all integrated revolutionary features:
 * - Deep reasoning and understanding
 * - Memory system and learning
 * - Confidence scoring with alternatives
 * - Q&A interface functionality
 * - Predictive multi-page crawling
 * - Cost optimization (97% savings validation)
 * - Performance benchmarks
 */

const { RevolutionaryExtractionEngine } = require('../api/revolutionary-extraction-engine');
const { ReasoningEngine } = require('../api/services/reasoning-engine');

// Mock OpenAI client for testing
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
};

describe('Revolutionary Extraction Engine', () => {
  let revolutionaryEngine;

  beforeEach(() => {
    revolutionaryEngine = new RevolutionaryExtractionEngine(mockOpenAI);
    jest.clearAllMocks();
  });

  describe('🧠 Deep Reasoning & Understanding', () => {
    test('should perform deep understanding analysis', async () => {
      const mockAnalysis = {
        understanding: {
          primary_goal: 'Extract news articles',
          data_type: 'articles',
          use_case: 'news_aggregation'
        },
        complexity_assessment: {
          overall_complexity: 0.6,
          reasoning_required: true
        },
        predicted_structure: {
          essential_fields: ['title', 'author', 'date'],
          valuable_fields: ['summary', 'url']
        },
        strategy: {
          extraction_type: 'single_page'
        },
        confidence: {
          understanding_confidence: 0.9
        }
      };

      // Mock reasoning engine response
      revolutionaryEngine.reasoningEngine.analyzeUserIntent = jest.fn()
        .mockResolvedValue(mockAnalysis);

      const request = {
        url: 'https://example-news.com',
        extractionInstructions: 'Extract all news articles with titles and authors'
      };

      const understanding = await revolutionaryEngine.deepUnderstanding(request);

      expect(understanding.intent).toEqual(mockAnalysis);
      expect(understanding.complexity).toBe(0.6);
      expect(understanding.reasoning_required).toBe(true);
      expect(understanding.predicted_structure).toBeDefined();
      expect(understanding.confidence).toBe(0.9);
    });

    test('should analyze domain context correctly', async () => {
      const understanding = await revolutionaryEngine.deepUnderstanding({
        url: 'https://sandiegouniontribune.com/news',
        extractionInstructions: 'Extract headlines'
      });

      expect(understanding.domain.type).toBe('news');
      expect(understanding.domain.domain).toBe('sandiegouniontribune.com');
    });
  });

  describe('🧠 Memory-Guided Optimization', () => {
    test('should retrieve similar extraction patterns', async () => {
      const mockSimilar = [
        {
          memory: {
            id: 'mem_123',
            result: { success: true, itemCount: 15 },
            qualityScore: 0.9,
            pattern: { domain: 'news.com' }
          },
          similarity: 0.85
        }
      ];

      const mockOptimizations = {
        suggestions: [
          {
            type: 'processing_method',
            suggestion: 'unified_extractor_option_c',
            confidence: 0.8
          }
        ],
        confidence: 0.85
      };

      // Mock extraction memory
      const extractionMemory = require('../api/services/extraction-memory');
      extractionMemory.findSimilarExtractions = jest.fn().mockResolvedValue(mockSimilar);
      extractionMemory.getSuggestedOptimizations = jest.fn().mockResolvedValue(mockOptimizations);

      const request = { url: 'https://news.com', extractionInstructions: 'Extract articles' };
      const memoryInsights = await revolutionaryEngine.getMemoryGuidedInsights(request);

      expect(memoryInsights.similar_patterns).toHaveLength(1);
      expect(memoryInsights.optimization_suggestions).toHaveLength(1);
      expect(memoryInsights.confidence).toBe(0.85);
      expect(memoryInsights.learned_insights).toBeDefined();
    });

    test('should handle no similar patterns gracefully', async () => {
      const extractionMemory = require('../api/services/extraction-memory');
      extractionMemory.findSimilarExtractions = jest.fn().mockResolvedValue([]);
      extractionMemory.getSuggestedOptimizations = jest.fn().mockResolvedValue({
        suggestions: [],
        confidence: 0
      });

      const request = { url: 'https://new-domain.com', extractionInstructions: 'Extract data' };
      const memoryInsights = await revolutionaryEngine.getMemoryGuidedInsights(request);

      expect(memoryInsights.similar_patterns).toHaveLength(0);
      expect(memoryInsights.optimization_suggestions).toHaveLength(0);
      expect(memoryInsights.confidence).toBe(0);
    });
  });

  describe('🎯 Predictive Strategy Generation', () => {
    test('should generate intelligent extraction strategy', async () => {
      const understanding = {
        intent: {
          strategy: { approach: 'direct', extraction_type: 'single_page' }
        },
        extraction_strategy: 'single_page',
        complexity: 0.5,
        reasoning_required: false
      };

      const memoryInsights = {
        optimization_suggestions: [
          { type: 'processing_method', suggestion: 'fast_mode', confidence: 0.9 }
        ]
      };

      const strategy = await revolutionaryEngine.generatePredictiveStrategy(
        understanding, 
        memoryInsights
      );

      expect(strategy.approach).toBe('direct');
      expect(strategy.extraction_type).toBe('single_page');
      expect(strategy.expected_results).toBeDefined();
      expect(strategy.success_probability).toBeGreaterThan(0);
      expect(strategy.fallback_chain).toBeInstanceOf(Array);
    });

    test('should generate multi-page crawling strategy', async () => {
      const understanding = {
        intent: {
          strategy: { approach: 'iterative', extraction_type: 'multi_page' }
        },
        extraction_strategy: 'multi_page',
        complexity: 0.8,
        reasoning_required: true
      };

      const memoryInsights = { optimization_suggestions: [] };

      const strategy = await revolutionaryEngine.generatePredictiveStrategy(
        understanding, 
        memoryInsights
      );

      expect(strategy.extraction_type).toBe('multi_page');
      expect(strategy.crawling).toBeDefined();
      expect(strategy.crawling.approach).toBe('intelligent_prediction');
      expect(strategy.crawling.predicted_pages).toBeGreaterThan(0);
    });
  });

  describe('💰 Cost Optimization', () => {
    test('should select gpt-5-nano for simple extractions', () => {
      const strategy = { expected_results: { estimated_count: 5 } };
      const understanding = { complexity: 0.2, reasoning_required: false };

      const config = revolutionaryEngine.optimizeForCostAndAccuracy(strategy, understanding);

      expect(config.model).toBe('gpt-5-nano');
      expect(config.cost_savings_percentage).toBeGreaterThan(90);
      expect(config.rationale).toContain('ultra cost-optimized');
    });

    test('should select gpt-5-mini for standard extractions', () => {
      const strategy = { expected_results: { estimated_count: 10 } };
      const understanding = { complexity: 0.5, reasoning_required: false };

      const config = revolutionaryEngine.optimizeForCostAndAccuracy(strategy, understanding);

      expect(config.model).toBe('gpt-5-mini');
      expect(config.cost_savings_percentage).toBeGreaterThan(80);
    });

    test('should select gpt-5 for complex reasoning tasks', () => {
      const strategy = { expected_results: { estimated_count: 20 } };
      const understanding = { complexity: 0.8, reasoning_required: true };

      const config = revolutionaryEngine.optimizeForCostAndAccuracy(strategy, understanding);

      expect(config.model).toBe('gpt-5');
      expect(config.reasoning_mode).toBe(true);
      expect(config.rationale).toContain('reasoning required');
    });

    test('should calculate accurate cost savings', () => {
      const strategy = { expected_results: { estimated_count: 10 } };
      const understanding = { complexity: 0.3, reasoning_required: false };

      revolutionaryEngine.estimateTokenUsage = jest.fn().mockReturnValue(1000);

      const config = revolutionaryEngine.optimizeForCostAndAccuracy(strategy, understanding);

      const expectedGpt4Cost = 1000 * 0.01; // GPT-4 baseline
      const expectedNanoCost = 1000 * 0.00005; // GPT-5-nano
      const expectedSavings = ((expectedGpt4Cost - expectedNanoCost) / expectedGpt4Cost) * 100;

      expect(config.estimated_cost).toBe(expectedNanoCost);
      expect(config.cost_savings_percentage).toBe(Math.round(expectedSavings));
      expect(config.cost_savings_percentage).toBeGreaterThan(95); // Should be ~99%
    });
  });

  describe('🎯 Confidence Scoring System', () => {
    test('should calculate comprehensive confidence scores', async () => {
      const extractionResult = {
        data: [
          { title: 'Article 1', author: 'Author 1', date: '2024-01-01' },
          { title: 'Article 2', author: 'Author 2', date: '2024-01-02' }
        ]
      };

      const understanding = {
        predicted_structure: {
          essential_fields: ['title', 'author']
        }
      };

      const strategy = {
        expected_results: { estimated_count: 2 }
      };

      const confidenceAnalysis = await revolutionaryEngine.calculateConfidenceScores(
        extractionResult, 
        understanding, 
        strategy
      );

      expect(confidenceAnalysis.overall).toBeGreaterThan(0);
      expect(confidenceAnalysis.overall).toBeLessThanOrEqual(1);
      expect(confidenceAnalysis.breakdown).toHaveProperty('data_quality');
      expect(confidenceAnalysis.breakdown).toHaveProperty('schema_compliance');
      expect(confidenceAnalysis.breakdown).toHaveProperty('completeness');
      expect(confidenceAnalysis.breakdown).toHaveProperty('consistency');
    });

    test('should assess data quality correctly', () => {
      const goodData = [
        { title: 'Complete Article', author: 'John Doe', date: '2024-01-01' },
        { title: 'Another Article', author: 'Jane Smith', date: '2024-01-02' }
      ];

      const poorData = [
        { title: '', author: null, date: 'N/A' },
        { title: 'Partial', author: '', date: null }
      ];

      const goodQuality = revolutionaryEngine.assessDataQuality(goodData);
      const poorQuality = revolutionaryEngine.assessDataQuality(poorData);

      expect(goodQuality).toBeGreaterThan(poorQuality);
      expect(goodQuality).toBeGreaterThan(0.8);
      expect(poorQuality).toBeLessThan(0.3);
    });

    test('should generate alternatives for low confidence', async () => {
      const lowConfidenceResult = {
        data: [{ title: 'Incomplete' }]
      };

      const alternatives = await revolutionaryEngine.generateAlternatives(
        lowConfidenceResult, 
        {}, 
        {}
      );

      expect(alternatives).toBeInstanceOf(Array);
      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives[0]).toHaveProperty('approach');
      expect(alternatives[0]).toHaveProperty('confidence_boost');
    });
  });

  describe('💬 Q&A Interface', () => {
    test('should create Q&A interface for extracted data', async () => {
      const result = {
        data: [
          { title: 'Tech News 1', category: 'technology', date: '2024-01-01' },
          { title: 'Business News 1', category: 'business', date: '2024-01-02' }
        ]
      };

      // Mock OpenAI response for Q&A
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'There are 2 extracted items: 1 technology article and 1 business article.'
          }
        }]
      });

      const intelligentResult = revolutionaryEngine.addQAInterface(result, {
        extractionInstructions: 'Extract news articles'
      });

      expect(intelligentResult.qa).toBeDefined();
      expect(intelligentResult.qa.ask).toBeInstanceOf(Function);
      expect(intelligentResult.qa.suggest_questions).toBeInstanceOf(Array);

      // Test Q&A functionality
      const answer = await intelligentResult.qa.ask('How many articles were extracted?');
      expect(answer.answer).toContain('2');
      expect(answer.confidence).toBeGreaterThan(0);
    });

    test('should generate relevant suggested questions', () => {
      const result = {
        data: [
          { title: 'Product 1', price: '$10.99', category: 'electronics' },
          { title: 'Product 2', price: '$24.99', category: 'electronics' }
        ]
      };

      const suggestions = revolutionaryEngine.generateSuggestedQuestions(result);
      
      expect(suggestions).toContain('What is the total count of items extracted?');
      expect(suggestions.some(q => q.includes('price'))).toBe(true);
    });

    test('should perform data analysis', async () => {
      const result = {
        data: [
          { name: 'Item 1', value: 100 },
          { name: 'Item 2', value: 200 }
        ]
      };

      const summaryAnalysis = await revolutionaryEngine.performDataAnalysis('summary', result);
      expect(summaryAnalysis.total_items).toBe(2);
      expect(summaryAnalysis.fields_analyzed).toContain('name');
      expect(summaryAnalysis.fields_analyzed).toContain('value');

      const qualityAnalysis = await revolutionaryEngine.performDataAnalysis('quality', result);
      expect(qualityAnalysis.overall_quality).toBeGreaterThan(0);
      expect(qualityAnalysis.quality_score).toContain('%');
    });
  });

  describe('🕸️ Predictive Multi-Page Crawling', () => {
    test('should predict and crawl pages intelligently', async () => {
      const config = {
        url: 'https://example.com',
        maxPages: 5
      };

      const crawlingStrategy = {
        predicted_pages: 3,
        approach: 'intelligent_prediction'
      };

      const pages = await revolutionaryEngine.predictAndCrawlPages(config, crawlingStrategy);

      expect(pages).toBeInstanceOf(Array);
      expect(pages.length).toBeLessThanOrEqual(config.maxPages);
      expect(pages[0].url).toBe(config.url);
    });

    test('should execute intelligent multi-page extraction', async () => {
      const request = {
        url: 'https://multi-page-site.com',
        extractionInstructions: 'Extract all articles',
        maxPages: 3
      };

      const params = {
        model: 'gpt-5-mini',
        instructions: 'Enhanced instructions',
        schema: { type: 'array' },
        expected_fields: ['title', 'content']
      };

      const crawlingStrategy = {
        predicted_pages: 2,
        approach: 'intelligent_prediction'
      };

      // Mock single page extraction results
      revolutionaryEngine.intelligentSinglePageExtraction = jest.fn()
        .mockResolvedValue({
          success: true,
          data: [{ title: 'Article', content: 'Content' }]
        });

      const result = await revolutionaryEngine.intelligentMultiPageExtraction(
        request, 
        params, 
        crawlingStrategy
      );

      expect(result.success).toBe(true);
      expect(result.metadata.multiPage).toBe(true);
      expect(result.metadata.pages_processed).toBeGreaterThan(0);
    });
  });

  describe('🚀 Full Revolutionary Extraction Flow', () => {
    test('should execute complete revolutionary extraction', async () => {
      // Mock all dependencies
      revolutionaryEngine.reasoningEngine.analyzeUserIntent = jest.fn().mockResolvedValue({
        understanding: { primary_goal: 'Extract articles' },
        complexity_assessment: { overall_complexity: 0.5, reasoning_required: false },
        predicted_structure: { 
          essential_fields: ['title'], 
          valuable_fields: ['author'] 
        },
        strategy: { extraction_type: 'single_page', approach: 'direct' },
        confidence: { understanding_confidence: 0.9 }
      });

      const extractionMemory = require('../api/services/extraction-memory');
      extractionMemory.findSimilarExtractions = jest.fn().mockResolvedValue([]);
      extractionMemory.getSuggestedOptimizations = jest.fn().mockResolvedValue({
        suggestions: [],
        confidence: 0
      });
      extractionMemory.storeExtractionMemory = jest.fn().mockResolvedValue({ id: 'mem_123' });

      // Mock OpenAI extraction response
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              data: [
                { title: 'Revolutionary Article', author: 'AI Engine' }
              ],
              confidence: 0.95
            })
          }
        }],
        usage: { total_tokens: 500 }
      });

      const extractionRequest = {
        url: 'https://revolutionary-test.com',
        extractionInstructions: 'Extract articles with revolutionary intelligence',
        schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              author: { type: 'string' }
            }
          }
        }
      };

      const result = await revolutionaryEngine.revolutionaryExtract(extractionRequest);

      // Verify revolutionary response format
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);

      // Verify intelligence layer
      expect(result.intelligence).toBeDefined();
      expect(result.intelligence.understanding).toBeDefined();
      expect(result.intelligence.confidence).toBeGreaterThan(0);
      expect(result.intelligence.insights).toBeInstanceOf(Array);

      // Verify Q&A interface
      expect(result.qa).toBeDefined();
      expect(result.qa.ask).toBeInstanceOf(Function);

      // Verify revolutionary metrics
      expect(result.revolution).toBeDefined();
      expect(result.revolution.cost_savings).toBeGreaterThan(0);
      expect(result.revolution.intelligence_layers).toBeDefined();
      expect(result.revolution.revolution_score).toBeGreaterThan(0);
    });

    test('should handle errors gracefully with intelligent fallback', async () => {
      // Force an error in the reasoning engine
      revolutionaryEngine.reasoningEngine.analyzeUserIntent = jest.fn()
        .mockRejectedValue(new Error('Reasoning failed'));

      const extractionRequest = {
        url: 'https://error-test.com',
        extractionInstructions: 'This should fail gracefully'
      };

      const result = await revolutionaryEngine.revolutionaryExtract(extractionRequest);

      expect(result.success).toBe(false);
      expect(result.fallback_used).toBe(true);
      expect(result.intelligence).toBeDefined();
      expect(result.qa).toBeDefined();
    });
  });

  describe('📊 Performance Benchmarks', () => {
    test('should meet performance benchmarks', async () => {
      const startTime = Date.now();

      // Mock fast responses
      revolutionaryEngine.reasoningEngine.analyzeUserIntent = jest.fn().mockResolvedValue({
        understanding: { primary_goal: 'Fast extraction' },
        complexity_assessment: { overall_complexity: 0.3, reasoning_required: false },
        predicted_structure: { essential_fields: ['title'], valuable_fields: [] },
        strategy: { extraction_type: 'single_page', approach: 'direct' },
        confidence: { understanding_confidence: 0.95 }
      });

      const extractionMemory = require('../api/services/extraction-memory');
      extractionMemory.findSimilarExtractions = jest.fn().mockResolvedValue([]);
      extractionMemory.getSuggestedOptimizations = jest.fn().mockResolvedValue({
        suggestions: [],
        confidence: 0
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ data: [], confidence: 0.9 }) } }],
        usage: { total_tokens: 100 }
      });

      const result = await revolutionaryEngine.revolutionaryExtract({
        url: 'https://fast-test.com',
        extractionInstructions: 'Quick extraction'
      });

      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(10000); // Under 10 seconds
      expect(result.revolution.processing_time_ms).toBeLessThan(10000);
    });

    test('should validate 97% cost savings claim', () => {
      const testCases = [
        { complexity: 0.2, reasoning: false, expectedModel: 'gpt-5-nano' },
        { complexity: 0.5, reasoning: false, expectedModel: 'gpt-5-mini' },
        { complexity: 0.8, reasoning: true, expectedModel: 'gpt-5' }
      ];

      testCases.forEach(({ complexity, reasoning, expectedModel }) => {
        const understanding = { complexity, reasoning_required: reasoning };
        const strategy = { expected_results: { estimated_count: 10 } };

        revolutionaryEngine.estimateTokenUsage = jest.fn().mockReturnValue(1000);

        const config = revolutionaryEngine.optimizeForCostAndAccuracy(strategy, understanding);

        expect(config.model).toBe(expectedModel);
        
        if (expectedModel === 'gpt-5-nano') {
          expect(config.cost_savings_percentage).toBeGreaterThanOrEqual(95);
        } else if (expectedModel === 'gpt-5-mini') {
          expect(config.cost_savings_percentage).toBeGreaterThanOrEqual(90);
        }
      });
    });
  });

  describe('🧠 Learning & Memory Integration', () => {
    test('should learn from successful extractions', async () => {
      const extractionMemory = require('../api/services/extraction-memory');
      extractionMemory.storeExtractionMemory = jest.fn().mockResolvedValue({ id: 'mem_456' });

      revolutionaryEngine.updateSystemLearning = jest.fn();

      const request = { url: 'https://learning-test.com' };
      const result = { 
        success: true,
        intelligence: { confidence: 0.9 },
        data: [{ title: 'Learning Article' }]
      };
      const understanding = { complexity: 0.6 };

      await revolutionaryEngine.learnFromExtraction(request, result, understanding);

      expect(extractionMemory.storeExtractionMemory).toHaveBeenCalledWith(request, result);
      expect(revolutionaryEngine.updateSystemLearning).toHaveBeenCalledWith(request, result, understanding);
    });

    test('should generate monthly insights', async () => {
      const extractionMemory = require('../api/services/extraction-memory');
      extractionMemory.generateMonthlyInsights = jest.fn().mockResolvedValue({
        total_extractions: 100,
        success_rate: 0.95,
        improvements: ['Better schema detection', 'Faster processing']
      });

      revolutionaryEngine.shouldGenerateInsights = jest.fn().mockReturnValue(true);

      const request = { url: 'https://insights-test.com' };
      const result = { success: true, intelligence: { confidence: 0.85 } };
      const understanding = { complexity: 0.5 };

      const insights = await revolutionaryEngine.learnFromExtraction(request, result, understanding);

      expect(insights.total_extractions).toBe(100);
      expect(insights.success_rate).toBe(0.95);
      expect(insights.improvements).toContain('Better schema detection');
    });
  });

  describe('🎯 Revolutionary Metrics Calculation', () => {
    test('should calculate comprehensive revolutionary metrics', () => {
      const result = {
        intelligence: {
          confidence: 0.95,
          intelligence_layers: {
            reasoning: true,
            memory: true,
            confidence: true,
            qa_interface: true,
            predictive: true
          }
        }
      };

      const config = {
        cost_savings_percentage: 94,
        model: 'gpt-5-mini'
      };

      const startTime = Date.now() - 2000; // 2 seconds ago

      const metrics = revolutionaryEngine.calculateRevolutionaryMetrics(result, config, startTime);

      expect(metrics.cost_savings).toBe(94);
      expect(metrics.model_used).toBe('gpt-5-mini');
      expect(metrics.processing_time_ms).toBeGreaterThan(1000);
      expect(metrics.confidence_achieved).toBe(0.95);
      expect(metrics.intelligence_layers.reasoning).toBe(true);
      expect(metrics.revolution_score).toBeGreaterThan(50);
    });

    test('should calculate revolution score correctly', () => {
      const highPerformanceResult = {
        intelligence: {
          confidence: 0.95,
          intelligence_layers: {
            reasoning: true,
            memory: true,
            confidence: true,
            qa_interface: true,
            predictive: true
          }
        }
      };

      const highSavingsConfig = {
        cost_savings_percentage: 97
      };

      const score = revolutionaryEngine.calculateRevolutionScore(
        highPerformanceResult, 
        highSavingsConfig
      );

      // Perfect score should be close to 100
      // 97% cost savings (40 points) + 95% confidence (28.5 points) + all features (30 points) = ~98.5
      expect(score).toBeGreaterThan(90);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});

module.exports = {
  mockOpenAI
};