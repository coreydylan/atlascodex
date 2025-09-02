// Atlas Codex - Intelligent Strategy Selection
// Selects optimal extraction strategy based on site analysis and historical performance

class StrategySelector {
  constructor() {
    this.selectionHistory = new Map();
    this.performanceData = new Map();
  }

  /**
   * Select optimal strategy based on site analysis
   */
  async selectStrategy(siteAnalysis, options = {}) {
    console.log(`🎯 Selecting optimal extraction strategy`);
    
    const selection = {
      primary: null,
      fallback: null,
      reasoning: [],
      confidence: 0,
      estimatedCost: 0,
      estimatedTime: 0
    };

    // Analyze site characteristics
    const siteProfile = this.analyzeSiteProfile(siteAnalysis);
    
    // Get strategy recommendations
    const recommendations = this.getStrategyRecommendations(siteProfile);
    
    // Select primary strategy
    selection.primary = this.selectPrimaryStrategy(recommendations, options);
    selection.reasoning.push(`Primary: ${selection.primary.id} - ${selection.primary.reason}`);
    
    // Select fallback strategy
    selection.fallback = this.selectFallbackStrategy(selection.primary, recommendations);
    selection.reasoning.push(`Fallback: ${selection.fallback.id} - ${selection.fallback.reason}`);
    
    // Calculate confidence
    selection.confidence = this.calculateConfidence(siteProfile, selection.primary);
    
    // Estimate costs
    selection.estimatedCost = this.estimateCost(selection.primary, selection.fallback);
    selection.estimatedTime = this.estimateTime(selection.primary, siteProfile);
    
    // Record selection
    this.recordSelection(siteAnalysis.domain, selection);
    
    return selection;
  }

  /**
   * Analyze site profile for strategy selection
   */
  analyzeSiteProfile(siteAnalysis) {
    const profile = {
      complexity: 'low',
      dynamicContent: false,
      requiresJS: false,
      hasStructuredData: false,
      hasRateLimit: false,
      framework: 'unknown',
      renderingType: 'unknown',
      contentType: 'unknown',
      score: {}
    };

    // Framework analysis
    if (siteAnalysis.framework) {
      profile.framework = siteAnalysis.framework.primary;
      profile.requiresJS = ['react', 'vue', 'angular'].includes(profile.framework);
    }

    // Rendering type
    if (siteAnalysis.rendering) {
      profile.renderingType = siteAnalysis.rendering.type;
      profile.dynamicContent = ['spa', 'hybrid'].includes(profile.renderingType);
      profile.requiresJS = profile.requiresJS || profile.renderingType === 'spa';
    }

    // Content patterns
    if (siteAnalysis.patterns) {
      profile.contentType = siteAnalysis.patterns.contentType;
      profile.hasStructuredData = siteAnalysis.patterns.microdata?.length > 0;
    }

    // Rate limiting
    if (siteAnalysis.rateLimit) {
      profile.hasRateLimit = siteAnalysis.rateLimit.hasRateLimit;
    }

    // Calculate complexity score
    profile.complexity = this.calculateComplexity(profile);
    
    // Score different aspects
    profile.score = {
      static: this.scoreStaticViability(profile),
      browser: this.scoreBrowserNeed(profile),
      gpt: this.scoreGPTNeed(profile)
    };

    return profile;
  }

  /**
   * Get strategy recommendations based on profile
   */
  getStrategyRecommendations(profile) {
    const recommendations = [];

    // Static fetch recommendation
    if (profile.score.static > 0.7) {
      recommendations.push({
        id: 'static_fetch',
        score: profile.score.static,
        reason: 'Site has good static content',
        priority: 1
      });
    }

    // Browser recommendations
    if (profile.score.browser > 0.5 || profile.requiresJS) {
      if (profile.dynamicContent) {
        recommendations.push({
          id: 'browser_js',
          score: profile.score.browser,
          reason: 'Dynamic content requires full JS execution',
          priority: profile.requiresJS ? 1 : 2
        });
      } else {
        recommendations.push({
          id: 'browser_render',
          score: profile.score.browser * 0.8,
          reason: 'Browser needed but full JS not required',
          priority: 2
        });
      }
    }

    // GPT recommendations
    if (profile.score.gpt > 0.6 || profile.complexity === 'high') {
      if (profile.complexity === 'very_high') {
        recommendations.push({
          id: 'gpt5_reasoning',
          score: profile.score.gpt,
          reason: 'Complex extraction requires reasoning',
          priority: 3
        });
      } else {
        recommendations.push({
          id: 'gpt5_direct',
          score: profile.score.gpt * 0.8,
          reason: 'GPT can handle unstructured content',
          priority: 3
        });
      }
    }

    // Hybrid recommendation for uncertain cases
    if (profile.complexity === 'medium' || 
        (profile.score.static < 0.5 && profile.score.browser < 0.7)) {
      recommendations.push({
        id: 'hybrid_smart',
        score: 0.7,
        reason: 'Hybrid approach for balanced performance',
        priority: 2
      });
    }

    // Sort by score and priority
    recommendations.sort((a, b) => {
      if (Math.abs(a.score - b.score) > 0.1) {
        return b.score - a.score;
      }
      return a.priority - b.priority;
    });

    return recommendations;
  }

  /**
   * Select primary strategy
   */
  selectPrimaryStrategy(recommendations, options = {}) {
    // Check for user preferences
    if (options.preferredStrategy) {
      const preferred = recommendations.find(r => r.id === options.preferredStrategy);
      if (preferred) {
        return {
          ...preferred,
          reason: `User preferred: ${preferred.reason}`
        };
      }
    }

    // Cost constraints
    if (options.maxCost) {
      const costMap = {
        'static_fetch': 0.01,
        'browser_render': 0.05,
        'browser_js': 0.08,
        'hybrid_smart': 0.15,
        'gpt5_direct': 0.50,
        'gpt5_reasoning': 0.75
      };

      const affordable = recommendations.filter(r => 
        costMap[r.id] <= options.maxCost
      );

      if (affordable.length > 0) {
        return affordable[0];
      }
    }

    // Default to best recommendation
    return recommendations[0] || {
      id: 'browser_render',
      score: 0.5,
      reason: 'Default safe strategy'
    };
  }

  /**
   * Select fallback strategy
   */
  selectFallbackStrategy(primary, recommendations) {
    // Define fallback chains
    const fallbackChains = {
      'static_fetch': 'browser_render',
      'browser_render': 'browser_js',
      'browser_js': 'gpt5_direct',
      'gpt5_direct': 'gpt5_reasoning',
      'gpt5_reasoning': 'hybrid_smart',
      'hybrid_smart': 'gpt5_reasoning'
    };

    const fallbackId = fallbackChains[primary.id] || 'browser_js';
    
    // Try to find in recommendations
    const fallback = recommendations.find(r => r.id === fallbackId);
    
    if (fallback) {
      return {
        ...fallback,
        reason: `Fallback for ${primary.id} failure`
      };
    }

    // Default fallback
    return {
      id: fallbackId,
      score: 0.5,
      reason: 'Standard fallback strategy'
    };
  }

  /**
   * Calculate complexity score
   */
  calculateComplexity(profile) {
    let complexity = 0;

    // Framework complexity
    const frameworkComplexity = {
      'react': 2,
      'vue': 2,
      'angular': 3,
      'next.js': 1,
      'wordpress': 1,
      'shopify': 2,
      'unknown': 1
    };
    complexity += frameworkComplexity[profile.framework] || 1;

    // Rendering complexity
    if (profile.renderingType === 'spa') complexity += 3;
    if (profile.renderingType === 'hybrid') complexity += 2;
    if (profile.dynamicContent) complexity += 2;

    // Content complexity
    if (profile.contentType === 'mixed') complexity += 1;
    if (!profile.hasStructuredData) complexity += 1;

    // Rate limiting adds complexity
    if (profile.hasRateLimit) complexity += 1;

    // Map to categories
    if (complexity <= 3) return 'low';
    if (complexity <= 6) return 'medium';
    if (complexity <= 9) return 'high';
    return 'very_high';
  }

  /**
   * Score static fetch viability
   */
  scoreStaticViability(profile) {
    let score = 1.0;

    // Reduce score for dynamic content
    if (profile.dynamicContent) score *= 0.3;
    if (profile.requiresJS) score *= 0.2;
    
    // Reduce for SPA
    if (profile.renderingType === 'spa') score *= 0.1;
    if (profile.renderingType === 'hybrid') score *= 0.5;
    
    // Boost for static/SSR
    if (profile.renderingType === 'static') score *= 1.2;
    if (profile.renderingType === 'ssr') score *= 1.1;
    
    // Boost for structured data
    if (profile.hasStructuredData) score *= 1.2;
    
    // Boost for simple frameworks
    if (['wordpress', 'jekyll', 'hugo'].includes(profile.framework)) score *= 1.2;

    return Math.min(1.0, score);
  }

  /**
   * Score browser need
   */
  scoreBrowserNeed(profile) {
    let score = 0.3; // Base score

    // Increase for dynamic content
    if (profile.dynamicContent) score += 0.4;
    if (profile.requiresJS) score += 0.3;
    
    // Increase for SPA
    if (profile.renderingType === 'spa') score = 0.9;
    if (profile.renderingType === 'hybrid') score = 0.7;
    
    // Increase for JS frameworks
    if (['react', 'vue', 'angular'].includes(profile.framework)) score = Math.max(score, 0.8);
    
    // Decrease for static content
    if (profile.renderingType === 'static') score *= 0.5;
    if (profile.hasStructuredData) score *= 0.8;

    return Math.min(1.0, score);
  }

  /**
   * Score GPT need
   */
  scoreGPTNeed(profile) {
    let score = 0.1; // Base score

    // Increase for complexity
    if (profile.complexity === 'high') score += 0.3;
    if (profile.complexity === 'very_high') score += 0.5;
    
    // Increase for unstructured content
    if (!profile.hasStructuredData) score += 0.2;
    if (profile.contentType === 'mixed') score += 0.2;
    
    // Increase if other methods likely to fail
    const staticScore = this.scoreStaticViability(profile);
    const browserScore = this.scoreBrowserNeed(profile);
    
    if (staticScore < 0.3 && browserScore < 0.5) {
      score += 0.4;
    }
    
    // Special cases that benefit from GPT
    if (profile.contentType === 'article') score += 0.1;
    if (profile.contentType === 'documentation') score += 0.1;

    return Math.min(1.0, score);
  }

  /**
   * Calculate confidence in selection
   */
  calculateConfidence(profile, primaryStrategy) {
    let confidence = primaryStrategy.score;

    // Adjust based on complexity
    if (profile.complexity === 'low') confidence *= 1.2;
    if (profile.complexity === 'very_high') confidence *= 0.8;
    
    // Adjust based on historical performance
    const historicalSuccess = this.getHistoricalSuccess(profile.framework, primaryStrategy.id);
    if (historicalSuccess !== null) {
      confidence = confidence * 0.7 + historicalSuccess * 0.3;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Estimate extraction cost
   */
  estimateCost(primary, fallback) {
    const costs = {
      'static_fetch': 0.01,
      'browser_render': 0.05,
      'browser_js': 0.08,
      'hybrid_smart': 0.15,
      'gpt5_direct': 0.50,
      'gpt5_reasoning': 0.75
    };

    const primaryCost = costs[primary.id] || 0.10;
    const fallbackCost = costs[fallback.id] || 0.20;
    
    // Assume 10% fallback probability
    return primaryCost + (fallbackCost * 0.1);
  }

  /**
   * Estimate extraction time
   */
  estimateTime(primary, profile) {
    const baseTimes = {
      'static_fetch': 500,
      'browser_render': 3000,
      'browser_js': 5000,
      'hybrid_smart': 4000,
      'gpt5_direct': 2000,
      'gpt5_reasoning': 3000
    };

    let time = baseTimes[primary.id] || 3000;

    // Adjust for rate limiting
    if (profile.hasRateLimit) {
      time += 2000;
    }

    // Adjust for complexity
    if (profile.complexity === 'high') time *= 1.3;
    if (profile.complexity === 'very_high') time *= 1.5;

    return Math.round(time);
  }

  /**
   * Get historical success rate
   */
  getHistoricalSuccess(framework, strategyId) {
    const key = `${framework}:${strategyId}`;
    const performance = this.performanceData.get(key);
    
    if (!performance || performance.attempts < 5) {
      return null;
    }
    
    return performance.successes / performance.attempts;
  }

  /**
   * Record strategy selection
   */
  recordSelection(domain, selection) {
    this.selectionHistory.set(domain, {
      ...selection,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Update performance metrics
   */
  updatePerformance(framework, strategyId, success, metrics = {}) {
    const key = `${framework}:${strategyId}`;
    const current = this.performanceData.get(key) || {
      attempts: 0,
      successes: 0,
      totalTime: 0,
      totalCost: 0
    };

    current.attempts++;
    if (success) current.successes++;
    current.totalTime += metrics.time || 0;
    current.totalCost += metrics.cost || 0;

    this.performanceData.set(key, current);
  }

  /**
   * Get strategy recommendation for URL
   */
  async recommendForUrl(url, siteAnalysis) {
    const selection = await this.selectStrategy(siteAnalysis);
    
    return {
      url,
      domain: new URL(url).hostname,
      strategy: selection.primary,
      fallback: selection.fallback,
      confidence: selection.confidence,
      estimatedCost: selection.estimatedCost,
      estimatedTime: selection.estimatedTime,
      reasoning: selection.reasoning
    };
  }
}

module.exports = { StrategySelector };