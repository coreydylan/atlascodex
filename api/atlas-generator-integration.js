/**
 * Atlas Generator Integration for Legacy API
 * Bridges the new skill-based system with existing Lambda infrastructure
 */

const { createAtlasGenerator } = require('../packages/core/src/atlas-generator');

/**
 * Enhanced AI Processor using the new generator system
 */
async function processWithGenerator(userInput, apiKey) {
  try {
    // Create generator with AI capabilities if key available
    const generator = createAtlasGenerator({
      openai_api_key: apiKey,
      use_ai_planner: !!apiKey,
      max_time: 25000, // Leave buffer for Lambda timeout
      max_requests: 8,
      debug: true
    });
    
    // Parse the natural language input into a task
    const task = parseInputToTask(userInput);
    
    // Execute extraction
    const result = await generator.extract(task, { url: task.url });
    
    // Convert to legacy format for compatibility
    return formatForLegacyApi(result, task);
    
  } catch (error) {
    console.error('Generator processing failed:', error);
    // Fall back to rule-based processing
    return processWithRules(userInput);
  }
}

/**
 * Convert natural language input to structured task
 */
function parseInputToTask(userInput) {
  const input = userInput.toLowerCase();
  
  // Extract URL
  const urlMatch = userInput.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s]*)?)/);
  if (!urlMatch) {
    throw new Error('No URL found in input');
  }
  
  let url = urlMatch[0];
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }
  
  // Determine task type and parameters
  let description = userInput;
  let intent = 'collect';
  let domain = 'generic';
  let targetType;
  
  // News/Article detection
  if (input.includes('article') || input.includes('news') || url.includes('news') || url.includes('nytimes')) {
    domain = 'news';
    targetType = 'news.article';
    
    if (input.includes('top 10') || input.match(/10\s+article/)) {
      description = 'Extract top 10 news articles from homepage';
    } else if (input.match(/(\d+)\s+article/)) {
      const count = input.match(/(\d+)\s+article/)[1];
      description = `Extract top ${count} news articles from homepage`;
    } else {
      description = 'Extract news articles from page';
    }
  }
  
  // Product/Commerce detection
  else if (input.includes('product') || input.includes('price') || input.includes('shop') || input.includes('buy')) {
    domain = 'commerce';
    targetType = 'commerce.product';
    description = 'Extract product listings with prices';
  }
  
  // Events detection
  else if (input.includes('event') || input.includes('calendar') || input.includes('schedule')) {
    domain = 'events';
    targetType = 'events.listing';
    description = 'Extract event listings';
  }
  
  // Search intent
  if (input.includes('search') || input.includes('find')) {
    intent = 'analyze';
  }
  
  return {
    description,
    url,
    intent,
    domain,
    targetType
  };
}

/**
 * Format generator result for legacy API compatibility
 */
function formatForLegacyApi(result, task) {
  if (!result.success) {
    throw new Error(result.errors.join('; '));
  }
  
  // Determine output format based on task
  let formats = ['structured'];
  let type = 'scrape';
  
  if (task.intent === 'analyze') {
    type = 'search';
  }
  
  // Extract structured parameters for backward compatibility
  const params = {
    onlyMainContent: true,
    extractionInstructions: task.description,
    outputSchema: result.plan_used?.target_schema,
    postProcessing: 'Return structured data as requested',
    confidence: result.confidence,
    execution_time: result.execution_time
  };
  
  // Add generator-specific metadata
  if (result.evaluation) {
    params.quality_score = result.evaluation.score;
    params.quality_issues = result.evaluation.issues;
  }
  
  if (result.citations) {
    params.citations = result.citations;
  }
  
  return {
    url: task.url,
    type: type,
    formats: formats,
    params: params,
    data: result.data, // Include the actual extracted data
    explanation: task.description,
    timestamp: new Date().toISOString(),
    generator_used: true,
    trace: result.trace ? result.trace.map(t => ({
      skill: t.skill,
      confidence: t.output.confidence,
      time: t.endTime - t.startTime,
      success: !t.errors || t.errors.length === 0
    })) : undefined
  };
}

/**
 * Legacy rule-based processor (fallback)
 */
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
  
  // Determine mode
  if (input.includes('search') || input.includes('find')) {
    result.type = 'search';
    const searchMatch = input.match(/(?:search|find|look)\s+(?:for\s+)?[\"']?([^\"']+?)[\"']?\s+(?:on|in|at)/i);
    if (searchMatch) {
      result.params.searchQuery = searchMatch[1];
    }
  } else if (input.includes('crawl') || input.includes('entire') || input.includes('all pages')) {
    result.type = 'crawl';
    result.params.maxPages = 10;
    result.params.maxDepth = 2;
  } else if (input.includes('map') || input.includes('sitemap')) {
    result.type = 'map';
    result.params.includeSubdomains = input.includes('subdomain');
  } else {
    result.type = 'scrape';
  }
  
  // Enhanced structured detection
  const needsStructured = 
    input.includes('top ') ||
    input.includes('list') ||
    input.includes('articles') ||
    input.includes('products') ||
    input.includes('prices') ||
    input.includes('get') ||
    input.includes('find') ||
    input.match(/\d+\s+(articles?|items?|products?|stories?|posts?)/i);
  
  if (needsStructured) {
    result.formats = ['structured'];
    
    if (input.includes('top 10') || input.includes('top ten') || input.match(/10\s+articles?/i)) {
      result.params.extractionInstructions = 'Extract the top 10 article headlines with their links and summaries from the homepage';
      result.params.outputSchema = {
        type: 'object',
        properties: {
          articles: {
            type: 'array',
            maxItems: 10,
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
                summary: { type: 'string' },
                author: { type: 'string' },
                section: { type: 'string' }
              }
            }
          },
          extractedAt: { type: 'string' }
        }
      };
      result.params.postProcessing = 'Return only the top 10 articles as a structured JSON array';
    } else {
      result.params.extractionInstructions = 'Extract structured data as requested';
      result.formats = ['structured'];
    }
  } else {
    result.formats = ['markdown'];
  }
  
  result.explanation = `Processing: ${userInput}`;
  
  return result;
}

/**
 * Main processing function that tries generator first, falls back to rules
 */
async function processNaturalLanguage(userInput, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
  
  // Clean input
  userInput = userInput.trim();
  if (!userInput) {
    throw new Error('No input provided');
  }
  
  try {
    // Try the new generator system first
    const result = await processWithGenerator(userInput, apiKey);
    return result;
  } catch (error) {
    console.error('Generator failed, falling back to rules:', error);
    
    // Fall back to rule-based processing
    const result = processWithRules(userInput);
    
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
    result.generator_used = false;
    
    return result;
  }
}

/**
 * Export for use in Lambda
 */
module.exports = {
  processNaturalLanguage,
  processWithGenerator,
  processWithRules,
  parseInputToTask,
  formatForLegacyApi
};