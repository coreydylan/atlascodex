// Atlas Codex Core - Shared types and utilities
import { z } from 'zod';

// Export DIP types and services
export * from './dip';
export * from './dip-service';
export * from './firecrawl-service';
export * from './extraction-service';

// Job types
export const JobStatus = z.enum(['pending', 'running', 'completed', 'failed']);
export const JobType = z.enum(['scrape', 'extract', 'crawl']);

// Scrape job schema
export const ScrapeJobSchema = z.object({
  url: z.string().url(),
  scrapeOptions: z.object({
    timeout: z.number().optional(),
    waitFor: z.number().optional(),
    headers: z.record(z.string()).optional(),
    formats: z.array(z.string()).optional()
  }).optional(),
  sessionOptions: z.object({
    viewport: z.object({
      width: z.number(),
      height: z.number()
    }).optional(),
    userAgent: z.string().optional(),
    locale: z.string().optional(),
    forceRender: z.boolean().optional(),
    blockAds: z.boolean().optional()
  }).optional()
});

// Extract job schema  
export const ExtractJobSchema = z.object({
  url: z.string().url(),
  schema: z.record(z.any()),
  prompt: z.string(),
  model: z.string().optional()
});

// Crawl job schema
export const CrawlJobSchema = z.object({
  url: z.string().url(),
  maxPages: z.number().optional(),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
  followLinks: z.boolean().optional()
});

// Job result schemas
export const JobResultSchema = z.object({
  jobId: z.string(),
  type: JobType,
  status: JobStatus,
  params: z.any(),
  data: z.any().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional()
});

// Evidence schema
export const EvidenceSchema = z.object({
  hash: z.string(),
  timestamp: z.string(),
  browserUsed: z.boolean().optional(),
  model: z.string().optional(),
  tokens: z.number().optional()
});

// Types
export type JobStatus = z.infer<typeof JobStatus>;
export type JobType = z.infer<typeof JobType>;
export type ScrapeJob = z.infer<typeof ScrapeJobSchema>;
export type ExtractJob = z.infer<typeof ExtractJobSchema>;
export type CrawlJob = z.infer<typeof CrawlJobSchema>;
export type JobResult = z.infer<typeof JobResultSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;

// Utility functions
export function generateJobId(type: JobType): string {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createEvidence(data: string, options: Partial<Evidence> = {}): Evidence {
  const crypto = require('crypto');
  return {
    hash: crypto.createHash('sha256').update(data).digest('hex'),
    timestamp: new Date().toISOString(),
    ...options
  };
}