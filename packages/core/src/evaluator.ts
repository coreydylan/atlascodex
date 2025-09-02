/**
 * Atlas Codex Evaluator
 * Plan critique, execution scoring, and continuous improvement
 */

import { ExecutionPlan, PlanStep } from './planner';
import { ExecutionResult } from './executor';
import { SkillRegistry } from './skill-registry';

export interface EvaluationResult {
  score: number; // 0-1
  metrics: {
    schema_validity: number;
    field_coverage: number;
    precision: number;
    determinism: number;
    cost_efficiency: number;
    freshness: number;
  };
  issues: string[];
  suggestions: string[];
  confidence: number;
}

export interface PreflightCritique {
  can_execute: boolean;
  minimal_plan: boolean;
  failure_modes: string[];
  success_test: string;
  estimated_success_rate: number;
  recommendations: string[];
}

export interface PostMortemReport {
  execution_id: string;
  plan: ExecutionPlan;
  result: ExecutionResult;
  evaluation: EvaluationResult;
  lessons: string[];
  improvement_suggestions: string[];
  should_retrain: boolean;
}

/**
 * Preflight Evaluator - validates plans before execution
 */
export class PreflightEvaluator {
  
  /**
   * Critique a plan before execution
   */
  static critique(plan: ExecutionPlan): PreflightCritique {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check if plan is minimal (no redundant steps)
    const stepNames = plan.plan.map(step => step.use);
    const uniqueSteps = new Set(stepNames);
    const minimal_plan = stepNames.length === uniqueSteps.size;
    
    if (!minimal_plan) {
      issues.push('Plan contains duplicate steps');
      recommendations.push('Remove redundant skill calls');
    }
    
    // Check for essential steps
    const hasValidation = stepNames.includes('ValidateOutput');
    const hasCitation = stepNames.includes('CiteEvidence');
    const hasNormalization = stepNames.includes('NormalizeUrl');
    
    if (!hasNormalization && plan.task.includes('http')) {
      recommendations.push('Consider adding URL normalization');
    }
    
    if (!hasValidation) {
      recommendations.push('Add output validation for reliability');
    }
    
    if (!hasCitation) {
      recommendations.push('Add evidence citations for transparency');
    }
    
    // Check for fallback strategies
    const hasAlternatives = plan.plan.some(step => step.or !== undefined);
    if (!hasAlternatives) {
      recommendations.push('Add fallback strategies for critical steps');
    }
    
    // Analyze failure modes
    const failure_modes = this.analyzeFailureModes(plan);
    
    // Generate success test
    const success_test = this.generateSuccessTest(plan);
    
    // Estimate success rate based on plan complexity and known patterns
    const estimated_success_rate = this.estimateSuccessRate(plan);
    
    return {
      can_execute: issues.length === 0,
      minimal_plan,
      failure_modes,
      success_test,
      estimated_success_rate,
      recommendations
    };
  }
  
  private static analyzeFailureModes(plan: ExecutionPlan): string[] {
    const modes: string[] = [];
    
    // Budget-related failures
    if (plan.estimated_cost.time > (plan.constraints.max_time || 30000)) {
      modes.push('Time budget exhaustion');
    }
    
    // Network-related failures
    if (plan.estimated_cost.network > 5) {
      modes.push('Rate limiting or network errors');
    }
    
    // Content-related failures
    if (plan.plan.some(step => step.use === 'DetectStructuredData')) {
      modes.push('Missing or malformed structured data');
    }
    
    // Schema-related failures
    if (plan.target_schema.required?.length > 5) {
      modes.push('Missing required fields');
    }
    
    return modes;
  }
  
  private static generateSuccessTest(plan: ExecutionPlan): string {
    const criteria = [];
    
    if (plan.constraints.max_items) {
      criteria.push(`Extract ${plan.constraints.max_items} items`);
    }
    
    if (plan.target_schema.required) {
      criteria.push(`All required fields present: ${plan.target_schema.required.join(', ')}`);
    }
    
    if (plan.constraints.quality_threshold) {
      criteria.push(`Field confidence > ${plan.constraints.quality_threshold}`);
    }
    
    return criteria.join(' AND ');
  }
  
  private static estimateSuccessRate(plan: ExecutionPlan): number {
    let score = 0.8; // Base success rate
    
    // Adjust based on plan complexity
    const complexity = plan.plan.length;
    if (complexity > 10) score -= 0.1;
    if (complexity > 15) score -= 0.1;
    
    // Adjust based on skill reliability
    const reliableSkills = ['NormalizeUrl', 'HarvestMeta', 'ValidateOutput'];
    const riskySkills = ['DetectStructuredData', 'InferSchema'];
    
    const reliableCount = plan.plan.filter(s => reliableSkills.includes(s.use)).length;
    const riskyCount = plan.plan.filter(s => riskySkills.includes(s.use)).length;
    
    score += reliableCount * 0.02;
    score -= riskyCount * 0.05;
    
    // Adjust based on fallbacks
    const fallbackCount = plan.plan.filter(s => s.or !== undefined).length;
    score += fallbackCount * 0.03;
    
    return Math.max(0.1, Math.min(0.95, score));
  }
}

/**
 * Execution Evaluator - scores completed executions
 */
export class ExecutionEvaluator {
  
  /**
   * Evaluate execution results
   */
  static evaluate(plan: ExecutionPlan, result: ExecutionResult): EvaluationResult {
    const metrics = {
      schema_validity: this.evaluateSchemaValidity(result.data, plan.target_schema),
      field_coverage: this.evaluateFieldCoverage(result.data, plan.target_schema),
      precision: this.evaluatePrecision(result),
      determinism: this.evaluateDeterminism(result),
      cost_efficiency: this.evaluateCostEfficiency(plan, result),
      freshness: this.evaluateFreshness(result.data)
    };
    
    // Weighted overall score
    const weights = {
      schema_validity: 0.25,
      field_coverage: 0.20,
      precision: 0.20,
      determinism: 0.10,
      cost_efficiency: 0.15,
      freshness: 0.10
    };
    
    const score = Object.entries(metrics).reduce((sum, [key, value]) => {
      return sum + (value * weights[key as keyof typeof weights]);
    }, 0);
    
    const issues = this.identifyIssues(metrics, result);
    const suggestions = this.generateSuggestions(metrics, plan, result);
    
    return {
      score,
      metrics,
      issues,
      suggestions,
      confidence: result.confidence
    };
  }
  
  private static evaluateSchemaValidity(data: any, schema: any): number {
    if (!data || !schema) return 0;
    
    let validFields = 0;
    let totalFields = 0;
    
    if (schema.type === 'array' && Array.isArray(data)) {
      if (data.length === 0) return 0;
      
      const itemSchema = schema.items;
      if (itemSchema?.properties) {
        for (const item of data) {
          for (const [field, fieldSchema] of Object.entries(itemSchema.properties)) {
            totalFields++;
            if (this.validateField(item[field], fieldSchema as any)) {
              validFields++;
            }
          }
        }
      }
    } else if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        totalFields++;
        if (this.validateField(data[field], fieldSchema as any)) {
          validFields++;
        }
      }
    }
    
    return totalFields > 0 ? validFields / totalFields : 0;
  }
  
  private static validateField(value: any, schema: any): boolean {
    if (schema.required && (value === undefined || value === null || value === '')) {
      return false;
    }
    
    if (value === undefined || value === null) return true; // Optional field
    
    switch (schema.type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'integer':
        return Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value);
      default:
        return true;
    }
  }
  
  private static evaluateFieldCoverage(data: any, schema: any): number {
    if (!data || !schema) return 0;
    
    const requiredFields = schema.required || [];
    if (requiredFields.length === 0) return 1;
    
    let coveredFields = 0;
    
    if (schema.type === 'array' && Array.isArray(data)) {
      if (data.length === 0) return 0;
      
      // Check coverage across all items
      for (const field of requiredFields) {
        const coverage = data.filter(item => item[field] && item[field] !== '').length / data.length;
        coveredFields += coverage;
      }
      
      return coveredFields / requiredFields.length;
    } else {
      for (const field of requiredFields) {
        if (data[field] && data[field] !== '') {
          coveredFields++;
        }
      }
      
      return coveredFields / requiredFields.length;
    }
  }
  
  private static evaluatePrecision(result: ExecutionResult): number {
    // Use trace confidence scores and citation quality
    if (result.trace.length === 0) return 0;
    
    const avgConfidence = result.trace.reduce((sum, trace) => {
      return sum + (trace.output.confidence || 0);
    }, 0) / result.trace.length;
    
    // Factor in citation quality
    const citationBonus = result.citations && result.citations.length > 0 ? 0.1 : 0;
    
    return Math.min(1, avgConfidence + citationBonus);
  }
  
  private static evaluateDeterminism(result: ExecutionResult): number {
    // Check if ranking and selection is deterministic
    // For now, assume deterministic if no random elements
    if (Array.isArray(result.data) && result.data.length > 1) {
      // Check if items have position/order indicators
      const hasPositions = result.data.every((item: any) => 
        item.position !== undefined || item._score !== undefined
      );
      return hasPositions ? 1 : 0.7;
    }
    
    return 1; // Single items are deterministic
  }
  
  private static evaluateCostEfficiency(plan: ExecutionPlan, result: ExecutionResult): number {
    const estimatedTime = plan.estimated_cost.time;
    const actualTime = result.budget_used.time;
    
    if (actualTime <= estimatedTime) {
      return 1; // Under budget
    } else {
      return Math.max(0.1, estimatedTime / actualTime);
    }
  }
  
  private static evaluateFreshness(data: any): number {
    if (!data) return 0;
    
    const now = new Date();
    
    // Check for date fields in data
    const findDates = (obj: any): Date[] => {
      const dates: Date[] = [];
      
      if (Array.isArray(obj)) {
        obj.forEach(item => dates.push(...findDates(item)));
      } else if (obj && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
          if (key.includes('date') || key.includes('Date') || key.includes('published')) {
            const date = new Date(value as string);
            if (!isNaN(date.getTime())) {
              dates.push(date);
            }
          }
          if (typeof value === 'object') {
            dates.push(...findDates(value));
          }
        });
      }
      
      return dates;
    };
    
    const dates = findDates(data);
    if (dates.length === 0) return 0.5; // No date info
    
    // Calculate average age
    const avgAge = dates.reduce((sum, date) => {
      const age = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24); // days
      return sum + age;
    }, 0) / dates.length;
    
    // Fresher is better
    if (avgAge <= 1) return 1;      // Within 1 day
    if (avgAge <= 7) return 0.8;    // Within 1 week
    if (avgAge <= 30) return 0.6;   // Within 1 month
    if (avgAge <= 90) return 0.4;   // Within 3 months
    return 0.2; // Older than 3 months
  }
  
  private static identifyIssues(metrics: EvaluationResult['metrics'], result: ExecutionResult): string[] {
    const issues: string[] = [];
    
    if (metrics.schema_validity < 0.8) {
      issues.push('Schema validation failed for multiple fields');
    }
    
    if (metrics.field_coverage < 0.7) {
      issues.push('Missing required fields in extracted data');
    }
    
    if (metrics.precision < 0.6) {
      issues.push('Low confidence in extracted field values');
    }
    
    if (metrics.cost_efficiency < 0.8) {
      issues.push('Execution exceeded estimated cost budget');
    }
    
    if (result.errors.length > 0) {
      issues.push(`Execution errors: ${result.errors.join(', ')}`);
    }
    
    return issues;
  }
  
  private static generateSuggestions(
    metrics: EvaluationResult['metrics'], 
    plan: ExecutionPlan, 
    result: ExecutionResult
  ): string[] {
    const suggestions: string[] = [];
    
    if (metrics.schema_validity < 0.8) {
      suggestions.push('Add more robust field mapping and validation');
      suggestions.push('Consider alternative data sources or extraction methods');
    }
    
    if (metrics.field_coverage < 0.7) {
      suggestions.push('Implement fallback extraction for missing fields');
      suggestions.push('Add field inference from context');
    }
    
    if (metrics.precision < 0.6) {
      suggestions.push('Add confidence thresholds and manual review flags');
      suggestions.push('Implement redundant extraction methods for verification');
    }
    
    if (metrics.cost_efficiency < 0.8) {
      suggestions.push('Optimize skill execution order');
      suggestions.push('Add caching for expensive operations');
    }
    
    if (metrics.determinism < 0.9) {
      suggestions.push('Add explicit tie-breakers for ranking');
      suggestions.push('Implement deterministic sorting criteria');
    }
    
    return suggestions;
  }
}

/**
 * Learning System - continuous improvement through feedback
 */
export class LearningSystem {
  private static executionHistory: PostMortemReport[] = [];
  
  /**
   * Record execution for learning
   */
  static recordExecution(
    plan: ExecutionPlan, 
    result: ExecutionResult, 
    evaluation: EvaluationResult
  ): PostMortemReport {
    const report: PostMortemReport = {
      execution_id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      plan,
      result,
      evaluation,
      lessons: this.extractLessons(plan, result, evaluation),
      improvement_suggestions: this.generateImprovements(plan, result, evaluation),
      should_retrain: evaluation.score < 0.7 || result.errors.length > 2
    };
    
    this.executionHistory.push(report);
    
    // Keep only recent history (last 1000 executions)
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-1000);
    }
    
    return report;
  }
  
  private static extractLessons(
    plan: ExecutionPlan, 
    result: ExecutionResult, 
    evaluation: EvaluationResult
  ): string[] {
    const lessons: string[] = [];
    
    // Successful patterns
    if (evaluation.score > 0.8) {
      const successfulSkills = result.trace
        .filter(t => t.output.confidence > 0.8)
        .map(t => t.skill);
      
      if (successfulSkills.length > 0) {
        lessons.push(`Skills with high confidence: ${successfulSkills.join(', ')}`);
      }
    }
    
    // Failed patterns
    if (evaluation.score < 0.5) {
      const failedSkills = result.trace
        .filter(t => t.errors && t.errors.length > 0)
        .map(t => t.skill);
      
      if (failedSkills.length > 0) {
        lessons.push(`Skills that frequently fail: ${failedSkills.join(', ')}`);
      }
    }
    
    // Budget insights
    if (evaluation.metrics.cost_efficiency > 0.9) {
      lessons.push('Plan was cost-efficient');
    } else {
      lessons.push('Plan exceeded expected cost');
    }
    
    return lessons;
  }
  
  private static generateImprovements(
    plan: ExecutionPlan, 
    result: ExecutionResult, 
    evaluation: EvaluationResult
  ): string[] {
    const improvements: string[] = [];
    
    // Skill ordering improvements
    const slowSkills = result.trace
      .filter(t => (t.endTime - t.startTime) > 1000)
      .map(t => t.skill);
    
    if (slowSkills.length > 0) {
      improvements.push(`Consider reordering or caching slow skills: ${slowSkills.join(', ')}`);
    }
    
    // Alternative skill suggestions
    const failedSkills = result.trace.filter(t => t.errors?.length > 0);
    for (const failed of failedSkills) {
      if (failed.skill === 'DetectStructuredData') {
        improvements.push('Consider using HarvestMeta as primary method instead of fallback');
      }
    }
    
    return improvements;
  }
  
  /**
   * Get performance analytics
   */
  static getAnalytics(): {
    avg_score: number;
    success_rate: number;
    most_reliable_skills: string[];
    common_failures: string[];
    cost_trends: any;
  } {
    if (this.executionHistory.length === 0) {
      return {
        avg_score: 0,
        success_rate: 0,
        most_reliable_skills: [],
        common_failures: [],
        cost_trends: {}
      };
    }
    
    const scores = this.executionHistory.map(r => r.evaluation.score);
    const avg_score = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    const successes = this.executionHistory.filter(r => r.result.success).length;
    const success_rate = successes / this.executionHistory.length;
    
    // Analyze skill reliability
    const skillStats = new Map<string, { successes: number; total: number }>();
    
    this.executionHistory.forEach(report => {
      report.result.trace.forEach(trace => {
        const stats = skillStats.get(trace.skill) || { successes: 0, total: 0 };
        stats.total++;
        if (!trace.errors || trace.errors.length === 0) {
          stats.successes++;
        }
        skillStats.set(trace.skill, stats);
      });
    });
    
    const most_reliable_skills = Array.from(skillStats.entries())
      .filter(([_, stats]) => stats.total >= 5) // Minimum executions
      .sort(([_, a], [__, b]) => (b.successes / b.total) - (a.successes / a.total))
      .slice(0, 5)
      .map(([skill]) => skill);
    
    // Common failure patterns
    const failures = this.executionHistory
      .filter(r => !r.result.success)
      .flatMap(r => r.result.errors);
      
    const failureCounts = failures.reduce((counts, error) => {
      counts[error] = (counts[error] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    const common_failures = Object.entries(failureCounts)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([error]) => error);
    
    return {
      avg_score,
      success_rate,
      most_reliable_skills,
      common_failures,
      cost_trends: {} // TODO: Implement cost trend analysis
    };
  }
}