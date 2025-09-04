/**
 * Production Telemetry System Tests
 * Comprehensive test coverage for all telemetry components
 */

import {
  ProductionTelemetry,
  TelemetryCollector,
  MetricsCalculator,
  generateDashboardData,
  ERROR_CODES,
  telemetry,
  telemetryCollector,
  metricsCalculator,
  emitContractGenerated,
  emitDeterministicPass,
  emitLLMAugmentation,
  emitContractValidation,
  emitFallbackTaken,
  emitCacheHit,
  emitCacheMiss,
  emitPromotionDecision,
  emitStrictModeAction,
  emitBudgetEvent,
} from '../production-telemetry';

describe('ProductionTelemetry', () => {
  let telemetryInstance: ProductionTelemetry;
  let collector: TelemetryCollector;
  let calculator: MetricsCalculator;

  beforeEach(() => {
    telemetryInstance = new ProductionTelemetry({
      batchSize: 5,
      flushIntervalMs: 1000,
      piiRedactionEnabled: false, // Disable for most tests to avoid complexity
      samplingRates: {}, // No sampling by default
    });
    collector = new TelemetryCollector(100);
    calculator = new MetricsCalculator(collector);

    // Connect collector to telemetry instance
    telemetryInstance.on('telemetry_event', (event) => {
      collector.collect(event);
    });
  });

  afterEach(() => {
    telemetryInstance.stop();
  });

  describe('Event Emission', () => {
    it('should emit contract generated events', () => {
      const eventData = {
        contractId: 'test-contract-123',
        contractName: 'Test Contract',
        fieldCount: 5,
        userQuery: 'Extract product information',
        generationMethod: 'llm_generated' as const,
        processingTimeMs: 1500,
        confidenceScore: 0.85,
        complexity: 'moderate' as const,
        fallbackUsed: false,
      };

      telemetryInstance.emitContractGenerated(eventData);

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('contract_generated');
      expect(events[0].data).toMatchObject(eventData);
      expect(events[0].id).toMatch(/^evt_/);
      expect(events[0].timestamp).toBeTruthy();
    });

    it('should emit deterministic pass events', () => {
      const eventData = {
        contractId: 'test-contract-123',
        totalFields: 10,
        fieldsFound: 8,
        fieldsRequested: 10,
        coverageRatio: 0.8,
        processingTimeMs: 2000,
        domElements: 150,
        selectorsTriedCount: 25,
        anchorsFound: 12,
        confidenceScore: 0.75,
        patternMatches: { 'price': 3, 'title': 1 },
        domAnalysisTimeMs: 500,
        extractionStrategy: 'css_selectors' as const,
      };

      telemetryInstance.emitDeterministicPass(eventData);

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('deterministic_pass');
      expect(events[0].data).toMatchObject(eventData);
    });

    it('should emit LLM augmentation events', () => {
      const eventData = {
        contractId: 'test-contract-123',
        modelUsed: 'gpt-4',
        inputTokens: 1500,
        outputTokens: 300,
        costUsd: 0.045,
        processingTimeMs: 3000,
        fieldsCompleted: 3,
        newFieldsProposed: 1,
        normalizationsApplied: 2,
        confidenceScore: 0.9,
        promptVersion: 'v2.1',
        temperature: 0.7,
        contextLength: 1800,
        fallbackUsed: false,
        rateLimitHit: false,
      };

      telemetryInstance.emitLLMAugmentation(eventData);

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('llm_augmentation');
      expect(events[0].data).toMatchObject(eventData);
    });

    it('should emit cache events', () => {
      telemetryInstance.emitCacheHit('contract:123', 'contract', 50);
      telemetryInstance.emitCacheMiss('extraction:456', 'extraction', 200);

      const events = collector.getEvents();
      expect(events).toHaveLength(2);
      
      const hitEvent = events.find(e => e.type === 'cache_event' && (e.data as any).action === 'hit');
      const missEvent = events.find(e => e.type === 'cache_event' && (e.data as any).action === 'miss');
      
      expect(hitEvent).toBeTruthy();
      expect(hitEvent!.data).toMatchObject({
        cacheType: 'contract',
        action: 'hit',
        key: 'contract:123',
        accessTimeMs: 50,
      });

      expect(missEvent).toBeTruthy();
      expect(missEvent!.data).toMatchObject({
        cacheType: 'extraction',
        action: 'miss',
        key: 'extraction:456',
        accessTimeMs: 200,
      });
    });

    it('should emit fallback taken events', () => {
      const eventData = {
        contractId: 'test-contract-123',
        fallbackReason: 'low_confidence' as const,
        fallbackStrategy: 'partial' as const,
        originalAttempt: 'deterministic_extraction',
        fallbackSource: 'template_library',
        confidenceBefore: 0.3,
        confidenceAfter: 0.6,
        fallbackTimeMs: 500,
        dataLoss: {
          fieldsLost: 2,
          dataQualityDrop: 0.15,
        },
      };

      telemetryInstance.emitFallbackTaken(eventData);

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('fallback_taken');
      expect(events[0].data).toMatchObject(eventData);
    });

    it('should emit promotion decision events', () => {
      const eventData = {
        contractId: 'test-contract-123',
        promotionType: 'field_promotion' as const,
        decision: 'promoted' as const,
        evidenceScore: 0.85,
        supportThreshold: 0.7,
        quorumResult: {
          totalVoters: 5,
          approvalVotes: 4,
          rejectionVotes: 1,
          abstentions: 0,
          quorumMet: true,
        },
        impactAssessment: {
          fieldsAffected: 1,
          confidenceChange: 0.1,
          performanceImpact: -0.05,
        },
        decisionTimeMs: 250,
      };

      telemetryInstance.emitPromotionDecision(eventData);

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('promotion_decision');
      expect(events[0].data).toMatchObject(eventData);
    });

    it('should emit strict mode action events', () => {
      const eventData = {
        contractId: 'test-contract-123',
        action: 'entity_dropped' as const,
        strictModeRule: 'require_anchors',
        affectedEntity: 'product_123',
        violationDetails: {
          violationType: 'anchor_missing' as const,
          anchorRequirement: {
            required: 2,
            found: 1,
          },
        },
        performanceImpact: {
          entitiesAffected: 1,
          dataLossPercentage: 0.05,
        },
      };

      telemetryInstance.emitStrictModeAction(eventData);

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('strict_mode_action');
      expect(events[0].data).toMatchObject(eventData);
    });

    it('should emit budget events', () => {
      const eventData = {
        eventType: 'cost_incurred' as const,
        resourceType: 'llm_tokens' as const,
        costUsd: 0.125,
        budgetRemaining: 9.875,
        utilizationPercentage: 1.25,
        timeWindow: 'hour' as const,
        costBreakdown: {
          llmCosts: 0.125,
          apiCosts: 0,
          computeCosts: 0,
          storageCosts: 0,
        },
        projectedCost: {
          hourly: 0.125,
          daily: 3.0,
          monthly: 90.0,
        },
      };

      telemetryInstance.emitBudgetEvent(eventData);

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('budget_event');
      expect(events[0].data).toMatchObject(eventData);
    });
  });

  describe('PII Redaction', () => {
    it('should redact email addresses', () => {
      // Create a separate instance with PII redaction enabled
      const piiTelemetry = new ProductionTelemetry({
        piiRedactionEnabled: true,
      });
      const piiCollector = new TelemetryCollector(100);
      piiTelemetry.on('telemetry_event', (event) => {
        piiCollector.collect(event);
      });

      const eventData = {
        contractId: 'test-contract-123',
        contractName: 'Test Contract',
        fieldCount: 5,
        userQuery: 'Extract contact info for john.doe@example.com',
        generationMethod: 'llm_generated' as const,
        processingTimeMs: 1500,
        confidenceScore: 0.85,
        complexity: 'moderate' as const,
        fallbackUsed: false,
      };

      piiTelemetry.emitContractGenerated(eventData);

      const events = piiCollector.getEvents();
      expect((events[0].data as any).userQuery).toBe('Extract contact info for [EMAIL_REDACTED]');
      piiTelemetry.stop();
    });

    it('should redact phone numbers', () => {
      // Create a separate instance with PII redaction enabled
      const piiTelemetry = new ProductionTelemetry({
        piiRedactionEnabled: true,
      });
      const piiCollector = new TelemetryCollector(100);
      piiTelemetry.on('telemetry_event', (event) => {
        piiCollector.collect(event);
      });

      const eventData = {
        contractId: 'test-contract-123',
        contractName: 'Test Contract',
        fieldCount: 5,
        userQuery: 'Extract phone 555-123-4567',
        generationMethod: 'llm_generated' as const,
        processingTimeMs: 1500,
        confidenceScore: 0.85,
        complexity: 'moderate' as const,
        fallbackUsed: false,
      };

      piiTelemetry.emitContractGenerated(eventData);

      const events = piiCollector.getEvents();
      expect((events[0].data as any).userQuery).toBe('Extract phone [PHONE_REDACTED]');
      piiTelemetry.stop();
    });
  });

  describe('Event Sampling', () => {
    it('should sample events based on configured rates', () => {
      const samplingTelemetry = new ProductionTelemetry({
        samplingRates: {
          'cache_event': 0.0, // Never emit
        },
      });

      // Emit multiple cache events - they should all be dropped
      for (let i = 0; i < 10; i++) {
        samplingTelemetry.emitCacheHit(`key-${i}`, 'contract', 10);
      }

      const metrics = samplingTelemetry.getMetrics();
      expect(metrics.eventsDropped).toBe(10);
      expect(metrics.eventsGenerated).toBe(0);

      samplingTelemetry.stop();
    });
  });

  describe('Batch Processing', () => {
    it('should flush events when batch size is reached', (done) => {
      const batchTelemetry = new ProductionTelemetry({ 
        batchSize: 3,
        piiRedactionEnabled: false, // Disable to simplify test
        samplingRates: {} // No sampling
      });
      
      batchTelemetry.on('telemetry_batch', (batch) => {
        expect(batch.events).toHaveLength(3);
        expect(batch.eventCount).toBe(3);
        expect(batch.batchId).toMatch(/^evt_/);
        batchTelemetry.stop();
        done();
      });

      // Emit 3 events to trigger batch
      batchTelemetry.emitCacheHit('key1', 'contract', 10);
      batchTelemetry.emitCacheHit('key2', 'contract', 20);
      batchTelemetry.emitCacheHit('key3', 'contract', 30);
    });

    it('should flush remaining events on stop', () => {
      const initialBatches = telemetryInstance.getMetrics().batchesFlushed;
      
      telemetryInstance.emitCacheHit('key1', 'contract', 10);
      telemetryInstance.emitCacheHit('key2', 'contract', 20);

      telemetryInstance.flush();
      const metrics = telemetryInstance.getMetrics();
      expect(metrics.batchesFlushed).toBe(initialBatches + 1);
    });
  });

  describe('Error Codes', () => {
    it('should provide comprehensive error taxonomy', () => {
      expect(ERROR_CODES.CONTRACT_GENERATION.TEMPLATE_MATCH_FAILED).toBe('CG001');
      expect(ERROR_CODES.DETERMINISTIC_EXTRACTION.DOM_PARSING_FAILED).toBe('DE001');
      expect(ERROR_CODES.LLM_AUGMENTATION.RATE_LIMIT_EXCEEDED).toBe('LA002');
      expect(ERROR_CODES.VALIDATION.SCHEMA_MISMATCH).toBe('VL001');
      expect(ERROR_CODES.SYSTEM.CACHE_FAILURE).toBe('SY001');
      expect(ERROR_CODES.BUDGET.DAILY_BUDGET_EXCEEDED).toBe('BG001');
    });
  });
});

describe('TelemetryCollector', () => {
  let collector: TelemetryCollector;

  beforeEach(() => {
    collector = new TelemetryCollector(10);
  });

  it('should collect and filter events', () => {
    const event1 = {
      id: 'event1',
      type: 'contract_generated' as const,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {
        contractId: 'contract1',
        contractName: 'Test Contract 1',
        fieldCount: 5,
        userQuery: 'test query 1',
        generationMethod: 'template_match' as const,
        processingTimeMs: 1000,
        confidenceScore: 0.8,
        complexity: 'simple' as const,
        fallbackUsed: false,
      },
    };

    const event2 = {
      id: 'event2',
      type: 'deterministic_pass' as const,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {
        contractId: 'contract2',
        totalFields: 10,
        fieldsFound: 8,
        fieldsRequested: 10,
        coverageRatio: 0.8,
        processingTimeMs: 2000,
        domElements: 100,
        selectorsTriedCount: 20,
        anchorsFound: 10,
        confidenceScore: 0.75,
        patternMatches: {},
        domAnalysisTimeMs: 300,
        extractionStrategy: 'css_selectors' as const,
      },
    };

    collector.collect(event1);
    collector.collect(event2);

    // Test filtering by type
    const contractEvents = collector.getEvents({ type: 'contract_generated' });
    expect(contractEvents).toHaveLength(1);
    expect(contractEvents[0].id).toBe('event1');

    // Test filtering by contractId
    const contract1Events = collector.getEvents({ contractId: 'contract1' });
    expect(contract1Events).toHaveLength(1);
    expect(contract1Events[0].id).toBe('event1');
  });

  it('should aggregate events by different dimensions', () => {
    // Add multiple events of different types
    for (let i = 0; i < 3; i++) {
      collector.collect({
        id: `contract-event-${i}`,
        type: 'contract_generated' as const,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        data: {
          contractId: `contract-${i}`,
          contractName: `Test Contract ${i}`,
          fieldCount: 5,
          userQuery: `test query ${i}`,
          generationMethod: 'template_match' as const,
          processingTimeMs: 1000 + i * 100,
          confidenceScore: 0.8,
          complexity: 'simple' as const,
          fallbackUsed: false,
        },
      });
    }

    for (let i = 0; i < 2; i++) {
      collector.collect({
        id: `det-event-${i}`,
        type: 'deterministic_pass' as const,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        data: {
          contractId: `contract-${i}`,
          totalFields: 10,
          fieldsFound: 8,
          fieldsRequested: 10,
          coverageRatio: 0.8,
          processingTimeMs: 2000,
          domElements: 100,
          selectorsTriedCount: 20,
          anchorsFound: 10,
          confidenceScore: 0.75,
          patternMatches: {},
          domAnalysisTimeMs: 300,
          extractionStrategy: 'css_selectors' as const,
        },
      });
    }

    // Aggregate by type
    const byType = collector.aggregateBy('type');
    expect(byType['contract_generated']).toBe(3);
    expect(byType['deterministic_pass']).toBe(2);

    // Aggregate by contractId 
    const byContract = collector.aggregateBy('contractId');
    expect(byContract['contract-0']).toBe(2); // 1 contract + 1 deterministic
    expect(byContract['contract-1']).toBe(2); // 1 contract + 1 deterministic  
    expect(byContract['contract-2']).toBe(1); // 1 contract only

    // Aggregate by processing time
    const avgTime = collector.aggregateBy('type', 'avgProcessingTime');
    expect(avgTime['contract_generated']).toBe((1000 + 1100 + 1200) / 3);
    expect(avgTime['deterministic_pass']).toBe(2000);
  });

  it('should maintain size limit', () => {
    const smallCollector = new TelemetryCollector(3);

    // Add more events than the limit
    for (let i = 0; i < 5; i++) {
      smallCollector.collect({
        id: `event-${i}`,
        type: 'cache_event' as const,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        data: {
          cacheType: 'contract' as const,
          action: 'hit' as const,
          key: `key-${i}`,
          accessTimeMs: 10,
        },
      });
    }

    const events = smallCollector.getEvents();
    expect(events).toHaveLength(3);
    // Should keep the most recent events
    expect(events[0].id).toBe('event-2');
    expect(events[2].id).toBe('event-4');
  });
});

describe('MetricsCalculator', () => {
  let collector: TelemetryCollector;
  let calculator: MetricsCalculator;

  beforeEach(() => {
    collector = new TelemetryCollector(100);
    calculator = new MetricsCalculator(collector);
  });

  it('should calculate SLA metrics', () => {
    // Add successful extraction events
    for (let i = 0; i < 8; i++) {
      collector.collect({
        id: `success-${i}`,
        type: 'contract_generated' as const,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        data: {
          contractId: `contract-${i}`,
          contractName: `Test Contract ${i}`,
          fieldCount: 5,
          userQuery: `test query ${i}`,
          generationMethod: 'template_match' as const,
          processingTimeMs: 1000 + i * 100,
          confidenceScore: 0.8,
          complexity: 'simple' as const,
          fallbackUsed: false,
        },
      });
    }

    // Add error events
    for (let i = 0; i < 2; i++) {
      collector.collect({
        id: `error-${i}`,
        type: 'contract_generated' as const,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        data: {
          contractId: `contract-error-${i}`,
          contractName: `Error Contract ${i}`,
          fieldCount: 0,
          userQuery: `error query ${i}`,
          generationMethod: 'llm_generated' as const,
          processingTimeMs: 5000,
          confidenceScore: 0.1,
          complexity: 'complex' as const,
          fallbackUsed: true,
          errorDetails: 'Test error',
        },
        metadata: { errorDetails: 'Test error' },
      });
    }

    // Add budget events
    collector.collect({
      id: 'budget-1',
      type: 'budget_event' as const,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {
        eventType: 'cost_incurred' as const,
        resourceType: 'llm_tokens' as const,
        costUsd: 1.50,
        budgetRemaining: 8.50,
        utilizationPercentage: 15.0,
        timeWindow: 'hour' as const,
        costBreakdown: {
          llmCosts: 1.50,
          apiCosts: 0,
          computeCosts: 0,
          storageCosts: 0,
        },
        projectedCost: {
          hourly: 1.50,
          daily: 36.0,
          monthly: 1080.0,
        },
      },
    });

    const slaMetrics = calculator.calculateSLAMetrics();

    expect(slaMetrics.availability).toBe(0.8); // 8 success / 10 total
    expect(slaMetrics.successRate).toBe(0.8); // 8 success / 10 total  
    expect(slaMetrics.errorRate).toBe(0.2); // 2 errors / 10 total
    expect(slaMetrics.avgResponseTime).toBe((1000 + 1100 + 1200 + 1300 + 1400 + 1500 + 1600 + 1700 + 5000 + 5000) / 10);
    expect(slaMetrics.budgetUtilization).toBe(1.50);
  });

  it('should calculate performance metrics', () => {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600000);

    // Add cache events
    collector.collect({
      id: 'cache-hit-1',
      type: 'cache_event' as const,
      timestamp: now.toISOString(),
      version: '1.0.0',
      data: {
        cacheType: 'contract' as const,
        action: 'hit' as const,
        key: 'contract-123',
        accessTimeMs: 10,
      },
    });

    collector.collect({
      id: 'cache-miss-1',
      type: 'cache_event' as const,
      timestamp: now.toISOString(),
      version: '1.0.0',
      data: {
        cacheType: 'extraction' as const,
        action: 'miss' as const,
        key: 'extraction-456',
        accessTimeMs: 100,
      },
    });

    // Add extraction events with confidence scores
    collector.collect({
      id: 'extraction-1',
      type: 'deterministic_pass' as const,
      timestamp: now.toISOString(),
      version: '1.0.0',
      data: {
        contractId: 'contract-123',
        totalFields: 10,
        fieldsFound: 8,
        fieldsRequested: 10,
        coverageRatio: 0.8,
        processingTimeMs: 2000,
        domElements: 100,
        selectorsTriedCount: 20,
        anchorsFound: 10,
        confidenceScore: 0.85,
        patternMatches: {},
        domAnalysisTimeMs: 300,
        extractionStrategy: 'css_selectors' as const,
      },
    });

    // Add fallback event
    collector.collect({
      id: 'fallback-1',
      type: 'fallback_taken' as const,
      timestamp: now.toISOString(),
      version: '1.0.0',
      data: {
        contractId: 'contract-123',
        fallbackReason: 'low_confidence' as const,
        fallbackStrategy: 'partial' as const,
        originalAttempt: 'deterministic_extraction',
        fallbackSource: 'template_library',
        confidenceBefore: 0.3,
        confidenceAfter: 0.6,
        fallbackTimeMs: 500,
        dataLoss: {
          fieldsLost: 2,
          dataQualityDrop: 0.15,
        },
      },
    });

    // Add contract generation with template match
    collector.collect({
      id: 'contract-template',
      type: 'contract_generated' as const,
      timestamp: now.toISOString(),
      version: '1.0.0',
      data: {
        contractId: 'contract-template-123',
        contractName: 'Template Contract',
        fieldCount: 5,
        userQuery: 'test query',
        generationMethod: 'template_match' as const,
        processingTimeMs: 1000,
        confidenceScore: 0.9,
        complexity: 'simple' as const,
        fallbackUsed: false,
      },
    });

    const perfMetrics = calculator.calculatePerformanceMetrics();

    expect(perfMetrics.cacheHitRate).toBe(0.5); // 1 hit out of 2 cache events
    expect(perfMetrics.avgConfidence).toBe((0.85 + 0.9) / 2); // Average of confidence scores
    expect(perfMetrics.fallbackRate).toBe(1 / 2); // 1 fallback out of 2 extraction events
    expect(perfMetrics.contractReuse).toBe(1); // 1 template match out of 1 contract event
    expect(perfMetrics.throughput).toBeGreaterThan(0); // Events per minute
  });
});

describe('Dashboard Generation', () => {
  it('should generate comprehensive dashboard data', () => {
    const collector = new TelemetryCollector(100);
    const calculator = new MetricsCalculator(collector);
    const startTime = new Date(Date.now() - 3600000); // 1 hour ago

    // Add sample events
    collector.collect({
      id: 'success-event',
      type: 'contract_generated' as const,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {
        contractId: 'contract-123',
        contractName: 'Test Contract',
        fieldCount: 5,
        userQuery: 'test query',
        generationMethod: 'template_match' as const,
        processingTimeMs: 1000,
        confidenceScore: 0.8,
        complexity: 'simple' as const,
        fallbackUsed: false,
      },
    });

    collector.collect({
      id: 'error-event',
      type: 'contract_generated' as const,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {
        contractId: 'contract-error',
        contractName: 'Error Contract',
        fieldCount: 0,
        userQuery: 'error query',
        generationMethod: 'llm_generated' as const,
        processingTimeMs: 5000,
        confidenceScore: 0.1,
        complexity: 'complex' as const,
        fallbackUsed: true,
        errorDetails: 'Sample error',
      },
      metadata: { errorDetails: 'Sample error' },
    });

    collector.collect({
      id: 'budget-event',
      type: 'budget_event' as const,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {
        eventType: 'cost_incurred' as const,
        resourceType: 'llm_tokens' as const,
        costUsd: 0.50,
        budgetRemaining: 9.50,
        utilizationPercentage: 5.0,
        timeWindow: 'hour' as const,
        costBreakdown: {
          llmCosts: 0.40,
          apiCosts: 0.05,
          computeCosts: 0.03,
          storageCosts: 0.02,
        },
        projectedCost: {
          hourly: 0.50,
          daily: 12.0,
          monthly: 360.0,
        },
      },
    });

    const dashboardData = generateDashboardData(collector, calculator, startTime);

    expect(dashboardData.systemHealth.status).toBe('healthy');
    expect(dashboardData.systemHealth.uptime).toBeGreaterThan(0);
    expect(dashboardData.systemHealth.version).toBe('1.0.0');

    expect(dashboardData.slaMetrics).toBeDefined();
    expect(dashboardData.performanceMetrics).toBeDefined();

    expect(dashboardData.eventSummary['contract_generated']).toBe(2);
    expect(dashboardData.eventSummary['budget_event']).toBe(1);

    expect(dashboardData.recentErrors).toHaveLength(1);
    expect(dashboardData.recentErrors[0].message).toBe('Sample error');
    expect(dashboardData.recentErrors[0].contractId).toBe('contract-error');

    expect(dashboardData.costAnalysis.hourly).toBe(0.50);
    expect(dashboardData.costAnalysis.breakdown.llm).toBe(0.40);
    expect(dashboardData.costAnalysis.breakdown.api).toBe(0.05);
  });
});

describe('Singleton Exports', () => {
  it('should provide working singleton instances', () => {
    // Clear any existing events first
    telemetryCollector.clear();
    
    // Test that convenience functions work (note: cache events might be sampled at 10%)
    emitContractGenerated({
      contractId: 'test-singleton',
      contractName: 'Singleton Test',
      fieldCount: 3,
      userQuery: 'singleton test',
      generationMethod: 'template_match',
      processingTimeMs: 500,
      confidenceScore: 0.95,
      complexity: 'simple',
      fallbackUsed: false,
    });

    // Try multiple cache events due to sampling
    for (let i = 0; i < 20; i++) {
      emitCacheHit(`singleton-test-${i}`, 'contract', 25);
    }
    
    emitBudgetEvent({
      eventType: 'cost_incurred',
      resourceType: 'api_calls',
      costUsd: 0.01,
      budgetRemaining: 9.99,
      utilizationPercentage: 0.1,
      timeWindow: 'minute',
      costBreakdown: {
        llmCosts: 0,
        apiCosts: 0.01,
        computeCosts: 0,
        storageCosts: 0,
      },
      projectedCost: {
        hourly: 0.60,
        daily: 14.40,
        monthly: 432.0,
      },
    });

    // Verify events were collected
    const events = telemetryCollector.getEvents();
    expect(events.length).toBeGreaterThan(0);

    const contractEvent = events.find(e => e.type === 'contract_generated');
    const budgetEvent = events.find(e => e.type === 'budget_event');

    expect(contractEvent).toBeTruthy();
    expect(budgetEvent).toBeTruthy();
    // Cache events may or may not be present due to 10% sampling rate
  });

  it('should calculate metrics from singleton collector', () => {
    const slaMetrics = metricsCalculator.calculateSLAMetrics();
    const perfMetrics = metricsCalculator.calculatePerformanceMetrics();

    expect(slaMetrics).toBeDefined();
    expect(perfMetrics).toBeDefined();

    expect(typeof slaMetrics.availability).toBe('number');
    expect(typeof slaMetrics.successRate).toBe('number');
    expect(typeof perfMetrics.throughput).toBe('number');
    expect(typeof perfMetrics.cacheHitRate).toBe('number');
  });
});