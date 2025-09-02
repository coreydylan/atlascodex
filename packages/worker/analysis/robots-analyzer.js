// Atlas Codex - Robots.txt Analyzer
// Parses and analyzes robots.txt files to understand crawling constraints

class RobotsAnalyzer {
  constructor() {
    this.defaultUserAgent = 'AtlasCodex';
    this.rules = {};
  }

  /**
   * Analyze robots.txt for a domain
   */
  async analyzeRobotsTxt(domain) {
    console.log(`🤖 Analyzing robots.txt for ${domain}`);
    
    const analysis = {
      exists: false,
      url: `https://${domain}/robots.txt`,
      allowedPaths: [],
      disallowedPaths: [],
      crawlDelay: null,
      sitemapUrls: [],
      userAgents: [],
      rules: {},
      recommendations: {},
      rawContent: null
    };

    try {
      // Fetch robots.txt
      const response = await fetch(analysis.url, {
        headers: {
          'User-Agent': `${this.defaultUserAgent}/1.0`
        },
        timeout: 10000
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`   No robots.txt found (404)`);
          analysis.recommendations = {
            canCrawl: true,
            respectfulDelay: 1000,
            notes: ['No robots.txt present - proceed with respectful crawling']
          };
          return analysis;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const content = await response.text();
      analysis.exists = true;
      analysis.rawContent = content;

      // Parse the robots.txt
      const parsed = this.parseRobotsTxt(content);
      
      // Merge parsed data into analysis
      Object.assign(analysis, parsed);
      
      // Get rules for our user agent
      const ourRules = this.getRulesForUserAgent(parsed.rules, this.defaultUserAgent);
      analysis.allowedPaths = ourRules.allow;
      analysis.disallowedPaths = ourRules.disallow;
      analysis.crawlDelay = ourRules.crawlDelay;
      
      // Generate recommendations
      analysis.recommendations = this.generateRecommendations(analysis);
      
      console.log(`   Robots.txt parsed: ${analysis.disallowedPaths.length} disallowed paths, ${analysis.sitemapUrls.length} sitemaps`);
      
    } catch (error) {
      console.error(`   Error fetching robots.txt: ${error.message}`);
      analysis.recommendations = {
        canCrawl: true,
        respectfulDelay: 2000,
        notes: [`Error fetching robots.txt: ${error.message}`, 'Proceeding with conservative crawling']
      };
    }

    return analysis;
  }

  /**
   * Parse robots.txt content
   */
  parseRobotsTxt(content) {
    const parsed = {
      rules: {},
      sitemapUrls: [],
      userAgents: []
    };

    let currentUserAgent = null;
    const lines = content.split('\n');

    for (let line of lines) {
      // Remove comments and trim
      line = line.split('#')[0].trim();
      
      if (!line) continue;

      // Parse directive
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const directive = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();

      switch (directive) {
        case 'user-agent':
          currentUserAgent = value;
          if (!parsed.rules[currentUserAgent]) {
            parsed.rules[currentUserAgent] = {
              allow: [],
              disallow: [],
              crawlDelay: null
            };
            parsed.userAgents.push(currentUserAgent);
          }
          break;

        case 'disallow':
          if (currentUserAgent && value) {
            parsed.rules[currentUserAgent].disallow.push(value);
          }
          break;

        case 'allow':
          if (currentUserAgent && value) {
            parsed.rules[currentUserAgent].allow.push(value);
          }
          break;

        case 'crawl-delay':
          if (currentUserAgent) {
            parsed.rules[currentUserAgent].crawlDelay = parseFloat(value);
          }
          break;

        case 'sitemap':
          parsed.sitemapUrls.push(value);
          break;

        case 'host':
          parsed.preferredHost = value;
          break;

        case 'clean-param':
          if (!parsed.cleanParams) parsed.cleanParams = [];
          parsed.cleanParams.push(value);
          break;
      }
    }

    return parsed;
  }

  /**
   * Get rules that apply to a specific user agent
   */
  getRulesForUserAgent(rules, userAgent) {
    const combinedRules = {
      allow: [],
      disallow: [],
      crawlDelay: null
    };

    // Check for exact match first
    if (rules[userAgent]) {
      return rules[userAgent];
    }

    // Check for wildcard rules
    if (rules['*']) {
      Object.assign(combinedRules, rules['*']);
    }

    // Check for partial matches (e.g., 'bot' matching 'AtlasCodexBot')
    for (const [agent, agentRules] of Object.entries(rules)) {
      if (agent !== '*' && userAgent.toLowerCase().includes(agent.toLowerCase())) {
        // More specific rules override wildcard
        if (agentRules.allow.length > 0) {
          combinedRules.allow = agentRules.allow;
        }
        if (agentRules.disallow.length > 0) {
          combinedRules.disallow = agentRules.disallow;
        }
        if (agentRules.crawlDelay !== null) {
          combinedRules.crawlDelay = agentRules.crawlDelay;
        }
      }
    }

    return combinedRules;
  }

  /**
   * Check if a URL path is allowed by robots.txt rules
   */
  isPathAllowed(path, rules) {
    // Empty disallow means allow everything
    if (rules.disallow.length === 0) {
      return true;
    }

    // Check disallow rules first
    for (const disallowPattern of rules.disallow) {
      if (this.matchesPattern(path, disallowPattern)) {
        // Check if there's a more specific allow rule
        for (const allowPattern of rules.allow) {
          if (this.matchesPattern(path, allowPattern) && 
              allowPattern.length > disallowPattern.length) {
            return true; // Allow rule is more specific
          }
        }
        return false; // Disallowed
      }
    }

    return true; // Not explicitly disallowed
  }

  /**
   * Check if a path matches a robots.txt pattern
   */
  matchesPattern(path, pattern) {
    // Handle empty pattern
    if (!pattern || pattern === '/') {
      return true;
    }

    // Convert robots.txt pattern to regex
    let regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*'); // Convert * to .*

    // Pattern should match from the beginning of the path
    if (!regexPattern.startsWith('^')) {
      regexPattern = '^' + regexPattern;
    }

    try {
      const regex = new RegExp(regexPattern);
      return regex.test(path);
    } catch (e) {
      // If regex is invalid, do simple string matching
      return path.startsWith(pattern);
    }
  }

  /**
   * Generate crawling recommendations based on robots.txt
   */
  generateRecommendations(analysis) {
    const recommendations = {
      canCrawl: true,
      respectfulDelay: 1000,
      blockedPaths: [],
      allowedPaths: [],
      notes: [],
      sitemapStrategy: null
    };

    // Check if completely blocked
    if (analysis.disallowedPaths.includes('/')) {
      recommendations.canCrawl = false;
      recommendations.notes.push('Site has disallowed all crawling with Disallow: /');
      return recommendations;
    }

    // Set crawl delay
    if (analysis.crawlDelay) {
      recommendations.respectfulDelay = Math.max(analysis.crawlDelay * 1000, 1000);
      recommendations.notes.push(`Respecting crawl-delay of ${analysis.crawlDelay} seconds`);
    } else {
      // Use conservative default if no crawl-delay specified
      recommendations.respectfulDelay = 1000;
      recommendations.notes.push('Using default 1 second delay (no crawl-delay specified)');
    }

    // Analyze disallowed paths
    recommendations.blockedPaths = analysis.disallowedPaths.filter(path => path !== '');
    
    // Common patterns to note
    const commonBlocked = {
      '/admin': 'Admin area blocked',
      '/api': 'API endpoints blocked',
      '/search': 'Search functionality blocked',
      '/user': 'User pages blocked',
      '/checkout': 'Checkout process blocked',
      '/*.json': 'JSON files blocked',
      '/wp-admin': 'WordPress admin blocked'
    };

    for (const [pattern, description] of Object.entries(commonBlocked)) {
      if (recommendations.blockedPaths.some(p => p.includes(pattern))) {
        recommendations.notes.push(description);
      }
    }

    // Sitemap strategy
    if (analysis.sitemapUrls.length > 0) {
      recommendations.sitemapStrategy = {
        available: true,
        urls: analysis.sitemapUrls,
        recommendation: 'Use sitemap for efficient crawling of allowed content'
      };
      recommendations.notes.push(`${analysis.sitemapUrls.length} sitemap(s) available for efficient crawling`);
    }

    // Check for specific bot rules
    if (analysis.userAgents.includes('Googlebot') || analysis.userAgents.includes('Bingbot')) {
      recommendations.notes.push('Site has specific rules for search engine bots');
    }

    // Check if we should be extra careful
    if (recommendations.blockedPaths.length > 10) {
      recommendations.notes.push('Many paths blocked - be extra respectful when crawling');
      recommendations.respectfulDelay = Math.max(recommendations.respectfulDelay, 2000);
    }

    return recommendations;
  }

  /**
   * Parse sitemap URL to get structured sitemap data
   */
  async parseSitemap(sitemapUrl) {
    console.log(`📍 Parsing sitemap: ${sitemapUrl}`);
    
    try {
      const response = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': `${this.defaultUserAgent}/1.0`
        },
        timeout: 15000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const content = await response.text();
      
      // Check if it's a sitemap index or regular sitemap
      if (content.includes('<sitemapindex')) {
        return this.parseSitemapIndex(content);
      } else {
        return this.parseUrlSet(content);
      }
    } catch (error) {
      console.error(`   Error parsing sitemap: ${error.message}`);
      return { error: error.message, urls: [] };
    }
  }

  /**
   * Parse sitemap index
   */
  parseSitemapIndex(xml) {
    const sitemaps = [];
    const sitemapMatches = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) || [];
    
    for (const sitemapXml of sitemapMatches) {
      const locMatch = sitemapXml.match(/<loc>(.*?)<\/loc>/);
      const lastmodMatch = sitemapXml.match(/<lastmod>(.*?)<\/lastmod>/);
      
      if (locMatch) {
        sitemaps.push({
          loc: locMatch[1],
          lastmod: lastmodMatch ? lastmodMatch[1] : null
        });
      }
    }
    
    return {
      type: 'index',
      sitemaps,
      count: sitemaps.length
    };
  }

  /**
   * Parse URL set from sitemap
   */
  parseUrlSet(xml) {
    const urls = [];
    const urlMatches = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
    
    for (const urlXml of urlMatches) {
      const locMatch = urlXml.match(/<loc>(.*?)<\/loc>/);
      const lastmodMatch = urlXml.match(/<lastmod>(.*?)<\/lastmod>/);
      const changefreqMatch = urlXml.match(/<changefreq>(.*?)<\/changefreq>/);
      const priorityMatch = urlXml.match(/<priority>(.*?)<\/priority>/);
      
      if (locMatch) {
        urls.push({
          loc: locMatch[1],
          lastmod: lastmodMatch ? lastmodMatch[1] : null,
          changefreq: changefreqMatch ? changefreqMatch[1] : null,
          priority: priorityMatch ? parseFloat(priorityMatch[1]) : null
        });
      }
    }
    
    return {
      type: 'urlset',
      urls,
      count: urls.length
    };
  }

  /**
   * Get crawlable URLs from robots.txt and sitemaps
   */
  async getCrawlableUrls(domain, limit = 100) {
    const analysis = await this.analyzeRobotsTxt(domain);
    const crawlableUrls = [];
    
    if (!analysis.recommendations.canCrawl) {
      console.log(`   ❌ Crawling not allowed for ${domain}`);
      return crawlableUrls;
    }
    
    // Try to get URLs from sitemap
    if (analysis.sitemapUrls.length > 0) {
      for (const sitemapUrl of analysis.sitemapUrls) {
        const sitemap = await this.parseSitemap(sitemapUrl);
        
        if (sitemap.type === 'urlset') {
          for (const url of sitemap.urls.slice(0, limit)) {
            // Check if URL is allowed
            const urlPath = new URL(url.loc).pathname;
            if (this.isPathAllowed(urlPath, {
              allow: analysis.allowedPaths,
              disallow: analysis.disallowedPaths
            })) {
              crawlableUrls.push({
                url: url.loc,
                priority: url.priority,
                source: 'sitemap'
              });
            }
          }
        } else if (sitemap.type === 'index') {
          // Handle sitemap index (would need to fetch child sitemaps)
          console.log(`   Found sitemap index with ${sitemap.count} sitemaps`);
        }
        
        if (crawlableUrls.length >= limit) break;
      }
    }
    
    console.log(`   Found ${crawlableUrls.length} crawlable URLs from sitemaps`);
    
    return crawlableUrls;
  }
}

module.exports = { RobotsAnalyzer };