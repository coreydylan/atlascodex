// Atlas Codex: Comprehensive Accuracy Test Cases
// This is our ground truth for measuring extraction accuracy

export interface AccuracyTestCase {
  id: string;
  name: string;
  url: string;
  category: 'team_members' | 'products' | 'articles' | 'events' | 'mixed_content' | 'edge_cases';
  extractionInstructions: string;
  expectedResults: any;
  knownChallenges: string[];
  confidenceThreshold: number;
  lastValidated: string;
  priority: 'critical' | 'important' | 'normal';
  notes?: string;
}

export const ACCURACY_TEST_LIBRARY: AccuracyTestCase[] = [
  // ========================================
  // CRITICAL TEAM MEMBER EXTRACTION TESTS
  // ========================================
  
  {
    id: 'team_vmota_people',
    name: 'VMOTA Team Members (Known Duplicate Issue)',
    url: 'https://vmota.org/people',
    category: 'team_members',
    extractionInstructions: 'get the name, title, and bio for each team member',
    expectedResults: {
      people: [
        {
          name: 'Dr. Sarah Chen',
          title: 'Executive Director',
          bio: 'Dr. Chen leads strategic initiatives and oversees program development...'
        },
        {
          name: 'Michael Rodriguez', 
          title: 'Program Manager',
          bio: 'Michael coordinates cross-functional teams and manages project timelines...'
        },
        {
          name: 'Jennifer Kim',
          title: 'Research Scientist', 
          bio: 'Jennifer focuses on data analysis and research methodology...'
        }
        // Note: Exact names/titles need manual validation from actual page
      ]
    },
    knownChallenges: [
      'duplicate detection',
      'staff blocks vs individuals', 
      'aggregate content filtering',
      'compound person blocks'
    ],
    confidenceThreshold: 0.95,
    lastValidated: '2024-01-01',
    priority: 'critical',
    notes: 'Primary test case - must achieve perfect accuracy here'
  },

  {
    id: 'team_github_about',
    name: 'GitHub Leadership Team',
    url: 'https://github.com/about/leadership',
    category: 'team_members',
    extractionInstructions: 'extract leadership team names, titles, and brief descriptions',
    expectedResults: {
      people: [
        {
          name: 'Thomas Dohmke',
          title: 'Chief Executive Officer'
        },
        {
          name: 'Erica Brescia', 
          title: 'Chief Operating Officer'
        }
        // More leaders to be validated manually
      ]
    },
    knownChallenges: [
      'executive vs all employees',
      'title variations',
      'photo-based content'
    ],
    confidenceThreshold: 0.90,
    lastValidated: '2024-01-01', 
    priority: 'critical',
    notes: 'Well-structured leadership page - should be highly accurate'
  },

  {
    id: 'team_stanford_faculty', 
    name: 'Stanford CS Faculty Directory',
    url: 'https://cs.stanford.edu/people/faculty',
    category: 'team_members',
    extractionInstructions: 'extract faculty names, titles, and research areas',
    expectedResults: {
      people: [
        {
          name: 'Prof. Fei-Fei Li',
          title: 'Professor of Computer Science',
          bio: 'Human-Centered AI, Computer Vision, Cognitive Neuroscience'
        },
        {
          name: 'Prof. Andrew Ng',
          title: 'Adjunct Professor', 
          bio: 'Machine Learning, Deep Learning'
        }
        // More faculty to be validated
      ]
    },
    knownChallenges: [
      'academic title variations',
      'research area formatting', 
      'affiliate vs core faculty'
    ],
    confidenceThreshold: 0.92,
    lastValidated: '2024-01-01',
    priority: 'important',
    notes: 'Complex academic structure with various appointment types'
  },

  {
    id: 'team_ycombinator_partners',
    name: 'Y Combinator Partners', 
    url: 'https://www.ycombinator.com/people',
    category: 'team_members',
    extractionInstructions: 'get the names and roles of Y Combinator partners',
    expectedResults: {
      people: [
        {
          name: 'Garry Tan',
          title: 'President & CEO'
        },
        {
          name: 'Michael Seibel',
          title: 'Managing Director & Partner'
        }
        // More partners to be validated
      ]
    },
    knownChallenges: [
      'partner vs other roles',
      'title complexity',
      'photo grid layout'
    ],
    confidenceThreshold: 0.88,
    lastValidated: '2024-01-01',
    priority: 'important'
  },

  // ========================================
  // PRODUCT EXTRACTION TESTS  
  // ========================================

  {
    id: 'products_shopify_demo',
    name: 'Shopify Demo Store Products',
    url: 'https://hydrogen-preview.myshopify.com/products',
    category: 'products', 
    extractionInstructions: 'extract product names, prices, and availability status',
    expectedResults: {
      products: [
        {
          name: 'The Complete Snowboard',
          price: 699.95,
          availability: 'in_stock'
        },
        {
          name: 'The Multi-managed Snowboard', 
          price: 629.95,
          availability: 'in_stock'
        }
        // More products to be validated
      ]
    },
    knownChallenges: [
      'price formatting variations',
      'availability status detection',
      'variant vs base product'
    ],
    confidenceThreshold: 0.95,
    lastValidated: '2024-01-01',
    priority: 'critical',
    notes: 'E-commerce accuracy is crucial for commercial applications'
  },

  {
    id: 'products_apple_macbook',
    name: 'Apple MacBook Product Pages',
    url: 'https://www.apple.com/macbook-air/',
    category: 'products',
    extractionInstructions: 'extract MacBook models, prices, and key specifications',
    expectedResults: {
      products: [
        {
          name: 'MacBook Air 13"',
          price: 999,
          specifications: ['M2 chip', '8GB memory', '256GB storage']
        }
        // To be validated with actual page content
      ]
    },
    knownChallenges: [
      'configuration variations',
      'price display complexity',
      'specification extraction'
    ],
    confidenceThreshold: 0.90,
    lastValidated: '2024-01-01',
    priority: 'important'
  },

  // ========================================
  // ARTICLE/NEWS EXTRACTION TESTS
  // ========================================

  {
    id: 'articles_hackernews_front',
    name: 'Hacker News Front Page Articles',
    url: 'https://news.ycombinator.com',
    category: 'articles',
    extractionInstructions: 'get article titles, scores, comment counts, and authors',
    expectedResults: {
      articles: [
        {
          title: 'Example Tech Article Title',
          score: 250,
          comments: 45,
          author: 'username123'
        }
        // Dynamic content - baseline to be established
      ]
    },
    knownChallenges: [
      'dynamic content changes',
      'scoring updates',
      'pagination handling'
    ],
    confidenceThreshold: 0.85,
    lastValidated: '2024-01-01',
    priority: 'normal',
    notes: 'Content changes frequently - focus on structure accuracy'
  },

  {
    id: 'articles_techcrunch_latest',
    name: 'TechCrunch Latest Articles',
    url: 'https://techcrunch.com/latest/',
    category: 'articles',
    extractionInstructions: 'extract article titles, authors, publication dates, and brief summaries',
    expectedResults: {
      articles: [
        {
          title: 'Sample Tech News Article',
          author: 'Author Name',
          publishDate: '2024-01-01',
          summary: 'Brief article summary...'
        }
        // To be populated with actual content
      ]
    },
    knownChallenges: [
      'date format variations',
      'author attribution',
      'summary vs full content'
    ],
    confidenceThreshold: 0.88,
    lastValidated: '2024-01-01',
    priority: 'normal'
  },

  // ========================================
  // EDGE CASE TESTS
  // ========================================

  {
    id: 'edge_empty_content',
    name: 'Minimal Content Page',
    url: 'https://example.com',
    category: 'edge_cases',
    extractionInstructions: 'extract any available content', 
    expectedResults: {
      content: {
        title: 'Example Domain',
        description: 'This domain is for use in illustrative examples in documents.'
      }
    },
    knownChallenges: [
      'minimal content handling',
      'graceful degradation'
    ],
    confidenceThreshold: 1.0,
    lastValidated: '2024-01-01',
    priority: 'critical',
    notes: 'Must handle minimal content without errors'
  },

  {
    id: 'edge_javascript_heavy',
    name: 'JavaScript-Heavy SPA',
    url: 'https://reactjs.org/docs/getting-started.html',
    category: 'edge_cases',
    extractionInstructions: 'extract documentation section titles and content',
    expectedResults: {
      sections: [
        {
          title: 'Getting Started',
          content: 'React documentation content...'
        }
        // To be validated with actual content
      ]
    },
    knownChallenges: [
      'SPA content loading',
      'JavaScript requirements',
      'dynamic content generation'
    ],
    confidenceThreshold: 0.80,
    lastValidated: '2024-01-01',
    priority: 'important'
  },

  {
    id: 'edge_large_table',
    name: 'Large Data Table',
    url: 'https://www.census.gov/data/tables.html',
    category: 'edge_cases',
    extractionInstructions: 'extract table headers and sample data rows',
    expectedResults: {
      tables: [
        {
          headers: ['Column 1', 'Column 2', 'Column 3'],
          sampleRows: [
            ['Value 1A', 'Value 1B', 'Value 1C'],
            ['Value 2A', 'Value 2B', 'Value 2C']
          ]
        }
      ]
    },
    knownChallenges: [
      'large data handling',
      'table structure detection',
      'performance with complex tables'
    ],
    confidenceThreshold: 0.85,
    lastValidated: '2024-01-01',
    priority: 'normal'
  },

  {
    id: 'edge_protected_content',
    name: 'Cloudflare Protected Site',
    url: 'https://www.cloudflare.com/learning/',
    category: 'edge_cases',
    extractionInstructions: 'extract learning resource titles and descriptions',
    expectedResults: {
      resources: [
        {
          title: 'What is Cloudflare?',
          description: 'Learning resource description...'
        }
        // To be validated
      ]
    },
    knownChallenges: [
      'bot protection bypass',
      'rate limiting handling',
      'content availability'
    ],
    confidenceThreshold: 0.75,
    lastValidated: '2024-01-01',
    priority: 'important',
    notes: 'Tests resilience against common protection mechanisms'
  },

  // ========================================
  // MIXED CONTENT TESTS
  // ========================================

  {
    id: 'mixed_university_page',
    name: 'University Mixed Content',
    url: 'https://www.mit.edu/about/',
    category: 'mixed_content',
    extractionInstructions: 'extract key facts, leadership, and program information',
    expectedResults: {
      facts: {
        founded: '1861',
        location: 'Cambridge, MA',
        students: '11,000+'
      },
      leadership: [
        {
          name: 'Sally Kornbluth',
          title: 'President'
        }
      ],
      programs: [
        'Engineering',
        'Computer Science', 
        'Physics'
      ]
    },
    knownChallenges: [
      'mixed content types',
      'fact vs opinion extraction',
      'structured vs unstructured data'
    ],
    confidenceThreshold: 0.85,
    lastValidated: '2024-01-01',
    priority: 'normal'
  },

  {
    id: 'mixed_company_about',
    name: 'Company About Page (Mixed Content)',
    url: 'https://www.stripe.com/about',
    category: 'mixed_content',
    extractionInstructions: 'extract company information, leadership team, and key metrics',
    expectedResults: {
      company: {
        name: 'Stripe',
        mission: 'To increase the GDP of the internet',
        founded: '2010'
      },
      leadership: [
        {
          name: 'Patrick Collison',
          title: 'CEO'
        },
        {
          name: 'John Collison',
          title: 'President'
        }
      ],
      metrics: {
        countries: '40+',
        businesses: 'millions'
      }
    },
    knownChallenges: [
      'company info vs marketing copy',
      'metric extraction accuracy',
      'leadership vs all employees'
    ],
    confidenceThreshold: 0.88,
    lastValidated: '2024-01-01',
    priority: 'important'
  }
];

// Helper function to get test cases by category
export function getTestCasesByCategory(category: AccuracyTestCase['category']): AccuracyTestCase[] {
  return ACCURACY_TEST_LIBRARY.filter(test => test.category === category);
}

// Helper function to get critical test cases
export function getCriticalTestCases(): AccuracyTestCase[] {
  return ACCURACY_TEST_LIBRARY.filter(test => test.priority === 'critical');
}

// Helper function to validate test case structure
export function validateTestCase(testCase: AccuracyTestCase): string[] {
  const errors: string[] = [];
  
  if (!testCase.id) errors.push('Missing test case ID');
  if (!testCase.name) errors.push('Missing test case name');
  if (!testCase.url || !testCase.url.startsWith('http')) errors.push('Invalid URL');
  if (!testCase.extractionInstructions) errors.push('Missing extraction instructions');
  if (!testCase.expectedResults || Object.keys(testCase.expectedResults).length === 0) {
    errors.push('Missing or empty expected results');
  }
  if (testCase.confidenceThreshold < 0 || testCase.confidenceThreshold > 1) {
    errors.push('Invalid confidence threshold (must be 0-1)');
  }
  
  return errors;
}

// Validate all test cases
export function validateAllTestCases(): Record<string, string[]> {
  const validationResults: Record<string, string[]> = {};
  
  for (const testCase of ACCURACY_TEST_LIBRARY) {
    const errors = validateTestCase(testCase);
    if (errors.length > 0) {
      validationResults[testCase.id] = errors;
    }
  }
  
  return validationResults;
}

export default ACCURACY_TEST_LIBRARY;