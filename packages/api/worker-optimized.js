// Atlas Codex Worker - OPTIMIZED VERSION
// Focuses on actually completing extraction jobs successfully

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

// Initialize Turndown
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// === OPTIMIZATION 1: Smart Result Caching ===
class ResultCache {
  constructor() {
    this.cache = new Map();
    this.s3Cache = new Map();
  }
  
  getCacheKey(url, params) {
    const hash = crypto.createHash('md5');
    hash.update(url + JSON.stringify(params));
    return hash.digest('hex');
  }
  
  async get(url, params) {
    const key = this.getCacheKey(url, params);
    
    // Check memory cache first
    if (this.cache.has(key)) {
      const cached = this.cache.get(key);
      if (Date.now() - cached.timestamp < 3600000) { // 1 hour
        console.log(`✅ Memory cache hit for ${url}`);
        return cached.data;
      }
    }
    
    // Check S3 cache for larger results
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
    
    // Store in memory if small
    if (JSON.stringify(data).length < 100000) {
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
    }
    
    // Store in S3 for persistence
    try {
      const s3Key = `cache/${key}.json`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.ARTIFACTS_BUCKET,
        Key: s3Key,
        Body: JSON.stringify(data),
        ContentType: 'application/json',
        Metadata: {
          url,
          timestamp: Date.now().toString()
        }
      }));
    } catch (err) {
      console.error('Failed to cache to S3:', err.message);
    }
  }
}

const cache = new ResultCache();

// === OPTIMIZATION 2: Parallel Processing ===
async function processInParallel(tasks, maxConcurrent = 5) {
  const results = [];
  const executing = [];
  
  for (const task of tasks) {
    const promise = task().then(result => {
      results.push(result);
      return result;
    }).catch(err => {
      results.push({ error: err.message });
      return { error: err.message };
    });
    
    executing.push(promise);
    
    if (executing.length >= maxConcurrent) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }
  
  await Promise.all(executing);
  return results;
}

// === OPTIMIZATION 3: Lightweight Scraping First ===
async function lightweightScrape(url) {
  try {
    // Try simple fetch first - MUCH faster than browser
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(QUICK_SCRAPE_TIMEOUT)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Quick check if content is actually there
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
    // Fallback to browser will happen
    throw err;
  }
}

// === OPTIMIZATION 4: Shared Browser Instance ===
let sharedBrowser = null;
let browserLaunchTime = 0;

async function getSharedBrowser() {
  // Reuse browser for 2 minutes
  if (sharedBrowser && Date.now() - browserLaunchTime < 120000) {
    return sharedBrowser;
  }
  
  // Close old browser
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => {});
  }
  
  // Launch new browser
  sharedBrowser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  browserLaunchTime = Date.now();
  return sharedBrowser;
}

// === OPTIMIZATION 5: Smart Scraping Strategy ===
async function smartScrape(url, options = {}) {
  // Check cache first
  const cached = await cache.get(url, options);
  if (cached) return cached;
  
  let result;
  
  // Try lightweight first (95% faster)
  try {
    result = await lightweightScrape(url);
    console.log(`✅ Lightweight scrape succeeded for ${url}`);
  } catch (err) {
    console.log(`⚠️ Lightweight failed, using browser for ${url}`);
    
    // Use browser only when necessary
    const browser = await getSharedBrowser();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    const page = await context.newPage();
    
    // Aggressive resource blocking for speed
    await page.route('**/*', route => {
      const resourceType = route.request().resourceType();
      if (['stylesheet', 'image', 'media', 'font', 'other'].includes(resourceType)) {
        return route.abort();
      }
      route.continue();
    });
    
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded', // Don't wait for everything
        timeout: BROWSER_TIMEOUT
      });
      
      // Quick wait for dynamic content
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
  
  // Cache the result
  await cache.set(url, options, result);
  return result;
}

// === OPTIMIZATION 6: Progressive Result Streaming ===
async function streamResults(jobId, results) {
  // Don't wait for all results - stream them as they complete
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

// === OPTIMIZATION 7: Minimal LLM Processing ===
async function extractWithMinimalLLM(content, prompt, openai) {
  // Use the cheapest, fastest model
  // Only extract what's needed, not everything
  
  // Truncate content aggressively
  const truncatedContent = content.substring(0, 4000);
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Much faster and cheaper than GPT-4
      messages: [
        {
          role: 'system',
          content: 'Extract only the requested information. Be concise.'
        },
        {
          role: 'user',
          content: `${prompt}\n\nContent:\n${truncatedContent}`
        }
      ],
      max_tokens: 500, // Limit output size
      temperature: 0.1 // More deterministic = faster
    });
    
    return response.choices[0].message.content;
  } catch (err) {
    console.error('LLM extraction failed:', err);
    // Return structured content without LLM
    return {
      error: 'LLM extraction failed',
      rawContent: truncatedContent
    };
  }
}

// === OPTIMIZATION 8: Smart Orchestration ===
async function optimizedAutonomousExtraction(jobId, params) {
  const startTime = Date.now();
  const results = [];
  
  console.log(`🚀 Starting optimized extraction for ${params.url}`);
  
  // Step 1: Quick discovery (don't over-analyze)
  const basePageData = await smartScrape(params.url);
  const $ = cheerio.load(basePageData.html);
  
  // Find links efficiently
  const links = [];
  $('a[href]').each((i, el) => {
    if (i >= 20) return false; // Limit to 20 links max
    const href = $(el).attr('href');
    if (href && href.startsWith('http')) {
      links.push(href);
    }
  });
  
  console.log(`Found ${links.length} links to process`);
  
  // Step 2: Process in parallel batches
  const BATCH_SIZE = 5;
  const MAX_PAGES = Math.min(params.maxPages || 10, 10); // Hard limit of 10
  
  for (let i = 0; i < Math.min(links.length, MAX_PAGES); i += BATCH_SIZE) {
    const batch = links.slice(i, i + BATCH_SIZE);
    
    // Check time remaining
    const elapsed = Date.now() - startTime;
    if (elapsed > LAMBDA_TIMEOUT - 60000) { // 1 minute buffer
      console.log('⏰ Time limit approaching, finishing with current results');
      break;
    }
    
    // Process batch in parallel
    const batchTasks = batch.map(url => async () => {
      try {
        const pageData = await smartScrape(url);
        
        // Extract without heavy LLM if we're running low on time
        const timeLeft = LAMBDA_TIMEOUT - (Date.now() - startTime);
        let extracted;
        
        if (timeLeft > 120000 && process.env.OPENAI_API_KEY) { // 2 minutes left
          const OpenAI = require('openai');
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          extracted = await extractWithMinimalLLM(
            pageData.markdown,
            params.prompt || 'Extract key information',
            openai
          );
        } else {
          // Just return structured data without LLM
          extracted = {
            url,
            title: pageData.metadata.title,
            content: pageData.markdown.substring(0, 1000)
          };
        }
        
        return {
          url,
          data: extracted,
          method: pageData.method
        };
      } catch (err) {
        return { url, error: err.message };
      }
    });
    
    const batchResults = await processInParallel(batchTasks, BATCH_SIZE);
    results.push(...batchResults.filter(r => !r.error));
    
    // Stream partial results
    await streamResults(jobId, results);
    
    console.log(`✅ Completed batch ${i / BATCH_SIZE + 1}, total results: ${results.length}`);
  }
  
  // Step 3: Quick synthesis (no heavy processing)
  const summary = {
    url: params.url,
    pages_processed: results.length,
    execution_time: Math.round((Date.now() - startTime) / 1000),
    results: results
  };
  
  return summary;
}

// === MAIN HANDLER ===
async function processExtractJob(jobId, params) {
  const startTime = Date.now();
  
  try {
    await updateJobStatus(jobId, 'processing');
    
    let result;
    
    // Use optimized extraction for autonomous/wildcard mode
    if (params.autonomous || params.wildcard || params.agentic) {
      result = await optimizedAutonomousExtraction(jobId, params);
    } else {
      // Single page extraction
      const pageData = await smartScrape(params.url);
      
      if (process.env.OPENAI_API_KEY && params.prompt) {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        const extracted = await extractWithMinimalLLM(
          pageData.markdown,
          params.prompt,
          openai
        );
        
        result = {
          url: params.url,
          extractedData: extracted,
          metadata: pageData.metadata
        };
      } else {
        result = {
          url: params.url,
          content: pageData.markdown,
          metadata: pageData.metadata
        };
      }
    }
    
    // Save results
    await updateJobStatus(jobId, 'completed', result);
    
    console.log(`✅ Job ${jobId} completed in ${Math.round((Date.now() - startTime) / 1000)}s`);
    return result;
    
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  } finally {
    // Cleanup shared browser on Lambda shutdown
    if (sharedBrowser) {
      await sharedBrowser.close().catch(() => {});
    }
  }
}

// === HELPER FUNCTIONS ===
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

// === LAMBDA HANDLER ===
exports.handler = async (event, context) => {
  console.log('Optimized Worker started');
  const results = [];
  
  for (const record of event.Records) {
    const startTime = Date.now();
    let jobId;
    
    try {
      const message = JSON.parse(record.body);
      jobId = message.jobId;
      const { type, params } = message;
      
      console.log(`Processing ${type || 'extract'} job ${jobId}`);
      
      // Check available time
      const timeRemaining = context.getRemainingTimeInMillis();
      if (timeRemaining < 30000) { // Less than 30 seconds
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