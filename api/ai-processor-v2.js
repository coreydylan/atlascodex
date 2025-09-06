// api/ai-processor-v2.js
const GPT5Client = require('./services/gpt5-client');

class AIProcessorV2 {
  constructor() {
    this.client = new GPT5Client();
  }

  async processNaturalLanguage(userInput, options = {}) {
    // Clean and validate input
    userInput = userInput.trim();
    if (!userInput) {
      throw new Error('No input provided');
    }

    const complexity = this.assessComplexity(userInput);
    
    try {
      const result = await this.client.complete({
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: userInput
          }
        ],
        complexity,
        budget: options.budget || 0.01,
        requiresReasoning: complexity > 0.7,
        outputFormat: 'json'
      });

      const parsed = JSON.parse(result.content);
      
      // Validate and clean result
      if (!parsed.url) {
        throw new Error('Could not extract URL from request');
      }
      
      // Ensure URL has protocol
      if (!parsed.url.startsWith('http')) {
        parsed.url = 'https://' + parsed.url;
      }
      
      // Set defaults
      parsed.type = parsed.type || 'scrape';
      parsed.formats = parsed.formats || ['markdown'];
      parsed.params = parsed.params || {};
      
      // Add timestamp
      parsed.timestamp = new Date().toISOString();
      
      return {
        ...parsed,
        metadata: {
          model: result.model,
          cost: result.cost,
          tokens: result.usage,
          complexity: complexity,
          fallback: result.fallback || false
        }
      };
    } catch (error) {
      console.error('GPT-5 processing failed:', error);
      // Could add fallback to rules-based processing here if needed
      throw error;
    }
  }

  assessComplexity(input) {
    const factors = {
      length: Math.min(input.length / 1000, 0.3),
      technical: /\b(implement|algorithm|optimize|analyze|compare|evaluate|determine|infer)\b/i.test(input) ? 0.3 : 0,
      multiStep: /\b(then|after|finally|steps|first|second|third)\b/i.test(input) ? 0.2 : 0,
      structured: /\b(json|schema|format|structure|array|object)\b/i.test(input) ? 0.2 : 0,
      dataNeed: /\b(top \d+|list|articles|products|prices|extract all)\b/i.test(input) ? 0.25 : 0,
      reasoning: /\b(relationship|pattern|correlation|because|why|how)\b/i.test(input) ? 0.35 : 0,
      crawling: /\b(crawl|entire|all pages|sitemap|multiple pages)\b/i.test(input) ? 0.3 : 0
    };
    
    return Math.min(Object.values(factors).reduce((a, b) => a + b, 0), 1.0);
  }

  getSystemPrompt() {
    return `You are an AI assistant for Atlas Codex, a web extraction system. Your job is to convert natural language requests into structured JSON commands for the extraction API.

Available modes:
- scrape: Extract content from a single page
- search: Find specific content on a page
- crawl: Extract from multiple pages following links
- map: Generate a sitemap of a website

Available formats:
- markdown: Clean, formatted markdown
- html: HTML content (raw or cleaned)
- links: Extract all links from the page
- json: Structured data (OpenGraph, JSON-LD, meta tags)
- summary: Auto-generated content summary
- screenshot: Visual capture of the page
- structured: Custom structured data based on extraction instructions

Parse the user's request and return a JSON structure with:
{
  "url": "the target URL",
  "type": "scrape|search|crawl|map",
  "formats": ["markdown", "links", "json", etc],
  "params": {
    "searchQuery": "for search mode",
    "maxPages": 10,
    "maxDepth": 2,
    "includeSubdomains": false,
    "onlyMainContent": true,
    "waitFor": 2000,
    "headers": {},
    "extractionInstructions": "Specific instructions for what to extract and how to structure it",
    "outputSchema": {},
    "postProcessing": "Instructions for filtering/transforming the extracted data"
  },
  "explanation": "Brief explanation of what will be done"
}

IMPORTANT: When users ask for specific data (like "top 10", "list of", "prices", "articles about X"), always:
1. Use format: ["structured"] to return structured data
2. Provide clear extractionInstructions describing what specific data to extract
3. Define an outputSchema that matches the requested data structure
4. Include postProcessing instructions to filter and format the final output
5. The goal is to return ONLY the requested data, not the entire page content`;
  }
}

// Lambda handler for API Gateway compatibility
const handler = async (event) => {
  console.log('AI Processor V2 received:', JSON.stringify(event, null, 2));
  
  try {
    const body = JSON.parse(event.body || '{}');
    const userInput = body.prompt || body.input || body.query;
    
    if (!userInput) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'No input provided',
          message: 'Please provide a prompt, input, or query field'
        })
      };
    }
    
    const processor = new AIProcessorV2();
    const result = await processor.processNaturalLanguage(userInput, {
      apiKey: body.apiKey || event.headers['x-openai-key'],
      budget: body.budget
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Processing error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Processing failed',
        message: error.message
      })
    };
  }
};

module.exports = {
  AIProcessorV2,
  handler
};