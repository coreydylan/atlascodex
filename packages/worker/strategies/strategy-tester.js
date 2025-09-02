// Atlas Codex - Multi-Strategy Testing Framework
// Tests multiple extraction strategies and selects optimal based on cost/quality/speed

const { chromium } = require('playwright-core');
const fetch = require('node-fetch');
const crypto = require('crypto');

class StrategyTester {
  constructor(options = {}) {
    this.browser = null;
    this.strategies = new Map();
    this.results = new Map();
    
    // Testing configuration
    this.config = {
      maxTestTime: options.maxTestTime || 30000,
      costWeights: {
        time: options.timeWeight || 0.3,
        cost: options.costWeight || 0.3,
        quality: options.qualityWeight || 0.4
      },
      minQualityScore: options.minQualityScore || 0.7,
      ...options
    };

    // Register default strategies
    this.registerDefaultStrategies();
  }

  /**
   * Register built-in extraction strategies
   */
  registerDefaultStrategies() {
    // Static fetch strategy
    this.registerStrategy('static_fetch', {
      name: 'Static Fetch',
      cost: 0.01,
      execute: async (url, options) => await this.staticFetchStrategy(url, options)
    });

    // Browser render strategy
    this.registerStrategy('browser_render', {
      name: 'Browser Render',
      cost: 0.05,
      execute: async (url, options) => await this.browserRenderStrategy(url, options)
    });

    // Browser with JavaScript execution
    this.registerStrategy('browser_js', {
      name: 'Browser with JS',
      cost: 0.08,
      execute: async (url, options) => await this.browserJSStrategy(url, options)
    });

    // GPT-5 direct extraction
    this.registerStrategy('gpt5_direct', {
      name: 'GPT-5 Direct',
      cost: 0.50,
      execute: async (url, options) => await this.gpt5DirectStrategy(url, options)
    });

    // GPT-5 with reasoning
    this.registerStrategy('gpt5_reasoning', {
      name: 'GPT-5 with Reasoning',
      cost: 0.75,
      execute: async (url, options) => await this.gpt5ReasoningStrategy(url, options)
    });

    // Hybrid: Browser + GPT-5 fallback
    this.registerStrategy('hybrid_smart', {
      name: 'Hybrid Smart',
      cost: 0.15,
      execute: async (url, options) => await this.hybridSmartStrategy(url, options)
    });
  }

  /**
   * Register a custom extraction strategy
   */
  registerStrategy(id, strategy) {
    this.strategies.set(id, {
      id,
      ...strategy,
      metrics: {
        executions: 0,
        successes: 0,
        failures: 0,
        avgTime: 0,
        avgQuality: 0
      }
    });
  }

  /**
   * Test all strategies for a given URL
   */
  async testAllStrategies(url, expectedContent = null) {
    console.log(`🧪 Testing extraction strategies for ${url}`);
    
    const testResults = {
      url,
      timestamp: new Date().toISOString(),
      strategies: [],
      optimal: null,
      recommendations: []
    };

    // Test each strategy
    for (const [strategyId, strategy] of this.strategies) {
      console.log(`  Testing ${strategy.name}...`);
      
      const result = await this.testStrategy(strategyId, url, expectedContent);
      testResults.strategies.push(result);
      
      // Update strategy metrics
      this.updateStrategyMetrics(strategyId, result);
    }

    // Select optimal strategy
    testResults.optimal = this.selectOptimalStrategy(testResults.strategies);
    
    // Generate recommendations
    testResults.recommendations = this.generateRecommendations(testResults);
    
    // Cache results
    this.results.set(url, testResults);
    
    return testResults;
  }

  /**
   * Test a single strategy
   */
  async testStrategy(strategyId, url, expectedContent = null) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    const startTime = Date.now();
    const result = {
      strategyId,
      name: strategy.name,
      success: false,
      executionTime: 0,
      cost: strategy.cost,
      quality: 0,
      data: null,
      error: null,
      metrics: {}
    };

    try {
      // Execute strategy with timeout
      const extractionResult = await Promise.race([
        strategy.execute(url, { expectedContent }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Strategy timeout')), this.config.maxTestTime)
        )
      ]);

      result.success = true;
      result.data = extractionResult;
      result.executionTime = Date.now() - startTime;
      
      // Calculate quality score
      result.quality = this.calculateQualityScore(extractionResult, expectedContent);
      
      // Strategy-specific metrics
      result.metrics = {
        contentLength: extractionResult.content?.length || 0,
        structuredData: !!extractionResult.structured,
        hasTitle: !!extractionResult.title,
        hasDescription: !!extractionResult.description,
        imageCount: extractionResult.images?.length || 0,
        linkCount: extractionResult.links?.length || 0
      };

    } catch (error) {
      result.success = false;
      result.error = error.message;
      result.executionTime = Date.now() - startTime;
      console.error(`    ❌ ${strategy.name} failed: ${error.message}`);
    }

    // Calculate final score
    result.score = this.calculateStrategyScore(result);
    
    console.log(`    ${result.success ? '✅' : '❌'} ${strategy.name}: ${result.executionTime}ms, quality: ${(result.quality * 100).toFixed(1)}%, cost: $${result.cost.toFixed(3)}`);
    
    return result;
  }

  /**
   * Static fetch strategy implementation
   */
  async staticFetchStrategy(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AtlasCodex/1.0)'
      }
    });

    const html = await response.text();
    
    // Basic extraction without JavaScript
    return {
      url,
      strategy: 'static_fetch',
      content: this.extractTextContent(html),
      title: this.extractTitle(html),
      description: this.extractDescription(html),
      images: this.extractImages(html, url),
      links: this.extractLinks(html, url),
      structured: this.extractStructuredData(html),
      html: html.substring(0, 10000) // First 10KB for evidence
    };
  }

  /**
   * Browser render strategy implementation
   */
  async browserRenderStrategy(url, options = {}) {
    const browser = await this.getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 20000 
      });

      // Extract after DOM ready
      const data = await page.evaluate(() => {
        return {
          title: document.title,
          content: document.body?.innerText || '',
          description: document.querySelector('meta[name="description"]')?.content || '',
          images: Array.from(document.images).map(img => ({
            src: img.src,
            alt: img.alt
          })).slice(0, 20),
          links: Array.from(document.links).map(link => ({
            href: link.href,
            text: link.innerText
          })).slice(0, 50)
        };
      });

      const html = await page.content();

      return {
        url,
        strategy: 'browser_render',
        ...data,
        structured: this.extractStructuredData(html),
        html: html.substring(0, 10000)
      };

    } finally {
      await context.close();
    }
  }

  /**
   * Browser with JavaScript execution strategy
   */
  async browserJSStrategy(url, options = {}) {
    const browser = await this.getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 25000 
      });

      // Wait for dynamic content
      await page.waitForTimeout(2000);

      // Try to trigger lazy loading
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(1000);

      // Extract after full load
      const data = await page.evaluate(() => {
        // More comprehensive extraction
        const getTextFromElement = (element) => {
          return element?.innerText || element?.textContent || '';
        };

        return {
          title: document.title,
          content: getTextFromElement(document.body),
          description: document.querySelector('meta[name="description"]')?.content || 
                      document.querySelector('meta[property="og:description"]')?.content || '',
          author: document.querySelector('meta[name="author"]')?.content || '',
          images: Array.from(document.images).map(img => ({
            src: img.src,
            alt: img.alt,
            title: img.title
          })).slice(0, 30),
          links: Array.from(document.links).map(link => ({
            href: link.href,
            text: getTextFromElement(link),
            rel: link.rel
          })).slice(0, 100),
          metadata: {
            canonical: document.querySelector('link[rel="canonical"]')?.href,
            language: document.documentElement.lang,
            viewport: document.querySelector('meta[name="viewport"]')?.content
          }
        };
      });

      const html = await page.content();

      return {
        url,
        strategy: 'browser_js',
        ...data,
        structured: this.extractStructuredData(html),
        html: html.substring(0, 15000)
      };

    } finally {
      await context.close();
    }
  }

  /**
   * GPT-5 direct extraction strategy
   */
  async gpt5DirectStrategy(url, options = {}) {
    // Fetch HTML first
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AtlasCodex/1.0)'
      }
    });
    const html = await response.text();

    // Simulate GPT-5 extraction (would call actual API)
    // For now, return enhanced static extraction
    const basicExtraction = await this.staticFetchStrategy(url, options);
    
    return {
      ...basicExtraction,
      strategy: 'gpt5_direct',
      enhanced: true,
      gptProcessed: true,
      // Additional fields that GPT-5 would extract
      summary: 'AI-generated summary would go here',
      keyPoints: ['Key point 1', 'Key point 2'],
      entities: ['Entity 1', 'Entity 2'],
      sentiment: 'neutral',
      topics: ['Topic 1', 'Topic 2']
    };
  }

  /**
   * GPT-5 with reasoning strategy
   */
  async gpt5ReasoningStrategy(url, options = {}) {
    // Similar to direct but with more complex reasoning
    const directResult = await this.gpt5DirectStrategy(url, options);
    
    return {
      ...directResult,
      strategy: 'gpt5_reasoning',
      reasoning: {
        contentType: 'article',
        mainTopic: 'technology',
        reliability: 0.95,
        completeness: 0.90
      },
      relationships: [],
      insights: []
    };
  }

  /**
   * Hybrid smart strategy
   */
  async hybridSmartStrategy(url, options = {}) {
    // Try browser first
    try {
      const browserResult = await this.browserRenderStrategy(url, options);
      
      // Check if we got good content
      if (browserResult.content && browserResult.content.length > 500) {
        return {
          ...browserResult,
          strategy: 'hybrid_smart',
          fallbackUsed: false
        };
      }
    } catch (error) {
      console.log('    Browser failed, falling back to GPT-5');
    }

    // Fallback to GPT-5
    const gptResult = await this.gpt5DirectStrategy(url, options);
    return {
      ...gptResult,
      strategy: 'hybrid_smart',
      fallbackUsed: true
    };
  }

  /**
   * Calculate quality score for extracted content
   */
  calculateQualityScore(extraction, expectedContent = null) {
    let score = 0;
    let factors = 0;

    // Content presence (0.3)
    if (extraction.content && extraction.content.length > 100) {
      score += 0.3 * Math.min(1, extraction.content.length / 1000);
      factors++;
    }

    // Title presence (0.2)
    if (extraction.title && extraction.title.length > 5) {
      score += 0.2;
      factors++;
    }

    // Structured data (0.2)
    if (extraction.structured && extraction.structured.length > 0) {
      score += 0.2;
      factors++;
    }

    // Images (0.15)
    if (extraction.images && extraction.images.length > 0) {
      score += 0.15 * Math.min(1, extraction.images.length / 10);
      factors++;
    }

    // Links (0.15)
    if (extraction.links && extraction.links.length > 0) {
      score += 0.15 * Math.min(1, extraction.links.length / 20);
      factors++;
    }

    // Compare with expected content if provided
    if (expectedContent) {
      const similarity = this.calculateSimilarity(extraction.content, expectedContent);
      score = score * 0.7 + similarity * 0.3;
    }

    return factors > 0 ? score : 0;
  }

  /**
   * Calculate strategy score based on multiple factors
   */
  calculateStrategyScore(result) {
    if (!result.success) return 0;

    const weights = this.config.costWeights;
    
    // Normalize factors
    const timeScore = Math.max(0, 1 - (result.executionTime / this.config.maxTestTime));
    const costScore = Math.max(0, 1 - (result.cost / 1.0)); // Max $1 cost
    const qualityScore = result.quality;

    // Weighted score
    return (
      timeScore * weights.time +
      costScore * weights.cost +
      qualityScore * weights.quality
    );
  }

  /**
   * Select optimal strategy based on test results
   */
  selectOptimalStrategy(strategies) {
    // Filter out failed strategies
    const successfulStrategies = strategies.filter(s => 
      s.success && s.quality >= this.config.minQualityScore
    );

    if (successfulStrategies.length === 0) {
      // If no strategy meets quality threshold, pick best quality
      return strategies.reduce((best, current) => 
        current.quality > best.quality ? current : best
      );
    }

    // Select by highest score
    return successfulStrategies.reduce((best, current) => 
      current.score > best.score ? current : best
    );
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations(testResults) {
    const recommendations = [];
    const { strategies, optimal } = testResults;

    // Check if static fetch is sufficient
    const staticStrategy = strategies.find(s => s.strategyId === 'static_fetch');
    if (staticStrategy?.quality > 0.8) {
      recommendations.push('Static fetch provides good quality - use for efficiency');
    }

    // Check if browser is needed
    const browserStrategy = strategies.find(s => s.strategyId === 'browser_render');
    const staticQuality = staticStrategy?.quality || 0;
    const browserQuality = browserStrategy?.quality || 0;
    
    if (browserQuality > staticQuality * 1.3) {
      recommendations.push('Browser rendering significantly improves extraction quality');
    }

    // Check GPT-5 necessity
    const gptStrategy = strategies.find(s => s.strategyId === 'gpt5_direct');
    if (gptStrategy && gptStrategy.strategyId === optimal.strategyId) {
      recommendations.push('GPT-5 required for optimal extraction - consider caching');
    }

    // Cost optimization
    if (optimal.cost > 0.10) {
      const cheaperAlternative = strategies.find(s => 
        s.success && s.quality > 0.7 && s.cost < optimal.cost * 0.5
      );
      if (cheaperAlternative) {
        recommendations.push(`Consider ${cheaperAlternative.name} for 50% cost reduction with acceptable quality`);
      }
    }

    // Speed optimization
    if (optimal.executionTime > 10000) {
      recommendations.push('Consider implementing parallel extraction or caching');
    }

    // Fallback strategy
    const fallbackStrategy = strategies
      .filter(s => s.success && s.strategyId !== optimal.strategyId)
      .sort((a, b) => b.score - a.score)[0];
    
    if (fallbackStrategy) {
      recommendations.push(`Use ${fallbackStrategy.name} as fallback strategy`);
    }

    return recommendations;
  }

  /**
   * Update strategy metrics after test
   */
  updateStrategyMetrics(strategyId, result) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return;

    const metrics = strategy.metrics;
    metrics.executions++;
    
    if (result.success) {
      metrics.successes++;
    } else {
      metrics.failures++;
    }

    // Update running averages
    metrics.avgTime = (metrics.avgTime * (metrics.executions - 1) + result.executionTime) / metrics.executions;
    metrics.avgQuality = (metrics.avgQuality * (metrics.executions - 1) + result.quality) / metrics.executions;
  }

  /**
   * Get or create browser instance
   */
  async getBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  /**
   * Helper: Extract text content from HTML
   */
  extractTextContent(html) {
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  /**
   * Helper: Extract title
   */
  extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : '';
  }

  /**
   * Helper: Extract description
   */
  extractDescription(html) {
    const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    return match ? match[1].trim() : '';
  }

  /**
   * Helper: Extract images
   */
  extractImages(html, baseUrl) {
    const images = [];
    const imgRegex = /<img[^>]+>/gi;
    const matches = html.match(imgRegex) || [];
    
    for (const imgTag of matches.slice(0, 20)) {
      const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
      const altMatch = imgTag.match(/alt=["']([^"']+)["']/i);
      
      if (srcMatch) {
        images.push({
          src: this.resolveUrl(srcMatch[1], baseUrl),
          alt: altMatch ? altMatch[1] : ''
        });
      }
    }
    
    return images;
  }

  /**
   * Helper: Extract links
   */
  extractLinks(html, baseUrl) {
    const links = [];
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) && links.length < 50) {
      links.push({
        href: this.resolveUrl(match[1], baseUrl),
        text: match[2].trim()
      });
    }
    
    return links;
  }

  /**
   * Helper: Extract structured data
   */
  extractStructuredData(html) {
    const structured = [];
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
    let match;
    
    while ((match = jsonLdRegex.exec(html))) {
      try {
        structured.push(JSON.parse(match[1]));
      } catch (e) {
        // Invalid JSON
      }
    }
    
    return structured;
  }

  /**
   * Helper: Resolve relative URLs
   */
  resolveUrl(url, base) {
    try {
      return new URL(url, base).href;
    } catch (e) {
      return url;
    }
  }

  /**
   * Helper: Calculate content similarity
   */
  calculateSimilarity(content1, content2) {
    if (!content1 || !content2) return 0;
    
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = { StrategyTester };