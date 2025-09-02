// Atlas Codex API Lambda Handler
const { DynamoDBClient, PutItemCommand, GetItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { processNaturalLanguage } = require('./ai-processor');

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-west-2' });

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key,Authorization,x-api-key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Max-Age': '86400'
};

function generateJobId(type) {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function validateApiKey(headers) {
  const apiKey = headers['x-api-key'] || headers['X-Api-Key'] || headers['authorization']?.replace('Bearer ', '');
  const masterKey = process.env.MASTER_API_KEY || 'test-key-123';
  return apiKey === masterKey;
}

function createResponse(statusCode, body, additionalHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...additionalHeaders
    },
    body: JSON.stringify(body)
  };
}

// Health check endpoint
async function handleHealth() {
  return createResponse(200, {
    status: 'healthy',
    message: 'Atlas Codex API is running!',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      dynamodb: true,
      sqs: true,
      s3: true,
      playwright: false
    }
  });
}

// Extract job handler
async function handleExtract(method, body, headers) {
  if (method === 'OPTIONS') {
    return createResponse(200, {});
  }

  if (!validateApiKey(headers)) {
    return createResponse(401, { error: 'Unauthorized', message: 'Invalid or missing API key' });
  }

  if (method === 'POST') {
    try {
      const params = JSON.parse(body);
      
      if (!params.url) {
        return createResponse(400, { error: 'Bad Request', message: 'URL is required' });
      }

      const jobId = generateJobId('extract');
      const job = {
        id: { S: jobId },
        type: { S: 'extract' },
        status: { S: 'pending' },
        url: { S: params.url },
        params: { S: JSON.stringify(params) },
        createdAt: { N: Date.now().toString() },
        updatedAt: { N: Date.now().toString() }
      };

      // Store job in DynamoDB
      await dynamodb.send(new PutItemCommand({
        TableName: 'atlas-codex-jobs',
        Item: job
      }));

      // Send to SQS
      await sqs.send(new SendMessageCommand({
        QueueUrl: process.env.QUEUE_URL,
        MessageBody: JSON.stringify({
          jobId,
          type: 'extract',
          params
        })
      }));

      const response = {
        jobId,
        status: 'pending',
        message: 'Extract job created successfully',
        statusUrl: `/api/extract/${jobId}`,
        wildcard: params.wildcard || false,
        autonomous: params.autonomous || false,
        baseUrl: params.url,
        limits: {
          maxPages: params.maxPages || 10,
          maxLinks: params.maxLinks || 100,
          maxDepth: params.maxDepth || 5,
          timeout: '300s'
        }
      };

      return createResponse(201, response);
    } catch (error) {
      console.error('Extract job creation failed:', error);
      return createResponse(500, { 
        error: 'Internal Server Error', 
        message: 'Failed to create extract job',
        details: error.message 
      });
    }
  }

  return createResponse(405, { error: 'Method Not Allowed' });
}

// Get job status
async function handleGetJob(jobId) {
  try {
    const result = await dynamodb.send(new GetItemCommand({
      TableName: 'atlas-codex-jobs',
      Key: { id: { S: jobId } }
    }));

    if (!result.Item) {
      return createResponse(404, { error: 'Not Found', message: 'Job not found' });
    }

    const job = {
      jobId: result.Item.id.S,
      status: result.Item.status.S,
      type: result.Item.type.S,
      createdAt: parseInt(result.Item.createdAt.N),
      result: result.Item.result ? JSON.parse(result.Item.result.S) : null,
      error: result.Item.error?.S || null,
      logs: result.Item.logs?.L?.map(log => ({
        timestamp: log.M.timestamp.S,
        level: log.M.level.S,
        message: log.M.message.S
      })) || []
    };

    return createResponse(200, job);
  } catch (error) {
    console.error('Get job failed:', error);
    return createResponse(500, { 
      error: 'Internal Server Error', 
      message: 'Failed to get job status' 
    });
  }
}

// Main handler
exports.handler = async (event) => {
  console.log('Request:', JSON.stringify(event, null, 2));

  const { httpMethod: method, path, body, headers, pathParameters } = event;

  try {
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return createResponse(200, {});
    }

    // Health check
    if (path === '/health' || path === '/dev/health') {
      return await handleHealth();
    }

    // AI Processing endpoint
    if (path === '/api/ai/process' || path === '/dev/api/ai/process') {
      if (method === 'POST') {
        try {
          const params = JSON.parse(body);
          const result = await processNaturalLanguage(params.prompt || params.input, {
            apiKey: params.apiKey || headers['x-openai-key'] || process.env.OPENAI_API_KEY
          });
          
          // Optionally auto-create the extraction job
          if (params.autoExecute !== false) {
            // Create the extraction job with the AI-generated params
            const jobId = generateJobId(result.type || 'extract');
            const job = {
              id: { S: jobId },
              type: { S: result.type || 'extract' },
              status: { S: 'pending' },
              url: { S: result.url },
              params: { S: JSON.stringify({ ...result.params, formats: result.formats }) },
              createdAt: { N: Date.now().toString() },
              updatedAt: { N: Date.now().toString() },
              aiGenerated: { BOOL: true }
            };
            
            await dynamodb.send(new PutItemCommand({
              TableName: 'atlas-codex-jobs',
              Item: job
            }));
            
            await sqs.send(new SendMessageCommand({
              QueueUrl: process.env.QUEUE_URL,
              MessageBody: JSON.stringify({
                jobId,
                type: result.type || 'extract',
                params: { ...result.params, url: result.url, formats: result.formats }
              })
            }));
            
            result.jobId = jobId;
            result.message = 'Job created and queued for processing';
          }
          
          return createResponse(200, result);
        } catch (error) {
          console.error('AI processing failed:', error);
          return createResponse(400, { 
            error: 'AI Processing Error', 
            message: error.message 
          });
        }
      }
      return createResponse(405, { error: 'Method Not Allowed' });
    }
    
    // Extract endpoints
    if (path.includes('/api/extract')) {
      // Extract jobId from path manually since pathParameters might not work with proxy+
      const pathMatch = path.match(/\/api\/extract\/(.+)$/);
      if (pathMatch && pathMatch[1] && method === 'GET') {
        const jobId = pathMatch[1];
        return await handleGetJob(jobId);
      } else {
        return await handleExtract(method, body, headers);
      }
    }

    // Default response
    return createResponse(404, { 
      error: 'Not Found',
      message: `No handler for ${method} ${path}`,
      availableEndpoints: [
        'GET /health',
        'POST /api/extract',
        'GET /api/extract/{jobId}'
      ]
    });

  } catch (error) {
    console.error('Handler error:', error);
    return createResponse(500, { 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
};