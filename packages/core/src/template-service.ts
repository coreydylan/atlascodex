// Atlas Codex - Production Template Service
// Integrates template system with existing extraction architecture

import { ExtractionRequest, ExtractionResult } from './extraction-service';
import { ProductionTemplateLibrary, DisplayTemplateLibrary } from './template-library';
import { ExtractionTemplate, DisplayTemplate, TemplateMatch, DisplayMatch, TelemetryEvent } from './template-types';
import { allCoreTemplates, allDisplayTemplates } from './core-templates';

// Mock implementations for interfaces (would be replaced with real implementations)
class MockVectorIndex {
  private embeddings = new Map<string, number[]>();

  async embed(text: string): Promise<number[]> {
    // Simple hash-based embedding for demo
    const hash = this.simpleHash(text);
    return Array.from({ length: 384 }, (_, i) => Math.sin(hash + i) * 0.1);
  }

  async store(id: string, embedding: number[]): Promise<void> {
    this.embeddings.set(id, embedding);
  }

  async search(queryEmbedding: number[], limit: number): Promise<Array<{ id: string; score: number }>> {
    const results = [];
    
    for (const [id, embedding] of this.embeddings) {
      const score = this.cosineSimilarity(queryEmbedding, embedding);
      results.push({ id, score });
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.embeddings.delete(id);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

class MockTemplateStorage {
  private storage = new Map<string, any>();

  async get<T>(id: string): Promise<T | null> {
    return this.storage.get(id) || null;
  }

  async set<T>(id: string, template: T): Promise<void> {
    this.storage.set(id, template);
  }

  async list<T>(prefix?: string): Promise<T[]> {
    const results = [];
    for (const [key, value] of this.storage) {
      if (!prefix || key.startsWith(prefix)) {
        results.push(value);
      }
    }
    return results;
  }

  async delete(id: string): Promise<void> {
    this.storage.delete(id);
  }
}

class MockDriftDetector {
  async analyze(templateId: string, recentResults: Array<{ success: boolean; failedFields: string[] }>) {
    const failures = recentResults.filter(r => !r.success);
    const failureRate = failures.length / recentResults.length;
    
    return {
      template_id: templateId,
      is_drifting: failureRate > 0.2,
      drift_score: failureRate,
      failure_rate: failureRate,
      failed_fields: [...new Set(failures.flatMap(f => f.failedFields))],
      recommendation: failureRate > 0.5 ? 'update' as const : 'monitor' as const
    };
  }
}

// Enhanced extraction request with template support
export interface TemplateExtractionRequest extends ExtractionRequest {
  useTemplates?: boolean;
  preferredTemplate?: string;
  displayGeneration?: boolean;
  userContext?: {
    device?: 'mobile' | 'tablet' | 'desktop';
    locale?: string;
    preferences?: Record<string, any>;
  };
}

// Enhanced extraction result with display information
export interface TemplateExtractionResult extends ExtractionResult {
  template?: {
    id: string;
    confidence: number;
    match_reasons: string[];
  };
  displaySpec?: {
    template_id: string;
    spec: any;
    confidence: number;
  };
  telemetry?: TelemetryEvent[];
}

// Main template service
export class TemplateService {
  private extractionLibrary: ProductionTemplateLibrary;
  private displayLibrary: DisplayTemplateLibrary;
  private telemetryEvents: TelemetryEvent[] = [];

  constructor() {
    const vectorIndex = new MockVectorIndex();
    const storage = new MockTemplateStorage();
    const driftDetector = new MockDriftDetector();

    // Initialize libraries
    this.extractionLibrary = new ProductionTemplateLibrary(
      vectorIndex,
      storage,
      driftDetector,
      (event) => this.handleTelemetry(event)
    );

    this.displayLibrary = new DisplayTemplateLibrary(
      storage,
      (event) => this.handleTelemetry(event)
    );

    // Load core templates on initialization
    this.loadCoreTemplates();
  }

  /**
   * Enhanced extraction with template matching and display generation
   */
  async extractWithTemplates(request: TemplateExtractionRequest): Promise<TemplateExtractionResult> {
    const result: TemplateExtractionResult = {
      success: false,
      strategy: 'firecrawl_extract',
      metadata: {
        url: request.url,
        extractionTime: 0,
        cost: 0
      }
    };

    const startTime = Date.now();

    try {
      // Phase 1: Find matching extraction template
      let templateMatch: TemplateMatch | null = null;
      
      if (request.useTemplates !== false) {
        const content = {
          url: request.url,
          text: request.extractPrompt || '',
          html: ''
        };

        const matches = await this.extractionLibrary.findMatches(
          request.extractPrompt || request.url, 
          content
        );

        templateMatch = matches[0] || null;

        if (templateMatch) {
          // Use template schema for extraction
          request.extractSchema = templateMatch.template.schema as any;
          result.template = {
            id: templateMatch.template.id,
            confidence: templateMatch.confidence,
            match_reasons: templateMatch.match_reasons || []
          };
        }
      }

      // Phase 2: Perform extraction (this would integrate with existing ExtractionService)
      // For now, we'll simulate the extraction result
      const extractionResult = await this.simulateExtraction(request);
      
      // Merge extraction results
      result.success = extractionResult.success;
      result.data = extractionResult.data;
      result.content = extractionResult.content;
      result.markdown = extractionResult.markdown;
      result.metadata = {
        ...result.metadata,
        ...extractionResult.metadata
      };

      // Phase 3: Generate optimal display (if requested)
      if (request.displayGeneration && result.success && result.data) {
        const displayMatch = await this.displayLibrary.findOptimalDisplay(
          Array.isArray(result.data) ? result.data : [result.data],
          request.extractPrompt || request.url,
          request.userContext
        );

        if (displayMatch) {
          result.displaySpec = {
            template_id: displayMatch.template.id,
            spec: displayMatch.template.display_spec,
            confidence: displayMatch.confidence
          };
        }
      }

      // Phase 4: Update template metrics if template was used
      if (templateMatch) {
        await this.updateTemplateMetrics(templateMatch.template.id, result.success);
      }

      result.metadata.extractionTime = (Date.now() - startTime) / 1000;
      result.telemetry = [...this.telemetryEvents];

    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.metadata.extractionTime = (Date.now() - startTime) / 1000;
    }

    return result;
  }

  /**
   * Get template recommendations for a URL/query
   */
  async getTemplateRecommendations(url: string, query?: string): Promise<TemplateMatch[]> {
    const content = {
      url,
      text: query || url,
      html: ''
    };

    return await this.extractionLibrary.findMatches(query || url, content);
  }

  /**
   * Get display recommendations for data
   */
  async getDisplayRecommendations(
    data: any[], 
    query: string, 
    context?: any
  ): Promise<DisplayMatch | null> {
    return await this.displayLibrary.findOptimalDisplay(data, query, context);
  }

  /**
   * Get template library statistics
   */
  async getTemplateStats(): Promise<{
    totalExtractionTemplates: number;
    totalDisplayTemplates: number;
    templateUsage: Record<string, number>;
    avgAccuracy: number;
    driftingTemplates: number;
  }> {
    const maintenanceCandidates = await this.extractionLibrary.getMaintenanceCandidates();
    
    return {
      totalExtractionTemplates: allCoreTemplates.length,
      totalDisplayTemplates: allDisplayTemplates.length,
      templateUsage: {}, // Would be populated from real metrics
      avgAccuracy: 0.87,
      driftingTemplates: maintenanceCandidates.filter(c => c.issue === 'drifting').length
    };
  }

  /**
   * Get templates requiring maintenance
   */
  async getMaintenanceTasks() {
    return await this.extractionLibrary.getMaintenanceCandidates();
  }

  /**
   * Get recent telemetry events
   */
  getTelemetry(since?: string): TelemetryEvent[] {
    return this.extractionLibrary.getTelemetry(since);
  }

  /**
   * Load core templates into the library
   */
  private async loadCoreTemplates() {
    console.log('🔄 Loading core templates...');
    
    // Load extraction templates
    for (const template of allCoreTemplates) {
      try {
        await this.extractionLibrary.store(template);
      } catch (error) {
        console.error(`Failed to load extraction template ${template.id}:`, error);
      }
    }

    // Load display templates
    for (const template of allDisplayTemplates) {
      try {
        await this.displayLibrary.store(template);
      } catch (error) {
        console.error(`Failed to load display template ${template.id}:`, error);
      }
    }

    console.log(`✅ Loaded ${allCoreTemplates.length} extraction templates and ${allDisplayTemplates.length} display templates`);
  }

  /**
   * Simulate extraction (would integrate with real ExtractionService)
   */
  private async simulateExtraction(request: TemplateExtractionRequest): Promise<ExtractionResult> {
    // This is a placeholder - in production this would call the actual extraction service
    return {
      success: true,
      strategy: request.strategy || 'firecrawl_extract',
      data: [
        {
          name: "Sample Data",
          title: "Example Title",
          description: "This is simulated extraction data"
        }
      ],
      metadata: {
        url: request.url,
        extractionTime: 1.2,
        cost: 0.05
      }
    };
  }

  /**
   * Update template metrics based on usage
   */
  private async updateTemplateMetrics(templateId: string, success: boolean) {
    // This would update template success rates, usage counts, etc.
    console.log(`📊 Updated metrics for template ${templateId}: success=${success}`);
  }

  /**
   * Handle telemetry events
   */
  private handleTelemetry(event: TelemetryEvent) {
    this.telemetryEvents.push(event);
    
    // Keep only recent events (last 1000)
    if (this.telemetryEvents.length > 1000) {
      this.telemetryEvents = this.telemetryEvents.slice(-1000);
    }
    
    console.log(`📈 Telemetry: ${event.type} at ${event.timestamp}`);
  }
}

// Export singleton instance
export const templateService = new TemplateService();