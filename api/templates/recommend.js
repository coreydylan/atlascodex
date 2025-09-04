// Template Recommendations with URL Analysis
export default function handler(req, res) {
  return handleAsync(req, res);
}

async function handleAsync(req, res) {
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

    try {
      console.log('Template recommendation requested:', { url, userQuery });
      
      // Analyze URL and query for intelligent template matching
      const recommendations = analyzeUrlAndQuery(url, userQuery);
      
      // Try to fetch page title/meta for enhanced matching
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          timeout: 5000,
          headers: {
            'User-Agent': 'Atlas-Codex-Template-Analyzer/1.0'
          }
        });
        
        if (response.ok) {
          // Enhance confidence if URL is reachable
          recommendations.forEach(rec => {
            rec.confidence = Math.min(rec.confidence + 0.1, 1.0);
            rec.matchReasons.push('URL verified as accessible');
          });
        }
      } catch (urlError) {
        console.log('URL check failed, using query-only analysis:', urlError.message);
        // Reduce confidence for unreachable URLs
        recommendations.forEach(rec => {
          rec.confidence = Math.max(rec.confidence - 0.05, 0.1);
          rec.matchReasons.push('URL accessibility could not be verified');
        });
      }

      return res.status(200).json({
        success: true,
        recommendations,
        count: recommendations.length,
        analysis: {
          url_domain: getDomain(url),
          query_keywords: extractKeywords(userQuery),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Template recommendation error:', error);
      
      // Fallback to basic analysis
      const basicRecommendations = analyzeUrlAndQuery(url, userQuery);
      
      return res.status(200).json({
        success: true,
        recommendations: basicRecommendations,
        count: basicRecommendations.length,
        warning: 'Used fallback analysis due to error: ' + error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Intelligent URL and query analysis
function analyzeUrlAndQuery(url, query) {
  const urlLower = url.toLowerCase();
  const queryLower = query.toLowerCase();
  const domain = getDomain(url);
  const recommendations = [];

  // Academic/Faculty template matching
  if (queryLower.includes('faculty') || queryLower.includes('professor') || 
      urlLower.includes('faculty') || urlLower.includes('cs.') || 
      urlLower.includes('.edu') || urlLower.includes('academic') ||
      domain.includes('stanford') || domain.includes('mit') || domain.includes('berkeley')) {
    
    let confidence = 0.85;
    const reasons = ['Faculty/academic keywords detected'];
    
    if (urlLower.includes('.edu')) {
      confidence += 0.1;
      reasons.push('Educational domain (.edu) detected');
    }
    if (queryLower.includes('contact') || queryLower.includes('email')) {
      confidence += 0.05;
      reasons.push('Contact information requested');
    }
    
    recommendations.push({
      templateId: 'faculty_listing_v1_0_0',
      confidence: Math.min(confidence, 1.0),
      accuracy: 0.89,
      matchReasons: reasons,
      provenance: 'hybrid',
      description: 'Optimized for extracting faculty profiles with names, titles, departments, and research areas'
    });
  }
  
  // People/Team template matching
  if (queryLower.includes('team') || queryLower.includes('people') || 
      queryLower.includes('staff') || queryLower.includes('members') ||
      queryLower.includes('employee') || urlLower.includes('team') ||
      urlLower.includes('people') || urlLower.includes('about')) {
    
    let confidence = 0.88;
    const reasons = ['Team/people keywords detected'];
    
    if (queryLower.includes('role') || queryLower.includes('title')) {
      confidence += 0.05;
      reasons.push('Role/title information requested');
    }
    if (urlLower.includes('about') || urlLower.includes('team')) {
      confidence += 0.05;
      reasons.push('Team/about page URL pattern');
    }
    
    recommendations.push({
      templateId: 'people_directory_v1_0_0',
      confidence: Math.min(confidence, 1.0),
      accuracy: 0.92,
      matchReasons: reasons,
      provenance: 'human',
      description: 'Optimized for extracting team member profiles with names, roles, and biographical information'
    });
  }

  // Product catalog template
  if (queryLower.includes('product') || queryLower.includes('item') ||
      queryLower.includes('catalog') || queryLower.includes('shop') ||
      urlLower.includes('shop') || urlLower.includes('store') ||
      urlLower.includes('catalog') || queryLower.includes('price')) {
    
    recommendations.push({
      templateId: 'product_catalog_v1_0_0',
      confidence: 0.82,
      accuracy: 0.86,
      matchReasons: ['Product/catalog keywords detected', 'E-commerce patterns identified'],
      provenance: 'llm',
      description: 'Optimized for extracting product information with names, prices, and descriptions'
    });
  }

  // News/Articles template
  if (queryLower.includes('news') || queryLower.includes('article') ||
      queryLower.includes('blog') || urlLower.includes('news') ||
      urlLower.includes('blog') || queryLower.includes('post')) {
    
    recommendations.push({
      templateId: 'news_articles_v1_0_0',
      confidence: 0.79,
      accuracy: 0.84,
      matchReasons: ['News/article keywords detected', 'Content publication patterns'],
      provenance: 'hybrid',
      description: 'Optimized for extracting articles with titles, authors, dates, and content'
    });
  }

  // Always provide a generic fallback
  if (recommendations.length === 0) {
    recommendations.push({
      templateId: 'generic_extraction_v1_0_0',
      confidence: 0.75,
      accuracy: 0.82,
      matchReasons: ['No specific template matched, using adaptive extraction'],
      provenance: 'llm',
      description: 'General-purpose extraction that adapts to page structure'
    });
  } else {
    // Add generic as lower-confidence option
    recommendations.push({
      templateId: 'generic_extraction_v1_0_0',
      confidence: 0.65,
      accuracy: 0.82,
      matchReasons: ['Generic fallback option'],
      provenance: 'llm',
      description: 'General-purpose extraction as alternative approach'
    });
  }

  // Sort by confidence (highest first)
  return recommendations
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4); // Return top 4 recommendations
}

// Extract domain from URL
function getDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// Extract keywords from query
function extractKeywords(query) {
  return query.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['the', 'and', 'with', 'from', 'their', 'all'].includes(word))
    .slice(0, 10);
}