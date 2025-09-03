// Template-Enhanced Extraction
export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { url, extractPrompt, generateDisplay } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'Missing required field: url' });
    }

    // Generate mock data based on URL and prompt
    let mockData = [];
    let templateId = 'generic_extraction_v1_0_0';
    
    const prompt = (extractPrompt || '').toLowerCase();
    const urlLower = url.toLowerCase();
    
    // Faculty/Academic data
    if (prompt.includes('faculty') || urlLower.includes('faculty') || prompt.includes('professor')) {
      templateId = 'faculty_listing_v1_0_0';
      mockData = [
        {
          name: "Dr. Sarah Johnson",
          title: "Professor of Computer Science",
          department: "Computer Science",
          email: "sarah.johnson@stanford.edu",
          research_areas: ["Machine Learning", "AI", "Data Mining"]
        },
        {
          name: "Prof. Michael Chen", 
          title: "Associate Professor",
          department: "Computer Science",
          email: "m.chen@stanford.edu",
          research_areas: ["Distributed Systems", "Cloud Computing"]
        },
        {
          name: "Dr. Lisa Wang",
          title: "Assistant Professor", 
          department: "Computer Science",
          email: "lisa.wang@stanford.edu",
          research_areas: ["Human-Computer Interaction", "UX Design"]
        }
      ];
    }
    // Team/People data
    else if (prompt.includes('team') || prompt.includes('people') || prompt.includes('staff')) {
      templateId = 'people_directory_v1_0_0';
      mockData = [
        {
          name: "Alex Rodriguez",
          title: "Lead Software Engineer", 
          bio: "Alex leads our backend development team and specializes in scalable architecture.",
          email: "alex@company.com"
        },
        {
          name: "Maya Patel",
          title: "UX Designer",
          bio: "Maya creates beautiful and intuitive user experiences for our products.",
          email: "maya@company.com"
        },
        {
          name: "David Kim",
          title: "Product Manager",
          bio: "David drives product strategy and works closely with engineering and design.",
          email: "david@company.com"
        }
      ];
    }
    // Generic extraction
    else {
      mockData = [
        {
          title: "Extracted Content",
          description: "Sample extracted data from " + url,
          content: "This is mock extracted content that demonstrates the template system capabilities."
        }
      ];
    }

    const result = {
      success: true,
      data: mockData,
      template: {
        id: templateId,
        confidence: 0.92,
        match_reasons: ['Template matched based on content analysis', 'High confidence semantic match']
      },
      metadata: {
        extractionTime: Math.random() * 2 + 1, // 1-3 seconds
        cost: Math.random() * 0.1 + 0.05, // $0.05-$0.15
        strategy: 'template_enhanced'
      }
    };

    if (generateDisplay) {
      result.displaySpec = {
        template_id: 'profile_cards_v1_0_0',
        spec: {
          template_name: 'Profile Cards',
          layout: { 
            kind: 'grid', 
            columns: { mobile: 1, tablet: 2, desktop: 3 },
            gap: '1rem'
          },
          components: [
            { 
              type: 'ProfileCard', 
              bind: 'person', 
              props: { 
                showEmail: true,
                showDepartment: true,
                layout: 'vertical'
              } 
            }
          ]
        },
        confidence: 0.85
      };
    }

    return res.status(200).json(result);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}