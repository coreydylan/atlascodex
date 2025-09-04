/**
 * Stage Guards Tests - Budget and Latency Enforcement
 */

import { 
  StageGuards, 
  BudgetExceededError, 
  TimeoutError,
  executeStageWithGuards,
  BudgetAwareEvidenceProcessor
} from '../stage-guards';
import { MonitoringService } from '../monitoring';

describe('StageGuards', () => {
  let guards: StageGuards;
  let monitoring: MonitoringService;

  beforeEach(() => {
    monitoring = new MonitoringService();
    guards = new StageGuards(monitoring);
  });

  describe('Budget Enforcement', () => {
    it('should enforce token budget limits', async () => {
      // Set a very strict token budget
      guards.setBudget('test_stage', {
        maxTokens: 10,
        maxLatencyMs: 5000,
        enableAbstention: false,
        abstentionThreshold: 0.8
      });

      // Mock a function that would use too many tokens
      const stageFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      };

      // This should throw a BudgetExceededError due to token estimation
      try {
        await guards.executeWithGuards('test_stage', stageFunction, { tokenEstimate: 50 });
        fail('Expected BudgetExceededError');
      } catch (error) {
        expect(error).toBeInstanceOf(BudgetExceededError);
        expect((error as BudgetExceededError).budgetType).toBe('token');
      }
    });

    it('should enforce latency budget limits', async () => {
      guards.setBudget('timeout_stage', {
        maxTokens: 1000,
        maxLatencyMs: 200, // Very short timeout
        enableAbstention: false,
        abstentionThreshold: 0.8
      });

      const slowFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 500)); // Longer than budget
        return 'should not complete';
      };

      try {
        await guards.executeWithGuards('timeout_stage', slowFunction);
        fail('Expected TimeoutError');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
      }
    });

    it('should gracefully abstain when budget exceeded and abstention enabled', async () => {
      guards.setBudget('abstention_stage', {
        maxTokens: 50,
        maxLatencyMs: 1000,
        enableAbstention: true,
        abstentionThreshold: 0.8
      });

      const result = await guards.executeWithGuards('abstention_stage', async () => {
        throw new BudgetExceededError('test', 'token', 50, 100);
      });

      // Should get a default result due to abstention
      expect(result).toBeDefined();
    });
  });

  describe('Budget Tracking', () => {
    it('should track execution history and calculate utilization', async () => {
      guards.setBudget('tracking_stage', {
        maxTokens: 100,
        maxLatencyMs: 1000,
        enableAbstention: false,
        abstentionThreshold: 0.8
      });

      // Execute a few operations
      for (let i = 0; i < 3; i++) {
        await guards.executeWithGuards('tracking_stage', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return `result_${i}`;
        }, { tokenEstimate: 30 });
      }

      const utilization = guards.getBudgetUtilization('tracking_stage');
      expect(utilization).not.toBeNull();
      expect(utilization!.tokenUtilization).toBeGreaterThan(0);
      expect(utilization!.timeUtilization).toBeGreaterThan(0);
    });

    it('should provide detailed budget report', () => {
      const report = guards.getBudgetReport();
      
      expect(report.summary.totalStages).toBeGreaterThan(0);
      expect(report.stages).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Abstention Callbacks', () => {
    it('should use custom abstention callbacks when registered', async () => {
      const mockCallback = jest.fn().mockResolvedValue('custom_fallback');
      
      guards.registerAbstentionCallback('custom_stage', mockCallback);
      guards.setBudget('custom_stage', {
        maxTokens: 10,
        maxLatencyMs: 100,
        enableAbstention: true,
        abstentionThreshold: 0.5
      });

      const result = await guards.handleStageAbstention('custom_stage', 'budget', {
        stage: 'custom_stage',
        startTime: Date.now()
      });

      expect(mockCallback).toHaveBeenCalled();
      expect(result).toBe('custom_fallback');
    });
  });

  describe('Budget-Aware Evidence Processor', () => {
    it('should process stages with budget enforcement', async () => {
      const processor = new BudgetAwareEvidenceProcessor(guards);
      
      const results = await processor.processWithBudgets({
        query: 'test query',
        html: '<html>test</html>'
      });

      expect(results).toHaveLength(5); // All stages should complete or abstain
      expect(results.every(r => r !== undefined)).toBe(true);
    });
  });

  describe('Emergency Scenarios', () => {
    it('should handle emergency shutdown', () => {
      const shutdownSpy = jest.spyOn(monitoring, 'createAlert');
      
      guards.emergencyShutdown('test emergency');
      
      expect(shutdownSpy).toHaveBeenCalledWith(
        'critical',
        'stage_guards', 
        'Emergency shutdown: test emergency'
      );

      // All budgets should be set to zero
      const status = guards.getBudgetStatus();
      for (const [stage, info] of Object.entries(status)) {
        expect(info.budget.maxTokens).toBe(0);
        expect(info.budget.maxLatencyMs).toBe(0);
      }
    });

    it('should enable debug mode for monitoring', () => {
      const logSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      guards.enableDebugMode();
      guards.emit('budgetExceeded', { stage: 'test', error: new Error('test') });
      
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });
});
