// Atlas Codex AI Natural Language Processor
// Converts natural language requests into structured extraction commands

const SYSTEM_PROMPT = `You are an AI assistant for Atlas Codex, a web extraction system. Your job is to convert natural language requests into structured JSON commands for the extraction API.

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

Parse the user's request and return a JSON structure with:
{
  "url": "the target URL",
  "type": "scrape|search|crawl|map",
  "formats": ["markdown", "links", etc],
  "params": {
    // Mode-specific parameters
    "searchQuery": "for search mode",
    "maxPages": 10, // for crawl mode
    "maxDepth": 2, // for crawl mode
    "includeSubdomains": false,
    "onlyMainContent": true,
    "waitFor": 2000, // milliseconds to wait
    "headers": {} // custom headers if needed
  },
  "explanation": "Brief explanation of what will be done"
}

Examples:
User: "Get me all the product prices from amazon.com/bestsellers"
Response: {
  "url": "https://amazon.com/bestsellers",
  "type": "scrape",
  "formats": ["json", "markdown"],
  "params": {
    "onlyMainContent": true,
    "waitFor": 3000
  },
  "explanation": "Extracting product information and prices from Amazon bestsellers page"
}

User: "Find all mentions of AI on nytimes.com and get me the articles"
Response: {
  "url": "https://nytimes.com",
  "type": "search",
  "formats": ["markdown", "links"],
  "params": {
    "searchQuery": "AI artificial intelligence",
    "onlyMainContent": true
  },
  "explanation": "Searching for AI-related content on NYTimes and extracting matching articles"
}

User: "Map out the entire documentation site for react"
Response: {
  "url": "https://react.dev",
  "type": "map",
  "formats": ["links"],
  "params": {
    "includeSubdomains": true
  },
  "explanation": "Creating a complete sitemap of React documentation"
}`;

// Function to call OpenAI API (or use local processing)
async function processWithAI(userInput, apiKey) {
  if (!apiKey || apiKey === '') {
    // Fallback to rule-based processing if no API key
    return processWithRules(userInput);
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userInput }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
    
  } catch (error) {
    console.error('AI processing failed, falling back to rules:', error);
    return processWithRules(userInput);
  }
}

// Enhanced rule-based processor as fallback
function processWithRules(userInput) {
  const input = userInput.toLowerCase();
  const result = {
    params: {
      onlyMainContent: true
    }
  };
  
  // Extract URL
  const urlMatch = userInput.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s]*)?)/);
  if (urlMatch) {
    result.url = urlMatch[0];
    if (!result.url.startsWith('http')) {
      result.url = 'https://' + result.url;
    }
  }
  
  // Determine mode based on keywords
  if (input.includes('search') || input.includes('find')) {
    result.type = 'search';
    // Extract search query
    const searchMatch = input.match(/(?:search|find|look)\s+(?:for\s+)?["']?([^"']+?)["']?\s+(?:on|in|at)/i);
    if (searchMatch) {
      result.params.searchQuery = searchMatch[1];
    }
  } else if (input.includes('crawl') || input.includes('entire') || input.includes('all pages')) {
    result.type = 'crawl';
    // Extract page limit
    const limitMatch = input.match(/(\d+)\s*(?:pages?|links?)/);
    if (limitMatch) {
      result.params.maxPages = parseInt(limitMatch[1]);
    } else {
      result.params.maxPages = 10;
    }
    
    // Extract depth
    const depthMatch = input.match(/depth\s+(?:of\s+)?(\d+)/);
    if (depthMatch) {
      result.params.maxDepth = parseInt(depthMatch[1]);
    } else {
      result.params.maxDepth = 2;
    }
  } else if (input.includes('map') || input.includes('sitemap') || input.includes('structure')) {
    result.type = 'map';
    result.params.includeSubdomains = input.includes('subdomain');
  } else {
    result.type = 'scrape';
  }
  
  // Determine formats based on keywords
  const formats = [];
  
  if (input.includes('markdown') || input.includes('article') || input.includes('content')) {
    formats.push('markdown');
  }
  if (input.includes('html') || input.includes('raw')) {
    formats.push('html');
  }
  if (input.includes('link') || input.includes('url')) {
    formats.push('links');
  }
  if (input.includes('json') || input.includes('data') || input.includes('structured')) {
    formats.push('json');
  }
  if (input.includes('summar') || input.includes('brief') || input.includes('overview')) {
    formats.push('summary');
  }
  if (input.includes('screenshot') || input.includes('image') || input.includes('visual')) {
    formats.push('screenshot');
  }
  
  // Default to markdown if no format specified
  if (formats.length === 0) {
    formats.push('markdown');
  }
  
  result.formats = formats;
  
  // Special handling for specific sites
  if (result.url) {
    if (result.url.includes('amazon') || result.url.includes('ebay')) {
      result.params.waitFor = 3000; // E-commerce sites need more time
      if (!formats.includes('json')) formats.push('json');
    }
    if (result.url.includes('reddit') || result.url.includes('twitter')) {
      result.params.waitFor = 2000;
    }
    if (result.url.includes('github')) {
      result.params.includeSubdomains = false; // Don't crawl all of GitHub
    }
  }
  
  // Generate explanation
  const modeExplanations = {
    scrape: 'Extracting content from the page',
    search: `Searching for "${result.params.searchQuery || 'content'}" on the site`,
    crawl: `Crawling up to ${result.params.maxPages || 10} pages`,
    map: 'Creating a sitemap of the website'
  };
  
  result.explanation = modeExplanations[result.type] || 'Processing your request';
  
  return result;
}

// Main processing function
async function processNaturalLanguage(userInput, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
  
  // Clean and validate input
  userInput = userInput.trim();
  if (!userInput) {
    throw new Error('No input provided');
  }
  
  // Process with AI or rules
  const result = await processWithAI(userInput, apiKey);
  
  // Validate and clean result
  if (!result.url) {
    throw new Error('Could not extract URL from request');
  }
  
  // Ensure URL has protocol
  if (!result.url.startsWith('http')) {
    result.url = 'https://' + result.url;
  }
  
  // Set defaults
  result.type = result.type || 'scrape';
  result.formats = result.formats || ['markdown'];
  result.params = result.params || {};
  
  // Add timestamp
  result.timestamp = new Date().toISOString();
  
  return result;
}

// Lambda handler for API Gateway
exports.handler = async (event) => {
  console.log('AI Processor received:', JSON.stringify(event, null, 2));
  
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
    
    const result = await processNaturalLanguage(userInput, {
      apiKey: body.apiKey || event.headers['x-openai-key']
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

// Export for use in other modules
module.exports = {
  processNaturalLanguage,
  processWithRules,
  processWithAI
};