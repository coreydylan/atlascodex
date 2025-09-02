// Atlas Codex - Firecrawl Service
// LLM-optimized web scraping and data extraction

import FirecrawlApp from '@mendable/firecrawl-js';
import { z } from 'zod';

// Response schemas
const FirecrawlMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  language: z.string().optional(),
  sourceURL: z.string(),
  statusCode: z.number().optional(),
  error: z.string().optional()
});

const FirecrawlResponseSchema = z.object({
  success: z.boolean(),
  markdown: z.string().optional(),
  html: z.string().optional(),
  links: z.array(z.string()).optional(),
  screenshot: z.string().optional(),
  metadata: FirecrawlMetadataSchema.optional(),
  llm_extraction: z.any().optional(),
  cost: z.number(),
  responseTime: z.number()
});

export type FirecrawlResponse = z.infer<typeof FirecrawlResponseSchema>;

interface FirecrawlScrapeOptions {
  formats?: ('markdown' | 'html' | 'links' | 'screenshot')[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  headers?: Record<string, string>;
  waitFor?: number;
  timeout?: number;
}

interface FirecrawlExtractOptions {
  schema: z.ZodSchema<any>;
  systemPrompt?: string;
  extractionPrompt?: string;
}

interface FirecrawlSearchOptions {
  limit?: number;
  scrapeOptions?: FirecrawlScrapeOptions;
  lang?: string;
  country?: string;
  location?: string;
}

export class FirecrawlService {
  private app: FirecrawlApp;
  private apiKey: string;
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FIRECRAWL_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Firecrawl API key is required');
    }
    
    this.app = new FirecrawlApp({ apiKey: this.apiKey });
  }

  /**
   * Scrape a single URL with LLM-ready markdown output
   */
  async scrape(
    url: string, 
    options?: FirecrawlScrapeOptions
  ): Promise<FirecrawlResponse> {
    const startTime = Date.now();
    
    try {
      const formats = options?.formats || ['markdown'];
      
      const response = await this.app.scrape(url, {
        formats,
        onlyMainContent: options?.onlyMainContent ?? true,
        includeTags: options?.includeTags,
        excludeTags: options?.excludeTags,
        headers: options?.headers,
        waitFor: options?.waitFor,
        timeout: options?.timeout || 30000
      });

      const responseTime = (Date.now() - startTime) / 1000;
      
      // Calculate cost (1 credit = 1 page for standard scraping)
      let cost = 0.001; // Base cost per page
      if (formats.includes('screenshot')) cost += 0.0005;
      
      return {
        success: !!response.markdown,
        markdown: response.markdown,
        html: response.html,
        links: response.links,
        screenshot: response.screenshot,
        metadata: {
          title: response.metadata?.title,
          description: response.metadata?.description,
          language: response.metadata?.language,
          sourceURL: url,
          statusCode: response.metadata?.statusCode
        },
        cost,
        responseTime
      };
    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      return {
        success: false,
        metadata: {
          sourceURL: url,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        cost: 0,
        responseTime
      };
    }
  }

  /**
   * Extract structured data using natural language prompts
   */
  async extract<T>(
    url: string,
    options: FirecrawlExtractOptions
  ): Promise<FirecrawlResponse & { extractedData?: T }> {
    const startTime = Date.now();
    
    try {
      const response = await this.app.scrape(url, {
        formats: ['markdown', 'html'],
        extract: {
          schema: options.schema,
          systemPrompt: options.systemPrompt,
          extractionPrompt: options.extractionPrompt
        }
      });

      const responseTime = (Date.now() - startTime) / 1000;
      
      // Extract mode costs more (4 additional credits)
      const cost = 0.005;
      
      return {
        success: !!response.markdown,
        markdown: response.markdown,
        html: response.html,
        llm_extraction: (response as any).llm_extraction,
        extractedData: (response as any).llm_extraction as T,
        metadata: {
          title: response.metadata?.title,
          sourceURL: url,
          statusCode: response.metadata?.statusCode
        },
        cost,
        responseTime
      };
    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      return {
        success: false,
        metadata: {
          sourceURL: url,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        cost: 0,
        responseTime
      };
    }
  }

  /**
   * Search the web and optionally scrape results
   */
  async search(
    query: string,
    options?: FirecrawlSearchOptions
  ): Promise<{
    success: boolean;
    results: Array<{
      url: string;
      title: string;
      description: string;
      content?: string;
      markdown?: string;
    }>;
    totalCost: number;
    responseTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await this.app.search(query, {
        limit: options?.limit || 5,
        scrapeOptions: options?.scrapeOptions,
        location: options?.location
      });

      const responseTime = (Date.now() - startTime) / 1000;
      
      // 1 credit per search result
      const totalCost = ((response as any).results?.length || 0) * 0.001;
      
      return {
        success: true,
        results: (response as any).results || [],
        totalCost,
        responseTime
      };
    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      return {
        success: false,
        results: [],
        totalCost: 0,
        responseTime
      };
    }
  }

  /**
   * Crawl an entire website
   */
  async crawl(
    url: string,
    options?: {
      maxPages?: number;
      includePaths?: string[];
      excludePaths?: string[];
      maxDepth?: number;
      scrapeOptions?: FirecrawlScrapeOptions;
    }
  ): Promise<{
    success: boolean;
    pages: FirecrawlResponse[];
    totalCost: number;
    totalTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await this.app.crawl(url, {
        limit: options?.maxPages || 10,
        includePaths: options?.includePaths,
        excludePaths: options?.excludePaths,
        scrapeOptions: options?.scrapeOptions
      });

      const pages: FirecrawlResponse[] = [];
      let totalCost = 0;

      if ((response as any).data) {
        for (const page of response.data) {
          const pageCost = 0.001;
          totalCost += pageCost;
          
          pages.push({
            success: true,
            markdown: page.markdown,
            html: page.html,
            metadata: {
              sourceURL: page.metadata?.sourceURL || '',
              title: page.metadata?.title
            },
            cost: pageCost,
            responseTime: 0
          });
        }
      }

      const totalTime = (Date.now() - startTime) / 1000;
      
      return {
        success: !!(response as any).data,
        pages,
        totalCost,
        totalTime
      };
    } catch (error) {
      const totalTime = (Date.now() - startTime) / 1000;
      return {
        success: false,
        pages: [],
        totalCost: 0,
        totalTime
      };
    }
  }

  /**
   * Get a map of all URLs on a website
   */
  async map(url: string): Promise<{
    success: boolean;
    urls: string[];
    cost: number;
    responseTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await this.app.map(url);
      const responseTime = (Date.now() - startTime) / 1000;
      
      // Map is usually very cheap
      const cost = 0.0001;
      
      return {
        success: true,
        urls: (response as any).links || [],
        cost,
        responseTime
      };
    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      return {
        success: false,
        urls: [],
        cost: 0,
        responseTime
      };
    }
  }

  /**
   * Check if Firecrawl service is healthy
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    apiKeyValid: boolean;
    timestamp: string;
  }> {
    try {
      // Try a simple scrape to validate API key
      const response = await this.app.scrape('https://example.com', {
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 5000
      });
      
      return {
        status: !!response.markdown ? 'healthy' : 'unhealthy',
        apiKeyValid: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        apiKeyValid: false,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export const firecrawlService = new FirecrawlService(process.env.FIRECRAWL_API_KEY);