// Atlas Codex - Production Template Library with Governance
// Vector-augmented semantic matching with comprehensive safety controls

import { 
  ExtractionTemplate, 
  DisplayTemplate, 
  TemplateMatch, 
  DisplayMatch,
  DriftResult,
  TelemetryEvent,
  calculateChecksum,
  validateTemplateIntegrity,
  createTelemetryEvent
} from './template-types';

// Mock vector index interface (would integrate with real vector DB)
interface VectorIndex {
  embed(text: string): Promise<number[]>;
  store(id: string, embedding: number[]): Promise<void>;
  search(queryEmbedding: number[], limit: number): Promise<Array<{ id: string; score: number }>>;
  delete(id: string): Promise<void>;
}

// Mock storage interface (would integrate with DynamoDB/PostgreSQL)
interface TemplateStorage {
  get<T>(id: string): Promise<T | null>;
  set<T>(id: string, template: T): Promise<void>;
  list<T>(prefix?: string): Promise<T[]>;
  delete(id: string): Promise<void>;
}

// Mock drift detector interface
interface DriftDetector {
  analyze(templateId: string, recentResults: Array<{ success: boolean; failedFields: string[] }>): Promise<DriftResult>;
}

// Page content interface
interface PageContent {
  url: string;
  text: string;
  html?: string;
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
}

// Template candidate for scoring
interface TemplateCandidate {
  template: ExtractionTemplate;
  tokenScore: number;
  vectorScore: number;
  historicalScore: number;
}

// Production Template Library with comprehensive governance
export class ProductionTemplateLibrary {
  private telemetryEvents: TelemetryEvent[] = [];

  constructor(
    private vectorIndex: VectorIndex,
    private storage: TemplateStorage,
    private driftDetector: DriftDetector,
    private telemetryCallback?: (event: TelemetryEvent) => void
  ) {}

  /**
   * Store template with security validation and versioning
   */
  async store(template: ExtractionTemplate): Promise<void> {
    // Validate template security and structure
    await this.validateTemplateSecurity(template);
    
    // Generate signed checksum for supply-chain hygiene
    const checksum = calculateChecksum(template);
    const versionedTemplate: ExtractionTemplate = {
      ...template,
      checksum,
      success_metrics: {
        accuracy: 0,
        usage_count: 0,
        drift_score: 0
      }
    };

    // Validate integrity
    if (!validateTemplateIntegrity(versionedTemplate)) {
      throw new Error('Template integrity validation failed');
    }

    // Store with version control
    await this.storage.set(template.id, versionedTemplate);
    
    // Index embeddings for semantic search
    const embedding = await this.vectorIndex.embed(
      [...template.trigger_patterns, ...template.confidence_indicators].join(' ')
    );
    await this.vectorIndex.store(template.id, embedding);
  }

  /**
   * Find matching templates with hybrid scoring
   */
  async findMatches(query: string, content: PageContent): Promise<TemplateMatch[]> {
    const startTime = Date.now();
    
    // Phase 1: Fast heuristic matching
    const heuristicMatches = await this.heuristicMatch(query, content);
    
    // Phase 2: Vector similarity search
    const queryEmbedding = await this.vectorIndex.embed(query);
    const semanticResults = await this.vectorIndex.search(queryEmbedding, 10);
    
    // Phase 3: Combine and score candidates
    const candidates = await this.combineMatches(heuristicMatches, semanticResults);
    
    // Phase 4: Apply negative evidence filtering
    const filtered = this.filterNegativeEvidence(candidates, content);
    
    // Phase 5: Final scoring with historical performance
    const matches = filtered.map(candidate => ({
      template: candidate.template,
      confidence: 0.5 * candidate.tokenScore + 
                 0.3 * candidate.vectorScore + 
                 0.2 * candidate.historicalScore,
      match_reasons: this.generateMatchReasons(candidate, query, content)
    })).filter(match => match.confidence > 0.7)
      .sort((a, b) => b.confidence - a.confidence);

    // Emit telemetry
    if (matches.length > 0) {
      const event = createTelemetryEvent('ExtractionTemplateMatched', {
        template_id: matches[0].template.id,
        confidence: matches[0].confidence,
        tokens_used: query.split(' ').length
      });
      this.emitTelemetry(event);
    }

    return matches;
  }

  /**
   * Check template for drift and recommend actions
   */
  async checkDrift(templateId: string, recentResults: Array<{ success: boolean; failedFields: string[] }>): Promise<DriftResult> {
    const driftResult = await this.driftDetector.analyze(templateId, recentResults);
    
    if (driftResult.is_drifting) {
      // Update template metrics
      const template = await this.storage.get<ExtractionTemplate>(templateId);
      if (template) {
        template.success_metrics.drift_score = driftResult.drift_score;
        await this.storage.set(templateId, template);
      }
    }
    
    return driftResult;
  }

  /**
   * Get templates requiring review/maintenance
   */
  async getMaintenanceCandidates(): Promise<Array<{
    template: ExtractionTemplate;
    issue: 'drifting' | 'deprecated' | 'low_usage' | 'security_risk';
    priority: 'high' | 'medium' | 'low';
  }>> {
    const templates = await this.storage.list<ExtractionTemplate>();
    const candidates = [];

    for (const template of templates) {
      // Check for drift
      if (template.success_metrics.drift_score > 0.3) {
        candidates.push({
          template,
          issue: 'drifting' as const,
          priority: template.success_metrics.drift_score > 0.7 ? 'high' as const : 'medium' as const
        });
      }

      // Check for deprecation
      if (template.deprecation) {
        candidates.push({
          template,
          issue: 'deprecated' as const,
          priority: 'medium' as const
        });
      }

      // Check for low usage
      if (template.success_metrics.usage_count < 10) {
        candidates.push({
          template,
          issue: 'low_usage' as const,
          priority: 'low' as const
        });
      }

      // Check integrity
      if (!validateTemplateIntegrity(template)) {
        candidates.push({
          template,
          issue: 'security_risk' as const,
          priority: 'high' as const
        });
      }
    }

    return candidates.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Fast heuristic matching using token patterns
   */
  private async heuristicMatch(query: string, content: PageContent): Promise<TemplateCandidate[]> {
    const templates = await this.storage.list<ExtractionTemplate>();
    const queryTokens = new Set(query.toLowerCase().split(/\s+/));
    const contentTokens = new Set(content.text.toLowerCase().split(/\s+/));
    
    return templates.map(template => {
      const triggerMatches = template.trigger_patterns.filter(pattern => 
        queryTokens.has(pattern.toLowerCase()) || contentTokens.has(pattern.toLowerCase())
      ).length;
      
      const indicatorMatches = template.confidence_indicators.filter(indicator =>
        content.text.toLowerCase().includes(indicator.toLowerCase())
      ).length;
      
      const tokenScore = Math.min(1, 
        (triggerMatches / template.trigger_patterns.length * 0.7) +
        (indicatorMatches / template.confidence_indicators.length * 0.3)
      );

      return {
        template,
        tokenScore,
        vectorScore: 0, // Will be filled by vector search
        historicalScore: template.success_metrics.accuracy
      };
    }).filter(candidate => candidate.tokenScore > 0.1);
  }

  /**
   * Combine heuristic and vector search results
   */
  private async combineMatches(
    heuristicMatches: TemplateCandidate[],
    semanticResults: Array<{ id: string; score: number }>
  ): Promise<TemplateCandidate[]> {
    const combined = new Map<string, TemplateCandidate>();
    
    // Add heuristic matches
    heuristicMatches.forEach(match => {
      combined.set(match.template.id, match);
    });

    // Enhance with vector scores
    for (const result of semanticResults) {
      const template = await this.storage.get<ExtractionTemplate>(result.id);
      if (!template) continue;

      const existing = combined.get(result.id);
      if (existing) {
        existing.vectorScore = result.score;
      } else {
        combined.set(result.id, {
          template,
          tokenScore: 0,
          vectorScore: result.score,
          historicalScore: template.success_metrics.accuracy
        });
      }
    }

    return Array.from(combined.values());
  }

  /**
   * Filter out templates based on negative evidence
   */
  private filterNegativeEvidence(candidates: TemplateCandidate[], content: PageContent): TemplateCandidate[] {
    return candidates.filter(candidate => {
      const template = candidate.template;
      
      // Check negative triggers
      if (template.negative_triggers?.some(trigger => 
          content.text.toLowerCase().includes(trigger.toLowerCase()))) {
        return false;
      }
      
      // Validate guardrails
      if (template.guardrails.must_have.some(required => 
          !content.text.toLowerCase().includes(required.toLowerCase()))) {
        return false;
      }
      
      if (template.guardrails.must_not_have.some(forbidden => 
          content.text.toLowerCase().includes(forbidden.toLowerCase()))) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Generate human-readable match reasons
   */
  private generateMatchReasons(candidate: TemplateCandidate, query: string, content: PageContent): string[] {
    const reasons = [];
    
    if (candidate.tokenScore > 0.5) {
      reasons.push('Strong pattern match in query/content');
    }
    
    if (candidate.vectorScore > 0.7) {
      reasons.push('High semantic similarity');
    }
    
    if (candidate.historicalScore > 0.8) {
      reasons.push('Proven high accuracy on similar content');
    }
    
    return reasons;
  }

  /**
   * Validate template for security risks
   */
  private async validateTemplateSecurity(template: ExtractionTemplate): Promise<void> {
    // Check for suspicious patterns
    const suspiciousPatterns = ['script', 'eval', 'function', 'javascript:', 'data:'];
    const templateJson = JSON.stringify(template).toLowerCase();
    
    for (const pattern of suspiciousPatterns) {
      if (templateJson.includes(pattern)) {
        throw new Error(`Template contains suspicious pattern: ${pattern}`);
      }
    }
    
    // Validate schema doesn't request sensitive data without explicit PII marking
    const sensitiveFields = ['password', 'ssn', 'credit_card', 'api_key', 'token'];
    if (template.schema.items.properties) {
      for (const [fieldName, fieldSchema] of Object.entries(template.schema.items.properties)) {
        if (sensitiveFields.some(sensitive => fieldName.toLowerCase().includes(sensitive)) && !fieldSchema.pii) {
          throw new Error(`Potentially sensitive field '${fieldName}' not marked as PII`);
        }
      }
    }
  }

  /**
   * Emit telemetry event
   */
  private emitTelemetry(event: TelemetryEvent): void {
    this.telemetryEvents.push(event);
    if (this.telemetryCallback) {
      this.telemetryCallback(event);
    }
  }

  /**
   * Get recent telemetry events
   */
  getTelemetry(since?: string): TelemetryEvent[] {
    if (!since) return this.telemetryEvents;
    
    const sinceDate = new Date(since);
    return this.telemetryEvents.filter(event => 
      new Date(event.timestamp) >= sinceDate
    );
  }
}

// Display Template Library for UI generation
export class DisplayTemplateLibrary {
  constructor(
    private storage: TemplateStorage,
    private telemetryCallback?: (event: TelemetryEvent) => void
  ) {}

  /**
   * Store display template with security validation
   */
  async store(template: DisplayTemplate): Promise<void> {
    // Validate display spec security
    await this.validateDisplaySecurity(template);
    
    // Generate checksum
    const checksum = calculateChecksum(template);
    const versionedTemplate: DisplayTemplate = {
      ...template,
      checksum
    };

    await this.storage.set(template.id, versionedTemplate);
  }

  /**
   * Find optimal display template for data
   */
  async findOptimalDisplay(
    data: any[], 
    userQuery: string,
    context?: { device?: string; locale?: string }
  ): Promise<DisplayMatch | null> {
    const templates = await this.storage.list<DisplayTemplate>();
    
    const matches = templates.map(template => {
      const dataCompatibility = this.calculateDataCompatibility(data, template);
      const queryRelevance = this.calculateQueryRelevance(userQuery, template);
      const contextFit = this.calculateContextFit(context || {}, template);
      
      return {
        template,
        confidence: 0.4 * dataCompatibility + 0.4 * queryRelevance + 0.2 * contextFit,
        data_compatibility: dataCompatibility,
        match_reasons: []
      };
    }).filter(match => match.confidence > 0.6)
      .sort((a, b) => b.confidence - a.confidence);

    const bestMatch = matches[0] || null;
    
    if (bestMatch) {
      const event = createTelemetryEvent('DisplaySpecGenerated', {
        display_template: bestMatch.template.id,
        confidence: bestMatch.confidence,
        a11y_score: this.calculateA11yScore(bestMatch.template)
      });
      
      if (this.telemetryCallback) {
        this.telemetryCallback(event);
      }
    }

    return bestMatch;
  }

  /**
   * Calculate how well data fits template requirements
   */
  private calculateDataCompatibility(data: any[], template: DisplayTemplate): number {
    if (!data || data.length === 0) return 0;
    
    const sample = data[0];
    const sampleFields = Object.keys(sample);
    const requiredFields = template.compatibility.required_fields;
    
    const hasRequiredFields = requiredFields.every(field => sampleFields.includes(field));
    if (!hasRequiredFields) return 0;
    
    // Check size constraints
    if (template.compatibility.min_items && data.length < template.compatibility.min_items) return 0.3;
    if (template.compatibility.max_items && data.length > template.compatibility.max_items) return 0.5;
    
    return 0.9;
  }

  /**
   * Calculate query relevance to display template
   */
  private calculateQueryRelevance(query: string, template: DisplayTemplate): number {
    const queryTokens = new Set(query.toLowerCase().split(/\s+/));
    
    const patternMatches = template.data_patterns.filter(pattern =>
      queryTokens.has(pattern.toLowerCase())
    ).length;
    
    const indicatorMatches = template.ui_indicators.filter(indicator =>
      query.toLowerCase().includes(indicator.toLowerCase())
    ).length;
    
    return Math.min(1, 
      (patternMatches / template.data_patterns.length * 0.6) +
      (indicatorMatches / template.ui_indicators.length * 0.4)
    );
  }

  /**
   * Calculate context fit (device, locale, etc.)
   */
  private calculateContextFit(context: { device?: string; locale?: string }, template: DisplayTemplate): number {
    let score = 0.5; // Base score
    
    // Device responsiveness
    if (context.device && template.display_spec.layout.columns) {
      score += 0.3;
    }
    
    // Locale support
    if (context.locale && template.display_spec.i18n) {
      score += 0.2;
    }
    
    return Math.min(1, score);
  }

  /**
   * Calculate accessibility score
   */
  private calculateA11yScore(template: DisplayTemplate): number {
    const a11ySpec = template.display_spec.a11y;
    let score = 0;
    
    if (a11ySpec.minContrast === 'AAA') score += 0.4;
    else if (a11ySpec.minContrast === 'AA') score += 0.3;
    
    if (a11ySpec.keyboardNav) score += 0.3;
    if (a11ySpec.screenReader) score += 0.2;
    if (a11ySpec.focusOrder) score += 0.1;
    
    return Math.min(1, score);
  }

  /**
   * Validate display template security
   */
  private async validateDisplaySecurity(template: DisplayTemplate): Promise<void> {
    const spec = template.display_spec;
    
    // Ensure no dangerous component types
    const dangerousComponents = ['Script', 'Iframe', 'RawHtml'];
    for (const component of spec.components) {
      if (dangerousComponents.includes(component.type)) {
        throw new Error(`Dangerous component type: ${component.type}`);
      }
    }
    
    // Validate interaction handlers are safe
    if (spec.interactions) {
      for (const interaction of spec.interactions) {
        if (interaction.emit.includes('eval') || interaction.emit.includes('function')) {
          throw new Error(`Unsafe interaction: ${interaction.emit}`);
        }
      }
    }
  }
}