// Atlas Codex Worker - GPT-5 OPTIMIZED VERSION
// Leverages GPT-5's superior pricing and capabilities

const { DynamoDBClient, UpdateItemCommand, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { chromium } = require('playwright-core');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
const crypto = require('crypto');

// Initialize clients
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });
const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-west-2' });

// Constants
const LAMBDA_TIMEOUT = 280000; // 4.5 minutes practical limit
const QUICK_SCRAPE_TIMEOUT = 5000; // 5 seconds for initial attempts
const BROWSER_TIMEOUT = 15000; // 15 seconds max for browser ops

// GPT-5 Model Selection
// Pricing (per 1M tokens):
// - gpt-5-nano: $0.05 input / $0.40 output (basic extraction)
// - gpt-5-mini: $0.25 input / $2 output (80% performance at 20% cost)
// - gpt-5: $1.25 input / $10 output (complex reasoning)
// With caching: 90% discount on input tokens!

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

// === GPT-5 Cache Management ===
class GPT5CacheManager {
  constructor() {
    this.conversationCache = new Map();
    this.cacheWindow = 5 * 60 * 1000; // 5 minutes for 90% discount
  }
  
  getCacheKey(jobId, agentId) {
    return `${jobId}_${agentId || 'main'}`;
  }
  
  addToCache(jobId, agentId, messages) {
    const key = this.getCacheKey(jobId, agentId);
    const existing = this.conversationCache.get(key) || [];
    
    this.conversationCache.set(key, {
      messages: [...existing, ...messages],
      timestamp: Date.now()
    });
  }
  
  getCache(jobId, agentId) {
    const key = this.getCacheKey(jobId, agentId);
    const cached = this.conversationCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheWindow) {
      console.log(`✅ Using cached context for 90% discount (${key})`);
      return cached.messages;
    }
    
    return [];
  }
  
  clearOldCache() {
    const now = Date.now();
    for (const [key, value] of this.conversationCache.entries()) {
      if (now - value.timestamp > this.cacheWindow) {
        this.conversationCache.delete(key);
      }
    }
  }
}

const gpt5Cache = new GPT5CacheManager();

// === Smart Result Caching ===
class ResultCache {
  constructor() {
    this.cache = new Map();
  }
  
  getCacheKey(url, params) {
    const hash = crypto.createHash('md5');
    hash.update(url + JSON.stringify(params));
    return hash.digest('hex');
  }
  
  async get(url, params) {
    const key = this.getCacheKey(url, params);
    
    if (this.cache.has(key)) {
      const cached = this.cache.get(key);
      if (Date.now() - cached.timestamp < 3600000) { // 1 hour
        console.log(`✅ Cache hit for ${url}`);
        return cached.data;
      }
    }
    
    // Check S3 cache
    try {
      const s3Key = `cache/${key}.json`;
      const result = await s3.send(new GetObjectCommand({
        Bucket: process.env.ARTIFACTS_BUCKET,
        Key: s3Key
      }));
      
      const data = JSON.parse(await result.Body.transformToString());
      console.log(`✅ S3 cache hit for ${url}`);
      return data;
    } catch (err) {
      // Cache miss is ok
    }
    
    return null;
  }
  
  async set(url, params, data) {
    const key = this.getCacheKey(url, params);
    
    // Memory cache
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // S3 cache for persistence
    try {
      await s3.send(new PutObjectCommand({
        Bucket: process.env.ARTIFACTS_BUCKET,
        Key: `cache/${key}.json`,
        Body: JSON.stringify(data),
        ContentType: 'application/json'
      }));
    } catch (err) {
      // Non-critical
    }
  }
}

const cache = new ResultCache();

// === Parallel Processing with GPT-5 ===
async function processInParallel(tasks, maxConcurrent = 5) {
  const results = [];
  const executing = new Set();
  
  for (const task of tasks) {
    const promise = task().then(result => {
      executing.delete(promise);
      results.push(result);
      return result;
    }).catch(err => {
      executing.delete(promise);
      const errorResult = { error: err.message };
      results.push(errorResult);
      return errorResult;
    });
    
    executing.add(promise);
    
    if (executing.size >= maxConcurrent) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
  return results;
}

// === Lightweight Scraping First ===
async function lightweightScrape(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(QUICK_SCRAPE_TIMEOUT)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const bodyText = $('body').text().trim();
    if (bodyText.length < 500) {
      throw new Error('Insufficient content - needs browser rendering');
    }
    
    return {
      html,
      markdown: turndownService.turndown(html),
      metadata: {
        title: $('title').text(),
        description: $('meta[name="description"]').attr('content') || ''
      },
      method: 'lightweight'
    };
  } catch (err) {
    throw err;
  }
}

// === Shared Browser Instance ===
let sharedBrowser = null;
let browserLaunchTime = 0;

async function getSharedBrowser() {
  if (sharedBrowser && Date.now() - browserLaunchTime < 120000) {
    return sharedBrowser;
  }
  
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => {});
  }
  
  sharedBrowser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  browserLaunchTime = Date.now();
  return sharedBrowser;
}

// === Smart Scraping ===
async function smartScrape(url, options = {}) {
  const cached = await cache.get(url, options);
  if (cached) return cached;
  
  let result;
  
  try {
    result = await lightweightScrape(url);
    console.log(`✅ Lightweight scrape succeeded for ${url}`);
  } catch (err) {
    console.log(`⚠️ Using browser for ${url}`);
    
    const browser = await getSharedBrowser();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    const page = await context.newPage();
    
    // Block unnecessary resources
    await page.route('**/*', route => {
      const resourceType = route.request().resourceType();
      if (['stylesheet', 'image', 'media', 'font'].includes(resourceType)) {
        return route.abort();
      }
      route.continue();
    });
    
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: BROWSER_TIMEOUT
      });
      
      await page.waitForTimeout(1000);
      
      const html = await page.content();
      result = {
        html,
        markdown: turndownService.turndown(html),
        metadata: await page.evaluate(() => ({
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.content || ''
        })),
        method: 'browser'
      };
    } finally {
      await context.close();
    }
  }
  
  await cache.set(url, options, result);
  return result;
}

// === GPT-5 Optimized Extraction ===
async function extractWithGPT5(content, prompt, model, jobId, agentId, openai) {
  // Use cached conversation for 90% discount
  const cachedMessages = gpt5Cache.getCache(jobId, agentId);
  
  // Build messages with cache
  const messages = [
    ...cachedMessages,
    {
      role: 'system',
      content: model === GPT5_MODELS.NANO ? 
        'Extract only the requested information. Be extremely concise.' :
        'You are an expert extraction agent. Extract comprehensive information as requested.'
    },
    {
      role: 'user',
      content: `${prompt}\n\nContent:\n${content}`
    }
  ];
  
  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: messages,
      max_completion_tokens: model === GPT5_MODELS.NANO ? 1000 : 
                            model === GPT5_MODELS.MINI ? 4000 : 
                            16000,
      // GPT-5 only supports temperature: 1 (default)
      response_format: { type: 'json_object' }
    });
    
    // Cache the conversation for next call
    gpt5Cache.addToCache(jobId, agentId, [
      messages[messages.length - 1],
      response.choices[0].message
    ]);
    
    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error('GPT-5 extraction failed:', err);
    return {
      error: 'Extraction failed',
      reason: err.message
    };
  }
}

// === Optimized Autonomous Extraction with GPT-5 ===
async function gpt5AutonomousExtraction(jobId, params, openai) {
  const startTime = Date.now();
  const results = [];
  
  console.log(`🚀 Starting GPT-5 optimized extraction for ${params.url}`);
  
  // Step 1: Quick discovery with GPT-5-nano
  const basePageData = await smartScrape(params.url);
  const $ = cheerio.load(basePageData.html);
  
  // Use GPT-5-nano for link discovery (cheap and fast)
  const discoveryPrompt = `Analyze this page and identify the most important links to extract data from.
Return a JSON array of up to 10 URLs that are most relevant to: ${params.prompt || 'general extraction'}

Page content preview:
${basePageData.markdown.substring(0, 5000)}`;
  
  const discoveryResult = await extractWithGPT5(
    basePageData.markdown.substring(0, 5000),
    discoveryPrompt,
    GPT5_MODELS.NANO, // $0.05 per 1M tokens!
    jobId,
    'discovery',
    openai
  );
  
  // Extract links from discovery or fallback to DOM parsing
  let links = [];
  if (discoveryResult.urls) {
    links = discoveryResult.urls;
  } else {
    $('a[href]').each((i, el) => {
      if (i >= 20) return false;
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) {
        links.push(href);
      }
    });
  }
  
  console.log(`Found ${links.length} links to process`);
  
  // Step 2: Process pages in parallel with appropriate GPT-5 model
  const BATCH_SIZE = 5;
  const MAX_PAGES = Math.min(params.maxPages || 20, 20);
  
  for (let i = 0; i < Math.min(links.length, MAX_PAGES); i += BATCH_SIZE) {
    const batch = links.slice(i, i + BATCH_SIZE);
    
    // Check time
    const elapsed = Date.now() - startTime;
    if (elapsed > LAMBDA_TIMEOUT - 60000) {
      console.log('⏰ Time limit approaching, synthesizing current results');
      break;
    }
    
    // Process batch in parallel
    const batchTasks = batch.map((url, idx) => async () => {
      try {
        const pageData = await smartScrape(url);
        
        // Determine which GPT-5 model to use based on task complexity
        let model = GPT5_MODELS.NANO;
        let extractionPrompt = params.prompt || 'Extract key information';
        
        if (params.schema || params.detailed) {
          model = GPT5_MODELS.MINI; // Use mini for structured extraction
          extractionPrompt = `Extract data according to this schema: ${JSON.stringify(params.schema)}`;
        }
        
        const extracted = await extractWithGPT5(
          pageData.markdown.substring(0, 15000), // GPT-5 can handle more context
          extractionPrompt,
          model,
          jobId,
          `agent_${i + idx}`,
          openai
        );
        
        return {
          url,
          data: extracted,
          model: model,
          cached: gpt5Cache.getCache(jobId, `agent_${i + idx}`).length > 0
        };
      } catch (err) {
        return { url, error: err.message };
      }
    });
    
    const batchResults = await processInParallel(batchTasks, BATCH_SIZE);
    results.push(...batchResults.filter(r => !r.error));
    
    // Stream partial results
    await streamResults(jobId, results);
    
    console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} complete: ${results.length} results`);
  }
  
  // Step 3: Synthesis with GPT-5-mini or standard
  const synthesisModel = results.length > 10 ? GPT5_MODELS.STANDARD : GPT5_MODELS.MINI;
  
  const synthesisPrompt = `Synthesize these extraction results into a comprehensive summary.
  
Original request: ${params.prompt}
Pages processed: ${results.length}

Results:
${JSON.stringify(results.slice(0, 20), null, 2)}

Provide:
1. Key findings
2. Patterns identified
3. Actionable insights`;
  
  const synthesis = await extractWithGPT5(
    JSON.stringify(results),
    synthesisPrompt,
    synthesisModel,
    jobId,
    'synthesis',
    openai
  );
  
  return {
    url: params.url,
    pages_processed: results.length,
    execution_time: Math.round((Date.now() - startTime) / 1000),
    results: results,
    synthesis: synthesis,
    models_used: {
      discovery: GPT5_MODELS.NANO,
      extraction: GPT5_MODELS.MINI,
      synthesis: synthesisModel
    },
    cache_hits: results.filter(r => r.cached).length,
    estimated_cost: calculateCost(results)
  };
}

// === Cost Calculation ===
function calculateCost(results) {
  // Rough estimates based on GPT-5 pricing
  const tokensPerPage = 2000;
  const nanoPages = results.filter(r => r.model === GPT5_MODELS.NANO).length;
  const miniPages = results.filter(r => r.model === GPT5_MODELS.MINI).length;
  const standardPages = results.filter(r => r.model === GPT5_MODELS.STANDARD).length;
  
  const inputCost = (
    (nanoPages * tokensPerPage * 0.05) +
    (miniPages * tokensPerPage * 0.25) +
    (standardPages * tokensPerPage * 1.25)
  ) / 1000000;
  
  const outputCost = (
    (nanoPages * 500 * 0.40) +
    (miniPages * 1000 * 2) +
    (standardPages * 2000 * 10)
  ) / 1000000;
  
  // Apply 90% discount for cached tokens (assume 50% are cached)
  const discountedInputCost = inputCost * 0.55;
  
  return {
    estimated_input_cost: `$${discountedInputCost.toFixed(4)}`,
    estimated_output_cost: `$${outputCost.toFixed(4)}`,
    total: `$${(discountedInputCost + outputCost).toFixed(4)}`,
    savings_from_cache: `$${(inputCost * 0.45).toFixed(4)}`
  };
}

// === Progressive Result Streaming ===
async function streamResults(jobId, results) {
  try {
    await dynamodb.send(new UpdateItemCommand({
      TableName: 'atlas-codex-jobs',
      Key: { id: { S: jobId } },
      UpdateExpression: 'SET #partial = :results, #progress = :progress',
      ExpressionAttributeNames: {
        '#partial': 'partialResults',
        '#progress': 'progress'
      },
      ExpressionAttributeValues: {
        ':results': { S: JSON.stringify(results) },
        ':progress': { N: results.length.toString() }
      }
    }));
  } catch (err) {
    console.error('Failed to stream results:', err.message);
  }
}

// === Main Processing Function ===
async function processExtractJob(jobId, params) {
  const startTime = Date.now();
  
  try {
    await updateJobStatus(jobId, 'processing');
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key required');
    }
    
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    let result;
    
    if (params.autonomous || params.wildcard || params.agentic) {
      // Multi-page extraction with GPT-5
      result = await gpt5AutonomousExtraction(jobId, params, openai);
    } else {
      // Single page extraction with GPT-5-nano or mini
      const pageData = await smartScrape(params.url);
      const model = params.schema ? GPT5_MODELS.MINI : GPT5_MODELS.NANO;
      
      const extracted = await extractWithGPT5(
        pageData.markdown.substring(0, 20000),
        params.prompt || 'Extract all relevant information',
        model,
        jobId,
        'single',
        openai
      );
      
      result = {
        url: params.url,
        extractedData: extracted,
        metadata: pageData.metadata,
        model: model,
        cost: calculateCost([{ model }])
      };
    }
    
    await updateJobStatus(jobId, 'completed', result);
    
    console.log(`✅ Job ${jobId} completed in ${Math.round((Date.now() - startTime) / 1000)}s`);
    console.log(`💰 Estimated cost: ${result.cost?.total || result.estimated_cost?.total || 'N/A'}`);
    
    return result;
    
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  } finally {
    // Cleanup
    gpt5Cache.clearOldCache();
    if (sharedBrowser) {
      await sharedBrowser.close().catch(() => {});
    }
  }
}

// === Helper Functions ===
async function updateJobStatus(jobId, status, result = null, error = null) {
  const updateExpression = ['SET #status = :status', '#updatedAt = :updatedAt'];
  const expressionAttributeNames = {
    '#status': 'status',
    '#updatedAt': 'updatedAt'
  };
  const expressionAttributeValues = {
    ':status': { S: status },
    ':updatedAt': { N: Date.now().toString() }
  };

  if (result) {
    updateExpression.push('#result = :result');
    expressionAttributeNames['#result'] = 'result';
    expressionAttributeValues[':result'] = { S: JSON.stringify(result).substring(0, 400000) };
  }

  if (error) {
    updateExpression.push('#error = :error');
    expressionAttributeNames['#error'] = 'error';
    expressionAttributeValues[':error'] = { S: error.substring(0, 5000) };
  }

  try {
    await dynamodb.send(new UpdateItemCommand({
      TableName: 'atlas-codex-jobs',
      Key: { id: { S: jobId } },
      UpdateExpression: updateExpression.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }));
    return true;
  } catch (err) {
    console.error(`Failed to update job ${jobId} status:`, err);
    return false;
  }
}

// === Lambda Handler ===
exports.handler = async (event, context) => {
  console.log('GPT-5 Optimized Worker started');
  const results = [];
  
  for (const record of event.Records) {
    const startTime = Date.now();
    let jobId;
    
    try {
      const message = JSON.parse(record.body);
      jobId = message.jobId;
      const { type, params } = message;
      
      console.log(`Processing ${type || 'extract'} job ${jobId}`);
      console.log(`Time remaining: ${context.getRemainingTimeInMillis()}ms`);
      
      // Check time
      if (context.getRemainingTimeInMillis() < 30000) {
        throw new Error('Insufficient time remaining');
      }
      
      let result;
      switch (type || 'extract') {
        case 'extract':
          result = await processExtractJob(jobId, params);
          break;
        case 'scrape':
          const pageData = await smartScrape(params.url);
          await updateJobStatus(jobId, 'completed', pageData);
          result = pageData;
          break;
        default:
          throw new Error(`Unknown job type: ${type}`);
      }
      
      results.push({ jobId, success: true, result });
      
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);
      
      if (jobId) {
        await updateJobStatus(jobId, 'failed', null, error.message);
      }
      
      results.push({ 
        jobId: jobId || record.messageId, 
        success: false, 
        error: error.message 
      });
    }
    
    console.log(`Job processed in ${Math.round((Date.now() - startTime) / 1000)}s`);
  }
  
  // Cleanup
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => {});
  }
  
  return {
    batchItemFailures: results
      .filter(r => !r.success)
      .map(r => ({ itemIdentifier: r.jobId }))
  };
};