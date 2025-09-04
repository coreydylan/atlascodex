/**
 * Production Telemetry System for Evidence-First Adaptive Extraction
 * 
 * Comprehensive observability and telemetry for production monitoring,
 * SLA compliance, performance optimization, and operational insights.
 */

import { z } from 'zod';
import { EventEmitter } from 'events';

// ===== EVENT SCHEMAS =====

export const BaseEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  version: z.string().default('1.0.0'),
  requestId: z.string().optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const ContractGeneratedEventSchema = BaseEventSchema.extend({
  type: z.literal('contract_generated'),
  data: z.object({
    contractId: z.string(),
    contractName: z.string(),
    fieldCount: z.number(),
    userQuery: z.string(),
    generationMethod: z.enum(['template_match', 'llm_generated', 'hybrid']),
    processingTimeMs: z.number(),
    confidenceScore: z.number(),
    templateUsed: z.string().optional(),
    complexity: z.enum(['simple', 'moderate', 'complex']),
    domainCategory: z.string().optional(),
    fallbackUsed: z.boolean(),
    errorDetails: z.string().optional(),
  })
});

export const DeterministicPassEventSchema = BaseEventSchema.extend({
  type: z.literal('deterministic_pass'),
  data: z.object({
    contractId: z.string(),
    totalFields: z.number(),
    fieldsFound: z.number(),
    fieldsRequested: z.number(),
    coverageRatio: z.number(),
    processingTimeMs: z.number(),
    domElements: z.number(),
    selectorsTriedCount: z.number(),
    anchorsFound: z.number(),
    confidenceScore: z.number(),
    patternMatches: z.record(z.number()),
    domAnalysisTimeMs: z.number(),
    extractionStrategy: z.enum(['css_selectors', 'xpath', 'text_patterns', 'hybrid']),
    errorDetails: z.string().optional(),
  })
});

export const LLMAugmentationEventSchema = BaseEventSchema.extend({
  type: z.literal('llm_augmentation'),
  data: z.object({
    contractId: z.string(),
    modelUsed: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    costUsd: z.number(),
    processingTimeMs: z.number(),
    fieldsCompleted: z.number(),
    newFieldsProposed: z.number(),
    normalizationsApplied: z.number(),
    confidenceScore: z.number(),
    promptVersion: z.string(),
    temperature: z.number(),
    contextLength: z.number(),
    fallbackUsed: z.boolean(),
    rateLimitHit: z.boolean(),
    errorDetails: z.string().optional(),
  })
});

export const ContractValidationEventSchema = BaseEventSchema.extend({
  type: z.literal('contract_validation'),
  data: z.object({
    contractId: z.string(),
    validationResult: z.enum(['passed', 'failed', 'partial']),
    validatedFields: z.number(),
    failedFields: z.number(),
    validationTimeMs: z.number(),
    schemaVersion: z.string(),
    strictMode: z.boolean(),
    validationErrors: z.array(z.string()),
    constraintViolations: z.array(z.string()),
    dataQualityScore: z.number(),
    anchorValidation: z.object({
      requiredAnchors: z.number(),
      foundAnchors: z.number(),
      anchorQualityScore: z.number(),
    }),
    errorDetails: z.string().optional(),
  })
});

export const FallbackTakenEventSchema = BaseEventSchema.extend({
  type: z.literal('fallback_taken'),
  data: z.object({
    contractId: z.string(),
    fallbackReason: z.enum(['low_confidence', 'timeout', 'validation_failure', 'error', 'quota_exceeded']),
    fallbackStrategy: z.enum(['abstain', 'partial', 'template_default', 'cached_result']),
    originalAttempt: z.string(),
    fallbackSource: z.string(),
    confidenceBefore: z.number(),
    confidenceAfter: z.number(),
    fallbackTimeMs: z.number(),
    dataLoss: z.object({
      fieldsLost: z.number(),
      dataQualityDrop: z.number(),
    }),
    errorDetails: z.string().optional(),
  })
});

export const CacheEventSchema = BaseEventSchema.extend({
  type: z.literal('cache_event'),
  data: z.object({
    cacheType: z.enum(['contract', 'extraction', 'llm_result', 'dom_analysis']),
    action: z.enum(['hit', 'miss', 'write', 'invalidate', 'expire']),
    key: z.string(),
    sizeBytes: z.number().optional(),
    ttlSeconds: z.number().optional(),
    accessTimeMs: z.number(),
    hitRatio: z.number().optional(),
    cacheUtilization: z.number().optional(),
    evictionReason: z.string().optional(),
    errorDetails: z.string().optional(),
  })
});

export const PromotionDecisionEventSchema = BaseEventSchema.extend({
  type: z.literal('promotion_decision'),
  data: z.object({
    contractId: z.string(),
    promotionType: z.enum(['field_promotion', 'schema_promotion', 'template_promotion']),
    decision: z.enum(['promoted', 'demoted', 'maintained', 'rejected']),
    evidenceScore: z.number(),
    supportThreshold: z.number(),
    quorumResult: z.object({
      totalVoters: z.number(),
      approvalVotes: z.number(),
      rejectionVotes: z.number(),
      abstentions: z.number(),
      quorumMet: z.boolean(),
    }),
    impactAssessment: z.object({
      fieldsAffected: z.number(),
      confidenceChange: z.number(),
      performanceImpact: z.number(),
    }),
    decisionTimeMs: z.number(),
    errorDetails: z.string().optional(),
  })
});

export const StrictModeActionEventSchema = BaseEventSchema.extend({
  type: z.literal('strict_mode_action'),
  data: z.object({
    contractId: z.string(),
    action: z.enum(['entity_dropped', 'job_failed', 'field_omitted', 'field_nulled']),
    strictModeRule: z.string(),
    affectedEntity: z.string().optional(),
    affectedField: z.string().optional(),
    violationDetails: z.object({
      violationType: z.enum(['missing_required', 'validation_failure', 'anchor_missing', 'constraint_violation']),
      expectedValue: z.string().optional(),
      actualValue: z.string().optional(),
      anchorRequirement: z.object({
        required: z.number(),
        found: z.number(),
      }).optional(),
    }),
    performanceImpact: z.object({
      entitiesAffected: z.number(),
      dataLossPercentage: z.number(),
    }),
    errorDetails: z.string().optional(),
  })
});

export const BudgetEventSchema = BaseEventSchema.extend({
  type: z.literal('budget_event'),
  data: z.object({
    eventType: z.enum(['cost_incurred', 'budget_warning', 'budget_exceeded', 'quota_reset']),
    resourceType: z.enum(['llm_tokens', 'api_calls', 'processing_time', 'storage', 'bandwidth']),
    costUsd: z.number(),
    budgetRemaining: z.number(),
    utilizationPercentage: z.number(),
    timeWindow: z.enum(['minute', 'hour', 'day', 'month']),
    rateLimits: z.object({
      currentUsage: z.number(),
      limit: z.number(),
      resetTimeSeconds: z.number(),
    }).optional(),
    costBreakdown: z.object({
      llmCosts: z.number(),
      apiCosts: z.number(),
      computeCosts: z.number(),
      storageCosts: z.number(),
    }),
    projectedCost: z.object({
      hourly: z.number(),
      daily: z.number(),
      monthly: z.number(),
    }),
    errorDetails: z.string().optional(),
  })
});

// Union of all event types
export const TelemetryEventSchema = z.union([
  ContractGeneratedEventSchema,
  DeterministicPassEventSchema,
  LLMAugmentationEventSchema,
  ContractValidationEventSchema,
  FallbackTakenEventSchema,
  CacheEventSchema,
  PromotionDecisionEventSchema,
  StrictModeActionEventSchema,
  BudgetEventSchema,
]);

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export type ContractGeneratedEvent = z.infer<typeof ContractGeneratedEventSchema>;
export type DeterministicPassEvent = z.infer<typeof DeterministicPassEventSchema>;
export type LLMAugmentationEvent = z.infer<typeof LLMAugmentationEventSchema>;
export type ContractValidationEvent = z.infer<typeof ContractValidationEventSchema>;
export type FallbackTakenEvent = z.infer<typeof FallbackTakenEventSchema>;
export type CacheEvent = z.infer<typeof CacheEventSchema>;
export type PromotionDecisionEvent = z.infer<typeof PromotionDecisionEventSchema>;
export type StrictModeActionEvent = z.infer<typeof StrictModeActionEventSchema>;
export type BudgetEvent = z.infer<typeof BudgetEventSchema>;

// ===== ERROR TAXONOMY =====

export const ERROR_CODES = {
  // Contract Generation Errors
  CONTRACT_GENERATION: {
    TEMPLATE_MATCH_FAILED: 'CG001',
    LLM_GENERATION_FAILED: 'CG002', 
    INVALID_USER_QUERY: 'CG003',
    SCHEMA_VALIDATION_FAILED: 'CG004',
    TIMEOUT: 'CG005',
    QUOTA_EXCEEDED: 'CG006',
  },
  
  // Deterministic Extraction Errors
  DETERMINISTIC_EXTRACTION: {
    DOM_PARSING_FAILED: 'DE001',
    SELECTOR_RESOLUTION_FAILED: 'DE002',
    ANCHOR_MISSING: 'DE003',
    PATTERN_MATCH_FAILED: 'DE004',
    EXTRACTION_TIMEOUT: 'DE005',
    INVALID_HTML: 'DE006',
  },
  
  // LLM Augmentation Errors
  LLM_AUGMENTATION: {
    MODEL_UNAVAILABLE: 'LA001',
    RATE_LIMIT_EXCEEDED: 'LA002',
    CONTEXT_TOO_LARGE: 'LA003',
    INVALID_RESPONSE: 'LA004',
    PROMPT_INJECTION_DETECTED: 'LA005',
    COST_LIMIT_EXCEEDED: 'LA006',
  },
  
  // Validation Errors
  VALIDATION: {
    SCHEMA_MISMATCH: 'VL001',
    CONSTRAINT_VIOLATION: 'VL002',
    TYPE_CONVERSION_FAILED: 'VL003',
    REQUIRED_FIELD_MISSING: 'VL004',
    ANCHOR_VALIDATION_FAILED: 'VL005',
    DATA_QUALITY_INSUFFICIENT: 'VL006',
  },
  
  // System Errors
  SYSTEM: {
    CACHE_FAILURE: 'SY001',
    DATABASE_ERROR: 'SY002',
    NETWORK_ERROR: 'SY003',
    MEMORY_EXHAUSTED: 'SY004',
    CPU_LIMIT_EXCEEDED: 'SY005',
    STORAGE_FULL: 'SY006',
  },
  
  // Budget & Quota Errors
  BUDGET: {
    DAILY_BUDGET_EXCEEDED: 'BG001',
    MONTHLY_BUDGET_EXCEEDED: 'BG002',
    TOKEN_QUOTA_EXCEEDED: 'BG003',
    API_QUOTA_EXCEEDED: 'BG004',
    RATE_LIMIT_HIT: 'BG005',
    COST_SPIKE_DETECTED: 'BG006',
  },
} as const;

// ===== PRODUCTION TELEMETRY CLASS =====

export class ProductionTelemetry extends EventEmitter {
  private eventBuffer: TelemetryEvent[] = [];
  private batchSize: number = 100;
  private flushIntervalMs: number = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;
  private samplingRates: Map<string, number> = new Map();
  private piiRedactionEnabled: boolean = true;

  // Performance metrics
  private metrics = {
    eventsGenerated: 0,
    eventsDropped: 0,
    batchesFlushed: 0,
    avgEventSize: 0,
    bufferUtilization: 0,
  };

  constructor(options: {
    batchSize?: number;
    flushIntervalMs?: number;
    piiRedactionEnabled?: boolean;
    samplingRates?: Record<string, number>;
  } = {}) {
    super();
    
    this.batchSize = options.batchSize ?? 100;
    this.flushIntervalMs = options.flushIntervalMs ?? 30000;
    this.piiRedactionEnabled = options.piiRedactionEnabled ?? true;
    
    // Set sampling rates for high-volume events
    if (options.samplingRates) {
      Object.entries(options.samplingRates).forEach(([eventType, rate]) => {
        this.samplingRates.set(eventType, rate);
      });
    }

    // Default sampling rates
    this.samplingRates.set('cache_event', 0.1); // Sample 10% of cache events
    this.samplingRates.set('deterministic_pass', 0.5); // Sample 50% of deterministic passes

    this.startFlushTimer();
  }

  // ===== EVENT EMISSION METHODS =====

  emitContractGenerated(data: Omit<ContractGeneratedEvent['data'], never>, metadata?: Record<string, any>): void {
    const event: ContractGeneratedEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      type: 'contract_generated',
      version: '1.0.0',
      data,
      metadata,
    };
    
    this.emitEvent(event);
  }

  emitDeterministicPass(data: Omit<DeterministicPassEvent['data'], never>, metadata?: Record<string, any>): void {
    const event: DeterministicPassEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      type: 'deterministic_pass',
      version: '1.0.0',
      data,
      metadata,
    };
    
    this.emitEvent(event);
  }

  emitLLMAugmentation(data: Omit<LLMAugmentationEvent['data'], never>, metadata?: Record<string, any>): void {
    const event: LLMAugmentationEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      type: 'llm_augmentation',
      version: '1.0.0',
      data,
      metadata,
    };
    
    this.emitEvent(event);
  }

  emitContractValidation(data: Omit<ContractValidationEvent['data'], never>, metadata?: Record<string, any>): void {
    const event: ContractValidationEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      type: 'contract_validation',
      version: '1.0.0',
      data,
      metadata,
    };
    
    this.emitEvent(event);
  }

  emitFallbackTaken(data: Omit<FallbackTakenEvent['data'], never>, metadata?: Record<string, any>): void {
    const event: FallbackTakenEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      type: 'fallback_taken',
      version: '1.0.0',
      data,
      metadata,
    };
    
    this.emitEvent(event);
  }

  emitCacheHit(key: string, cacheType: CacheEvent['data']['cacheType'], accessTimeMs: number, metadata?: Record<string, any>): void {
    this.emitCacheEvent({
      cacheType,
      action: 'hit',
      key,
      accessTimeMs,
    }, metadata);
  }

  emitCacheMiss(key: string, cacheType: CacheEvent['data']['cacheType'], accessTimeMs: number, metadata?: Record<string, any>): void {
    this.emitCacheEvent({
      cacheType,
      action: 'miss',
      key,
      accessTimeMs,
    }, metadata);
  }

  emitCacheEvent(data: Omit<CacheEvent['data'], never>, metadata?: Record<string, any>): void {
    const event: CacheEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      type: 'cache_event',
      version: '1.0.0',
      data,
      metadata,
    };
    
    this.emitEvent(event);
  }

  emitPromotionDecision(data: Omit<PromotionDecisionEvent['data'], never>, metadata?: Record<string, any>): void {
    const event: PromotionDecisionEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      type: 'promotion_decision',
      version: '1.0.0',
      data,
      metadata,
    };
    
    this.emitEvent(event);
  }

  emitStrictModeAction(data: Omit<StrictModeActionEvent['data'], never>, metadata?: Record<string, any>): void {
    const event: StrictModeActionEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      type: 'strict_mode_action',
      version: '1.0.0',
      data,
      metadata,
    };
    
    this.emitEvent(event);
  }

  emitBudgetEvent(data: Omit<BudgetEvent['data'], never>, metadata?: Record<string, any>): void {
    const event: BudgetEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      type: 'budget_event',
      version: '1.0.0',
      data,
      metadata,
    };
    
    this.emitEvent(event);
  }

  // ===== CORE EVENT HANDLING =====

  private emitEvent(event: TelemetryEvent): void {
    // Apply sampling if configured
    const samplingRate = this.samplingRates.get(event.type);
    if (samplingRate && Math.random() > samplingRate) {
      this.metrics.eventsDropped++;
      return;
    }

    // Apply PII redaction
    if (this.piiRedactionEnabled) {
      event = this.redactPII(event);
    }

    // Validate event schema
    try {
      TelemetryEventSchema.parse(event);
    } catch (error) {
      console.error(`Invalid telemetry event:`, error);
      this.metrics.eventsDropped++;
      return;
    }

    // Add to buffer
    this.eventBuffer.push(event);
    this.metrics.eventsGenerated++;

    // Emit to listeners
    this.emit('telemetry_event', event);
    this.emit(event.type, event);

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.batchSize) {
      this.flush();
    }

    // Update metrics
    this.updateMetrics(event);
  }

  private redactPII(event: TelemetryEvent): TelemetryEvent {
    const redacted = JSON.parse(JSON.stringify(event));
    
    // Redact common PII patterns
    const redactValue = (value: any): any => {
      if (typeof value === 'string') {
        // Email patterns
        value = value.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');
        // Phone patterns
        value = value.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');
        // IP addresses
        value = value.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REDACTED]');
        // URLs with sensitive info
        value = value.replace(/([?&])(token|key|password|secret)=[^&]+/gi, '$1$2=[REDACTED]');
      }
      return value;
    };

    const redactObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(redactObject);
      } else if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          // Redact sensitive fields (but not cache keys or technical IDs)
          if (['email', 'phone', 'ip', 'token', 'password', 'secret'].some(pattern => 
            key.toLowerCase().includes(pattern)) && 
            !['key', 'contractid', 'eventid', 'batchid'].some(safe => key.toLowerCase().includes(safe))) {
            result[key] = '[REDACTED]';
          } else {
            result[key] = redactObject(value);
          }
        }
        return result;
      } else {
        return redactValue(obj);
      }
    };

    return redactObject(redacted);
  }

  private updateMetrics(event: TelemetryEvent): void {
    const eventSize = JSON.stringify(event).length;
    this.metrics.avgEventSize = (this.metrics.avgEventSize + eventSize) / 2;
    this.metrics.bufferUtilization = this.eventBuffer.length / this.batchSize;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // ===== BATCHING AND FLUSHING =====

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.flush();
      }
    }, this.flushIntervalMs);
  }

  public flush(): void {
    if (this.eventBuffer.length === 0) return;

    const batch = [...this.eventBuffer];
    this.eventBuffer = [];
    this.metrics.batchesFlushed++;

    // Emit batch event for external processing
    this.emit('telemetry_batch', {
      events: batch,
      batchId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      eventCount: batch.length,
    });

    // Log batch summary
    const eventTypes = batch.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`📊 Telemetry batch flushed: ${batch.length} events`, eventTypes);
  }

  public stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.flush(); // Final flush
  }

  public getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }
}

// ===== TELEMETRY COLLECTOR =====

export class TelemetryCollector {
  private events: TelemetryEvent[] = [];
  private maxEvents: number;
  
  constructor(maxEvents: number = 10000) {
    this.maxEvents = maxEvents;
  }

  collect(event: TelemetryEvent): void {
    this.events.push(event);
    
    // Maintain size limit
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  getEvents(filter?: {
    type?: string;
    timeRange?: { start: Date; end: Date };
    contractId?: string;
  }): TelemetryEvent[] {
    let filtered = [...this.events];

    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(e => e.type === filter.type);
      }
      
      if (filter.timeRange) {
        filtered = filtered.filter(e => {
          const eventTime = new Date(e.timestamp);
          return eventTime >= filter.timeRange!.start && eventTime <= filter.timeRange!.end;
        });
      }
      
      if (filter.contractId) {
        filtered = filtered.filter(e => 
          'contractId' in e.data && e.data.contractId === filter.contractId
        );
      }
    }

    return filtered;
  }

  aggregateBy(
    groupBy: 'type' | 'hour' | 'contractId',
    metric: string = 'count'
  ): Record<string, any> {
    const groups: Record<string, TelemetryEvent[]> = {};

    this.events.forEach(event => {
      let key: string;
      
      switch (groupBy) {
        case 'type':
          key = event.type;
          break;
        case 'hour':
          key = new Date(event.timestamp).toISOString().substring(0, 13);
          break;
        case 'contractId':
          key = ('contractId' in event.data ? event.data.contractId : 'unknown') as string;
          break;
        default:
          key = 'all';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });

    const result: Record<string, any> = {};
    
    Object.entries(groups).forEach(([key, events]) => {
      switch (metric) {
        case 'count':
          result[key] = events.length;
          break;
        case 'avgProcessingTime':
          const times = events
            .filter(e => 'processingTimeMs' in e.data)
            .map(e => (e.data as any).processingTimeMs);
          result[key] = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
          break;
        case 'totalCost':
          const costs = events
            .filter(e => 'costUsd' in e.data)
            .map(e => (e.data as any).costUsd);
          result[key] = costs.reduce((a, b) => a + b, 0);
          break;
      }
    });

    return result;
  }

  clear(): void {
    this.events = [];
  }
}

// ===== METRICS CALCULATOR =====

export class MetricsCalculator {
  constructor(private collector: TelemetryCollector) {}

  calculateSLAMetrics(timeRange?: { start: Date; end: Date }): {
    availability: number;
    successRate: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    budgetUtilization: number;
  } {
    const events = this.collector.getEvents({ timeRange });
    
    const extractionEvents = events.filter(e => 
      ['contract_generated', 'deterministic_pass', 'llm_augmentation'].includes(e.type)
    );

    const errorEvents = events.filter(e => 
      e.metadata?.errorDetails || ('errorDetails' in e.data && e.data.errorDetails)
    );

    const responseTimes = extractionEvents
      .filter(e => 'processingTimeMs' in e.data)
      .map(e => (e.data as any).processingTimeMs)
      .sort((a, b) => a - b);

    const budgetEvents = events.filter(e => e.type === 'budget_event');
    const totalCost = budgetEvents.reduce((sum, e) => 
      sum + ((e.data as BudgetEvent['data']).costUsd || 0), 0
    );

    return {
      availability: extractionEvents.length > 0 ? 
        (extractionEvents.length - errorEvents.length) / extractionEvents.length : 1,
      successRate: extractionEvents.length > 0 ? 
        (extractionEvents.length - errorEvents.length) / extractionEvents.length : 1,
      avgResponseTime: responseTimes.length > 0 ? 
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      p95ResponseTime: responseTimes.length > 0 ? 
        responseTimes[Math.floor(responseTimes.length * 0.95)] : 0,
      errorRate: extractionEvents.length > 0 ? errorEvents.length / extractionEvents.length : 0,
      budgetUtilization: totalCost,
    };
  }

  calculatePerformanceMetrics(): {
    throughput: number;
    cacheHitRate: number;
    avgConfidence: number;
    fallbackRate: number;
    contractReuse: number;
  } {
    const events = this.collector.getEvents();
    const timeWindow = 3600000; // 1 hour in ms
    const recentEvents = events.filter(e => 
      Date.now() - new Date(e.timestamp).getTime() < timeWindow
    );

    const cacheEvents = recentEvents.filter(e => e.type === 'cache_event');
    const cacheHits = cacheEvents.filter(e => (e.data as CacheEvent['data']).action === 'hit');
    
    const fallbackEvents = recentEvents.filter(e => e.type === 'fallback_taken');
    const extractionEvents = recentEvents.filter(e => 
      ['contract_generated', 'deterministic_pass', 'llm_augmentation'].includes(e.type)
    );

    const confidenceScores = extractionEvents
      .filter(e => 'confidenceScore' in e.data)
      .map(e => (e.data as any).confidenceScore);

    const contractEvents = recentEvents.filter(e => e.type === 'contract_generated');
    const templateMatches = contractEvents.filter(e => 
      (e.data as ContractGeneratedEvent['data']).generationMethod === 'template_match'
    );

    return {
      throughput: extractionEvents.length / (timeWindow / 60000), // per minute
      cacheHitRate: cacheEvents.length > 0 ? cacheHits.length / cacheEvents.length : 0,
      avgConfidence: confidenceScores.length > 0 ? 
        confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length : 0,
      fallbackRate: extractionEvents.length > 0 ? fallbackEvents.length / extractionEvents.length : 0,
      contractReuse: contractEvents.length > 0 ? templateMatches.length / contractEvents.length : 0,
    };
  }
}

// ===== DASHBOARD EXPORTS =====

export interface DashboardData {
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    version: string;
  };
  slaMetrics: ReturnType<MetricsCalculator['calculateSLAMetrics']>;
  performanceMetrics: ReturnType<MetricsCalculator['calculatePerformanceMetrics']>;
  eventSummary: Record<string, number>;
  recentErrors: Array<{
    timestamp: string;
    type: string;
    message: string;
    contractId?: string;
  }>;
  costAnalysis: {
    hourly: number;
    daily: number;
    monthly: number;
    breakdown: Record<string, number>;
  };
}

export function generateDashboardData(
  collector: TelemetryCollector,
  calculator: MetricsCalculator,
  startTime: Date = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
): DashboardData {
  const timeRange = { start: startTime, end: new Date() };
  const events = collector.getEvents({ timeRange });
  
  // Extract recent errors
  const errorEvents = events.filter(e => 
    e.metadata?.errorDetails || ('errorDetails' in e.data && e.data.errorDetails)
  ).slice(-10);

  // Calculate costs
  const budgetEvents = events.filter(e => e.type === 'budget_event');
  const hourlyCost = budgetEvents
    .filter(e => Date.now() - new Date(e.timestamp).getTime() < 3600000)
    .reduce((sum, e) => sum + ((e.data as BudgetEvent['data']).costUsd || 0), 0);

  // Event type counts
  const eventSummary = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    systemHealth: {
      status: errorEvents.length > 10 ? 'unhealthy' : 
              errorEvents.length > 5 ? 'degraded' : 'healthy',
      uptime: Date.now() - startTime.getTime(),
      version: '1.0.0',
    },
    slaMetrics: calculator.calculateSLAMetrics(timeRange),
    performanceMetrics: calculator.calculatePerformanceMetrics(),
    eventSummary,
    recentErrors: errorEvents.map(e => ({
      timestamp: e.timestamp,
      type: e.type,
      message: (e.metadata?.errorDetails || (e.data as any).errorDetails || 'Unknown error') as string,
      contractId: ('contractId' in e.data ? e.data.contractId : undefined) as string | undefined,
    })),
    costAnalysis: {
      hourly: hourlyCost,
      daily: hourlyCost * 24,
      monthly: hourlyCost * 24 * 30,
      breakdown: {
        llm: budgetEvents.reduce((sum, e) => 
          sum + (((e.data as BudgetEvent['data']).costBreakdown?.llmCosts) || 0), 0),
        api: budgetEvents.reduce((sum, e) => 
          sum + (((e.data as BudgetEvent['data']).costBreakdown?.apiCosts) || 0), 0),
        compute: budgetEvents.reduce((sum, e) => 
          sum + (((e.data as BudgetEvent['data']).costBreakdown?.computeCosts) || 0), 0),
        storage: budgetEvents.reduce((sum, e) => 
          sum + (((e.data as BudgetEvent['data']).costBreakdown?.storageCosts) || 0), 0),
      },
    },
  };
}

// ===== SINGLETON INSTANCE =====

export const telemetry = new ProductionTelemetry({
  batchSize: 50,
  flushIntervalMs: 30000,
  piiRedactionEnabled: true,
  samplingRates: {
    cache_event: 0.1,
    deterministic_pass: 0.5,
  },
});

export const telemetryCollector = new TelemetryCollector(10000);
export const metricsCalculator = new MetricsCalculator(telemetryCollector);

// Auto-collect events from the main telemetry instance
telemetry.on('telemetry_event', (event: TelemetryEvent) => {
  telemetryCollector.collect(event);
});

// Export convenience functions
export const emitContractGenerated = telemetry.emitContractGenerated.bind(telemetry);
export const emitDeterministicPass = telemetry.emitDeterministicPass.bind(telemetry);
export const emitLLMAugmentation = telemetry.emitLLMAugmentation.bind(telemetry);
export const emitContractValidation = telemetry.emitContractValidation.bind(telemetry);
export const emitFallbackTaken = telemetry.emitFallbackTaken.bind(telemetry);
export const emitCacheHit = telemetry.emitCacheHit.bind(telemetry);
export const emitCacheMiss = telemetry.emitCacheMiss.bind(telemetry);
export const emitPromotionDecision = telemetry.emitPromotionDecision.bind(telemetry);
export const emitStrictModeAction = telemetry.emitStrictModeAction.bind(telemetry);
export const emitBudgetEvent = telemetry.emitBudgetEvent.bind(telemetry);