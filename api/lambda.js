// Atlas Codex API Lambda Handler with GPT-5 Support - Updated 2025-09-04
const { DynamoDBClient, PutItemCommand, GetItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const RolloutConfig = require('../config/gpt5-rollout');

// GPT-5 Migration: Conditional imports based on rollout
let processNaturalLanguage;
let processWithUnifiedExtractor;

if (RolloutConfig.shouldUseGPT5()) {
  console.log('🚀 GPT-5 ACTIVE: Loading V2 implementations');
  const { AIProcessorV2 } = require('./ai-processor-v2');
  const { EvidenceFirstBridgeV2 } = require('./evidence-first-bridge-v2');
  
  // Create wrapper functions for V2 implementations
  const aiProcessor = new AIProcessorV2();
  const evidenceBridge = new EvidenceFirstBridgeV2();
  
  processNaturalLanguage = async (input, options) => {
    return await aiProcessor.processNaturalLanguage(input, options);
  };
  
  processWithUnifiedExtractor = async (html, params) => {
    return await evidenceBridge.processWithEvidenceFirst(html, params);
  };
} else {
  console.log('📦 GPT-4 ACTIVE: Loading legacy implementations');
  processNaturalLanguage = require('./atlas-generator-integration').processNaturalLanguage;
  processWithUnifiedExtractor = require('./evidence-first-bridge').processWithUnifiedExtractor;
}

const { processWithPlanBasedSystem } = require('./worker-enhanced');

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-west-2' });

// Comprehensive function to clean extraction results for JSON serialization
function cleanExtractionResult(result) {
  const seen = new WeakSet();
  
  function clean(obj) {
    // Handle primitives
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    // Handle circular references
    if (seen.has(obj)) {
      return '[Circular Reference]';
    }
    seen.add(obj);
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => clean(item));
    }
    
    // Handle DOM nodes and Cheerio objects
    if (obj.constructor?.name === 'Element' || 
        obj.constructor?.name === 'Text' || 
        obj.constructor?.name === 'Document' || 
        obj.constructor?.name === 'LoadedCheerio' ||
        obj.tagName || 
        obj.nodeType !== undefined || 
        obj._root ||
        obj.cheerio) {
      return '[DOM Node]';
    }
    
    // Handle functions
    if (typeof obj === 'function') {
      return '[Function]';
    }
    
    // Handle special objects that cause serialization issues
    const cleanObj = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip problematic DOM-related keys
      if (key === 'document' || key === 'dom' || key === 'node' || key === 'parent' || 
          key === 'children' || key === 'prev' || key === 'next' || key === 'previousSibling' || 
          key === 'nextSibling' || key === 'parentNode' || key === 'childNodes' ||
          key === 'ownerDocument' || key === 'firstChild' || key === 'lastChild' ||
          key === '_root' || key === 'cheerio' || key === 'options') {
        continue;
      }
      
      // Skip internal execution traces and plan objects that are too complex
      if (key === 'executionTrace' || key === 'planExecution' || key === 'domAnalysis') {
        // Keep only essential info
        if (value && typeof value === 'object') {
          cleanObj[key] = {
            status: value.status || 'completed',
            timestamp: value.timestamp || new Date().toISOString()
          };
        }
        continue;
      }
      
      // Recursively clean the value
      try {
        cleanObj[key] = clean(value);
      } catch (err) {
        console.warn(`Skipping problematic key ${key}:`, err.message);
        cleanObj[key] = '[Serialization Error]';
      }
    }
    
    return cleanObj;
  }
  
  try {
    return clean(result);
  } catch (err) {
    console.error('Failed to clean extraction result:', err);
    // Return a safe fallback
    return {
      success: false,
      error: 'Result serialization failed',
      timestamp: new Date().toISOString()
    };
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key,Authorization,x-api-key,X-Amz-Date,X-Amz-Security-Token,X-Amz-User-Agent,X-Amzn-Trace-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Max-Age': '86400'
};

function generateJobId(type) {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function validateApiKey(headers) {
  const apiKey = headers['x-api-key'] || headers['X-Api-Key'] || headers['authorization']?.replace('Bearer ', '');
  const masterKey = process.env.MASTER_API_KEY || 'test-key-123';
  // Accept both the test key and the frontend's production key
  const validKeys = [masterKey, 'test-key-123', 'atlas-prod-key-2024'];
  return validKeys.includes(apiKey);
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
        const fetchTimeout = params.timeout ? (params.timeout * 1000) / 2 : 30000; // Half of extraction timeout or 30s
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), fetchTimeout);
        
        let htmlContent;
        try {
          const response = await fetch(params.url, { 
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; AtlasCodex/1.0)'
            }
          });
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          htmlContent = await response.text();
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error(`Request timeout after ${fetchTimeout/1000}s while fetching ${params.url}`);
          }
          throw new Error(`Failed to fetch ${params.url}: ${fetchError.message}`);
        }
        
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
          formats: params.formats || ['structured'],
          UNIFIED_EXTRACTOR_ENABLED: params.UNIFIED_EXTRACTOR_ENABLED,
          forceMultiPage: params.forceMultiPage || false,
          timeout: params.timeout || 60, // Default 60 seconds for extraction operations
          maxPages: params.maxPages || 5,
          maxLinks: params.maxLinks || 20,
          maxDepth: params.maxDepth || 2
        };
        
        // Process with unified extractor system
        const extractionResult = await processWithUnifiedExtractor(htmlContent, extractionParams);
        
        // Clean extraction result for JSON serialization
        const cleanResult = cleanExtractionResult(extractionResult);
        
        // Update job with results
        const completedJob = {
          id: { S: jobId },
          type: { S: 'extract' },
          status: { S: cleanResult.success ? 'completed' : 'failed' },
          url: { S: params.url },
          params: { S: JSON.stringify(params) },
          result: { S: JSON.stringify(cleanResult)},
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
          status: cleanResult.success ? 'completed' : 'failed',
          message: 'Extraction completed',
          result: cleanResult
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
    
    // Debug endpoint to check environment
    if (path === '/debug' || path === '/dev/debug') {
      return createResponse(200, {
        env_check: {
          NODE_ENV: process.env.NODE_ENV,
          UNIFIED_EXTRACTOR_ENABLED: process.env.UNIFIED_EXTRACTOR_ENABLED,
          OPENAI_API_KEY_present: !!process.env.OPENAI_API_KEY,
          OPENAI_API_KEY_length: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
          OPENAI_API_KEY_prefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) : null,
          GPT5_ENABLED: process.env.GPT5_ENABLED,
          GPT5_MODEL_SELECTION: process.env.GPT5_MODEL_SELECTION,
          GPT5_FALLBACK_ENABLED: process.env.GPT5_FALLBACK_ENABLED,
          GPT5_REASONING_ENABLED: process.env.GPT5_REASONING_ENABLED,
          all_env_keys: Object.keys(process.env).filter(k => k.includes('OPENAI') || k.includes('UNIFIED') || k.includes('GPT5')),
          lambda_region: process.env.AWS_REGION,
          lambda_function_name: process.env.AWS_LAMBDA_FUNCTION_NAME
        }
      });
    }

    // AI Processing endpoint - Direct processing (no queuing)
    if (path === '/api/ai/process' || path === '/dev/api/ai/process') {
      if (method === 'OPTIONS') {
        return createResponse(200, {});
      }
      if (method === 'POST') {
        try {
          const params = JSON.parse(body);
          const aiResult = await processNaturalLanguage(params.prompt || params.input, {
            apiKey: params.apiKey || headers['x-openai-key'] || headers['x-api-key'] || process.env.OPENAI_API_KEY
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
              UNIFIED_EXTRACTOR_ENABLED: params.UNIFIED_EXTRACTOR_ENABLED,
              forceMultiPage: params.forceMultiPage || false,
              timeout: params.timeout || 60, // Default 60 seconds for extraction operations
              maxPages: params.maxPages || 5,
              maxLinks: params.maxLinks || 20,
              maxDepth: params.maxDepth || 2,
              ...aiResult.params
            };
            
            console.log('Processing with plan-based system:', extractionParams);
            
            // Process with unified extractor system
            const extractionResult = await processWithUnifiedExtractor(htmlContent, extractionParams);
            
            // Clean extraction result for JSON serialization
            const cleanResult = cleanExtractionResult(extractionResult);
            
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