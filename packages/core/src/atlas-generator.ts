/**
 * Atlas Codex Generator
 * The main orchestrator that ties together planning, execution, and learning
 */

import { ExtractionTask, RulePlanner, AiPlanner, ExecutionPlan } from './planner';
import { PlanExecutor, ExecutionResult, ExecutionOptions } from './executor';
import { PreflightEvaluator, ExecutionEvaluator, LearningSystem } from './evaluator';

export interface GeneratorOptions extends ExecutionOptions {
  openai_api_key?: string;
  use_ai_planner?: boolean;
  preflight_critique?: boolean;
  record_for_learning?: boolean;
  return_trace?: boolean;
}

export interface GeneratorResult {
  success: boolean;
  data: any;
  confidence: number;
  execution_time: number;
  plan_used: ExecutionPlan;
  evaluation?: {
    score: number;
    issues: string[];
    suggestions: string[];
  };
  trace?: any[];
  citations?: any[];
  errors: string[];
}

/**
 * Atlas Generator - The main extraction orchestrator
 * Implements the skill-based, learning architecture
 */
export class AtlasGenerator {
  private aiPlanner?: AiPlanner;
  private executor: PlanExecutor;
  
  constructor(private options: GeneratorOptions = {}) {
    // Initialize AI planner if key provided
    if (options.openai_api_key && options.use_ai_planner !== false) {
      this.aiPlanner = new AiPlanner(options.openai_api_key);
    }
    
    // Initialize executor with options
    this.executor = new PlanExecutor({
      max_time: options.max_time,
      max_tokens: options.max_tokens,
      max_requests: options.max_requests,
      return_partial: options.return_partial,
      cache_enabled: options.cache_enabled,
      debug: options.debug
    });
  }
  
  /**
   * Main extraction method - handles the full pipeline
   */
  async extract(task: ExtractionTask, input: { url: string; html?: string }): Promise<GeneratorResult> {
    const startTime = Date.now();
    let plan: ExecutionPlan;
    let result: ExecutionResult;
    
    try {
      // Step 1: Generate execution plan
      console.log(`🎯 Planning extraction: ${task.description}`);
      
      if (this.aiPlanner) {
        plan = await this.aiPlanner.generatePlan(task, {
          max_items: 10,
          max_time: this.options.max_time,
          quality_threshold: 0.7,
          deterministic_order: 'page_order_then_date_desc'
        });
      } else {
        plan = RulePlanner.generatePlan(task, {
          max_items: 10,
          max_time: this.options.max_time,
          quality_threshold: 0.7
        });
      }
      
      console.log(`📋 Generated plan with ${plan.plan.length} steps`);
      
      // Step 2: Preflight critique (if enabled)
      if (this.options.preflight_critique !== false) {
        const critique = PreflightEvaluator.critique(plan);
        
        if (!critique.can_execute) {
          return {
            success: false,
            data: null,
            confidence: 0,
            execution_time: Date.now() - startTime,
            plan_used: plan,
            errors: ['Preflight critique failed', ...critique.recommendations]
          };
        }
        
        if (critique.recommendations.length > 0) {
          console.log(`⚠️ Preflight recommendations: ${critique.recommendations.join(', ')}`);
        }
        
        console.log(`✅ Preflight passed - estimated success rate: ${Math.round(critique.estimated_success_rate * 100)}%`);
      }
      
      // Step 3: Execute plan
      console.log(`🚀 Executing plan...`);
      result = await this.executor.execute(plan, input);
      
      const executionTime = Date.now() - startTime;
      console.log(`⏱️ Execution completed in ${executionTime}ms`);
      
      // Step 4: Evaluate results
      const evaluation = ExecutionEvaluator.evaluate(plan, result);
      console.log(`📊 Evaluation score: ${Math.round(evaluation.score * 100)}%`);
      
      if (evaluation.issues.length > 0) {
        console.log(`❌ Issues found: ${evaluation.issues.join(', ')}`);
      }
      
      // Step 5: Record for learning (if enabled)
      if (this.options.record_for_learning !== false) {
        const report = LearningSystem.recordExecution(plan, result, evaluation);
        
        if (report.should_retrain) {
          console.log(`🎓 Flagged for retraining due to low performance`);
        }
      }
      
      // Step 6: Format response
      const response: GeneratorResult = {
        success: result.success,
        data: result.data,
        confidence: result.confidence,
        execution_time: executionTime,
        plan_used: plan,
        evaluation: {
          score: evaluation.score,
          issues: evaluation.issues,
          suggestions: evaluation.suggestions
        },
        errors: result.errors
      };
      
      // Include trace if requested
      if (this.options.return_trace) {
        response.trace = result.trace;
      }
      
      // Include citations
      if (result.citations) {
        response.citations = result.citations;
      }
      
      return response;
      
    } catch (error) {
      console.error(`💥 Generator failed:`, error);
      
      return {
        success: false,
        data: null,
        confidence: 0,
        execution_time: Date.now() - startTime,
        plan_used: plan!,
        errors: [error.message]
      };
    }
  }
  
  /**
   * Convenience method for common extraction patterns
   */
  async extractArticles(url: string, options?: { max_items?: number; html?: string }): Promise<GeneratorResult> {
    return this.extract({
      description: `Extract top ${options?.max_items || 10} news articles`,
      url,
      intent: 'collect',
      domain: 'news',
      targetType: 'news.article'
    }, {
      url,
      html: options?.html
    });
  }
  
  async extractProducts(url: string, options?: { max_items?: number; html?: string }): Promise<GeneratorResult> {
    return this.extract({
      description: `Extract product listings with prices`,
      url,
      intent: 'collect',
      domain: 'commerce',
      targetType: 'commerce.product'
    }, {
      url,
      html: options?.html
    });
  }
  
  /**
   * Get system analytics and performance metrics
   */
  getAnalytics() {
    return LearningSystem.getAnalytics();
  }
  
  /**
   * Update generator configuration
   */
  updateConfig(options: Partial<GeneratorOptions>) {
    this.options = { ...this.options, ...options };
    
    // Reinitialize AI planner if key changed
    if (options.openai_api_key && options.use_ai_planner !== false) {
      this.aiPlanner = new AiPlanner(options.openai_api_key);
    } else if (options.use_ai_planner === false) {
      this.aiPlanner = undefined;
    }
    
    // Update executor options
    this.executor = new PlanExecutor({
      max_time: this.options.max_time,
      max_tokens: this.options.max_tokens,
      max_requests: this.options.max_requests,
      return_partial: this.options.return_partial,
      cache_enabled: this.options.cache_enabled,
      debug: this.options.debug
    });
  }
}

/**
 * Factory function for creating Atlas generators
 */
export function createAtlasGenerator(options: GeneratorOptions = {}): AtlasGenerator {
  return new AtlasGenerator(options);
}

/**
 * Default configured generator for immediate use
 */
export const atlas = createAtlasGenerator({
  max_time: 30000,
  max_tokens: 5000,
  max_requests: 10,
  return_partial: true,
  cache_enabled: true,
  preflight_critique: true,
  record_for_learning: true,
  debug: false
});

/**
 * Example usage:
 * 
 * // Simple usage
 * const result = await atlas.extractArticles('https://nytimes.com');
 * 
 * // Custom task
 * const result = await atlas.extract({
 *   description: 'Extract top 5 tech articles from homepage',
 *   url: 'https://techcrunch.com',
 *   intent: 'collect',
 *   domain: 'news'
 * }, { url: 'https://techcrunch.com' });
 * 
 * // With AI planning
 * const smartAtlas = createAtlasGenerator({
 *   openai_api_key: 'sk-...',
 *   use_ai_planner: true,
 *   debug: true
 * });
 * 
 * const result = await smartAtlas.extract(task, input);
 */