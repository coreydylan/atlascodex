# Atlas Codex Sprint Plan 🚀

**Domain Intelligence Profiles (DIPs) Implementation**

This sprint plan outlines the complete implementation of DIPs - the intelligence layer that learns optimal extraction strategies per domain, reducing costs and improving reliability.

---

## 🎯 Sprint Overview

**Goal**: Transform Atlas Codex from ad-hoc extraction to intelligent, domain-aware processing with comprehensive DIPs.

**Success Criteria**:
- ✅ Repository fully synced and version-controlled
- ✅ DIPs automatically created for new domains  
- ✅ Extraction strategies optimized per domain
- ✅ Cost reduction of 60-80% through intelligent routing
- ✅ Sub-3-second response times for known domains
- ✅ Comprehensive site analysis and profiling
- ✅ Evidence ledger integration with DIPs

---

## 📋 Sprint 0: Repository Sync & Foundation

**Objective**: Establish clean, version-controlled foundation before development

### Task 0.1: Complete Repository Sync
```bash
# Current state: Ad-hoc AWS/Vercel deployments
# Target state: Full GitHub-based workflow with proper versioning
```

**Steps**:
1. **Audit Current State**
   - [ ] List all current AWS resources and deployments
   - [ ] Document current Vercel deployments  
   - [ ] Identify any manual configurations not in repo
   - [ ] Check for uncommitted local changes

2. **Clean Repository State**
   ```bash
   # Ensure all changes are committed
   git status
   git add .
   git commit -m "feat: complete environment setup and documentation"
   
   # Push to remote
   git push origin develop
   ```

3. **Establish Branch Strategy**
   ```bash
   # Create main branch from develop
   git checkout -b main
   git push origin main
   
   # Set up branch protection rules
   # - Require PR reviews
   # - Require status checks to pass
   # - Restrict pushes to main
   ```

4. **Verify CI/CD Pipeline**
   - [ ] Test GitHub Actions workflows
   - [ ] Verify environment secrets are configured
   - [ ] Test deployment to dev environment via GitHub
   - [ ] Validate all package builds work correctly

5. **Clean Deployment State**
   - [ ] Remove any manual AWS resources not managed by Terraform
   - [ ] Ensure all infrastructure is defined in `infrastructure/terraform/`
   - [ ] Document any temporary/manual configurations to be automated

**Acceptance Criteria**:
- [ ] All code committed and pushed to GitHub
- [ ] CI/CD pipeline functional and tested
- [ ] No manual deployments or configurations remaining
- [ ] Repository is single source of truth for entire system

---

## 📋 Sprint 1: DIP Infrastructure & Core Logic

**Objective**: Build the foundational DIP system with database operations and basic logic

### Task 1.1: DIP Data Models & Database Operations

**Create Core DIP Schema**:
```typescript
// packages/core/src/dip.ts - NEW FILE
export interface DomainIntelligenceProfile {
  domain: string;
  version: string;
  createdAt: string;
  lastUpdated: string;
  siteStructure: SiteStructure;
  extractionStrategies: ExtractionStrategy[];
  optimalStrategy: OptimalStrategy;
  costProfile: CostProfile;
  performanceMetrics: PerformanceMetrics;
  constraints: SiteConstraints;
}

export interface SiteStructure {
  framework: string | null;           // 'react', 'wordpress', 'static', etc.
  renderingType: 'ssr' | 'spa' | 'static' | 'hybrid';
  requiresJavaScript: boolean;
  contentSelectors: Record<string, string>;
  commonPatterns: string[];
  dynamicContent: boolean;
}

export interface ExtractionStrategy {
  type: 'static_fetch' | 'browser_render' | 'gpt5_extraction';
  success: boolean;
  cost: number;
  responseTime: number;
  reliability: number;
  dataQuality: number;
  errorRate: number;
  lastTested: string;
}

export interface OptimalStrategy {
  type: 'static_fetch' | 'browser_render' | 'gpt5_extraction';
  confidence: number;
  fallbackChain: string[];
  costPerExtraction: number;
  averageResponseTime: number;
  successRate: number;
}
```

**Database Operations**:
```typescript
// packages/core/src/dip-service.ts - NEW FILE
export class DIPService {
  async getDIP(domain: string): Promise<DomainIntelligenceProfile | null>
  async saveDIP(dip: DomainIntelligenceProfile): Promise<void>
  async updateDIP(domain: string, updates: Partial<DomainIntelligenceProfile>): Promise<void>
  async isDIPStale(domain: string, maxAge: number): Promise<boolean>
  async listDIPs(limit?: number): Promise<DomainIntelligenceProfile[]>
  async deleteDIP(domain: string): Promise<void>
}
```

### Task 1.2: Worker Integration Framework

**Modify Worker Entry Point**:
```javascript
// packages/worker/worker.js - MODIFY EXISTING
// Add DIP-aware processing pipeline

async function processJobWithDIP(job) {
  const { url } = job.params;
  const domain = extractDomain(url);
  
  console.log(`🔍 Processing job for domain: ${domain}`);
  
  // Check for existing DIP
  const existingDIP = await dipService.getDIP(domain);
  
  if (!existingDIP || await dipService.isDIPStale(domain, 7 * 24 * 60 * 60 * 1000)) {
    console.log(`📊 Creating new DIP for ${domain}`);
    
    // Create comprehensive domain profile
    const newDIP = await createDomainProfile(domain, url);
    await dipService.saveDIP(newDIP);
    
    // Process job with new DIP
    return await executeExtractionStrategy(job, newDIP.optimalStrategy);
  } else {
    console.log(`✅ Using existing DIP for ${domain} (age: ${getDIPAge(existingDIP)})`);
    
    // Use existing DIP strategy
    return await executeExtractionStrategy(job, existingDIP.optimalStrategy);
  }
}
```

**Acceptance Criteria**:
- [ ] TypeScript interfaces for all DIP data structures
- [ ] Complete DIP service with CRUD operations
- [ ] Worker modified to check for DIPs before processing
- [ ] DynamoDB operations tested with LocalStack
- [ ] All existing functionality still works

---

## 📋 Sprint 2: Site Analysis Engine

**Objective**: Build comprehensive site analysis to create intelligent DIPs

### Task 2.1: Technical Site Analysis

**Framework Detection**:
```javascript
// packages/worker/analysis/framework-detector.js - NEW FILE
export async function detectFramework(url) {
  const response = await fetch(url);
  const html = await response.text();
  const headers = response.headers;
  
  // Detection patterns
  const patterns = {
    'react': [/__REACT_DEVTOOLS/, /_reactInternalInstance/, /react(-dom)?\..*\.js/],
    'vue': [/__VUE__/, /vue\..*\.js/],
    'angular': [/ng-/, /angular\..*\.js/],
    'wordpress': [/wp-content/, /wp-includes/],
    'shopify': [/shopify/i, /liquid/i],
    'squarespace': [/squarespace/i],
    'wix': [/wix\.com/],
    'next.js': [/__NEXT_DATA__/, /_next\//],
    'nuxt': [/__NUXT__/],
    'gatsby': [/___gatsby/]
  };
  
  for (const [framework, regexes] of Object.entries(patterns)) {
    if (regexes.some(regex => regex.test(html))) {
      return framework;
    }
  }
  
  return 'unknown';
}
```

**Rendering Type Detection**:
```javascript
// packages/worker/analysis/rendering-detector.js - NEW FILE
export async function detectRenderingType(url) {
  // Test static vs dynamic content
  const staticContent = await fetchStatic(url);
  const browserContent = await fetchWithBrowser(url);
  
  const similarity = calculateContentSimilarity(staticContent, browserContent);
  
  if (similarity > 0.95) {
    return 'static';
  } else if (similarity > 0.7) {
    return 'ssr';
  } else {
    return 'spa';
  }
}
```

**Content Pattern Analysis**:
```javascript
// packages/worker/analysis/pattern-analyzer.js - NEW FILE
export async function analyzeContentPatterns(url) {
  const $ = cheerio.load(await fetchHTML(url));
  
  return {
    commonSelectors: findCommonSelectors($),
    contentStructure: analyzeStructure($),
    navigationPatterns: findNavigationPatterns($),
    contentTypes: identifyContentTypes($),
    repeatableElements: findRepeatablePatterns($)
  };
}
```

### Task 2.2: Site Constraints & Permissions Analysis

**Robots.txt Parser**:
```javascript
// packages/worker/analysis/robots-analyzer.js - NEW FILE
export async function analyzeRobotsTxt(domain) {
  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const response = await fetch(robotsUrl);
    const robotsContent = await response.text();
    
    return {
      exists: true,
      allowedPaths: parseAllowedPaths(robotsContent),
      disallowedPaths: parseDisallowedPaths(robotsContent),
      crawlDelay: parseCrawlDelay(robotsContent),
      sitemapUrls: parseSitemaps(robotsContent),
      userAgents: parseUserAgents(robotsContent)
    };
  } catch (error) {
    return {
      exists: false,
      allowedPaths: ['*'],
      disallowedPaths: [],
      crawlDelay: 1,
      sitemapUrls: [],
      userAgents: ['*']
    };
  }
}
```

**Rate Limit Detection**:
```javascript
// packages/worker/analysis/rate-limit-detector.js - NEW FILE
export async function detectRateLimits(domain) {
  const testResults = [];
  
  // Progressive rate testing
  const ratesToTest = [1, 5, 10, 20, 50]; // requests per minute
  
  for (const rate of ratesToTest) {
    const result = await testRequestRate(domain, rate);
    testResults.push(result);
    
    if (!result.success) {
      break; // Found the limit
    }
  }
  
  return {
    maxRequestsPerMinute: calculateSafeRate(testResults),
    recommendedDelay: calculateRecommendedDelay(testResults),
    hasRateLimit: testResults.some(r => !r.success),
    testResults
  };
}
```

**Acceptance Criteria**:
- [ ] Framework detection for major platforms (React, WordPress, Shopify, etc.)
- [ ] Rendering type detection (SSR, SPA, static)
- [ ] Content pattern analysis with selector identification
- [ ] Robots.txt parsing and constraint extraction
- [ ] Rate limit detection with safe request calculations
- [ ] All analysis functions tested with real websites

---

## 📋 Sprint 3: Extraction Strategy Testing & Optimization

**Objective**: Test multiple extraction approaches and determine optimal strategies

### Task 3.1: Multi-Strategy Testing Framework

**Strategy Testing Engine**:
```javascript
// packages/worker/testing/strategy-tester.js - NEW FILE
export class ExtractionStrategyTester {
  async testAllStrategies(url, testSchema) {
    const results = [];
    
    // Test 1: Static fetch (fastest, cheapest)
    results.push(await this.testStaticFetch(url, testSchema));
    
    // Test 2: Browser rendering (medium cost)  
    results.push(await this.testBrowserRender(url, testSchema));
    
    // Test 3: GPT-5 nano (AI-powered, higher cost)
    results.push(await this.testGPT5Extraction(url, testSchema, 'gpt-5-nano'));
    
    // Test 4: GPT-5 mini (for complex content)
    results.push(await this.testGPT5Extraction(url, testSchema, 'gpt-5-mini'));
    
    return this.analyzeResults(results);
  }
  
  async testStaticFetch(url, schema) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'AtlasCodex/1.0' },
        timeout: 10000
      });
      
      const html = await response.text();
      const extractedData = await this.extractWithCheerio(html, schema);
      
      return {
        strategy: 'static_fetch',
        success: true,
        data: extractedData,
        responseTime: Date.now() - startTime,
        cost: 0.0001,
        dataQuality: this.assessDataQuality(extractedData, schema),
        reliability: 0.85 // Based on historical data
      };
    } catch (error) {
      return {
        strategy: 'static_fetch',
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime,
        cost: 0,
        dataQuality: 0,
        reliability: 0
      };
    }
  }
  
  async testBrowserRender(url, schema) {
    const startTime = Date.now();
    
    try {
      const { context, contextId } = await browserPool.getContext();
      const page = await context.newPage();
      
      await page.goto(url, { waitUntil: 'networkidle' });
      const html = await page.content();
      const extractedData = await this.extractWithCheerio(html, schema);
      
      await browserPool.releaseContext(contextId);
      
      return {
        strategy: 'browser_render',
        success: true,
        data: extractedData,
        responseTime: Date.now() - startTime,
        cost: 0.001,
        dataQuality: this.assessDataQuality(extractedData, schema),
        reliability: 0.95
      };
    } catch (error) {
      return {
        strategy: 'browser_render',
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime,
        cost: 0.001, // Still consumed resources
        dataQuality: 0,
        reliability: 0
      };
    }
  }
  
  async testGPT5Extraction(url, schema, model) {
    const startTime = Date.now();
    
    try {
      // First get the content
      const content = await this.getPageContent(url);
      
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Extract structured data according to the provided schema. Return only valid JSON.'
          },
          {
            role: 'user',
            content: `Extract data from this page content:\n\n${content}\n\nSchema:\n${JSON.stringify(schema)}`
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'extraction', schema }
        },
        verbosity: 'low',
        reasoning_effort: 'minimal'
      });
      
      const extractedData = JSON.parse(response.choices[0].message.content);
      const cost = this.calculateGPT5Cost(response.usage, model);
      
      return {
        strategy: `gpt5_${model.replace('gpt-5-', '')}`,
        success: true,
        data: extractedData,
        responseTime: Date.now() - startTime,
        cost,
        dataQuality: this.assessDataQuality(extractedData, schema),
        reliability: 0.98,
        tokens: response.usage.total_tokens
      };
    } catch (error) {
      return {
        strategy: `gpt5_${model.replace('gpt-5-', '')}`,
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime,
        cost: 0,
        dataQuality: 0,
        reliability: 0
      };
    }
  }
}
```

### Task 3.2: Strategy Selection Algorithm

**Optimal Strategy Selector**:
```javascript
// packages/worker/optimization/strategy-selector.js - NEW FILE
export class StrategySelector {
  selectOptimalStrategy(testResults, requirements = {}) {
    const {
      maxCost = 0.01,           // Max cost per extraction
      minReliability = 0.90,    // Min success rate required  
      maxResponseTime = 10000,  // Max response time in ms
      minDataQuality = 0.85     // Min data quality score
    } = requirements;
    
    // Filter strategies that meet requirements
    const viableStrategies = testResults.filter(result => 
      result.success &&
      result.cost <= maxCost &&
      result.reliability >= minReliability &&
      result.responseTime <= maxResponseTime &&
      result.dataQuality >= minDataQuality
    );
    
    if (viableStrategies.length === 0) {
      // Fallback to most reliable strategy
      return testResults.find(r => r.success) || testResults[0];
    }
    
    // Score each strategy
    const scoredStrategies = viableStrategies.map(strategy => ({
      ...strategy,
      score: this.calculateStrategyScore(strategy, requirements)
    }));
    
    // Return highest scoring strategy
    return scoredStrategies.sort((a, b) => b.score - a.score)[0];
  }
  
  calculateStrategyScore(strategy, requirements) {
    // Weighted scoring algorithm
    const weights = {
      cost: -0.3,          // Lower cost is better (negative weight)
      responseTime: -0.2,  // Lower response time is better
      reliability: 0.3,    // Higher reliability is better
      dataQuality: 0.2     // Higher data quality is better
    };
    
    // Normalize values to 0-1 range
    const normalizedCost = Math.min(strategy.cost / requirements.maxCost, 1);
    const normalizedTime = Math.min(strategy.responseTime / requirements.maxResponseTime, 1);
    const normalizedReliability = strategy.reliability;
    const normalizedQuality = strategy.dataQuality;
    
    return (
      weights.cost * normalizedCost +
      weights.responseTime * normalizedTime +
      weights.reliability * normalizedReliability +
      weights.dataQuality * normalizedQuality
    );
  }
  
  createFallbackChain(testResults) {
    // Order strategies by reliability, then by cost
    return testResults
      .filter(r => r.success)
      .sort((a, b) => {
        if (b.reliability !== a.reliability) {
          return b.reliability - a.reliability; // Higher reliability first
        }
        return a.cost - b.cost; // Lower cost second
      })
      .map(r => r.strategy);
  }
}
```

**Acceptance Criteria**:
- [ ] Multi-strategy testing framework operational
- [ ] All four extraction strategies tested (static, browser, GPT-5 nano, GPT-5 mini)
- [ ] Data quality assessment algorithms implemented
- [ ] Strategy selection based on cost, speed, and reliability
- [ ] Fallback chain creation for failed primary strategies
- [ ] Testing framework validated with 10+ different website types

---

## 📋 Sprint 4: DIP Creation & Management

**Objective**: Complete DIP creation pipeline and management system

### Task 4.1: Complete DIP Creation Pipeline

**Domain Profile Creator**:
```javascript
// packages/worker/dip/profile-creator.js - NEW FILE
export class DomainProfileCreator {
  async createComprehensiveDIP(domain, initialUrl) {
    console.log(`🔬 Creating comprehensive DIP for ${domain}`);
    
    const startTime = Date.now();
    
    // Step 1: Site structure analysis
    console.log(`  📊 Analyzing site structure...`);
    const siteStructure = await this.analyzeSiteStructure(domain, initialUrl);
    
    // Step 2: Constraints and permissions
    console.log(`  🤖 Checking robots.txt and constraints...`);
    const constraints = await this.analyzeSiteConstraints(domain);
    
    // Step 3: Test extraction strategies
    console.log(`  ⚡ Testing extraction strategies...`);
    const testSchema = this.generateTestSchema(siteStructure);
    const strategyResults = await this.testExtractionStrategies(initialUrl, testSchema);
    
    // Step 4: Select optimal strategy
    console.log(`  🎯 Selecting optimal strategy...`);
    const optimalStrategy = this.selectOptimalStrategy(strategyResults, {
      maxCost: process.env.MAX_COST_PER_PAGE || 0.002,
      minReliability: 0.85,
      maxResponseTime: 15000
    });
    
    // Step 5: Calculate performance metrics
    const performanceMetrics = this.calculatePerformanceMetrics(strategyResults);
    
    // Step 6: Generate cost profile
    const costProfile = this.generateCostProfile(strategyResults, optimalStrategy);
    
    const dip = {
      domain,
      version: '1.0',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      creationTime: Date.now() - startTime,
      
      siteStructure,
      constraints,
      extractionStrategies: strategyResults,
      optimalStrategy,
      performanceMetrics,
      costProfile,
      
      // Metadata
      testUrl: initialUrl,
      confidence: this.calculateConfidence(strategyResults),
      nextReviewDate: this.calculateNextReviewDate(),
      
      // Evidence
      evidence: {
        hash: crypto.createHash('sha256').update(JSON.stringify({
          domain, siteStructure, strategyResults, optimalStrategy
        })).digest('hex'),
        timestamp: new Date().toISOString(),
        testResults: strategyResults.length
      }
    };
    
    console.log(`✅ DIP created for ${domain} in ${Date.now() - startTime}ms`);
    console.log(`   Strategy: ${optimalStrategy.strategy} (${optimalStrategy.cost}/extraction)`);
    console.log(`   Confidence: ${Math.round(dip.confidence * 100)}%`);
    
    return dip;
  }
  
  generateTestSchema(siteStructure) {
    // Generate appropriate test schema based on detected framework/content type
    const baseSchema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['title']
    };
    
    // Enhance schema based on site type
    if (siteStructure.framework === 'shopify' || siteStructure.contentTypes.includes('product')) {
      baseSchema.properties.price = { type: 'number' };
      baseSchema.properties.availability = { type: 'string' };
    }
    
    if (siteStructure.contentTypes.includes('article')) {
      baseSchema.properties.author = { type: 'string' };
      baseSchema.properties.publishDate = { type: 'string' };
    }
    
    return baseSchema;
  }
}
```

### Task 4.2: DIP Lifecycle Management

**DIP Update & Maintenance**:
```javascript
// packages/worker/dip/lifecycle-manager.js - NEW FILE
export class DIPLifecycleManager {
  async updateDIP(domain, newData, reason) {
    const existingDIP = await dipService.getDIP(domain);
    if (!existingDIP) {
      throw new Error(`No DIP found for domain: ${domain}`);
    }
    
    console.log(`🔄 Updating DIP for ${domain} (reason: ${reason})`);
    
    const updatedDIP = {
      ...existingDIP,
      version: this.incrementVersion(existingDIP.version),
      lastUpdated: new Date().toISOString(),
      updateHistory: [
        ...(existingDIP.updateHistory || []),
        {
          timestamp: new Date().toISOString(),
          reason,
          changes: this.calculateChanges(existingDIP, newData)
        }
      ],
      ...newData
    };
    
    await dipService.saveDIP(updatedDIP);
    return updatedDIP;
  }
  
  async shouldUpdateDIP(domain, currentPerformance) {
    const dip = await dipService.getDIP(domain);
    if (!dip) return false;
    
    const updateTriggers = [
      // Performance degradation
      currentPerformance.successRate < dip.performanceMetrics.successRate * 0.8,
      
      // Cost increase
      currentPerformance.averageCost > dip.costProfile.averageCost * 1.5,
      
      // Response time increase  
      currentPerformance.averageResponseTime > dip.performanceMetrics.averageResponseTime * 2,
      
      // Age-based update (weekly for active domains)
      this.getDIPAge(dip) > 7 * 24 * 60 * 60 * 1000,
      
      // Error rate spike
      currentPerformance.errorRate > 0.1
    ];
    
    return updateTriggers.some(trigger => trigger);
  }
  
  async archiveStaleDP(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days
    const allDIPs = await dipService.listDIPs();
    const staleDIPs = allDIPs.filter(dip => this.getDIPAge(dip) > maxAge);
    
    for (const dip of staleDIPs) {
      console.log(`📦 Archiving stale DIP for ${dip.domain}`);
      await dipService.deleteDIP(dip.domain);
    }
    
    return staleDIPs.length;
  }
}
```

**Acceptance Criteria**:
- [ ] Complete DIP creation pipeline functional
- [ ] Site analysis generates comprehensive profiles
- [ ] Strategy testing and selection algorithm working
- [ ] DIP lifecycle management (create, update, archive)
- [ ] Performance-based DIP update triggers
- [ ] Evidence hashing and verification for all DIPs
- [ ] DIP creation tested with 20+ diverse websites

---

## 📋 Sprint 5: Intelligent Extraction Engine

**Objective**: Build the execution engine that uses DIPs for optimized extraction

### Task 5.1: DIP-Powered Extraction Engine

**Smart Extraction Router**:
```javascript
// packages/worker/extraction/smart-router.js - NEW FILE
export class SmartExtractionRouter {
  async executeExtraction(job, dip) {
    const { url, schema } = job.params;
    const { optimalStrategy, fallbackChain } = dip;
    
    console.log(`🎯 Using ${optimalStrategy.strategy} for ${url}`);
    
    let lastError = null;
    const strategies = [optimalStrategy.strategy, ...fallbackChain];
    
    for (const strategyType of strategies) {
      try {
        const result = await this.executeStrategy(strategyType, url, schema, dip);
        
        // Update DIP performance metrics
        await this.recordPerformance(dip.domain, strategyType, {
          success: true,
          responseTime: result.responseTime,
          cost: result.cost,
          dataQuality: result.dataQuality
        });
        
        return {
          ...result,
          strategyUsed: strategyType,
          dipVersion: dip.version,
          fallbacksTriedted: strategies.indexOf(strategyType)
        };
        
      } catch (error) {
        console.warn(`Strategy ${strategyType} failed for ${url}:`, error.message);
        lastError = error;
        
        // Record failure
        await this.recordPerformance(dip.domain, strategyType, {
          success: false,
          error: error.message,
          responseTime: 0,
          cost: 0
        });
      }
    }
    
    // All strategies failed
    throw new Error(`All extraction strategies failed for ${url}. Last error: ${lastError?.message}`);
  }
  
  async executeStrategy(strategyType, url, schema, dip) {
    const startTime = Date.now();
    
    switch (strategyType) {
      case 'static_fetch':
        return await this.executeStaticFetch(url, schema, dip);
      
      case 'browser_render':
        return await this.executeBrowserRender(url, schema, dip);
      
      case 'gpt5_nano':
      case 'gpt5_mini':  
      case 'gpt5_standard':
        return await this.executeGPT5Extraction(url, schema, dip, strategyType);
      
      default:
        throw new Error(`Unknown strategy type: ${strategyType}`);
    }
  }
  
  async executeStaticFetch(url, schema, dip) {
    const startTime = Date.now();
    
    // Use DIP-learned selectors and patterns
    const response = await fetch(url, {
      headers: {
        'User-Agent': dip.constraints.preferredUserAgent || 'AtlasCodex/1.0',
        ...dip.siteStructure.optimalHeaders
      },
      timeout: dip.constraints.recommendedTimeout || 10000
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Use learned selectors from DIP
    const extractedData = this.extractUsingSelectors($, schema, dip.siteStructure.contentSelectors);
    
    return {
      data: extractedData,
      responseTime: Date.now() - startTime,
      cost: 0.0001,
      dataQuality: this.assessDataQuality(extractedData, schema),
      strategy: 'static_fetch',
      evidence: {
        hash: crypto.createHash('sha256').update(html).digest('hex'),
        timestamp: new Date().toISOString(),
        method: 'static_fetch'
      }
    };
  }
  
  async executeGPT5Extraction(url, schema, dip, strategyType) {
    const startTime = Date.now();
    
    // Get content using optimal method from DIP
    const content = dip.siteStructure.requiresJavaScript 
      ? await this.getContentWithBrowser(url, dip)
      : await this.getContentStatic(url, dip);
    
    // Select model based on strategy
    const modelMap = {
      'gpt5_nano': 'gpt-5-nano',
      'gpt5_mini': 'gpt-5-mini',
      'gpt5_standard': 'gpt-5'
    };
    
    const model = modelMap[strategyType];
    
    // Use DIP-optimized prompting
    const optimizedPrompt = this.createOptimizedPrompt(schema, dip);
    
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: optimizedPrompt.system
        },
        {
          role: 'user',
          content: `${optimizedPrompt.user}\n\nContent:\n${content}`
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'extraction', schema }
      },
      verbosity: dip.optimalStrategy.verbosity || 'low',
      reasoning_effort: dip.optimalStrategy.reasoningEffort || 'minimal'
    });
    
    const extractedData = JSON.parse(response.choices[0].message.content);
    const cost = this.calculateGPT5Cost(response.usage, model);
    
    return {
      data: extractedData,
      responseTime: Date.now() - startTime,
      cost,
      dataQuality: this.assessDataQuality(extractedData, schema),
      strategy: strategyType,
      tokens: response.usage.total_tokens,
      evidence: {
        hash: crypto.createHash('sha256').update(content).digest('hex'),
        timestamp: new Date().toISOString(),
        method: strategyType,
        model,
        tokens: response.usage.total_tokens
      }
    };
  }
}
```

### Task 5.2: Performance Monitoring & Optimization

**Real-time Performance Tracker**:
```javascript
// packages/worker/monitoring/performance-tracker.js - NEW FILE
export class PerformanceTracker {
  async recordExtractionMetrics(domain, metrics) {
    const key = `perf:${domain}:${new Date().toISOString().split('T')[0]}`;
    
    // Store daily metrics in Redis
    await redis.lpush(key, JSON.stringify({
      ...metrics,
      timestamp: new Date().toISOString()
    }));
    
    // Keep only last 100 entries per domain per day
    await redis.ltrim(key, 0, 99);
    
    // Set expiration for 30 days
    await redis.expire(key, 30 * 24 * 60 * 60);
    
    // Check if DIP needs updating based on performance
    await this.checkForDIPUpdate(domain, metrics);
  }
  
  async getDomainPerformance(domain, days = 7) {
    const dates = Array.from({length: days}, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    });
    
    const allMetrics = [];
    for (const date of dates) {
      const key = `perf:${domain}:${date}`;
      const dayMetrics = await redis.lrange(key, 0, -1);
      allMetrics.push(...dayMetrics.map(m => JSON.parse(m)));
    }
    
    return this.aggregateMetrics(allMetrics);
  }
  
  async checkForDIPUpdate(domain, currentMetrics) {
    const dip = await dipService.getDIP(domain);
    if (!dip) return;
    
    const historicalPerf = await this.getDomainPerformance(domain);
    
    // Trigger DIP update if performance degraded significantly
    if (this.shouldTriggerUpdate(currentMetrics, historicalPerf, dip)) {
      console.log(`⚠️ Performance degradation detected for ${domain}, triggering DIP update`);
      
      // Queue DIP update job
      await this.queueDIPUpdate(domain, {
        reason: 'performance_degradation',
        currentMetrics,
        historicalPerf
      });
    }
  }
}
```

**Acceptance Criteria**:
- [ ] Smart extraction router uses DIP strategies effectively
- [ ] Fallback chain execution when primary strategy fails
- [ ] Performance metrics collected for all extractions
- [ ] DIP-optimized prompting for GPT-5 strategies
- [ ] Real-time performance monitoring and alerting
- [ ] Automatic DIP updates triggered by performance degradation
- [ ] Cost tracking per domain and strategy type

---

## 📋 Sprint 6: Evidence Ledger Integration

**Objective**: Integrate comprehensive evidence tracking with DIP system

### Task 6.1: Enhanced Evidence System

**Evidence Ledger for DIPs**:
```javascript
// packages/worker/evidence/dip-evidence.js - NEW FILE
export class DIPEvidenceManager {
  async createDIPEvidence(dip, testResults) {
    const evidencePackage = {
      dipId: `${dip.domain}_${dip.version}`,
      domain: dip.domain,
      version: dip.version,
      createdAt: dip.createdAt,
      
      // Site analysis evidence
      siteAnalysis: {
        framework: dip.siteStructure.framework,
        renderingType: dip.siteStructure.renderingType,
        testUrl: dip.testUrl,
        analysisTimestamp: dip.createdAt,
        analysisHash: this.hashObject(dip.siteStructure)
      },
      
      // Strategy testing evidence
      strategyTests: testResults.map(test => ({
        strategy: test.strategy,
        success: test.success,
        responseTime: test.responseTime,
        cost: test.cost,
        dataQuality: test.dataQuality,
        testTimestamp: new Date().toISOString(),
        testHash: this.hashObject(test)
      })),
      
      // Selection rationale
      selectionRationale: {
        selectedStrategy: dip.optimalStrategy.strategy,
        selectionReason: this.generateSelectionReason(dip.optimalStrategy, testResults),
        confidence: dip.confidence,
        fallbackChain: dip.optimalStrategy.fallbackChain
      },
      
      // Cryptographic evidence
      evidence: {
        dipHash: crypto.createHash('sha256').update(JSON.stringify({
          domain: dip.domain,
          siteStructure: dip.siteStructure,
          testResults: testResults,
          optimalStrategy: dip.optimalStrategy
        })).digest('hex'),
        timestamp: new Date().toISOString(),
        version: dip.version,
        testCount: testResults.length
      }
    };
    
    // Store in evidence ledger
    await this.storeEvidence(evidencePackage);
    
    return evidencePackage;
  }
  
  async createExtractionEvidence(extractionResult, dip) {
    const evidencePackage = {
      extractionId: nanoid(),
      url: extractionResult.url,
      domain: extractionResult.domain,
      dipVersion: dip.version,
      
      // Extraction details
      extraction: {
        strategy: extractionResult.strategyUsed,
        success: extractionResult.success,
        responseTime: extractionResult.responseTime,
        cost: extractionResult.cost,
        dataQuality: extractionResult.dataQuality,
        timestamp: new Date().toISOString()
      },
      
      // DIP usage evidence
      dipUsage: {
        dipId: `${dip.domain}_${dip.version}`,
        strategyReason: this.explainStrategyChoice(dip.optimalStrategy),
        fallbacksUsed: extractionResult.fallbacksUsed || 0,
        dipAge: this.calculateDIPAge(dip)
      },
      
      // Content evidence
      contentEvidence: {
        contentHash: extractionResult.evidence.hash,
        extractionMethod: extractionResult.strategyUsed,
        tokensUsed: extractionResult.tokens || 0,
        modelUsed: extractionResult.model || null
      },
      
      // Verification
      verification: {
        hash: crypto.createHash('sha256').update(JSON.stringify({
          url: extractionResult.url,
          strategy: extractionResult.strategyUsed,
          data: extractionResult.data,
          dipVersion: dip.version
        })).digest('hex'),
        timestamp: new Date().toISOString(),
        verifiable: true
      }
    };
    
    await this.storeEvidence(evidencePackage);
    return evidencePackage;
  }
}
```

### Task 6.2: Evidence Verification & Audit Trail

**Evidence Verification System**:
```javascript
// packages/worker/evidence/verifier.js - NEW FILE
export class EvidenceVerifier {
  async verifyDIPEvidence(dipId) {
    const evidence = await this.getEvidence(dipId);
    if (!evidence) {
      return { valid: false, reason: 'Evidence not found' };
    }
    
    const dip = await dipService.getDIP(evidence.domain);
    if (!dip) {
      return { valid: false, reason: 'DIP not found' };
    }
    
    // Verify hash integrity
    const recalculatedHash = crypto.createHash('sha256').update(JSON.stringify({
      domain: dip.domain,
      siteStructure: dip.siteStructure,
      testResults: evidence.strategyTests,
      optimalStrategy: dip.optimalStrategy
    })).digest('hex');
    
    if (recalculatedHash !== evidence.evidence.dipHash) {
      return { 
        valid: false, 
        reason: 'Hash mismatch - evidence may be tampered',
        expected: recalculatedHash,
        actual: evidence.evidence.dipHash
      };
    }
    
    return {
      valid: true,
      evidence,
      verificationTimestamp: new Date().toISOString(),
      hashVerified: true
    };
  }
  
  async generateAuditReport(domain, startDate, endDate) {
    const evidence = await this.getEvidenceByDomain(domain, startDate, endDate);
    
    return {
      domain,
      auditPeriod: { startDate, endDate },
      generatedAt: new Date().toISOString(),
      
      summary: {
        totalExtractions: evidence.extractions.length,
        successRate: this.calculateSuccessRate(evidence.extractions),
        averageCost: this.calculateAverageCost(evidence.extractions),
        averageResponseTime: this.calculateAverageResponseTime(evidence.extractions),
        strategiesUsed: this.getUniqueStrategies(evidence.extractions)
      },
      
      dipHistory: evidence.dips.map(dip => ({
        version: dip.version,
        createdAt: dip.createdAt,
        strategy: dip.optimalStrategy.strategy,
        confidence: dip.confidence,
        evidenceHash: dip.evidence.dipHash
      })),
      
      costBreakdown: this.generateCostBreakdown(evidence.extractions),
      performanceTrends: this.analyzePerformanceTrends(evidence.extractions),
      
      verification: {
        allHashesValid: await this.verifyAllHashes(evidence),
        auditTrailComplete: this.verifyAuditTrail(evidence),
        noTampering: await this.checkForTampering(evidence)
      }
    };
  }
}
```

**Acceptance Criteria**:
- [ ] Complete evidence tracking for DIP creation and usage
- [ ] Cryptographic verification of all evidence packages
- [ ] Audit trail generation for compliance and debugging
- [ ] Evidence verification system with hash integrity checks
- [ ] Audit reports showing cost, performance, and strategy effectiveness
- [ ] Evidence storage integrated with existing S3 evidence bucket

---

## 📋 Sprint 7: Cost Optimization & Monitoring

**Objective**: Implement advanced cost controls and real-time monitoring

### Task 7.1: Advanced Cost Router

**Intelligent Cost Router**:
```javascript
// packages/worker/cost/intelligent-router.js - NEW FILE
export class IntelligentCostRouter {
  async shouldAllowExtraction(domain, estimatedCost, currentUsage) {
    const limits = this.getEnvironmentLimits();
    const dipMetrics = await this.getDomainMetrics(domain);
    
    // Check environment-wide limits
    if (currentUsage.llmPercentage >= limits.maxLLMPercent) {
      console.log(`🚫 LLM usage limit reached: ${currentUsage.llmPercentage}% >= ${limits.maxLLMPercent}%`);
      return { 
        allowed: false, 
        reason: 'llm_limit_exceeded',
        recommendation: 'use_deterministic_extraction'
      };
    }
    
    if (estimatedCost > limits.maxCostPerPage) {
      console.log(`💰 Cost limit exceeded: $${estimatedCost} > $${limits.maxCostPerPage}`);
      return {
        allowed: false,
        reason: 'cost_limit_exceeded',
        recommendation: 'use_cheaper_strategy'
      };
    }
    
    // Check domain-specific patterns
    if (dipMetrics.costTrend === 'increasing' && dipMetrics.successRateTrend === 'decreasing') {
      console.log(`📉 Domain performance degrading: ${domain}`);
      return {
        allowed: true,
        reason: 'performance_monitoring',
        recommendation: 'trigger_dip_update',
        requiresReview: true
      };
    }
    
    return { 
      allowed: true, 
      reason: 'within_limits',
      estimatedCost,
      currentUsage 
    };
  }
  
  async routeToOptimalStrategy(job, dip, costConstraints) {
    const strategies = [
      ...dip.extractionStrategies
        .filter(s => s.success && s.cost <= costConstraints.maxCost)
        .sort((a, b) => a.cost - b.cost) // Cheapest first
    ];
    
    if (strategies.length === 0) {
      throw new Error(`No viable strategies within cost limit: $${costConstraints.maxCost}`);
    }
    
    // Try strategies in cost order
    for (const strategy of strategies) {
      const routingDecision = await this.shouldAllowExtraction(
        dip.domain, 
        strategy.cost, 
        await this.getCurrentUsage()
      );
      
      if (routingDecision.allowed) {
        console.log(`💡 Routing to ${strategy.type} for ${dip.domain} (cost: $${strategy.cost})`);
        return {
          strategy: strategy.type,
          estimatedCost: strategy.cost,
          rationale: routingDecision.reason
        };
      }
    }
    
    // All strategies blocked by cost controls
    return {
      strategy: 'blocked',
      reason: 'cost_controls_active',
      alternatives: this.suggestAlternatives(dip, costConstraints)
    };
  }
  
  getEnvironmentLimits() {
    return {
      maxLLMPercent: parseFloat(process.env.MAX_LLM_PERCENT || '0.15'),
      maxCostPerPage: parseFloat(process.env.MAX_COST_PER_PAGE || '0.002'),
      dailySpendLimit: parseFloat(process.env.DAILY_SPEND_LIMIT || '50'),
      hourlySpendLimit: parseFloat(process.env.HOURLY_SPEND_LIMIT || '5')
    };
  }
}
```

### Task 7.2: Real-time Cost Monitoring

**Cost Monitoring Dashboard Data**:
```javascript
// packages/worker/monitoring/cost-monitor.js - NEW FILE
export class CostMonitor {
  async trackExtractionCost(domain, strategy, actualCost, metadata) {
    const timestamp = new Date().toISOString();
    const hour = timestamp.substring(0, 13); // YYYY-MM-DDTHH
    const day = timestamp.substring(0, 10);  // YYYY-MM-DD
    
    // Track hourly costs
    const hourlyKey = `cost:hourly:${hour}`;
    await redis.hincrby(hourlyKey, 'total', Math.round(actualCost * 100000)); // Store as micro-cents
    await redis.hincrby(hourlyKey, domain, Math.round(actualCost * 100000));
    await redis.hincrby(hourlyKey, strategy, Math.round(actualCost * 100000));
    await redis.expire(hourlyKey, 48 * 60 * 60); // Keep for 48 hours
    
    // Track daily costs
    const dailyKey = `cost:daily:${day}`;
    await redis.hincrby(dailyKey, 'total', Math.round(actualCost * 100000));
    await redis.hincrby(dailyKey, domain, Math.round(actualCost * 100000));
    await redis.hincrby(dailyKey, strategy, Math.round(actualCost * 100000));
    await redis.expire(dailyKey, 30 * 24 * 60 * 60); // Keep for 30 days
    
    // Track strategy usage
    await redis.hincrby('strategy:usage:count', strategy, 1);
    await redis.hincrby('strategy:usage:cost', strategy, Math.round(actualCost * 100000));
    
    // Check for spending alerts
    await this.checkSpendingAlerts(hour, day, actualCost);
    
    // Store detailed record
    await this.storeDetailedCostRecord({
      timestamp,
      domain,
      strategy,
      cost: actualCost,
      metadata
    });
  }
  
  async getCurrentSpending() {
    const now = new Date();
    const currentHour = now.toISOString().substring(0, 13);
    const currentDay = now.toISOString().substring(0, 10);
    
    const [hourlySpend, dailySpend] = await Promise.all([
      redis.hget(`cost:hourly:${currentHour}`, 'total').then(v => (parseInt(v) || 0) / 100000),
      redis.hget(`cost:daily:${currentDay}`, 'total').then(v => (parseInt(v) || 0) / 100000)
    ]);
    
    // Get strategy breakdown for current day
    const strategyBreakdown = await this.getStrategyBreakdown(currentDay);
    
    // Calculate LLM percentage
    const llmCosts = ['gpt5_nano', 'gpt5_mini', 'gpt5_standard']
      .reduce((sum, strategy) => sum + (strategyBreakdown[strategy] || 0), 0);
    const llmPercentage = dailySpend > 0 ? (llmCosts / dailySpend) * 100 : 0;
    
    return {
      hourly: hourlySpend,
      daily: dailySpend,
      llmPercentage,
      strategyBreakdown,
      timestamp: now.toISOString()
    };
  }
  
  async generateCostOptimizationReport(domain) {
    const costData = await this.getDomainCostHistory(domain, 7); // Last 7 days
    const dip = await dipService.getDIP(domain);
    
    return {
      domain,
      reportGeneratedAt: new Date().toISOString(),
      currentStrategy: dip?.optimalStrategy.strategy,
      
      costAnalysis: {
        totalSpend: costData.totalCost,
        averageCostPerExtraction: costData.averageCost,
        extractionCount: costData.extractionCount,
        costTrend: this.analyzeCostTrend(costData.daily)
      },
      
      optimizationOpportunities: [
        ...this.identifyHighCostDomains(costData),
        ...this.findInefficiencies(costData, dip),
        ...this.suggestStrategySwitches(costData, dip)
      ],
      
      projectedSavings: this.calculatePotentialSavings(costData, dip),
      
      recommendations: [
        ...this.generateRecommendations(costData, dip)
      ]
    };
  }
}
```

**Acceptance Criteria**:
- [ ] Intelligent cost router enforces environment limits
- [ ] Real-time cost tracking per domain and strategy
- [ ] Automatic cost alerts when limits approached
- [ ] Cost optimization reports with actionable insights
- [ ] Dashboard data endpoints for real-time monitoring
- [ ] Cost projections based on current usage patterns

---

## 📋 Sprint 8: Testing, Integration & Production Readiness

**Objective**: Comprehensive testing, integration validation, and production deployment

### Task 8.1: Comprehensive Testing Suite

**DIP System Integration Tests**:
```javascript
// packages/worker/tests/dip-integration.test.js - NEW FILE
describe('DIP System Integration', () => {
  test('Complete DIP creation and usage flow', async () => {
    const testUrl = 'https://news.ycombinator.com';
    const domain = 'news.ycombinator.com';
    
    // 1. Should create DIP for new domain
    const job = { 
      jobId: 'test_job_1',
      params: { 
        url: testUrl,
        schema: { 
          type: 'object', 
          properties: { title: { type: 'string' } } 
        }
      }
    };
    
    const result = await processJobWithDIP(job);
    
    // Verify DIP was created
    const dip = await dipService.getDIP(domain);
    expect(dip).toBeDefined();
    expect(dip.domain).toBe(domain);
    expect(dip.optimalStrategy).toBeDefined();
    
    // Verify extraction worked
    expect(result.data.title).toBeDefined();
    expect(result.strategyUsed).toBe(dip.optimalStrategy.strategy);
  });
  
  test('DIP reuse for subsequent requests', async () => {
    const testUrl = 'https://news.ycombinator.com/item?id=12345';
    
    const job = { 
      jobId: 'test_job_2',
      params: { 
        url: testUrl,
        schema: { 
          type: 'object', 
          properties: { title: { type: 'string' } } 
        }
      }
    };
    
    const startTime = Date.now();
    const result = await processJobWithDIP(job);
    const processingTime = Date.now() - startTime;
    
    // Should be fast (using existing DIP)
    expect(processingTime).toBeLessThan(5000);
    expect(result.dipVersion).toBeDefined();
    expect(result.strategyUsed).toBeDefined();
  });
  
  test('Cost limits enforcement', async () => {
    // Set restrictive cost limits
    process.env.MAX_COST_PER_PAGE = '0.001';
    process.env.MAX_LLM_PERCENT = '0.05';
    
    const expensiveJob = { 
      jobId: 'test_expensive',
      params: { 
        url: 'https://example.com/complex-page',
        schema: { /* complex schema requiring GPT-5 */ }
      }
    };
    
    // Should either use cheaper strategy or block
    const result = await processJobWithDIP(expensiveJob);
    
    expect(result.cost).toBeLessThanOrEqual(0.001);
    expect(['static_fetch', 'browser_render', 'blocked']).toContain(result.strategyUsed);
  });
});
```

**Performance Benchmarks**:
```javascript
// packages/worker/tests/performance.test.js - NEW FILE
describe('DIP Performance Benchmarks', () => {
  test('DIP creation should complete within reasonable time', async () => {
    const startTime = Date.now();
    
    const dip = await createDomainProfile('github.com', 'https://github.com/microsoft/vscode');
    
    const creationTime = Date.now() - startTime;
    
    expect(creationTime).toBeLessThan(60000); // Under 1 minute
    expect(dip.creationTime).toBeLessThan(60000);
    expect(dip.confidence).toBeGreaterThan(0.8);
  });
  
  test('Extraction with existing DIP should be fast', async () => {
    const testCases = [
      'https://github.com/facebook/react',
      'https://github.com/microsoft/typescript',
      'https://github.com/vercel/next.js'
    ];
    
    for (const url of testCases) {
      const startTime = Date.now();
      
      const result = await processJobWithDIP({
        params: { url, schema: { type: 'object', properties: { title: { type: 'string' } } } }
      });
      
      const processingTime = Date.now() - startTime;
      
      expect(processingTime).toBeLessThan(10000); // Under 10 seconds
      expect(result.data.title).toBeDefined();
    }
  });
});
```

### Task 8.2: Production Deployment & Monitoring

**Production Deployment Checklist**:
```markdown
# Production Deployment Checklist

## Pre-Deployment
- [ ] All tests passing in CI/CD
- [ ] Load testing completed with DIP system
- [ ] Cost monitoring alerts configured
- [ ] Evidence ledger storage verified
- [ ] DIP database performance tested
- [ ] Rollback procedures documented

## Infrastructure
- [ ] DynamoDB tables created in production
- [ ] S3 evidence bucket configured
- [ ] Redis cluster for performance data
- [ ] CloudWatch alarms for cost monitoring
- [ ] ECR repositories for worker containers

## Configuration  
- [ ] Production environment variables set
- [ ] Cost limits configured appropriately
- [ ] Rate limits set for production traffic
- [ ] Monitoring endpoints enabled
- [ ] Evidence verification enabled

## Monitoring
- [ ] Cost tracking dashboards deployed
- [ ] DIP performance monitoring active
- [ ] Strategy effectiveness tracking
- [ ] Error rate monitoring for each strategy
- [ ] Evidence integrity monitoring

## Post-Deployment Validation
- [ ] Create DIPs for top 10 domains
- [ ] Verify cost savings vs. previous system
- [ ] Validate extraction quality maintained
- [ ] Confirm evidence ledger working
- [ ] Test strategy fallback chains
```

**Production Monitoring Setup**:
```javascript
// packages/worker/monitoring/production-monitor.js - NEW FILE
export class ProductionMonitor {
  async initializeProductionMonitoring() {
    // Set up CloudWatch custom metrics
    await this.setupCloudWatchMetrics();
    
    // Initialize cost tracking
    await this.initializeCostTracking();
    
    // Set up DIP performance monitoring
    await this.setupDIPMonitoring();
    
    // Configure alerts
    await this.configureAlerts();
    
    console.log('✅ Production monitoring initialized');
  }
  
  async setupCloudWatchMetrics() {
    const metrics = [
      'DIP.CreationTime',
      'DIP.CacheHitRate', 
      'Cost.PerExtraction',
      'Cost.DailySpend',
      'Strategy.SuccessRate',
      'Extraction.ResponseTime'
    ];
    
    for (const metric of metrics) {
      await this.createCustomMetric(metric);
    }
  }
  
  async reportProductionMetrics(domain, metrics) {
    // Report to CloudWatch
    await this.reportToCloudWatch(metrics);
    
    // Update real-time dashboard data
    await this.updateDashboardData(domain, metrics);
    
    // Check for anomalies
    await this.checkForAnomalies(domain, metrics);
  }
}
```

### Task 8.3: Documentation & Knowledge Transfer

**Complete Documentation Update**:
- [ ] Update README with DIP system overview
- [ ] Add DIP API reference to documentation
- [ ] Create cost optimization guide
- [ ] Document troubleshooting procedures
- [ ] Add performance tuning guide
- [ ] Create monitoring runbook

**Knowledge Transfer Materials**:
- [ ] DIP system architecture diagrams
- [ ] Cost optimization strategies guide  
- [ ] Evidence ledger verification procedures
- [ ] Production incident response procedures
- [ ] Strategy effectiveness analysis guide

**Acceptance Criteria**:
- [ ] Complete test suite with >90% coverage
- [ ] Performance benchmarks meeting targets
- [ ] Production deployment successful
- [ ] Cost monitoring and alerting functional
- [ ] Documentation updated and comprehensive
- [ ] System demonstrably reduces costs by 60%+
- [ ] Response times improved for known domains
- [ ] Evidence integrity verified

---

## 🎯 Sprint Success Metrics

### Key Performance Indicators

**Cost Optimization**:
- [ ] 60-80% reduction in extraction costs vs. current system
- [ ] <15% of requests using LLM extraction in production
- [ ] Average cost per extraction <$0.002

**Performance**:
- [ ] <3 second response time for domains with existing DIPs
- [ ] >95% success rate for all extraction strategies
- [ ] <60 second DIP creation time

**Intelligence**:
- [ ] DIPs created for 100% of processed domains
- [ ] >85% accuracy in optimal strategy selection
- [ ] Evidence integrity verified for 100% of extractions

**System Reliability**:
- [ ] Zero downtime during deployment
- [ ] <1% error rate in production
- [ ] Complete audit trail for all operations

---

## 🔄 Sprint Dependencies & Order

**Critical Path**:
1. **Sprint 0** → **Sprint 1** (Foundation must be solid)
2. **Sprint 1** → **Sprint 2** (Data models before analysis)
3. **Sprint 2** → **Sprint 3** (Analysis before strategy testing)
4. **Sprint 3** → **Sprint 4** (Strategy testing before DIP creation)
5. **Sprint 4** → **Sprint 5** (DIP creation before usage)
6. **Sprint 5** → **Sprint 6** (Usage before evidence)
7. **Sprint 6** → **Sprint 7** (Evidence before cost optimization)
8. **Sprint 7** → **Sprint 8** (All features before production)

**Parallel Work Opportunities**:
- Documentation can be written alongside development
- Frontend dashboard can be developed in parallel with backend
- Testing suites can be built alongside features

---

This plan ensures we build the DIP system methodically, with each sprint building on the previous one's foundation, ultimately creating an intelligent extraction system that learns and optimizes automatically while maintaining complete evidence and cost control.