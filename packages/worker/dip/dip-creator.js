// Atlas Codex - DIP Creation Engine
// Orchestrates the creation of comprehensive Domain Intelligence Profiles

const { FrameworkDetector } = require('../analysis/framework-detector');
const { RenderingDetector } = require('../analysis/rendering-detector');
const { PatternAnalyzer } = require('../analysis/pattern-analyzer');
const { RobotsAnalyzer } = require('../analysis/robots-analyzer');
const { RateLimitDetector } = require('../analysis/rate-limit-detector');
const { StrategyManager } = require('../strategies');
const crypto = require('crypto');

class DIPCreator {
  constructor(options = {}) {
    this.frameworkDetector = new FrameworkDetector();
    this.renderingDetector = new RenderingDetector();
    this.patternAnalyzer = new PatternAnalyzer();
    this.robotsAnalyzer = new RobotsAnalyzer();
    this.rateLimitDetector = new RateLimitDetector();
    this.strategyManager = new StrategyManager(options.strategy);
    
    this.config = {
      maxAnalysisTime: options.maxAnalysisTime || 60000,
      sampleSize: options.sampleSize || 5,
      testStrategies: options.testStrategies !== false,
      detectRateLimits: options.detectRateLimits !== false,
      ...options
    };
  }

  /**
   * Create a comprehensive DIP for a domain
   */
  async createDIP(domain, initialUrl = null) {
    console.log(`🏗️ Creating Domain Intelligence Profile for ${domain}`);
    
    const startTime = Date.now();
    const url = initialUrl || `https://${domain}`;
    
    const dip = {
      domain,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      siteStructure: null,
      extractionStrategies: [],
      optimalStrategy: null,
      costProfile: null,
      performanceMetrics: null,
      constraints: null,
      metadata: {
        analysisTime: 0,
        confidenceScore: 0,
        sampleUrls: [],
        errors: []
      }
    };

    try {
      // Step 1: Analyze site structure and constraints
      console.log('  📋 Step 1: Analyzing site structure...');
      const siteAnalysis = await this.analyzeSite(domain, url);
      dip.siteStructure = siteAnalysis.structure;
      dip.constraints = siteAnalysis.constraints;
      dip.metadata.sampleUrls = siteAnalysis.sampleUrls;

      // Step 2: Test extraction strategies
      console.log('  🧪 Step 2: Testing extraction strategies...');
      const strategyResults = await this.testStrategies(url, siteAnalysis);
      dip.extractionStrategies = strategyResults.strategies;
      dip.optimalStrategy = strategyResults.optimal;

      // Step 3: Build cost profile
      console.log('  💰 Step 3: Building cost profile...');
      dip.costProfile = this.buildCostProfile(strategyResults, siteAnalysis);

      // Step 4: Calculate performance metrics
      console.log('  📊 Step 4: Calculating performance metrics...');
      dip.performanceMetrics = this.calculatePerformanceMetrics(strategyResults, siteAnalysis);

      // Step 5: Generate confidence score
      dip.metadata.confidenceScore = this.calculateConfidence(dip);
      dip.metadata.analysisTime = Date.now() - startTime;

      console.log(`  ✅ DIP created successfully (confidence: ${(dip.metadata.confidenceScore * 100).toFixed(1)}%)`);

    } catch (error) {
      console.error(`  ❌ Error creating DIP: ${error.message}`);
      dip.metadata.errors.push({
        stage: 'creation',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    return dip;
  }

  /**
   * Analyze site structure and constraints
   */
  async analyzeSite(domain, url) {
    const analysis = {
      structure: {
        framework: null,
        rendering: null,
        patterns: null,
        navigation: null,
        contentTypes: []
      },
      constraints: {
        robots: null,
        rateLimit: null,
        authentication: null,
        geo: null
      },
      sampleUrls: []
    };

    try {
      // Fetch initial HTML
      const response = await fetch(url);
      const html = await response.text();
      const headers = Object.fromEntries(response.headers.entries());

      // Parallel analysis
      const [framework, rendering, patterns, robots, rateLimit] = await Promise.all([
        this.frameworkDetector.detect(url, html, headers),
        this.renderingDetector.detectRenderingType(url),
        this.patternAnalyzer.analyzePatterns(html, url),
        this.robotsAnalyzer.analyzeRobotsTxt(domain),
        this.config.detectRateLimits ? 
          this.rateLimitDetector.detectRateLimits(domain) : 
          Promise.resolve(null)
      ]);

      // Structure analysis
      analysis.structure.framework = {
        primary: framework.primary,
        confidence: framework.confidence,
        frameworks: framework.frameworks,
        techStack: framework.techStack
      };

      analysis.structure.rendering = {
        type: rendering.type,
        confidence: rendering.confidence,
        recommendations: rendering.recommendations
      };

      analysis.structure.patterns = {
        contentType: patterns.contentType,
        selectors: patterns.selectors,
        repeatingPatterns: patterns.repeatingPatterns,
        microdata: patterns.microdata
      };

      // Extract sample URLs from patterns
      if (patterns.links) {
        analysis.sampleUrls = this.selectSampleUrls(patterns.links, domain);
      }

      // Navigation structure
      analysis.structure.navigation = this.analyzeNavigation(patterns);

      // Content types detected
      analysis.structure.contentTypes = this.detectContentTypes(patterns);

      // Constraints
      analysis.constraints.robots = {
        exists: robots.exists,
        disallowedPaths: robots.disallowedPaths,
        crawlDelay: robots.crawlDelay,
        sitemapUrls: robots.sitemapUrls
      };

      if (rateLimit) {
        analysis.constraints.rateLimit = {
          hasLimit: rateLimit.hasRateLimit,
          maxRequestsPerMinute: rateLimit.maxRequestsPerMinute,
          recommendedDelay: rateLimit.recommendedDelay,
          burstLimit: rateLimit.burstLimit
        };
      }

      // Check for authentication requirements
      analysis.constraints.authentication = this.detectAuthRequirements(html, headers);

      // Check for geo-restrictions
      analysis.constraints.geo = this.detectGeoRestrictions(headers);

    } catch (error) {
      console.error(`    Error analyzing site: ${error.message}`);
      analysis.error = error.message;
    }

    // Cleanup rendering detector
    await this.renderingDetector.cleanup();

    return analysis;
  }

  /**
   * Test extraction strategies
   */
  async testStrategies(url, siteAnalysis) {
    const results = {
      strategies: [],
      optimal: null,
      testResults: null
    };

    if (!this.config.testStrategies) {
      // Skip testing, use defaults based on analysis
      results.optimal = this.selectDefaultStrategy(siteAnalysis);
      return results;
    }

    try {
      // Run strategy tests
      const testResults = await this.strategyManager.runStrategyTests(url, siteAnalysis);
      results.testResults = testResults;

      // Format strategy results
      results.strategies = testResults.strategies.map(strategy => ({
        id: strategy.strategyId,
        name: strategy.name,
        success: strategy.success,
        quality: strategy.quality,
        executionTime: strategy.executionTime,
        cost: strategy.cost,
        score: strategy.score,
        metrics: strategy.metrics
      }));

      // Set optimal strategy
      if (testResults.optimal) {
        results.optimal = {
          strategyId: testResults.optimal.strategyId,
          confidence: testResults.optimal.quality,
          fallback: this.selectFallbackStrategy(testResults.optimal, testResults.strategies),
          reasoning: testResults.recommendations
        };
      }

    } catch (error) {
      console.error(`    Error testing strategies: ${error.message}`);
      
      // Fallback to default selection
      results.optimal = this.selectDefaultStrategy(siteAnalysis);
    }

    return results;
  }

  /**
   * Build cost profile for the domain
   */
  buildCostProfile(strategyResults, siteAnalysis) {
    const profile = {
      estimatedCostPerExtraction: 0,
      costBreakdown: {},
      optimizationPotential: 0,
      recommendations: []
    };

    // Calculate average cost based on strategy performance
    if (strategyResults.strategies.length > 0) {
      const successfulStrategies = strategyResults.strategies.filter(s => s.success);
      
      successfulStrategies.forEach(strategy => {
        profile.costBreakdown[strategy.id] = {
          baseCost: strategy.cost,
          successRate: strategy.success ? 1 : 0,
          effectiveCost: strategy.cost / (strategy.quality || 0.1)
        };
      });

      // Estimated cost with optimal strategy
      if (strategyResults.optimal) {
        const optimalCost = profile.costBreakdown[strategyResults.optimal.strategyId]?.baseCost || 0.10;
        const fallbackCost = 0.20; // Assume fallback cost
        
        // Factor in fallback probability (10%)
        profile.estimatedCostPerExtraction = optimalCost + (fallbackCost * 0.1);
      }
    }

    // Calculate optimization potential
    const cheapestViable = Object.values(profile.costBreakdown)
      .filter(c => c.successRate > 0)
      .sort((a, b) => a.baseCost - b.baseCost)[0];
    
    const mostExpensive = Object.values(profile.costBreakdown)
      .sort((a, b) => b.baseCost - a.baseCost)[0];
    
    if (cheapestViable && mostExpensive) {
      profile.optimizationPotential = 
        (mostExpensive.baseCost - cheapestViable.baseCost) / mostExpensive.baseCost;
    }

    // Generate recommendations
    if (profile.optimizationPotential > 0.5) {
      profile.recommendations.push('High cost optimization potential - consider using cheaper strategies');
    }

    if (siteAnalysis.constraints?.rateLimit?.hasLimit) {
      profile.recommendations.push('Rate limits may increase extraction time and cost');
    }

    if (siteAnalysis.structure?.rendering?.type === 'static') {
      profile.recommendations.push('Static content allows for cost-efficient extraction');
    }

    return profile;
  }

  /**
   * Calculate performance metrics
   */
  calculatePerformanceMetrics(strategyResults, siteAnalysis) {
    const metrics = {
      avgExtractionTime: 0,
      successRate: 0,
      qualityScore: 0,
      reliabilityScore: 0,
      scalability: {
        maxThroughput: 0,
        bottlenecks: []
      }
    };

    if (strategyResults.strategies.length > 0) {
      const successful = strategyResults.strategies.filter(s => s.success);
      
      // Success rate
      metrics.successRate = successful.length / strategyResults.strategies.length;
      
      // Average extraction time
      if (successful.length > 0) {
        metrics.avgExtractionTime = successful.reduce((sum, s) => 
          sum + s.executionTime, 0) / successful.length;
        
        // Quality score
        metrics.qualityScore = successful.reduce((sum, s) => 
          sum + s.quality, 0) / successful.length;
      }
    }

    // Reliability score based on multiple factors
    metrics.reliabilityScore = this.calculateReliability(
      metrics.successRate,
      strategyResults.optimal?.confidence || 0,
      siteAnalysis
    );

    // Scalability analysis
    const rateLimit = siteAnalysis.constraints?.rateLimit;
    if (rateLimit?.hasLimit) {
      metrics.scalability.maxThroughput = rateLimit.maxRequestsPerMinute;
      metrics.scalability.bottlenecks.push('Rate limiting enforced');
    } else {
      // Estimate based on extraction time
      metrics.scalability.maxThroughput = Math.floor(60000 / metrics.avgExtractionTime);
    }

    if (siteAnalysis.structure?.rendering?.type === 'spa') {
      metrics.scalability.bottlenecks.push('Browser rendering required');
    }

    return metrics;
  }

  /**
   * Select sample URLs for testing
   */
  selectSampleUrls(links, domain) {
    const samples = [];
    const seen = new Set();
    
    // Prioritize different types of pages
    const priorities = [
      /\/article\//,
      /\/product\//,
      /\/category\//,
      /\/page\//,
      /\/post\//
    ];

    // First, try to get one of each priority type
    for (const pattern of priorities) {
      const matching = links.find(link => 
        pattern.test(link.href) && 
        link.href.includes(domain) &&
        !seen.has(link.href)
      );
      
      if (matching) {
        samples.push(matching.href);
        seen.add(matching.href);
      }
    }

    // Fill remaining slots with diverse URLs
    for (const link of links) {
      if (samples.length >= this.config.sampleSize) break;
      
      if (link.href.includes(domain) && !seen.has(link.href)) {
        samples.push(link.href);
        seen.add(link.href);
      }
    }

    return samples;
  }

  /**
   * Analyze navigation structure
   */
  analyzeNavigation(patterns) {
    const navigation = {
      type: 'unknown',
      mainMenu: [],
      pagination: null,
      breadcrumbs: null
    };

    if (!patterns.selectors) return navigation;

    // Check for common navigation patterns
    const navSelectors = patterns.selectors.navigation || [];
    if (navSelectors.length > 0) {
      navigation.mainMenu = navSelectors;
    }

    // Pagination
    if (patterns.selectors.pagination) {
      navigation.pagination = {
        detected: true,
        selectors: patterns.selectors.pagination
      };
    }

    // Breadcrumbs
    if (patterns.selectors.breadcrumbs) {
      navigation.breadcrumbs = {
        detected: true,
        selectors: patterns.selectors.breadcrumbs
      };
    }

    // Determine navigation type
    if (navigation.mainMenu.length > 0) {
      navigation.type = 'standard';
    }
    if (patterns.repeatingPatterns?.some(p => p.type === 'infinite-scroll')) {
      navigation.type = 'infinite-scroll';
    }

    return navigation;
  }

  /**
   * Detect content types on the site
   */
  detectContentTypes(patterns) {
    const types = new Set();

    if (patterns.contentType) {
      types.add(patterns.contentType);
    }

    // Check for specific content indicators
    if (patterns.microdata?.some(m => m['@type'] === 'Product')) {
      types.add('e-commerce');
    }
    if (patterns.microdata?.some(m => m['@type'] === 'Article')) {
      types.add('article');
    }
    if (patterns.microdata?.some(m => m['@type'] === 'BlogPosting')) {
      types.add('blog');
    }
    if (patterns.selectors?.video) {
      types.add('video');
    }
    if (patterns.selectors?.gallery) {
      types.add('gallery');
    }

    return Array.from(types);
  }

  /**
   * Detect authentication requirements
   */
  detectAuthRequirements(html, headers) {
    const auth = {
      required: false,
      type: null,
      indicators: []
    };

    // Check for login forms
    if (html.includes('login') || html.includes('signin')) {
      auth.indicators.push('login form detected');
    }

    // Check for auth headers
    if (headers['www-authenticate']) {
      auth.required = true;
      auth.type = headers['www-authenticate'].split(' ')[0];
      auth.indicators.push('authentication header present');
    }

    // Check for OAuth providers
    if (html.includes('oauth') || html.includes('auth0')) {
      auth.indicators.push('OAuth provider detected');
    }

    if (auth.indicators.length > 0 && !auth.required) {
      auth.required = 'partial'; // Some content may require auth
    }

    return auth;
  }

  /**
   * Detect geo-restrictions
   */
  detectGeoRestrictions(headers) {
    const geo = {
      restricted: false,
      indicators: []
    };

    // Check for CloudFlare geo headers
    if (headers['cf-ipcountry']) {
      geo.indicators.push(`CloudFlare country: ${headers['cf-ipcountry']}`);
    }

    // Check for geo-blocking headers
    if (headers['x-geo-block-list']) {
      geo.restricted = true;
      geo.indicators.push('Geo-blocking detected');
    }

    return geo;
  }

  /**
   * Select default strategy when testing is skipped
   */
  selectDefaultStrategy(siteAnalysis) {
    let strategyId = 'browser_render'; // Safe default
    const reasoning = [];

    // Select based on rendering type
    if (siteAnalysis.structure?.rendering?.type === 'static') {
      strategyId = 'static_fetch';
      reasoning.push('Static content detected');
    } else if (siteAnalysis.structure?.rendering?.type === 'spa') {
      strategyId = 'browser_js';
      reasoning.push('SPA requires JavaScript execution');
    } else if (siteAnalysis.structure?.rendering?.type === 'ssr') {
      strategyId = 'static_fetch';
      reasoning.push('SSR content available statically');
    }

    // Override for specific frameworks
    const framework = siteAnalysis.structure?.framework?.primary;
    if (['react', 'vue', 'angular'].includes(framework)) {
      strategyId = 'browser_js';
      reasoning.push(`${framework} framework requires browser`);
    }

    return {
      strategyId,
      confidence: 0.7,
      fallback: this.getDefaultFallback(strategyId),
      reasoning
    };
  }

  /**
   * Get default fallback strategy
   */
  getDefaultFallback(primaryStrategy) {
    const fallbacks = {
      'static_fetch': 'browser_render',
      'browser_render': 'browser_js',
      'browser_js': 'gpt5_direct',
      'gpt5_direct': 'gpt5_reasoning',
      'hybrid_smart': 'gpt5_direct'
    };

    return fallbacks[primaryStrategy] || 'browser_js';
  }

  /**
   * Select fallback strategy from test results
   */
  selectFallbackStrategy(optimal, strategies) {
    // Find next best strategy
    const alternatives = strategies
      .filter(s => s.success && s.strategyId !== optimal.strategyId)
      .sort((a, b) => b.score - a.score);

    if (alternatives.length > 0) {
      return alternatives[0].strategyId;
    }

    return this.getDefaultFallback(optimal.strategyId);
  }

  /**
   * Calculate reliability score
   */
  calculateReliability(successRate, confidence, siteAnalysis) {
    let reliability = successRate * 0.5 + confidence * 0.3;

    // Adjust for site complexity
    const rendering = siteAnalysis.structure?.rendering?.type;
    if (rendering === 'static' || rendering === 'ssr') {
      reliability += 0.1;
    } else if (rendering === 'spa') {
      reliability -= 0.1;
    }

    // Adjust for constraints
    if (siteAnalysis.constraints?.rateLimit?.hasLimit) {
      reliability -= 0.05;
    }
    if (siteAnalysis.constraints?.authentication?.required) {
      reliability -= 0.1;
    }

    return Math.max(0, Math.min(1, reliability + 0.2)); // Base 0.2
  }

  /**
   * Calculate overall DIP confidence
   */
  calculateConfidence(dip) {
    let confidence = 0;
    let factors = 0;

    // Site structure analysis confidence
    if (dip.siteStructure?.framework?.confidence) {
      confidence += dip.siteStructure.framework.confidence;
      factors++;
    }
    if (dip.siteStructure?.rendering?.confidence) {
      confidence += dip.siteStructure.rendering.confidence;
      factors++;
    }

    // Strategy testing confidence
    if (dip.optimalStrategy?.confidence) {
      confidence += dip.optimalStrategy.confidence;
      factors++;
    }

    // Performance metrics
    if (dip.performanceMetrics?.reliabilityScore) {
      confidence += dip.performanceMetrics.reliabilityScore;
      factors++;
    }

    return factors > 0 ? confidence / factors : 0.5;
  }

  /**
   * Update existing DIP with new information
   */
  async updateDIP(existingDIP, newUrl) {
    console.log(`🔄 Updating DIP for ${existingDIP.domain}`);
    
    // Test new URL with existing optimal strategy
    const testResult = await this.strategyManager.tester.testStrategy(
      existingDIP.optimalStrategy.strategyId,
      newUrl
    );

    // Update performance metrics
    if (testResult.success) {
      const metrics = existingDIP.performanceMetrics;
      const count = existingDIP.metadata.sampleUrls.length;
      
      // Update running averages
      metrics.avgExtractionTime = (metrics.avgExtractionTime * count + testResult.executionTime) / (count + 1);
      metrics.qualityScore = (metrics.qualityScore * count + testResult.quality) / (count + 1);
      
      existingDIP.metadata.sampleUrls.push(newUrl);
    }

    existingDIP.lastUpdated = new Date().toISOString();
    
    return existingDIP;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.renderingDetector.cleanup();
    await this.strategyManager.cleanup();
  }
}

module.exports = { DIPCreator };