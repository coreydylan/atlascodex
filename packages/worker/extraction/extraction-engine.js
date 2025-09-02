// Atlas Codex - Intelligent Extraction Engine
// Core extraction engine that uses DIPs for optimal content extraction

const { chromium } = require('playwright-core');
const fetch = require('node-fetch');
const crypto = require('crypto');
const { DIPSystem } = require('../dip');
const { StrategyManager } = require('../strategies');

class ExtractionEngine {
  constructor(options = {}) {
    this.dipSystem = new DIPSystem(options.dip);
    this.strategyManager = new StrategyManager(options.strategy);
    this.browser = null;
    
    this.config = {
      maxExtractionTime: options.maxExtractionTime || 30000,
      enableEvidence: options.enableEvidence !== false,
      enableMetrics: options.enableMetrics !== false,
      retryOnFailure: options.retryOnFailure !== false,
      maxRetries: options.maxRetries || 2,
      ...options
    };
    
    this.metrics = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      totalTime: 0,
      totalCost: 0,
      strategyUsage: {}
    };
    
    this.executionHistory = [];
  }

  /**
   * Main extraction method
   */
  async extract(url, options = {}) {
    console.log(`🎯 Starting intelligent extraction for ${url}`);
    
    const startTime = Date.now();
    const extractionId = this.generateExtractionId(url);
    
    const extraction = {
      id: extractionId,
      url,
      startTime: new Date().toISOString(),
      status: 'pending',
      data: null,
      evidence: null,
      metrics: {},
      errors: []
    };

    try {
      // Step 1: Get DIP for optimal strategy
      console.log('  📋 Getting DIP...');
      const dip = await this.dipSystem.getDIPForExtraction(url, options);
      extraction.dip = {
        id: dip.metadata.dipId,
        confidence: dip.metadata.confidence,
        strategy: dip.strategy.primary
      };

      // Step 2: Apply constraints
      console.log('  🔒 Applying constraints...');
      await this.applyConstraints(dip.constraints);

      // Step 3: Execute extraction with selected strategy
      console.log(`  🚀 Executing ${dip.strategy.primary} strategy...`);
      const result = await this.executeExtraction(url, dip, options);
      
      extraction.data = result.data;
      extraction.strategy = result.strategy;
      extraction.status = 'success';

      // Step 4: Generate evidence if enabled
      if (this.config.enableEvidence) {
        console.log('  🔐 Generating evidence...');
        extraction.evidence = this.generateEvidence(result);
      }

      // Step 5: Update DIP with extraction results
      await this.dipSystem.updateDIPFromExtraction(
        new URL(url).hostname,
        {
          success: true,
          strategy: result.strategy,
          duration: Date.now() - startTime,
          cost: result.cost
        }
      );

      console.log('  ✅ Extraction successful');

    } catch (error) {
      extraction.status = 'failed';
      extraction.errors.push({
        message: error.message,
        timestamp: new Date().toISOString()
      });
      console.error(`  ❌ Extraction failed: ${error.message}`);
      
      // Update DIP with failure
      await this.dipSystem.updateDIPFromExtraction(
        new URL(url).hostname,
        {
          success: false,
          duration: Date.now() - startTime
        }
      );
    }

    // Record metrics
    extraction.endTime = new Date().toISOString();
    extraction.duration = Date.now() - startTime;
    extraction.metrics = this.calculateMetrics(extraction);
    
    this.updateMetrics(extraction);
    this.executionHistory.push(extraction);

    return extraction;
  }

  /**
   * Execute extraction with DIP-selected strategy
   */
  async executeExtraction(url, dip, options) {
    const strategies = {
      'static_fetch': () => this.extractStaticFetch(url, dip, options),
      'browser_render': () => this.extractBrowserRender(url, dip, options),
      'browser_js': () => this.extractBrowserJS(url, dip, options),
      'gpt5_direct': () => this.extractGPT5Direct(url, dip, options),
      'gpt5_reasoning': () => this.extractGPT5Reasoning(url, dip, options),
      'hybrid_smart': () => this.extractHybridSmart(url, dip, options)
    };

    const primaryStrategy = strategies[dip.strategy.primary];
    const fallbackStrategy = strategies[dip.strategy.fallback];

    if (!primaryStrategy) {
      throw new Error(`Unknown strategy: ${dip.strategy.primary}`);
    }

    let result = null;
    let attempts = 0;

    // Try primary strategy
    while (attempts < this.config.maxRetries && !result) {
      try {
        result = await Promise.race([
          primaryStrategy(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Extraction timeout')), this.config.maxExtractionTime)
          )
        ]);
        
        if (this.validateExtraction(result)) {
          result.strategy = dip.strategy.primary;
          result.attempts = attempts + 1;
          return result;
        }
      } catch (error) {
        attempts++;
        console.log(`    Attempt ${attempts} failed: ${error.message}`);
        
        if (attempts < this.config.maxRetries) {
          await this.delay(2000 * attempts); // Exponential backoff
        }
      }
    }

    // Try fallback strategy
    if (fallbackStrategy && this.config.retryOnFailure) {
      console.log(`  🔄 Trying fallback strategy: ${dip.strategy.fallback}`);
      
      try {
        result = await fallbackStrategy();
        
        if (this.validateExtraction(result)) {
          result.strategy = dip.strategy.fallback;
          result.attempts = attempts + 1;
          result.usedFallback = true;
          return result;
        }
      } catch (error) {
        console.log(`    Fallback failed: ${error.message}`);
      }
    }

    throw new Error('All extraction strategies failed');
  }

  /**
   * Static fetch extraction
   */
  async extractStaticFetch(url, dip, options) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AtlasCodex/1.0)',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    // Apply DIP selectors if available
    const extracted = this.applySelectors(html, dip.selectors);
    
    return {
      data: {
        url,
        title: extracted.title || this.extractTitle(html),
        content: extracted.content || this.extractContent(html),
        description: extracted.description || this.extractDescription(html),
        images: extracted.images || this.extractImages(html, url),
        links: extracted.links || this.extractLinks(html, url),
        structured: this.extractStructuredData(html),
        metadata: this.extractMetadata(html)
      },
      html: html.substring(0, 10000),
      cost: 0.01
    };
  }

  /**
   * Browser render extraction
   */
  async extractBrowserRender(url, dip, options) {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; AtlasCodex/1.0)',
      ...options.contextOptions
    });
    const page = await context.newPage();

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      // Apply DIP selectors
      const data = await this.extractWithSelectors(page, dip.selectors);
      const html = await page.content();

      return {
        data: {
          url,
          ...data,
          structured: this.extractStructuredData(html),
          metadata: this.extractMetadata(html)
        },
        html: html.substring(0, 10000),
        cost: 0.05
      };

    } finally {
      await context.close();
    }
  }

  /**
   * Browser with JavaScript extraction
   */
  async extractBrowserJS(url, dip, options) {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; AtlasCodex/1.0)',
      ...options.contextOptions
    });
    const page = await context.newPage();

    try {
      // Track dynamic content loading
      const contentChanges = [];
      
      page.on('response', response => {
        if (response.url().includes('/api/') || response.url().includes('.json')) {
          contentChanges.push({
            url: response.url(),
            status: response.status(),
            type: 'api'
          });
        }
      });

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 25000
      });

      // Wait for dynamic content based on framework
      if (dip.framework === 'react' || dip.framework === 'vue') {
        await page.waitForTimeout(2000);
      }

      // Trigger lazy loading
      await this.triggerLazyLoading(page);

      // Extract with selectors
      const data = await this.extractWithSelectors(page, dip.selectors);
      const html = await page.content();

      return {
        data: {
          url,
          ...data,
          structured: this.extractStructuredData(html),
          metadata: this.extractMetadata(html),
          dynamic: {
            contentChanges: contentChanges.length,
            framework: dip.framework
          }
        },
        html: html.substring(0, 15000),
        cost: 0.08
      };

    } finally {
      await context.close();
    }
  }

  /**
   * GPT-5 direct extraction
   */
  async extractGPT5Direct(url, dip, options) {
    // First get HTML content
    const htmlResult = await this.extractStaticFetch(url, dip, options);
    
    // Prepare GPT-5 prompt
    const prompt = this.buildGPT5Prompt(htmlResult.html, {
      type: 'direct',
      targetFields: options.targetFields || ['title', 'content', 'summary', 'entities'],
      framework: dip.framework
    });

    // Simulate GPT-5 call (would be actual API call)
    const gptResult = await this.callGPT5(prompt, {
      verbosity: 2,
      reasoning_effort: 'low'
    });

    return {
      data: {
        ...htmlResult.data,
        ...gptResult,
        extractionMethod: 'gpt5_direct'
      },
      html: htmlResult.html,
      cost: 0.50
    };
  }

  /**
   * GPT-5 with reasoning extraction
   */
  async extractGPT5Reasoning(url, dip, options) {
    // Get browser-rendered content for better context
    const browserResult = await this.extractBrowserRender(url, dip, options);
    
    // Prepare enhanced GPT-5 prompt
    const prompt = this.buildGPT5Prompt(browserResult.html, {
      type: 'reasoning',
      targetFields: options.targetFields || ['title', 'content', 'summary', 'entities', 'insights'],
      framework: dip.framework,
      includeReasoning: true
    });

    // Simulate GPT-5 call with reasoning
    const gptResult = await this.callGPT5(prompt, {
      verbosity: 3,
      reasoning_effort: 'high'
    });

    return {
      data: {
        ...browserResult.data,
        ...gptResult,
        extractionMethod: 'gpt5_reasoning',
        reasoning: gptResult.reasoning
      },
      html: browserResult.html,
      cost: 0.75
    };
  }

  /**
   * Hybrid smart extraction
   */
  async extractHybridSmart(url, dip, options) {
    let result = null;

    // Try browser first for structured content
    try {
      result = await this.extractBrowserRender(url, dip, options);
      
      // Check if we got good content
      if (result.data.content && result.data.content.length > 500) {
        result.data.extractionMethod = 'hybrid_browser';
        result.cost = 0.10;
        return result;
      }
    } catch (error) {
      console.log('    Browser extraction insufficient, enhancing with GPT-5');
    }

    // Enhance with GPT-5
    const gptResult = await this.extractGPT5Direct(url, dip, options);
    gptResult.data.extractionMethod = 'hybrid_gpt5';
    gptResult.cost = 0.15;
    
    return gptResult;
  }

  /**
   * Apply DIP selectors to extract content
   */
  applySelectors(html, selectors) {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const extracted = {};

    if (selectors.title) {
      extracted.title = $(selectors.title).first().text().trim();
    }

    if (selectors.content) {
      extracted.content = $(selectors.content).text().trim();
    }

    if (selectors.description) {
      extracted.description = $(selectors.description).text().trim();
    }

    if (selectors.images) {
      extracted.images = [];
      $(selectors.images).each((i, elem) => {
        const src = $(elem).attr('src');
        if (src) {
          extracted.images.push({
            src,
            alt: $(elem).attr('alt') || ''
          });
        }
      });
    }

    if (selectors.links) {
      extracted.links = [];
      $(selectors.links).each((i, elem) => {
        const href = $(elem).attr('href');
        if (href) {
          extracted.links.push({
            href,
            text: $(elem).text().trim()
          });
        }
      });
    }

    return extracted;
  }

  /**
   * Extract content using Playwright selectors
   */
  async extractWithSelectors(page, selectors) {
    const data = {};

    // Default extraction
    data.title = await page.title();
    
    try {
      data.content = await page.evaluate(() => document.body?.innerText || '');
    } catch {
      data.content = '';
    }

    // Apply custom selectors
    if (selectors.title) {
      try {
        data.title = await page.textContent(selectors.title) || data.title;
      } catch {}
    }

    if (selectors.content) {
      try {
        data.content = await page.textContent(selectors.content) || data.content;
      } catch {}
    }

    if (selectors.description) {
      try {
        data.description = await page.textContent(selectors.description);
      } catch {
        data.description = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');
      }
    }

    // Extract images
    data.images = await page.evaluate((selector) => {
      const images = selector ? 
        document.querySelectorAll(selector) : 
        document.querySelectorAll('img');
      
      return Array.from(images).slice(0, 20).map(img => ({
        src: img.src,
        alt: img.alt || ''
      }));
    }, selectors.images);

    // Extract links
    data.links = await page.evaluate((selector) => {
      const links = selector ? 
        document.querySelectorAll(selector) : 
        document.querySelectorAll('a[href]');
      
      return Array.from(links).slice(0, 50).map(link => ({
        href: link.href,
        text: link.innerText?.trim() || ''
      }));
    }, selectors.links);

    return data;
  }

  /**
   * Trigger lazy loading on page
   */
  async triggerLazyLoading(page) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 3);
    });
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(1000);
  }

  /**
   * Build GPT-5 prompt
   */
  buildGPT5Prompt(html, options) {
    return {
      system: "Extract structured information from the provided HTML content.",
      user: `Extract the following fields from this HTML:
        ${options.targetFields.join(', ')}
        
        Framework: ${options.framework}
        Include reasoning: ${options.includeReasoning}
        
        HTML:
        ${html.substring(0, 8000)}`,
      parameters: {
        type: options.type,
        fields: options.targetFields
      }
    };
  }

  /**
   * Simulate GPT-5 API call
   */
  async callGPT5(prompt, parameters) {
    // This would be the actual GPT-5 API call
    await this.delay(1000); // Simulate API delay
    
    return {
      title: 'GPT-5 Extracted Title',
      content: 'GPT-5 extracted and enhanced content...',
      summary: 'AI-generated summary of the content',
      entities: ['Entity1', 'Entity2', 'Entity3'],
      insights: ['Insight about the content'],
      reasoning: parameters.reasoning_effort === 'high' ? 
        'Detailed reasoning about extraction choices' : undefined
    };
  }

  /**
   * Validate extraction result
   */
  validateExtraction(result) {
    if (!result || !result.data) return false;
    
    // Must have URL and some content
    if (!result.data.url) return false;
    
    // Check for minimum content
    const hasContent = result.data.content && result.data.content.length > 50;
    const hasTitle = result.data.title && result.data.title.length > 0;
    const hasStructured = result.data.structured && result.data.structured.length > 0;
    
    return hasContent || hasTitle || hasStructured;
  }

  /**
   * Generate evidence for extraction
   */
  generateEvidence(result) {
    const evidence = {
      hash: crypto.createHash('sha256').update(JSON.stringify(result.data)).digest('hex'),
      timestamp: new Date().toISOString(),
      strategy: result.strategy,
      htmlSnapshot: result.html ? crypto.createHash('sha256').update(result.html).digest('hex') : null,
      contentStats: {
        titleLength: result.data.title?.length || 0,
        contentLength: result.data.content?.length || 0,
        imageCount: result.data.images?.length || 0,
        linkCount: result.data.links?.length || 0
      }
    };

    // Add cryptographic signature
    evidence.signature = this.signEvidence(evidence);
    
    return evidence;
  }

  /**
   * Sign evidence cryptographically
   */
  signEvidence(evidence) {
    const dataToSign = JSON.stringify({
      hash: evidence.hash,
      timestamp: evidence.timestamp,
      strategy: evidence.strategy
    });
    
    return crypto
      .createHash('sha512')
      .update(dataToSign + ':atlascodex:v1')
      .digest('hex');
  }

  /**
   * Apply rate limiting and other constraints
   */
  async applyConstraints(constraints) {
    if (constraints.rateLimit) {
      const delay = constraints.rateLimit;
      console.log(`    Applying rate limit: ${delay}ms delay`);
      await this.delay(delay);
    }
    
    // Would check authentication, geo-restrictions, etc.
  }

  /**
   * Calculate extraction metrics
   */
  calculateMetrics(extraction) {
    return {
      duration: extraction.duration,
      dataCompleteness: this.calculateCompleteness(extraction.data),
      evidenceGenerated: !!extraction.evidence,
      strategyUsed: extraction.strategy || 'unknown',
      dipConfidence: extraction.dip?.confidence || 0
    };
  }

  /**
   * Calculate data completeness score
   */
  calculateCompleteness(data) {
    if (!data) return 0;
    
    let score = 0;
    let fields = 0;
    
    if (data.title) { score++; }
    fields++;
    
    if (data.content && data.content.length > 100) { score++; }
    fields++;
    
    if (data.description) { score++; }
    fields++;
    
    if (data.images && data.images.length > 0) { score++; }
    fields++;
    
    if (data.links && data.links.length > 0) { score++; }
    fields++;
    
    if (data.structured && data.structured.length > 0) { score++; }
    fields++;
    
    return score / fields;
  }

  /**
   * Update global metrics
   */
  updateMetrics(extraction) {
    this.metrics.totalExtractions++;
    
    if (extraction.status === 'success') {
      this.metrics.successfulExtractions++;
    } else {
      this.metrics.failedExtractions++;
    }
    
    this.metrics.totalTime += extraction.duration || 0;
    
    if (extraction.strategy) {
      this.metrics.strategyUsage[extraction.strategy] = 
        (this.metrics.strategyUsage[extraction.strategy] || 0) + 1;
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
    
    this.metrics.totalCost += costMap[extraction.strategy] || 0.10;
  }

  /**
   * Helper methods
   */
  extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : '';
  }

  extractContent(html) {
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  extractDescription(html) {
    const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    return match ? match[1].trim() : '';
  }

  extractImages(html, baseUrl) {
    const images = [];
    const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    
    while ((match = regex.exec(html)) && images.length < 20) {
      images.push({
        src: this.resolveUrl(match[1], baseUrl),
        alt: ''
      });
    }
    
    return images;
  }

  extractLinks(html, baseUrl) {
    const links = [];
    const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    let match;
    
    while ((match = regex.exec(html)) && links.length < 50) {
      links.push({
        href: this.resolveUrl(match[1], baseUrl),
        text: match[2].trim()
      });
    }
    
    return links;
  }

  extractStructuredData(html) {
    const structured = [];
    const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
    let match;
    
    while ((match = regex.exec(html))) {
      try {
        structured.push(JSON.parse(match[1]));
      } catch {}
    }
    
    return structured;
  }

  extractMetadata(html) {
    const metadata = {};
    const regex = /<meta[^>]+>/gi;
    const matches = html.match(regex) || [];
    
    matches.forEach(tag => {
      const nameMatch = tag.match(/name=["']([^"']+)["']/i);
      const contentMatch = tag.match(/content=["']([^"']+)["']/i);
      
      if (nameMatch && contentMatch) {
        metadata[nameMatch[1]] = contentMatch[1];
      }
    });
    
    return metadata;
  }

  resolveUrl(url, base) {
    try {
      return new URL(url, base).href;
    } catch {
      return url;
    }
  }

  generateExtractionId(url) {
    const timestamp = Date.now();
    const hash = crypto.createHash('sha256').update(`${url}:${timestamp}`).digest('hex');
    return `ext_${hash.substring(0, 12)}`;
  }

  async getBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get extraction statistics
   */
  getStatistics() {
    const successRate = this.metrics.totalExtractions > 0 ?
      this.metrics.successfulExtractions / this.metrics.totalExtractions : 0;
    
    const avgTime = this.metrics.totalExtractions > 0 ?
      this.metrics.totalTime / this.metrics.totalExtractions : 0;
    
    const avgCost = this.metrics.totalExtractions > 0 ?
      this.metrics.totalCost / this.metrics.totalExtractions : 0;
    
    return {
      ...this.metrics,
      successRate,
      avgTime,
      avgCost,
      recentExtractions: this.executionHistory.slice(-10)
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    await this.dipSystem.shutdown();
  }
}

module.exports = { ExtractionEngine };