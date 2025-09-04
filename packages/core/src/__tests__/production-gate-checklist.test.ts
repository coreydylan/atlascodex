/**
 * Production Gate Checklist Tests
 * 
 * Comprehensive test suite for the 10-Point Production Readiness Gate system
 */

import {
  ProductionGateValidator,
  ProductionGateRunner,
  ProductionGateError,
  SchemaStrictnessError,
  AnchorValidationError,
  PromotionQuorumError,
  ContentHashingError,
  BudgetEnforcementError,
  StateMachineError,
  AntiHallucinationError,
  PerformanceError,
  ObservabilityError,
  RollbackReadinessError,
  type GateValidationResult,
  type ProductionReadinessReport,
  type TestScenario
} from '../production-gate-checklist';

describe('ProductionGateValidator', () => {
  let validator: ProductionGateValidator;

  beforeEach(() => {
    validator = new ProductionGateValidator();
  });

  describe('Gate 1: Schema Strictness Validation', () => {
    it('should pass when schema has additionalProperties: false', async () => {
      const result = await validator.validateSchemaStrictness();
      expect(result.gate).toBe('Schema Strictness');
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.testResults).toBeDefined();
      expect(result.testResults!.length).toBeGreaterThan(0);
    });

    it('should validate individual schema strictness scenarios', async () => {
      // Test schema with proper strictness
      const strictSchema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        additionalProperties: false,
        unevaluatedProperties: false
      };

      const result = await (validator as any).testSchemaStrictness({
        name: 'schema_has_additional_properties_false',
        input: strictSchema,
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.additionalProperties).toBe(false);
    });

    it('should reject schemas without strictness', async () => {
      const looseSchema = {
        type: 'object',
        properties: { name: { type: 'string' } }
      };

      const result = await (validator as any).testSchemaStrictness({
        name: 'schema_missing_strictness',
        input: looseSchema,
        shouldPass: false
      });

      expect(result.passed).toBe(true); // Should pass the test (detecting non-strict schema)
    });
  });

  describe('Gate 2: Anchor ID System Validation', () => {
    it('should pass when using opaque anchor IDs', async () => {
      const result = await validator.validateAnchorSystem();
      expect(result.gate).toBe('Anchor ID System');
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });

    it('should validate anchor ID patterns', async () => {
      const result = await (validator as any).testAnchorSystem({
        name: 'anchors_use_opaque_ids',
        input: {
          anchors: { 'n_12345': { text: 'test' }, 'n_67890': { text: 'test2' } }
        },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.pattern_check).toBe(true);
    });

    it('should detect invalid anchor patterns', async () => {
      const result = await (validator as any).testAnchorSystem({
        name: 'anchors_use_opaque_ids',
        input: {
          anchors: { 'invalid_id': { text: 'test' }, '.css-selector': { text: 'test2' } }
        },
        shouldPass: true
      });

      expect(result.passed).toBe(false);
      expect(result.details.pattern_check).toBe(false);
    });
  });

  describe('Gate 3: Promotion Quorum Enforcement', () => {
    it('should pass when K=5 entities and M=3 blocks are met', async () => {
      const result = await validator.validatePromotionQuorum();
      expect(result.gate).toBe('Promotion Quorum');
      expect(result.passed).toBe(true);
      expect(result.details.k_entities_required).toBe(5);
      expect(result.details.m_blocks_required).toBe(3);
    });

    it('should validate promotion quorum scenarios', async () => {
      // Test sufficient entities and blocks
      const sufficientEntities = Array.from({ length: 6 }, (_, i) => ({
        id: `e_${i}`,
        research_area: `area_${i}`,
        _source_block_id: `block_${i % 4}`
      }));

      const result = await (validator as any).testPromotionQuorum({
        name: 'meets_entity_and_block_quorum',
        input: {
          field: 'research_area',
          entities: sufficientEntities
        },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.entities_count).toBeGreaterThanOrEqual(5);
      expect(result.details.blocks_count).toBeGreaterThanOrEqual(3);
    });

    it('should reject promotion with insufficient entities', async () => {
      const insufficientEntities = Array.from({ length: 3 }, (_, i) => ({
        id: `e_${i}`,
        research_area: `area_${i}`,
        _source_block_id: `block_${i}`
      }));

      const result = await (validator as any).testPromotionQuorum({
        name: 'insufficient_entities',
        input: {
          field: 'research_area',
          entities: insufficientEntities
        },
        shouldPass: false
      });

      expect(result.passed).toBe(true); // Should pass the test (correctly rejecting promotion)
      expect(result.details.entities_count).toBeLessThan(5);
    });
  });

  describe('Gate 4: Content Hashing Verification', () => {
    it('should pass content hashing validation', async () => {
      const result = await validator.validateContentHashing();
      expect(result.gate).toBe('Content Hashing');
      expect(result.passed).toBe(true);
      expect(result.details.min_cache_hit_rate_required).toBe(0.6);
    });

    it('should generate consistent hashes for same content', async () => {
      const content = '<html><body><div>Test content</div></body></html>';
      
      const result = await (validator as any).testContentHashing({
        name: 'generates_consistent_hashes',
        input: { content1: content, content2: content },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.hash1).toBe(result.details.hash2);
    });

    it('should normalize dynamic content', async () => {
      const result = await (validator as any).testContentHashing({
        name: 'normalizes_dynamic_content',
        input: {
          content1: '<html><body timestamp="1234567890"><div>Test</div></body></html>',
          content2: '<html><body timestamp="0987654321"><div>Test</div></body></html>'
        },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.hash1).toBe(result.details.hash2);
    });
  });

  describe('Gate 5: Budget Enforcement Testing', () => {
    it('should pass budget enforcement validation', async () => {
      const result = await validator.validateBudgetEnforcement();
      expect(result.gate).toBe('Budget Enforcement');
      expect(result.passed).toBe(true);
      expect(result.details.budget_limits).toBeDefined();
    });

    it('should enforce token limits', async () => {
      const result = await (validator as any).testBudgetEnforcement({
        name: 'enforces_token_limits',
        input: {
          stage: 'contract_generation',
          tokensUsed: 600,
          tokenLimit: 500
        },
        shouldPass: true
      });

      expect(result.passed).toBe(true); // Should pass when budget exceeded (abstention occurs)
      expect(result.details.exceeds_limit).toBe(true);
    });

    it('should allow operations within budget', async () => {
      const result = await (validator as any).testBudgetEnforcement({
        name: 'allows_within_budget',
        input: {
          stage: 'validation',
          tokensUsed: 80,
          tokenLimit: 100,
          timeElapsed: 400,
          timeLimit: 600
        },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.within_token_limit).toBe(true);
      expect(result.details.within_time_limit).toBe(true);
    });
  });

  describe('Gate 6: State Machine Validation', () => {
    it('should pass state machine validation', async () => {
      const result = await validator.validateStateMachine();
      expect(result.gate).toBe('State Machine');
      expect(result.passed).toBe(true);
    });

    it('should handle strict mode entity dropping', async () => {
      const result = await (validator as any).testStateMachine({
        name: 'strict_mode_drops_entities',
        input: {
          mode: 'strict',
          entities: [
            { id: '1', name: 'Complete Entity', email: 'test@example.com' },
            { id: '2', name: 'Incomplete Entity' } // Missing required email
          ],
          requiredFields: ['name', 'email']
        },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.expected_drops).toBe(1);
      expect(result.details.actual_drops).toBe(1);
    });

    it('should handle soft mode field demotion', async () => {
      const result = await (validator as any).testStateMachine({
        name: 'soft_mode_demotes_fields',
        input: {
          mode: 'soft',
          entities: [
            { id: '1', name: 'Entity 1', email: 'test1@example.com' },
            { id: '2', name: 'Entity 2' }, // Missing email
            { id: '3', name: 'Entity 3' }, // Missing email  
            { id: '4', name: 'Entity 4' }  // Missing email
          ],
          requiredFields: ['name', 'email']
        },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.email_support).toBe(0.25); // 1/4 entities have email
      expect(result.details.should_demote).toBe(true); // Should demote email field
    });
  });

  describe('Gate 7: Anti-Hallucination Golden Tests', () => {
    it('should pass anti-hallucination validation', async () => {
      const result = await validator.validateAntiHallucination();
      expect(result.gate).toBe('Anti-Hallucination');
      expect(result.passed).toBe(true);
      expect(result.details.golden_tests_automated).toBe(true);
    });

    it('should not generate email fields when no emails exist', async () => {
      const result = await (validator as any).testAntiHallucination({
        name: 'no_emails_no_email_field',
        input: {
          content: '<html><body><div>John Smith</div><div>Research Scientist</div></body></html>',
          query: 'extract contact info',
          expectedFields: ['name', 'title'],
          phantomFields: ['email', 'phone']
        },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.has_email_in_content).toBe(false);
      expect(result.details.would_generate_email_field).toBe(false);
    });

    it('should enforce evidence requirements', async () => {
      const result = await (validator as any).testAntiHallucination({
        name: 'evidence_requirement_enforced',
        input: {
          proposedFields: [
            { name: 'name', value: 'John', evidence: 'n_12345' },
            { name: 'phantom', value: 'fake', evidence: null }
          ]
        },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.with_evidence).toBe(1);
      expect(result.details.expected_with_evidence).toBe(1);
    });
  });

  describe('Gate 8: Performance Benchmarks', () => {
    it('should pass performance validation', async () => {
      const result = await validator.validatePerformance();
      expect(result.gate).toBe('Performance');
      expect(result.passed).toBe(true);
      expect(result.details.performance_targets).toBeDefined();
    });

    it('should validate P95 latency requirements', async () => {
      const goodLatencies = [1.2, 1.5, 2.1, 2.3, 2.8, 3.1, 3.4, 3.7, 4.2, 4.9]; // P95 = 4.9s

      const result = await (validator as any).testPerformance({
        name: 'p95_latency_under_5s',
        input: { latencies: goodLatencies },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.p95_latency).toBeLessThan(5.0);
    });

    it('should validate cost requirements', async () => {
      const goodCosts = [0.02, 0.035, 0.041, 0.038, 0.043];

      const result = await (validator as any).testPerformance({
        name: 'cost_under_5_cents',
        input: { tokenCosts: goodCosts },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.max_cost).toBeLessThan(0.05);
    });
  });

  describe('Gate 9: Observability Verification', () => {
    it('should pass observability validation', async () => {
      const result = await validator.validateObservability();
      expect(result.gate).toBe('Observability');
      expect(result.passed).toBe(true);
      expect(result.details.required_event_types).toBe(5);
    });

    it('should validate all required event types', async () => {
      const result = await (validator as any).testObservability({
        name: 'all_5_event_types_present',
        input: {
          eventTypes: [
            'ContractGenerated',
            'DeterministicPass',
            'LLMAugmentation', 
            'ContractValidation',
            'FallbackTaken'
          ]
        },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.has_all_types).toBe(true);
      expect(result.details.missing_types).toHaveLength(0);
    });

    it('should validate event structure', async () => {
      const result = await (validator as any).testObservability({
        name: 'contract_generated_event_structure',
        input: {
          event: {
            type: 'ContractGenerated',
            data: {
              timestamp: '2025-01-14T10:30:00Z',
              contract_id: 'abc123',
              content_hash: 'def456',
              mode: 'strict',
              tokens_in: 150,
              tokens_out: 45,
              generation_time_ms: 234,
              abstained: false,
              cache_hit: false,
              seed: 12345
            }
          }
        },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.has_all_fields).toBe(true);
    });
  });

  describe('Gate 10: Rollback Readiness', () => {
    it('should pass rollback readiness validation', async () => {
      const result = await validator.validateRollbackReadiness();
      expect(result.gate).toBe('Rollback Readiness');
      expect(result.passed).toBe(true);
    });

    it('should validate feature flag behavior', async () => {
      const result = await (validator as any).testRollbackReadiness({
        name: 'feature_flag_disables_evidence_first',
        input: {
          featureFlag: 'evidence_first_enabled',
          flagValue: false,
          expectedBehavior: 'fallback_to_plan_based'
        },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.flag_value).toBe(false);
    });

    it('should validate API compatibility during rollback', async () => {
      const result = await (validator as any).testRollbackReadiness({
        name: 'rollback_preserves_api_compatibility',
        input: {
          evidenceFirstResponse: {
            success: true,
            data: [{ name: 'test' }],
            metadata: { processing_method: 'evidence_first' }
          },
          fallbackResponse: {
            success: true,
            data: [{ name: 'test' }],
            metadata: { processing_method: 'plan_based' }
          }
        },
        shouldPass: true
      });

      expect(result.passed).toBe(true);
      expect(result.details.compatible_structure).toBe(true);
      expect(result.details.compatible_data).toBe(true);
    });
  });

  describe('Full Validation Integration', () => {
    it('should run complete validation and generate report', async () => {
      const report = await validator.runFullValidation();

      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(1);
      expect(report.gateResults).toHaveLength(10);
      expect(report.timestamp).toBeDefined();
      expect(report.version).toBe('1.0.0');

      // Check all gates are present
      const gateNames = report.gateResults.map(gate => gate.gate);
      expect(gateNames).toContain('Schema Strictness');
      expect(gateNames).toContain('Anchor ID System');
      expect(gateNames).toContain('Promotion Quorum');
      expect(gateNames).toContain('Content Hashing');
      expect(gateNames).toContain('Budget Enforcement');
      expect(gateNames).toContain('State Machine');
      expect(gateNames).toContain('Anti-Hallucination');
      expect(gateNames).toContain('Performance');
      expect(gateNames).toContain('Observability');
      expect(gateNames).toContain('Rollback Readiness');

      // Verify report structure
      report.gateResults.forEach(gate => {
        expect(gate.gate).toBeDefined();
        expect(gate.passed).toBeDefined();
        expect(gate.score).toBeGreaterThanOrEqual(0);
        expect(gate.score).toBeLessThanOrEqual(1);
        expect(gate.details).toBeDefined();
      });
    });

    it('should generate actionable recommendations', async () => {
      const report = await validator.runFullValidation();
      const recommendations = validator.generateActionableRecommendations(report);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);

      if (report.readyForProduction) {
        expect(recommendations[0]).toContain('All gates passed');
      } else {
        expect(recommendations.length).toBeGreaterThan(1);
        expect(recommendations.some(rec => rec.includes('HIGH PRIORITY') || rec.includes('PERFORMANCE') || rec.includes('OPERATIONAL'))).toBe(true);
      }
    });
  });
});

describe('ProductionGateRunner', () => {
  let runner: ProductionGateRunner;

  beforeEach(() => {
    runner = new ProductionGateRunner();
  });

  describe('Specific Gate Execution', () => {
    it('should run specific gates', async () => {
      const results = await runner.runSpecificGates(['Schema Strictness', 'Anchor ID System']);

      expect(results).toHaveLength(2);
      expect(results[0].gate).toBe('Schema Strictness');
      expect(results[1].gate).toBe('Anchor ID System');
    });

    it('should handle unknown gate names', async () => {
      const results = await runner.runSpecificGates(['Unknown Gate']);

      expect(results).toHaveLength(1);
      expect(results[0].gate).toBe('Unknown Gate');
      expect(results[0].passed).toBe(false);
      expect(results[0].details.error).toContain('Unknown gate');
    });
  });

  describe('Pre-Flight Checklist', () => {
    it('should run pre-flight checklist', async () => {
      const result = await runner.runPreFlightChecklist();

      expect(result.passed).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);

      // Verify all checks have required structure
      result.results.forEach(check => {
        expect(check.name).toBeDefined();
        expect(check.description).toBeDefined();
        expect(check.passed).toBeDefined();
        expect(check.details).toBeDefined();
      });
    });
  });

  describe('Complete Validation', () => {
    it('should run complete validation', async () => {
      const report = await runner.runCompleteValidation();

      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.readyForProduction).toBeDefined();
      expect(report.gateResults).toHaveLength(10);
      expect(report.criticalFailures).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });
  });
});

describe('Error Handling', () => {
  it('should create proper error instances', () => {
    const schemaError = new SchemaStrictnessError({ reason: 'test' });
    expect(schemaError).toBeInstanceOf(ProductionGateError);
    expect(schemaError.gate).toBe('Schema Strictness');

    const anchorError = new AnchorValidationError({ reason: 'test' });
    expect(anchorError.gate).toBe('Anchor ID System');

    const quorumError = new PromotionQuorumError({ reason: 'test' });
    expect(quorumError.gate).toBe('Promotion Quorum');

    const hashingError = new ContentHashingError({ reason: 'test' });
    expect(hashingError.gate).toBe('Content Hashing');

    const budgetError = new BudgetEnforcementError({ reason: 'test' });
    expect(budgetError.gate).toBe('Budget Enforcement');

    const stateMachineError = new StateMachineError({ reason: 'test' });
    expect(stateMachineError.gate).toBe('State Machine');

    const hallucinationError = new AntiHallucinationError({ reason: 'test' });
    expect(hallucinationError.gate).toBe('Anti-Hallucination');

    const performanceError = new PerformanceError({ reason: 'test' });
    expect(performanceError.gate).toBe('Performance');

    const observabilityError = new ObservabilityError({ reason: 'test' });
    expect(observabilityError.gate).toBe('Observability');

    const rollbackError = new RollbackReadinessError({ reason: 'test' });
    expect(rollbackError.gate).toBe('Rollback Readiness');
  });
});

describe('Test Scenario Validation', () => {
  it('should validate test scenario structure', () => {
    const scenario: TestScenario = {
      name: 'test_scenario',
      description: 'Test scenario description',
      input: { test: 'data' },
      shouldPass: true,
      timeout: 1000
    };

    expect(scenario.name).toBeDefined();
    expect(scenario.description).toBeDefined();
    expect(scenario.input).toBeDefined();
    expect(typeof scenario.shouldPass).toBe('boolean');
    expect(scenario.timeout).toBe(1000);
  });

  it('should validate gate validation result structure', () => {
    const result: GateValidationResult = {
      gate: 'Test Gate',
      passed: true,
      score: 0.85,
      details: { test: 'data' },
      recommendations: ['Test recommendation'],
      testResults: [
        {
          scenario: 'test_scenario',
          passed: true,
          details: { test: 'result' }
        }
      ]
    };

    expect(result.gate).toBe('Test Gate');
    expect(result.passed).toBe(true);
    expect(result.score).toBe(0.85);
    expect(result.details).toBeDefined();
    expect(result.recommendations).toHaveLength(1);
    expect(result.testResults).toHaveLength(1);
  });

  it('should validate production readiness report structure', () => {
    const report: ProductionReadinessReport = {
      overallScore: 0.9,
      readyForProduction: true,
      gateResults: [],
      criticalFailures: [],
      recommendations: ['Test recommendation'],
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    expect(report.overallScore).toBe(0.9);
    expect(report.readyForProduction).toBe(true);
    expect(Array.isArray(report.gateResults)).toBe(true);
    expect(Array.isArray(report.criticalFailures)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(report.timestamp).toBeDefined();
    expect(report.version).toBe('1.0.0');
  });
});