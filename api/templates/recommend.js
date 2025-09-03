// Template Recommendations
export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { url, userQuery } = req.body;
    
    if (!url || !userQuery) {
      return res.status(400).json({ 
        error: 'Missing required fields: url and userQuery' 
      });
    }

    // Mock template matching based on query
    const recommendations = [];
    const query = userQuery.toLowerCase();
    
    if (query.includes('faculty') || query.includes('professor')) {
      recommendations.push({
        templateId: 'faculty_listing_v1_0_0',
        confidence: 0.89,
        accuracy: 0.89,
        matchReasons: ['Faculty-specific keywords detected', 'Academic domain match'],
        provenance: 'hybrid'
      });
    }
    
    if (query.includes('people') || query.includes('team') || query.includes('staff') || query.includes('members')) {
      recommendations.push({
        templateId: 'people_directory_v1_0_0',
        confidence: 0.92,
        accuracy: 0.92,
        matchReasons: ['People directory patterns', 'Team structure indicators'],
        provenance: 'human'
      });
    }

    // Always return at least one recommendation for demo
    if (recommendations.length === 0) {
      recommendations.push({
        templateId: 'generic_extraction_v1_0_0',
        confidence: 0.75,
        accuracy: 0.82,
        matchReasons: ['General content extraction patterns'],
        provenance: 'llm'
      });
    }

    return res.status(200).json({
      success: true,
      recommendations,
      count: recommendations.length
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}