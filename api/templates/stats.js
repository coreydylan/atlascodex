// Template System Statistics
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
      stats: {
        totalExtractionTemplates: 23,
        totalDisplayTemplates: 15,
        avgAccuracy: 0.87,
        driftingTemplates: 2,
        templateUsage: {
          'people_directory_v1_0_0': 150,
          'faculty_listing_v1_0_0': 89,
          'product_catalog_v1_0_0': 67
        }
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}