// Atlas Codex - Rendering Type Detection
// Determines if a site uses SSR, SSG, SPA, or hybrid rendering

const { chromium } = require('playwright-core');
const crypto = require('crypto');

class RenderingDetector {
  constructor() {
    this.browser = null;
  }

  /**
   * Initialize browser for dynamic content testing
   */
  async initBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  /**
   * Detect rendering type by comparing static and dynamic content
   */
  async detectRenderingType(url) {
    console.log(`🎨 Detecting rendering type for ${url}`);
    
    const results = {
      type: 'unknown',
      confidence: 0,
      signals: [],
      recommendations: {}
    };

    try {
      // Step 1: Fetch static content
      const staticAnalysis = await this.analyzeStaticContent(url);
      
      // Step 2: Fetch with browser
      const dynamicAnalysis = await this.analyzeDynamicContent(url);
      
      // Step 3: Compare and determine type
      const comparison = this.compareContent(staticAnalysis, dynamicAnalysis);
      
      // Step 4: Analyze patterns
      results.type = this.determineType(comparison, staticAnalysis, dynamicAnalysis);
      results.confidence = comparison.confidence;
      results.signals = comparison.signals;
      results.recommendations = this.getRecommendations(results.type);
      
      console.log(`   Type: ${results.type} (confidence: ${results.confidence}%)`);
      
    } catch (error) {
      console.error('Error detecting rendering type:', error);
      results.type = 'unknown';
      results.signals.push(`error: ${error.message}`);
    }

    return results;
  }

  /**
   * Analyze static content from simple fetch
   */
  async analyzeStaticContent(url) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AtlasCodex/1.0)',
          'Accept': 'text/html,application/xhtml+xml'
        }
      });

      const html = await response.text();
      const loadTime = Date.now() - startTime;

      // Analyze content
      const analysis = {
        html,
        loadTime,
        contentLength: html.length,
        hasContent: this.hasSubstantialContent(html),
        textLength: this.extractText(html).length,
        metaTags: this.extractMetaTags(html),
        structuredData: this.extractStructuredData(html),
        apiEndpoints: this.findAPIEndpoints(html),
        contentHash: crypto.createHash('md5').update(html).digest('hex'),
        indicators: []
      };

      // Check for SSR/SSG indicators
      if (html.includes('__NEXT_DATA__')) {
        analysis.indicators.push('Next.js SSR/SSG data');
      }
      if (html.includes('window.__INITIAL_STATE__')) {
        analysis.indicators.push('SSR initial state');
      }
      if (html.includes('<!-- SSR -->') || html.includes('<!-- Generated')) {
        analysis.indicators.push('SSR comments');
      }
      if (analysis.hasContent && analysis.textLength > 500) {
        analysis.indicators.push('substantial static content');
      }

      return analysis;
    } catch (error) {
      return {
        error: error.message,
        loadTime: Date.now() - startTime,
        hasContent: false,
        indicators: ['fetch failed']
      };
    }
  }

  /**
   * Analyze dynamic content with browser
   */
  async analyzeDynamicContent(url) {
    const startTime = Date.now();
    
    try {
      const browser = await this.initBrowser();
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (compatible; AtlasCodex/1.0)'
      });
      const page = await context.newPage();

      // Track network requests
      const apiCalls = [];
      const resourceTimings = [];
      
      page.on('request', request => {
        const url = request.url();
        if (url.includes('/api/') || url.includes('.json')) {
          apiCalls.push({
            url,
            method: request.method(),
            resourceType: request.resourceType()
          });
        }
      });

      // Navigate and wait for different stages
      const navigationPromise = page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      // Capture content at different stages
      const stages = {};
      
      // After DOM ready
      await navigationPromise;
      stages.domReady = {
        html: await page.content(),
        time: Date.now() - startTime
      };

      // After network idle
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      stages.networkIdle = {
        html: await page.content(),
        time: Date.now() - startTime
      };

      // Check for hydration
      const hasReactHydration = await page.evaluate(() => {
        return window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      });

      const hasVueHydration = await page.evaluate(() => {
        return window.Vue || window.__VUE__;
      });

      // Get final content
      const finalHtml = await page.content();
      const finalText = await page.evaluate(() => document.body?.innerText || '');

      await context.close();

      const analysis = {
        html: finalHtml,
        loadTime: Date.now() - startTime,
        contentLength: finalHtml.length,
        textLength: finalText.length,
        stages,
        apiCalls,
        hasHydration: hasReactHydration || hasVueHydration,
        contentHash: crypto.createHash('md5').update(finalHtml).digest('hex'),
        indicators: []
      };

      // Analyze loading patterns
      if (stages.domReady.html.length < stages.networkIdle.html.length * 0.5) {
        analysis.indicators.push('significant content added after DOM ready');
      }
      if (apiCalls.length > 5) {
        analysis.indicators.push('many API calls');
      }
      if (analysis.hasHydration) {
        analysis.indicators.push('client-side hydration detected');
      }

      return analysis;
    } catch (error) {
      return {
        error: error.message,
        loadTime: Date.now() - startTime,
        indicators: ['browser render failed']
      };
    }
  }

  /**
   * Compare static and dynamic content
   */
  compareContent(staticAnalysis, dynamicAnalysis) {
    const comparison = {
      contentRatio: 0,
      textRatio: 0,
      hashMatch: false,
      confidence: 0,
      signals: []
    };

    // Handle errors
    if (staticAnalysis.error || dynamicAnalysis.error) {
      comparison.signals.push('analysis error');
      return comparison;
    }

    // Compare content lengths
    comparison.contentRatio = staticAnalysis.contentLength / Math.max(dynamicAnalysis.contentLength, 1);
    comparison.textRatio = staticAnalysis.textLength / Math.max(dynamicAnalysis.textLength, 1);
    comparison.hashMatch = staticAnalysis.contentHash === dynamicAnalysis.contentHash;

    // Analyze ratios
    if (comparison.contentRatio > 0.9) {
      comparison.confidence += 40;
      comparison.signals.push('static and dynamic content similar');
    } else if (comparison.contentRatio > 0.7) {
      comparison.confidence += 25;
      comparison.signals.push('moderate content similarity');
    } else if (comparison.contentRatio < 0.3) {
      comparison.confidence += 10;
      comparison.signals.push('significant dynamic content generation');
    }

    // Check text content ratio
    if (comparison.textRatio > 0.8) {
      comparison.confidence += 30;
      comparison.signals.push('text content mostly static');
    } else if (comparison.textRatio < 0.2) {
      comparison.confidence += 10;
      comparison.signals.push('text dynamically generated');
    }

    // Check for hydration
    if (dynamicAnalysis.hasHydration && comparison.contentRatio > 0.7) {
      comparison.confidence += 20;
      comparison.signals.push('SSR with hydration');
    }

    // API calls analysis
    if (dynamicAnalysis.apiCalls?.length > 10) {
      comparison.signals.push('heavy API usage');
    }

    return comparison;
  }

  /**
   * Determine rendering type based on analysis
   */
  determineType(comparison, staticAnalysis, dynamicAnalysis) {
    // Check for static site generation
    if (comparison.contentRatio > 0.95 && staticAnalysis.hasContent) {
      return 'static';
    }

    // Check for SSR
    if (comparison.contentRatio > 0.7 && staticAnalysis.hasContent) {
      if (staticAnalysis.indicators.includes('Next.js SSR/SSG data') ||
          staticAnalysis.indicators.includes('SSR initial state')) {
        return 'ssr';
      }
      if (dynamicAnalysis.hasHydration) {
        return 'ssr';
      }
    }

    // Check for SPA
    if (comparison.contentRatio < 0.5 || !staticAnalysis.hasContent) {
      if (dynamicAnalysis.indicators.includes('significant content added after DOM ready')) {
        return 'spa';
      }
      if (dynamicAnalysis.apiCalls?.length > 5) {
        return 'spa';
      }
    }

    // Hybrid (SSR + client-side)
    if (comparison.contentRatio > 0.5 && comparison.contentRatio < 0.8) {
      if (dynamicAnalysis.hasHydration || dynamicAnalysis.apiCalls?.length > 3) {
        return 'hybrid';
      }
    }

    // Default based on content presence
    return staticAnalysis.hasContent ? 'ssr' : 'spa';
  }

  /**
   * Get recommendations based on rendering type
   */
  getRecommendations(type) {
    const recommendations = {
      'static': {
        strategy: 'static_fetch',
        browserNeeded: false,
        waitStrategy: 'none',
        cacheStrategy: 'aggressive',
        tips: [
          'Use simple fetch for best performance',
          'Content is pre-rendered, no JS needed',
          'Can cache aggressively'
        ]
      },
      'ssr': {
        strategy: 'static_fetch',
        browserNeeded: false,
        waitStrategy: 'domcontentloaded',
        cacheStrategy: 'moderate',
        tips: [
          'Initial content available via fetch',
          'May need browser for interactive elements',
          'Check for API endpoints for dynamic data'
        ]
      },
      'spa': {
        strategy: 'browser_render',
        browserNeeded: true,
        waitStrategy: 'networkidle',
        cacheStrategy: 'conservative',
        tips: [
          'Requires browser for content rendering',
          'Wait for network idle for complete content',
          'Look for API endpoints to bypass rendering'
        ]
      },
      'hybrid': {
        strategy: 'smart',
        browserNeeded: 'sometimes',
        waitStrategy: 'adaptive',
        cacheStrategy: 'selective',
        tips: [
          'Test both static and dynamic strategies',
          'May vary by page type',
          'Monitor which pages need browser'
        ]
      },
      'unknown': {
        strategy: 'browser_render',
        browserNeeded: true,
        waitStrategy: 'networkidle',
        cacheStrategy: 'conservative',
        tips: [
          'Default to browser for safety',
          'Collect more data for better detection',
          'Test multiple strategies'
        ]
      }
    };

    return recommendations[type] || recommendations['unknown'];
  }

  /**
   * Helper: Check if HTML has substantial content
   */
  hasSubstantialContent(html) {
    const textContent = this.extractText(html);
    const hasArticle = html.includes('<article') || html.includes('<main');
    const hasHeadings = html.includes('<h1') || html.includes('<h2');
    const hasParaphs = (html.match(/<p[^>]*>/g) || []).length > 3;
    
    return textContent.length > 200 && (hasArticle || hasHeadings || hasParaphs);
  }

  /**
   * Helper: Extract text content from HTML
   */
  extractText(html) {
    // Remove scripts and styles
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  /**
   * Helper: Extract meta tags
   */
  extractMetaTags(html) {
    const metaTags = {};
    const matches = html.match(/<meta[^>]+>/gi) || [];
    
    matches.forEach(tag => {
      const nameMatch = tag.match(/name="([^"]+)"/i);
      const contentMatch = tag.match(/content="([^"]+)"/i);
      
      if (nameMatch && contentMatch) {
        metaTags[nameMatch[1]] = contentMatch[1];
      }
    });
    
    return metaTags;
  }

  /**
   * Helper: Extract structured data
   */
  extractStructuredData(html) {
    const structured = [];
    
    // Find JSON-LD
    const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gis) || [];
    jsonLdMatches.forEach(match => {
      try {
        const json = match.replace(/<script[^>]*type="application\/ld\+json"[^>]*>|<\/script>/gi, '');
        structured.push(JSON.parse(json));
      } catch (e) {
        // Invalid JSON
      }
    });
    
    return structured;
  }

  /**
   * Helper: Find API endpoints in HTML
   */
  findAPIEndpoints(html) {
    const endpoints = new Set();
    
    // Common API patterns
    const patterns = [
      /["'](\/api\/[^"']+)["']/g,
      /["'](https?:\/\/[^"']*\/api\/[^"']+)["']/g,
      /["'](\/v\d+\/[^"']+)["']/g,
      /["'](\/graphql[^"']*)["']/g,
      /["'](\/rest\/[^"']+)["']/g
    ];
    
    patterns.forEach(pattern => {
      const matches = html.match(pattern) || [];
      matches.forEach(match => {
        const endpoint = match.slice(1, -1); // Remove quotes
        endpoints.add(endpoint);
      });
    });
    
    return Array.from(endpoints);
  }

  /**
   * Cleanup browser instance
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = { RenderingDetector };