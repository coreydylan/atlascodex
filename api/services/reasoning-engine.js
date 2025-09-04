/**
 * GPT-5 Deep Reasoning & Understanding Engine
 * 
 * This service provides deep reasoning capabilities for Atlas Codex extraction requests.
 * It analyzes user intent, identifies assumptions, determines optimal strategies,
 * and provides intelligent model selection for cost optimization.
 * 
 * Features:
 * - Deep intent analysis using GPT-5 reasoning mode
 * - Assumption detection and validation
 * - Extraction strategy generation with fallback plans
 * - Cost-optimized model selection (nano/mini/full)
 * - Confidence scoring and field anticipation
 */

class ReasoningEngine {
  constructor(openaiClient) {
    this.openai = openaiClient;
    this.modelCosts = {
      'gpt-5-nano': 0.05, // $0.05 per 1M input tokens
      'gpt-5-mini': 0.25, // $0.25 per 1M input tokens
      'gpt-5': 1.25       // $1.25 per 1M input tokens
    };
    this.reasoningCache = new Map(); // Cache for similar requests
  }

  /**
   * Deep analysis of user intent with GPT-5 reasoning capabilities
   * This is the core method that transforms simple requests into intelligent extraction plans
   */
  async analyzeUserIntent(userRequest, contextData = {}) {
    console.log('🧠 Starting deep intent analysis with GPT-5 reasoning');
    
    // Check cache for similar requests
    const cacheKey = this.generateCacheKey(userRequest, contextData);
    if (this.reasoningCache.has(cacheKey)) {
      console.log('💾 Using cached reasoning analysis');
      return this.reasoningCache.get(cacheKey);
    }

    const reasoningPrompt = `You are GPT-5's deep reasoning engine for Atlas Codex web extraction system. 

TASK: Analyze this user request with deep understanding and reasoning to create an optimal extraction strategy.

USER REQUEST: "${userRequest}"
CONTEXT: ${JSON.stringify(contextData, null, 2)}

DEEP REASONING ANALYSIS:
Please think step-by-step about this request and provide comprehensive analysis:

1. INTENT UNDERSTANDING:
   - What is the user really trying to accomplish?
   - What type of data are they seeking?
   - What is the underlying business/research goal?
   - Are there implicit requirements not stated?

2. ASSUMPTION IDENTIFICATION:
   - What assumptions is the user making about the data?
   - What assumptions am I making about their request?
   - What edge cases should we consider?
   - What could go wrong with naive extraction?

3. DATA STRUCTURE PREDICTION:
   - Based on the request, what fields are likely needed?
   - What data relationships should be captured?
   - What metadata would be valuable?
   - How should the data be structured for optimal use?

4. EXTRACTION COMPLEXITY ASSESSMENT:
   - How complex is this extraction task (0.0 to 1.0)?
   - Does it need simple pattern matching or deep understanding?
   - Are there formatting/parsing challenges?
   - Will it require reasoning about content?

5. STRATEGY RECOMMENDATION:
   - What's the optimal extraction approach?
   - Should we use single-page or multi-page extraction?
   - What potential failure points exist?
   - What fallback strategies are needed?

6. COST OPTIMIZATION:
   - Which GPT-5 model tier is most appropriate?
   - Can we use nano ($0.05/1M) for simple extraction?
   - Do we need mini ($0.25/1M) for standard complexity?
   - Is full GPT-5 ($1.25/1M) required for reasoning?

RESPONSE FORMAT (JSON):
{
  "understanding": {
    "primary_goal": "What user wants to accomplish",
    "data_type": "Type of data being extracted",
    "use_case": "Likely use case for this data",
    "implicit_requirements": ["things not stated but likely needed"]
  },
  "assumptions": {
    "user_assumptions": ["what user assumes about data/site"],
    "my_assumptions": ["what I'm assuming about request"],
    "risks": ["potential issues with these assumptions"],
    "validation_needed": ["what should be verified"]
  },
  "predicted_structure": {
    "essential_fields": ["required fields based on intent"],
    "valuable_fields": ["useful but optional fields"],
    "metadata_fields": ["technical metadata to include"],
    "relationships": ["how fields relate to each other"]
  },
  "complexity_assessment": {
    "overall_complexity": 0.7,
    "reasoning_required": true,
    "parsing_difficulty": "medium",
    "domain_knowledge_needed": false,
    "factors": ["what makes this complex/simple"]
  },
  "strategy": {
    "extraction_type": "single_page|multi_page|hybrid",
    "approach": "direct|iterative|analytical",
    "priority_order": ["steps in order of execution"],
    "fallback_plans": ["backup strategies if primary fails"],
    "success_criteria": ["how to measure success"]
  },
  "optimization": {
    "recommended_model": "gpt-5-nano|gpt-5-mini|gpt-5",
    "cost_justification": "why this model tier",
    "token_estimate": 1000,
    "estimated_cost": 0.001,
    "alternatives": ["other viable model choices"]
  },
  "confidence": {
    "understanding_confidence": 0.95,
    "strategy_confidence": 0.85,
    "success_probability": 0.90,
    "uncertainty_factors": ["what could affect success"]
  }
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o', // Using GPT-4o until GPT-5 is available
        messages: [
          {
            role: 'system',
            content: 'You are a deep reasoning engine that analyzes web extraction requests with comprehensive understanding. Use step-by-step reasoning to create optimal extraction strategies. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: reasoningPrompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Balance between consistency and creativity
        max_tokens: 2000
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      // Cache the result for similar future requests
      this.reasoningCache.set(cacheKey, analysis);
      
      // Clean cache if it gets too large
      if (this.reasoningCache.size > 100) {
        const firstKey = this.reasoningCache.keys().next().value;
        this.reasoningCache.delete(firstKey);
      }

      console.log('✅ Deep intent analysis completed');
      return analysis;

    } catch (error) {
      console.error('❌ Deep reasoning failed:', error.message);
      // Fallback to basic analysis
      return this.generateBasicAnalysis(userRequest, contextData);
    }
  }

  /**
   * Generate extraction strategy based on deep reasoning analysis
   */
  async generateExtractionStrategy(intentAnalysis, urlData = {}) {
    console.log('🎯 Generating extraction strategy from reasoning analysis');

    const strategy = {
      type: intentAnalysis.strategy.extraction_type,
      model: intentAnalysis.optimization.recommended_model,
      approach: intentAnalysis.strategy.approach,
      
      // Core extraction parameters
      extraction_config: {
        url: urlData.url || '',
        instructions: this.enhanceExtractionInstructions(intentAnalysis),
        expected_fields: intentAnalysis.predicted_structure.essential_fields,
        optional_fields: intentAnalysis.predicted_structure.valuable_fields,
        metadata_fields: intentAnalysis.predicted_structure.metadata_fields
      },

      // Multi-page configuration if needed
      navigation_config: intentAnalysis.strategy.extraction_type === 'multi_page' ? {
        max_pages: this.determineCrawlScope(intentAnalysis),
        depth: this.determineCrawlDepth(intentAnalysis),
        follow_patterns: this.generateNavigationPatterns(intentAnalysis),
        stop_conditions: this.generateStopConditions(intentAnalysis)
      } : null,

      // Fallback strategies
      fallback_chain: [
        {
          trigger: 'primary_failure',
          action: 'retry_with_higher_model',
          config: { model: this.getNextModelTier(intentAnalysis.optimization.recommended_model) }
        },
        {
          trigger: 'structure_mismatch',
          action: 'adaptive_schema_generation',
          config: { allow_flexible_schema: true }
        },
        {
          trigger: 'timeout',
          action: 'single_page_fallback',
          config: { simplified_extraction: true }
        }
      ],

      // Quality assurance
      validation: {
        confidence_threshold: 0.8,
        required_field_coverage: 0.9,
        max_empty_results: 0.1,
        enable_self_correction: true
      },

      // Performance optimization  
      performance: {
        estimated_tokens: intentAnalysis.optimization.token_estimate,
        estimated_cost: intentAnalysis.optimization.estimated_cost,
        timeout_seconds: this.calculateTimeout(intentAnalysis),
        parallel_processing: intentAnalysis.strategy.extraction_type === 'multi_page'
      }
    };

    return strategy;
  }

  /**
   * Select the most cost-effective model based on complexity analysis
   */
  selectOptimalModel(complexity, requirements = {}) {
    console.log(`🎛️ Selecting optimal model for complexity: ${complexity}`);

    // Model selection logic based on GPT-5 revolution analysis
    if (complexity <= 0.3 && !requirements.reasoning_required) {
      return {
        model: 'gpt-5-nano',
        justification: 'Simple extraction, pattern-based, cost-optimized',
        cost_per_1m: this.modelCosts['gpt-5-nano'],
        use_cases: ['product prices', 'simple lists', 'basic contact info']
      };
    }

    if (complexity <= 0.7 && !requirements.deep_reasoning) {
      return {
        model: 'gpt-5-mini', 
        justification: 'Standard extraction with moderate complexity',
        cost_per_1m: this.modelCosts['gpt-5-mini'],
        use_cases: ['article extraction', 'structured data', 'moderate analysis']
      };
    }

    return {
      model: 'gpt-5',
      justification: 'Complex reasoning required, accuracy critical',
      cost_per_1m: this.modelCosts['gpt-5'],
      use_cases: ['comparative analysis', 'content understanding', 'complex reasoning']
    };
  }

  /**
   * Transform user request into AI-optimized extraction request
   * This is the main interface used by ai-processor-v5.js
   */
  async transformRequest(userInput, contextData = {}) {
    console.log('🔄 Transforming user request with deep reasoning');

    try {
      // Step 1: Deep intent analysis
      const intentAnalysis = await this.analyzeUserIntent(userInput, contextData);

      // Step 2: Generate extraction strategy
      const strategy = await this.generateExtractionStrategy(intentAnalysis, contextData);

      // Step 3: Create enhanced extraction request
      const transformedRequest = {
        // Original request data
        original_input: userInput,
        
        // Deep understanding results
        understanding: intentAnalysis.understanding,
        assumptions: intentAnalysis.assumptions,
        confidence: intentAnalysis.confidence,
        
        // Extraction configuration
        url: contextData.url || this.extractUrl(userInput),
        type: strategy.type === 'multi_page' ? 'crawl' : 'scrape',
        model: strategy.model,
        
        // Enhanced extraction parameters
        params: {
          extractionInstructions: strategy.extraction_config.instructions,
          expected_fields: strategy.extraction_config.expected_fields,
          optional_fields: strategy.extraction_config.optional_fields,
          outputSchema: this.generateSchema(intentAnalysis.predicted_structure),
          
          // Multi-page specific
          ...(strategy.navigation_config ? {
            maxPages: strategy.navigation_config.max_pages,
            maxDepth: strategy.navigation_config.depth,
            includeSubdomains: false,
            onlyMainContent: true
          } : {}),
          
          // Processing options
          waitFor: 2000,
          timeout: strategy.performance.timeout_seconds * 1000
        },

        // Strategy and fallbacks
        extraction_strategy: strategy.approach,
        fallback_plan: strategy.fallback_chain.map(f => f.action),
        
        // Predictions and optimization
        predicted_fields: intentAnalysis.predicted_structure.essential_fields,
        cost_estimate: strategy.performance.estimated_cost,
        processing_complexity: intentAnalysis.complexity_assessment.overall_complexity,

        // Quality metrics
        expected_confidence: intentAnalysis.confidence.success_probability,
        validation_rules: strategy.validation,

        // Explanation for user
        reasoning: {
          understood: intentAnalysis.understanding.primary_goal,
          assumptions: intentAnalysis.assumptions.user_assumptions,
          strategy_reason: `Using ${strategy.model} for ${strategy.approach} extraction`,
          confidence: intentAnalysis.confidence.understanding_confidence
        }
      };

      console.log('✅ Request transformation completed');
      return transformedRequest;

    } catch (error) {
      console.error('❌ Request transformation failed:', error.message);
      // Fallback to basic transformation
      return this.generateBasicTransformation(userInput, contextData);
    }
  }

  /**
   * Helper: Generate cache key for request memoization
   */
  generateCacheKey(userRequest, contextData) {
    const normalized = userRequest.toLowerCase().replace(/\s+/g, ' ').trim();
    const contextHash = JSON.stringify(contextData);
    return `${normalized}_${contextHash}`.substring(0, 100);
  }

  /**
   * Helper: Extract URL from user request
   */
  extractUrl(userInput) {
    const urlMatch = userInput.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s]*)?)/);
    if (urlMatch) {
      let url = urlMatch[0];
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      return url;
    }
    return '';
  }

  /**
   * Helper: Enhance extraction instructions based on intent analysis
   */
  enhanceExtractionInstructions(intentAnalysis) {
    const baseGoal = intentAnalysis.understanding.primary_goal;
    const essentialFields = intentAnalysis.predicted_structure.essential_fields;
    const assumptions = intentAnalysis.assumptions.user_assumptions;

    return `${baseGoal}. Extract all instances with focus on: ${essentialFields.join(', ')}. 
    Consider: ${assumptions.join(', ')}. 
    Ensure complete coverage and accurate field mapping.`;
  }

  /**
   * Helper: Generate JSON schema from predicted structure
   */
  generateSchema(predictedStructure) {
    const properties = {};
    
    // Add essential fields as required
    predictedStructure.essential_fields.forEach(field => {
      properties[field] = { type: 'string' };
    });

    // Add valuable fields as optional
    predictedStructure.valuable_fields.forEach(field => {
      properties[field] = { type: 'string' };
    });

    // Add metadata fields
    predictedStructure.metadata_fields.forEach(field => {
      properties[field] = { type: 'string' };
    });

    return {
      type: 'array',
      items: {
        type: 'object',
        properties: properties,
        required: predictedStructure.essential_fields,
        additionalProperties: false
      },
      minItems: 1
    };
  }

  /**
   * Helper: Calculate appropriate timeout based on complexity
   */
  calculateTimeout(intentAnalysis) {
    const baseTimeout = 30; // seconds
    const complexity = intentAnalysis.complexity_assessment.overall_complexity;
    const isMultiPage = intentAnalysis.strategy.extraction_type === 'multi_page';
    
    let timeout = baseTimeout + (complexity * 30);
    if (isMultiPage) timeout *= 2;
    
    return Math.min(timeout, 300); // Max 5 minutes
  }

  /**
   * Fallback: Basic analysis when deep reasoning fails
   */
  generateBasicAnalysis(userRequest, contextData) {
    console.log('🔄 Using basic analysis fallback');
    
    return {
      understanding: {
        primary_goal: 'Extract data as requested',
        data_type: 'structured',
        use_case: 'data_extraction',
        implicit_requirements: []
      },
      assumptions: {
        user_assumptions: ['Data is available on page'],
        my_assumptions: ['Standard extraction will work'],
        risks: ['Complex site structure'],
        validation_needed: ['Page accessibility']
      },
      predicted_structure: {
        essential_fields: ['title', 'content'],
        valuable_fields: ['url', 'date'],
        metadata_fields: ['extracted_at'],
        relationships: []
      },
      complexity_assessment: {
        overall_complexity: 0.5,
        reasoning_required: false,
        parsing_difficulty: 'medium',
        domain_knowledge_needed: false,
        factors: ['unknown']
      },
      strategy: {
        extraction_type: 'single_page',
        approach: 'direct',
        priority_order: ['extract', 'validate'],
        fallback_plans: ['retry'],
        success_criteria: ['non_empty_results']
      },
      optimization: {
        recommended_model: 'gpt-5-mini',
        cost_justification: 'standard complexity',
        token_estimate: 1000,
        estimated_cost: 0.00025,
        alternatives: ['gpt-5-nano']
      },
      confidence: {
        understanding_confidence: 0.7,
        strategy_confidence: 0.7,
        success_probability: 0.8,
        uncertainty_factors: ['no_deep_analysis']
      }
    };
  }

  /**
   * Fallback: Basic transformation when deep reasoning fails
   */
  generateBasicTransformation(userInput, contextData) {
    return {
      original_input: userInput,
      url: this.extractUrl(userInput) || contextData.url || '',
      type: 'scrape',
      model: 'gpt-5-mini',
      params: {
        extractionInstructions: userInput,
        onlyMainContent: true,
        waitFor: 2000
      },
      reasoning: {
        understood: 'Basic extraction request',
        assumptions: ['Standard page structure'],
        confidence: 0.7
      },
      fallback_plan: ['retry', 'simplify'],
      cost_estimate: 0.00025
    };
  }

  /**
   * Helper methods for strategy generation
   */
  determineCrawlScope(intentAnalysis) {
    const complexity = intentAnalysis.complexity_assessment.overall_complexity;
    if (complexity > 0.8) return 50;
    if (complexity > 0.6) return 25;
    return 10;
  }

  determineCrawlDepth(intentAnalysis) {
    return intentAnalysis.understanding.primary_goal.includes('comprehensive') ? 3 : 2;
  }

  generateNavigationPatterns(intentAnalysis) {
    return ['next', 'more', 'continue', 'page'];
  }

  generateStopConditions(intentAnalysis) {
    return ['no_more_pages', 'max_pages_reached', 'duplicate_content'];
  }

  getNextModelTier(currentModel) {
    const tiers = ['gpt-5-nano', 'gpt-5-mini', 'gpt-5'];
    const currentIndex = tiers.indexOf(currentModel);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : 'gpt-5';
  }
}

module.exports = { ReasoningEngine };