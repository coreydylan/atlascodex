/**
 * Atlas Codex Executor
 * Executes skill-based plans with budget controls and tracing
 */

import { SkillRegistry, ExecutionContext, ExecutionTrace, SkillInput, SkillOutput } from './skill-registry';
import { ExecutionPlan, PlanStep } from './planner';

export interface ExecutionResult {
  success: boolean;
  data: any;
  trace: ExecutionTrace[];
  budget_used: {
    time: number;
    tokens: number;
    requests: number;
  };
  budget_remaining: {
    time: number;
    tokens: number; 
    requests: number;
  };
  confidence: number;
  errors: string[];
  partial_results?: any;
  citations?: any[];
}

export interface ExecutionOptions {
  max_time?: number;      // milliseconds
  max_tokens?: number;    // token budget
  max_requests?: number;  // HTTP request limit
  return_partial?: boolean; // return partial results on budget exhaustion
  cache_enabled?: boolean;
  debug?: boolean;
}

/**
 * Plan Executor - runs skill plans with budget enforcement
 */
export class PlanExecutor {
  private cache = new Map<string, any>();
  
  constructor(private options: ExecutionOptions = {}) {
    this.options = {
      max_time: 30000,      // 30 seconds default
      max_tokens: 10000,    // token budget
      max_requests: 10,     // request limit
      return_partial: true,
      cache_enabled: true,
      debug: false,
      ...options
    };
  }
  
  /**
   * Execute a complete extraction plan
   */
  async execute(plan: ExecutionPlan, input: { url: string; html?: string }): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    const context: ExecutionContext = {
      budget: {
        maxTime: this.options.max_time!,
        maxTokens: this.options.max_tokens!,
        maxRequests: this.options.max_requests!,
        used: { time: 0, tokens: 0, requests: 0 }
      },
      trace: [],
      cache: this.options.cache_enabled ? this.cache : new Map()
    };
    
    let currentData = input;
    const errors: string[] = [];
    
    try {
      // Execute plan steps sequentially
      for (const step of plan.plan) {
        // Check budget before each step
        if (!this.checkBudget(context)) {
          if (this.options.return_partial) {
            errors.push('Budget exhausted - returning partial results');
            break;
          } else {
            throw new Error('Budget exhausted');
          }
        }
        
        try {
          const result = await this.executeStep(step, currentData, context);
          if (result) {
            currentData = { ...currentData, ...result };
          }
        } catch (error) {
          const errorMsg = `Step ${step.use} failed: ${error.message}`;
          errors.push(errorMsg);
          
          if (this.options.debug) {
            console.error(errorMsg, error);
          }
          
          // Try alternative if available
          if (step.or) {
            try {
              const fallbackResult = await this.executeStep(step.or, currentData, context);
              if (fallbackResult) {
                currentData = { ...currentData, ...fallbackResult };
              }
            } catch (fallbackError) {
              errors.push(`Fallback ${step.or.use} also failed: ${fallbackError.message}`);
            }
          }
        }
      }
      
      // Update final timing
      context.budget.used.time = Date.now() - startTime;
      
      // Calculate overall confidence
      const confidence = this.calculateConfidence(context.trace);
      
      return {
        success: errors.length === 0,
        data: this.formatOutput(currentData, plan.target_schema),
        trace: context.trace,
        budget_used: context.budget.used,
        budget_remaining: {
          time: Math.max(0, context.budget.maxTime - context.budget.used.time),
          tokens: Math.max(0, context.budget.maxTokens - context.budget.used.tokens),
          requests: Math.max(0, context.budget.maxRequests - context.budget.used.requests)
        },
        confidence,
        errors,
        citations: this.extractCitations(currentData)
      };
      
    } catch (error) {
      return {
        success: false,
        data: null,
        trace: context.trace,
        budget_used: context.budget.used,
        budget_remaining: {
          time: Math.max(0, context.budget.maxTime - context.budget.used.time),
          tokens: Math.max(0, context.budget.maxTokens - context.budget.used.tokens),
          requests: Math.max(0, context.budget.maxRequests - context.budget.used.requests)
        },
        confidence: 0,
        errors: [error.message, ...errors]
      };
    }
  }
  
  /**
   * Execute a single plan step
   */
  private async executeStep(step: PlanStep, data: any, context: ExecutionContext): Promise<any> {
    const skill = SkillRegistry.get(step.use);
    if (!skill) {
      throw new Error(`Skill not found: ${step.use}`);
    }
    
    // Check preconditions
    if (step.if && !this.evaluateCondition(step.if, data)) {
      return null; // Skip this step
    }
    
    // Check if_missing conditions
    if (step.if_missing) {
      const hasMissingFields = step.if_missing.some(field => !data[field]);
      if (!hasMissingFields) {
        return null; // Skip - all fields present
      }
    }
    
    // Prepare input parameters
    const skillInput: SkillInput = {
      ...data,
      ...step.with
    };
    
    // Check cache
    const cacheKey = this.getCacheKey(step.use, skillInput);
    if (context.cache.has(cacheKey)) {
      const cached = context.cache.get(cacheKey);
      if (this.options.debug) {
        console.log(`Cache hit for ${step.use}`);
      }
      return cached;
    }
    
    const stepStartTime = Date.now();
    
    try {
      // Execute skill
      const result: SkillOutput = await skill.implementation(skillInput, context);
      const stepEndTime = Date.now();
      
      // Update budget
      context.budget.used.time += stepEndTime - stepStartTime;
      context.budget.used.tokens += this.estimateTokens(skill.cost.tokens);
      if (skill.cost.network > 0) {
        context.budget.used.requests += skill.cost.network;
      }
      
      // Record trace
      context.trace.push({
        skill: step.use,
        input: skillInput,
        output: result,
        startTime: stepStartTime,
        endTime: stepEndTime,
        cost: skill.cost,
        errors: result.error ? [result.error] : undefined
      });
      
      // Cache result
      if (this.options.cache_enabled && result.confidence && result.confidence > 0.5) {
        context.cache.set(cacheKey, result);
      }
      
      if (this.options.debug) {
        console.log(`Executed ${step.use}: confidence=${result.confidence}, time=${stepEndTime - stepStartTime}ms`);
      }
      
      return result;
      
    } catch (error) {
      const stepEndTime = Date.now();
      
      // Record failed trace
      context.trace.push({
        skill: step.use,
        input: skillInput,
        output: { confidence: 0 },
        startTime: stepStartTime,
        endTime: stepEndTime,
        cost: skill.cost,
        errors: [error.message]
      });
      
      throw error;
    }
  }
  
  /**
   * Check if budget allows for more execution
   */
  private checkBudget(context: ExecutionContext): boolean {
    return (
      context.budget.used.time < context.budget.maxTime &&
      context.budget.used.tokens < context.budget.maxTokens &&
      context.budget.used.requests < context.budget.maxRequests
    );
  }
  
  /**
   * Evaluate step conditions
   */
  private evaluateCondition(condition: string, data: any): boolean {
    // Simple condition evaluation (could be enhanced)
    const [field, operator, value] = condition.split(' ');
    
    switch (operator) {
      case 'exists':
        return data[field] !== undefined && data[field] !== null;
      case 'missing':
        return data[field] === undefined || data[field] === null;
      case 'equals':
        return data[field] === value;
      case 'contains':
        return data[field] && data[field].includes(value);
      default:
        return true;
    }
  }
  
  /**
   * Generate cache key for skill execution
   */
  private getCacheKey(skillName: string, input: SkillInput): string {
    // Create deterministic key based on skill and input
    const inputStr = JSON.stringify(input, Object.keys(input).sort());
    return `${skillName}:${this.hashString(inputStr)}`;
  }
  
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
  
  /**
   * Estimate token usage from cost level
   */
  private estimateTokens(level: 'none' | 'low' | 'medium' | 'high'): number {
    switch (level) {
      case 'none': return 0;
      case 'low': return 100;
      case 'medium': return 500;
      case 'high': return 1500;
      default: return 0;
    }
  }
  
  /**
   * Calculate overall confidence from trace
   */
  private calculateConfidence(trace: ExecutionTrace[]): number {
    if (trace.length === 0) return 0;
    
    const confidences = trace
      .map(t => t.output.confidence || 0)
      .filter(c => c > 0);
      
    if (confidences.length === 0) return 0;
    
    // Weighted average, with critical steps having more weight
    const criticalSkills = ['DetectStructuredData', 'MapFields', 'ValidateOutput'];
    let totalWeight = 0;
    let weightedSum = 0;
    
    trace.forEach(t => {
      const confidence = t.output.confidence || 0;
      const weight = criticalSkills.includes(t.skill) ? 2 : 1;
      totalWeight += weight;
      weightedSum += confidence * weight;
    });
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Format output according to target schema
   */
  private formatOutput(data: any, schema: any): any {
    if (schema.type === 'array' && data.ranked) {
      return data.ranked;
    } else if (data.mapped) {
      return data.mapped;
    } else {
      return data;
    }
  }
  
  /**
   * Extract citations from final data
   */
  private extractCitations(data: any): any[] {
    if (data._citations) {
      return data._citations;
    }
    
    // Look for citations in nested objects
    const citations: any[] = [];
    const extractRecursive = (obj: any) => {
      if (obj && typeof obj === 'object') {
        if (obj._citations) {
          citations.push(...obj._citations);
        }
        Object.values(obj).forEach(extractRecursive);
      }
    };
    
    extractRecursive(data);
    return citations;
  }
}

/**
 * Skill Executor - runs individual skills (used by plan executor)
 */
export class SkillExecutor {
  static async execute(skillName: string, input: SkillInput, context?: ExecutionContext): Promise<SkillOutput> {
    const skill = SkillRegistry.get(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }
    
    const ctx = context || {
      budget: {
        maxTime: 30000,
        maxTokens: 1000,
        maxRequests: 5,
        used: { time: 0, tokens: 0, requests: 0 }
      },
      trace: [],
      cache: new Map()
    };
    
    return skill.implementation(input, ctx);
  }
}

/**
 * Budget Manager - tracks and enforces execution budgets
 */
export class BudgetManager {
  constructor(private budget: ExecutionContext['budget']) {}
  
  canExecute(cost: { time: number; tokens: number; requests: number }): boolean {
    return (
      this.budget.used.time + cost.time <= this.budget.maxTime &&
      this.budget.used.tokens + cost.tokens <= this.budget.maxTokens &&
      this.budget.used.requests + cost.requests <= this.budget.maxRequests
    );
  }
  
  consume(cost: { time: number; tokens: number; requests: number }): void {
    this.budget.used.time += cost.time;
    this.budget.used.tokens += cost.tokens;
    this.budget.used.requests += cost.requests;
  }
  
  getRemaining(): { time: number; tokens: number; requests: number } {
    return {
      time: Math.max(0, this.budget.maxTime - this.budget.used.time),
      tokens: Math.max(0, this.budget.maxTokens - this.budget.used.tokens),
      requests: Math.max(0, this.budget.maxRequests - this.budget.used.requests)
    };
  }
  
  getUsagePercent(): { time: number; tokens: number; requests: number } {
    return {
      time: this.budget.used.time / this.budget.maxTime,
      tokens: this.budget.used.tokens / this.budget.maxTokens,
      requests: this.budget.used.requests / this.budget.maxRequests
    };
  }
}