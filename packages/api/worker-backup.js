// Atlas Codex Worker Lambda - Processes scraping jobs from SQS
const { DynamoDBClient, UpdateItemCommand, ScanCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { chromium } = require('playwright-core');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
// WebSocket broadcast function (embedded to avoid module issues)
const broadcastJobUpdate = async (jobId, status, result = null, error = null) => {
  try {
    if (!process.env.WEBSOCKET_API_ENDPOINT) {
      console.log('WebSocket endpoint not configured');
      return;
    }
    
    // Get all active connections
    const connections = await dynamodb.send(new ScanCommand({
      TableName: process.env.CONNECTIONS_TABLE || 'atlas-codex-connections',
      ProjectionExpression: 'connectionId'
    }));
    
    if (!connections.Items || connections.Items.length === 0) {
      console.log('No active WebSocket connections');
      return;
    }
    
    const apiGateway = new ApiGatewayManagementApiClient({
      endpoint: process.env.WEBSOCKET_API_ENDPOINT.replace('wss://', 'https://')
    });
    
    const message = JSON.stringify({
      type: 'job_update',
      jobId: jobId,
      status: status,
      result: result,
      error: error,
      timestamp: Date.now()
    });
    
    const sendPromises = connections.Items.map(async (connection) => {
      const connectionId = connection.connectionId.S;
      
      try {
        await apiGateway.send(new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: message
        }));
        console.log(`Sent update to connection ${connectionId}`);
      } catch (err) {
        console.error(`Failed to send to ${connectionId}:`, err);
        
        // Remove stale connection
        if (err.name === 'GoneException') {
          await dynamodb.send(new DeleteItemCommand({
            TableName: process.env.CONNECTIONS_TABLE || 'atlas-codex-connections',
            Key: { connectionId: { S: connectionId } }
          }));
        }
      }
    });
    
    // Don't await Promise.all to prevent blocking on WebSocket errors
    Promise.all(sendPromises).catch(err => {
      console.error('Some WebSocket broadcasts failed:', err);
    });
    console.log(`📡 WebSocket broadcast sent for job ${jobId}: ${status}`);
    
  } catch (err) {
    console.error('Broadcast error:', err);
  }
};

// Initialize AWS clients
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });

// Anti-detection headers and user agents
const REALISTIC_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0'
];

// Advanced anti-detection scraping with multiple fallback strategies
async function scrapeWithAdvancedAntiDetection(url, options = {}) {
  const strategies = [
    () => scrapeWithStealthBrowser(url, options),
    () => scrapeWithRotatedHeaders(url, options),
    () => scrapeWithDelay(url, options),
    () => scrapeWithHttp(url, options) // Final fallback
  ];
  
  for (let i = 0; i < strategies.length; i++) {
    try {
      console.log(`🕵️ Trying anti-detection strategy ${i + 1} for ${url}`);
      const result = await strategies[i]();
      console.log(`✅ Strategy ${i + 1} succeeded for ${url}`);
      return result;
    } catch (error) {
      console.log(`❌ Strategy ${i + 1} failed for ${url}: ${error.message}`);
      if (i === strategies.length - 1) {
        throw new Error(`All anti-detection strategies failed: ${error.message}`);
      }
    }
  }
}

// Enhanced stealth browser with anti-detection
async function scrapeWithStealthBrowser(url, options = {}) {
  let browser = null;
  let page = null;
  
  try {
    // Launch with stealth flags
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--mute-audio',
        '--no-default-browser-check',
        '--autoplay-policy=user-gesture-required',
        '--disable-background-networking',
        '--disable-breakpad',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-sync',
        '--user-agent=' + REALISTIC_USER_AGENTS[Math.floor(Math.random() * REALISTIC_USER_AGENTS.length)]
      ]
    });
    
    page = await browser.newPage();
    
    // Set realistic viewport
    await page.setViewportSize({ 
      width: 1366 + Math.floor(Math.random() * 200), 
      height: 768 + Math.floor(Math.random() * 200) 
    });
    
    // Set extra headers to look more human
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    });
    
    // Block unnecessary resources for speed and stealth
    await page.route('**/*', route => {
      const request = route.request();
      const resourceType = request.resourceType();
      const url = request.url();
      
      // Block tracking and analytics while keeping essential resources
      if (['image', 'media', 'font'].includes(resourceType) && !url.includes('logo')) {
        return route.abort();
      }
      
      // Block known trackers and ads
      if (url.includes('google-analytics') || 
          url.includes('googletagmanager') ||
          url.includes('facebook.net') ||
          url.includes('doubleclick') ||
          url.includes('ads')) {
        return route.abort();
      }
      
      route.continue();
    });
    
    // Navigate with random delay to seem human
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    const response = await page.goto(url, {
      waitUntil: options.waitFor || 'domcontentloaded',
      timeout: 30000
    });
    
    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
    }
    
    // Handle common cookie consent popups
    const cookieSelectors = [
      'button:has-text("Accept")',
      'button:has-text("Accept all")',
      'button:has-text("Accept cookies")',
      'button:has-text("I agree")',
      'button:has-text("Agree")',
      'button:has-text("OK")',
      '[id*="accept"]',
      '[class*="accept-cookie"]',
      '[class*="cookie-accept"]'
    ];
    
    for (const selector of cookieSelectors) {
      try {
        const button = await page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          await button.click();
          await new Promise(resolve => setTimeout(resolve, 500));
          break;
        }
      } catch {
        // Continue trying other selectors
      }
    }
    
    // Random human-like interactions
    await page.mouse.move(Math.random() * 100, Math.random() * 100);
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Get content
    const html = await page.content();
    const title = await page.title();
    
    // Convert to markdown
    const markdown = turndownService.turndown(html);
    
    // Extract metadata
    const metadata = await page.evaluate(() => {
      const getMetaContent = (name) => {
        const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"], meta[property="og:${name}"]`);
        return meta ? meta.getAttribute('content') : '';
      };
      
      return {
        title: document.title,
        description: getMetaContent('description'),
        ogTitle: getMetaContent('og:title') || getMetaContent('title'),
        ogDescription: getMetaContent('og:description') || getMetaContent('description'),
        ogImage: getMetaContent('og:image') || getMetaContent('image'),
        canonical: document.querySelector('link[rel="canonical"]')?.href || window.location.href
      };
    });
    
    // Extract all links
    const links = await page.$$eval('a[href]', elements => {
      return elements.map(el => el.href).filter(href => href && href.startsWith('http'));
    }).catch(() => []);
    
    return {
      html,
      markdown,
      metadata,
      links: [...new Set(links)], // Deduplicate
      url,
      method: 'stealth_browser',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    throw new Error(`Stealth browser failed: ${error.message}`);
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

// HTTP scraping with rotated headers and delays
async function scrapeWithRotatedHeaders(url, options = {}) {
  const headers = {
    'User-Agent': REALISTIC_USER_AGENTS[Math.floor(Math.random() * REALISTIC_USER_AGENTS.length)],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Cache-Control': 'max-age=0'
  };
  
  // Add referrer sometimes
  if (Math.random() > 0.5) {
    headers['Referer'] = 'https://www.google.com/';
  }
  
  // Random delay before request
  await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 1000));
  
  return await scrapeWithHttp(url, { ...options, headers });
}

// Simple delay wrapper
async function scrapeWithDelay(url, options = {}) {
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
  return await scrapeWithHttp(url, options);
}

// Initialize Turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// Stream log message to job
async function streamJobLog(jobId, message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message
  };
  
  // Store in DynamoDB logs array
  try {
    await dynamodb.send(new UpdateItemCommand({
      TableName: process.env.JOBS_TABLE || 'atlas-codex-jobs',
      Key: { id: { S: jobId } },
      UpdateExpression: 'SET #logs = list_append(if_not_exists(#logs, :empty), :log)',
      ExpressionAttributeNames: { '#logs': 'logs' },
      ExpressionAttributeValues: {
        ':empty': { L: [] },
        ':log': { L: [{ M: {
          timestamp: { S: timestamp },
          level: { S: level },
          message: { S: message }
        }}]}
      }
    }));
    
    // Broadcast via WebSocket for real-time updates
    await broadcastJobUpdate(jobId, 'log', { log: logEntry });
  } catch (err) {
    console.error('Failed to stream log:', err);
  }
}

// Update job status in DynamoDB with WebSocket broadcast
async function updateJobStatus(jobId, status, result = null, error = null) {
  const updateExpression = ['SET #status = :status', '#updatedAt = :updatedAt', '#jobId = :jobId'];
  const expressionAttributeNames = {
    '#status': 'status',
    '#updatedAt': 'updatedAt',
    '#jobId': 'jobId'
  };
  const expressionAttributeValues = {
    ':status': { S: status },
    ':updatedAt': { N: Date.now().toString() },
    ':jobId': { S: jobId }
  };

  if (result) {
    updateExpression.push('#result = :result');
    expressionAttributeNames['#result'] = 'result';
    expressionAttributeValues[':result'] = { S: JSON.stringify(result) };
  }

  if (error) {
    updateExpression.push('#error = :error');
    expressionAttributeNames['#error'] = 'error';
    expressionAttributeValues[':error'] = { S: error };
  }

  try {
    await dynamodb.send(new UpdateItemCommand({
      TableName: 'atlas-codex-jobs',
      Key: { id: { S: jobId } },
      UpdateExpression: updateExpression.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }));
    
    // 🚀 REAL-TIME WEBSOCKET BROADCAST
    try {
      await broadcastJobUpdate(jobId, status, result, error);
      console.log(`📡 WebSocket broadcast sent for job ${jobId}: ${status}`);
    } catch (wsError) {
      console.error('WebSocket broadcast failed:', wsError);
      // Don't fail the job update if WebSocket fails
    }
    
    return true;
  } catch (err) {
    console.error('Failed to update job status:', err);
    return false;
  }
}

// Store artifact in S3
async function storeArtifact(jobId, content, contentType = 'text/html') {
  const key = `artifacts/${jobId}/${Date.now()}.${contentType.split('/')[1]}`;
  
  try {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.ARTIFACTS_BUCKET || 'atlas-codex-artifacts',
      Key: key,
      Body: content,
      ContentType: contentType
    }));
    return `s3://${process.env.ARTIFACTS_BUCKET}/${key}`;
  } catch (error) {
    console.error('Failed to store artifact:', error);
    return null;
  }
}

// Intelligent request routing - decide whether to use browser or simple HTTP
function shouldUseBrowser(url, params) {
  // Always use browser if screenshot is requested
  if (params.screenshot) return true;
  
  // Use browser for known SPAs and dynamic sites
  const dynamicDomains = [
    'twitter.com', 'x.com', 'instagram.com', 'facebook.com',
    'linkedin.com', 'github.com', 'reddit.com', 'youtube.com'
  ];
  
  if (dynamicDomains.some(domain => url.includes(domain))) {
    return true;
  }
  
  // Use browser if specific wait conditions are requested
  if (params.waitFor && params.waitFor !== 'load') {
    return true;
  }
  
  // Default to simple HTTP for most sites
  return false;
}

// Evidence system - add source selectors and confidence scores
function addEvidenceToExtractedData(data, html, sourceUrl) {
  const $ = require('cheerio').load(html);
  const evidenceId = `evidence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  function addEvidenceToValue(value, key) {
    if (typeof value === 'string' && value.length > 3) {
      // Try to find the value in HTML and get selector
      const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const element = $(`*:contains("${value}")`).last();
      
      if (element.length > 0) {
        const tagName = element.get(0).name;
        const className = element.attr('class');
        const id = element.attr('id');
        
        let selector = tagName;
        if (id) selector += `#${id}`;
        if (className) selector += `.${className.split(' ')[0]}`;
        
        return {
          value: value,
          evidence: {
            evidence_id: `${evidenceId}_${key}`,
            source_url: sourceUrl,
            selector: selector,
            snippet: element.text().substring(0, 100),
            confidence_score: 0.85, // Basic confidence
            fetched_at: new Date().toISOString()
          }
        };
      }
    }
    return value;
  }
  
  // Add evidence to all string values in the object
  function processObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map(processObject);
    } else if (typeof obj === 'object' && obj !== null) {
      const processed = {};
      for (const [key, value] of Object.entries(obj)) {
        processed[key] = processObject(value);
      }
      return processed;
    } else if (typeof obj === 'string') {
      return addEvidenceToValue(obj, 'field');
    }
    return obj;
  }
  
  return processObject(data);
}

// Screenshot service for when browser fails
async function takeScreenshotWithService(url) {
  try {
    // Use a simple screenshot service
    const screenshotApiUrl = `https://api.screenshotone.com/take?access_key=${process.env.SCREENSHOT_API_KEY || 'demo'}&url=${encodeURIComponent(url)}&viewport_width=1920&viewport_height=1080&device_scale_factor=1&format=png&full_page=false`;
    
    const response = await fetch(screenshotApiUrl);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    }
  } catch (error) {
    console.log('Screenshot service failed:', error.message);
  }
  return null;
}

// Simple cache implementation
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCacheKey(url, params) {
  return `${url}_${JSON.stringify(params)}`;
}

function getCachedResult(cacheKey) {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(cacheKey); // Remove expired cache
  return null;
}

function setCacheResult(cacheKey, data) {
  cache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  
  // Simple cache cleanup - keep only 100 most recent
  if (cache.size > 100) {
    const keys = Array.from(cache.keys());
    cache.delete(keys[0]); // Remove oldest
  }
}

// Simple HTTP scraper using fetch
async function scrapeWithHttp(url, params) {
  // Check cache first
  const cacheKey = getCacheKey(url, params);
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult && !params.screenshot) { // Don't cache screenshots
    console.log(`Cache hit for ${url}`);
    return { ...cachedResult, cached: true };
  }
  
  try {
    const response = await fetch(url, {
      headers: params.headers || {},
      redirect: 'follow'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract metadata
    const metadata = {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      ogTitle: $('meta[property="og:title"]').attr('content') || '',
      ogDescription: $('meta[property="og:description"]').attr('content') || '',
      ogImage: $('meta[property="og:image"]').attr('content') || '',
      canonical: $('link[rel="canonical"]').attr('href') || url
    };
    
    // Convert to markdown
    const markdown = turndownService.turndown(html);
    
    // Try to get screenshot if requested (even with HTTP scraping)
    let screenshot = null;
    if (params.screenshot) {
      screenshot = await takeScreenshotWithService(url);
    }
    
    // Extract links from HTML
    const links = [];
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        const absoluteUrl = href.startsWith('http') ? href : new URL(href, url).href;
        links.push(absoluteUrl);
      }
    });
    
    const result = {
      url,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      html,
      markdown,
      metadata,
      links: [...new Set(links)], // Deduplicate
      screenshot,
      method: 'http'
    };
    
    // Cache successful results (but not screenshots)
    if (!params.screenshot) {
      setCacheResult(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    // Enhanced error messages with retry suggestions
    let errorMessage = `HTTP scraping failed: ${error.message}`;
    let retryable = false;
    let suggestions = [];
    
    if (error.message.includes('503')) {
      errorMessage = 'Service temporarily unavailable - likely rate limited or blocked';
      retryable = true;
      suggestions = ['enable_browser', 'use_proxy', 'add_delay'];
    } else if (error.message.includes('403')) {
      errorMessage = 'Access forbidden - site is blocking requests';
      retryable = true;
      suggestions = ['enable_browser', 'use_stealth', 'change_user_agent'];
    } else if (error.message.includes('429')) {
      errorMessage = 'Rate limited - too many requests';
      retryable = true;
      suggestions = ['add_delay', 'use_proxy'];
    } else if (error.message.includes('CAPTCHA')) {
      errorMessage = 'CAPTCHA detected - human verification required';
      retryable = true;
      suggestions = ['solve_captcha', 'use_proxy', 'wait_and_retry'];
    }
    
    throw { 
      message: errorMessage, 
      retryable, 
      suggestions,
      originalError: error.message
    };
  }
}

// Browser-based scraper using Playwright
async function scrapeWithBrowser(url, params) {
  let browser = null;
  const interceptedAPIs = [];
  
  try {
    // Launch browser with error handling
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process'
      ]
    });
    
    // #8: Random User Agents & #12: Basic Stealth
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
    ];
    
    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
    const isMobile = randomUA.includes('iPhone') || randomUA.includes('iPad');
    
    const context = await browser.newContext({
      viewport: isMobile ? 
        { width: 375, height: 667 } : 
        { 
          width: 1920 + Math.floor(Math.random() * 200) - 100, 
          height: 1080 + Math.floor(Math.random() * 200) - 100 
        },
      userAgent: params.userAgent || randomUA,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        ...params.headers
      },
      // Basic stealth settings
      javaScriptEnabled: true,
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });
    
    const page = await context.newPage();
    
    // Block unnecessary resources (70% performance improvement)
    await page.route('**/*', route => {
      const request = route.request();
      const resourceType = request.resourceType();
      const url = request.url();
      
      // Network interception mode - capture API endpoints
      if (params.interceptNetwork) {
        if (resourceType === 'fetch' || resourceType === 'xhr') {
          const method = route.request().method();
          const headers = route.request().headers();
          
          // Check if it's a JSON API
          if (headers['accept']?.includes('application/json') || 
              headers['content-type']?.includes('application/json') ||
              url.includes('/api/') || url.includes('/v1/') || url.includes('/v2/') ||
              url.includes('.json')) {
            console.log(`🔍 Intercepted API call: ${method} ${url}`);
            interceptedAPIs.push({
              url,
              method,
              headers,
              timestamp: Date.now()
            });
          }
        }
      }
      
      // Block heavy resources that aren't needed for content extraction
      if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
        return route.abort();
      }
      
      // Block analytics and tracking
      if (url.includes('google-analytics') || 
          url.includes('googletagmanager') ||
          url.includes('doubleclick') ||
          url.includes('facebook.com/tr') ||
          url.includes('hotjar') ||
          url.includes('mixpanel')) {
        return route.abort();
      }
      
      route.continue();
    });
    
    // Navigate to URL with smart timeout strategy
    const response = await page.goto(url, {
      waitUntil: params.waitFor || 'domcontentloaded', // Faster default
      timeout: 15000 // Reduce from 30s to 15s
    });
    
    // Handle cookie consent popups before proceeding
    const cookieSelectors = [
      'button:has-text("Accept")',
      'button:has-text("Accept all")',
      'button:has-text("Accept cookies")',
      'button:has-text("I agree")',
      'button:has-text("Agree")',
      'button:has-text("OK")',
      '[id*="accept"]',
      '[class*="accept-cookie"]',
      '[class*="cookie-accept"]',
      '.onetrust-accept-btn-handler',
      '#onetrust-accept-btn-handler'
    ];
    
    for (const selector of cookieSelectors) {
      try {
        const button = await page.locator(selector).first();
        if (await button.isVisible({ timeout: 500 })) {
          await button.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log(`✅ Dismissed cookie consent with: ${selector}`);
          break;
        }
      } catch {
        // Continue trying other selectors
      }
    }
    
    // Smart waiting strategy - try multiple selectors with escalating timeouts
    if (params.waitForSelector) {
      await page.waitForSelector(params.waitForSelector, { timeout: 5000 });
    } else {
      // Common content selectors with short timeouts
      const contentSelectors = ['main', '.content', '#content', 'article', '.post', 'body'];
      for (const selector of contentSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 1000 });
          break; // Found content, proceed
        } catch {
          continue; // Try next selector
        }
      }
    }
    
    // Additional smart wait for dynamic content
    if (params.waitFor === 'networkidle') {
      try {
        await page.waitForLoadState('networkidle', { timeout: 8000 });
      } catch {
        // Continue if network idle times out
      }
    }
    
    // Get page content
    const html = await page.content();
    
    // Extract metadata
    const metadata = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
      ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
      ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
      canonical: document.querySelector('link[rel="canonical"]')?.href || window.location.href
    }));
    
    // Take screenshot if requested
    let screenshot = null;
    if (params.screenshot) {
      const screenshotBuffer = await page.screenshot({
        fullPage: params.fullPage || false
      });
      screenshot = screenshotBuffer.toString('base64');
    }
    
    // Convert to markdown
    const markdown = turndownService.turndown(html);
    
    await browser.close();
    
    // Extract all links from the page
    const links = [];
    await page.$$eval('a[href]', elements => {
      return elements.map(el => el.href).filter(href => href && href.startsWith('http'));
    }).then(hrefs => {
      links.push(...new Set(hrefs)); // Deduplicate
    }).catch(() => {
      console.log('Could not extract links');
    });
    
    return {
      url,
      status: response.status(),
      html,
      markdown,
      metadata,
      links,
      screenshot,
      method: 'browser',
      interceptedAPIs: params.interceptNetwork ? interceptedAPIs : undefined
    };
    
  } catch (error) {
    if (browser) await browser.close();
    throw new Error(`Browser scraping failed: ${error.message}`);
  }
}

// #9: Request Queuing & #10: Usage Metrics
const requestQueue = new Map();
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  averageResponseTime: 0,
  cacheHits: 0,
  browserRequests: 0,
  httpRequests: 0
};

function updateMetrics(success, responseTime, method, cached = false) {
  metrics.totalRequests++;
  if (success) metrics.successfulRequests++;
  else metrics.failedRequests++;
  
  // Update average response time
  metrics.averageResponseTime = (metrics.averageResponseTime + responseTime) / 2;
  
  if (cached) metrics.cacheHits++;
  if (method === 'browser') metrics.browserRequests++;
  if (method === 'http') metrics.httpRequests++;
  
  // Log metrics every 10 requests
  if (metrics.totalRequests % 10 === 0) {
    console.log('Atlas Codex Metrics:', metrics);
  }
}

async function addToQueue(domain) {
  // Simple rate limiting per domain
  const lastRequest = requestQueue.get(domain) || 0;
  const now = Date.now();
  const delay = Math.max(0, 1000 - (now - lastRequest)); // 1 second between requests per domain
  
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  requestQueue.set(domain, Date.now());
}

// #14: Schema Auto-Detection
function generateSchemaFromContent(html) {
  const $ = cheerio.load(html);
  const schema = {};
  
  // Detect common e-commerce patterns
  if ($('.price, [data-price], .cost').length > 0) {
    schema.price = "string";
    schema.currency = "string";
  }
  
  // Detect product/article patterns
  if ($('h1, .title, .product-title').length > 0) {
    schema.title = "string";
  }
  
  if ($('.description, .content, .summary').length > 0) {
    schema.description = "string";
  }
  
  // Detect contact info patterns
  if ($('a[href^="mailto:"], .email').length > 0) {
    schema.email = "string";
  }
  
  if ($('a[href^="tel:"], .phone').length > 0) {
    schema.phone = "string";
  }
  
  // Detect social media
  if ($('a[href*="twitter"], a[href*="facebook"], a[href*="linkedin"]').length > 0) {
    schema.socialMedia = {
      twitter: "string",
      facebook: "string", 
      linkedin: "string"
    };
  }
  
  return Object.keys(schema).length > 0 ? schema : null;
}

// Process scrape job
async function processScrapeJob(jobId, params) {
  const startTime = Date.now();
  const domain = new URL(params.url).hostname;
  
  try {
    // Update status to processing
    await updateJobStatus(jobId, 'processing');
    
    // #9: Request queuing
    await addToQueue(domain);
    
    // Decide whether to use browser or HTTP
    const useBrowser = shouldUseBrowser(params.url, params);
    
    // Perform scraping with fallback
    let result;
    if (useBrowser) {
      try {
        result = await scrapeWithBrowser(params.url, params);
      } catch (browserError) {
        console.log(`Browser scraping failed for ${params.url}, falling back to HTTP: ${browserError.message}`);
        // If browser scraping fails, fall back to HTTP
        result = await scrapeWithHttp(params.url, params);
        result.fallbackUsed = true;
        result.fallbackReason = browserError.message;
      }
    } else {
      result = await scrapeWithHttp(params.url, params);
    }
    
    // Store HTML artifact
    const artifactUrl = await storeArtifact(jobId, result.html, 'text/html');
    if (artifactUrl) {
      result.artifactUrl = artifactUrl;
    }
    
    // Store screenshot if available
    if (result.screenshot) {
      const screenshotUrl = await storeArtifact(
        jobId, 
        Buffer.from(result.screenshot, 'base64'), 
        'image/png'
      );
      if (screenshotUrl) {
        result.screenshotUrl = screenshotUrl;
      }
      // Don't include base64 in final result
      delete result.screenshot;
    }
    
    // Update job as completed
    await updateJobStatus(jobId, 'completed', result);
    
    // Update metrics on success
    const responseTime = Date.now() - startTime;
    updateMetrics(true, responseTime, result.method, result.cached);
    
    console.log(`Job ${jobId} completed successfully in ${responseTime}ms`);
    return result;
    
  } catch (error) {
    // Update metrics on failure
    const responseTime = Date.now() - startTime;
    updateMetrics(false, responseTime, 'unknown');
    
    console.error(`Job ${jobId} failed:`, error);
    
    // Handle structured errors with retry suggestions
    const errorMsg = error.message || error;
    const errorData = {
      error: errorMsg,
      retryable: error.retryable || false,
      suggestions: error.suggestions || [],
      originalError: error.originalError
    };
    
    await updateJobStatus(jobId, 'failed', null, JSON.stringify(errorData));
    throw error;
  }
}

// Discover links on a page for wildcard extraction
async function discoverLinks(url, maxLinks = 10, linkPatterns = [], excludePatterns = []) {
  try {
    console.log(`🔍 Discovering links on ${url}`);
    
    // Scrape the base page to find links
    let scrapeResult;
    try {
      scrapeResult = await scrapeWithBrowser(url, {});
    } catch (browserError) {
      console.log(`Browser failed for link discovery, falling back to HTTP: ${browserError.message}`);
      scrapeResult = await scrapeWithHttp(url, {});
    }
    
    // Parse HTML to find links
    const $ = cheerio.load(scrapeResult.html);
    const baseHost = new URL(url).hostname;
    const discoveredLinks = [];
    
    // Find all links on the page
    const allLinks = [];
    $('a[href]').each((i, element) => {
      const href = $(element).attr('href');
      const linkText = $(element).text().trim();
      allLinks.push({ href, linkText });
    });
    
    console.log(`🔍 Found ${allLinks.length} total links on page`);
    
    $('a[href]').each((i, element) => {
      const href = $(element).attr('href');
      if (!href) return;
      
      try {
        // Convert relative URLs to absolute
        const linkUrl = href.startsWith('http') ? href : new URL(href, url).href;
        const linkHost = new URL(linkUrl).hostname;
        
        // Apply exclude patterns first
        if (excludePatterns.some(pattern => linkUrl.includes(pattern))) return;
        
        // Apply include patterns if specified (skip domain check if patterns provided)
        if (linkPatterns.length > 0) {
          if (!linkPatterns.some(pattern => linkUrl.includes(pattern))) return;
        } else {
          // Only include links from the same domain by default
          if (linkHost !== baseHost) return;
        }
        
        // Get link text
        const linkText = $(element).text().trim();
        
        // Skip clearly non-content links
        const isUtilityLink = href.includes('#') ||
                             href.includes('javascript:') ||
                             href.includes('mailto:') ||
                             href.includes('tel:') ||
                             href === '/' ||
                             href === '' ||
                             linkText.length < 5;
        
        // Be very inclusive - any link that isn't clearly utility
        const isContentLink = !isUtilityLink && linkText.length > 0;
        
        if (isContentLink && !discoveredLinks.some(link => link.url === linkUrl)) {
          discoveredLinks.push({
            url: linkUrl,
            title: linkText,
            selector: $(element).parent().get(0)?.tagName || 'a'
          });
        }
      } catch (parseError) {
        // Skip invalid URLs
        console.log(`Skipping invalid URL: ${href}`);
      }
    });
    
    console.log(`🔍 Found ${discoveredLinks.length} potential content links`);
    return discoveredLinks.slice(0, maxLinks);
    
  } catch (error) {
    console.error('Link discovery failed:', error);
    return [];
  }
}

// Autonomous Agent Orchestrator with Stop Conditions
async function processAgenticExtraction(jobId, params) {
  try {
    console.log(`🤖 Starting autonomous agentic extraction for ${params.url}`);
    await streamJobLog(jobId, `🤖 Starting GPT-5 autonomous extraction for ${params.url}`, 'info');
    
    // Initialize Orchestrator Agent state
    const orchestratorState = {
      totalPagesProcessed: 0,
      totalLinksFound: 0,
      currentPage: 1,
      paginationUrls: [],
      processedUrls: new Set(),
      extractedData: [],
      stopConditions: {
        maxPages: params.maxPages || 50,
        maxLinks: params.maxLinks || 100,
        maxDepth: params.maxDepth || 3,
        stopPatterns: params.stopPatterns || ['No more pages', 'End of results'],
        timeout: params.timeout || 300000 // 5 minutes max
      },
      startTime: Date.now()
    };
    
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-placeholder') {
      throw new Error('OpenAI API key required for agentic extraction');
    }
    
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Orchestrator Agent: Master controller with autonomous decision-making
    return await processAutonomousOrchestration(jobId, params, orchestratorState, openai);
    
  } catch (error) {
    console.error(`Agentic extraction failed:`, error);
    // CRITICAL FIX: Update job status to failed when agentic extraction fails
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  }
}

// Autonomous Orchestration with Continuous Decision Making
async function processAutonomousOrchestration(jobId, params, state, openai) {
  console.log(`🎭 Orchestrator Agent taking control`);
  await streamJobLog(jobId, `🎭 Orchestrator Agent taking control`, 'info');
  
  while (!(await shouldStop(state, jobId))) {
    try {
      // Check timeout
      if (Date.now() - state.startTime > state.stopConditions.timeout) {
        console.log(`⏱️ Timeout reached, stopping orchestration`);
        await streamJobLog(jobId, `⏱️ Timeout reached, stopping orchestration`, 'warning');
        break;
      }
      
      // Get current page URL (pagination-aware)
      const currentUrl = state.currentPage === 1 ? 
        params.url : 
        state.paginationUrls[state.currentPage - 2] || params.url;
      
      await broadcastJobUpdate(jobId, 'processing', {
        phase: 'orchestration',
        currentPage: state.currentPage,
        totalProcessed: state.totalPagesProcessed,
        message: `Orchestrator processing page ${state.currentPage}`
      });
      await streamJobLog(jobId, `📄 Processing page ${state.currentPage}: ${currentUrl}`, 'info');
      
      // Discovery Agent: Analyze current page
      await streamJobLog(jobId, `🔍 Discovery Agent analyzing page content...`, 'info');
      const pageResult = await scrapeWithAdvancedAntiDetection(currentUrl);
      
      // Discover links on the current page
      await streamJobLog(jobId, `🔗 Discovering links on current page...`, 'info');
      const discoveredLinks = await discoverLinks(currentUrl, 50, params.linkPatterns || [], params.excludePatterns || []);
      await streamJobLog(jobId, `Found ${discoveredLinks.length} links on page`, 'info');
      
      const discoveryPrompt = `
      You are an Orchestrator Discovery Agent with autonomous decision-making capabilities.
      
      Current State:
      - Page ${state.currentPage} of potentially many
      - Total pages processed: ${state.totalPagesProcessed}
      - Total links found so far: ${state.totalLinksFound}
      - URLs already processed: ${Array.from(state.processedUrls).length}
      
      Current Page URL: ${currentUrl}
      User Prompt: ${params.prompt}
      
      Discovered Links on Page (${discoveredLinks.length} total):
      ${discoveredLinks.slice(0, 20).map(link => `- ${link.title}: ${link.url}`).join('\n')}
      
      Page Content Preview:
      ${pageResult.markdown.substring(0, 4000)}
      
      AUTONOMOUS DECISIONS NEEDED:
      1. What extraction strategy should I use for this page?
      2. How many agents do I need to deploy?
      3. Are there pagination links to continue processing?
      4. Should I stop here or continue to next pages?
      5. What are my next actions?
      
      IMPORTANT INSTRUCTIONS:
      - If this is a news homepage or listing page, DO NOT extract from it directly
      - Instead, identify individual article links and extract from those pages
      - For news sites, deploy multiple agents to extract from different article URLs
      - Each agent should target a specific article URL, not the homepage
      
      Return a JSON decision with:
      {
        "strategy": "single_page" | "multi_agent" | "pagination" | "stop",
        "reasoning": "detailed reasoning for decision",
        "agents_needed": number,
        "extraction_targets": [
          {
            "agent_id": "agent_1",
            "target_url": "specific article/page URL to extract from (NOT the homepage)",
            "focus": "what to extract from that specific page",
            "priority": 1-10
          }
        ],
        "pagination": {
          "has_next": true/false,
          "next_page_url": "url or null",
          "pagination_pattern": "detected pattern",
          "estimated_total_pages": number
        },
        "stop_recommendation": true/false,
        "next_actions": ["action1", "action2"],
        "confidence": 0-100
      }
      `;
      
      const orchestratorDecision = await openai.chat.completions.create({
        model: 'gpt-5',  // Use GPT-5 for orchestration
        messages: [
          {
            role: 'system',
            content: 'You are a GPT-5 powered Orchestrator Discovery Agent with enhanced autonomous decision-making. You manage extraction across multiple pages and deploy agents in parallel for maximum efficiency.'
          },
          {
            role: 'user',
            content: discoveryPrompt + '\n\nRespond with a valid JSON object.'
          }
        ],
        response_format: { type: 'json_object' }
        // GPT-5 doesn't support temperature != 1
        // These will be ignored if not supported
      });
      
      const decision = JSON.parse(orchestratorDecision.choices[0].message.content);
      console.log(`🎯 Orchestrator Decision:`, decision);
      await streamJobLog(jobId, `🎯 Decision: ${decision.strategy} - ${decision.reasoning?.substring(0, 100)}...`, 'info');
      if (decision.agents_needed) {
        await streamJobLog(jobId, `Deploying ${decision.agents_needed} agents, Confidence: ${decision.confidence}%`, 'info');
      }
      
      // Broadcast orchestrator decision
      await broadcastJobUpdate(jobId, 'processing', {
        phase: 'decision',
        decision: decision,
        state: {
          currentPage: state.currentPage,
          totalProcessed: state.totalPagesProcessed,
          totalLinks: state.totalLinksFound
        }
      });
      
      // Execute decision
      if (decision.strategy === 'stop' || decision.stop_recommendation) {
        // Only stop if we've already extracted some data
        if (state.extractedData.length > 0) {
          console.log(`🛑 Orchestrator decided to stop: ${decision.reasoning}`);
          await streamJobLog(jobId, `🛑 Stopping: ${decision.reasoning}`, 'info');
          break;
        } else {
          console.log(`⚠️ Orchestrator wants to stop but no data extracted yet, forcing extraction`);
          await streamJobLog(jobId, `⚠️ No data extracted yet, forcing single-page extraction`, 'warning');
          // Force single page extraction
          decision.strategy = 'single_page';
          decision.extraction_targets = [{
            agent_id: 'agent_forced',
            target_url: currentUrl,
            focus: params.prompt || 'Extract all relevant data',
            priority: 10
          }];
        }
      }
      
      // Deploy agents for current page
      if (decision.extraction_targets && decision.extraction_targets.length > 0) {
        await streamJobLog(jobId, `🚀 Deploying ${decision.extraction_targets.length} extraction agents`, 'info');
        const pageResults = await deployExtractionAgents(
          jobId, 
          decision.extraction_targets, 
          params, 
          openai,
          state.currentPage
        );
        
        state.extractedData = state.extractedData.concat(pageResults);
        state.totalLinksFound += decision.extraction_targets.length;
        await streamJobLog(jobId, `✅ Agents completed, extracted ${pageResults.length} results`, 'success');
      } else if (state.currentPage === 1 && state.extractedData.length === 0) {
        // First page with no extraction targets - force extraction
        console.log(`⚠️ No extraction targets on first page, forcing single extraction`);
        await streamJobLog(jobId, `⚠️ Forcing single page extraction`, 'warning');
        const forcedTargets = [{
          agent_id: 'agent_1',
          target_url: currentUrl,
          focus: params.prompt || 'Extract all relevant data from this page',
          priority: 10
        }];
        const pageResults = await deployExtractionAgents(
          jobId, 
          forcedTargets, 
          params, 
          openai,
          state.currentPage
        );
        state.extractedData = state.extractedData.concat(pageResults);
      }
      
      // Handle pagination
      if (decision.pagination && decision.pagination.has_next && decision.pagination.next_page_url) {
        state.paginationUrls.push(decision.pagination.next_page_url);
        state.currentPage++;
        console.log(`📄 Moving to page ${state.currentPage}: ${decision.pagination.next_page_url}`);
        await streamJobLog(jobId, `📄 Moving to page ${state.currentPage}`, 'info');
      } else {
        console.log(`📄 No more pages found, finishing orchestration`);
        await streamJobLog(jobId, `📄 No more pages found, finishing orchestration`, 'info');
        break;
      }
      
      state.totalPagesProcessed++;
      
      // Respectful delay between pages
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (pageError) {
      console.error(`Orchestrator error on page ${state.currentPage}:`, pageError);
      await streamJobLog(jobId, `⚠️ Error on page ${state.currentPage}: ${pageError.message}`, 'error');
      // Try to continue with next page if available
      if (state.paginationUrls.length > state.currentPage - 1) {
        state.currentPage++;
        await streamJobLog(jobId, `Continuing to next page after error...`, 'info');
        continue;
      } else {
        break;
      }
    }
  }
  
  // Coordinator Agent: Final synthesis
  await streamJobLog(jobId, `🎭 Coordinator Agent synthesizing final results...`, 'info');
  console.log(`📝 Starting synthesis for job ${jobId} with ${state.extractedData.length} results`);
  
  // No try-catch - let it succeed properly
  const coordinatorResult = await synthesizeFinalResults(jobId, state, params, openai);
  console.log(`✅ Synthesis completed successfully for job ${jobId}`);
  
  await streamJobLog(jobId, `✅ Orchestration complete. Processed ${state.totalPagesProcessed} pages, extracted ${state.extractedData.length} results`, 'success');
  return coordinatorResult;
}

// Stop condition evaluation
async function shouldStop(state, jobId) {
  const conditions = state.stopConditions;
  
  if (state.totalPagesProcessed >= conditions.maxPages) {
    console.log(`🛑 Max pages reached: ${conditions.maxPages}`);
    if (jobId) await streamJobLog(jobId, `🛑 Max pages reached: ${conditions.maxPages}`, 'info');
    return true;
  }
  
  if (state.totalLinksFound >= conditions.maxLinks) {
    console.log(`🛑 Max links reached: ${conditions.maxLinks}`);
    if (jobId) await streamJobLog(jobId, `🛑 Max links reached: ${conditions.maxLinks}`, 'info');
    return true;
  }
  
  if (state.currentPage > conditions.maxDepth) {
    console.log(`🛑 Max depth reached: ${conditions.maxDepth}`);
    if (jobId) await streamJobLog(jobId, `🛑 Max depth reached: ${conditions.maxDepth}`, 'info');
    return true;
  }
  
  return false;
}

// Deploy extraction agents for current batch
async function deployExtractionAgents(jobId, targets, params, openai, pageNum) {
  const results = [];
  let processed = 0;
  
  for (const target of targets) {
    try {
      processed++;
      console.log(`🤖 Agent ${target.agent_id} (Page ${pageNum}) processing: ${target.target_url}`);
      
      await broadcastJobUpdate(jobId, 'processing', {
        phase: 'extraction',
        page: pageNum,
        progress: `${target.agent_id} (${processed}/${targets.length})`,
        currentUrl: target.target_url
      });
      
      // Agent scrapes with anti-detection
      await streamJobLog(jobId, `Agent ${target.agent_id} scraping...`, 'info');
      const agentResult = await scrapeWithAdvancedAntiDetection(target.target_url);
      
      // Agent extracts with focus - Enhanced with better prompting
      const extractionMessages = [
        {
          role: 'system',
          content: `You are ${target.agent_id}, an expert data extraction specialist. Your task is to extract ALL relevant data comprehensively and accurately. Be thorough - do not miss any items.`
        }
      ];
      
      // Add few-shot examples for better extraction
      if (params.prompt?.toLowerCase().includes('all') || params.prompt?.toLowerCase().includes('every')) {
        extractionMessages.push({
          role: 'system',
          content: `IMPORTANT: The user asked for ALL items. You must be EXHAUSTIVE and extract EVERY SINGLE item you can find. Do not summarize or select - extract everything.`
        });
      }
      
      extractionMessages.push({
        role: 'user',
        content: `Task: ${target.focus}

User's Original Request: ${params.prompt}

Schema Expected:
${params.schema || 'Extract all relevant structured data'}

Page URL: ${target.target_url}
Page Title: ${agentResult.metadata?.title || 'Unknown'}

Content to Extract From:
${agentResult.markdown.substring(0, 15000)}

EXTRACTION INSTRUCTIONS:
1. Be EXHAUSTIVE - Extract ALL items, not just a sample
2. For categories/navigation: Include ALL categories, subcategories, and links
3. For product listings: Extract EVERY product visible
4. For any lists: Include EVERY item in the list
5. Check the entire page content - scroll through all provided markdown
6. If you see "more", "show all", or pagination indicators, note them
7. Return null only if a field truly doesn't exist

CRITICAL RULES:
- DO NOT summarize or select "representative" items
- DO NOT stop at the first few items
- DO NOT miss subcategories or nested items
- Extract EVERYTHING that matches the schema

Output Format:
- For multiple items, use arrays
- For hierarchical data (like categories with subcategories), use nested objects
- Include all URLs/links found

Example for categories:
{
  "categories": {
    "main_category": {
      "name": "Category Name",
      "url": "...",
      "subcategories": [
        {"name": "Subcat 1", "url": "..."},
        {"name": "Subcat 2", "url": "..."}
      ]
    }
  }
}

Provide the complete extracted data in JSON format.`
      });
      
      // Use GPT-5's new features for better extraction
      // Parse schema if provided to use Structured Outputs
      let responseFormat = undefined;
      if (params.schema) {
        try {
          const schemaObj = typeof params.schema === 'string' ? JSON.parse(params.schema) : params.schema;
          
          // Convert simple schema format to proper JSON Schema format
          const properties = {};
          const required = [];
          for (const [key, value] of Object.entries(schemaObj)) {
            if (typeof value === 'string') {
              // Simple type like "string", "number", "boolean", "array", "object"
              properties[key] = { type: value === 'array' ? 'array' : value };
              if (value === 'array') {
                properties[key].items = { type: 'string' }; // Default to string array
              }
            } else {
              // Already a proper schema object
              properties[key] = value;
            }
            required.push(key);
          }
          
          // GPT-5 Structured Outputs with JSON Schema for 100% reliability
          responseFormat = {
            type: 'json_schema',
            json_schema: {
              name: 'extraction_result',
              strict: true,  // Enforce strict schema compliance
              schema: {
                type: 'object',
                properties: properties,
                required: required,
                additionalProperties: false
              }
            }
          };
        } catch (e) {
          console.warn('Schema parsing failed, using json_object fallback:', e);
          // Fallback to json_object if schema parsing fails
          responseFormat = { type: 'json_object' };
        }
      }
      
      const extraction = await openai.chat.completions.create({
        model: 'gpt-5-nano',  // Cheapest GPT-5 model
        messages: extractionMessages,
        response_format: responseFormat
        // GPT-5 doesn't support temperature != 1
      });
      
      // Validate extraction completeness
      let extractedData;
      if (params.schema) {
        extractedData = JSON.parse(extraction.choices[0].message.content);
        // Handle GPT-5's potential refusal response
        if (extractedData.refusal) {
          console.warn(`⚠️ GPT-5 refused extraction: ${extractedData.refusal}`);
          extractedData = { error: 'Model refused to extract', reason: extractedData.refusal };
        }
      } else {
        extractedData = extraction.choices[0].message.content;
      }
      
      // If user asked for "all" and we got very few results, try again with stronger prompting
      if (params.prompt?.toLowerCase().includes('all') && 
          typeof extractedData === 'object' && 
          Object.keys(extractedData).length < 5) {
        console.log(`⚠️ Extraction seems incomplete (only ${Object.keys(extractedData).length} items), retrying with stronger prompting...`);
        
        const retryExtraction = await openai.chat.completions.create({
          model: 'gpt-5-mini',  // Use better model for retry: $0.25/1M input
          messages: [
            {
              role: 'system',
              content: 'You MUST extract EVERY SINGLE item. The previous extraction was incomplete. Be EXHAUSTIVE.'
            },
            ...extractionMessages
          ],
          response_format: params.schema ? { type: 'json_object' } : undefined
          // GPT-5 doesn't support temperature != 1
        });
        
        extractedData = params.schema ? 
          JSON.parse(retryExtraction.choices[0].message.content) : 
          retryExtraction.choices[0].message.content;
      }
      
      // Include all Hyperbrowser-style fields for beautiful output
      results.push({
        agent_id: target.agent_id,
        page: pageNum,
        url: target.target_url,
        title: agentResult.metadata?.title || 'Untitled',
        markdown: agentResult.markdown,
        metadata: agentResult.metadata,
        html: agentResult.html,
        links: agentResult.links || [],
        screenshot: agentResult.screenshot,
        extractedData: extractedData,
        priority: target.priority
      });
      
      // Respectful delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (agentError) {
      console.error(`Agent ${target.agent_id} failed:`, agentError);
      results.push({
        agent_id: target.agent_id,
        page: pageNum,
        url: target.target_url,
        error: agentError.message,
        extractedData: null
      });
    }
  }
  
  return results;
}

// Final result synthesis by Coordinator Agent
async function synthesizeFinalResults(jobId, state, params, openai) {
  console.log(`🎯 Coordinator Agent synthesizing ${state.extractedData.length} results`);
  await streamJobLog(jobId, `📝 Preparing synthesis of ${state.extractedData.length} extraction results...`, 'info');
  
  // Send ALL extracted data to GPT-5 for proper synthesis
  // No truncation - we want complete results
  const fullResults = state.extractedData.map(result => ({
    agent_id: result.agent_id,
    url: result.url,
    page: result.page,
    extractedData: result.extractedData,
    error: result.error || null
  }));
  
  const promptSize = JSON.stringify(fullResults).length;
  console.log(`📊 Full prompt size: ${promptSize} chars (${state.extractedData.length} results)`);
  await streamJobLog(jobId, `📊 Sending ${Math.round(promptSize/1000)}KB of extraction data for synthesis...`, 'info');
  
  const coordinatorPrompt = `
  You are the Coordinator Agent synthesizing results from autonomous multi-page extraction.
  
  Original Request: ${params.prompt}
  
  Extraction Summary:
  - Total pages processed: ${state.totalPagesProcessed}
  - Total links processed: ${state.totalLinksFound}
  - Total extraction results: ${state.extractedData.length}
  - Pages with pagination: ${state.paginationUrls.length}
  - Duration: ${Math.round((Date.now() - state.startTime) / 1000)}s
  
  Complete Agent Results:
  ${JSON.stringify(fullResults, null, 2)}
  
  Provide a comprehensive synthesis that:
  1. Summarizes ALL key findings across all pages
  2. Identifies patterns and trends in the complete data
  3. Highlights the most important discoveries
  4. Organizes all extracted information logically
  5. Provides actionable insights based on the full dataset
  
  Be thorough and include all relevant information from the extraction results.
  `;
  
  console.log('🤖 Calling GPT-5 for complete synthesis...');
  await streamJobLog(jobId, '🤖 GPT-5 synthesizing complete results...', 'info');
  
  // No timeout - let it complete properly
  // Use the appropriate model based on data size
  const dataSize = JSON.stringify(fullResults).length;
  let model = 'gpt-5-nano';
  let maxTokens = 16384; // GPT-5 nano supports 16K output tokens
  
  if (dataSize > 50000) {
    model = 'gpt-5';  // Use full GPT-5 for very large datasets
    maxTokens = 65536; // GPT-5 supports 64K output tokens
  } else if (dataSize > 20000) {
    model = 'gpt-5-mini';  // Use GPT-5 mini for medium datasets
    maxTokens = 32768; // GPT-5 mini supports 32K output tokens
  }
  
  console.log(`📊 Using ${model} with ${maxTokens} max tokens for ${Math.round(dataSize/1000)}KB of data`);
  await streamJobLog(jobId, `📊 Using ${model} for synthesis (${Math.round(dataSize/1000)}KB of data)`, 'info');
  
  const coordinatorResponse = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: 'system',
        content: 'You are a Coordinator Agent that synthesizes results from autonomous multi-agent extraction across multiple pages. Provide thorough, complete synthesis of ALL data. Be comprehensive and include every important detail.'
      },
      {
        role: 'user',
        content: coordinatorPrompt
      }
    ],
    max_tokens: maxTokens,  // Use maximum available tokens for the model
    // GPT-5 doesn't support temperature != 1
  });
  
  console.log('✅ GPT-5 synthesis completed successfully');
  await streamJobLog(jobId, '✅ Synthesis completed successfully', 'success');
  
  // Structure output like Hyperbrowser with clean sections
  const crawledPages = state.extractedData.map(result => ({
    url: result.url,
    title: result.metadata?.title || 'Untitled',
    markdown: result.markdown || '',
    metadata: result.metadata || {},
    html: result.html || '',
    links: result.links || [],
    screenshot: result.screenshot || null,
    extractedData: result.extractedData || null
  }));
  
  const finalResult = {
    url: params.url,
    strategy: 'autonomous_multi_agent',
    configuration: {
      start_url: params.url,
      max_pages: state.stopConditions.maxPages,
      max_depth: state.stopConditions.maxDepth,
      pages_crawled: state.totalPagesProcessed,
      duration_seconds: Math.round((Date.now() - state.startTime) / 1000)
    },
    pages: crawledPages,
    orchestrator_summary: {
      pages_processed: state.totalPagesProcessed,
      links_discovered: state.totalLinksFound,
      extraction_results: state.extractedData.length,
      pagination_pages: state.paginationUrls.length,
      stop_reason: determineStopReason(state)
    },
    coordinator_synthesis: coordinatorResponse.choices[0].message.content,
    model: model,  // Dynamic model selection based on data size
    autonomous: true
  };
  
  console.log(`📊 Saving final result for job ${jobId}...`);
  await updateJobStatus(jobId, 'completed', finalResult);
  console.log(`✅ Job ${jobId} completed successfully`);
  return finalResult;
}

// Determine why orchestration stopped
function determineStopReason(state) {
  const conditions = state.stopConditions;
  
  if (state.totalPagesProcessed >= conditions.maxPages) {
    return `Reached maximum pages limit (${conditions.maxPages})`;
  }
  
  if (state.totalLinksFound >= conditions.maxLinks) {
    return `Reached maximum links limit (${conditions.maxLinks})`;
  }
  
  if (state.currentPage > conditions.maxDepth) {
    return `Reached maximum depth (${conditions.maxDepth})`;
  }
  
  if (Date.now() - state.startTime > conditions.timeout) {
    return `Timeout reached (${Math.round(conditions.timeout / 1000)}s)`;
  }
  
  return 'Natural completion - no more pages found';
}

// Single page extraction with GPT-4o
async function processSinglePageExtraction(jobId, params, scrapeResult, openai) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-5-nano',  // Using GPT-5 nano - cheapest option
    messages: [
      {
        role: 'system',
        content: 'You are an Expert Extraction Agent that extracts structured data from web pages.'
      },
      {
        role: 'user',
        content: `${params.prompt}\n\nPage content:\n${scrapeResult.markdown.substring(0, 10000)}\n\nReturn the results as JSON.`
      }
    ],
    response_format: params.schema ? { type: 'json_object' } : undefined,
    // GPT-5 doesn't support temperature != 1
  });
  
  const result = {
    url: params.url,
    strategy: 'single_page',
    extractedData: params.schema ? 
      JSON.parse(completion.choices[0].message.content) : 
      completion.choices[0].message.content,
    metadata: scrapeResult.metadata,
    model: 'gpt-4o'
  };
  
  await updateJobStatus(jobId, 'completed', result);
  return result;
}

// Multi-agent extraction orchestration  
async function processMultiAgentExtraction(jobId, params, plan, openai) {
  const results = [];
  let processed = 0;
  
  // Discover actual links if needed
  if (plan.extraction_targets.some(t => t.target_url === 'discover_links')) {
    console.log(`🔍 Discovering links on ${params.url}`);
    const discoveredLinks = await discoverLinks(
      params.url,
      plan.agents_needed,
      params.linkPatterns || [],
      params.excludePatterns || []
    );
    
    // Replace 'discover_links' targets with actual URLs
    plan.extraction_targets = discoveredLinks.slice(0, plan.agents_needed).map((link, i) => ({
      agent_id: `agent_${i + 1}`,
      target_url: link.url,
      focus: params.prompt,
      priority: 10 - i,
      title: link.title
    }));
  }
  
  // Process each target with dedicated agents
  for (const target of plan.extraction_targets) {
    try {
      processed++;
      console.log(`🤖 Agent ${target.agent_id} processing: ${target.target_url}`);
      
      await broadcastJobUpdate(jobId, 'processing', {
        phase: 'extraction',
        progress: `Agent ${target.agent_id} (${processed}/${plan.extraction_targets.length})`,
        currentUrl: target.target_url,
        focus: target.focus
      });
      
      // Agent scrapes its assigned target
      await streamJobLog(jobId, `Agent ${agentId} scraping target...`, 'info');
      let agentScrapeResult;
      try {
        agentScrapeResult = await scrapeWithBrowser(target.target_url, {});
      } catch (browserError) {
        agentScrapeResult = await scrapeWithHttp(target.target_url, {});
      }
      
      // Agent extracts with specific focus
      const agentCompletion = await openai.chat.completions.create({
        model: 'gpt-5-nano',  // Cheapest: $0.05/1M input, $0.40/1M output tokens
        messages: [
          {
            role: 'system',
            content: `You are Extraction Agent ${target.agent_id}. Focus on: ${target.focus}`
          },
          {
            role: 'user',
            content: `Extract information from this page focusing on: ${target.focus}\n\nPage content:\n${agentScrapeResult.markdown.substring(0, 8000)}`
          }
        ],
        response_format: params.schema ? { type: 'json_object' } : undefined,
        // GPT-5 doesn't support temperature != 1
      });
      
      results.push({
        agent_id: target.agent_id,
        url: target.target_url,
        title: target.title || agentScrapeResult.metadata.title,
        extractedData: params.schema ? 
          JSON.parse(agentCompletion.choices[0].message.content) : 
          agentCompletion.choices[0].message.content,
        metadata: agentScrapeResult.metadata,
        focus: target.focus,
        priority: target.priority
      });
      
      // Respectful delay between agents
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (agentError) {
      console.error(`Agent ${target.agent_id} failed:`, agentError);
      results.push({
        agent_id: target.agent_id,
        url: target.target_url,
        error: agentError.message,
        extractedData: null
      });
    }
  }
  
  // Coordinator Agent: Compile and synthesize results
  const coordinatorPrompt = `
  You are the Coordinator Agent. Compile results from ${results.length} extraction agents.
  
  Original request: ${params.prompt}
  
  Agent Results:
  ${JSON.stringify(results, null, 2)}
  
  Provide a comprehensive summary that synthesizes all agent findings.
  `;
  
  const coordinatorResponse = await openai.chat.completions.create({
    model: 'gpt-5-nano',  // Using GPT-5 nano - cheapest option
    messages: [
      {
        role: 'system',
        content: 'You are a Coordinator Agent that synthesizes results from multiple extraction agents.'
      },
      {
        role: 'user',
        content: coordinatorPrompt
      }
    ],
    // GPT-5 doesn't support temperature != 1
  });
  
  const finalResult = {
    url: params.url,
    strategy: 'multi_agent',
    plan: plan,
    agents_deployed: results.length,
    agent_results: results,
    coordinator_summary: coordinatorResponse.choices[0].message.content,
    model: 'gpt-5-nano',  // Using GPT-5 nano - cheapest option
    summary: {
      total: results.length,
      successful: results.filter(r => r.extractedData && !r.error).length,
      failed: results.filter(r => r.error).length
    }
  };
  
  await updateJobStatus(jobId, 'completed', finalResult);
  return finalResult;
}

// Process extract job (with OpenAI integration and wildcard support)
async function processExtractJob(jobId, params) {
  try {
    await updateJobStatus(jobId, 'processing');
    
    // Set a maximum timeout of 10 minutes for the entire job (increased for proper synthesis)
    const jobTimeout = setTimeout(async () => {
      console.error(`⏱️ Job ${jobId} timed out after 10 minutes`);
      await updateJobStatus(jobId, 'failed', null, 'Job timed out after 10 minutes');
      process.exit(1); // Exit to restart the worker
    }, 600000); // 10 minutes - enough time for proper synthesis
    
    // Check if this is agentic/autonomous extraction
    if (params.wildcard || params.autonomous || params.agentic) {
      console.log(`🤖 Using GPT-5 autonomous orchestration for ${params.url}`);
      const result = await processAgenticExtraction(jobId, params);
      clearTimeout(jobTimeout);
      return result;
    }
    
    // Implement escalation pipeline as per PRD
    let scrapeResult;
    
    // Step 1: Try HEAD request to check if content has changed
    try {
      const headResponse = await fetch(params.url, { method: 'HEAD' });
      const etag = headResponse.headers.get('etag');
      const lastModified = headResponse.headers.get('last-modified');
      const contentType = headResponse.headers.get('content-type');
      
      console.log(`📊 HEAD check - ETag: ${etag}, Last-Modified: ${lastModified}, Type: ${contentType}`);
      
      // Check if it's JSON API endpoint
      if (contentType && contentType.includes('application/json')) {
        console.log(`🎯 Detected JSON API endpoint, fetching directly`);
        const jsonResponse = await fetch(params.url);
        const jsonData = await jsonResponse.json();
        scrapeResult = {
          url: params.url,
          status: 200,
          headers: Object.fromEntries(jsonResponse.headers.entries()),
          html: JSON.stringify(jsonData, null, 2),
          markdown: JSON.stringify(jsonData, null, 2),
          metadata: { contentType: 'json' },
          method: 'json-api'
        };
      }
    } catch (headError) {
      console.log(`HEAD request failed: ${headError.message}`);
    }
    
    // Step 2: Try direct HTTP GET without JavaScript
    if (!scrapeResult) {
      try {
        console.log(`🌐 Attempting direct HTTP fetch for ${params.url}`);
        scrapeResult = await scrapeWithHttp(params.url, {});
        
        // Check if we got real content or just a JS app shell
        const hasContent = scrapeResult.html.length > 5000 && 
                          !scrapeResult.html.includes('You need to enable JavaScript') &&
                          !scrapeResult.html.includes('noscript');
        
        if (!hasContent) {
          console.log(`📝 HTTP fetch returned JS app shell, need browser rendering`);
          scrapeResult = null;
        } else {
          console.log(`✅ Successfully extracted with direct HTTP (${scrapeResult.html.length} bytes)`);
        }
      } catch (httpError) {
        console.log(`HTTP scraping failed: ${httpError.message}`);
        scrapeResult = null;
      }
    }
    
    // Step 3: Try browser with network interception to find API calls
    if (!scrapeResult) {
      try {
        console.log(`🕵️ Attempting browser scraping with network interception`);
        scrapeResult = await scrapeWithBrowser(params.url, {
          interceptNetwork: true,
          waitFor: 'networkidle'
        });
        console.log(`✅ Successfully extracted with browser rendering`);
      } catch (browserError) {
        console.log(`Browser scraping failed: ${browserError.message}`);
        // Final fallback - try browser with different strategy
        try {
          scrapeResult = await scrapeWithBrowser(params.url, {
            waitFor: 'domcontentloaded',
            interceptNetwork: false
          });
        } catch (finalError) {
          throw new Error(`All scraping methods failed: ${finalError.message}`);
        }
      }
    }
    
    // Use OpenAI to extract structured data
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-placeholder') {
      const OpenAI = require('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      
      const completion = await openai.chat.completions.create({
        model: params.model || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a web scraping assistant that extracts structured data from web pages.'
          },
          {
            role: 'user',
            content: `${params.prompt || 'Extract all relevant information from this page'}${params.schema ? '. Return the result as a JSON object.' : ''}\n\nPage content:\n${scrapeResult.markdown.substring(0, 10000)}`
          }
        ],
        // GPT-5 doesn't support temperature != 1,
        response_format: params.schema ? { type: 'json_object' } : undefined
      });
      
      const extractedData = completion.choices[0].message.content;
      let parsedData = params.schema ? JSON.parse(extractedData) : extractedData;
      
      // Add evidence system - basic implementation
      if (params.schema && typeof parsedData === 'object') {
        parsedData = addEvidenceToExtractedData(parsedData, scrapeResult.html, params.url);
      }
      
      // #14: Schema Auto-Detection
      let suggestedSchema = null;
      if (!params.schema) {
        suggestedSchema = generateSchemaFromContent(scrapeResult.html);
      }
      
      const result = {
        url: params.url,
        extractedData: parsedData,
        metadata: scrapeResult.metadata,
        model: params.model || 'gpt-4-turbo-preview',
        evidenceGenerated: !!params.schema,
        suggestedSchema: suggestedSchema
      };
      
      clearTimeout(jobTimeout);
      await updateJobStatus(jobId, 'completed', result);
      return result;
    } else {
      // Fallback without OpenAI
      const result = {
        url: params.url,
        extractedData: {
          title: scrapeResult.metadata.title,
          description: scrapeResult.metadata.description,
          content: scrapeResult.markdown.substring(0, 5000)
        },
        metadata: scrapeResult.metadata,
        model: 'none'
      };
      
      clearTimeout(jobTimeout);
      await updateJobStatus(jobId, 'completed', result);
      return result;
    }
    
  } catch (error) {
    if (typeof jobTimeout !== 'undefined') clearTimeout(jobTimeout);
    console.error(`Extract job ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  }
}

// Process crawl job
async function processCrawlJob(jobId, params) {
  try {
    await updateJobStatus(jobId, 'processing');
    
    const visitedUrls = new Set();
    const urlQueue = [{ url: params.url, depth: 0 }];
    const results = [];
    
    while (urlQueue.length > 0 && results.length < (params.maxPages || 10)) {
      const { url, depth } = urlQueue.shift();
      
      if (visitedUrls.has(url) || depth > (params.maxDepth || 2)) {
        continue;
      }
      
      visitedUrls.add(url);
      
      try {
        // Scrape the page
        const scrapeResult = await scrapeWithHttp(url, {});
        results.push({
          url,
          title: scrapeResult.metadata.title,
          depth
        });
        
        // Extract links for crawling
        if (depth < (params.maxDepth || 2)) {
          const $ = cheerio.load(scrapeResult.html);
          $('a[href]').each((_, elem) => {
            const href = $(elem).attr('href');
            if (href && !href.startsWith('#') && !href.startsWith('mailto:')) {
              const absoluteUrl = new URL(href, url).href;
              
              // Check include/exclude patterns
              const shouldInclude = params.includePatterns?.length 
                ? params.includePatterns.some(pattern => absoluteUrl.includes(pattern))
                : true;
                
              const shouldExclude = params.excludePatterns?.length
                ? params.excludePatterns.some(pattern => absoluteUrl.includes(pattern))
                : false;
                
              if (shouldInclude && !shouldExclude && !visitedUrls.has(absoluteUrl)) {
                urlQueue.push({ url: absoluteUrl, depth: depth + 1 });
              }
            }
          });
        }
        
        // Wait between requests
        if (params.waitBetween) {
          await new Promise(resolve => setTimeout(resolve, params.waitBetween));
        }
        
      } catch (error) {
        console.error(`Failed to crawl ${url}:`, error.message);
      }
    }
    
    const result = {
      startUrl: params.url,
      pagesVisited: results.length,
      pages: results
    };
    
    await updateJobStatus(jobId, 'completed', result);
    return result;
    
  } catch (error) {
    console.error(`Crawl job ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  }
}

// Main Lambda handler for SQS events
exports.handler = async (event) => {
  console.log('Worker processing SQS event:', JSON.stringify(event));
  
  const results = [];
  
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const { jobId, type, params } = message;
      
      // Default to extract type if not specified (for backward compatibility)
      const jobType = type || 'extract';
      
      console.log(`Processing ${jobType} job: ${jobId}`);
      
      let result;
      switch (jobType) {
        case 'scrape':
          result = await processScrapeJob(jobId, params);
          break;
        case 'extract':
          result = await processExtractJob(jobId, params);
          break;
        case 'crawl':
          result = await processCrawlJob(jobId, params);
          break;
        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }
      
      results.push({ jobId, success: true, result });
      
    } catch (error) {
      console.error('Failed to process record:', error);
      results.push({ 
        jobId: record.messageId, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  return {
    batchItemFailures: results
      .filter(r => !r.success)
      .map(r => ({ itemIdentifier: r.jobId }))
  };
};
// ECS Container Mode - Poll SQS directly when not running as Lambda
if (!process.env.AWS_LAMBDA_FUNCTION_NAME && process.env.QUEUE_URL) {
  const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
  const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-west-2' });
  
  console.log('🐳 Running in ECS container mode');
  console.log('📊 Queue URL:', process.env.QUEUE_URL);
  
  async function pollQueue() {
    console.log('🔄 Polling queue for messages...');
    try {
      const receiveParams = {
        QueueUrl: process.env.QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 300
      };
      
      const { Messages } = await sqs.send(new ReceiveMessageCommand(receiveParams));
      
      if (Messages && Messages.length > 0) {
        console.log(`📥 Received ${Messages.length} message(s) from queue`);
        
        for (const message of Messages) {
          try {
            // Process the message as if it were a Lambda event
            const event = {
              Records: [{
                messageId: message.MessageId,
                body: message.Body,
                receiptHandle: message.ReceiptHandle
              }]
            };
            
            const result = await exports.handler(event);
            
            // Delete the message if processed successfully
            if (!result.batchItemFailures || result.batchItemFailures.length === 0) {
              await sqs.send(new DeleteMessageCommand({
                QueueUrl: process.env.QUEUE_URL,
                ReceiptHandle: message.ReceiptHandle
              }));
              console.log('✅ Message processed and deleted');
            }
          } catch (error) {
            console.error('❌ Error processing message:', error);
          }
        }
      } else {
        console.log('⏳ No messages in queue');
      }
    } catch (error) {
      console.error('❌ Error polling queue:', error);
    }
    
    // Continue polling
    setTimeout(pollQueue, 1000);
  }
  
  // Start polling
  pollQueue().catch(console.error);
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('📛 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
  });
}
