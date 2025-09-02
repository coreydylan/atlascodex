// Atlas Codex API Server - Hyperbrowser Compatible
// This is your MVP that can be deployed TODAY

import Fastify from 'fastify';
import puppeteer from 'puppeteer-core';
import { nanoid } from 'nanoid';
import Redis from 'ioredis';
import { z } from 'zod';
import OpenAI from 'openai';
import crypto from 'crypto';

// Initialize services
const fastify = Fastify({ logger: true });
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Browser pool management
class BrowserPool {
  constructor() {
    this.browsers = [];
    this.contexts = new Map();
    this.minBrowsers = 2;
    this.maxBrowsers = 10;
  }

  async initialize() {
    // Pre-warm browsers
    for (let i = 0; i < this.minBrowsers; i++) {
      await this.createBrowser();
    }
  }

  async createBrowser() {
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-default-apps',
        '--disable-background-networking',
        '--disable-sync',
        '--no-first-run',
        '--disable-translate',
        '--disable-features=TranslateUI'
      ]
    });
    this.browsers.push(browser);
    return browser;
  }

  async getContext(options = {}) {
    // Get a browser with available capacity
    let browser = this.browsers.find(b => b.contexts?.length < 10);
    
    if (!browser && this.browsers.length < this.maxBrowsers) {
      browser = await this.createBrowser();
    } else if (!browser) {
      browser = this.browsers[0]; // Use first browser if at max
    }

    // Create context with options
    const context = await browser.newContext({
      viewport: options.viewport || { width: 1920, height: 1080 },
      userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      locale: options.locale || 'en-US',
      ...options
    });

    const contextId = nanoid();
    this.contexts.set(contextId, { context, browser });
    
    return { context, contextId };
  }

  async releaseContext(contextId) {
    const item = this.contexts.get(contextId);
    if (item) {
      await item.context.close();
      this.contexts.delete(contextId);
    }
  }
}

const browserPool = new BrowserPool();

// Intelligent request router (your secret sauce)
class RequestRouter {
  async shouldUseBrowser(url) {
    // Quick heuristics to determine if browser is needed
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        timeout: 2000 
      });
      
      const contentType = response.headers.get('content-type');
      
      // PDFs, images, etc don't need browser
      if (!contentType?.includes('text/html')) {
        return false;
      }

      // Check if it's likely a static site
      const headers = response.headers;
      if (headers.get('x-powered-by')?.includes('Next.js') ||
          headers.get('server')?.includes('nginx')) {
        // These often work without browser
        return false;
      }

      return true; // Default to using browser
    } catch {
      return true; // If HEAD fails, probably needs browser
    }
  }

  async extractWithoutBrowser(url) {
    const response = await fetch(url);
    const html = await response.text();
    
    // Use cheerio or similar for basic extraction
    // For MVP, just return the HTML
    return {
      html,
      markdown: this.htmlToMarkdown(html),
      links: this.extractLinks(html)
    };
  }

  htmlToMarkdown(html) {
    // Simple conversion - use turndown or similar in production
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  extractLinks(html) {
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    const links = [];
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      links.push({
        href: match[1],
        text: match[2].trim()
      });
    }
    
    return links;
  }
}

const router = new RequestRouter();

// Job management
class JobManager {
  async createJob(type, params) {
    const jobId = `${type}_${nanoid()}`;
    const job = {
      jobId,
      type,
      status: 'pending',
      params,
      createdAt: new Date().toISOString()
    };
    
    await redis.set(`job:${jobId}`, JSON.stringify(job), 'EX', 3600);
    
    // Process job async
    this.processJob(job);
    
    return jobId;
  }

  async getJob(jobId) {
    const data = await redis.get(`job:${jobId}`);
    return data ? JSON.parse(data) : null;
  }

  async updateJob(jobId, updates) {
    const job = await this.getJob(jobId);
    if (job) {
      Object.assign(job, updates);
      await redis.set(`job:${jobId}`, JSON.stringify(job), 'EX', 3600);
    }
    return job;
  }

  async processJob(job) {
    try {
      await this.updateJob(job.jobId, { status: 'running' });
      
      let result;
      switch (job.type) {
        case 'scrape':
          result = await this.processScrape(job.params);
          break;
        case 'extract':
          result = await this.processExtract(job.params);
          break;
        case 'crawl':
          result = await this.processCrawl(job.params);
          break;
      }
      
      await this.updateJob(job.jobId, {
        status: 'completed',
        data: result,
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      await this.updateJob(job.jobId, {
        status: 'failed',
        error: error.message,
        completedAt: new Date().toISOString()
      });
    }
  }

  async processScrape(params) {
    const { url, scrapeOptions = {}, sessionOptions = {} } = params;
    
    // Check if browser is needed
    const needsBrowser = await router.shouldUseBrowser(url);
    
    if (!needsBrowser && !sessionOptions.forceRender) {
      // Fast path - no browser needed
      return await router.extractWithoutBrowser(url);
    }

    // Browser path
    const { context, contextId } = await browserPool.getContext(sessionOptions);
    
    try {
      const page = await context.newPage();
      
      // Configure page
      if (scrapeOptions.headers) {
        await page.setExtraHTTPHeaders(scrapeOptions.headers);
      }
      
      // Block resources if specified
      if (sessionOptions.blockAds) {
        await page.route('**/*', (route) => {
          const url = route.request().url();
          if (url.includes('doubleclick') || 
              url.includes('google-analytics') ||
              url.includes('facebook')) {
            route.abort();
          } else {
            route.continue();
          }
        });
      }
      
      // Navigate
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: scrapeOptions.timeout || 30000 
      });
      
      // Wait if specified
      if (scrapeOptions.waitFor) {
        await page.waitForTimeout(scrapeOptions.waitFor);
      }
      
      // Extract data
      const data = {
        url,
        metadata: await page.evaluate(() => ({
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.content,
          language: document.documentElement.lang,
          author: document.querySelector('meta[name="author"]')?.content
        })),
        html: await page.content(),
        markdown: await page.evaluate(() => document.body.innerText),
        links: await page.evaluate(() => 
          Array.from(document.querySelectorAll('a')).map(a => ({
            href: a.href,
            text: a.textContent.trim()
          }))
        )
      };
      
      // Screenshot if requested
      if (scrapeOptions.formats?.includes('screenshot')) {
        const screenshot = await page.screenshot({ fullPage: true });
        // Store in S3/R2 in production
        data.screenshot = `data:image/png;base64,${screenshot.toString('base64')}`;
      }
      
      // Add evidence (Atlas Codex special)
      data.evidence = {
        hash: crypto.createHash('sha256').update(data.html).digest('hex'),
        timestamp: new Date().toISOString(),
        browserUsed: true
      };
      
      return data;
    } finally {
      await browserPool.releaseContext(contextId);
    }
  }

  async processExtract(params) {
    const { url, schema, prompt, model = 'gpt-4o-mini' } = params;
    
    // First scrape the page
    const scrapeResult = await this.processScrape({ url });
    
    // Use OpenAI to extract structured data
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Extract structured data according to this schema: ${JSON.stringify(schema)}`
        },
        {
          role: 'user',
          content: `${prompt}\n\nContent:\n${scrapeResult.markdown}`
        }
      ],
      response_format: { type: 'json_object' }
    });
    
    const extracted = JSON.parse(completion.choices[0].message.content);
    
    return {
      url,
      extracted,
      confidence: 0.95, // Calculate based on model confidence
      evidence: {
        ...scrapeResult.evidence,
        model,
        tokens: completion.usage.total_tokens
      }
    };
  }

  async processCrawl(params) {
    const { url, maxPages = 10, includePatterns = [], excludePatterns = [] } = params;
    
    const pages = [];
    const visited = new Set();
    const toVisit = [url];
    
    while (toVisit.length > 0 && pages.length < maxPages) {
      const currentUrl = toVisit.shift();
      
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);
      
      // Check patterns
      if (excludePatterns.some(p => currentUrl.includes(p))) continue;
      if (includePatterns.length && !includePatterns.some(p => currentUrl.includes(p))) continue;
      
      try {
        const pageData = await this.processScrape({ url: currentUrl });
        pages.push({
          url: currentUrl,
          status: 'success',
          data: pageData
        });
        
        // Add discovered links to queue
        if (params.followLinks) {
          pageData.links.forEach(link => {
            if (!visited.has(link.href) && link.href.startsWith(url)) {
              toVisit.push(link.href);
            }
          });
        }
      } catch (error) {
        pages.push({
          url: currentUrl,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    return {
      stats: {
        totalPages: pages.length,
        successfulPages: pages.filter(p => p.status === 'success').length,
        failedPages: pages.filter(p => p.status === 'failed').length
      },
      pages
    };
  }
}

const jobManager = new JobManager();

// API Routes
fastify.post('/api/scrape', async (request, reply) => {
  const jobId = await jobManager.createJob('scrape', request.body);
  return { jobId, status: 'pending' };
});

fastify.get('/api/scrape/:jobId', async (request, reply) => {
  const job = await jobManager.getJob(request.params.jobId);
  if (!job) {
    return reply.code(404).send({ error: 'Job not found' });
  }
  return job;
});

fastify.post('/api/extract', async (request, reply) => {
  const jobId = await jobManager.createJob('extract', request.body);
  return { jobId, status: 'pending' };
});

fastify.get('/api/extract/:jobId', async (request, reply) => {
  const job = await jobManager.getJob(request.params.jobId);
  if (!job) {
    return reply.code(404).send({ error: 'Job not found' });
  }
  return job;
});

fastify.post('/api/crawl', async (request, reply) => {
  const jobId = await jobManager.createJob('crawl', request.body);
  return { jobId, status: 'pending' };
});

fastify.get('/api/crawl/:jobId', async (request, reply) => {
  const job = await jobManager.getJob(request.params.jobId);
  if (!job) {
    return reply.code(404).send({ error: 'Job not found' });
  }
  return job;
});

// Health check
fastify.get('/health', async () => {
  return { 
    status: 'healthy',
    browsers: browserPool.browsers.length,
    contexts: browserPool.contexts.size
  };
});

// Start server
const start = async () => {
  try {
    await browserPool.initialize();
    await fastify.listen({ 
      port: process.env.PORT || 3000,
      host: '0.0.0.0' 
    });
    console.log('Atlas Codex API running on port', process.env.PORT || 3000);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();