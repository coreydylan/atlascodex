// Template System Evaluation
export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const mockEvaluation = {
      totalTests: 3,
      passed: 2,
      failed: 1,
      passRate: '66.7%',
      avgAccuracy: '84.3%',
      totalCost: '$0.0245',
      results: [
        {
          testName: 'Stanford CS Faculty Directory',
          success: true,
          accuracy: '92.1%',
          responseTime: '2.34s',
          templateUsed: 'faculty_listing_v1_0_0',
          error: null
        },
        {
          testName: 'MIT Team Directory',
          success: true,
          accuracy: '88.7%',
          responseTime: '1.89s',
          templateUsed: 'people_directory_v1_0_0',
          error: null
        },
        {
          testName: 'Complex Dynamic Site',
          success: false,
          accuracy: '72.1%',
          responseTime: '3.45s',
          templateUsed: null,
          error: 'Template matching failed'
        }
      ]
    };

    return res.status(200).json({
      success: true,
      evaluation: mockEvaluation
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}