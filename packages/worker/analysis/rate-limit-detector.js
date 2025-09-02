// Atlas Codex - Rate Limit Detection
// Tests and detects rate limiting on websites to ensure respectful crawling

class RateLimitDetector {
  constructor() {
    this.testResults = new Map();
    this.detectedLimits = new Map();
  }

  /**
   * Detect rate limits for a domain
   */
  async detectRateLimits(domain, options = {}) {
    console.log(`⏱️ Detecting rate limits for ${domain}`);
    
    const config = {
      testPath: options.testPath || '/',
      maxTests: options.maxTests || 20,
      testDuration: options.testDuration || 10000, // 10 seconds
      progressiveRates: options.progressiveRates || [1, 5, 10, 20, 30, 60], // requests per minute
      ...options
    };

    const results = {
      domain,
      hasRateLimit: false,
      maxRequestsPerMinute: null,
      recommendedDelay: 1000,
      burstLimit: null,
      testResults: [],
      headers: {},
      recommendations: []
    };

    try {
      // Step 1: Test with single request to check headers
      const headerCheck = await this.checkRateLimitHeaders(domain, config.testPath);
      results.headers = headerCheck.rateLimitHeaders;
      
      if (headerCheck.hasExplicitLimit) {
        results.hasRateLimit = true;
        results.maxRequestsPerMinute = headerCheck.limit;
        results.recommendedDelay = this.calculateDelay(headerCheck.limit);
        results.recommendations.push('Rate limits detected in response headers');
        console.log(`   Rate limit from headers: ${headerCheck.limit} req/min`);
        return results;
      }

      // Step 2: Progressive rate testing
      console.log(`   Testing progressive request rates...`);
      for (const rate of config.progressiveRates) {
        const testResult = await this.testRequestRate(domain, rate, config);
        results.testResults.push(testResult);
        
        if (!testResult.success) {
          // Found the limit
          results.hasRateLimit = true;
          results.maxRequestsPerMinute = testResult.achievedRate;
          results.recommendedDelay = this.calculateDelay(testResult.achievedRate);
          console.log(`   Rate limit detected: ${testResult.achievedRate} req/min`);
          break;
        }
        
        // If we've done enough tests without hitting a limit
        if (testResult.success && rate >= 30) {
          results.maxRequestsPerMinute = rate;
          results.recommendedDelay = this.calculateDelay(rate);
          console.log(`   No rate limit detected up to ${rate} req/min`);
          break;
        }
      }

      // Step 3: Test burst limits
      if (!results.hasRateLimit || results.maxRequestsPerMinute > 10) {
        const burstTest = await this.testBurstLimit(domain, config);
        results.burstLimit = burstTest.maxBurst;
        if (burstTest.limited) {
          results.recommendations.push(`Burst limit of ${burstTest.maxBurst} concurrent requests detected`);
        }
      }

      // Generate final recommendations
      results.recommendations = this.generateRecommendations(results);
      
    } catch (error) {
      console.error(`   Error detecting rate limits: ${error.message}`);
      results.recommendations = ['Error during testing - using conservative limits'];
      results.recommendedDelay = 2000; // Conservative 2 second delay
    }

    // Cache results
    this.detectedLimits.set(domain, results);
    
    return results;
  }

  /**
   * Check response headers for rate limit information
   */
  async checkRateLimitHeaders(domain, path) {
    const url = `https://${domain}${path}`;
    const result = {
      hasExplicitLimit: false,
      limit: null,
      rateLimitHeaders: {},
      retryAfter: null
    };

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'AtlasCodex/1.0'
        }
      });

      // Common rate limit headers
      const rateLimitHeaders = [
        'x-ratelimit-limit',
        'x-ratelimit-remaining',
        'x-ratelimit-reset',
        'x-rate-limit-limit',
        'x-rate-limit-remaining',
        'x-rate-limit-reset',
        'retry-after',
        'x-retry-after',
        'cf-ray', // Cloudflare
        'x-shopify-shop-api-call-limit', // Shopify
        'x-ratelimit-burst-capacity', // AWS
        'x-ratelimit-per-minute' // Generic
      ];

      for (const header of rateLimitHeaders) {
        const value = response.headers.get(header);
        if (value) {
          result.rateLimitHeaders[header] = value;
        }
      }

      // Parse rate limit from headers
      if (result.rateLimitHeaders['x-ratelimit-limit']) {
        result.hasExplicitLimit = true;
        result.limit = parseInt(result.rateLimitHeaders['x-ratelimit-limit']);
      } else if (result.rateLimitHeaders['x-rate-limit-limit']) {
        result.hasExplicitLimit = true;
        result.limit = parseInt(result.rateLimitHeaders['x-rate-limit-limit']);
      } else if (result.rateLimitHeaders['x-ratelimit-per-minute']) {
        result.hasExplicitLimit = true;
        result.limit = parseInt(result.rateLimitHeaders['x-ratelimit-per-minute']);
      }

      // Check retry-after
      if (result.rateLimitHeaders['retry-after']) {
        result.retryAfter = parseInt(result.rateLimitHeaders['retry-after']);
      }

      // Check for 429 status
      if (response.status === 429) {
        result.hasExplicitLimit = true;
        result.limit = result.limit || 0; // Rate limited immediately
      }

    } catch (error) {
      console.error(`Error checking headers: ${error.message}`);
    }

    return result;
  }

  /**
   * Test a specific request rate
   */
  async testRequestRate(domain, targetRate, config) {
    const url = `https://${domain}${config.testPath}`;
    const delayMs = Math.floor(60000 / targetRate); // Convert to delay between requests
    const numRequests = Math.min(Math.floor(config.testDuration / delayMs), config.maxTests);
    
    console.log(`   Testing ${targetRate} req/min (${numRequests} requests with ${delayMs}ms delay)`);
    
    const result = {
      targetRate,
      success: true,
      achievedRate: 0,
      responses: [],
      errors: [],
      avgResponseTime: 0
    };

    const startTime = Date.now();
    let successCount = 0;
    let totalResponseTime = 0;

    for (let i = 0; i < numRequests; i++) {
      const requestStart = Date.now();
      
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'AtlasCodex/1.0',
            'X-Request-ID': `test-${i}` // Track our requests
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout per request
        });

        const responseTime = Date.now() - requestStart;
        totalResponseTime += responseTime;

        result.responses.push({
          status: response.status,
          time: responseTime
        });

        if (response.status === 429) {
          // Rate limited
          result.success = false;
          result.errors.push(`Rate limited at request ${i + 1}`);
          console.log(`     ❌ Rate limited after ${i + 1} requests`);
          break;
        } else if (response.status === 503) {
          // Service unavailable - might be rate limiting
          result.success = false;
          result.errors.push(`Service unavailable at request ${i + 1}`);
          break;
        } else if (response.status >= 200 && response.status < 300) {
          successCount++;
        }

        // Delay before next request
        if (i < numRequests - 1) {
          await this.delay(delayMs);
        }

      } catch (error) {
        result.errors.push(`Request ${i + 1} failed: ${error.message}`);
        
        // If we get connection errors, might be rate limiting
        if (error.name === 'AbortError' || error.message.includes('ECONNRESET')) {
          result.success = false;
          break;
        }
      }
    }

    const duration = (Date.now() - startTime) / 1000; // in seconds
    result.achievedRate = Math.floor((successCount / duration) * 60); // Convert to per minute
    result.avgResponseTime = successCount > 0 ? Math.floor(totalResponseTime / successCount) : 0;

    return result;
  }

  /**
   * Test burst limit (concurrent requests)
   */
  async testBurstLimit(domain, config) {
    const url = `https://${domain}${config.testPath}`;
    const burstSizes = [2, 5, 10, 20];
    
    console.log(`   Testing burst limits...`);
    
    const result = {
      maxBurst: 1,
      limited: false,
      results: []
    };

    for (const burstSize of burstSizes) {
      const promises = [];
      
      // Send concurrent requests
      for (let i = 0; i < burstSize; i++) {
        promises.push(
          fetch(url, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'AtlasCodex/1.0',
              'X-Burst-Test': `${burstSize}-${i}`
            },
            signal: AbortSignal.timeout(5000)
          }).then(response => ({
            success: response.status >= 200 && response.status < 300,
            status: response.status
          })).catch(error => ({
            success: false,
            error: error.message
          }))
        );
      }

      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.success).length;
      
      result.results.push({
        burstSize,
        successCount,
        limited: successCount < burstSize
      });

      if (successCount < burstSize) {
        // Found the burst limit
        result.limited = true;
        result.maxBurst = Math.max(1, successCount);
        console.log(`     Burst limit: ${result.maxBurst} concurrent requests`);
        break;
      } else {
        result.maxBurst = burstSize;
      }

      // Wait before next test
      await this.delay(2000);
    }

    return result;
  }

  /**
   * Calculate recommended delay based on rate limit
   */
  calculateDelay(maxRequestsPerMinute) {
    if (!maxRequestsPerMinute || maxRequestsPerMinute === 0) {
      return 5000; // 5 seconds if completely blocked
    }

    // Calculate delay with safety margin (80% of max rate)
    const safeRate = maxRequestsPerMinute * 0.8;
    const delay = Math.ceil(60000 / safeRate);
    
    // Minimum 1 second, maximum 10 seconds
    return Math.max(1000, Math.min(delay, 10000));
  }

  /**
   * Generate recommendations based on detected limits
   */
  generateRecommendations(results) {
    const recommendations = [];

    if (results.hasRateLimit) {
      recommendations.push(`Rate limit detected: ${results.maxRequestsPerMinute} requests/minute`);
      recommendations.push(`Use delay of at least ${results.recommendedDelay}ms between requests`);
    } else if (results.maxRequestsPerMinute) {
      recommendations.push(`No explicit rate limit detected up to ${results.maxRequestsPerMinute} req/min`);
      recommendations.push(`Recommend conservative delay of ${results.recommendedDelay}ms`);
    } else {
      recommendations.push('Unable to determine rate limits - use conservative crawling');
      recommendations.push('Recommend 2-3 second delay between requests');
    }

    if (results.burstLimit) {
      recommendations.push(`Limit concurrent requests to ${results.burstLimit}`);
    }

    // Check for specific services
    if (results.headers['cf-ray']) {
      recommendations.push('Site uses Cloudflare - be extra respectful to avoid blocking');
    }
    if (results.headers['x-shopify-shop-api-call-limit']) {
      recommendations.push('Shopify site detected - respect their API limits');
    }

    // Add retry strategy
    if (results.headers['retry-after']) {
      recommendations.push(`Respect retry-after header: ${results.headers['retry-after']} seconds`);
    }

    return recommendations;
  }

  /**
   * Adaptive rate limiting based on response times
   */
  async adaptiveRateLimit(domain, callback, options = {}) {
    const config = {
      initialDelay: options.initialDelay || 1000,
      minDelay: options.minDelay || 500,
      maxDelay: options.maxDelay || 10000,
      backoffMultiplier: options.backoffMultiplier || 2,
      ...options
    };

    let currentDelay = config.initialDelay;
    let consecutiveSuccesses = 0;
    let consecutiveFailures = 0;

    const makeRequest = async () => {
      const startTime = Date.now();
      
      try {
        const result = await callback();
        const responseTime = Date.now() - startTime;

        if (result.status === 429) {
          // Rate limited - back off
          consecutiveFailures++;
          consecutiveSuccesses = 0;
          currentDelay = Math.min(currentDelay * config.backoffMultiplier, config.maxDelay);
          console.log(`   Rate limited - increasing delay to ${currentDelay}ms`);
        } else if (result.status >= 200 && result.status < 300) {
          // Success - maybe we can go faster
          consecutiveSuccesses++;
          consecutiveFailures = 0;
          
          if (consecutiveSuccesses > 10) {
            currentDelay = Math.max(currentDelay * 0.9, config.minDelay);
            consecutiveSuccesses = 0;
          }
        }

        // Adjust based on response time
        if (responseTime > 3000) {
          // Server is slow - be more conservative
          currentDelay = Math.min(currentDelay * 1.1, config.maxDelay);
        }

        return {
          ...result,
          delay: currentDelay,
          responseTime
        };

      } catch (error) {
        consecutiveFailures++;
        currentDelay = Math.min(currentDelay * config.backoffMultiplier, config.maxDelay);
        
        throw error;
      }
    };

    return {
      makeRequest,
      getCurrentDelay: () => currentDelay,
      reset: () => {
        currentDelay = config.initialDelay;
        consecutiveSuccesses = 0;
        consecutiveFailures = 0;
      }
    };
  }

  /**
   * Get cached rate limit for domain
   */
  getCachedLimit(domain) {
    return this.detectedLimits.get(domain);
  }

  /**
   * Helper: Delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { RateLimitDetector };