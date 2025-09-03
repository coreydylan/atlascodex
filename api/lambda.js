// Atlas Codex API Lambda Handler
const { DynamoDBClient, PutItemCommand, GetItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { processNaturalLanguage } = require('./atlas-generator-integration');
const { processWithPlanBasedSystem } = require('./worker-enhanced');

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

      // Store initial job in DynamoDB (skip for now due to permissions)
      try {
        await dynamodb.send(new PutItemCommand({
          TableName: 'atlas-codex-jobs',
          Item: job
        }));
      } catch (dbError) {
        console.log('DynamoDB unavailable, proceeding without storage:', dbError.message);
      }

      // Process extraction immediately with our improved system
      try {
        console.log(`Processing extraction immediately for job ${jobId}`);
        
        // Fetch HTML content (Node.js 20 has built-in fetch)
        const response = await fetch(params.url);
        const htmlContent = await response.text();
        
        // Convert API params to worker format
        const extractionParams = {
          url: params.url,
          extractionInstructions: params.extractionInstructions || params.prompt || `Extract data from ${params.url}`,
          outputSchema: params.outputSchema || {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              metadata: { type: 'object' }
            }
          },
          postProcessing: params.postProcessing || null,
          formats: params.formats || ['structured']
        };
        
        // Process with our improved plan-based system
        const extractionResult = await processWithPlanBasedSystem(htmlContent, extractionParams);
        
        // Update job with results
        const completedJob = {
          id: { S: jobId },
          type: { S: 'extract' },
          status: { S: extractionResult.success ? 'completed' : 'failed' },
          url: { S: params.url },
          params: { S: JSON.stringify(params) },
          result: { S: JSON.stringify({
            success: extractionResult.success,
            data: extractionResult.data || null,
            metadata: extractionResult.metadata || {},
            evidence: extractionResult.evidence || null,
            error: extractionResult.error || null
          })},
          createdAt: { N: Date.now().toString() },
          updatedAt: { N: Date.now().toString() }
        };
        
        // Store result in DynamoDB (skip for now due to permissions)
        try {
          await dynamodb.send(new PutItemCommand({
            TableName: 'atlas-codex-jobs',
            Item: completedJob
          }));
        } catch (dbError) {
          console.log('DynamoDB storage failed, proceeding:', dbError.message);
        }
        
        // Return immediate results
        return createResponse(200, {
          jobId,
          status: extractionResult.success ? 'completed' : 'failed',
          message: 'Extraction completed',
          result: {
            success: extractionResult.success,
            data: extractionResult.data || null,
            metadata: extractionResult.metadata || {},
            evidence: extractionResult.evidence || null,
            error: extractionResult.error || null
          }
        });
        
      } catch (processingError) {
        console.error('Extraction processing failed:', processingError);
        
        // Update job with error
        const failedJob = {
          id: { S: jobId },
          type: { S: 'extract' },
          status: { S: 'failed' },
          url: { S: params.url },
          params: { S: JSON.stringify(params) },
          result: { S: JSON.stringify({
            success: false,
            error: processingError.message,
            timestamp: new Date().toISOString()
          })},
          createdAt: { N: Date.now().toString() },
          updatedAt: { N: Date.now().toString() }
        };
        
        // Store error in DynamoDB (skip for now due to permissions)
        try {
          await dynamodb.send(new PutItemCommand({
            TableName: 'atlas-codex-jobs',
            Item: failedJob
          }));
        } catch (dbError) {
          console.log('DynamoDB storage failed, proceeding:', dbError.message);
        }
        
        return createResponse(200, {
          jobId,
          status: 'failed',
          message: 'Extraction failed',
          result: {
            success: false,
            error: processingError.message
          }
        });
      }
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

    // AI Processing endpoint - Direct processing (no queuing)
    if (path === '/api/ai/process' || path === '/dev/api/ai/process') {
      if (method === 'POST') {
        try {
          const params = JSON.parse(body);
          const aiResult = await processNaturalLanguage(params.prompt || params.input, {
            apiKey: params.apiKey || headers['x-openai-key'] || process.env.OPENAI_API_KEY
          });
          
          // Auto-execute extraction with improved plan-based system
          if (params.autoExecute !== false) {
            const jobId = generateJobId('extract');
            
            // Get the URL and prepare extraction
            const targetUrl = aiResult.url;
            if (!targetUrl) {
              throw new Error('No URL found in AI processing result');
            }
            
            // Fetch HTML content
            let htmlContent;
            try {
              const fetchResponse = await fetch(targetUrl);
              if (!fetchResponse.ok) {
                throw new Error(`Failed to fetch ${targetUrl}: ${fetchResponse.status}`);
              }
              htmlContent = await fetchResponse.text();
            } catch (fetchError) {
              console.error('URL fetch error:', fetchError);
              throw new Error(`Unable to fetch content from ${targetUrl}: ${fetchError.message}`);
            }
            
            // Prepare extraction parameters
            const extractionParams = {
              url: targetUrl,
              extractionInstructions: params.prompt || params.input,
              formats: aiResult.formats || ['structured'],
              ...aiResult.params
            };
            
            console.log('Processing with plan-based system:', extractionParams);
            
            // Process with our improved plan-based system
            const extractionResult = await processWithPlanBasedSystem(htmlContent, extractionParams);
            
            // Ensure result is serializable (remove any circular references)
            const cleanResult = JSON.parse(JSON.stringify(extractionResult, (key, value) => {
              // Remove DOM-related circular references
              if (key === 'document' || key === 'dom' || key === 'node' || key === 'parent' || 
                  key === 'children' || key === 'prev' || key === 'next' || key === 'previousSibling' || 
                  key === 'nextSibling' || key === 'parentNode' || key === 'childNodes' ||
                  key === 'ownerDocument' || key === 'firstChild' || key === 'lastChild') {
                return undefined;
              }
              // Also skip objects that look like DOM elements/nodes or Cheerio objects
              if (value && typeof value === 'object' && 
                  (value.constructor?.name === 'Element' || value.constructor?.name === 'Text' || 
                   value.constructor?.name === 'Document' || value.constructor?.name === 'LoadedCheerio' ||
                   value.tagName || value.nodeType || value._root)) {
                return '[DOM Node]';
              }
              return value;
            }));
            
            // Return immediate results with AI context
            return createResponse(200, {
              jobId,
              status: cleanResult.success ? 'completed' : 'failed',
              message: 'AI-powered extraction completed',
              aiProcessing: aiResult,
              result: cleanResult
            });
          }
          
          // Just return AI parsing without execution
          return createResponse(200, aiResult);
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