// AWS Lambda handler for Atlas Codex API - Fixed version
const AWS = require('aws-sdk');
const fetch = require('node-fetch');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS();

// Simple ID generator
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Main handler function
exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  // Parse the request
  const path = event.path || event.rawPath || '/';
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  const headers = event.headers || {};
  
  // Parse body safely
  let body = {};
  if (event.body) {
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      body = {};
    }
  }
  
  // CORS headers for all responses
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };
  
  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: ''
    };
  }
  
  try {
    // Health check endpoint
    if (path.includes('health')) {
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          region: process.env.AWS_REGION || 'us-west-2',
          message: 'Atlas Codex API is running!'
        })
      };
    }
    
    // Root endpoint
    if (path === '/' || path === '/dev' || path === '/dev/') {
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          message: 'Atlas Codex API - Drop-in Hyperbrowser replacement',
          version: '1.0.0',
          endpoints: [
            'GET /health',
            'POST /api/scrape',
            'GET /api/scrape/{jobId}',
            'POST /api/extract',
            'GET /api/extract/{jobId}',
            'POST /api/crawl',
            'GET /api/crawl/{jobId}'
          ]
        })
      };
    }
    
    // Check for API key (skip for health and root)
    const apiKey = headers.authorization || headers.Authorization || '';
    const cleanApiKey = apiKey.replace('Bearer ', '').trim();
    
    // For now, accept any non-empty API key (you can validate against a list later)
    if (!cleanApiKey && path.includes('/api/')) {
      return {
        statusCode: 401,
        headers: responseHeaders,
        body: JSON.stringify({ 
          error: 'API key required',
          message: 'Please provide an API key in the Authorization header'
        })
      };
    }
    
    // SCRAPE endpoint - single page scraping
    if (path.includes('/api/scrape')) {
      
      // POST /api/scrape - Create scrape job
      if (method === 'POST') {
        const jobId = generateId('scrape');
        
        // Store job in DynamoDB
        const jobItem = {
          id: jobId,
          type: 'scrape',
          status: 'pending',
          params: body,
          createdAt: Date.now(),
          userId: cleanApiKey.substring(0, 8) // Use first 8 chars of API key as user ID
        };
        
        await dynamodb.put({
          TableName: 'atlas-codex-jobs',
          Item: jobItem
        }).promise();
        
        // Queue the job for processing (if queue URL is set)
        if (process.env.QUEUE_URL) {
          try {
            await sqs.sendMessage({
              QueueUrl: process.env.QUEUE_URL,
              MessageBody: JSON.stringify({
                jobId,
                type: 'scrape',
                params: body
              })
            }).promise();
          } catch (sqsError) {
            console.log('SQS not configured, skipping queue:', sqsError.message);
          }
        }
        
        // For demo, immediately mark as completed with mock data
        setTimeout(async () => {
          try {
            await dynamodb.update({
              TableName: 'atlas-codex-jobs',
              Key: { id: jobId },
              UpdateExpression: 'SET #status = :status, #result = :result, #completedAt = :completedAt',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#result': 'result',
                '#completedAt': 'completedAt'
              },
              ExpressionAttributeValues: {
                ':status': 'completed',
                ':result': {
                  url: body.url,
                  metadata: {
                    title: 'Demo Page Title',
                    description: 'This is a demo scrape result'
                  },
                  markdown: '# Demo Content\n\nThis is sample scraped content.',
                  evidence: {
                    hash: 'sha256:demo123',
                    timestamp: new Date().toISOString()
                  }
                },
                ':completedAt': Date.now()
              }
            }).promise();
          } catch (e) {
            console.error('Error updating job:', e);
          }
        }, 2000);
        
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify({ 
            jobId, 
            status: 'pending',
            message: 'Job queued successfully'
          })
        };
      }
      
      // GET /api/scrape/{jobId} - Get job status
      if (method === 'GET') {
        const pathParts = path.split('/');
        const jobId = pathParts[pathParts.length - 1];
        
        if (!jobId || jobId === 'scrape') {
          return {
            statusCode: 400,
            headers: responseHeaders,
            body: JSON.stringify({ error: 'Job ID required' })
          };
        }
        
        const result = await dynamodb.get({
          TableName: 'atlas-codex-jobs',
          Key: { id: jobId }
        }).promise();
        
        if (!result.Item) {
          return {
            statusCode: 404,
            headers: responseHeaders,
            body: JSON.stringify({ error: 'Job not found' })
          };
        }
        
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify(result.Item)
        };
      }
    }
    
    // EXTRACT endpoint - AI-powered extraction
    if (path.includes('/api/extract')) {
      
      if (method === 'POST') {
        const jobId = generateId('extract');
        
        const jobItem = {
          id: jobId,
          type: 'extract',
          status: 'pending',
          params: body,
          createdAt: Date.now(),
          userId: cleanApiKey.substring(0, 8)
        };
        
        await dynamodb.put({
          TableName: 'atlas-codex-jobs',
          Item: jobItem
        }).promise();
        
        // Process with improved extraction system
        setTimeout(async () => {
          try {
            // Import the improved worker
            const { processWithPlanBasedSystem } = require('../../api/worker-enhanced.js');
            
            // Convert the API body format to worker format
            const extractionParams = {
              url: body.url,
              extractionInstructions: body.extractionInstructions || body.prompt || `Extract data from ${body.url}`,
              outputSchema: body.outputSchema || {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                  metadata: { type: 'object' }
                }
              },
              postProcessing: body.postProcessing || null,
              formats: body.formats || ['structured']
            };
            
            // Fetch the HTML content first
            console.log(`Fetching content from: ${body.url}`);
            const response = await fetch(body.url);
            const htmlContent = await response.text();
            
            // Process the extraction job with the improved system
            const extractionResult = await processWithPlanBasedSystem(htmlContent, extractionParams);
            
            // Update job with real extraction results
            await dynamodb.update({
              TableName: 'atlas-codex-jobs',
              Key: { id: jobId },
              UpdateExpression: 'SET #status = :status, #result = :result, #completedAt = :completedAt',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#result': 'result',
                '#completedAt': 'completedAt'
              },
              ExpressionAttributeValues: {
                ':status': extractionResult.success ? 'completed' : 'failed',
                ':result': {
                  url: body.url,
                  data: extractionResult.data || null,
                  metadata: extractionResult.metadata || {},
                  evidence: extractionResult.evidence || null,
                  error: extractionResult.error || null,
                  extractionNote: extractionResult.data?.extractionNote || null
                },
                ':completedAt': Date.now()
              }
            }).promise();
          } catch (error) {
            console.error('Error processing extraction job:', error);
            
            // Update job with error status
            await dynamodb.update({
              TableName: 'atlas-codex-jobs',
              Key: { id: jobId },
              UpdateExpression: 'SET #status = :status, #result = :result, #completedAt = :completedAt',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#result': 'result',
                '#completedAt': 'completedAt'
              },
              ExpressionAttributeValues: {
                ':status': 'failed',
                ':result': {
                  url: body.url,
                  error: error.message,
                  timestamp: new Date().toISOString()
                },
                ':completedAt': Date.now()
              }
            }).promise();
          }
        }, 1000);
        
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify({ 
            jobId, 
            status: 'pending',
            message: 'Extraction job queued'
          })
        };
      }
      
      if (method === 'GET') {
        const pathParts = path.split('/');
        const jobId = pathParts[pathParts.length - 1];
        
        const result = await dynamodb.get({
          TableName: 'atlas-codex-jobs',
          Key: { id: jobId }
        }).promise();
        
        if (!result.Item) {
          return {
            statusCode: 404,
            headers: responseHeaders,
            body: JSON.stringify({ error: 'Job not found' })
          };
        }
        
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify(result.Item)
        };
      }
    }
    
    // CRAWL endpoint - Multi-page crawling
    if (path.includes('/api/crawl')) {
      
      if (method === 'POST') {
        const jobId = generateId('crawl');
        
        const jobItem = {
          id: jobId,
          type: 'crawl',
          status: 'pending',
          params: body,
          createdAt: Date.now(),
          userId: cleanApiKey.substring(0, 8)
        };
        
        await dynamodb.put({
          TableName: 'atlas-codex-jobs',
          Item: jobItem
        }).promise();
        
        // Demo: Complete with mock crawl data
        setTimeout(async () => {
          try {
            await dynamodb.update({
              TableName: 'atlas-codex-jobs',
              Key: { id: jobId },
              UpdateExpression: 'SET #status = :status, #result = :result, #completedAt = :completedAt',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#result': 'result',
                '#completedAt': 'completedAt'
              },
              ExpressionAttributeValues: {
                ':status': 'completed',
                ':result': {
                  stats: {
                    totalPages: 5,
                    successfulPages: 5,
                    failedPages: 0
                  },
                  pages: [
                    { url: body.url, status: 'success', data: { title: 'Page 1' } },
                    { url: body.url + '/page2', status: 'success', data: { title: 'Page 2' } }
                  ]
                },
                ':completedAt': Date.now()
              }
            }).promise();
          } catch (e) {
            console.error('Error updating job:', e);
          }
        }, 4000);
        
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify({ 
            jobId, 
            status: 'pending',
            message: 'Crawl job queued'
          })
        };
      }
      
      if (method === 'GET') {
        const pathParts = path.split('/');
        const jobId = pathParts[pathParts.length - 1];
        
        const result = await dynamodb.get({
          TableName: 'atlas-codex-jobs',
          Key: { id: jobId }
        }).promise();
        
        if (!result.Item) {
          return {
            statusCode: 404,
            headers: responseHeaders,
            body: JSON.stringify({ error: 'Job not found' })
          };
        }
        
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify(result.Item)
        };
      }
    }
    
    // Default 404 for unmatched routes
    return {
      statusCode: 404,
      headers: responseHeaders,
      body: JSON.stringify({
        error: 'Endpoint not found',
        path: path,
        method: method
      })
    };
    
  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};