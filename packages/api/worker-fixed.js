// Atlas Codex Worker Lambda - Fixed version with robust timeout handling
const { DynamoDBClient, UpdateItemCommand, ScanCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { chromium } = require('playwright-core');
const cheerio = require('cheerio');
const TurndownService = require('turndown');

// Initialize AWS clients
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });

// CRITICAL: Lambda timeout buffer - Reserve 30s for cleanup
const LAMBDA_TIMEOUT = parseInt(process.env.LAMBDA_TIMEOUT || '300') * 1000; // 5 min default
const CLEANUP_BUFFER = 30000; // 30 seconds for cleanup
const MAX_JOB_RUNTIME = LAMBDA_TIMEOUT - CLEANUP_BUFFER; // 4.5 minutes for actual work

// Timeout wrapper with graceful degradation
async function withTimeout(promise, timeoutMs, timeoutMessage = 'Operation timed out') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Safe WebSocket broadcast that doesn't block
async function broadcastJobUpdate(jobId, status, result = null, error = null) {
  // Fire and forget - don't await or block on WebSocket operations
  setImmediate(async () => {
    try {
      if (!process.env.WEBSOCKET_API_ENDPOINT) return;
      
      const connections = await withTimeout(
        dynamodb.send(new ScanCommand({
          TableName: process.env.CONNECTIONS_TABLE || 'atlas-codex-connections',
          ProjectionExpression: 'connectionId'
        })),
        2000,
        'WebSocket connection scan timeout'
      ).catch(() => ({ Items: [] }));
      
      if (!connections.Items || connections.Items.length === 0) return;
      
      const apiGateway = new ApiGatewayManagementApiClient({
        endpoint: process.env.WEBSOCKET_API_ENDPOINT.replace('wss://', 'https://')
      });
      
      const message = JSON.stringify({
        type: 'job_update',
        jobId,
        status,
        result,
        error,
        timestamp: Date.now()
      });
      
      // Send to all connections but don't wait
      connections.Items.forEach(async (connection) => {
        try {
          await apiGateway.send(new PostToConnectionCommand({
            ConnectionId: connection.connectionId.S,
            Data: message
          }));
        } catch (err) {
          if (err.name === 'GoneException') {
            dynamodb.send(new DeleteItemCommand({
              TableName: process.env.CONNECTIONS_TABLE || 'atlas-codex-connections',
              Key: { connectionId: { S: connection.connectionId.S } }
            })).catch(() => {});
          }
        }
      });
    } catch (err) {
      console.error('WebSocket broadcast error (non-blocking):', err.message);
    }
  });
}

// Heartbeat mechanism for job monitoring
class JobHeartbeat {
  constructor(jobId, intervalMs = 10000) {
    this.jobId = jobId;
    this.intervalMs = intervalMs;
    this.intervalId = null;
    this.lastUpdate = Date.now();
  }
  
  start() {
    this.intervalId = setInterval(() => {
      this.updateHeartbeat();
    }, this.intervalMs);
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  async updateHeartbeat() {
    try {
      this.lastUpdate = Date.now();
      await dynamodb.send(new UpdateItemCommand({
        TableName: 'atlas-codex-jobs',
        Key: { id: { S: this.jobId } },
        UpdateExpression: 'SET #heartbeat = :timestamp',
        ExpressionAttributeNames: { '#heartbeat': 'heartbeat' },
        ExpressionAttributeValues: { ':timestamp': { N: Date.now().toString() } }
      }));
    } catch (err) {
      console.error('Heartbeat update failed:', err.message);
    }
  }
}

// Stream log with timeout protection
async function streamJobLog(jobId, message, level = 'info') {
  // Don't block on logging
  setImmediate(async () => {
    try {
      await withTimeout(
        dynamodb.send(new UpdateItemCommand({
          TableName: process.env.JOBS_TABLE || 'atlas-codex-jobs',
          Key: { id: { S: jobId } },
          UpdateExpression: 'SET #logs = list_append(if_not_exists(#logs, :empty), :log)',
          ExpressionAttributeNames: { '#logs': 'logs' },
          ExpressionAttributeValues: {
            ':empty': { L: [] },
            ':log': { L: [{ M: {
              timestamp: { S: new Date().toISOString() },
              level: { S: level },
              message: { S: message.substring(0, 1000) } // Limit message size
            }}]}
          }
        })),
        2000,
        'Log update timeout'
      );
    } catch (err) {
      console.error('Failed to stream log (non-blocking):', err.message);
    }
  });
  
  // Also broadcast via WebSocket
  broadcastJobUpdate(jobId, 'log', { message, level });
}

// Update job status with guaranteed execution
async function updateJobStatus(jobId, status, result = null, error = null, forceUpdate = false) {
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
    // Truncate result if too large
    const resultStr = JSON.stringify(result);
    const truncatedResult = resultStr.length > 400000 ? 
      JSON.stringify({ 
        ...result, 
        _truncated: true, 
        _message: 'Result truncated due to size limits' 
      }) : resultStr;
    expressionAttributeValues[':result'] = { S: truncatedResult };
  }

  if (error) {
    updateExpression.push('#error = :error');
    expressionAttributeNames['#error'] = 'error';
    expressionAttributeValues[':error'] = { S: error.substring(0, 5000) };
  }

  try {
    // Use shorter timeout for status updates
    await withTimeout(
      dynamodb.send(new UpdateItemCommand({
        TableName: 'atlas-codex-jobs',
        Key: { id: { S: jobId } },
        UpdateExpression: updateExpression.join(', '),
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
      })),
      5000,
      'Status update timeout'
    );
    
    // Non-blocking WebSocket broadcast
    broadcastJobUpdate(jobId, status, result, error);
    return true;
  } catch (err) {
    console.error(`CRITICAL: Failed to update job ${jobId} status to ${status}:`, err);
    
    // If force update, try a minimal update
    if (forceUpdate && status === 'failed') {
      try {
        await dynamodb.send(new UpdateItemCommand({
          TableName: 'atlas-codex-jobs',
          Key: { id: { S: jobId } },
          UpdateExpression: 'SET #status = :status',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':status': { S: 'failed' } }
        }));
      } catch (lastErr) {
        console.error('Even force update failed:', lastErr);
      }
    }
    return false;
  }
}

// Initialize Turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// Anti-detection headers and user agents
const REALISTIC_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0'
];

// [Previous scraping functions remain the same - scrapeWithAdvancedAntiDetection, scrapeWithStealthBrowser, etc.]
// ... (lines 87-1619 from original remain the same) ...

// Enhanced synthesis with timeout and chunking
async function synthesizeFinalResultsWithTimeout(jobId, state, params, openai) {
  console.log(`🎯 Coordinator Agent synthesizing ${state.extractedData.length} results with timeout protection`);
  await streamJobLog(jobId, `📝 Preparing synthesis of ${state.extractedData.length} extraction results...`, 'info');
  
  // Check if we have enough time left
  const timeElapsed = Date.now() - state.startTime;
  const timeRemaining = MAX_JOB_RUNTIME - timeElapsed;
  
  if (timeRemaining < 30000) { // Less than 30 seconds left
    console.warn('⚠️ Not enough time for synthesis, returning raw results');
    await streamJobLog(jobId, '⚠️ Time limit approaching, returning raw results', 'warning');
    
    return {
      url: params.url,
      strategy: 'autonomous_multi_agent',
      configuration: {
        start_url: params.url,
        pages_crawled: state.totalPagesProcessed,
        duration_seconds: Math.round(timeElapsed / 1000)
      },
      pages: state.extractedData.slice(0, 50), // Limit to 50 pages
      orchestrator_summary: {
        pages_processed: state.totalPagesProcessed,
        links_discovered: state.totalLinksFound,
        extraction_results: state.extractedData.length,
        stop_reason: 'Timeout - returning raw results'
      },
      coordinator_synthesis: 'Synthesis skipped due to time constraints',
      autonomous: true,
      _timeout_fallback: true
    };
  }
  
  // Prepare data for synthesis (with size limits)
  const fullResults = state.extractedData.slice(0, 100).map(result => ({
    agent_id: result.agent_id,
    url: result.url,
    page: result.page,
    extractedData: result.extractedData,
    error: result.error || null
  }));
  
  const promptSize = JSON.stringify(fullResults).length;
  console.log(`📊 Prompt size: ${promptSize} chars (${fullResults.length} results)`);
  
  // Chunk the data if too large
  let synthesisResult = '';
  const MAX_PROMPT_SIZE = 100000; // 100KB limit per request
  
  if (promptSize > MAX_PROMPT_SIZE) {
    console.log('📦 Data too large, using chunked synthesis');
    await streamJobLog(jobId, '📦 Using chunked synthesis for large dataset', 'info');
    
    // Process in chunks
    const chunkSize = Math.ceil(fullResults.length / Math.ceil(promptSize / MAX_PROMPT_SIZE));
    const chunks = [];
    
    for (let i = 0; i < fullResults.length; i += chunkSize) {
      chunks.push(fullResults.slice(i, i + chunkSize));
    }
    
    const chunkSummaries = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunkSynthesis = await withTimeout(
          synthesizeChunk(chunks[i], params, openai, i + 1, chunks.length),
          30000,
          `Chunk ${i + 1} synthesis timeout`
        );
        chunkSummaries.push(chunkSynthesis);
      } catch (err) {
        console.error(`Chunk ${i + 1} synthesis failed:`, err);
        chunkSummaries.push(`Chunk ${i + 1}: Synthesis failed - ${err.message}`);
      }
    }
    
    synthesisResult = chunkSummaries.join('\n\n---\n\n');
  } else {
    // Single synthesis call with timeout
    try {
      synthesisResult = await withTimeout(
        performSynthesis(fullResults, params, state, openai),
        Math.min(60000, timeRemaining - 10000), // Max 60s, leave 10s buffer
        'Synthesis timeout - returning partial results'
      );
    } catch (err) {
      console.error('Synthesis failed:', err);
      synthesisResult = `Synthesis failed: ${err.message}\n\nRaw extraction count: ${state.extractedData.length} results from ${state.totalPagesProcessed} pages`;
    }
  }
  
  // Build final result
  const crawledPages = state.extractedData.slice(0, 50).map(result => ({
    url: result.url,
    title: result.metadata?.title || 'Untitled',
    extractedData: result.extractedData || null
  }));
  
  const finalResult = {
    url: params.url,
    strategy: 'autonomous_multi_agent',
    configuration: {
      start_url: params.url,
      max_pages: state.stopConditions.maxPages,
      pages_crawled: state.totalPagesProcessed,
      duration_seconds: Math.round((Date.now() - state.startTime) / 1000)
    },
    pages: crawledPages,
    orchestrator_summary: {
      pages_processed: state.totalPagesProcessed,
      links_discovered: state.totalLinksFound,
      extraction_results: state.extractedData.length,
      stop_reason: determineStopReason(state)
    },
    coordinator_synthesis: synthesisResult,
    autonomous: true
  };
  
  console.log(`✅ Synthesis completed for job ${jobId}`);
  await streamJobLog(jobId, '✅ Synthesis completed successfully', 'success');
  
  return finalResult;
}

// Helper function for chunk synthesis
async function synthesizeChunk(chunkData, params, openai, chunkNum, totalChunks) {
  const prompt = `
  You are synthesizing chunk ${chunkNum} of ${totalChunks} from a multi-page extraction.
  
  Original Request: ${params.prompt}
  
  Chunk Data (${chunkData.length} results):
  ${JSON.stringify(chunkData, null, 2).substring(0, 50000)}
  
  Provide a concise summary of the key findings in this chunk.
  `;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a data synthesis agent. Be concise.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 2000,
    temperature: 0.3
  });
  
  return `Chunk ${chunkNum}/${totalChunks}:\n${response.choices[0].message.content}`;
}

// Helper function for full synthesis
async function performSynthesis(fullResults, params, state, openai) {
  const coordinatorPrompt = `
  You are the Coordinator Agent synthesizing results from autonomous multi-page extraction.
  
  Original Request: ${params.prompt}
  
  Extraction Summary:
  - Total pages processed: ${state.totalPagesProcessed}
  - Total extraction results: ${fullResults.length}
  - Duration: ${Math.round((Date.now() - state.startTime) / 1000)}s
  
  Results:
  ${JSON.stringify(fullResults, null, 2).substring(0, 80000)}
  
  Provide a comprehensive synthesis highlighting:
  1. Key findings across all pages
  2. Patterns and trends
  3. Most important discoveries
  4. Actionable insights
  
  Be thorough but concise.
  `;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a Coordinator Agent that synthesizes extraction results. Provide comprehensive but concise synthesis.'
      },
      { role: 'user', content: coordinatorPrompt }
    ],
    max_tokens: 4000,
    temperature: 0.3
  });
  
  return response.choices[0].message.content;
}

// Determine stop reason
function determineStopReason(state) {
  const conditions = state.stopConditions;
  
  if (Date.now() - state.startTime >= MAX_JOB_RUNTIME) {
    return `Lambda timeout protection triggered (${Math.round(MAX_JOB_RUNTIME / 1000)}s)`;
  }
  
  if (state.totalPagesProcessed >= conditions.maxPages) {
    return `Reached maximum pages limit (${conditions.maxPages})`;
  }
  
  if (state.totalLinksFound >= conditions.maxLinks) {
    return `Reached maximum links limit (${conditions.maxLinks})`;
  }
  
  if (state.currentPage > conditions.maxDepth) {
    return `Reached maximum depth (${conditions.maxDepth})`;
  }
  
  return 'Natural completion - no more pages found';
}

// Enhanced autonomous orchestration with timeout protection
async function processAutonomousOrchestrationWithTimeout(jobId, params, state, openai) {
  console.log(`🎭 Orchestrator Agent taking control with timeout protection`);
  await streamJobLog(jobId, `🎭 Orchestrator Agent taking control`, 'info');
  
  const heartbeat = new JobHeartbeat(jobId);
  heartbeat.start();
  
  try {
    while (!(await shouldStop(state, jobId))) {
      // Check if we're approaching Lambda timeout
      const timeElapsed = Date.now() - state.startTime;
      if (timeElapsed > MAX_JOB_RUNTIME - 60000) { // 1 minute before timeout
        console.warn('⏰ Approaching Lambda timeout, initiating graceful shutdown');
        await streamJobLog(jobId, '⏰ Time limit approaching, finishing extraction', 'warning');
        break;
      }
      
      try {
        const currentUrl = state.currentPage === 1 ? 
          params.url : 
          state.paginationUrls[state.currentPage - 2] || params.url;
        
        await broadcastJobUpdate(jobId, 'processing', {
          phase: 'orchestration',
          currentPage: state.currentPage,
          totalProcessed: state.totalPagesProcessed,
          message: `Processing page ${state.currentPage}`
        });
        
        // Scrape with timeout
        const pageResult = await withTimeout(
          scrapeWithAdvancedAntiDetection(currentUrl),
          30000,
          'Page scraping timeout'
        );
        
        // Discover links with timeout
        const discoveredLinks = await withTimeout(
          discoverLinks(currentUrl, 50, params.linkPatterns || [], params.excludePatterns || []),
          20000,
          'Link discovery timeout'
        );
        
        // Get orchestrator decision with timeout
        const decision = await withTimeout(
          getOrchestratorDecision(
            currentUrl, 
            state, 
            params, 
            pageResult, 
            discoveredLinks, 
            openai
          ),
          30000,
          'Orchestrator decision timeout'
        );
        
        // Process decision
        if (decision.strategy === 'stop' || decision.stop_recommendation) {
          if (state.extractedData.length > 0) {
            console.log(`🛑 Orchestrator decided to stop: ${decision.reasoning}`);
            break;
          } else {
            // Force at least one extraction
            decision.strategy = 'single_page';
            decision.extraction_targets = [{
              agent_id: 'agent_forced',
              target_url: currentUrl,
              focus: params.prompt || 'Extract all relevant data',
              priority: 10
            }];
          }
        }
        
        // Deploy agents with timeout
        if (decision.extraction_targets && decision.extraction_targets.length > 0) {
          const pageResults = await withTimeout(
            deployExtractionAgentsWithTimeout(
              jobId, 
              decision.extraction_targets, 
              params, 
              openai,
              state.currentPage
            ),
            60000,
            'Agent deployment timeout'
          );
          
          state.extractedData = state.extractedData.concat(pageResults);
          state.totalLinksFound += decision.extraction_targets.length;
        }
        
        // Handle pagination
        if (decision.pagination && decision.pagination.has_next && decision.pagination.next_page_url) {
          state.paginationUrls.push(decision.pagination.next_page_url);
          state.currentPage++;
        } else {
          break;
        }
        
        state.totalPagesProcessed++;
        
        // Respectful delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (pageError) {
        console.error(`Error on page ${state.currentPage}:`, pageError);
        await streamJobLog(jobId, `⚠️ Error on page ${state.currentPage}: ${pageError.message}`, 'error');
        
        // Continue to next page if available
        if (state.paginationUrls.length > state.currentPage - 1) {
          state.currentPage++;
          continue;
        } else {
          break;
        }
      }
    }
    
    // Final synthesis with timeout protection
    const coordinatorResult = await synthesizeFinalResultsWithTimeout(jobId, state, params, openai);
    
    await streamJobLog(jobId, `✅ Orchestration complete. Processed ${state.totalPagesProcessed} pages`, 'success');
    return coordinatorResult;
    
  } finally {
    heartbeat.stop();
  }
}

// Get orchestrator decision with proper error handling
async function getOrchestratorDecision(currentUrl, state, params, pageResult, discoveredLinks, openai) {
  // [Previous orchestrator decision logic]
  // This would include the prompt building and OpenAI call from the original
  // but wrapped with proper error handling
  
  const discoveryPrompt = `
  You are an Orchestrator Discovery Agent.
  
  Current State:
  - Page ${state.currentPage}
  - Total pages processed: ${state.totalPagesProcessed}
  - URLs already processed: ${Array.from(state.processedUrls).length}
  
  Current Page URL: ${currentUrl}
  User Prompt: ${params.prompt}
  
  Discovered Links: ${discoveredLinks.length} links found
  
  Page Content Preview:
  ${pageResult.markdown.substring(0, 4000)}
  
  Return a JSON decision with:
  {
    "strategy": "single_page" | "multi_agent" | "pagination" | "stop",
    "reasoning": "reasoning",
    "agents_needed": number,
    "extraction_targets": [...],
    "pagination": {...},
    "stop_recommendation": boolean
  }
  `;
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an Orchestrator Agent. Make quick decisions.' },
        { role: 'user', content: discoveryPrompt }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
      temperature: 0.3
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error('Orchestrator decision failed:', err);
    // Fallback decision
    return {
      strategy: 'single_page',
      reasoning: 'Fallback due to decision error',
      agents_needed: 1,
      extraction_targets: [{
        agent_id: 'agent_fallback',
        target_url: currentUrl,
        focus: params.prompt,
        priority: 10
      }],
      stop_recommendation: false
    };
  }
}

// Deploy agents with timeout protection
async function deployExtractionAgentsWithTimeout(jobId, targets, params, openai, pageNum) {
  const results = [];
  const MAX_AGENT_TIME = 20000; // 20 seconds per agent
  
  for (const target of targets) {
    try {
      const agentResult = await withTimeout(
        processSingleAgent(target, params, openai, pageNum),
        MAX_AGENT_TIME,
        `Agent ${target.agent_id} timeout`
      );
      results.push(agentResult);
    } catch (err) {
      console.error(`Agent ${target.agent_id} failed:`, err);
      results.push({
        agent_id: target.agent_id,
        page: pageNum,
        url: target.target_url,
        error: err.message,
        extractedData: null
      });
    }
  }
  
  return results;
}

// Process single agent extraction
async function processSingleAgent(target, params, openai, pageNum) {
  // Simplified agent processing
  const agentResult = await scrapeWithAdvancedAntiDetection(target.target_url);
  
  const extraction = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `You are ${target.agent_id}. Focus: ${target.focus}` },
      { 
        role: 'user', 
        content: `Extract: ${params.prompt}\n\nContent:\n${agentResult.markdown.substring(0, 8000)}`
      }
    ],
    response_format: params.schema ? { type: 'json_object' } : undefined,
    max_tokens: 2000,
    temperature: 0.3
  });
  
  return {
    agent_id: target.agent_id,
    page: pageNum,
    url: target.target_url,
    extractedData: params.schema ? 
      JSON.parse(extraction.choices[0].message.content) : 
      extraction.choices[0].message.content,
    metadata: agentResult.metadata
  };
}

// Should stop evaluation
async function shouldStop(state, jobId) {
  const conditions = state.stopConditions;
  const timeElapsed = Date.now() - state.startTime;
  
  // Check Lambda timeout
  if (timeElapsed > MAX_JOB_RUNTIME - 60000) { // 1 minute buffer
    console.log(`🛑 Approaching Lambda timeout`);
    if (jobId) await streamJobLog(jobId, `🛑 Time limit approaching`, 'warning');
    return true;
  }
  
  if (state.totalPagesProcessed >= conditions.maxPages) {
    console.log(`🛑 Max pages reached: ${conditions.maxPages}`);
    return true;
  }
  
  if (state.totalLinksFound >= conditions.maxLinks) {
    console.log(`🛑 Max links reached: ${conditions.maxLinks}`);
    return true;
  }
  
  return false;
}

// Enhanced agentic extraction with timeout protection
async function processAgenticExtractionWithTimeout(jobId, params) {
  const jobStartTime = Date.now();
  const heartbeat = new JobHeartbeat(jobId);
  
  try {
    heartbeat.start();
    
    console.log(`🤖 Starting autonomous extraction with timeout protection`);
    await streamJobLog(jobId, `🤖 Starting autonomous extraction`, 'info');
    
    const orchestratorState = {
      totalPagesProcessed: 0,
      totalLinksFound: 0,
      currentPage: 1,
      paginationUrls: [],
      processedUrls: new Set(),
      extractedData: [],
      stopConditions: {
        maxPages: params.maxPages || 50,
        maxLinks: params.maxLinks || 100,
        maxDepth: params.maxDepth || 3,
        timeout: MAX_JOB_RUNTIME
      },
      startTime: jobStartTime
    };
    
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-placeholder') {
      throw new Error('OpenAI API key required for agentic extraction');
    }
    
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Process with timeout protection
    const result = await withTimeout(
      processAutonomousOrchestrationWithTimeout(jobId, params, orchestratorState, openai),
      MAX_JOB_RUNTIME,
      'Job timeout - returning partial results'
    );
    
    await updateJobStatus(jobId, 'completed', result);
    return result;
    
  } catch (error) {
    console.error(`Agentic extraction failed:`, error);
    
    // Try to save partial results if we have any
    if (error.message.includes('timeout') && orchestratorState?.extractedData?.length > 0) {
      const partialResult = {
        url: params.url,
        strategy: 'autonomous_multi_agent',
        status: 'partial',
        error: 'Job timed out but partial results available',
        pages_processed: orchestratorState.totalPagesProcessed,
        results: orchestratorState.extractedData.slice(0, 20),
        _timeout: true
      };
      
      await updateJobStatus(jobId, 'completed', partialResult, 'Timeout with partial results');
      return partialResult;
    }
    
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
    
  } finally {
    heartbeat.stop();
  }
}

// Main Lambda handler with enhanced timeout protection
exports.handler = async (event, context) => {
  console.log('Worker Lambda started:', JSON.stringify(event));
  console.log('Lambda timeout:', context.getRemainingTimeInMillis(), 'ms');
  
  const results = [];
  
  // Set up graceful shutdown handler
  const shutdownHandler = async (jobId, reason) => {
    console.error(`CRITICAL: Lambda shutting down - ${reason}`);
    await updateJobStatus(jobId, 'failed', null, `Lambda shutdown: ${reason}`, true);
  };
  
  for (const record of event.Records) {
    const jobStartTime = Date.now();
    let jobId;
    
    try {
      const message = JSON.parse(record.body);
      jobId = message.jobId;
      const { type, params } = message;
      
      console.log(`Processing ${type || 'extract'} job: ${jobId}`);
      console.log(`Time remaining: ${context.getRemainingTimeInMillis()}ms`);
      
      // Check if we have enough time to process this job
      if (context.getRemainingTimeInMillis() < 60000) { // Less than 1 minute
        console.error('Not enough time to process job, requeueing');
        results.push({ 
          jobId, 
          success: false, 
          error: 'Insufficient Lambda time remaining' 
        });
        continue;
      }
      
      // Set up emergency timeout handler
      const emergencyTimeout = setTimeout(async () => {
        await shutdownHandler(jobId, 'Emergency timeout triggered');
      }, context.getRemainingTimeInMillis() - 20000); // 20 seconds before Lambda timeout
      
      let result;
      const jobType = type || 'extract';
      
      switch (jobType) {
        case 'scrape':
          result = await processScrapeJob(jobId, params);
          break;
        case 'extract':
          // Check if this is agentic extraction
          if (params.wildcard || params.autonomous || params.agentic) {
            result = await processAgenticExtractionWithTimeout(jobId, params);
          } else {
            result = await processExtractJob(jobId, params);
          }
          break;
        case 'crawl':
          result = await processCrawlJob(jobId, params);
          break;
        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }
      
      clearTimeout(emergencyTimeout);
      results.push({ jobId, success: true, result });
      
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);
      
      // Ensure job status is updated even on failure
      if (jobId) {
        await updateJobStatus(jobId, 'failed', null, error.message, true);
      }
      
      results.push({ 
        jobId: jobId || record.messageId, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  // Return failed items for retry
  return {
    batchItemFailures: results
      .filter(r => !r.success)
      .map(r => ({ itemIdentifier: r.jobId }))
  };
};

// [Keep the original scraping functions and other utilities from lines 87-1619]
// [Keep the ECS container mode from lines 2235-2301]

module.exports = exports;