// Atlas Codex - Unified Extraction Service
// Intelligently routes requests to optimal extraction strategy

import { z } from 'zod';
import axios from 'axios';
import * as cheerio from 'cheerio';
// PlaywrightWebBaseLoader removed for Lambda compatibility
import TurndownService from 'turndown';
import { FirecrawlService } from './firecrawl-service';
import { DomainIntelligenceProfile, ExtractionStrategy, extractDomain } from './dip';
import { dipService } from './dip-service';
import { OpenAI } from 'openai';

// Initialize services
const firecrawl = new FirecrawlService(process.env.FIRECRAWL_API_KEY);
const turndownService = new TurndownService();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Scrapling service URL (Python FastAPI service)
const SCRAPLING_SERVICE_URL = process.env.SCRAPLING_SERVICE_URL || 'http://localhost:8001';

export interface ExtractionRequest {
  url: string;
  strategy?: ExtractionStrategy['type'];
  selectors?: Record<string, string>;
  extractSchema?: z.ZodSchema<any>;
  extractPrompt?: string;
  forceStrategy?: boolean;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ExtractionResult {
  success: boolean;
  strategy: ExtractionStrategy['type'];
  content?: string;
  markdown?: string;
  data?: any;
  metadata: {
    url: string;
    title?: string;
    statusCode?: number;
    contentLength?: number;
    extractionTime: number;
    cost: number;
    adaptiveSelectors?: Record<string, string>;
  };
  error?: string;
}

export class ExtractionService {
  private scraplingAvailable: boolean = false;

  constructor() {
    this.checkScraplingAvailability();
  }

  private async checkScraplingAvailability() {
    try {
      const response = await axios.get(`${SCRAPLING_SERVICE_URL}/health`);
      this.scraplingAvailable = response.data.status === 'healthy';
      console.log('✅ Scrapling service available');
    } catch (error) {
      console.warn('⚠️ Scrapling service not available, will use fallback strategies');
      this.scraplingAvailable = false;
    }
  }

  /**
   * Main extraction method that routes to optimal strategy
   */
  async extract(request: ExtractionRequest): Promise<ExtractionResult> {
    const startTime = Date.now();
    const domain = extractDomain(request.url);
    
    // Get or determine strategy
    let strategy = request.strategy;
    
    if (!strategy && !request.forceStrategy) {
      // Try to get strategy from DIP
      const dip = await dipService.getDIP(domain);
      if (dip) {
        strategy = dip.optimalStrategy.strategy;
        console.log(`📊 Using DIP strategy for ${domain}: ${strategy}`);
      } else {
        // Default intelligent routing
        strategy = await this.determineOptimalStrategy(request);
        console.log(`🤖 Auto-selected strategy: ${strategy}`);
      }
    }

    strategy = strategy || 'firecrawl_markdown'; // Default fallback

    // Execute extraction based on strategy
    let result: ExtractionResult;
    
    try {
      switch (strategy) {
        case 'scrapling_adaptive':
          result = await this.extractWithScrapling(request, 'adaptive');
          break;
        
        case 'scrapling_stealth':
          result = await this.extractWithScrapling(request, 'stealth');
          break;
        
        case 'firecrawl_markdown':
          result = await this.extractWithFirecrawlMarkdown(request);
          break;
        
        case 'firecrawl_extract':
          result = await this.extractWithFirecrawlExtract(request);
          break;
        
        case 'firecrawl_search':
          result = await this.extractWithFirecrawlSearch(request);
          break;
        
        case 'static_fetch':
          result = await this.extractWithStaticFetch(request);
          break;
        
        case 'browser_render':
          result = await this.extractWithBrowserRender(request);
          break;
        
        case 'gpt5_nano':
        case 'gpt5_mini':
        case 'gpt5_standard':
          result = await this.extractWithGPT(request, strategy);
          break;
        
        default:
          // Fallback to Firecrawl markdown
          result = await this.extractWithFirecrawlMarkdown(request);
      }

      // Update DIP with results
      await this.updateDIPWithResults(domain, strategy, result, Date.now() - startTime);
      
    } catch (error) {
      // Try fallback strategies
      result = await this.tryFallbackStrategies(request, strategy, error);
    }

    return result;
  }

  /**
   * Determine optimal strategy based on request characteristics
   */
  private async determineOptimalStrategy(request: ExtractionRequest): Promise<ExtractionStrategy['type']> {
    // If extraction schema is provided, use Firecrawl extract
    if (request.extractSchema || request.extractPrompt) {
      return 'firecrawl_extract';
    }
    
    // If selectors are provided and Scrapling is available, use adaptive
    if (request.selectors && this.scraplingAvailable) {
      return 'scrapling_adaptive';
    }
    
    // Default to Firecrawl markdown for LLM-ready content
    return 'firecrawl_markdown';
  }

  /**
   * Extract using Scrapling (Python service)
   */
  private async extractWithScrapling(
    request: ExtractionRequest, 
    strategy: 'adaptive' | 'stealth'
  ): Promise<ExtractionResult> {
    if (!this.scraplingAvailable) {
      throw new Error('Scrapling service not available');
    }

    const response = await axios.post(`${SCRAPLING_SERVICE_URL}/scrape`, {
      url: request.url,
      strategy,
      selectors: request.selectors,
      auto_save: true,
      javascript: strategy === 'stealth',
      timeout: request.timeout || 30000,
      headers: request.headers
    });

    const result = response.data;
    
    return {
      success: result.success,
      strategy: strategy === 'adaptive' ? 'scrapling_adaptive' : 'scrapling_stealth',
      content: result.content,
      markdown: result.content ? turndownService.turndown(result.content) : undefined,
      data: result.data,
      metadata: {
        url: request.url,
        title: result.metadata?.title,
        statusCode: result.metadata?.status_code,
        contentLength: result.metadata?.content_length,
        extractionTime: result.response_time,
        cost: result.cost,
        adaptiveSelectors: result.adaptive_selectors
      },
      error: result.error
    };
  }

  /**
   * Extract using Firecrawl markdown
   */
  private async extractWithFirecrawlMarkdown(request: ExtractionRequest): Promise<ExtractionResult> {
    const result = await firecrawl.scrape(request.url, {
      formats: ['markdown', 'links'],
      onlyMainContent: true,
      headers: request.headers,
      timeout: request.timeout
    });

    return {
      success: result.success,
      strategy: 'firecrawl_markdown',
      markdown: result.markdown,
      data: { links: result.links },
      metadata: {
        url: request.url,
        title: result.metadata?.title,
        statusCode: result.metadata?.statusCode,
        extractionTime: result.responseTime,
        cost: result.cost
      },
      error: result.metadata?.error
    };
  }

  /**
   * Extract using Firecrawl with schema extraction
   */
  private async extractWithFirecrawlExtract(request: ExtractionRequest): Promise<ExtractionResult> {
    if (!request.extractSchema && !request.extractPrompt) {
      // Fallback to markdown if no extraction params
      return this.extractWithFirecrawlMarkdown(request);
    }

    const result = await firecrawl.extract(request.url, {
      schema: request.extractSchema!,
      extractionPrompt: request.extractPrompt,
      systemPrompt: "Extract the requested data accurately and completely."
    });

    return {
      success: result.success,
      strategy: 'firecrawl_extract',
      markdown: result.markdown,
      data: result.extractedData,
      metadata: {
        url: request.url,
        title: result.metadata?.title,
        statusCode: result.metadata?.statusCode,
        extractionTime: result.responseTime,
        cost: result.cost
      },
      error: result.metadata?.error
    };
  }

  /**
   * Search and extract using Firecrawl
   */
  private async extractWithFirecrawlSearch(request: ExtractionRequest): Promise<ExtractionResult> {
    // Extract search query from URL or use URL as query
    const query = new URL(request.url).searchParams.get('q') || request.url;
    
    const result = await firecrawl.search(query, {
      limit: 5,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true
      }
    });

    return {
      success: result.success,
      strategy: 'firecrawl_search',
      data: result.results,
      metadata: {
        url: request.url,
        extractionTime: result.responseTime,
        cost: result.totalCost
      }
    };
  }

  /**
   * Extract using static fetch (cheerio)
   */
  private async extractWithStaticFetch(request: ExtractionRequest): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(request.url, {
        headers: request.headers,
        timeout: request.timeout || 30000
      });

      const $ = cheerio.load(response.data);
      const title = $('title').text();
      const content = $.html();
      const markdown = turndownService.turndown(content);

      let data = {};
      if (request.selectors) {
        for (const [key, selector] of Object.entries(request.selectors)) {
          const elements = $(selector);
          (data as any)[key] = elements.length === 1 
            ? elements.text() 
            : elements.map((_, el) => $(el).text()).get();
        }
      }

      return {
        success: true,
        strategy: 'static_fetch',
        content,
        markdown,
        data,
        metadata: {
          url: request.url,
          title,
          statusCode: response.status,
          contentLength: content.length,
          extractionTime: (Date.now() - startTime) / 1000,
          cost: 0.00001 // Minimal cost
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Extract using browser rendering (via Firecrawl - Lambda compatible)
   */
  private async extractWithBrowserRender(request: ExtractionRequest): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      // Use Firecrawl with JavaScript rendering enabled
      const firecrawlResult = await firecrawl.scrape(request.url, {
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 3000, // Wait for JavaScript to load
        timeout: request.timeout || 30000
      });
      
      if (!firecrawlResult.success) {
        throw new Error(`Firecrawl scraping failed: ${firecrawlResult.metadata?.error}`);
      }
      
      return {
        success: true,
        strategy: 'browser_render',
        content: firecrawlResult.html || '',
        markdown: firecrawlResult.markdown || '',
        metadata: {
          url: request.url,
          contentLength: (firecrawlResult.markdown || '').length,
          extractionTime: (Date.now() - startTime) / 1000,
          cost: firecrawlResult.cost
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Extract using GPT models
   */
  private async extractWithGPT(
    request: ExtractionRequest, 
    model: 'gpt5_nano' | 'gpt5_mini' | 'gpt5_standard'
  ): Promise<ExtractionResult> {
    // First get content with a simpler method
    const contentResult = await this.extractWithStaticFetch(request);
    
    if (!contentResult.success || !contentResult.content) {
      throw new Error('Failed to fetch content for GPT processing');
    }

    const startTime = Date.now();
    
    // Map to actual OpenAI model names
    const modelMap = {
      'gpt5_nano': 'gpt-3.5-turbo',
      'gpt5_mini': 'gpt-4-turbo-preview',
      'gpt5_standard': 'gpt-4'
    };

    const systemPrompt = request.extractPrompt || 
      "Extract and structure the main content from this webpage.";
    
    const completion = await openai.chat.completions.create({
      model: modelMap[model],
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contentResult.content }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    const extractedContent = completion.choices[0]?.message?.content || '';
    const tokens = completion.usage?.total_tokens || 0;
    
    // Estimate cost based on model and tokens
    const costPerToken = {
      'gpt5_nano': 0.000001,
      'gpt5_mini': 0.00001,
      'gpt5_standard': 0.00003
    };
    
    const cost = tokens * costPerToken[model];

    return {
      success: true,
      strategy: model,
      content: extractedContent,
      markdown: extractedContent,
      metadata: {
        url: request.url,
        extractionTime: (Date.now() - startTime) / 1000,
        cost
      }
    };
  }

  /**
   * Try fallback strategies if primary fails
   */
  private async tryFallbackStrategies(
    request: ExtractionRequest,
    failedStrategy: ExtractionStrategy['type'],
    error: any
  ): Promise<ExtractionResult> {
    console.warn(`Strategy ${failedStrategy} failed: ${error.message}`);
    
    // Define fallback chain
    const fallbackChain = [
      'firecrawl_markdown',
      'scrapling_adaptive',
      'static_fetch',
      'browser_render'
    ].filter(s => s !== failedStrategy);

    for (const fallback of fallbackChain) {
      try {
        console.log(`Trying fallback strategy: ${fallback}`);
        request.strategy = fallback as ExtractionStrategy['type'];
        return await this.extract(request);
      } catch (fallbackError) {
        console.warn(`Fallback ${fallback} also failed`);
        continue;
      }
    }

    // All strategies failed
    return {
      success: false,
      strategy: failedStrategy,
      metadata: {
        url: request.url,
        extractionTime: 0,
        cost: 0
      },
      error: `All extraction strategies failed. Original error: ${error.message}`
    };
  }

  /**
   * Update DIP with extraction results
   */
  private async updateDIPWithResults(
    domain: string,
    strategy: ExtractionStrategy['type'],
    result: ExtractionResult,
    totalTime: number
  ) {
    try {
      const dip = await dipService.getDIP(domain);
      
      if (!dip) {
        // Create new DIP
        const newDIP: DomainIntelligenceProfile = {
          domain,
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          siteStructure: {
            framework: null,
            renderingType: strategy.includes('browser') ? 'spa' : 'static',
            requiresJavaScript: strategy.includes('browser') || strategy.includes('stealth'),
            contentSelectors: result.metadata.adaptiveSelectors || {},
            commonPatterns: [],
            dynamicContent: strategy.includes('browser')
          },
          extractionStrategies: [{
            type: strategy,
            success: result.success,
            cost: result.metadata.cost,
            responseTime: result.metadata.extractionTime,
            reliability: result.success ? 1.0 : 0.0,
            dataQuality: result.success ? 0.9 : 0.0,
            errorRate: result.success ? 0.0 : 1.0,
            lastTested: new Date().toISOString(),
            adaptiveSelectors: result.metadata.adaptiveSelectors
          }],
          optimalStrategy: {
            strategy,
            confidence: result.success ? 0.8 : 0.3,
            fallbackChain: ['firecrawl_markdown', 'scrapling_adaptive', 'static_fetch'],
            costPerExtraction: result.metadata.cost,
            averageResponseTime: result.metadata.extractionTime,
            successRate: result.success ? 1.0 : 0.0
          },
          costProfile: {
            averageCost: result.metadata.cost,
            minCost: result.metadata.cost,
            maxCost: result.metadata.cost,
            costByStrategy: { [strategy]: result.metadata.cost },
            projectedMonthlyCost: result.metadata.cost * 1000, // Estimate
            costTrend: 'stable'
          },
          performanceMetrics: {
            averageResponseTime: result.metadata.extractionTime,
            p95ResponseTime: result.metadata.extractionTime * 1.5,
            p99ResponseTime: result.metadata.extractionTime * 2,
            successRate: result.success ? 1.0 : 0.0,
            errorRate: result.success ? 0.0 : 1.0
          },
          constraints: {
            robotsTxt: {
              exists: false,
              allowedPaths: [],
              disallowedPaths: [],
              crawlDelay: 0,
              sitemapUrls: [],
              userAgents: []
            },
            rateLimit: {
              maxRequestsPerMinute: 60,
              recommendedDelay: 1,
              hasRateLimit: false
            }
          },
          testUrl: result.metadata.url,
          confidence: result.success ? 0.8 : 0.3,
          nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          evidence: {
            hash: '',
            timestamp: new Date().toISOString(),
            testResults: 1
          }
        };
        
        await dipService.saveDIP(newDIP);
      } else {
        // Update existing DIP
        const strategyIndex = dip.extractionStrategies.findIndex(s => s.type === strategy);
        
        if (strategyIndex >= 0) {
          // Update existing strategy
          dip.extractionStrategies[strategyIndex] = {
            ...dip.extractionStrategies[strategyIndex],
            success: result.success,
            cost: result.metadata.cost,
            responseTime: result.metadata.extractionTime,
            lastTested: new Date().toISOString(),
            adaptiveSelectors: result.metadata.adaptiveSelectors
          };
        } else {
          // Add new strategy
          dip.extractionStrategies.push({
            type: strategy,
            success: result.success,
            cost: result.metadata.cost,
            responseTime: result.metadata.extractionTime,
            reliability: result.success ? 1.0 : 0.0,
            dataQuality: result.success ? 0.9 : 0.0,
            errorRate: result.success ? 0.0 : 1.0,
            lastTested: new Date().toISOString(),
            adaptiveSelectors: result.metadata.adaptiveSelectors
          });
        }
        
        // Update optimal strategy if this one performed better
        if (result.success && result.metadata.cost < dip.optimalStrategy.costPerExtraction) {
          dip.optimalStrategy.strategy = strategy;
          dip.optimalStrategy.costPerExtraction = result.metadata.cost;
          dip.optimalStrategy.averageResponseTime = result.metadata.extractionTime;
        }
        
        await dipService.saveDIP(dip);
      }
    } catch (error) {
      console.error('Failed to update DIP:', error);
    }
  }

  /**
   * Get extraction statistics
   */
  async getStatistics(): Promise<{
    totalExtractions: number;
    strategyUsage: Record<string, number>;
    averageCost: number;
    averageResponseTime: number;
    successRate: number;
  }> {
    // This would typically query a metrics database
    // For now, return mock data
    return {
      totalExtractions: 0,
      strategyUsage: {},
      averageCost: 0,
      averageResponseTime: 0,
      successRate: 0
    };
  }
}

// Export singleton instance
export const extractionService = new ExtractionService();