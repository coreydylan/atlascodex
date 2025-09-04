/**
 * Stage Guards - Budget and Latency Enforcement System
 * Implements strict resource budgets and timeout enforcement for Evidence-First stages
 */

import { EventEmitter } from 'events';
import { MonitoringService } from './monitoring';

// Custom error classes for budget enforcement
export class BudgetExceededError extends Error {
  constructor(
    public readonly stage: string,
    public readonly budgetType: 'token' | 'time',
    public readonly limit: number,
    public readonly actual: number
  ) {
    super(`${stage} stage exceeded ${budgetType} budget: ${actual} > ${limit}`);
    this.name = 'BudgetExceededError';
  }
}

export class TimeoutError extends Error {
  constructor(
    public readonly stage: string,
    public readonly timeoutMs: number
  ) {
    super(`${stage} stage timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

// Stage budget configuration
export interface StageBudget {
  maxTokens: number;
  maxLatencyMs: number;
  enableAbstention: boolean;
  abstentionThreshold: number; // 0-1, when to start abstaining
}

// Guard execution context
export interface GuardContext {
  stage: string;
  startTime: number;
  tokenEstimate?: number;
  metadata?: Record<string, any>;
}

// Abstention callback type
export type AbstentionCallback = (
  stage: string,
  reason: 'budget' | 'timeout' | 'quality',
  context: GuardContext
) => Promise<any>;

/**
 * StageGuards - Enforces strict budgets and latency limits
 */
export class StageGuards extends EventEmitter {
  private monitoring: MonitoringService;
  private budgets: Map<string, StageBudget>;
  private abstentionCallbacks: Map<string, AbstentionCallback>;
  private executionHistory: Map<string, Array<{ timestamp: number; duration: number; tokens?: number }>>;

  constructor(monitoring: MonitoringService) {
    super();
    this.monitoring = monitoring;
    this.budgets = new Map();
    this.abstentionCallbacks = new Map();
    this.executionHistory = new Map();

    // Initialize stage budgets with strict enforcement
    this.initializeStandardBudgets();
  }

  /**
   * Initialize explicit budgets for Evidence-First stages
   */
  private initializeStandardBudgets(): void {
    // Contract Generation: Fast schema generation with minimal tokens
    this.setBudget('contract_generation', {
      maxTokens: 500,
      maxLatencyMs: 800,
      enableAbstention: true,
      abstentionThreshold: 0.8
    });

    // Augmentation: Medium complexity LLM processing
    this.setBudget('augmentation', {
      maxTokens: 400,
      maxLatencyMs: 1200,
      enableAbstention: true,
      abstentionThreshold: 0.7
    });

    // Validation: Quick validation with minimal LLM usage
    this.setBudget('validation', {
      maxTokens: 100,
      maxLatencyMs: 600,
      enableAbstention: true,
      abstentionThreshold: 0.9
    });

    // Schema Negotiation: Complex reasoning but bounded
    this.setBudget('schema_negotiation', {
      maxTokens: 300,
      maxLatencyMs: 1000,
      enableAbstention: true,
      abstentionThreshold: 0.8
    });

    // Deterministic Track: No LLM, only DOM processing
    this.setBudget('deterministic_track', {
      maxTokens: 0, // No LLM usage allowed
      maxLatencyMs: 500,
      enableAbstention: false,
      abstentionThreshold: 1.0
    });
  }

  /**
   * Set budget for a specific stage
   */
  setBudget(stage: string, budget: StageBudget): void {
    this.budgets.set(stage, budget);
    this.monitoring.recordMetric(`budget_set_${stage}`, 1, 'event');
  }

  /**
   * Execute stage function with strict budget and latency guards
   */
  async executeWithGuards<T>(
    stage: string,
    stageFunction: () => Promise<T>,
    context?: Partial<GuardContext>
  ): Promise<T> {
    const budget = this.budgets.get(stage);
    if (!budget) {
      throw new Error(`No budget defined for stage: ${stage}`);
    }

    const guardContext: GuardContext = {
      stage,
      startTime: Date.now(),
      ...context
    };

    // Check if we should abstain before starting
    if (await this.shouldAbstain(stage, guardContext)) {
      return this.handleStageAbstention(stage, 'budget', guardContext);
    }

    // Pre-execution budget awareness
    const budgetAwarePrompt = this.createBudgetAwarePrompt(stage, budget);
    
    // Execute with timeout enforcement using Promise.race
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(stage, budget.maxLatencyMs));
      }, budget.maxLatencyMs);
    });

    try {
      const result = await Promise.race([
        this.executeWithBudgetTracking(stageFunction, stage, budget, guardContext),
        timeoutPromise
      ]);

      // Record successful execution
      this.recordExecution(stage, Date.now() - guardContext.startTime, context?.tokenEstimate);
      this.monitoring.recordMetric(`stage_success_${stage}`, 1, 'count');

      return result;

    } catch (error) {
      // Handle budget exceeded or timeout
      if (error instanceof BudgetExceededError || error instanceof TimeoutError) {
        this.monitoring.recordMetric(`stage_budget_exceeded_${stage}`, 1, 'count');
        this.emit('budgetExceeded', { stage, error, context: guardContext });
        
        // Attempt graceful degradation
        if (budget.enableAbstention) {
          return this.handleStageAbstention(stage, 'budget', guardContext);
        }
      }

      this.monitoring.recordMetric(`stage_error_${stage}`, 1, 'count');
      throw error;
    }
  }

  /**
   * Execute with budget tracking and enforcement
   */
  private async executeWithBudgetTracking<T>(
    stageFunction: () => Promise<T>,
    stage: string,
    budget: StageBudget,
    context: GuardContext
  ): Promise<T> {
    const startTokens = this.estimateCurrentTokenUsage();
    
    // Execute the stage function
    const result = await stageFunction();
    
    // Post-execution budget validation
    const endTokens = this.estimateCurrentTokenUsage();
    const tokensUsed = endTokens - startTokens;
    const timeUsed = Date.now() - context.startTime;

    // Strict budget enforcement
    if (budget.maxTokens > 0 && tokensUsed > budget.maxTokens) {
      throw new BudgetExceededError(stage, 'token', budget.maxTokens, tokensUsed);
    }

    if (timeUsed > budget.maxLatencyMs) {
      throw new BudgetExceededError(stage, 'time', budget.maxLatencyMs, timeUsed);
    }

    // Record telemetry
    this.monitoring.recordMetric(`tokens_used_${stage}`, tokensUsed, 'tokens');
    this.monitoring.recordMetric(`latency_${stage}`, timeUsed, 'ms');
    this.monitoring.recordMetric(`budget_utilization_tokens_${stage}`, 
      budget.maxTokens > 0 ? (tokensUsed / budget.maxTokens) : 0, 'ratio');
    this.monitoring.recordMetric(`budget_utilization_time_${stage}`, 
      timeUsed / budget.maxLatencyMs, 'ratio');

    return result;
  }

  /**
   * Create budget-aware prompt that informs LLM of constraints
   */
  private createBudgetAwarePrompt(stage: string, budget: StageBudget): string {
    if (budget.maxTokens === 0) {
      return ''; // No LLM usage allowed
    }

    return `BUDGET CONSTRAINTS for ${stage}:
- Maximum tokens: ${budget.maxTokens}
- Maximum time: ${budget.maxLatencyMs}ms
- Be concise and efficient
- Prioritize essential information only
- If time/token budget is tight, provide abbreviated response

`;
  }

  /**
   * Determine if stage should abstain based on current system state
   */
  private async shouldAbstain(stage: string, context: GuardContext): Promise<boolean> {
    const budget = this.budgets.get(stage);
    if (!budget || !budget.enableAbstention) {
      return false;
    }

    // Check historical performance
    const history = this.executionHistory.get(stage) || [];
    if (history.length === 0) {
      return false; // No history, proceed
    }

    // Calculate recent average duration
    const recentExecutions = history.slice(-5);
    const avgDuration = recentExecutions.reduce((sum, exec) => sum + exec.duration, 0) / recentExecutions.length;
    
    // Abstain if recent average suggests we'll exceed budget
    const projectedOverrun = avgDuration / budget.maxLatencyMs;
    
    if (projectedOverrun > budget.abstentionThreshold) {
      this.monitoring.recordMetric(`stage_abstention_${stage}`, 1, 'count', {
        reason: 'projected_overrun',
        projectedRatio: projectedOverrun.toString()
      });
      return true;
    }

    // Check current system load
    const systemHealth = this.monitoring.getSystemHealth();
    if (systemHealth.status === 'unhealthy') {
      this.monitoring.recordMetric(`stage_abstention_${stage}`, 1, 'count', {
        reason: 'system_unhealthy'
      });
      return true;
    }

    return false;
  }

  /**
   * Handle stage abstention with graceful degradation
   */
  async handleStageAbstention<T>(
    stage: string,
    reason: 'budget' | 'timeout' | 'quality',
    context: GuardContext
  ): Promise<T> {
    this.monitoring.recordMetric(`stage_abstention_${stage}`, 1, 'count', {
      reason
    });

    this.emit('stageAbstention', { stage, reason, context });

    // Try abstention callback if registered
    const callback = this.abstentionCallbacks.get(stage);
    if (callback) {
      try {
        return await callback(stage, reason, context);
      } catch (callbackError) {
        console.warn(`Abstention callback failed for ${stage}:`, callbackError);
      }
    }

    // Default abstention strategies by stage
    switch (stage) {
      case 'contract_generation':
        return this.getDefaultContract() as T;
      
      case 'augmentation':
        return { 
          field_completions: [],
          new_field_proposals: [],
          normalizations: [],
          abstained: true,
          reason
        } as T;
      
      case 'validation':
        return {
          isValid: true,
          errors: [],
          warnings: [`Validation abstained due to ${reason}`],
          abstained: true
        } as T;
      
      case 'schema_negotiation':
        return {
          status: 'success',
          final_schema: [],
          changes: { pruned: [], added: [], demoted: [] },
          evidence_summary: {
            total_support: 0,
            field_coverage: {},
            reliability_score: 0.5
          },
          abstained: true,
          reason
        } as T;

      default:
        throw new Error(`No abstention strategy defined for stage: ${stage}`);
    }
  }

  /**
   * Register abstention callback for custom fallback handling
   */
  registerAbstentionCallback(stage: string, callback: AbstentionCallback): void {
    this.abstentionCallbacks.set(stage, callback);
  }

  /**
   * Record execution for historical analysis
   */
  private recordExecution(stage: string, duration: number, tokens?: number): void {
    if (!this.executionHistory.has(stage)) {
      this.executionHistory.set(stage, []);
    }

    const history = this.executionHistory.get(stage)!;
    history.push({
      timestamp: Date.now(),
      duration,
      tokens
    });

    // Keep only last 100 executions per stage
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get budget utilization for a stage
   */
  getBudgetUtilization(stage: string): {
    tokenUtilization: number;
    timeUtilization: number;
    recentPerformance: { avgDuration: number; avgTokens: number };
  } | null {
    const budget = this.budgets.get(stage);
    const history = this.executionHistory.get(stage);
    
    if (!budget || !history || history.length === 0) {
      return null;
    }

    const recent = history.slice(-10);
    const avgDuration = recent.reduce((sum, exec) => sum + exec.duration, 0) / recent.length;
    const avgTokens = recent
      .filter(exec => exec.tokens !== undefined)
      .reduce((sum, exec) => sum + (exec.tokens || 0), 0) / recent.length;

    return {
      tokenUtilization: budget.maxTokens > 0 ? avgTokens / budget.maxTokens : 0,
      timeUtilization: avgDuration / budget.maxLatencyMs,
      recentPerformance: { avgDuration, avgTokens }
    };
  }

  /**
   * Get all stage performance metrics
   */
  getAllStageMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    for (const stage of Array.from(this.budgets.keys())) {
      const utilization = this.getBudgetUtilization(stage);
      const budget = this.budgets.get(stage)!;
      
      metrics[stage] = {
        budget,
        utilization,
        history: (this.executionHistory.get(stage) || []).slice(-5)
      };
    }

    return metrics;
  }

  /**
   * Create budget-aware execution wrapper
   */
  withBudgetAwareness<T>(
    stage: string,
    estimatedTokens: number = 0
  ): (fn: () => Promise<T>) => Promise<T> {
    return async (stageFunction: () => Promise<T>) => {
      return this.executeWithGuards(stage, stageFunction, {
        tokenEstimate: estimatedTokens
      });
    };
  }

  /**
   * Emergency budget override for critical operations
   */
  executeWithOverride<T>(
    stage: string,
    stageFunction: () => Promise<T>,
    overrideBudget: Partial<StageBudget>
  ): Promise<T> {
    const originalBudget = this.budgets.get(stage);
    if (!originalBudget) {
      throw new Error(`No budget defined for stage: ${stage}`);
    }

    // Temporarily override budget
    const tempBudget = { ...originalBudget, ...overrideBudget };
    this.budgets.set(stage, tempBudget);

    this.monitoring.recordMetric(`budget_override_${stage}`, 1, 'count');

    try {
      return this.executeWithGuards(stage, stageFunction);
    } finally {
      // Restore original budget
      this.budgets.set(stage, originalBudget);
    }
  }

  /**
   * Bulk stage execution with coordinated budget management
   */
  async executeStageSequence<T>(
    stages: Array<{
      name: string;
      function: () => Promise<any>;
      tokenEstimate?: number;
      dependencies?: string[];
    }>,
    totalBudget?: { maxTokens: number; maxLatencyMs: number }
  ): Promise<T[]> {
    const startTime = Date.now();
    let totalTokensUsed = 0;
    const results: T[] = [];

    for (const stage of stages) {
      // Check if we're approaching total budget limits
      if (totalBudget) {
        const elapsed = Date.now() - startTime;
        const remainingTime = totalBudget.maxLatencyMs - elapsed;
        const remainingTokens = totalBudget.maxTokens - totalTokensUsed;

        // Adjust stage budget based on remaining resources
        if (remainingTime < 200 || remainingTokens < 50) {
          this.monitoring.recordMetric(`sequence_early_termination`, 1, 'count');
          break;
        }

        // Dynamically adjust stage budget
        const stageBudget = this.budgets.get(stage.name);
        if (stageBudget) {
          const adjustedBudget = {
            ...stageBudget,
            maxLatencyMs: Math.min(stageBudget.maxLatencyMs, remainingTime),
            maxTokens: Math.min(stageBudget.maxTokens, remainingTokens)
          };
          this.budgets.set(stage.name, adjustedBudget);
        }
      }

      try {
        const result = await this.executeWithGuards(stage.name, stage.function, {
          tokenEstimate: stage.tokenEstimate
        });
        
        results.push(result);
        totalTokensUsed += stage.tokenEstimate || 0;

      } catch (error) {
        if (error instanceof BudgetExceededError || error instanceof TimeoutError) {
          // Handle gracefully and continue with abstention
          const abstentionResult = await this.handleStageAbstention<T>(
            stage.name, 
            'budget', 
            { stage: stage.name, startTime: Date.now() }
          );
          results.push(abstentionResult);
        } else {
          throw error;
        }
      }
    }

    this.monitoring.recordMetric('sequence_total_time', Date.now() - startTime, 'ms');
    this.monitoring.recordMetric('sequence_total_tokens', totalTokensUsed, 'tokens');

    return results;
  }

  /**
   * Adaptive budget adjustment based on system performance
   */
  adaptiveBudgetAdjustment(): void {
    const systemHealth = this.monitoring.getSystemHealth();
    
    for (const [stage, budget] of Array.from(this.budgets.entries())) {
      const utilization = this.getBudgetUtilization(stage);
      if (!utilization) continue;

      let adjustment = 1.0;

      // Reduce budgets if system is under stress
      if (systemHealth.status === 'degraded') {
        adjustment = 0.8;
      } else if (systemHealth.status === 'unhealthy') {
        adjustment = 0.6;
      }

      // Increase abstention threshold if consistently over budget
      if (utilization.timeUtilization > 0.9 || utilization.tokenUtilization > 0.9) {
        adjustment *= 0.9;
        budget.abstentionThreshold = Math.max(0.5, budget.abstentionThreshold - 0.1);
      }

      // Apply adjustments
      if (adjustment < 1.0) {
        const adjustedBudget = {
          ...budget,
          maxTokens: Math.floor(budget.maxTokens * adjustment),
          maxLatencyMs: Math.floor(budget.maxLatencyMs * adjustment)
        };
        
        this.budgets.set(stage, adjustedBudget);
        this.monitoring.recordMetric(`budget_adjustment_${stage}`, adjustment, 'ratio');
      }
    }
  }

  /**
   * Get current budget status for all stages
   */
  getBudgetStatus(): Record<string, {
    budget: StageBudget;
    utilization?: ReturnType<StageGuards['getBudgetUtilization']>;
    status: 'healthy' | 'warning' | 'critical';
  }> {
    const status: Record<string, any> = {};

    for (const [stage, budget] of Array.from(this.budgets.entries())) {
      const utilization = this.getBudgetUtilization(stage);
      
      let stageStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (utilization) {
        if (utilization.timeUtilization > 0.9 || utilization.tokenUtilization > 0.9) {
          stageStatus = 'critical';
        } else if (utilization.timeUtilization > 0.7 || utilization.tokenUtilization > 0.7) {
          stageStatus = 'warning';
        }
      }

      status[stage] = {
        budget,
        utilization,
        status: stageStatus
      };
    }

    return status;
  }

  /**
   * Reset budgets to default values
   */
  resetBudgets(): void {
    this.budgets.clear();
    this.executionHistory.clear();
    this.initializeStandardBudgets();
    this.monitoring.recordMetric('budgets_reset', 1, 'event');
  }

  /**
   * Emergency shutdown of all stage processing
   */
  emergencyShutdown(reason: string): void {
    this.monitoring.createAlert('critical', 'stage_guards', `Emergency shutdown: ${reason}`);
    
    // Clear all budgets to prevent new executions
    for (const stage of Array.from(this.budgets.keys())) {
      this.setBudget(stage, {
        maxTokens: 0,
        maxLatencyMs: 0,
        enableAbstention: true,
        abstentionThreshold: 0
      });
    }

    this.emit('emergencyShutdown', { reason, timestamp: Date.now() });
  }

  /**
   * Estimate current token usage (simplified implementation)
   */
  private estimateCurrentTokenUsage(): number {
    // This would integrate with actual token counting from LLM provider
    // For now, return a mock value
    return Math.floor(Math.random() * 100);
  }

  /**
   * Get default contract for abstention fallback
   */
  private getDefaultContract(): any {
    return {
      entity: 'unknown',
      fields: [],
      governance: {
        allowNewFields: false,
        newFieldPolicy: 'strict',
        min_support_threshold: 1,
        max_discoverable_fields: 0
      },
      abstained: true
    };
  }

  /**
   * Enable debug mode for detailed budget tracking
   */
  enableDebugMode(): void {
    this.on('budgetExceeded', (event) => {
      console.warn(`[STAGE-GUARDS] Budget exceeded:`, event);
    });

    this.on('stageAbstention', (event) => {
      console.log(`[STAGE-GUARDS] Stage abstention:`, event);
    });

    this.monitoring.recordMetric('debug_mode_enabled', 1, 'event');
  }

  /**
   * Get detailed budget report
   */
  getBudgetReport(): {
    summary: {
      totalStages: number;
      healthyStages: number;
      warningStages: number;
      criticalStages: number;
    };
    stages: ReturnType<StageGuards['getBudgetStatus']>;
    recommendations: string[];
  } {
    const stages = this.getBudgetStatus();
    
    let healthyStages = 0;
    let warningStages = 0;
    let criticalStages = 0;
    
    const recommendations: string[] = [];

    for (const [stage, info] of Object.entries(stages)) {
      switch (info.status) {
        case 'healthy':
          healthyStages++;
          break;
        case 'warning':
          warningStages++;
          recommendations.push(`Consider optimizing ${stage} stage performance`);
          break;
        case 'critical':
          criticalStages++;
          recommendations.push(`URGENT: ${stage} stage consistently exceeds budget limits`);
          break;
      }
    }

    // Global recommendations
    if (criticalStages > 0) {
      recommendations.push('Consider increasing budgets or optimizing critical stages');
    }
    
    if (warningStages + criticalStages > healthyStages) {
      recommendations.push('System may benefit from adaptive budget scaling');
    }

    return {
      summary: {
        totalStages: this.budgets.size,
        healthyStages,
        warningStages,
        criticalStages
      },
      stages,
      recommendations
    };
  }
}

/**
 * Global stage guards instance
 */
export const globalStageGuards = new StageGuards(new MonitoringService());

/**
 * Convenience function for guarded execution
 */
export async function executeStageWithGuards<T>(
  stage: string,
  stageFunction: () => Promise<T>,
  tokenEstimate?: number
): Promise<T> {
  return globalStageGuards.executeWithGuards(stage, stageFunction, {
    tokenEstimate
  });
}

/**
 * Stage decorator for automatic budget enforcement
 */
export function withBudgetGuards(stage: string, tokenEstimate: number = 0) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return executeStageWithGuards(
        stage,
        () => originalMethod.apply(this, args),
        tokenEstimate
      );
    };
    
    return descriptor;
  };
}

/**
 * Example Integration: Budget-Aware Evidence-First Processing
 */
export class BudgetAwareEvidenceProcessor {
  private guards: StageGuards;

  constructor(guards: StageGuards = globalStageGuards) {
    this.guards = guards;

    // Register custom abstention callbacks
    this.setupAbstentionCallbacks();
  }

  /**
   * Process extraction with full budget enforcement
   */
  async processWithBudgets(context: any): Promise<any> {
    const stages = [
      {
        name: 'contract_generation',
        function: () => this.generateContract(context),
        tokenEstimate: 450
      },
      {
        name: 'deterministic_track',
        function: () => this.runDeterministicTrack(context),
        tokenEstimate: 0 // No LLM usage
      },
      {
        name: 'augmentation',
        function: () => this.runAugmentation(context),
        tokenEstimate: 350
      },
      {
        name: 'validation',
        function: () => this.validateResults(context),
        tokenEstimate: 75
      },
      {
        name: 'schema_negotiation',
        function: () => this.negotiateSchema(context),
        tokenEstimate: 250
      }
    ];

    // Execute with coordinated budget management
    return this.guards.executeStageSequence(stages, {
      maxTokens: 1200,
      maxLatencyMs: 4000
    });
  }

  /**
   * Setup custom abstention callbacks for fallback handling
   */
  private setupAbstentionCallbacks(): void {
    // Contract generation fallback: use template library
    this.guards.registerAbstentionCallback('contract_generation', async (stage, reason) => {
      console.log(`Using template library fallback for contract generation (${reason})`);
      return {
        entity: 'generic',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'description', type: 'string', required: false }
        ],
        abstained: true,
        fallback: 'template_library'
      };
    });

    // Augmentation fallback: skip LLM enhancement
    this.guards.registerAbstentionCallback('augmentation', async (stage, reason) => {
      console.log(`Skipping LLM augmentation (${reason})`);
      return {
        field_completions: [],
        new_field_proposals: [],
        normalizations: [],
        abstained: true,
        fallback: 'deterministic_only'
      };
    });

    // Validation fallback: basic validation
    this.guards.registerAbstentionCallback('validation', async (stage, reason) => {
      console.log(`Using basic validation fallback (${reason})`);
      return {
        isValid: true,
        errors: [],
        warnings: ['Validation performed with basic checks only'],
        abstained: true,
        fallback: 'basic_validation'
      };
    });
  }

  // Mock stage implementations (would integrate with actual processors)
  private async generateContract(context: any): Promise<any> {
    // Simulate contract generation with budget awareness
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 400));
    return { contract: 'generated', stage: 'contract_generation' };
  }

  private async runDeterministicTrack(context: any): Promise<any> {
    // Simulate deterministic processing (no LLM)
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    return { results: 'deterministic', stage: 'deterministic_track' };
  }

  private async runAugmentation(context: any): Promise<any> {
    // Simulate LLM augmentation
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 600));
    return { augmented: true, stage: 'augmentation' };
  }

  private async validateResults(context: any): Promise<any> {
    // Simulate validation
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    return { valid: true, stage: 'validation' };
  }

  private async negotiateSchema(context: any): Promise<any> {
    // Simulate schema negotiation
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 400));
    return { negotiated: true, stage: 'schema_negotiation' };
  }
}

/**
 * Budget monitoring dashboard helper
 */
export class BudgetDashboard {
  constructor(private guards: StageGuards) {}

  /**
   * Get dashboard data for monitoring UI
   */
  getDashboardData(): {
    budgetStatus: ReturnType<StageGuards['getBudgetStatus']>;
    budgetReport: ReturnType<StageGuards['getBudgetReport']>;
    realtimeMetrics: ReturnType<StageGuards['getAllStageMetrics']>;
  } {
    return {
      budgetStatus: this.guards.getBudgetStatus(),
      budgetReport: this.guards.getBudgetReport(),
      realtimeMetrics: this.guards.getAllStageMetrics()
    };
  }

  /**
   * Auto-adjust budgets based on system performance
   */
  enableAutoAdjustment(intervalMs: number = 30000): NodeJS.Timeout {
    return setInterval(() => {
      this.guards.adaptiveBudgetAdjustment();
    }, intervalMs);
  }
}
