/**
 * Q&A Interface API - REST Endpoints for Extraction Q&A
 * 
 * Provides REST API endpoints for questioning and analyzing extracted data.
 * Supports natural language queries, insight generation, and pattern analysis.
 * 
 * Endpoints:
 * - POST /api/ask - Ask questions about extraction results
 * - POST /api/analyze - Get analysis of data patterns  
 * - POST /api/insights - Generate insights from data
 * - POST /api/qa/session - Create persistent Q&A session
 * - GET /api/qa/session/{id} - Get session and continue conversation
 */

const extractionQA = require('./services/extraction-qa');

// CORS headers for API responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key,Authorization,x-api-key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Max-Age': '86400'
};

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

// In-memory session storage (in production, use Redis or DynamoDB)
const qaSessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function generateSessionId() {
  return `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of qaSessions.entries()) {
    if (now - session.lastAccess > SESSION_TIMEOUT) {
      qaSessions.delete(sessionId);
    }
  }
}

/**
 * Handle ask endpoint - Ask questions about extraction data
 * POST /api/ask
 */
async function handleAsk(body, headers) {
  try {
    const { data, question, options = {} } = JSON.parse(body);

    if (!data) {
      return createResponse(400, {
        success: false,
        error: 'Missing required field: data',
        message: 'Please provide the extracted data to question'
      });
    }

    if (!question) {
      return createResponse(400, {
        success: false,
        error: 'Missing required field: question',
        message: 'Please provide a question to ask about the data'
      });
    }

    console.log(`🤔 Processing Q&A: "${question}"`);
    console.log(`📊 Data size: ${JSON.stringify(data).length} characters`);

    const result = await extractionQA.ask(data, question, options);

    return createResponse(200, {
      success: true,
      question: question,
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Ask endpoint error:', error);
    return createResponse(500, {
      success: false,
      error: 'Internal server error',
      message: 'Failed to process question',
      details: error.message
    });
  }
}

/**
 * Handle analyze endpoint - Analyze data patterns
 * POST /api/analyze
 */
async function handleAnalyze(body, headers) {
  try {
    const { data, focusArea = 'all' } = JSON.parse(body);

    if (!data) {
      return createResponse(400, {
        success: false,
        error: 'Missing required field: data',
        message: 'Please provide the extracted data to analyze'
      });
    }

    console.log(`🔍 Analyzing patterns, focus: ${focusArea}`);
    console.log(`📊 Data size: ${JSON.stringify(data).length} characters`);

    const result = await extractionQA.analyzePatterns(data, focusArea);

    return createResponse(200, {
      success: true,
      focus_area: focusArea,
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Analyze endpoint error:', error);
    return createResponse(500, {
      success: false,
      error: 'Internal server error',
      message: 'Failed to analyze data patterns',
      details: error.message
    });
  }
}

/**
 * Handle insights endpoint - Generate insights from data
 * POST /api/insights
 */
async function handleInsights(body, headers) {
  try {
    const { data, options = {} } = JSON.parse(body);

    if (!data) {
      return createResponse(400, {
        success: false,
        error: 'Missing required field: data',
        message: 'Please provide the extracted data to analyze for insights'
      });
    }

    console.log(`🧠 Generating insights`);
    console.log(`📊 Data size: ${JSON.stringify(data).length} characters`);

    const result = await extractionQA.generateInsights(data, options);

    return createResponse(200, {
      success: true,
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Insights endpoint error:', error);
    return createResponse(500, {
      success: false,
      error: 'Internal server error',
      message: 'Failed to generate insights',
      details: error.message
    });
  }
}

/**
 * Handle session creation - Create persistent Q&A session
 * POST /api/qa/session
 */
async function handleCreateSession(body, headers) {
  try {
    const { data, title = null, description = null } = JSON.parse(body);

    if (!data) {
      return createResponse(400, {
        success: false,
        error: 'Missing required field: data',
        message: 'Please provide the extracted data for the Q&A session'
      });
    }

    cleanExpiredSessions(); // Clean up old sessions

    const sessionId = generateSessionId();
    const session = {
      id: sessionId,
      data: data,
      title: title || 'Q&A Session',
      description: description,
      createdAt: new Date().toISOString(),
      lastAccess: Date.now(),
      questionCount: 0,
      history: []
    };

    qaSessions.set(sessionId, session);

    console.log(`📝 Created Q&A session: ${sessionId}`);

    // Generate initial summary
    const qaInterface = extractionQA.createQAInterface(data);
    const summary = qaInterface.summary();

    return createResponse(201, {
      success: true,
      session: {
        id: sessionId,
        title: session.title,
        description: session.description,
        createdAt: session.createdAt,
        summary: summary
      },
      message: 'Q&A session created successfully'
    });

  } catch (error) {
    console.error('❌ Create session error:', error);
    return createResponse(500, {
      success: false,
      error: 'Internal server error',
      message: 'Failed to create Q&A session',
      details: error.message
    });
  }
}

/**
 * Handle session retrieval and interaction
 * GET /api/qa/session/{sessionId}
 * POST /api/qa/session/{sessionId} (with question in body)
 */
async function handleSession(sessionId, method, body, headers) {
  cleanExpiredSessions();

  const session = qaSessions.get(sessionId);
  if (!session) {
    return createResponse(404, {
      success: false,
      error: 'Session not found',
      message: 'Q&A session not found or has expired'
    });
  }

  session.lastAccess = Date.now();

  if (method === 'GET') {
    // Return session info and history
    return createResponse(200, {
      success: true,
      session: {
        id: session.id,
        title: session.title,
        description: session.description,
        createdAt: session.createdAt,
        questionCount: session.questionCount,
        history: session.history.slice(-10), // Last 10 interactions
        summary: extractionQA.createQAInterface(session.data).summary()
      }
    });
  }

  if (method === 'POST') {
    try {
      const { question, action = 'ask' } = JSON.parse(body);

      if (!question && action === 'ask') {
        return createResponse(400, {
          success: false,
          error: 'Missing required field: question',
          message: 'Please provide a question to ask'
        });
      }

      console.log(`💬 Session ${sessionId}: ${action} - "${question}"`);

      let result;
      switch (action) {
        case 'ask':
          result = await extractionQA.ask(session.data, question);
          break;
        case 'insights':
          result = await extractionQA.generateInsights(session.data);
          break;
        case 'analyze':
          const focusArea = question || 'all';
          result = await extractionQA.analyzePatterns(session.data, focusArea);
          break;
        default:
          return createResponse(400, {
            success: false,
            error: 'Invalid action',
            message: 'Action must be one of: ask, insights, analyze'
          });
      }

      // Add to session history
      const interaction = {
        timestamp: new Date().toISOString(),
        action: action,
        question: question,
        result: result
      };

      session.history.push(interaction);
      session.questionCount++;

      return createResponse(200, {
        success: true,
        session_id: sessionId,
        interaction: interaction,
        session_stats: {
          question_count: session.questionCount,
          created_at: session.createdAt
        }
      });

    } catch (error) {
      console.error('❌ Session interaction error:', error);
      return createResponse(500, {
        success: false,
        error: 'Internal server error',
        message: 'Failed to process session interaction',
        details: error.message
      });
    }
  }

  return createResponse(405, {
    success: false,
    error: 'Method not allowed',
    message: `Method ${method} not supported for sessions`
  });
}

/**
 * Handle health check for Q&A service
 */
async function handleQAHealth() {
  return createResponse(200, {
    status: 'healthy',
    service: 'Atlas Codex Q&A Interface',
    version: '1.0.0',
    features: {
      natural_language_qa: true,
      pattern_analysis: true,
      insight_generation: true,
      persistent_sessions: true,
      response_caching: true
    },
    active_sessions: qaSessions.size,
    cache_status: 'active',
    timestamp: new Date().toISOString()
  });
}

/**
 * Main request router for Q&A endpoints
 */
async function handleQARequest(path, method, body, headers) {
  console.log(`🔗 Q&A API: ${method} ${path}`);

  try {
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return createResponse(200, {});
    }

    // Health check
    if (path === '/api/qa/health') {
      return await handleQAHealth();
    }

    // Ask endpoint
    if (path === '/api/ask') {
      if (method !== 'POST') {
        return createResponse(405, { error: 'Method not allowed' });
      }
      return await handleAsk(body, headers);
    }

    // Analyze endpoint
    if (path === '/api/analyze') {
      if (method !== 'POST') {
        return createResponse(405, { error: 'Method not allowed' });
      }
      return await handleAnalyze(body, headers);
    }

    // Insights endpoint
    if (path === '/api/insights') {
      if (method !== 'POST') {
        return createResponse(405, { error: 'Method not allowed' });
      }
      return await handleInsights(body, headers);
    }

    // Session creation
    if (path === '/api/qa/session' && method === 'POST') {
      return await handleCreateSession(body, headers);
    }

    // Session interaction
    const sessionMatch = path.match(/^\/api\/qa\/session\/(.+)$/);
    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      return await handleSession(sessionId, method, body, headers);
    }

    // List all available endpoints
    if (path === '/api/qa' || path === '/api/qa/') {
      return createResponse(200, {
        success: true,
        service: 'Atlas Codex Q&A Interface',
        endpoints: {
          'POST /api/ask': 'Ask questions about extracted data',
          'POST /api/analyze': 'Analyze data patterns and anomalies',
          'POST /api/insights': 'Generate comprehensive insights from data',
          'POST /api/qa/session': 'Create persistent Q&A session',
          'GET /api/qa/session/{id}': 'Get session info and history',
          'POST /api/qa/session/{id}': 'Ask questions within a session',
          'GET /api/qa/health': 'Q&A service health check'
        },
        examples: {
          ask: {
            url: '/api/ask',
            method: 'POST',
            body: {
              data: '{"products": [{"name": "iPhone", "price": 999}]}',
              question: 'What is the most expensive product?'
            }
          },
          session: {
            url: '/api/qa/session',
            method: 'POST', 
            body: {
              data: '{"sales": [{"month": "Jan", "revenue": 50000}]}',
              title: 'Sales Analysis Session'
            }
          }
        }
      });
    }

    // Not found
    return createResponse(404, {
      success: false,
      error: 'Endpoint not found',
      message: `No Q&A endpoint found for ${method} ${path}`,
      available_endpoints: [
        '/api/ask',
        '/api/analyze', 
        '/api/insights',
        '/api/qa/session',
        '/api/qa/health'
      ]
    });

  } catch (error) {
    console.error('❌ Q&A API error:', error);
    return createResponse(500, {
      success: false,
      error: 'Internal server error',
      message: 'Q&A API request failed',
      details: error.message
    });
  }
}

module.exports = {
  handleQARequest,
  handleAsk,
  handleAnalyze, 
  handleInsights,
  handleCreateSession,
  handleSession,
  handleQAHealth
};