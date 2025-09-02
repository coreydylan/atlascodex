// Atlas Codex Lambda Handler - Full Implementation with AWS SDK v3
const { DynamoDBClient, PutItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Initialize AWS clients
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-west-2' });
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });

// Generate unique job ID
function generateJobId(type) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${type}_${timestamp}_${random}`;
}

// Create a new job in DynamoDB
async function createJob(jobId, type, params) {
  const item = {
    id: { S: jobId },
    type: { S: type },
    status: { S: 'pending' },
    createdAt: { N: Date.now().toString() },
    params: { S: JSON.stringify(params) }
  };

  try {
    await dynamodb.send(new PutItemCommand({
      TableName: 'atlas-codex-jobs',
      Item: item
    }));
    return true;
  } catch (error) {
    console.error('DynamoDB error:', error);
    return false;
  }
}

// Queue job for processing
async function queueJob(jobId, type, params) {
  const message = {
    jobId,
    type,
    params,
    timestamp: Date.now()
  };

  try {
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.QUEUE_URL,
      MessageBody: JSON.stringify(message)
    }));
    return true;
  } catch (error) {
    console.error('SQS error:', error);
    return false;
  }
}

// Get job status from DynamoDB
async function getJobStatus(jobId) {
  try {
    const result = await dynamodb.send(new GetItemCommand({
      TableName: 'atlas-codex-jobs',
      Key: {
        id: { S: jobId }
      }
    }));

    if (!result.Item) {
      return null;
    }

    // Parse logs if they exist
    let logs = [];
    if (result.Item.logs && result.Item.logs.L) {
      logs = result.Item.logs.L.map(log => ({
        timestamp: log.M.timestamp.S,
        level: log.M.level.S,
        message: log.M.message.S
      }));
    }

    return {
      jobId: result.Item.jobId ? result.Item.jobId.S : result.Item.id.S,
      status: result.Item.status.S,
      type: result.Item.type.S,
      createdAt: parseInt(result.Item.createdAt.N),
      result: result.Item.result ? JSON.parse(result.Item.result.S) : null,
      error: result.Item.error ? result.Item.error.S : null,
      logs: logs
    };
  } catch (error) {
    console.error('DynamoDB get error:', error);
    return null;
  }
}

// Validate API key
function validateApiKey(headers) {
  const apiKey = headers['x-api-key'] || headers['X-Api-Key'] || headers.authorization?.replace('Bearer ', '');
  const masterKey = process.env.MASTER_API_KEY || 'test-key-123';
  
  // For development, allow requests without API key
  if (!apiKey && process.env.NODE_ENV !== 'production') {
    return true;
  }
  
  return apiKey === masterKey;
}

// Main Lambda handler
exports.handler = async (event, context) => {
  // Parse request
  const path = event.path || event.rawPath || '/';
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  const headers = event.headers || {};
  
  // Standard response headers
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*'
  };
  
  // Handle OPTIONS for CORS
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: ''
    };
  }
  
  // Health check endpoint
  if (path.includes('health')) {
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify({
        status: 'healthy',
        message: 'Atlas Codex API is running!',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        features: {
          dynamodb: true,
          sqs: true,
          s3: true,
          playwright: false // Will be enabled in worker Lambda
        }
      })
    };
  }
  
  // Root endpoint
  if (path === '/' || path === '/dev' || path === '/dev/') {
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify({
        name: 'Atlas Codex API',
        message: 'High-performance web scraping platform',
        documentation: 'https://github.com/yourusername/atlas-codex',
        endpoints: {
          health: 'GET /health',
          scrape: 'POST /api/scrape',
          'scrape_status': 'GET /api/scrape/{jobId}',
          extract: 'POST /api/extract',
          'extract_status': 'GET /api/extract/{jobId}',
          crawl: 'POST /api/crawl',
          'crawl_status': 'GET /api/crawl/{jobId}'
        },
        status: 'operational',
        authentication: 'Use X-Api-Key header'
      })
    };
  }
  
  // Validate API key for protected endpoints (allow GET requests without key)
  if (path.includes('/api/') && method !== 'GET' && !validateApiKey(headers)) {
    return {
      statusCode: 401,
      headers: responseHeaders,
      body: JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid or missing API key'
      })
    };
  }
  
  // Parse request body
  let body = {};
  if (event.body) {
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      return {
        statusCode: 400,
        headers: responseHeaders,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid JSON in request body'
        })
      };
    }
  }
  
  // Handle scrape endpoint
  if (path.includes('/api/scrape')) {
    // Create new scrape job
    if (method === 'POST') {
      if (!body.url && !body.urls) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'url or urls parameter is required'
          })
        };
      }
      
      // Support both single URL and multiple URLs
      const urls = body.urls || [body.url];
      
      // For multiple URLs, create separate jobs
      if (urls.length > 1) {
        const jobs = [];
        for (const url of urls.slice(0, 10)) { // Limit to 10 URLs max
          const jobId = generateJobId('scrape');
          const params = {
            url: url,
            waitFor: body.waitFor || 'load',
            screenshot: body.screenshot || false,
            fullPage: body.fullPage || false,
            headers: body.headers || {}
          };
          
          // Store job in DynamoDB
          const stored = await createJob(jobId, 'scrape', params);
          if (!stored) {
            return {
              statusCode: 500,
              headers: responseHeaders,
              body: JSON.stringify({
                error: 'Internal Server Error',
                message: 'Failed to create job'
              })
            };
          }
          
          // Queue job for processing
          const queued = await queueJob(jobId, 'scrape', params);
          if (!queued) {
            console.warn('Failed to queue job, but job was created:', jobId);
          }
          
          jobs.push({
            jobId,
            status: 'pending',
            url: url
          });
        }
        
        return {
          statusCode: 201,
          headers: responseHeaders,
          body: JSON.stringify({
            message: `${jobs.length} scrape jobs created successfully`,
            jobs: jobs
          })
        };
      }
      
      // Single URL handling
      const jobId = generateJobId('scrape');
      const params = {
        url: body.url,
        waitFor: body.waitFor || 'load',
        screenshot: body.screenshot || false,
        fullPage: body.fullPage || false,
        headers: body.headers || {}
      };
      
      // Store job in DynamoDB
      const stored = await createJob(jobId, 'scrape', params);
      if (!stored) {
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Internal Server Error',
            message: 'Failed to create job'
          })
        };
      }
      
      // Queue job for processing
      const queued = await queueJob(jobId, 'scrape', params);
      if (!queued) {
        console.warn('Failed to queue job, but job was created:', jobId);
      }
      
      return {
        statusCode: 201,
        headers: responseHeaders,
        body: JSON.stringify({
          jobId,
          status: 'pending',
          message: 'Scrape job created successfully',
          statusUrl: `/api/scrape/${jobId}`
        })
      };
    }
    
    // Get scrape job status
    if (method === 'GET') {
      const pathParts = path.split('/');
      const jobId = pathParts[pathParts.length - 1];
      
      if (!jobId || jobId === 'scrape') {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Job ID is required'
          })
        };
      }
      
      const job = await getJobStatus(jobId);
      if (!job) {
        return {
          statusCode: 404,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Not Found',
            message: 'Job not found'
          })
        };
      }
      
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(job)
      };
    }
  }
  
  // Handle extract endpoint
  if (path.includes('/api/extract')) {
    if (method === 'POST') {
      if (!body.url) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'url parameter is required'
          })
        };
      }
      
      const jobId = generateJobId('extract');
      
      // Check if URL ends with /* for wildcard extraction
      const isWildcard = body.url.endsWith('/*');
      const baseUrl = isWildcard ? body.url.slice(0, -2) : body.url;
      
      const params = {
        url: baseUrl,
        prompt: body.prompt || 'Extract all relevant information from this page',
        schema: body.schema || null,
        model: body.model || 'gpt-4o', // Default to GPT-4o for better agent performance
        wildcard: isWildcard,
        // Autonomous orchestration parameters
        maxLinks: body.maxLinks || 100, // Increased for autonomous mode
        maxPages: body.maxPages || 10, // How many pages to process
        maxDepth: body.maxDepth || 5, // Pagination depth
        timeout: body.timeout || 300000, // 5 minutes timeout
        stopPatterns: body.stopPatterns || ['No more pages', 'End of results'],
        linkPatterns: body.linkPatterns || [], // Optional patterns to filter links
        excludePatterns: body.excludePatterns || [], // Patterns to exclude
        agentic: body.agentic !== false, // Enable agentic mode by default for wildcard
        autonomous: isWildcard ? (body.autonomous !== false) : body.autonomous // Auto-enable for wildcard
      };
      
      const stored = await createJob(jobId, 'extract', params);
      if (!stored) {
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Internal Server Error',
            message: 'Failed to create job'
          })
        };
      }
      
      const queued = await queueJob(jobId, 'extract', params);
      if (!queued) {
        console.warn('Failed to queue job, but job was created:', jobId);
      }
      
      return {
        statusCode: 201,
        headers: responseHeaders,
        body: JSON.stringify({
          jobId,
          status: 'pending',
          message: isWildcard 
            ? 'Autonomous multi-agent extraction started - will discover links, handle pagination, and deploy specialized agents'
            : 'Extract job created successfully',
          statusUrl: `/api/extract/${jobId}`,
          wildcard: isWildcard,
          autonomous: params.autonomous,
          baseUrl: baseUrl,
          limits: {
            maxPages: params.maxPages,
            maxLinks: params.maxLinks,
            maxDepth: params.maxDepth,
            timeout: `${params.timeout / 1000}s`
          }
        })
      };
    }
    
    if (method === 'GET') {
      const pathParts = path.split('/');
      const jobId = pathParts[pathParts.length - 1];
      
      if (!jobId || jobId === 'extract') {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Job ID is required'
          })
        };
      }
      
      const job = await getJobStatus(jobId);
      if (!job) {
        return {
          statusCode: 404,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Not Found',
            message: 'Job not found'
          })
        };
      }
      
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(job)
      };
    }
  }
  
  // Handle jobs endpoint (generic job status)
  if (path.includes('/api/jobs/')) {
    if (method === 'GET') {
      const pathParts = path.split('/');
      const jobId = pathParts[pathParts.length - 1];
      
      if (!jobId || jobId === 'jobs') {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Job ID is required'
          })
        };
      }
      
      const job = await getJobStatus(jobId);
      
      if (!job) {
        return {
          statusCode: 404,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Not Found',
            message: 'Job not found'
          })
        };
      }
      
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(job)
      };
    }
  }
  
  // Handle crawl endpoint
  if (path.includes('/api/crawl')) {
    if (method === 'POST') {
      if (!body.url) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'url parameter is required'
          })
        };
      }
      
      const jobId = generateJobId('crawl');
      const params = {
        url: body.url,
        maxPages: body.maxPages || 10,
        maxDepth: body.maxDepth || 2,
        includePatterns: body.includePatterns || [],
        excludePatterns: body.excludePatterns || [],
        waitBetween: body.waitBetween || 1000
      };
      
      const stored = await createJob(jobId, 'crawl', params);
      if (!stored) {
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Internal Server Error',
            message: 'Failed to create job'
          })
        };
      }
      
      const queued = await queueJob(jobId, 'crawl', params);
      if (!queued) {
        console.warn('Failed to queue job, but job was created:', jobId);
      }
      
      return {
        statusCode: 201,
        headers: responseHeaders,
        body: JSON.stringify({
          jobId,
          status: 'pending',
          message: 'Crawl job created successfully',
          statusUrl: `/api/crawl/${jobId}`
        })
      };
    }
    
    if (method === 'GET') {
      const pathParts = path.split('/');
      const jobId = pathParts[pathParts.length - 1];
      
      if (!jobId || jobId === 'crawl') {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'Job ID is required'
          })
        };
      }
      
      const job = await getJobStatus(jobId);
      if (!job) {
        return {
          statusCode: 404,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'Not Found',
            message: 'Job not found'
          })
        };
      }
      
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(job)
      };
    }
  }
  
  // Default 404 response
  return {
    statusCode: 404,
    headers: responseHeaders,
    body: JSON.stringify({
      error: 'Not Found',
      message: `No handler for ${method} ${path}`,
      availableEndpoints: [
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
};