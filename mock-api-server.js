#!/usr/bin/env node
// Mock API server for testing endpoints
const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Check API key for protected routes
  const apiKey = req.headers['x-api-key'];
  const protectedRoutes = ['/jobs', '/metrics', '/costs', '/extract'];
  
  if (protectedRoutes.some(route => path.startsWith(route)) && !apiKey && method !== 'GET') {
    res.writeHead(401);
    res.end(JSON.stringify({ error: 'API key required' }));
    return;
  }

  // Route handlers
  if (path === '/health' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        redis: 'connected',
        workers: 5,
        queue: { pending: 2, processing: 1 }
      }
    }));
  } else if (path === '/' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      name: 'Atlas Codex API',
      version: '1.0.0',
      status: 'ready'
    }));
  } else if (path === '/jobs' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body);
      if (!data.url) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'URL required' }));
        return;
      }
      res.writeHead(201);
      res.end(JSON.stringify({
        job: {
          id: 'job-' + Date.now(),
          url: data.url,
          status: 'pending',
          createdAt: new Date().toISOString()
        }
      }));
    });
  } else if (path.match(/^\/jobs\/[\w-]+$/) && method === 'GET') {
    const jobId = path.split('/')[2];
    if (jobId === 'invalid-job-id-xyz') {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Job not found' }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify({
      id: jobId,
      status: 'processing',
      progress: 45,
      url: 'https://example.com'
    }));
  } else if (path.match(/^\/jobs\/[\w-]+\/result$/) && method === 'GET') {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Job not completed' }));
  } else if (path === '/jobs/batch' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body);
      const jobs = (data.urls || []).map((url, i) => ({
        id: `job-batch-${Date.now()}-${i}`,
        url: url,
        status: 'pending'
      }));
      res.writeHead(201);
      res.end(JSON.stringify({ jobs }));
    });
  } else if (path === '/extract' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(202);
      res.end(JSON.stringify({
        job: {
          id: 'job-extract-' + Date.now(),
          status: 'processing'
        }
      }));
    });
  } else if (path === '/metrics' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      health: {
        status: 'healthy',
        uptime: 3600
      },
      performance: {
        avgResponseTime: 234,
        successRate: 0.98
      }
    }));
  } else if (path.startsWith('/costs') && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      totalCost: 125.50,
      avgCostPerExtraction: 0.15,
      period: '24h'
    }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
});