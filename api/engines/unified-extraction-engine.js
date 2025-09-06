/**
 * Unified Extraction Engine for Atlas Codex
 * 
 * Single extraction pipeline that replaces multiple processing engines.
 * Addresses: 3 different extraction engines with incompatible schemas
 * Ensures: Consistent result schema regardless of model or processing method
 */

const { getEnvironmentConfig } = require('../config/environment');
const { getModelRouter } = require('../services/unified-model-router');
const { JobSchemaValidator } = require('../schemas/job-schema');
const { CorrelationMiddleware } = require('../middleware/correlation-middleware');
const OpenAI = require('openai');

/**
 * Unified Extraction Engine
 * Consolidates all extraction methods into a single pipeline
 */
class UnifiedExtractionEngine {
  constructor() {
    this.config = getEnvironmentConfig();
    this.modelRouter = getModelRouter();
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: this.config.openaiApiKey
    });
    
    // Load legacy systems for fallback
    this.legacySystems = this.initializeLegacySystems();
  }
  
  /**
   * Initialize legacy systems for fallback
   */
  initializeLegacySystems() {
    const systems = {};
    
    try {
      // Evidence-First Bridge (current unified extractor)
      systems.evidenceFirst = require('../evidence-first-bridge');
    } catch (error) {
      console.warn('Evidence-First system not available:', error.message);
    }
    
    try {
      // Plan-based system (worker-enhanced)
      systems.planBased = require('../worker-enhanced');
    } catch (error) {
      console.warn('Plan-based system not available:', error.message);
    }
    
    try {
      // AI Processor (natural language processing)
      systems.aiProcessor = require('../ai-processor');
    } catch (error) {
      console.warn('AI Processor not available:', error.message);
    }
    
    return systems;
  }
  
  /**
   * Main extraction method - single entry point
   */
  async extract(request, context = {}) {
    const logger = context.logger || CorrelationMiddleware.createLogger(
      context.correlationId || CorrelationMiddleware.generateCorrelationId()
    );
    
    const timer = logger.startTimer('unified_extraction');
    
    try {
      // Validate request
      this.validateExtractionRequest(request);
      
      // Determine processing strategy
      const strategy = this.determineProcessingStrategy(request);
      logger.info('Processing strategy selected', { strategy: strategy.type });
      
      // Select optimal model
      const selectedModel = this.modelRouter.selectModel(request, strategy.modelOverrides);
      const modelConfig = this.modelRouter.getModelConfig(selectedModel, request);
      logger.info('Model selected', { model: selectedModel, config: modelConfig });
      
      // Estimate cost
      const costEstimate = this.modelRouter.estimateCost(selectedModel, request);
      logger.logCost('extraction', selectedModel, costEstimate.totalCost);
      
      // Execute extraction with fallback chain
      const result = await this.executeWithFallback(
        strategy, 
        modelConfig, 
        request, 
        logger
      );
      
      // Normalize result to canonical format
      const normalizedResult = this.normalizeResult(result, {
        model: selectedModel,
        strategy: strategy.type,
        processingTime: timer.end()
      });
      
      logger.info('Extraction completed successfully', {
        itemsExtracted: normalizedResult.data?.length || 0,
        processingMethod: normalizedResult.metadata.processingMethod
      });
      
      return normalizedResult;
      
    } catch (error) {
      timer.end({ error: error.message });
      logger.error('Extraction failed', error);
      
      // Return error in canonical format
      return this.createErrorResult(error, request);
    }
  }
  
  /**
   * Determine optimal processing strategy
   */
  determineProcessingStrategy(request) {
    // Multi-page extraction strategy
    if (this.shouldUseMultiPageExtraction(request)) {
      return {
        type: 'multi_page_navigation',
        processor: 'navigation_aware',
        modelOverrides: { requiresReasoning: true },
        fallbacks: ['evidence_first', 'plan_based']
      };
    }
    
    // Complex single-page extraction
    if (this.isComplexExtraction(request)) {
      return {
        type: 'complex_single_page',
        processor: 'reasoning_enhanced',
        modelOverrides: { requiresReasoning: true },
        fallbacks: ['evidence_first', 'direct_extraction']
      };
    }
    
    // AI-powered natural language processing
    if (request.type === 'ai-process' || request.prompt) {
      return {
        type: 'ai_natural_language',
        processor: 'ai_processor',
        modelOverrides: {},
        fallbacks: ['direct_extraction']
      };
    }
    
    // Standard extraction
    return {
      type: 'standard_extraction',
      processor: 'direct_extraction',
      modelOverrides: {},
      fallbacks: ['evidence_first', 'plan_based']
    };
  }
  
  /**
   * Execute extraction with fallback chain
   */
  async executeWithFallback(strategy, modelConfig, request, logger) {
    const fallbackChain = [strategy.processor, ...strategy.fallbacks];
    let lastError = null;
    
    for (const processorType of fallbackChain) {
      try {
        logger.info(`Attempting extraction with ${processorType}`);
        
        const result = await this.executeProcessor(
          processorType, 
          modelConfig, 
          request, 
          logger
        );
        
        if (this.isValidResult(result)) {
          return result;
        }
        
        logger.warn(`Processor ${processorType} returned invalid result`);
        
      } catch (error) {
        lastError = error;
        logger.warn(`Processor ${processorType} failed: ${error.message}`);
        
        // If this is a quota/rate limit error, don't try fallbacks
        if (this.isFatalError(error)) {
          throw error;
        }
      }
    }
    
    // All processors failed
    throw lastError || new Error('All extraction processors failed');
  }
  
  /**
   * Execute specific processor
   */
  async executeProcessor(processorType, modelConfig, request, logger) {
    const childLogger = CorrelationMiddleware.createChildLogger(logger, processorType);
    
    switch (processorType) {
      case 'navigation_aware':
        return await this.executeNavigationAware(modelConfig, request, childLogger);
        
      case 'reasoning_enhanced':
        return await this.executeReasoningEnhanced(modelConfig, request, childLogger);
        
      case 'ai_processor':
        return await this.executeAIProcessor(modelConfig, request, childLogger);
        
      case 'direct_extraction':
        return await this.executeDirectExtraction(modelConfig, request, childLogger);
        
      case 'evidence_first':
        return await this.executeLegacyEvidenceFirst(request, childLogger);
        
      case 'plan_based':
        return await this.executeLegacyPlanBased(request, childLogger);
        
      default:
        throw new Error(`Unknown processor type: ${processorType}`);
    }
  }
  
  /**
   * Navigation-aware extraction (for multi-page sites)
   */
  async executeNavigationAware(modelConfig, request, logger) {
    logger.info('Starting navigation-aware extraction');
    
    // Use GPT-5 reasoning mode for complex navigation
    const enhancedConfig = {
      ...modelConfig,
      reasoning: modelConfig.model.startsWith('gpt-5') && this.config.gpt5ReasoningEnabled
    };
    
    // First, analyze the site structure
    const structureAnalysis = await this.analyzeSiteStructure(request.url, enhancedConfig, logger);
    
    if (structureAnalysis.requiresNavigation) {
      // Multi-page extraction
      return await this.performMultiPageExtraction(
        request, 
        structureAnalysis, 
        enhancedConfig, 
        logger
      );
    } else {
      // Single page is sufficient
      return await this.executeSinglePageExtraction(request, enhancedConfig, logger);
    }
  }
  
  /**
   * Reasoning-enhanced extraction (complex single pages)
   */
  async executeReasoningEnhanced(modelConfig, request, logger) {
    logger.info('Starting reasoning-enhanced extraction');
    
    // Enable reasoning mode for GPT-5
    const reasoningConfig = {
      ...modelConfig,
      reasoning: modelConfig.model.startsWith('gpt-5'),
      temperature: 0.1 // Lower temperature for more consistent reasoning
    };
    
    // Fetch and analyze page content
    const content = await this.fetchPageContent(request.url, logger);
    const analysis = await this.performContentAnalysis(content, reasoningConfig, logger);
    
    // Extract with enhanced reasoning
    return await this.extractWithReasoning(
      content, 
      request.extractionInstructions, 
      analysis,
      reasoningConfig, 
      logger
    );
  }
  
  /**
   * AI processor (natural language to extraction)
   */
  async executeAIProcessor(modelConfig, request, logger) {
    logger.info('Starting AI processor');
    
    if (this.legacySystems.aiProcessor && this.legacySystems.aiProcessor.processNaturalLanguage) {
      // Use existing AI processor with new model config
      return await this.legacySystems.aiProcessor.processNaturalLanguage(
        request.prompt || request.extractionInstructions,
        {
          url: request.url,
          modelConfig: modelConfig,
          logger: logger
        }
      );
    }
    
    // Fallback to direct natural language processing
    return await this.processNaturalLanguageRequest(request, modelConfig, logger);
  }
  
  /**
   * Direct extraction (simple single page)
   */
  async executeDirectExtraction(modelConfig, request, logger) {
    logger.info('Starting direct extraction');
    
    const content = await this.fetchPageContent(request.url, logger);
    return await this.extractDirectly(content, request.extractionInstructions, modelConfig, logger);
  }
  
  /**
   * Legacy Evidence-First system fallback
   */
  async executeLegacyEvidenceFirst(request, logger) {
    logger.info('Falling back to Evidence-First system');
    
    if (!this.legacySystems.evidenceFirst) {
      throw new Error('Evidence-First system not available');
    }
    
    // Use existing evidence-first bridge
    if (this.legacySystems.evidenceFirst.processWithUnifiedExtractor) {
      const content = await this.fetchPageContent(request.url, logger);
      return await this.legacySystems.evidenceFirst.processWithUnifiedExtractor(
        content,
        request
      );
    }
    
    throw new Error('Evidence-First bridge method not available');
  }
  
  /**
   * Legacy plan-based system fallback
   */
  async executeLegacyPlanBased(request, logger) {
    logger.info('Falling back to plan-based system');
    
    if (!this.legacySystems.planBased) {
      throw new Error('Plan-based system not available');
    }
    
    // Use existing worker-enhanced system
    if (this.legacySystems.planBased.processWithPlanBasedSystem) {
      const content = await this.fetchPageContent(request.url, logger);
      return await this.legacySystems.planBased.processWithPlanBasedSystem(
        content,
        request
      );
    }
    
    throw new Error('Plan-based system method not available');
  }
  
  /**
   * Analyze site structure for navigation requirements
   */
  async analyzeSiteStructure(url, modelConfig, logger) {
    const content = await this.fetchPageContent(url, logger, { lightweight: true });
    
    const analysisPrompt = `
Analyze this web page to determine if multi-page extraction is needed:

Content: ${content.substring(0, 5000)}

Respond with JSON:
{
  "requiresNavigation": boolean,
  "paginationFound": boolean,
  "detailLinksFound": boolean,
  "navigationStrategy": "pagination|detail_links|categories|none",
  "estimatedPages": number,
  "confidence": number
}`;
    
    const response = await this.openai.chat.completions.create({
      ...modelConfig,
      messages: [{ role: 'user', content: analysisPrompt }]
    });
    
    return JSON.parse(response.choices[0].message.content);
  }
  
  /**
   * Perform multi-page extraction
   */
  async performMultiPageExtraction(request, structureAnalysis, modelConfig, logger) {
    logger.info('Starting multi-page extraction', { 
      strategy: structureAnalysis.navigationStrategy,
      estimatedPages: structureAnalysis.estimatedPages
    });
    
    // For now, delegate to evidence-first if available
    if (this.legacySystems.evidenceFirst && this.legacySystems.evidenceFirst.processWithUnifiedExtractor) {
      return await this.executeLegacyEvidenceFirst(request, logger);
    }
    
    // Simplified multi-page extraction
    const content = await this.fetchPageContent(request.url, logger);
    return await this.extractDirectly(content, request.extractionInstructions, modelConfig, logger);
  }
  
  /**
   * Fetch page content with error handling
   */
  async fetchPageContent(url, logger, options = {}) {
    logger.info('Fetching page content', { url, options });
    
    // Use Playwright or similar for content fetching
    // For now, using a simple fetch - this should be replaced with proper browser automation
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AtlasCodex/1.0)',
          ...CorrelationMiddleware.addToOutboundRequest()
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const content = await response.text();
      logger.info('Page content fetched', { 
        contentLength: content.length,
        contentType: response.headers.get('content-type')
      });
      
      return content;
      
    } catch (error) {
      logger.error('Failed to fetch page content', error);
      throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
  }
  
  /**
   * Extract directly with OpenAI
   */
  async extractDirectly(content, instructions, modelConfig, logger) {
    const extractionPrompt = `
Extract structured data from this web content based on the instructions:

Instructions: ${instructions}

Content: ${content.substring(0, 15000)}

Respond with JSON in this format:
{
  "success": true,
  "data": [...extracted items...],
  "metadata": {
    "itemCount": number,
    "extractionMethod": "direct_extraction"
  }
}`;
    
    const response = await this.openai.chat.completions.create({
      ...modelConfig,
      messages: [{ role: 'user', content: extractionPrompt }]
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    
    // Track token usage
    if (response.usage) {
      logger.info('Token usage', {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      });
    }
    
    return result;
  }
  
  /**
   * Normalize result to canonical format
   */
  normalizeResult(result, metadata = {}) {
    const normalized = {
      success: result.success !== false,
      data: result.data || [],
      metadata: {
        processingMethod: `unified_extractor_${metadata.strategy || 'unknown'}`,
        unifiedExtractor: true,
        modelUsed: metadata.model,
        processingTime: metadata.processingTime || 0,
        totalItems: (result.data || []).length,
        ...result.metadata
      },
      error: result.error || null
    };
    
    return normalized;
  }
  
  /**
   * Create error result in canonical format
   */
  createErrorResult(error, request) {
    return {
      success: false,
      data: [],
      metadata: {
        processingMethod: 'unified_extractor_error',
        unifiedExtractor: true,
        error: error.message,
        processingTime: 0,
        totalItems: 0
      },
      error: error.message
    };
  }
  
  // Helper methods
  shouldUseMultiPageExtraction(request) {
    const instructions = (request.extractionInstructions || '').toLowerCase();
    const multiPageKeywords = [
      'all pages', 'navigate', 'crawl', 'paginated', 'multiple pages',
      'entire catalog', 'complete list', 'all items', 'browse through'
    ];
    
    return multiPageKeywords.some(keyword => instructions.includes(keyword)) ||
           (request.maxPages && request.maxPages > 1);
  }
  
  isComplexExtraction(request) {
    const instructions = (request.extractionInstructions || '').toLowerCase();
    const complexKeywords = [
      'analyze', 'relationship', 'structure', 'pattern', 'detailed',
      'comprehensive', 'compare', 'evaluate'
    ];
    
    return complexKeywords.some(keyword => instructions.includes(keyword)) ||
           instructions.length > 500;
  }
  
  isValidResult(result) {
    return result && 
           typeof result === 'object' && 
           result.hasOwnProperty('success') &&
           Array.isArray(result.data);
  }
  
  isFatalError(error) {
    const fatalMessages = [
      'quota exceeded', 'rate limit', 'insufficient funds',
      'authentication failed', 'forbidden'
    ];
    
    return fatalMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }
  
  validateExtractionRequest(request) {
    if (!request.url) {
      throw new Error('URL is required for extraction');
    }
    
    if (!request.extractionInstructions && !request.prompt) {
      throw new Error('Extraction instructions or prompt is required');
    }
    
    try {
      new URL(request.url);
    } catch (error) {
      throw new Error(`Invalid URL: ${request.url}`);
    }
  }
}

// Singleton instance
let extractionEngineInstance = null;

/**
 * Get unified extraction engine singleton
 */
function getExtractionEngine() {
  if (!extractionEngineInstance) {
    extractionEngineInstance = new UnifiedExtractionEngine();
  }
  return extractionEngineInstance;
}

/**
 * Reset extraction engine (for testing)
 */
function resetExtractionEngine() {
  extractionEngineInstance = null;
}

module.exports = {
  UnifiedExtractionEngine,
  getExtractionEngine,
  resetExtractionEngine
};