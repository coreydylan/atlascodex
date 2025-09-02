// Simple Atlas Codex API with CORS
const http = require('http');

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '3.0.0',
      message: 'Atlas Codex API on AWS'
    }));
    return;
  }

  // Extract endpoint
  if (req.url === '/extract' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jobId,
          status: 'processing',
          url: data.url,
          strategy: data.strategy || 'auto'
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Job status endpoint
  if (req.url.startsWith('/jobs/') && req.method === 'GET') {
    const jobId = req.url.replace('/jobs/', '');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jobId,
      status: 'completed',
      result: {
        title: 'Sample Extraction',
        content: 'This is extracted content from Atlas Codex',
        extractedAt: new Date().toISOString()
      }
    }));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Atlas Codex API running on port ${PORT}`);
});