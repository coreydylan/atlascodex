// Simplified Atlas Codex API for Vercel deployment
import OpenAI from 'openai';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// In-memory storage (replaces Redis for serverless)
const jobStore = new Map();
const dipStore = new Map();

// Initialize OpenAI
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Browser instance for serverless
let browser = null;
async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
  }
  return browser;
}

// Core extraction logic
async function extract(url, strategy = 'auto') {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Store job
  jobStore.set(jobId, {
    id: jobId,
    url,
    strategy,
    status: 'processing',
    createdAt: new Date().toISOString()
  });
  
  // Process extraction asynchronously
  processExtraction(jobId, url, strategy).catch(err => {
    jobStore.set(jobId, {
      ...jobStore.get(jobId),
      status: 'failed',
      error: err.message,
      completedAt: new Date().toISOString()
    });
  });
  
  return { jobId, status: 'processing', url, strategy };
}

async function processExtraction(jobId, url, strategy) {
  let result = {};
  
  try {
    if (strategy === 'static_fetch' || strategy === 'auto') {
      // Try static fetch first
      const response = await fetch(url);
      const html = await response.text();
      
      // Extract basic content
      result = {
        title: html.match(/<title>(.*?)<\/title>/)?.[1] || url,
        content: html.replace(/<[^>]*>/g, '').substring(0, 5000),
        strategy: 'static_fetch'
      };
    }
    
    if (strategy === 'browser_render' || (strategy === 'auto' && !result.content)) {
      // Use browser for dynamic content
      const browser = await getBrowser();
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      result = {
        title: await page.title(),
        content: await page.evaluate(() => document.body.innerText),
        strategy: 'browser_render'
      };
      
      await page.close();
    }
    
    if (strategy === 'gpt5_direct') {
      // Use GPT-5 for intelligent extraction
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'Extract and summarize the key information from the provided URL content.'
          },
          {
            role: 'user',
            content: `URL: ${url}\nContent: ${result.content || 'Please analyze this URL'}`
          }
        ],
        max_tokens: 1000
      });
      
      result = {
        ...result,
        summary: response.choices[0].message.content,
        strategy: 'gpt5_direct'
      };
    }
    
    // Update job with result
    jobStore.set(jobId, {
      ...jobStore.get(jobId),
      status: 'completed',
      result,
      completedAt: new Date().toISOString()
    });
    
  } catch (error) {
    throw error;
  }
}

// API handler for Vercel
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const path = req.url.replace('/api', '');
  
  // Health endpoint
  if (path === '/health') {
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      jobs: jobStore.size,
      dips: dipStore.size
    });
  }
  
  // Extract endpoint
  if (path === '/extract' && req.method === 'POST') {
    const { url, strategy = 'auto' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    try {
      const result = await extract(url, strategy);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ 
        error: 'Extraction failed', 
        message: error.message 
      });
    }
  }
  
  // Job status endpoint
  if (path.startsWith('/jobs/') && req.method === 'GET') {
    const jobId = path.replace('/jobs/', '');
    const job = jobStore.get(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    return res.status(200).json(job);
  }
  
  // DIP endpoints
  if (path === '/dips' && req.method === 'POST') {
    const dip = {
      id: `dip_${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    
    dipStore.set(dip.id, dip);
    return res.status(201).json(dip);
  }
  
  if (path.startsWith('/dips/') && req.method === 'GET') {
    const dipId = path.replace('/dips/', '');
    const dip = dipStore.get(dipId);
    
    if (!dip) {
      return res.status(404).json({ error: 'DIP not found' });
    }
    
    return res.status(200).json(dip);
  }
  
  return res.status(404).json({ error: 'Not found' });
}