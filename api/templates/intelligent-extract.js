// Intelligent Template-Driven Extraction API
// AI agent that reasons about user intent and creates dynamic schemas

export default async function handler(req, res) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, query } = req.body;

    if (!url || !query) {
      return res.status(400).json({
        error: 'Missing required parameters: url and query'
      });
    }

    // Step 1: Fetch the page content for analysis
    const pageResponse = await fetch(url);
    const htmlContent = await pageResponse.text();

    // Step 2: AI reasoning about user intent and content
    const reasoningResult = await analyzeUserIntentAndContent(query, htmlContent, url);

    // Step 3: Check if existing templates match semantically
    const templateMatch = await findSemanticTemplateMatch(reasoningResult);

    // Step 4: Generate dynamic schema or use existing template
    const extractionSchema = templateMatch 
      ? templateMatch.schema 
      : await generateDynamicSchema(reasoningResult);

    // Step 5: Execute extraction with the determined schema
    const extractionResult = await executeExtractionWithSchema(
      htmlContent, 
      extractionSchema, 
      reasoningResult
    );

    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    return res.status(200).json({
      success: true,
      reasoning: reasoningResult,
      schemaUsed: extractionSchema,
      templateMatch: templateMatch ? templateMatch.id : 'dynamic',
      data: extractionResult.data,
      metadata: {
        ...extractionResult.metadata,
        aiReasoning: reasoningResult.reasoning,
        schemaGeneration: templateMatch ? 'template-based' : 'dynamic',
        confidence: extractionResult.confidence
      }
    });

  } catch (error) {
    console.error('Intelligent extraction error:', error);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// AI Agent 1: Analyze user intent and page content
async function analyzeUserIntentAndContent(userQuery, htmlContent, url) {
  // This would use GPT-4 to reason about the request
  const prompt = `
You are an AI extraction specialist. Analyze this user request and webpage content to understand what the user wants to extract.

USER REQUEST: "${userQuery}"
URL: ${url}
PAGE CONTENT: ${htmlContent.substring(0, 3000)}...

Provide a JSON response with:
{
  "intent": {
    "primaryGoal": "what user wants (e.g., 'extract department names')",
    "dataType": "type of data (e.g., 'organizational_categories', 'person_profiles', 'product_listings')",
    "structure": "expected structure (e.g., 'list', 'hierarchical', 'tabular')",
    "specificity": "how specific the request is (e.g., 'very_specific', 'general', 'ambiguous')"
  },
  "contentAnalysis": {
    "availableData": ["what types of data are actually on the page"],
    "bestMatches": ["what on the page best matches user intent"],
    "dataLocation": "where the relevant data appears to be located",
    "complexity": "simple/moderate/complex"
  },
  "reasoning": "step-by-step explanation of what you think the user wants and how to extract it"
}`;

  // For now, implement a smart heuristic-based analysis
  // In production, this would be a GPT-4 API call
  return await smartHeuristicAnalysis(userQuery, htmlContent, url);
}

// Smart heuristic analysis (placeholder for GPT-4 reasoning)
async function smartHeuristicAnalysis(userQuery, htmlContent, url) {
  const queryLower = userQuery.toLowerCase();
  
  // Department/category extraction
  if (queryLower.includes('department') || queryLower.includes('categories') || 
      (queryLower.includes('names') && queryLower.includes('different'))) {
    return {
      intent: {
        primaryGoal: 'extract organizational categories/departments',
        dataType: 'organizational_categories',
        structure: 'list',
        specificity: 'specific'
      },
      contentAnalysis: {
        availableData: ['department names', 'organizational units', 'category listings'],
        bestMatches: ['Department names in navigation or content sections'],
        dataLocation: 'likely in navigation, headers, or structured lists',
        complexity: 'simple'
      },
      reasoning: 'User wants a list of department/category names, not person profiles. Should extract organizational unit names as a simple list.'
    };
  }

  // Person/people extraction
  if (queryLower.includes('team member') || queryLower.includes('staff') || 
      queryLower.includes('bio') || queryLower.includes('title')) {
    return {
      intent: {
        primaryGoal: 'extract person profiles',
        dataType: 'person_profiles',
        structure: 'list',
        specificity: 'specific'
      },
      contentAnalysis: {
        availableData: ['person names', 'titles', 'biographies'],
        bestMatches: ['Staff listings, team pages, faculty directories'],
        dataLocation: 'profile sections, staff directories',
        complexity: 'moderate'
      },
      reasoning: 'User wants individual person information with names, titles, and potentially other details.'
    };
  }

  // Default: analyze content for best guess
  return {
    intent: {
      primaryGoal: 'extract data based on content analysis',
      dataType: 'mixed',
      structure: 'adaptive',
      specificity: 'general'
    },
    contentAnalysis: {
      availableData: ['text content', 'structured elements'],
      bestMatches: ['most prominent structured content'],
      dataLocation: 'main content area',
      complexity: 'moderate'
    },
    reasoning: `General extraction request. Will analyze page structure to determine best extraction approach for: ${userQuery}`
  };
}

// AI Agent 2: Find semantic template matches
async function findSemanticTemplateMatch(reasoningResult) {
  // Load existing templates and check for semantic matches
  const existingTemplates = await loadExistingTemplates();
  
  for (const template of existingTemplates) {
    if (semanticMatch(reasoningResult, template)) {
      return template;
    }
  }
  
  return null;
}

// Check if reasoning result semantically matches existing template
function semanticMatch(reasoning, template) {
  // For organizational categories like departments
  if (reasoning.intent.dataType === 'organizational_categories' && 
      template.type === 'organizational_list') {
    return true;
  }
  
  // For person profiles
  if (reasoning.intent.dataType === 'person_profiles' && 
      template.type === 'people_directory') {
    return true;
  }
  
  return false;
}

// AI Agent 3: Generate dynamic schema based on reasoning
async function generateDynamicSchema(reasoningResult) {
  const { intent, contentAnalysis } = reasoningResult;
  
  if (intent.dataType === 'organizational_categories') {
    return {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Department or category name' },
          description: { type: 'string', description: 'Optional description if available' },
          url: { type: 'string', description: 'Optional link if available' }
        },
        required: ['name']
      },
      extractionInstructions: 'Extract department/category names as a clean list. Focus on organizational units, not person names.'
    };
  }
  
  if (intent.dataType === 'person_profiles') {
    return {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Person name' },
          title: { type: 'string', description: 'Job title or position' },
          bio: { type: 'string', description: 'Biography or description' },
          department: { type: 'string', description: 'Department or division' }
        },
        required: ['name']
      },
      extractionInstructions: 'Extract individual person profiles with names, titles, and other available information.'
    };
  }
  
  // Default adaptive schema
  return {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Main title or name' },
        content: { type: 'string', description: 'Main content or description' },
        metadata: { type: 'object', description: 'Additional structured data' }
      },
      required: ['title']
    },
    extractionInstructions: `Extract data based on user intent: ${reasoningResult.intent.primaryGoal}`
  };
}

// Execute extraction with the determined schema
async function executeExtractionWithSchema(htmlContent, schema, reasoning) {
  // Call the main Atlas Codex extraction API with the dynamic schema
  const API_BASE = 'https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev';
  
  const extractionResponse = await fetch(`${API_BASE}/api/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.VITE_API_KEY || 'test-key-123'
    },
    body: JSON.stringify({
      url: 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent),
      extractionInstructions: schema.extractionInstructions + '\n\nContext: ' + reasoning.reasoning,
      outputSchema: schema,
      aiGenerated: true,
      dynamicTemplate: true
    })
  });

  if (!extractionResponse.ok) {
    throw new Error(`Extraction API error: ${extractionResponse.status}`);
  }

  return await extractionResponse.json();
}

// Load existing template library for semantic matching
async function loadExistingTemplates() {
  // This would load from a database or file
  // For now, return a few key templates for semantic matching
  return [
    {
      id: 'people_directory',
      type: 'people_directory',
      description: 'Extract person profiles with names, titles, bios',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            title: { type: 'string' },
            bio: { type: 'string' }
          }
        }
      }
    },
    {
      id: 'organizational_list',
      type: 'organizational_list', 
      description: 'Extract organizational units, departments, categories',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' }
          }
        }
      }
    }
  ];
}