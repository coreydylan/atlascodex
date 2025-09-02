// Production server with Supabase + Modal integration

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createClient } from '@supabase/supabase-js';
import Modal from '@modal-labs/modal';
import { nanoid } from 'nanoid';
import OpenAI from 'openai';

// Initialize services
const fastify = Fastify({ logger: true });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const modal = new Modal({ apiKey: process.env.MODAL_API_KEY });

// CORS for frontend
await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'https://atlascodex.vercel.app'
});

// Auth middleware
async function authenticate(request, reply) {
  const apiKey = request.headers.authorization?.replace('Bearer ', '');
  
  if (!apiKey) {
    return reply.code(401).send({ error: 'API key required' });
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('api_key', apiKey)
    .single();
  
  if (!profile) {
    return reply.code(401).send({ error: 'Invalid API key' });
  }
  
  if (profile.credits <= 0) {
    return reply.code(402).send({ error: 'Insufficient credits' });
  }
  
  request.user = profile;
}

// Check credits
async function useCredits(userId, amount) {
  const { error } = await supabase.rpc('use_credits', {
    user_id: userId,
    amount: amount
  });
  
  if (error) throw error;
}

// API Routes
fastify.post('/api/scrape', { preHandler: authenticate }, async (request, reply) => {
  const jobId = `scrape_${nanoid()}`;
  
  // Create job in database
  await supabase.from('jobs').insert({
    id: jobId,
    user_id: request.user.id,
    type: 'scrape',
    status: 'pending',
    params: request.body
  });
  
  // Process async
  processScrape(jobId, request.user.id, request.body);
  
  return { jobId, status: 'pending' };
});

fastify.get('/api/scrape/:jobId', { preHandler: authenticate }, async (request, reply) => {
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', request.params.jobId)
    .eq('user_id', request.user.id)
    .single();
  
  if (!job) {
    return reply.code(404).send({ error: 'Job not found' });
  }
  
  return job;
});

fastify.post('/api/extract', { preHandler: authenticate }, async (request, reply) => {
  const jobId = `extract_${nanoid()}`;
  
  await supabase.from('jobs').insert({
    id: jobId,
    user_id: request.user.id,
    type: 'extract',
    status: 'pending',
    params: request.body
  });
  
  processExtract(jobId, request.user.id, request.body);
  
  return { jobId, status: 'pending' };
});

fastify.post('/api/crawl', { preHandler: authenticate }, async (request, reply) => {
  const jobId = `crawl_${nanoid()}`;
  
  await supabase.from('jobs').insert({
    id: jobId,
    user_id: request.user.id,
    type: 'crawl',
    status: 'pending',
    params: request.body
  });
  
  processCrawl(jobId, request.user.id, request.body);
  
  return { jobId, status: 'pending' };
});

// Processing functions
async function processScrape(jobId, userId, params) {
  try {
    // Update status
    await supabase.from('jobs').update({ status: 'running' }).eq('id', jobId);
    
    // Call Modal worker
    const result = await modal.call('atlas-codex-browsers', 'scrape_page', {
      url: params.url,
      options: params.scrapeOptions
    });
    
    // Store evidence
    if (result.evidence) {
      await supabase.from('evidence').insert({
        id: `ev_${nanoid()}`,
        job_id: jobId,
        url: params.url,
        content_hash: result.evidence.hash,
        metadata: result.metadata
      });
    }
    
    // Update job with result
    await supabase.from('jobs').update({
      status: 'completed',
      result: result,
      credits_used: 1,
      completed_at: new Date().toISOString()
    }).eq('id', jobId);
    
    // Deduct credits
    await useCredits(userId, 1);
    
  } catch (error) {
    await supabase.from('jobs').update({
      status: 'failed',
      error: error.message,
      completed_at: new Date().toISOString()
    }).eq('id', jobId);
  }
}

async function processExtract(jobId, userId, params) {
  try {
    await supabase.from('jobs').update({ status: 'running' }).eq('id', jobId);
    
    // First scrape the page
    const scrapeResult = await modal.call('atlas-codex-browsers', 'scrape_page', {
      url: params.url,
      options: { formats: ['markdown'] }
    });
    
    // Use OpenAI to extract
    const completion = await openai.chat.completions.create({
      model: params.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extract structured data according to this schema: ${JSON.stringify(params.schema)}`
        },
        {
          role: 'user',
          content: `${params.prompt}\n\nContent:\n${scrapeResult.markdown}`
        }
      ],
      response_format: { type: 'json_object' }
    });
    
    const extracted = JSON.parse(completion.choices[0].message.content);
    
    const result = {
      url: params.url,
      extracted,
      confidence: 0.95,
      evidence: scrapeResult.evidence,
      tokens: completion.usage.total_tokens
    };
    
    await supabase.from('jobs').update({
      status: 'completed',
      result: result,
      credits_used: 3,
      completed_at: new Date().toISOString()
    }).eq('id', jobId);
    
    await useCredits(userId, 3);
    
  } catch (error) {
    await supabase.from('jobs').update({
      status: 'failed',
      error: error.message,
      completed_at: new Date().toISOString()
    }).eq('id', jobId);
  }
}

async function processCrawl(jobId, userId, params) {
  try {
    await supabase.from('jobs').update({ status: 'running' }).eq('id', jobId);
    
    // Call Modal crawler
    const result = await modal.call('atlas-codex-browsers', 'crawl_site', {
      start_url: params.url,
      options: params
    });
    
    const creditsUsed = result.stats.totalPages;
    
    await supabase.from('jobs').update({
      status: 'completed',
      result: result,
      credits_used: creditsUsed,
      completed_at: new Date().toISOString()
    }).eq('id', jobId);
    
    await useCredits(userId, creditsUsed);
    
  } catch (error) {
    await supabase.from('jobs').update({
      status: 'failed',
      error: error.message,
      completed_at: new Date().toISOString()
    }).eq('id', jobId);
  }
}

// Health check
fastify.get('/health', async () => {
  return { 
    status: 'healthy',
    timestamp: new Date().toISOString()
  };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ 
      port: process.env.PORT || 3000,
      host: '0.0.0.0' 
    });
    console.log('Atlas Codex API running on port', process.env.PORT || 3000);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();