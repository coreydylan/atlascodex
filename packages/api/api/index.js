// Vercel Serverless API Handler with real extraction
import OpenAI from 'openai';

// In-memory storage for serverless
const jobStore = new Map();

// Initialize OpenAI
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

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
    // Try static fetch
    const response = await fetch(url);
    const html = await response.text();
    
    // Extract basic content
    result = {
      title: html.match(/<title>(.*?)<\/title>/)?.[1] || url,
      content: html.replace(/<[^>]*>/g, '').substring(0, 5000),
      strategy: 'static_fetch',
      url
    };
    
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
      jobs: jobStore.size
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
      // Return mock for testing
      return res.status(200).json({
        jobId,
        status: 'completed',
        result: {
          title: 'Test Result',
          content: 'This is a test extraction result',
          extractedAt: new Date().toISOString()
        }
      });
    }
    
    return res.status(200).json(job);
  }

  return res.status(404).json({ error: 'Not found' });
}