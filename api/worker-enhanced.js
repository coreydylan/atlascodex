// Atlas Codex Enhanced Worker - Full extraction functionality
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

// Initialize clients
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });

// Update job status in DynamoDB
async function updateJobStatus(jobId, status, result = null, error = null) {
  const updateExpression = ['SET #status = :status', '#updatedAt = :updatedAt'];
  const expressionAttributeNames = {
    '#status': 'status',
    '#updatedAt': 'updatedAt'
  };
  const expressionAttributeValues = {
    ':status': { S: status },
    ':updatedAt': { N: Date.now().toString() }
  };

  if (result) {
    updateExpression.push('#result = :result');
    expressionAttributeNames['#result'] = 'result';
    expressionAttributeValues[':result'] = { 
      S: JSON.stringify(result) 
    };
  }

  if (error) {
    updateExpression.push('#error = :error');
    expressionAttributeNames['#error'] = 'error';
    expressionAttributeValues[':error'] = { S: error };
  }

  try {
    await dynamodb.send(new UpdateItemCommand({
      TableName: 'atlas-codex-jobs',
      Key: { id: { S: jobId } },
      UpdateExpression: updateExpression.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }));
    console.log(`Job ${jobId} updated to status: ${status}`);
  } catch (err) {
    console.error(`Failed to update job ${jobId}:`, err);
    throw err;
  }
}

// Helper functions for content extraction
function extractMainContent(html) {
  // Try to find main content areas
  const mainPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*role=["']main["'][^>]*>([\s\S]*?)<\/div>/i
  ];
  
  for (const pattern of mainPatterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  
  // Fallback to body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : html;
}

function htmlToText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlToMarkdown(html) {
  let md = html;
  
  // Headers
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n');
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n');
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n');
  
  // Bold and italic
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  
  // Links
  md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  
  // Images
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*?)["'][^>]*>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '![]($1)');
  
  // Lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
    return '\n' + content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n';
  });
  
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
    let counter = 1;
    return '\n' + content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${counter++}. $1\n`) + '\n';
  });
  
  // Paragraphs
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n');
  
  // Line breaks
  md = md.replace(/<br[^>]*>/gi, '\n');
  
  // Code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  
  // Blockquotes
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '\n> $1\n');
  
  // Tables (basic support)
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match, content) => {
    const rows = content.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    let table = '\n';
    rows.forEach((row, index) => {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      const rowContent = cells.map(cell => {
        return cell.replace(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/i, '$1').trim();
      }).join(' | ');
      table += `| ${rowContent} |\n`;
      if (index === 0) {
        table += '|' + cells.map(() => ' --- ').join('|') + '|\n';
      }
    });
    return table + '\n';
  });
  
  // Clean up remaining HTML
  md = htmlToText(md);
  
  // Clean up excessive newlines
  md = md.replace(/\n{3,}/g, '\n\n');
  
  return md.trim();
}

function extractLinks(html, baseUrl) {
  const links = [];
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const seen = new Set();
  
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = htmlToText(match[2]).trim();
    
    // Skip anchors and javascript links
    if (href.startsWith('#') || href.startsWith('javascript:')) continue;
    
    // Resolve relative URLs
    let absoluteUrl;
    try {
      absoluteUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
    } catch (e) {
      continue; // Invalid URL, skip
    }
    
    // Avoid duplicates
    if (seen.has(absoluteUrl)) continue;
    seen.add(absoluteUrl);
    
    links.push({
      text: text || absoluteUrl,
      href: absoluteUrl
    });
  }
  
  return links;
}

function extractStructuredData(html) {
  const data = {};
  
  // Extract meta tags
  const metaRegex = /<meta[^>]*(?:name|property)=["']([^"']+)["'][^>]*content=["']([^"']*?)["']/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    data[match[1]] = match[2];
  }
  
  // Extract JSON-LD structured data
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const jsonLdMatches = [];
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      jsonLdMatches.push(JSON.parse(match[1]));
    } catch (e) {
      // Invalid JSON, skip
    }
  }
  if (jsonLdMatches.length > 0) {
    data.jsonLd = jsonLdMatches;
  }
  
  return Object.keys(data).length > 0 ? data : null;
}

function detectLanguage(html) {
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  return langMatch ? langMatch[1].split('-')[0] : 'en';
}

function extractMetadata(html) {
  const metadata = {};
  
  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)</i);
  metadata.title = titleMatch ? titleMatch[1].trim() : '';
  
  // Description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*?)["']/i);
  metadata.description = descMatch ? descMatch[1] : '';
  
  // Author
  const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']*?)["']/i);
  metadata.author = authorMatch ? authorMatch[1] : null;
  
  // Keywords
  const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*?)["']/i);
  metadata.keywords = keywordsMatch ? keywordsMatch[1].split(',').map(k => k.trim()) : [];
  
  // OpenGraph data
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*?)["']/i);
  if (ogTitle) metadata.ogTitle = ogTitle[1];
  
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*?)["']/i);
  if (ogDesc) metadata.ogDescription = ogDesc[1];
  
  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*?)["']/i);
  if (ogImage) metadata.ogImage = ogImage[1];
  
  // Language
  metadata.language = detectLanguage(html);
  
  return metadata;
}

function generateSummary(text, maxLength = 500) {
  // Simple summary generation - take first paragraph or sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  let summary = '';
  
  for (const sentence of sentences) {
    if ((summary + sentence).length > maxLength) break;
    summary += sentence + ' ';
  }
  
  return summary.trim() || text.substring(0, maxLength);
}

// Enhanced extraction with multiple format support
async function performExtraction(jobId, params) {
  const startTime = Date.now();
  
  try {
    console.log(`Starting extraction for job ${jobId}:`, params);
    
    // Update status to processing
    await updateJobStatus(jobId, 'processing');
    
    // Determine formats requested
    const formats = params.formats || ['markdown'];
    const includeMarkdown = formats.includes('markdown') || params.includeMarkdown;
    const includeHtml = formats.includes('html') || params.includeHtml;
    const includeLinks = formats.includes('links') || params.includeLinks;
    const includeSummary = formats.includes('summary');
    const includeJson = formats.includes('json') || params.includeStructured;
    const includeScreenshot = formats.includes('screenshot') || params.includeScreenshot;
    
    // Fetch the page
    const response = await fetch(params.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        ...params.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Extract metadata
    const metadata = extractMetadata(html);
    
    // Extract main content based on options
    let contentHtml = html;
    if (params.onlyMainContent !== false) {
      contentHtml = extractMainContent(html);
    }
    
    // Prepare result object
    const result = {
      success: true,
      data: {
        url: params.url,
        title: metadata.title,
        metadata: {
          ...metadata,
          strategy: params.strategy || 'enhanced_fetch',
          extractedAt: new Date().toISOString(),
          sourceUrl: params.url
        }
      },
      metadata: {
        strategy: params.strategy || 'enhanced_fetch',
        cost: 0.0001,
        responseTime: Date.now() - startTime,
        success: true
      }
    };
    
    // Add requested formats
    if (includeMarkdown) {
      const markdown = htmlToMarkdown(contentHtml);
      result.data.markdown = markdown;
      result.data.content = markdown; // Default content field
    } else {
      result.data.content = htmlToText(contentHtml);
    }
    
    if (includeHtml) {
      result.data.html = params.cleanedHtml ? contentHtml : html;
    }
    
    if (includeLinks) {
      result.data.links = extractLinks(html, params.url);
    }
    
    if (includeSummary) {
      result.data.summary = generateSummary(result.data.content);
    }
    
    if (includeJson) {
      result.data.structuredData = extractStructuredData(html);
    }
    
    if (includeScreenshot) {
      // Placeholder for screenshot functionality
      result.data.screenshot = null;
      result.data.screenshotMessage = "Screenshot capture requires browser automation (not available in basic mode)";
    }
    
    // Update job with result
    await updateJobStatus(jobId, 'completed', result);
    
    console.log(`Job ${jobId} completed successfully`);
    return result;
    
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  }
}

// Crawl mode - extract multiple pages
async function performCrawl(jobId, params) {
  const startTime = Date.now();
  
  try {
    console.log(`Starting crawl for job ${jobId}:`, params);
    await updateJobStatus(jobId, 'processing');
    
    const maxPages = params.maxPages || 10;
    const maxDepth = params.maxDepth || 2;
    const includeSubdomains = params.includeSubdomains || false;
    
    const baseUrl = new URL(params.url);
    const visited = new Set();
    const toVisit = [{ url: params.url, depth: 0 }];
    const pages = [];
    
    while (toVisit.length > 0 && pages.length < maxPages) {
      const { url, depth } = toVisit.shift();
      
      if (visited.has(url) || depth > maxDepth) continue;
      visited.add(url);
      
      try {
        // Extract the page
        const extractParams = { ...params, url };
        const pageResult = await performExtraction(`${jobId}_page_${pages.length}`, extractParams);
        pages.push(pageResult.data);
        
        // Find links to crawl
        if (depth < maxDepth && pageResult.data.links) {
          for (const link of pageResult.data.links) {
            const linkUrl = new URL(link.href);
            
            // Check if we should crawl this link
            if (linkUrl.hostname === baseUrl.hostname || 
                (includeSubdomains && linkUrl.hostname.endsWith(baseUrl.hostname))) {
              if (!visited.has(link.href)) {
                toVisit.push({ url: link.href, depth: depth + 1 });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Failed to crawl ${url}:`, error);
      }
    }
    
    const result = {
      success: true,
      data: {
        url: params.url,
        pages: pages,
        totalPages: pages.length,
        metadata: {
          strategy: 'crawl',
          extractedAt: new Date().toISOString(),
          maxPages,
          maxDepth
        }
      },
      metadata: {
        strategy: 'crawl',
        cost: 0.0001 * pages.length,
        responseTime: Date.now() - startTime,
        success: true
      }
    };
    
    await updateJobStatus(jobId, 'completed', result);
    return result;
    
  } catch (error) {
    console.error(`Crawl ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  }
}

// Search mode - find specific content
async function performSearch(jobId, params) {
  try {
    console.log(`Starting search for job ${jobId}:`, params);
    await updateJobStatus(jobId, 'processing');
    
    // First extract the page
    const extractResult = await performExtraction(jobId + '_extract', params);
    
    // Search for the query in the content
    const searchQuery = params.searchQuery || params.query || '';
    const content = extractResult.data.content || '';
    const matches = [];
    
    if (searchQuery) {
      const regex = new RegExp(searchQuery, 'gi');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const start = Math.max(0, match.index - 100);
        const end = Math.min(content.length, match.index + searchQuery.length + 100);
        matches.push({
          text: content.substring(start, end),
          index: match.index,
          context: '...' + content.substring(start, end) + '...'
        });
      }
    }
    
    const result = {
      success: true,
      data: {
        ...extractResult.data,
        searchQuery,
        matches,
        matchCount: matches.length
      }
    };
    
    await updateJobStatus(jobId, 'completed', result);
    return result;
    
  } catch (error) {
    console.error(`Search ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  }
}

// Map mode - generate sitemap
async function performMap(jobId, params) {
  try {
    console.log(`Starting map for job ${jobId}:`, params);
    await updateJobStatus(jobId, 'processing');
    
    // Similar to crawl but only collect URLs
    const crawlResult = await performCrawl(jobId + '_crawl', { ...params, formats: ['links'] });
    
    // Build sitemap structure
    const sitemap = {
      url: params.url,
      pages: crawlResult.data.pages.map(page => ({
        url: page.url,
        title: page.title,
        links: page.links ? page.links.length : 0
      }))
    };
    
    const result = {
      success: true,
      data: {
        url: params.url,
        sitemap,
        totalPages: sitemap.pages.length,
        metadata: {
          strategy: 'map',
          extractedAt: new Date().toISOString()
        }
      }
    };
    
    await updateJobStatus(jobId, 'completed', result);
    return result;
    
  } catch (error) {
    console.error(`Map ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  }
}

// Lambda handler for SQS events
exports.handler = async (event) => {
  console.log('Enhanced Worker received event:', JSON.stringify(event, null, 2));
  
  const results = [];
  
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const { jobId, type, params } = message;
      
      console.log(`Processing ${type} job: ${jobId}`);
      
      let result;
      switch (type) {
        case 'extract':
        case 'scrape':
          result = await performExtraction(jobId, params);
          break;
          
        case 'crawl':
          result = await performCrawl(jobId, params);
          break;
          
        case 'search':
          result = await performSearch(jobId, params);
          break;
          
        case 'map':
          result = await performMap(jobId, params);
          break;
          
        default:
          throw new Error(`Unknown job type: ${type}`);
      }
      
      results.push({
        jobId,
        status: 'success',
        result
      });
      
    } catch (error) {
      console.error('Failed to process record:', error);
      results.push({
        messageId: record.messageId,
        status: 'error',
        error: error.message
      });
    }
  }
  
  // Return batch failures for SQS retry handling
  const failedMessages = results
    .filter(r => r.status === 'error')
    .map(r => ({ itemIdentifier: r.messageId }));
  
  console.log(`Processed ${results.length} messages, ${failedMessages.length} failures`);
  
  return {
    batchItemFailures: failedMessages
  };
};