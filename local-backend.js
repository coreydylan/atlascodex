#!/usr/bin/env node

/**
 * Local Backend Server for GPT-5 Testing
 * Generic data extraction API matching production Atlas Codex pattern
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Force GPT-5 for testing
process.env.FORCE_GPT5 = 'true';
process.env.NODE_ENV = 'development';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Import GPT-5 client
const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    gpt5: true,
    timestamp: new Date().toISOString()
  });
});

// Main extraction endpoint
app.post('/api/extract', async (req, res) => {
  console.log('📥 Extraction request received');
  
  try {
    const { url, extractionInstructions } = req.body;
    
    if (!url || !extractionInstructions) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Please provide url and extractionInstructions'
      });
    }
    
    console.log(`🔗 URL: ${url}`);
    console.log(`📝 Instructions: ${extractionInstructions}`);
    
    // Fetch the webpage
    console.log('📥 Fetching HTML...');
    const response = await fetch(url);
    const html = await response.text();
    console.log(`✅ Fetched ${html.length} characters`);
    
    // Clean HTML
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--.*?-->/gs, '')
      .substring(0, 150000); // Increased limit to capture article content
    
    // Use GPT-5-mini for extraction
    console.log('🤖 Calling GPT-5-mini...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `You are a unified data extraction and schema generation system. Your task is to:
1. ANALYZE the user's extraction request to understand what type of items they want
2. IDENTIFY repeating structural patterns in the HTML that match the user's request
3. GENERATE an appropriate JSON Schema for the requested data type
4. EXTRACT ALL instances of the identified pattern from the HTML content

CRITICAL INSTRUCTIONS FOR COMPLETE EXTRACTION:
1. ANALYZE THE HTML STRUCTURE: Look for repeating patterns, containers, or sections
2. IDENTIFY ALL INSTANCES: Count how many items of the requested type exist
3. EXTRACT EVERYTHING: Do not stop at the first few items
4. PATTERN RECOGNITION: Look for common HTML patterns like:
   - Repeated div containers with similar class names
   - List items (li) containing the data
   - Card/profile sections
   - Table rows
   - Any repeating content sections

EXTRACTION RULES:
1. Focus on the main content the user is requesting, not navigation or UI chrome
2. Distinguish between structural/navigational elements and actual content
3. Extract ALL instances of the requested pattern, not just the first few
4. Preserve the structure and relationships in the data
5. Include all available fields for each item
6. Return clean, well-structured JSON

QUALITY CHECK:
Before returning, verify:
- Have you extracted ALL instances, not just the first few?
- Are these the actual content items the user requested, not peripheral UI elements?
- Does your output match the user's specific request?`
        },
        {
          role: 'user',
          content: `USER REQUEST: ${extractionInstructions}

HTML CONTENT:
${cleanedHtml}

Extract the requested data and return as JSON.`
        }
      ],
      max_completion_tokens: 4000,
      response_format: { type: 'json_object' }
    });
    
    const extractedData = JSON.parse(completion.choices[0].message.content);
    
    // Calculate cost
    const usage = completion.usage;
    const cost = (usage.prompt_tokens * 0.25/1e6) + (usage.completion_tokens * 2.00/1e6);
    
    console.log(`✅ Extraction complete!`);
    console.log(`📊 Tokens: ${usage.total_tokens}`);
    console.log(`💰 Cost: $${cost.toFixed(6)}`);
    
    res.json({
      success: true,
      jobId: `local_${Date.now()}`,
      status: 'completed',
      data: extractedData,
      metadata: {
        model: 'gpt-5-mini',
        processingTime: Date.now(),
        cost: cost,
        tokens: usage.total_tokens,
        url: url
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Natural language endpoint
app.post('/api/natural-language', async (req, res) => {
  console.log('🗣️ Natural language request');
  
  try {
    const { prompt } = req.body;
    
    // Parse the natural language to extract URL and instructions
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: 'Extract the URL and extraction instructions from the user prompt. Return as JSON with "url" and "instructions" fields.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 500,
      response_format: { type: 'json_object' }
    });
    
    const parsed = JSON.parse(completion.choices[0].message.content);
    
    res.json({
      success: true,
      url: parsed.url,
      extractionInstructions: parsed.instructions,
      type: 'scrape',
      formats: ['structured']
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Job status endpoint (mock)
app.get('/api/jobs/:jobId', (req, res) => {
  res.json({
    id: req.params.jobId,
    status: 'completed',
    progress: 100,
    message: 'Extraction complete'
  });
});

// Process endpoint (alias for extract)
app.post('/api/process', async (req, res) => {
  console.log('📥 Process request received');
  
  // Forward to extract endpoint
  req.url = '/api/extract';
  app.handle(req, res);
});

// Extract job status endpoint (for polling)
app.get('/api/extract/:jobId', (req, res) => {
  console.log(`📊 Job status request for: ${req.params.jobId}`);
  res.json({
    id: req.params.jobId,
    status: 'completed',
    progress: 100,
    result: {
      success: true,
      data: {},
      metadata: {
        processingTime: Date.now()
      }
    }
  });
});

// AI processing endpoint with auto-execution
app.post('/api/ai/process', async (req, res) => {
  console.log('🤖 AI Processing request received');
  
  try {
    const { prompt, autoExecute = false } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Please provide a prompt'
      });
    }
    
    console.log(`🤖 AI Prompt: ${prompt}`);
    
    // Parse the natural language to extract URL and instructions
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `Extract the URL and extraction instructions from the user prompt. Return as JSON with these fields:
- "url": the target URL (add https:// if missing)
- "extractionInstructions": what to extract from the page
- "type": extraction type (scrape, crawl, search, map)
- "formats": array of formats (structured, markdown, html, etc)
- "params": any additional parameters`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 500,
      response_format: { type: 'json_object' }
    });
    
    const rawContent = completion.choices[0].message.content;
    console.log('🔍 Raw AI Response:', rawContent);
    
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw content:', rawContent);
      
      // Fallback: try to extract URL manually with full path
      const urlMatch = prompt.match(/(?:https?:\/\/)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/);
      parsed = {
        url: urlMatch ? urlMatch[0] : null,
        extractionInstructions: prompt,
        type: 'scrape',
        formats: ['structured'],
        params: {}
      };
    }
    
    // Ensure URL has protocol
    if (parsed.url && !parsed.url.startsWith('http')) {
      parsed.url = `https://${parsed.url}`;
    }
    
    console.log('🧠 AI Parsed Result:', parsed);
    
    if (autoExecute && parsed.url && parsed.extractionInstructions) {
      console.log('🚀 Auto-executing extraction...');
      
      // Fetch the webpage
      const response = await fetch(parsed.url);
      const html = await response.text();
      console.log(`✅ Fetched ${html.length} characters for auto-execution`);
      
      // Clean HTML
      const cleanedHtml = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<!--.*?-->/gs, '')
        .substring(0, 150000); // Increased limit to capture article content
      
      // Use GPT-5-mini for extraction
      const extractionCompletion = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: `You are a unified data extraction and schema generation system. Your task is to:
1. ANALYZE the user's extraction request to understand what type of items they want
2. IDENTIFY repeating structural patterns in the HTML that match the user's request
3. GENERATE an appropriate JSON Schema for the requested data type
4. EXTRACT ALL instances of the identified pattern from the HTML content

CRITICAL INSTRUCTIONS FOR COMPLETE EXTRACTION:
1. ANALYZE THE HTML STRUCTURE: Look for repeating patterns, containers, or sections
2. IDENTIFY ALL INSTANCES: Count how many items of the requested type exist
3. EXTRACT EVERYTHING: Do not stop at the first few items
4. PATTERN RECOGNITION: Look for common HTML patterns like:
   - Repeated div containers with similar class names
   - List items (li) containing the data
   - Card/profile sections
   - Table rows
   - Any repeating content sections

EXTRACTION RULES:
1. Focus on the main content the user is requesting, not navigation or UI chrome
2. Distinguish between structural/navigational elements and actual content
3. Extract ALL instances of the requested pattern, not just the first few
4. Preserve the structure and relationships in the data
5. Include all available fields for each item
6. Return clean, well-structured JSON

QUALITY CHECK:
Before returning, verify:
- Have you extracted ALL instances, not just the first few?
- Are these the actual content items the user requested, not peripheral UI elements?
- Does your output match the user's specific request?`
          },
          {
            role: 'user',
            content: `USER REQUEST: ${parsed.extractionInstructions}

HTML CONTENT:
${cleanedHtml}

Extract the requested data and return as JSON.`
          }
        ],
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' }
      });
      
      const extractedData = JSON.parse(extractionCompletion.choices[0].message.content);
      
      // Calculate total cost
      const parseUsage = completion.usage;
      const extractUsage = extractionCompletion.usage;
      const totalCost = (parseUsage.prompt_tokens * 0.05/1e6) + (parseUsage.completion_tokens * 0.25/1e6) +
                       (extractUsage.prompt_tokens * 0.25/1e6) + (extractUsage.completion_tokens * 2.00/1e6);
      
      const jobId = `ai_auto_${Date.now()}`;
      console.log(`✅ AI Auto-execution complete! Job ID: ${jobId}`);
      
      return res.json({
        jobId: jobId,
        status: 'completed',
        message: 'AI-powered extraction completed',
        aiProcessing: parsed,
        result: {
          success: true,
          data: extractedData,
          metadata: {
            model: 'gpt-5-mini',
            processingMethod: 'ai_powered_gpt5',
            processingTime: Date.now(),
            cost: totalCost,
            tokens: parseUsage.total_tokens + extractUsage.total_tokens,
            url: parsed.url
          }
        }
      });
    }
    
    // Return parsed result without execution
    res.json({
      success: true,
      ...parsed
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = 3005;
app.listen(PORT, () => {
  console.log('\n🚀 GPT-5 Local Backend Server');
  console.log('==============================');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🤖 Model: GPT-5-mini`);
  console.log(`💰 Cost: ~$0.006 per extraction`);
  console.log('==============================\n');
  console.log('Waiting for requests...\n');
});