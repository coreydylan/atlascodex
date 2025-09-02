// Atlas Codex - Domain Intelligence Profiles (DIP) Core Types
import { z } from 'zod';

// Site Structure Schema
export const SiteStructureSchema = z.object({
  framework: z.string().nullable(),
  renderingType: z.enum(['ssr', 'spa', 'static', 'hybrid']),
  requiresJavaScript: z.boolean(),
  contentSelectors: z.record(z.string()),
  commonPatterns: z.array(z.string()),
  dynamicContent: z.boolean(),
  optimalHeaders: z.record(z.string()).optional(),
  contentTypes: z.array(z.string()).optional()
});

// Extraction Strategy Schema
export const ExtractionStrategySchema = z.object({
  type: z.enum([
    'static_fetch', 
    'browser_render', 
    'gpt5_nano', 
    'gpt5_mini', 
    'gpt5_standard',
    'scrapling_adaptive',
    'scrapling_stealth',
    'firecrawl_markdown',
    'firecrawl_extract',
    'firecrawl_search'
  ]),
  success: z.boolean(),
  cost: z.number(),
  responseTime: z.number(),
  reliability: z.number(),
  dataQuality: z.number(),
  errorRate: z.number(),
  lastTested: z.string(),
  tokens: z.number().optional(),
  adaptiveSelectors: z.record(z.string()).optional(),
  extractionSchema: z.any().optional()
});

// Optimal Strategy Schema
export const OptimalStrategySchema = z.object({
  strategy: z.enum([
    'static_fetch', 
    'browser_render', 
    'gpt5_nano', 
    'gpt5_mini', 
    'gpt5_standard',
    'scrapling_adaptive',
    'scrapling_stealth',
    'firecrawl_markdown',
    'firecrawl_extract',
    'firecrawl_search'
  ]),
  confidence: z.number(),
  fallbackChain: z.array(z.string()),
  costPerExtraction: z.number(),
  averageResponseTime: z.number(),
  successRate: z.number(),
  verbosity: z.enum(['low', 'medium', 'high']).optional(),
  reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high']).optional()
});

// Cost Profile Schema
export const CostProfileSchema = z.object({
  averageCost: z.number(),
  minCost: z.number(),
  maxCost: z.number(),
  costByStrategy: z.record(z.number()),
  projectedMonthlyCost: z.number(),
  costTrend: z.enum(['increasing', 'stable', 'decreasing'])
});

// Performance Metrics Schema
export const PerformanceMetricsSchema = z.object({
  averageResponseTime: z.number(),
  p95ResponseTime: z.number(),
  p99ResponseTime: z.number(),
  successRate: z.number(),
  errorRate: z.number(),
  cacheHitRate: z.number().optional()
});

// Site Constraints Schema
export const SiteConstraintsSchema = z.object({
  robotsTxt: z.object({
    exists: z.boolean(),
    allowedPaths: z.array(z.string()),
    disallowedPaths: z.array(z.string()),
    crawlDelay: z.number(),
    sitemapUrls: z.array(z.string()),
    userAgents: z.array(z.string())
  }),
  rateLimit: z.object({
    maxRequestsPerMinute: z.number(),
    recommendedDelay: z.number(),
    hasRateLimit: z.boolean(),
    testResults: z.array(z.any()).optional()
  }),
  preferredUserAgent: z.string().optional(),
  recommendedTimeout: z.number().optional()
});

// Domain Intelligence Profile Schema
export const DomainIntelligenceProfileSchema = z.object({
  domain: z.string(),
  version: z.string(),
  createdAt: z.string(),
  lastUpdated: z.string(),
  creationTime: z.number().optional(),
  siteStructure: SiteStructureSchema,
  extractionStrategies: z.array(ExtractionStrategySchema),
  optimalStrategy: OptimalStrategySchema,
  costProfile: CostProfileSchema,
  performanceMetrics: PerformanceMetricsSchema,
  constraints: SiteConstraintsSchema,
  
  // Metadata
  testUrl: z.string(),
  confidence: z.number(),
  nextReviewDate: z.string(),
  
  // Evidence
  evidence: z.object({
    hash: z.string(),
    timestamp: z.string(),
    testResults: z.number()
  }),
  
  // Update history
  updateHistory: z.array(z.object({
    timestamp: z.string(),
    reason: z.string(),
    changes: z.array(z.string())
  })).optional()
});

// Type exports
export type SiteStructure = z.infer<typeof SiteStructureSchema>;
export type ExtractionStrategy = z.infer<typeof ExtractionStrategySchema>;
export type OptimalStrategy = z.infer<typeof OptimalStrategySchema>;
export type CostProfile = z.infer<typeof CostProfileSchema>;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;
export type SiteConstraints = z.infer<typeof SiteConstraintsSchema>;
export type DomainIntelligenceProfile = z.infer<typeof DomainIntelligenceProfileSchema>;

// Helper functions
export function isDIPStale(dip: DomainIntelligenceProfile, maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): boolean {
  const age = Date.now() - new Date(dip.lastUpdated).getTime();
  return age > maxAgeMs;
}

export function getDIPAge(dip: DomainIntelligenceProfile): number {
  return Date.now() - new Date(dip.createdAt).getTime();
}

export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

export function incrementVersion(version: string): string {
  const parts = version.split('.');
  const patch = parseInt(parts[2] || '0', 10);
  return `${parts[0]}.${parts[1]}.${patch + 1}`;
}