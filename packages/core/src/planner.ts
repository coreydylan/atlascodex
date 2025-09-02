/**
 * Atlas Codex Planner
 * Generates skill-based execution plans for extraction tasks
 */

import { SkillRegistry } from './skill-registry';

export interface ExtractionTask {
  description: string;
  url: string;
  intent: 'collect' | 'analyze' | 'monitor' | 'classify';
  domain?: 'news' | 'commerce' | 'events' | 'generic';
  targetType?: string;
}

export interface ExtractionConstraints {
  max_items?: number;
  max_time?: number; // ms
  max_requests?: number;
  dedupe_key?: string;
  recency_days?: number;
  deterministic_order?: string;
  quality_threshold?: number; // 0-1
}

export interface ExecutionPlan {
  task: string;
  target_schema: any;
  constraints: ExtractionConstraints;
  plan: PlanStep[];
  estimated_cost: {
    network: number;
    cpu: string;
    tokens: string;
    time: number;
  };
  success_criteria: string[];
  failure_modes: string[];
  fallback_strategies: string[];
}

export interface PlanStep {
  use: string; // skill name
  with?: Record<string, any>; // parameters
  if?: string; // condition
  or?: PlanStep; // alternative
  if_missing?: string[]; // fields that trigger this step
  repair?: boolean;
}

/**
 * System prompt for the AI Planner
 */
export const PLANNER_SYSTEM_PROMPT = `You plan extractions by composing skills from a registry.
Your outputs must be executable plans that maximize accuracy per unit cost.
You never rely on site-specific rules. You select abstract schemas (news.article, commerce.review, events.listing…) and map fields.
You must produce: target_schema, constraints, and a plan of skill calls.
You must run a preflight critique: name likely failure modes and the fallback branch.
Determinism matters: ranking/ties must be specified.
Confidence matters: plan to compute per-field confidence and return citations.
If the task is impossible within budget, return a narrower plan and explain tradeoffs.

Available skills: ${SkillRegistry.list().join(', ')}

Output format must be valid JSON matching ExecutionPlan interface.

Planning principles:
1. Start with URL normalization and link discovery
2. Route content type to select appropriate schema
3. Prioritize by context and fetch efficiently  
4. Extract structured data first, fallback to meta harvesting
5. Map fields with confidence scoring
6. Validate, rank, and cite evidence
7. Always include fallback strategies for each failure mode

Examples:
- For "collect top news articles": Use news.article schema, DiscoverLinks → RouteDomain → PrioritizeByContext → DetectStructuredData → MapFields → RankItems
- For "analyze product reviews": Use commerce.review schema, focus on rating/review extraction
- For "monitor event listings": Use events.listing schema, emphasize date/location fields`;

/**
 * Pre-built plan templates for common tasks
 */
export const PlanTemplates = {
  'news_articles': {
    target_schema: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'url'],
        properties: {
          title: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          summary: { type: 'string' },
          author: { type: 'string' },
          section: { type: 'string' },
          datePublished: { type: 'string', format: 'date-time' },
          image: { type: 'string', format: 'uri' }
        }
      }
    },
    plan: [
      { use: 'NormalizeUrl' },
      { use: 'DiscoverLinks', with: { source: 'PAGE', scope: 'document' } },
      { use: 'RouteDomain', with: { classes: ['article', 'product', 'nav', 'legal'], prefer: 'article' } },
      { use: 'PrioritizeByContext', with: { limit: 40 } },
      { use: 'DetectStructuredData', or: { use: 'HarvestMeta' } },
      { use: 'InferSchema', with: { hint: 'news/article' } },
      { use: 'MapFields', with: { to: 'target_schema' } },
      { use: 'RankItems' },
      { use: 'ValidateOutput', repair: true },
      { use: 'CiteEvidence' }
    ],
    success_criteria: [
      'At least 5 articles extracted',
      'All required fields (title, url) present',
      'Articles ranked by relevance/recency',
      'Field confidence > 0.7 average'
    ],
    failure_modes: [
      'No articles found on page',
      'Structured data malformed',
      'Rate limiting or fetch errors'
    ],
    fallback_strategies: [
      'If structured data fails: use meta tag extraction',
      'If no articles found: expand search to linked pages',
      'If rate limited: return partial results with citations'
    ]
  },

  'product_catalog': {
    target_schema: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'price'],
        properties: {
          name: { type: 'string' },
          price: { type: 'string' },
          currency: { type: 'string' },
          rating: { type: 'number' },
          reviews: { type: 'integer' },
          image: { type: 'string', format: 'uri' },
          availability: { type: 'string' }
        }
      }
    },
    plan: [
      { use: 'NormalizeUrl' },
      { use: 'DiscoverLinks', with: { source: 'PAGE', scope: 'product-listings' } },
      { use: 'RouteDomain', with: { classes: ['product', 'listing'], prefer: 'product' } },
      { use: 'DetectStructuredData', or: { use: 'HarvestMeta' } },
      { use: 'InferSchema', with: { hint: 'commerce/product' } },
      { use: 'MapFields', with: { to: 'target_schema' } },
      { use: 'RankItems' },
      { use: 'ValidateOutput', repair: true },
      { use: 'CiteEvidence' }
    ],
    success_criteria: [
      'Products have name and price',
      'Price format is consistent',
      'Rating/review data when available'
    ]
  }
};

/**
 * Rule-based Planner (fallback when AI unavailable)
 */
export class RulePlanner {
  static generatePlan(task: ExtractionTask, constraints: ExtractionConstraints = {}): ExecutionPlan {
    // Detect task type from description and URL
    const description = task.description.toLowerCase();
    const url = task.url.toLowerCase();
    
    let templateKey = 'news_articles'; // default
    
    // Task classification
    if (description.includes('article') || description.includes('news') || url.includes('news')) {
      templateKey = 'news_articles';
    } else if (description.includes('product') || description.includes('shop') || description.includes('buy')) {
      templateKey = 'product_catalog';
    }
    
    const template = PlanTemplates[templateKey];
    if (!template) {
      throw new Error(`No template found for task type: ${templateKey}`);
    }
    
    // Calculate estimated cost
    const estimatedCost = {
      network: 3, // URL fetch + potential sub-fetches
      cpu: 'medium',
      tokens: 'low',
      time: 5000 // 5 seconds
    };
    
    // Apply constraints to template
    const plan: ExecutionPlan = {
      task: task.description,
      target_schema: template.target_schema,
      constraints: {
        max_items: constraints.max_items || 10,
        max_time: constraints.max_time || 30000,
        max_requests: constraints.max_requests || 5,
        dedupe_key: constraints.dedupe_key || 'url',
        deterministic_order: constraints.deterministic_order || 'page_order_then_date_desc',
        quality_threshold: constraints.quality_threshold || 0.7,
        ...constraints
      },
      plan: template.plan,
      estimated_cost: estimatedCost,
      success_criteria: template.success_criteria || [
        'Required fields present',
        'Results within quality threshold',
        'Execution under time budget'
      ],
      failure_modes: template.failure_modes || [
        'Network timeout',
        'Content structure changed',
        'Rate limiting'
      ],
      fallback_strategies: template.fallback_strategies || [
        'Return partial results',
        'Use alternative extraction methods',
        'Flag for manual review'
      ]
    };
    
    return plan;
  }
  
  /**
   * Preflight critique - validate plan before execution
   */
  static critique(plan: ExecutionPlan): {
    canExecute: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Check budget feasibility
    if (plan.estimated_cost.time > (plan.constraints.max_time || 30000)) {
      issues.push('Estimated time exceeds budget');
      suggestions.push('Reduce max_items or increase time budget');
    }
    
    // Check plan completeness
    const hasNormalization = plan.plan.some(step => step.use === 'NormalizeUrl');
    const hasValidation = plan.plan.some(step => step.use === 'ValidateOutput');
    const hasCitations = plan.plan.some(step => step.use === 'CiteEvidence');
    
    if (!hasNormalization) {
      issues.push('Plan missing URL normalization');
    }
    if (!hasValidation) {
      suggestions.push('Consider adding output validation');
    }
    if (!hasCitations) {
      suggestions.push('Consider adding evidence citations');
    }
    
    // Check for fallback strategies
    const hasAlternatives = plan.plan.some(step => step.or !== undefined);
    if (!hasAlternatives) {
      suggestions.push('Add fallback strategies for critical steps');
    }
    
    return {
      canExecute: issues.length === 0,
      issues,
      suggestions
    };
  }
}

/**
 * AI-powered Planner (when OpenAI available)
 */
export class AiPlanner {
  constructor(private apiKey: string) {}
  
  async generatePlan(task: ExtractionTask, constraints: ExtractionConstraints = {}): Promise<ExecutionPlan> {
    if (!this.apiKey) {
      console.log('No OpenAI key, falling back to rule-based planning');
      return RulePlanner.generatePlan(task, constraints);
    }
    
    const prompt = `Generate an extraction plan for this task:
Task: ${task.description}
URL: ${task.url}
Intent: ${task.intent}
Domain: ${task.domain || 'generic'}

Constraints:
${JSON.stringify(constraints, null, 2)}

Skills available:
${SkillRegistry.skills.map(s => `${s.name}: ${s.description}`).join('\n')}`;
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'system', content: PLANNER_SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1500,
          response_format: { type: 'json_object' }
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json();
      const plan = JSON.parse(data.choices[0].message.content);
      
      // Validate and enhance the AI-generated plan
      return this.enhancePlan(plan, task, constraints);
      
    } catch (error) {
      console.error('AI planning failed:', error);
      return RulePlanner.generatePlan(task, constraints);
    }
  }
  
  private enhancePlan(aiPlan: any, task: ExtractionTask, constraints: ExtractionConstraints): ExecutionPlan {
    // Ensure required fields
    const plan: ExecutionPlan = {
      task: task.description,
      target_schema: aiPlan.target_schema || PlanTemplates.news_articles.target_schema,
      constraints: { ...constraints, ...aiPlan.constraints },
      plan: aiPlan.plan || [],
      estimated_cost: aiPlan.estimated_cost || { network: 3, cpu: 'medium', tokens: 'low', time: 5000 },
      success_criteria: aiPlan.success_criteria || ['Task completed successfully'],
      failure_modes: aiPlan.failure_modes || ['Unknown error'],
      fallback_strategies: aiPlan.fallback_strategies || ['Return partial results']
    };
    
    return plan;
  }
}