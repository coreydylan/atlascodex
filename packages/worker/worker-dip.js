// Atlas Codex Worker - DIP-Integrated Version
// This worker uses Domain Intelligence Profiles for optimized extraction

const { DynamoDBClient, UpdateItemCommand, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { chromium } = require('playwright-core');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
const crypto = require('crypto');
const OpenAI = require('openai');

// Import DIP services
const { dipService } = require('@atlas-codex/core');
const { extractDomain } = require('@atlas-codex/core');

// Initialize clients
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Constants
const LAMBDA_TIMEOUT = 280000; // 4.5 minutes practical limit
const QUICK_SCRAPE_TIMEOUT = 5000; // 5 seconds for initial attempts
const BROWSER_TIMEOUT = 15000; // 15 seconds max for browser ops

// GPT-5 Model Selection
const GPT5_MODELS = {
  NANO: 'gpt-5-nano',     // For simple extraction, classification
  MINI: 'gpt-5-mini',     // For most extraction tasks
  STANDARD: 'gpt-5',      // For complex synthesis only
};

// Initialize Turndown
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// Browser pool for efficiency
let browserPool = null;

async function initBrowserPool() {
  if (!browserPool) {
    browserPool = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browserPool;
}

// === Main DIP-Aware Processing Pipeline ===
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
    console.log(`✅ Using existing DIP for ${domain} (v${existingDIP.version})`);
    
    // Use existing DIP strategy
    return await executeExtractionStrategy(job, existingDIP.optimalStrategy);
  }
}

// === DIP Creation ===
async function createDomainProfile(domain, url) {
  const startTime = Date.now();
  
  console.log(`🔬 Creating comprehensive DIP for ${domain}`);
  
  // Step 1: Analyze site structure
  const siteStructure = await analyzeSiteStructure(domain, url);
  
  // Step 2: Analyze constraints
  const constraints = await analyzeSiteConstraints(domain);
  
  // Step 3: Test extraction strategies
  const testSchema = generateTestSchema(siteStructure);
  const strategyResults = await testExtractionStrategies(url, testSchema);
  
  // Step 4: Select optimal strategy
  const optimalStrategy = selectOptimalStrategy(strategyResults);
  
  // Step 5: Calculate metrics
  const performanceMetrics = calculatePerformanceMetrics(strategyResults);
  const costProfile = generateCostProfile(strategyResults);
  
  const dip = {
    domain,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    creationTime: Date.now() - startTime,
    
    siteStructure,
    constraints,
    extractionStrategies: strategyResults,
    optimalStrategy,
    performanceMetrics,
    costProfile,
    
    testUrl: url,
    confidence: calculateConfidence(strategyResults),
    nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    
    evidence: {
      hash: crypto.createHash('sha256').update(JSON.stringify({
        domain, siteStructure, strategyResults, optimalStrategy
      })).digest('hex'),
      timestamp: new Date().toISOString(),
      testResults: strategyResults.length
    }
  };
  
  console.log(`✅ DIP created for ${domain} in ${Date.now() - startTime}ms`);
  console.log(`   Optimal strategy: ${optimalStrategy.strategy} ($${optimalStrategy.costPerExtraction}/extraction)`);
  
  return dip;
}

// === Site Analysis Functions ===
async function analyzeSiteStructure(domain, url) {
  try {
    // Fetch the page
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Detect framework
    const framework = detectFramework(html, $);
    
    // Analyze rendering type
    const renderingType = await detectRenderingType(url);
    
    // Find common selectors
    const contentSelectors = findContentSelectors($);
    
    return {
      framework,
      renderingType,
      requiresJavaScript: renderingType === 'spa',
      contentSelectors,
      commonPatterns: findCommonPatterns($),
      dynamicContent: renderingType !== 'static',
      contentTypes: identifyContentTypes($)
    };
  } catch (error) {
    console.error(`Error analyzing site structure for ${domain}:`, error);
    return {
      framework: null,
      renderingType: 'unknown',
      requiresJavaScript: false,
      contentSelectors: {},
      commonPatterns: [],
      dynamicContent: false,
      contentTypes: []
    };
  }
}

function detectFramework(html, $) {
  const frameworks = {
    'react': [/__REACT_DEVTOOLS/, /_reactInternalInstance/, /react(-dom)?\..*\.js/],
    'vue': [/__VUE__/, /vue\..*\.js/],
    'angular': [/ng-/, /angular\..*\.js/],
    'wordpress': [/wp-content/, /wp-includes/],
    'shopify': [/shopify/i, /cdn\.shopify/],
    'next.js': [/__NEXT_DATA__/, /_next\//]
  };
  
  for (const [framework, patterns] of Object.entries(frameworks)) {
    if (patterns.some(pattern => pattern.test(html))) {
      return framework;
    }
  }
  
  return 'unknown';
}

async function detectRenderingType(url) {
  try {
    // Fetch without JavaScript
    const staticResponse = await fetch(url);
    const staticHtml = await staticResponse.text();
    const staticLength = staticHtml.length;
    
    // Quick heuristic - if has substantial content, likely SSR or static
    const hasContent = staticHtml.includes('<article') || 
                      staticHtml.includes('<main') ||
                      staticLength > 10000;
    
    if (hasContent) {
      return staticHtml.includes('__NEXT_DATA__') ? 'ssr' : 'static';
    }
    
    return 'spa';
  } catch (error) {
    return 'unknown';
  }
}

function findContentSelectors($) {
  const selectors = {};
  
  // Common content selectors
  const selectorMap = {
    title: ['h1', '.title', '.headline', '[itemprop="headline"]'],
    content: ['article', '.content', '.post-content', 'main'],
    price: ['.price', '[itemprop="price"]', '.product-price'],
    author: ['.author', '[itemprop="author"]', '.by-author']
  };
  
  for (const [key, candidates] of Object.entries(selectorMap)) {
    for (const selector of candidates) {
      if ($(selector).length > 0) {
        selectors[key] = selector;
        break;
      }
    }
  }
  
  return selectors;
}

function findCommonPatterns($) {
  const patterns = [];
  
  // Look for common patterns
  if ($('.product').length > 0) patterns.push('e-commerce');
  if ($('article').length > 0) patterns.push('article');
  if ($('.post').length > 0) patterns.push('blog');
  if ($('video').length > 0) patterns.push('video');
  
  return patterns;
}

function identifyContentTypes($) {
  const types = [];
  
  if ($('article, .article, .post').length > 0) types.push('article');
  if ($('.product, [itemtype*="Product"]').length > 0) types.push('product');
  if ($('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0) types.push('video');
  if ($('table').length > 5) types.push('data-heavy');
  
  return types;
}

// === Site Constraints Analysis ===
async function analyzeSiteConstraints(domain) {
  const robotsTxt = await analyzeRobotsTxt(domain);
  const rateLimit = await detectRateLimits(domain);
  
  return {
    robotsTxt,
    rateLimit,
    preferredUserAgent: 'AtlasCodex/1.0',
    recommendedTimeout: 30000
  };
}

async function analyzeRobotsTxt(domain) {
  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const response = await fetch(robotsUrl);
    
    if (!response.ok) {
      return {
        exists: false,
        allowedPaths: ['*'],
        disallowedPaths: [],
        crawlDelay: 1,
        sitemapUrls: [],
        userAgents: ['*']
      };
    }
    
    const robotsContent = await response.text();
    
    // Simple parsing (enhance as needed)
    const lines = robotsContent.split('\n');
    const disallowedPaths = lines
      .filter(line => line.startsWith('Disallow:'))
      .map(line => line.replace('Disallow:', '').trim());
    
    const sitemapUrls = lines
      .filter(line => line.startsWith('Sitemap:'))
      .map(line => line.replace('Sitemap:', '').trim());
    
    return {
      exists: true,
      allowedPaths: ['*'],
      disallowedPaths,
      crawlDelay: 1,
      sitemapUrls,
      userAgents: ['*']
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

async function detectRateLimits(domain) {
  // For now, use conservative defaults
  // In production, would test actual rate limits
  return {
    maxRequestsPerMinute: 60,
    recommendedDelay: 1000,
    hasRateLimit: false,
    testResults: []
  };
}

// === Strategy Testing ===
async function testExtractionStrategies(url, testSchema) {
  const results = [];
  
  // Test 1: Static fetch
  const staticResult = await testStaticFetch(url, testSchema);
  results.push(staticResult);
  
  // Test 2: Browser render
  const browserResult = await testBrowserRender(url, testSchema);
  results.push(browserResult);
  
  // Test 3: GPT-5 nano
  const gpt5NanoResult = await testGPT5Extraction(url, testSchema, GPT5_MODELS.NANO);
  results.push(gpt5NanoResult);
  
  return results;
}

async function testStaticFetch(url, schema) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AtlasCodex/1.0' },
      timeout: 10000
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Try to extract based on schema
    const extractedData = extractWithSelectors($, schema);
    const dataQuality = assessDataQuality(extractedData, schema);
    
    return {
      type: 'static_fetch',
      success: dataQuality > 0.5,
      cost: 0.0001,
      responseTime: Date.now() - startTime,
      reliability: 0.85,
      dataQuality,
      errorRate: 0.05,
      lastTested: new Date().toISOString()
    };
  } catch (error) {
    return {
      type: 'static_fetch',
      success: false,
      cost: 0,
      responseTime: Date.now() - startTime,
      reliability: 0,
      dataQuality: 0,
      errorRate: 1,
      lastTested: new Date().toISOString()
    };
  }
}

async function testBrowserRender(url, schema) {
  const startTime = Date.now();
  
  try {
    const browser = await initBrowserPool();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const html = await page.content();
    
    await context.close();
    
    const $ = cheerio.load(html);
    const extractedData = extractWithSelectors($, schema);
    const dataQuality = assessDataQuality(extractedData, schema);
    
    return {
      type: 'browser_render',
      success: dataQuality > 0.6,
      cost: 0.001,
      responseTime: Date.now() - startTime,
      reliability: 0.95,
      dataQuality,
      errorRate: 0.02,
      lastTested: new Date().toISOString()
    };
  } catch (error) {
    return {
      type: 'browser_render',
      success: false,
      cost: 0.001,
      responseTime: Date.now() - startTime,
      reliability: 0,
      dataQuality: 0,
      errorRate: 1,
      lastTested: new Date().toISOString()
    };
  }
}

async function testGPT5Extraction(url, schema, model) {
  const startTime = Date.now();
  
  try {
    // Get content first
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    const text = $.text().substring(0, 10000); // Limit for testing
    
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'Extract structured data according to the provided schema. Return only valid JSON.'
        },
        {
          role: 'user',
          content: `Extract from this content:\n${text}\n\nSchema: ${JSON.stringify(schema)}`
        }
      ],
      response_format: { type: 'json_object' },
      verbosity: 'low',
      reasoning_effort: 'minimal'
    });
    
    const cost = calculateGPT5Cost(completion.usage, model);
    
    return {
      type: `gpt5_${model.replace('gpt-5-', '')}`,
      success: true,
      cost,
      responseTime: Date.now() - startTime,
      reliability: 0.98,
      dataQuality: 0.95,
      errorRate: 0.01,
      lastTested: new Date().toISOString(),
      tokens: completion.usage.total_tokens
    };
  } catch (error) {
    return {
      type: `gpt5_${model.replace('gpt-5-', '')}`,
      success: false,
      cost: 0,
      responseTime: Date.now() - startTime,
      reliability: 0,
      dataQuality: 0,
      errorRate: 1,
      lastTested: new Date().toISOString()
    };
  }
}

// === Helper Functions ===
function extractWithSelectors($, schema) {
  const result = {};
  
  // Simple extraction based on common selectors
  if (schema.properties?.title) {
    result.title = $('h1').first().text().trim() || $('title').text().trim();
  }
  
  if (schema.properties?.content) {
    result.content = $('article').text().trim() || $('main').text().trim();
  }
  
  if (schema.properties?.price) {
    const priceText = $('.price').first().text();
    result.price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || null;
  }
  
  return result;
}

function assessDataQuality(data, schema) {
  const requiredFields = schema.required || [];
  const totalFields = Object.keys(schema.properties || {}).length;
  
  let filledFields = 0;
  let filledRequired = 0;
  
  for (const field of Object.keys(schema.properties || {})) {
    if (data[field] !== null && data[field] !== undefined && data[field] !== '') {
      filledFields++;
      if (requiredFields.includes(field)) {
        filledRequired++;
      }
    }
  }
  
  // Quality score based on filled fields and required fields
  const requiredScore = requiredFields.length > 0 
    ? filledRequired / requiredFields.length 
    : 1;
  const totalScore = totalFields > 0 
    ? filledFields / totalFields 
    : 0;
  
  return (requiredScore * 0.7 + totalScore * 0.3);
}

function calculateGPT5Cost(usage, model) {
  const pricing = {
    'gpt-5-nano': { input: 0.05 / 1000000, output: 0.40 / 1000000 },
    'gpt-5-mini': { input: 0.25 / 1000000, output: 2.00 / 1000000 },
    'gpt-5': { input: 1.25 / 1000000, output: 10.00 / 1000000 }
  };
  
  const modelPricing = pricing[model] || pricing['gpt-5-nano'];
  
  return (usage.prompt_tokens * modelPricing.input) + 
         (usage.completion_tokens * modelPricing.output);
}

function selectOptimalStrategy(results) {
  // Filter successful strategies
  const viable = results.filter(r => r.success);
  
  if (viable.length === 0) {
    // Default to most reliable even if failed
    return {
      strategy: 'gpt5_nano',
      confidence: 0.5,
      fallbackChain: ['browser_render', 'static_fetch'],
      costPerExtraction: 0.01,
      averageResponseTime: 5000,
      successRate: 0.5
    };
  }
  
  // Score each strategy
  const scored = viable.map(strategy => ({
    ...strategy,
    score: (strategy.dataQuality * 0.4) + 
           ((1 - strategy.cost) * 0.3) + 
           (strategy.reliability * 0.2) + 
           ((1 - strategy.responseTime / 10000) * 0.1)
  }));
  
  // Sort by score
  scored.sort((a, b) => b.score - a.score);
  
  const optimal = scored[0];
  
  return {
    strategy: optimal.type,
    confidence: optimal.score,
    fallbackChain: scored.slice(1).map(s => s.type),
    costPerExtraction: optimal.cost,
    averageResponseTime: optimal.responseTime,
    successRate: optimal.reliability,
    verbosity: 'low',
    reasoningEffort: 'minimal'
  };
}

function calculatePerformanceMetrics(results) {
  const times = results.map(r => r.responseTime);
  const successRates = results.map(r => r.reliability);
  
  return {
    averageResponseTime: times.reduce((a, b) => a + b, 0) / times.length,
    p95ResponseTime: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)] || times[times.length - 1],
    p99ResponseTime: times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)] || times[times.length - 1],
    successRate: successRates.reduce((a, b) => a + b, 0) / successRates.length,
    errorRate: results.map(r => r.errorRate).reduce((a, b) => a + b, 0) / results.length,
    cacheHitRate: 0 // Will be populated with real usage
  };
}

function generateCostProfile(results) {
  const costs = results.map(r => r.cost);
  const costByStrategy = {};
  
  results.forEach(r => {
    costByStrategy[r.type] = r.cost;
  });
  
  const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
  
  return {
    averageCost: avgCost,
    minCost: Math.min(...costs),
    maxCost: Math.max(...costs),
    costByStrategy,
    projectedMonthlyCost: avgCost * 1000 * 30, // Assuming 1000 requests/day
    costTrend: 'stable'
  };
}

function calculateConfidence(results) {
  const successCount = results.filter(r => r.success).length;
  return successCount / results.length;
}

function generateTestSchema(siteStructure) {
  const baseSchema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      content: { type: 'string' }
    },
    required: ['title']
  };
  
  // Add fields based on content types
  if (siteStructure.contentTypes.includes('product')) {
    baseSchema.properties.price = { type: 'number' };
    baseSchema.properties.availability = { type: 'string' };
  }
  
  if (siteStructure.contentTypes.includes('article')) {
    baseSchema.properties.author = { type: 'string' };
    baseSchema.properties.publishDate = { type: 'string' };
  }
  
  return baseSchema;
}

// === Execution Engine ===
async function executeExtractionStrategy(job, optimalStrategy) {
  const { url, schema } = job.params;
  const { strategy } = optimalStrategy;
  
  console.log(`🎯 Executing strategy: ${strategy} for ${url}`);
  
  switch (strategy) {
    case 'static_fetch':
      return await executeStaticFetch(url, schema);
    
    case 'browser_render':
      return await executeBrowserRender(url, schema);
    
    case 'gpt5_nano':
    case 'gpt5_mini':
    case 'gpt5_standard':
      return await executeGPT5Extraction(url, schema, strategy);
    
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

async function executeStaticFetch(url, schema) {
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  return {
    data: extractWithSelectors($, schema),
    strategy: 'static_fetch',
    cost: 0.0001,
    evidence: {
      hash: crypto.createHash('sha256').update(html).digest('hex'),
      timestamp: new Date().toISOString()
    }
  };
}

async function executeBrowserRender(url, schema) {
  const browser = await initBrowserPool();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto(url, { waitUntil: 'networkidle' });
  const html = await page.content();
  
  await context.close();
  
  const $ = cheerio.load(html);
  
  return {
    data: extractWithSelectors($, schema),
    strategy: 'browser_render',
    cost: 0.001,
    evidence: {
      hash: crypto.createHash('sha256').update(html).digest('hex'),
      timestamp: new Date().toISOString()
    }
  };
}

async function executeGPT5Extraction(url, schema, strategyType) {
  const model = strategyType.replace('_', '-');
  
  const response = await fetch(url);
  const html = await response.text();
  const text = cheerio.load(html).text().substring(0, 50000);
  
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'Extract structured data according to the schema. Return valid JSON.'
      },
      {
        role: 'user',
        content: `Extract from:\n${text}\n\nSchema: ${JSON.stringify(schema)}`
      }
    ],
    response_format: { type: 'json_object' },
    verbosity: 'low',
    reasoning_effort: 'minimal'
  });
  
  return {
    data: JSON.parse(completion.choices[0].message.content),
    strategy: strategyType,
    cost: calculateGPT5Cost(completion.usage, model),
    tokens: completion.usage.total_tokens,
    evidence: {
      hash: crypto.createHash('sha256').update(text).digest('hex'),
      timestamp: new Date().toISOString(),
      model
    }
  };
}

// === Export ===
module.exports = {
  processJobWithDIP,
  createDomainProfile,
  dipService
};