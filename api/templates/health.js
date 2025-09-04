// Template System Health Check
export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      status: 'healthy',
      system: 'Atlas Codex Template System',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      features: {
        templateMatching: true,
        displayGeneration: true,
        evaluation: true,
        security: true,
        monitoring: true
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}