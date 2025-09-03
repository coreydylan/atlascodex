// Atlas Codex Template System API
// Serverless function with bundled dependencies

// Mock implementations for serverless environment
class MockVectorIndex {
  constructor() {
    this.embeddings = new Map();
  }

  async embed(text) {
    const hash = this.simpleHash(text);
    return Array.from({ length: 384 }, (_, i) => Math.sin(hash + i) * 0.1);
  }

  async search(queryEmbedding, limit) {
    // Return mock search results for demo
    return [
      { id: 'people_directory_v1_0_0', score: 0.95 },
      { id: 'faculty_listing_v1_0_0', score: 0.87 },
      { id: 'team_members_v1_0_0', score: 0.82 }
    ].slice(0, limit);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// Mock template data
const mockTemplates = {
  'people_directory_v1_0_0': {
    id: 'people_directory_v1_0_0',
    trigger_patterns: ['staff', 'team', 'people', 'faculty', 'directory'],
    confidence_indicators: ['name', 'title', 'bio', 'contact'],
    success_metrics: { accuracy: 0.92, usage_count: 150, drift_score: 0.1 },
    provenance: 'human',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name' },
          title: { type: 'string', description: 'Job title or role' },
          bio: { type: 'string', description: 'Biography or description' },
          email: { type: 'string', format: 'email', pii: true }
        }
      }
    }
  },
  'faculty_listing_v1_0_0': {
    id: 'faculty_listing_v1_0_0',
    trigger_patterns: ['faculty', 'professor', 'academic', 'research'],
    confidence_indicators: ['professor', 'PhD', 'department', 'research'],
    success_metrics: { accuracy: 0.89, usage_count: 89, drift_score: 0.15 },
    provenance: 'hybrid',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Faculty name' },
          department: { type: 'string', description: 'Academic department' },
          research_areas: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
};

// Main API handler
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { method } = req;
    const path = req.url.split('?')[0];
    let body = {};
    
    // Parse body for POST requests
    if (method === 'POST' && req.body) {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    console.log('Template API Request:', { method, path, body });

    // Template recommendations endpoint
    if (method === 'POST' && path.includes('/recommend')) {
      const { url, userQuery } = body;
      
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
      
      if (query.includes('people') || query.includes('team') || query.includes('staff')) {
        recommendations.push({
          templateId: 'people_directory_v1_0_0',
          confidence: 0.92,
          accuracy: 0.92,
          matchReasons: ['People directory patterns', 'Team structure indicators'],
          provenance: 'human'
        });
      }

      return res.status(200).json({
        success: true,
        recommendations,
        count: recommendations.length
      });
    }

    // Template-enhanced extraction endpoint
    if (method === 'POST' && path.includes('/extract')) {
      const { url, extractPrompt, generateDisplay } = body;
      
      if (!url) {
        return res.status(400).json({ error: 'Missing required field: url' });
      }

      // Simulate template-enhanced extraction
      const mockResult = {
        success: true,
        data: [
          {
            name: "Dr. Sarah Johnson",
            title: "Professor of Computer Science",
            bio: "Dr. Johnson specializes in machine learning and artificial intelligence research.",
            department: "Computer Science"
          },
          {
            name: "Prof. Michael Chen",
            title: "Associate Professor",
            bio: "Prof. Chen's research focuses on distributed systems and cloud computing.",
            department: "Computer Science"
          }
        ],
        template: {
          id: 'people_directory_v1_0_0',
          confidence: 0.92,
          match_reasons: ['People directory patterns detected', 'Academic context match']
        },
        metadata: {
          extractionTime: 1.4,
          cost: 0.08,
          strategy: 'template_enhanced'
        }
      };

      if (generateDisplay) {
        mockResult.displaySpec = {
          template_id: 'academic_profile_cards_v1_0_0',
          spec: {
            template_name: 'Academic Profile Cards',
            layout: { kind: 'grid', columns: { mobile: 1, tablet: 2, desktop: 3 } },
            components: [
              { type: 'ProfileCard', bind: 'person', props: { showDepartment: true } }
            ]
          },
          confidence: 0.85
        };
      }

      return res.status(200).json(mockResult);
    }

    // Template statistics endpoint
    if (method === 'GET' && path.includes('/stats')) {
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

    // Template evaluation endpoint
    if (method === 'GET' && path.includes('/eval')) {
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

    // Health check endpoint
    if (method === 'GET' && path.includes('/health')) {
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

    return res.status(404).json({ error: 'Template API endpoint not found' });

  } catch (error) {
    console.error('Template API Error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
};