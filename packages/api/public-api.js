// Public API endpoint for Atlas Codex (bypasses Vercel auth)
export default async function handler(req, res) {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = req.url || '/';

  // Health endpoint
  if (path.includes('/health')) {
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.1.0',
      message: 'Atlas Codex API is running'
    });
  }

  // Extract endpoint
  if (path.includes('/extract') && req.method === 'POST') {
    const { url, strategy = 'auto' } = req.body || {};
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      // Simple extraction for testing
      const response = await fetch(url);
      const html = await response.text();
      
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return res.status(200).json({
        jobId,
        status: 'completed',
        url,
        strategy: 'static_fetch',
        result: {
          title: html.match(/<title>(.*?)<\/title>/)?.[1] || 'Untitled',
          content: html.replace(/<[^>]*>/g, '').substring(0, 1000),
          extractedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Extraction failed', 
        message: error.message 
      });
    }
  }

  // Job status endpoint
  if (path.includes('/jobs/') && req.method === 'GET') {
    const jobId = path.split('/jobs/')[1];
    
    return res.status(200).json({
      jobId,
      status: 'completed',
      result: {
        title: 'Test Result',
        content: 'This is a test extraction result for job ' + jobId,
        extractedAt: new Date().toISOString()
      }
    });
  }

  return res.status(404).json({ error: 'Not found', path });
}