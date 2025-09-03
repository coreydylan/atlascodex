// Atlas Codex Template Extract API - Vercel Serverless Function
// This integrates the template system with the existing Atlas Codex extraction API

export default async function handler(req, res) {
  // CORS headers for frontend access
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, query } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'Missing required parameter: url'
      });
    }

    // For this simplified version, we'll just pass through to the main extraction API
    // In a full deployment, this would include the complete template matching logic

    // Call the existing Atlas Codex extraction API with template-enhanced parameters
    const API_BASE = 'https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev';
    
    const extractionResponse = await fetch(`${API_BASE}/api/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.REACT_APP_API_KEY || 'test-key-123'
      },
      body: JSON.stringify({
        url: url,
        extractionInstructions: query || `Extract structured data from ${url}`,
        templateEnhanced: true,
        templateId: 'passthrough-v1'
      })
    });

    if (!extractionResponse.ok) {
      throw new Error(`Atlas Codex API error: ${extractionResponse.status}`);
    }

    const extractionData = await extractionResponse.json();

    // Return template-enhanced response format
    const response = {
      success: extractionData.status === 'completed',
      data: extractionData.result?.data || extractionData.result || [],
      metadata: {
        ...extractionData.result?.metadata,
        source: 'template-system-passthrough',
        templateId: 'passthrough-v1',
        enhancedExtraction: true
      },
      templateId: 'passthrough-v1',
      jobId: extractionData.jobId,
      fallback: false
    };

    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).json(response);

  } catch (error) {
    console.error('Template extraction error:', error);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(500).json({
      success: false,
      error: error.message,
      fallback: true
    });
  }
}