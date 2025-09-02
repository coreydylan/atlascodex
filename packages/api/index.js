const http = require('http');
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: 'healthy', timestamp: new Date().toISOString()}));
  } else if (req.url === '/extract' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const jobId = 'job_' + Date.now();
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({jobId, status: 'processing'}));
    });
  } else if (req.url.startsWith('/jobs/')) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: 'completed', result: {title: 'Test', content: 'Sample'}}));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(3000, () => console.log('API on port 3000'));
