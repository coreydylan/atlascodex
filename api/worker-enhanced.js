// Atlas Codex Enhanced Worker - Full extraction functionality with skill-based processing
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const cheerio = require('cheerio');

// Initialize clients
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });

// =============================================================================
// ATLAS CODEX LEARNING EXTRACTION SYSTEM (CommonJS)
// Plan DSL → Skills → Traces → Evaluators → Learning Loop
// =============================================================================

/**
 * Plan DSL v0.1 - Tiny JSON structure representing skill execution plans
 * 
 * Example plan:
 * {
 *   "task_id": "extract_people_vmota",
 *   "budget": { "max_tokens": 1000, "max_time": 10000, "max_requests": 3 },
 *   "steps": [
 *     { "skill": "PreserveStructure", "params": { "html_input": true } },
 *     { "skill": "DiscoverBlocks", "params": { "min_size": 50 } },
 *     { "skill": "DetectStructuredData", "fallback": "HarvestMeta" },
 *     { "skill": "MapFields", "params": { "target_schema": {...}, "confidence_threshold": 0.7 } },
 *     { "skill": "ValidateOutput", "params": { "repair": true } },
 *     { "skill": "CiteEvidence" },
 *     { "skill": "RankResults", "params": { "tie_breaker": "page_order_then_confidence" } }
 *   ],
 *   "constraints": {
 *     "deterministic_order": true,
 *     "max_results": 10,
 *     "required_fields": ["name"],
 *     "quality_threshold": 0.7
 *   }
 * }
 */

/**
 * Atomic Skills Registry - Each skill has clear inputs/outputs/costs/failure modes
 */
const SKILLS_REGISTRY = {
  'PreserveStructure': {
    description: 'Load HTML into DOM structure for semantic analysis',
    inputs: ['html'],
    outputs: ['dom_structure', 'semantic_regions', 'page_title'],
    cost: { tokens: 0, requests: 0, cpu: 'low' },
    preconditions: ['html_available'],
    postconditions: ['dom_loaded'],
    failure_modes: ['malformed_html', 'too_large'],
    repair_options: ['text_fallback']
  },
  
  'DiscoverBlocks': {
    description: 'Extract semantic blocks with DOM context and relevance scoring',
    inputs: ['dom_structure'],
    outputs: ['semantic_blocks', 'block_count'],
    cost: { tokens: 0, requests: 0, cpu: 'medium' },
    preconditions: ['dom_loaded'],
    postconditions: ['blocks_identified'],
    failure_modes: ['no_clear_blocks', 'too_fragmented'],
    repair_options: ['merge_small_blocks', 'text_fallback']
  },
  
  'DetectStructuredData': {
    description: 'Extract JSON-LD, microdata, or other structured markup',
    inputs: ['html', 'target_schema'],
    outputs: ['structured_data', 'data_confidence'],
    cost: { tokens: 0, requests: 0, cpu: 'low' },
    preconditions: ['html_available'],
    postconditions: ['structured_data_found'],
    failure_modes: ['no_structured_data', 'schema_mismatch'],
    repair_options: ['HarvestMeta']
  },
  
  'HarvestMeta': {
    description: 'Extract OpenGraph, Twitter Cards, and meta tag data',
    inputs: ['html'],
    outputs: ['meta_data', 'meta_confidence'],
    cost: { tokens: 0, requests: 0, cpu: 'low' },
    preconditions: ['html_available'],
    postconditions: ['meta_extracted'],
    failure_modes: ['no_meta_tags'],
    repair_options: ['dom_fallback']
  },
  
  'MapFields': {
    description: 'Schema-guided field mapping from semantic blocks to target schema',
    inputs: ['semantic_blocks', 'structured_data', 'meta_data', 'target_schema'],
    outputs: ['field_mappings', 'mapping_confidence'],
    cost: { tokens: 'medium', requests: 0, cpu: 'high' },
    preconditions: ['blocks_identified', 'schema_available'],
    postconditions: ['fields_mapped'],
    failure_modes: ['insufficient_data', 'ambiguous_mapping'],
    repair_options: ['expand_search', 'lower_threshold']
  },
  
  'ValidateOutput': {
    description: 'Check output against schema and quality constraints',
    inputs: ['field_mappings', 'target_schema', 'constraints'],
    outputs: ['validation_results', 'repaired_output'],
    cost: { tokens: 0, requests: 0, cpu: 'low' },
    preconditions: ['fields_mapped'],
    postconditions: ['output_validated'],
    failure_modes: ['validation_failed'],
    repair_options: ['field_expansion', 'constraint_relaxation']
  },
  
  'CiteEvidence': {
    description: 'Generate citations linking output fields to source content',
    inputs: ['field_mappings', 'html', 'content_blocks'],
    outputs: ['citations', 'evidence_strength'],
    cost: { tokens: 0, requests: 0, cpu: 'medium' },
    preconditions: ['fields_mapped'],
    postconditions: ['evidence_cited'],
    failure_modes: ['no_clear_source'],
    repair_options: ['approximate_citation']
  },
  
  'RankResults': {
    description: 'Rank and order results by confidence, completeness, and tie-breakers',
    inputs: ['field_mappings', 'mapping_confidence', 'constraints'],
    outputs: ['ranked_results', 'ranking_reasons'],
    cost: { tokens: 0, requests: 0, cpu: 'low' },
    preconditions: ['fields_mapped'],
    postconditions: ['results_ranked'],
    failure_modes: ['tie_breaking_failed'],
    repair_options: ['default_order']
  }
};

/**
 * Plan Executor - Runs skill plans step by step, logging traces for learning
 */
class PlanExecutor {
  constructor() {
    this.context = new Map(); // Shared execution context
    this.trace = []; // Full execution trace for learning
    this.budgetUsed = { tokens: 0, requests: 0, time: 0 };
    this.startTime = Date.now();
  }
  
  async executePlan(plan, initialInputs = {}) {
    console.log('🎯 Executing plan with', plan.steps?.length || 0, 'steps');
    
    // Initialize context with inputs
    Object.entries(initialInputs).forEach(([key, value]) => {
      this.context.set(key, value);
    });
    
    this.logTrace('plan_start', { plan_id: plan.task_id, budget: plan.budget });
    
    try {
      // Execute each step in sequence
      for (const [stepIndex, step] of (plan.steps || []).entries()) {
        const stepResult = await this.executeStep(step, stepIndex);
        
        if (!stepResult.success && !step.fallback) {
          this.logTrace('plan_failed', { step_index: stepIndex, error: stepResult.error });
          return this.createResult(false, null, stepResult.error);
        }
        
        // Handle fallback if step failed
        if (!stepResult.success && step.fallback) {
          console.log(`⚠️ Step ${stepIndex} failed, trying fallback: ${step.fallback}`);
          const fallbackResult = await this.executeStep({ skill: step.fallback, params: step.params }, stepIndex);
          if (!fallbackResult.success) {
            return this.createResult(false, null, `Step and fallback failed: ${fallbackResult.error}`);
          }
        }
        
        // Check budget constraints
        if (this.budgetExceeded(plan.budget)) {
          this.logTrace('budget_exceeded', this.budgetUsed);
          return this.createResult(false, null, 'Budget exceeded');
        }
      }
      
      // Extract final results based on plan constraints
      const finalResult = this.extractFinalResults(plan.constraints);
      
      this.logTrace('plan_completed', { 
        success: true, 
        results_count: Array.isArray(finalResult) ? finalResult.length : 1,
        budget_used: this.budgetUsed
      });
      
      return this.createResult(true, finalResult);
      
    } catch (error) {
      this.logTrace('plan_error', { error: error.message });
      return this.createResult(false, null, error.message);
    }
  }
  
  async executeStep(step, stepIndex) {
    const stepStart = Date.now();
    console.log(`🔧 Executing step ${stepIndex}: ${step.skill}`);
    
    this.logTrace('step_start', { 
      step_index: stepIndex, 
      skill: step.skill, 
      params: step.params 
    });
    
    try {
      const skillDef = SKILLS_REGISTRY[step.skill];
      if (!skillDef) {
        throw new Error(`Unknown skill: ${step.skill}`);
      }
      
      // Check preconditions
      const preconditionsValid = this.checkPreconditions(skillDef.preconditions);
      if (!preconditionsValid) {
        throw new Error(`Preconditions not met for ${step.skill}`);
      }
      
      // Execute the skill
      let result;
      switch (step.skill) {
        case 'PreserveStructure':
          result = await this.skillPreserveStructure(step.params);
          break;
        case 'DiscoverBlocks':
          result = await this.skillDiscoverBlocks(step.params);
          break;
        case 'DetectStructuredData':
          result = await this.skillDetectStructuredData(step.params);
          break;
        case 'HarvestMeta':
          result = await this.skillHarvestMeta(step.params);
          break;
        case 'MapFields':
          result = await this.skillMapFields(step.params);
          break;
        case 'ValidateOutput':
          result = await this.skillValidateOutput(step.params);
          break;
        case 'CiteEvidence':
          result = await this.skillCiteEvidence(step.params);
          break;
        case 'RankResults':
          result = await this.skillRankResults(step.params);
          break;
        default:
          throw new Error(`Skill implementation not found: ${step.skill}`);
      }
      
      // Update context with skill outputs
      if (result.success && result.outputs) {
        Object.entries(result.outputs).forEach(([key, value]) => {
          this.context.set(key, value);
        });
      }
      
      // Update budget usage
      const stepTime = Date.now() - stepStart;
      this.budgetUsed.time += stepTime;
      this.budgetUsed.tokens += result.cost?.tokens || 0;
      this.budgetUsed.requests += result.cost?.requests || 0;
      
      this.logTrace('step_completed', { 
        step_index: stepIndex,
        skill: step.skill,
        success: result.success,
        cost: result.cost,
        execution_time: stepTime
      });
      
      console.log(`✅ Step ${stepIndex} (${step.skill}) completed in ${stepTime}ms`);
      
      return result;
      
    } catch (error) {
      this.logTrace('step_failed', { 
        step_index: stepIndex,
        skill: step.skill,
        error: error.message
      });
      
      console.error(`❌ Step ${stepIndex} (${step.skill}) failed:`, error.message);
      
      return { 
        success: false, 
        error: error.message,
        cost: { tokens: 0, requests: 0 }
      };
    }
  }
  
  checkPreconditions(preconditions = []) {
    for (const condition of preconditions) {
      switch (condition) {
        case 'html_available':
          if (!this.context.has('html')) return false;
          break;
        case 'dom_loaded':
          if (!this.context.has('dom_structure')) return false;
          break;
        case 'content_structured':
          if (!this.context.has('structured_content')) return false;
          break;
        case 'blocks_identified':
          if (!this.context.has('semantic_blocks') && !this.context.has('content_blocks')) return false;
          break;
        case 'schema_available':
          if (!this.context.has('target_schema')) return false;
          break;
        case 'fields_mapped':
          if (!this.context.has('field_mappings')) return false;
          break;
        default:
          console.warn(`Unknown precondition: ${condition}`);
      }
    }
    return true;
  }
  
  budgetExceeded(budget = {}) {
    if (budget.max_time && this.budgetUsed.time > budget.max_time) return true;
    if (budget.max_tokens && this.budgetUsed.tokens > budget.max_tokens) return true;
    if (budget.max_requests && this.budgetUsed.requests > budget.max_requests) return true;
    return false;
  }
  
  extractFinalResults(constraints = {}) {
    // Extract the final mapped results from context
    const fieldMappings = this.context.get('field_mappings') || [];
    const mappingConfidence = this.context.get('mapping_confidence') || [];
    const citations = this.context.get('citations') || [];
    
    console.log(`🎯 Final extraction: ${fieldMappings.length} mappings, ${mappingConfidence.length} confidence scores`);
    console.log('🧪 Sample mapping:', fieldMappings[0] ? JSON.stringify(fieldMappings[0], null, 2) : 'none');
    
    // Apply constraints
    let results = Array.isArray(fieldMappings) ? fieldMappings : [fieldMappings];
    
    if (constraints.max_results) {
      results = results.slice(0, constraints.max_results);
    }
    
    if (constraints.quality_threshold) {
      const beforeFilter = results.length;
      results = results.filter((item, index) => {
        const confidence = item.confidence || mappingConfidence[index] || 0;
        return confidence >= constraints.quality_threshold;
      });
      console.log(`🔍 Quality filter: ${beforeFilter} -> ${results.length} items (threshold: ${constraints.quality_threshold})`);
    }
    
    // Attach citations
    return results.map((item, index) => ({
      ...item,
      citations: citations[index] || [],
      extracted_at: new Date().toISOString()
    }));
  }
  
  logTrace(event, data = {}) {
    this.trace.push({
      timestamp: Date.now(),
      event,
      data,
      context_keys: Array.from(this.context.keys())
    });
  }
  
  createResult(success, data, error = null) {
    return {
      success,
      data,
      error,
      trace: this.trace,
      budget_used: this.budgetUsed,
      execution_time: Date.now() - this.startTime,
      context_final: Object.fromEntries(this.context.entries())
    };
  }
  
  // =============================================================================
  // ATOMIC SKILL IMPLEMENTATIONS
  // Each skill does ONE thing well, passes data through context
  // =============================================================================
  
  async skillPreserveStructure(params = {}) {
    const html = this.context.get('html');
    if (!html) return { success: false, error: 'No HTML input available' };
    
    try {
      // Load HTML into DOM for structural analysis
      const $ = cheerio.load(html);
      
      // Store DOM instance for other skills to use
      const domStructure = {
        $ : $,
        page_title: $('title').text().trim(),
        main_content: this.extractMainContentArea($),
        semantic_regions: this.identifySemanticRegions($)
      };
      
      return {
        success: true,
        outputs: {
          dom_structure: domStructure,
          page_title: domStructure.page_title,
          semantic_regions: domStructure.semantic_regions
        },
        cost: { tokens: 0, requests: 0 },
        confidence: 0.9
      };
    } catch (error) {
      return { success: false, error: error.message, cost: { tokens: 0, requests: 0 } };
    }
  }
  
  async skillDiscoverBlocks(params = {}) {
    const domStructure = this.context.get('dom_structure');
    
    if (!domStructure) return { success: false, error: 'No DOM structure available' };
    
    try {
      const $ = domStructure.$;
      const minSize = params.min_size || 50;
      
      // Extract semantic blocks with full DOM context
      const semanticBlocks = this.extractSemanticBlocks($, minSize);
      
      console.log(`📦 Discovered ${semanticBlocks.length} semantic blocks`);
      
      // Debug: Log first block structure
      if (semanticBlocks.length > 0) {
        const sample = semanticBlocks[0];
        console.log('🐛 Sample block structure:', {
          selector: sample.root_selector,
          heading: sample.heading,
          text_preview: sample.block_text.substring(0, 100) + '...',
          link_density: sample.link_density,
          text_density: sample.text_density
        });
      }
      
      return {
        success: true,
        outputs: {
          semantic_blocks: semanticBlocks,
          block_count: semanticBlocks.length
        },
        cost: { tokens: 0, requests: 0 },
        confidence: 0.8
      };
    } catch (error) {
      return { success: false, error: error.message, cost: { tokens: 0, requests: 0 } };
    }
  }
  
  async skillDetectStructuredData(params = {}) {
    const html = this.context.get('html');
    if (!html) return { success: false, error: 'No HTML available' };
    
    try {
      const structuredData = this.extractJSONLD(html) || this.extractMicrodata(html);
      
      if (structuredData) {
        console.log('🎯 Found structured data:', Object.keys(structuredData));
        return {
          success: true,
          outputs: {
            structured_data: structuredData,
            data_confidence: 0.95
          },
          cost: { tokens: 0, requests: 0 },
          confidence: 0.95
        };
      } else {
        return { success: false, error: 'No structured data found', cost: { tokens: 0, requests: 0 } };
      }
    } catch (error) {
      return { success: false, error: error.message, cost: { tokens: 0, requests: 0 } };
    }
  }
  
  async skillHarvestMeta(params = {}) {
    const html = this.context.get('html');
    if (!html) return { success: false, error: 'No HTML available' };
    
    try {
      const metaData = this.extractMetaTags(html);
      
      return {
        success: true,
        outputs: {
          meta_data: metaData,
          meta_confidence: 0.7
        },
        cost: { tokens: 0, requests: 0 },
        confidence: 0.7
      };
    } catch (error) {
      return { success: false, error: error.message, cost: { tokens: 0, requests: 0 } };
    }
  }
  
  async skillMapFields(params = {}) {
    const semanticBlocks = this.context.get('semantic_blocks') || [];
    const structuredData = this.context.get('structured_data') || {};
    const metaData = this.context.get('meta_data') || {};
    const targetSchema = this.context.get('target_schema');
    
    if (!targetSchema) return { success: false, error: 'No target schema available' };
    
    try {
      console.log('🧠 Mapping fields to schema:', targetSchema.type);
      
      const mappings = this.domBasedFieldMapping(
        semanticBlocks, 
        structuredData, 
        metaData, 
        targetSchema, 
        params
      );
      
      const mappingConfidence = mappings.map(mapping => 
        mapping._confidence || this.calculateMappingConfidence(mapping, structuredData, metaData)
      );
      
      console.log(`✅ Mapped ${mappings.length} items with avg confidence`, 
        mappingConfidence.reduce((a, b) => a + b, 0) / mappingConfidence.length || 0);
      
      return {
        success: true,
        outputs: {
          field_mappings: mappings,
          mapping_confidence: mappingConfidence
        },
        cost: { tokens: mappings.length * 10, requests: 0 }, // Cost scales with complexity
        confidence: mappingConfidence.reduce((a, b) => a + b, 0) / mappingConfidence.length || 0
      };
    } catch (error) {
      return { success: false, error: error.message, cost: { tokens: 0, requests: 0 } };
    }
  }
  
  async skillValidateOutput(params = {}) {
    const fieldMappings = this.context.get('field_mappings') || [];
    const targetSchema = this.context.get('target_schema');
    
    if (!fieldMappings.length) return { success: false, error: 'No field mappings to validate' };
    
    try {
      const validationResults = fieldMappings.map(mapping => 
        this.validateAgainstSchema(mapping, targetSchema)
      );
      
      const repairedOutput = params.repair ? 
        this.repairInvalidMappings(fieldMappings, validationResults) : 
        fieldMappings;
      
      console.log(`🔍 Validated ${fieldMappings.length} mappings, repaired: ${params.repair || false}`);
      
      return {
        success: true,
        outputs: {
          validation_results: validationResults,
          repaired_output: repairedOutput,
          field_mappings: repairedOutput // Update the mappings with repaired version
        },
        cost: { tokens: 0, requests: 0 },
        confidence: 0.8
      };
    } catch (error) {
      return { success: false, error: error.message, cost: { tokens: 0, requests: 0 } };
    }
  }
  
  async skillCiteEvidence(params = {}) {
    const fieldMappings = this.context.get('field_mappings') || [];
    const html = this.context.get('html');
    const contentBlocks = this.context.get('content_blocks') || [];
    
    try {
      const citations = fieldMappings.map(mapping => 
        this.generateCitations(mapping, html, contentBlocks)
      );
      
      console.log(`📄 Generated citations for ${citations.length} items`);
      
      return {
        success: true,
        outputs: {
          citations: citations,
          evidence_strength: citations.map(c => c.confidence || 0.5)
        },
        cost: { tokens: 0, requests: 0 },
        confidence: 0.7
      };
    } catch (error) {
      return { success: false, error: error.message, cost: { tokens: 0, requests: 0 } };
    }
  }
  
  async skillRankResults(params = {}) {
    const fieldMappings = this.context.get('field_mappings') || [];
    const mappingConfidence = this.context.get('mapping_confidence') || [];
    
    try {
      const rankedResults = this.rankMappings(fieldMappings, mappingConfidence, params);
      const rankingReasons = rankedResults.map((_, index) => 
        `Rank ${index + 1}: confidence ${mappingConfidence[index] || 0}`
      );
      
      console.log(`📊 Ranked ${rankedResults.length} results`);
      
      return {
        success: true,
        outputs: {
          ranked_results: rankedResults,
          ranking_reasons: rankingReasons,
          field_mappings: rankedResults // Update with ranked version
        },
        cost: { tokens: 0, requests: 0 },
        confidence: 0.9
      };
    } catch (error) {
      return { success: false, error: error.message, cost: { tokens: 0, requests: 0 } };
    }
  }
  
  // =============================================================================
  // SKILL HELPER METHODS - The actual extraction intelligence
  // =============================================================================
  
  // DOM-based helper methods for structural analysis
  extractMainContentArea($) {
    // Try to find main content area using semantic selectors
    const candidates = [
      $('main').first(),
      $('[role="main"]').first(),
      $('#main, #content, .content, .main').first(),
      $('article').first(),
      $('body').first()
    ];
    
    for (const candidate of candidates) {
      if (candidate.length > 0) {
        return candidate;
      }
    }
    return $('body'); // Fallback to body
  }
  
  identifySemanticRegions($) {
    return {
      header: $('header, [role="banner"], .header, #header').first(),
      nav: $('nav, [role="navigation"], .nav, #nav').first(), 
      main: $('main, [role="main"], .main, #main').first(),
      footer: $('footer, [role="contentinfo"], .footer, #footer').first(),
      aside: $('aside, [role="complementary"], .sidebar, .aside').first()
    };
  }
  
  // Generate CSS selector path for an element
  generateCSSPath(element, $) {
    if (!element || element.length === 0) return '';
    
    const el = element[0];
    if (el.attribs?.id) {
      return `#${el.attribs.id}`;
    }
    
    let path = el.name || '';
    if (el.attribs?.class) {
      const classes = el.attribs.class.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        path += '.' + classes.join('.');
      }
    }
    
    // Add nth-child if needed for uniqueness
    const parent = element.parent();
    if (parent.length > 0) {
      const siblings = parent.children(el.name);
      if (siblings.length > 1) {
        const index = siblings.index(element) + 1;
        path += `:nth-child(${index})`;
      }
    }
    
    return path;
  }
  
  // Extract semantic blocks with DOM context for better accuracy
  extractSemanticBlocks($, minSize = 50) {
    // Candidate selectors for potential content blocks (ordered by preference)
    const blockSelectors = [
      'article',
      'section', 
      '[role="article"]',
      '.staff-member, .team-member, .person, .profile',
      '.card, .item, .entry',
      'div[class*="staff"], div[class*="team"], div[class*="person"]',
      'li:not(nav li):not(.nav li)',
      'div:not(.header):not(.footer):not(.nav):not(nav)'
    ];
    
    const blocks = [];
    const seenElements = new Set();
    
    for (const selector of blockSelectors) {
      $(selector).each((i, element) => {
        const $el = $(element);
        
        // Skip if already processed
        const elementId = $el[0];
        if (seenElements.has(elementId)) return;
        seenElements.add(elementId);
        
        // Skip navigation, header, footer elements
        if (this.isNavigationalElement($el)) return;
        
        const blockText = $el.text().trim();
        if (blockText.length < minSize) return;
        
        // Extract block metadata
        const heading = this.extractHeadingFromBlock($el);
        const roleHints = this.extractRoleHints($el);
        const linkDensity = this.calculateLinkDensity($el);
        const textDensity = this.calculateTextDensity($el);
        
        blocks.push({
          root_selector: this.generateCSSPath($el, $),
          element: $el,
          heading: heading,
          block_text: blockText,
          role_hints: roleHints,
          link_density: linkDensity,
          text_density: textDensity,
          char_count: blockText.length,
          word_count: blockText.split(/\s+/).length
        });
      });
    }
    
    // Sort by relevance (heading + role hints + text density)
    return blocks.sort((a, b) => {
      const scoreA = this.calculateBlockRelevance(a);
      const scoreB = this.calculateBlockRelevance(b);
      return scoreB - scoreA;
    }).slice(0, 20); // Limit to top 20 blocks
  }
  
  // Check if element is likely navigation/header/footer
  isNavigationalElement($el) {
    const element = $el[0];
    const tagName = element.name;
    const classes = element.attribs?.class || '';
    const id = element.attribs?.id || '';
    
    // Skip obvious navigational elements
    const navKeywords = ['nav', 'menu', 'header', 'footer', 'sidebar', 'breadcrumb'];
    const combined = (classes + ' ' + id).toLowerCase();
    
    return navKeywords.some(keyword => combined.includes(keyword)) ||
           tagName === 'nav' ||
           $el.closest('nav, header, footer').length > 0;
  }
  
  // Extract heading text from various sources within block
  extractHeadingFromBlock($el) {
    // Try multiple heading sources
    const headingSources = [
      $el.find('h1, h2, h3, h4, h5, h6').first(),
      $el.find('[role="heading"]').first(),
      $el.find('.name, .title, .heading').first(),
      $el.find('strong, b').first()
    ];
    
    for (const source of headingSources) {
      const text = source.text().trim();
      if (text && text.length > 0 && text.length < 100) {
        return text;
      }
    }
    
    return '';
  }
  
  // Extract role-related hints from text content
  extractRoleHints($el) {
    const text = $el.text().toLowerCase();
    const roleWords = [
      'director', 'manager', 'assistant', 'specialist', 'coordinator', 
      'executive', 'lead', 'head', 'chief', 'senior', 'developer',
      'engineer', 'designer', 'analyst', 'administrator', 'officer'
    ];
    
    return roleWords.filter(word => text.includes(word));
  }
  
  // Calculate link density (high = likely navigation)
  calculateLinkDensity($el) {
    const links = $el.find('a').length;
    const textLength = Math.max($el.text().trim().length, 1);
    return links / textLength * 1000; // Normalize per 1000 chars
  }
  
  // Calculate text density (paragraphs vs structural elements)
  calculateTextDensity($el) {
    const textLength = $el.text().trim().length;
    const elementCount = Math.max($el.find('*').length, 1);
    return textLength / elementCount;
  }
  
  // Calculate overall block relevance for people/profile detection
  calculateBlockRelevance(block) {
    let score = 0;
    
    // Heading bonus
    if (block.heading) {
      score += 30;
      // Name-like heading bonus
      if (this.looksLikePersonName(block.heading)) {
        score += 50;
      }
    }
    
    // Role hints bonus
    score += block.role_hints.length * 20;
    
    // Text density bonus (paragraphs over menus)
    if (block.text_density > 10) score += 20;
    
    // Link density penalty (high = navigation)
    if (block.link_density > 0.1) score -= 30;
    
    // Length bonus
    if (block.char_count > 100) score += 10;
    if (block.char_count > 300) score += 10;
    
    return score;
  }
  
  looksLikePersonName(text) {
    if (!text) return false;
    const words = text.trim().split(/\s+/);
    if (words.length < 2 || words.length > 4) return false;
    
    // All words should be capitalized and reasonable length
    return words.every(word => 
      /^[A-Z][a-z]{1,15}$/.test(word) && word.length >= 2
    );
  }
  
  htmlToStructuredText(html) {
    // Enhanced HTML to text that preserves semantic boundaries
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Preserve important structural breaks
      .replace(/<\/?(article|section|div|main|header|footer)([^>]*)>/gi, '\n\n')
      .replace(/<\/?(h[1-6]|p|li|td|tr)([^>]*)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up whitespace while preserving structure
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  
  detectBlockBoundaries(html) {
    // Extract semantic boundaries from HTML structure
    const boundaries = [];
    const structuralTags = /<(article|section|div|main|header|footer|h[1-6]|p|li|td|tr)[^>]*>/gi;
    let match;
    
    while ((match = structuralTags.exec(html)) !== null) {
      boundaries.push({
        position: match.index,
        tag: match[1].toLowerCase(),
        type: this.classifyBoundaryType(match[1])
      });
    }
    
    return boundaries;
  }
  
  classifyBoundaryType(tag) {
    if (['article', 'section'].includes(tag)) return 'major_section';
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return 'heading';
    if (['p', 'li'].includes(tag)) return 'paragraph';
    if (['div', 'main'].includes(tag)) return 'container';
    return 'minor';
  }
  
  segmentIntoBlocks(content, boundaries = [], minSize = 50) {
    // Intelligent content segmentation using boundaries and content analysis
    let blocks = [];
    
    // Strategy 1: Use semantic boundaries if available
    if (boundaries.length > 0) {
      const lines = content.split('\n');
      let currentBlock = '';
      
      for (const line of lines) {
        currentBlock += line + '\n';
        
        // End block on double newlines or semantic cues
        if (line.trim() === '' && currentBlock.trim().length >= minSize) {
          blocks.push(currentBlock.trim());
          currentBlock = '';
        }
      }
      
      if (currentBlock.trim().length >= minSize) {
        blocks.push(currentBlock.trim());
      }
    }
    
    // Strategy 2: Fallback to paragraph-based segmentation
    if (blocks.length < 2) {
      blocks = content.split('\n\n')
        .map(block => block.trim())
        .filter(block => block.length >= minSize);
    }
    
    // Strategy 3: Emergency line-based grouping
    if (blocks.length < 2) {
      const lines = content.split('\n').filter(line => line.trim());
      blocks = [];
      let currentBlock = '';
      
      for (let i = 0; i < lines.length; i++) {
        currentBlock += lines[i] + '\n';
        
        // Group 3-5 lines per block unless we hit a clear boundary
        if (i % 4 === 3 || this.isNaturalBreak(lines[i], lines[i + 1])) {
          if (currentBlock.trim().length >= minSize) {
            blocks.push(currentBlock.trim());
          }
          currentBlock = '';
        }
      }
      
      if (currentBlock.trim().length >= minSize) {
        blocks.push(currentBlock.trim());
      }
    }
    
    return blocks.filter(block => block.length >= minSize);
  }
  
  isNaturalBreak(currentLine, nextLine) {
    if (!nextLine) return true;
    
    // Natural breaks: period endings, title case starts, etc.
    return /[.!?]\s*$/.test(currentLine.trim()) || 
           /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(nextLine.trim());
  }
  
  assessBlockQuality(block) {
    // Assess how likely this block contains structured entity data
    let score = 0.5; // Baseline
    
    // Positive indicators
    if (/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(block)) score += 0.2; // Contains person names
    if (/Director|Manager|Executive|Assistant/.test(block)) score += 0.2; // Contains titles
    if (block.length > 100 && block.length < 800) score += 0.1; // Good length
    if (block.split('\n').length >= 3) score += 0.1; // Multi-line (name/title/bio)
    
    // Negative indicators
    if (block.includes('http')) score -= 0.1; // Contains URLs
    if (block.length < 50) score -= 0.3; // Too short
    if (block.length > 1000) score -= 0.2; // Too long
    if (/^\d+$/.test(block.trim())) score -= 0.5; // Just numbers
    
    return Math.max(0, Math.min(1, score));
  }
  
  extractJSONLD(html) {
    try {
      const jsonldMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonldMatch) {
        for (const match of jsonldMatch) {
          const json = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
          try {
            const parsed = JSON.parse(json);
            if (parsed['@type'] || parsed.name || parsed.Person) {
              return parsed;
            }
          } catch (e) {
            continue;
          }
        }
      }
    } catch (error) {
      console.warn('JSON-LD extraction failed:', error.message);
    }
    return null;
  }
  
  extractMicrodata(html) {
    try {
      const microdataPattern = /itemscope[^>]*itemtype=["']([^"']+)["'][^>]*>([\s\S]*?)<\/[^>]+>/gi;
      const matches = html.matchAll(microdataPattern);
      
      for (const match of matches) {
        const [fullMatch, itemType, content] = match;
        if (itemType.includes('Person') || itemType.includes('Organization')) {
          return { '@type': itemType, content: content };
        }
      }
    } catch (error) {
      console.warn('Microdata extraction failed:', error.message);
    }
    return null;
  }
  
  extractMetaTags(html) {
    const meta = {};
    
    // OpenGraph and Twitter Card extraction
    const patterns = {
      ogTitle: /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*?)["']/i,
      ogDescription: /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*?)["']/i,
      ogImage: /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*?)["']/i,
      title: /<title[^>]*>([^<]*)<\/title>/i,
      description: /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*?)["']/i,
      author: /<meta[^>]*name=["']author["'][^>]*content=["']([^"']*?)["']/i,
      keywords: /<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*?)["']/i
    };
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = html.match(pattern);
      if (match) {
        meta[key] = match[1];
      }
    }
    
    return meta;
  }
  
  intelligentFieldMapping(contentBlocks, structuredData, metaData, targetSchema, params = {}) {
    const mappings = [];
    const fields = this.getSchemaFields(targetSchema);
    const confidenceThreshold = params.confidence_threshold || 0.3;
    
    console.log(`🧠 Mapping fields ${fields.join(', ')} from ${contentBlocks.length} blocks`);
    
    // Strategy 1: Use structured data if available and high confidence
    if (Object.keys(structuredData).length > 0) {
      const structuredMapping = this.mapFromStructuredData(structuredData, fields);
      if (structuredMapping && this.calculateMappingConfidence(structuredMapping, structuredData, metaData) >= confidenceThreshold) {
        mappings.push(structuredMapping);
        return mappings; // Structured data is authoritative
      }
    }
    
    // Strategy 2: Extract from content blocks using pattern recognition
    for (let i = 0; i < contentBlocks.length; i++) {
      const block = contentBlocks[i];
      const blockMapping = this.extractEntityFromBlock(block, fields);
      console.log(`🧠 Block ${i + 1} extracted:`, blockMapping ? Object.keys(blockMapping) : 'no data');
      
      if (blockMapping) {
        const confidence = this.calculateMappingConfidence(blockMapping, {}, metaData);
        console.log(`🎯 Block ${i + 1} confidence: ${confidence.toFixed(2)} (threshold: ${confidenceThreshold})`);
        
        if (confidence >= confidenceThreshold) {
          mappings.push(blockMapping);
        }
      }
    }
    
    return mappings;
  }
  
  // DOM-based field mapping - schema-guided approach
  domBasedFieldMapping(semanticBlocks, structuredData, metaData, targetSchema, params = {}) {
    const mappings = [];
    const fields = this.getSchemaFields(targetSchema);
    const confidenceThreshold = params.confidence_threshold || 0.3;
    
    console.log(`🧠 Mapping fields ${fields.join(', ')} from ${semanticBlocks.length} semantic blocks`);
    
    // Strategy 1: Use structured data if available (JSON-LD, microdata)
    if (Object.keys(structuredData).length > 0) {
      const structuredMapping = this.mapFromStructuredData(structuredData, fields);
      if (structuredMapping && this.calculateMappingConfidence(structuredMapping, structuredData, metaData) >= confidenceThreshold) {
        mappings.push(structuredMapping);
        return mappings; // Structured data is authoritative
      }
    }
    
    // Strategy 2: Schema-guided extraction from semantic blocks
    for (let i = 0; i < semanticBlocks.length; i++) {
      const block = semanticBlocks[i];
      const blockMapping = this.extractPersonFromSemanticBlock(block, fields);
      console.log(`🧠 Block ${i + 1} extracted:`, blockMapping ? Object.keys(blockMapping) : 'no data');
      
      if (blockMapping) {
        const confidence = this.calculateSemanticBlockConfidence(block, blockMapping);
        console.log(`🎯 Block ${i + 1} confidence: ${confidence.toFixed(2)} (threshold: ${confidenceThreshold})`);
        
        if (confidence >= confidenceThreshold) {
          blockMapping._confidence = confidence; // Store confidence with mapping
          mappings.push(blockMapping);
        }
      }
    }
    
    return mappings;
  }
  
  // Extract person data from semantic block using schema-guided approach
  extractPersonFromSemanticBlock(block, fields) {
    const entity = {};
    const $el = block.element;
    
    // Name extraction (ordered priority)
    if (fields.includes('name')) {
      entity.name = this.extractNameFromBlock($el, block);
    }
    
    // Title extraction (ordered priority) 
    if (fields.includes('title')) {
      entity.title = this.extractTitleFromBlock($el, block);
    }
    
    // Bio extraction (ordered priority)
    if (fields.includes('bio')) {
      entity.bio = this.extractBioFromBlock($el, block);
    }
    
    // Only return if we have substantial data
    const hasRequiredData = entity.name || entity.title || (entity.bio && entity.bio.length > 50);
    return hasRequiredData ? entity : null;
  }
  
  // Schema-guided name extraction with source priority
  extractNameFromBlock($el, block) {
    // Priority 1: Pre-extracted heading (highest confidence)
    if (block.heading && this.looksLikePersonName(block.heading)) {
      return block.heading;
    }
    
    // Priority 2: Visible headings in DOM order
    const headings = $el.find('h1, h2, h3, h4, h5, h6');
    for (let i = 0; i < headings.length; i++) {
      const headingText = headings.eq(i).text().trim();
      if (this.looksLikePersonName(headingText)) {
        return headingText;
      }
    }
    
    // Priority 3: Strong/bold text that looks like names
    const strongElements = $el.find('strong, b');
    for (let i = 0; i < strongElements.length; i++) {
      const strongText = strongElements.eq(i).text().trim();
      if (this.looksLikePersonName(strongText)) {
        return strongText;
      }
    }
    
    return null;
  }
  
  // Schema-guided title extraction  
  extractTitleFromBlock($el, block) {
    const text = $el.text();
    
    // Priority 1: Elements with role-related classes
    const titleElements = $el.find('.title, .role, .position, .job-title');
    if (titleElements.length > 0) {
      const titleText = titleElements.first().text().trim();
      if (titleText && this.looksLikeJobTitle(titleText)) {
        return titleText;
      }
    }
    
    // Priority 2: Text with role words from our hints
    if (block.role_hints.length > 0) {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      for (const line of lines) {
        if (this.looksLikeJobTitle(line) && block.role_hints.some(hint => line.toLowerCase().includes(hint))) {
          return line;
        }
      }
    }
    
    // Priority 3: Lines immediately following name
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    for (let i = 0; i < lines.length - 1; i++) {
      if (this.looksLikePersonName(lines[i]) && this.looksLikeJobTitle(lines[i + 1])) {
        return lines[i + 1];
      }
    }
    
    return null;
  }
  
  // Schema-guided bio extraction
  extractBioFromBlock($el, block) {
    // Priority 1: Paragraph elements (cleanest text)
    const paragraphs = $el.find('p');
    if (paragraphs.length > 0) {
      let bioText = '';
      paragraphs.each((i, p) => {
        const $p = cheerio.load(p);
        const pText = $p.text().trim();
        if (pText.length > 50) { // Substantial paragraph
          bioText += pText + ' ';
        }
      });
      
      if (bioText.length > 50) {
        return this.cleanBioText(bioText, block);
      }
    }
    
    // Priority 2: Clean full block text
    const fullText = block.block_text;
    if (fullText.length > 100) {
      return this.cleanBioText(fullText, block);
    }
    
    return null;
  }
  
  // Clean bio text by removing name/title contamination
  cleanBioText(bioText, block) {
    let cleaned = bioText;
    
    // Remove heading if present
    if (block.heading) {
      cleaned = cleaned.replace(new RegExp(this.escapeRegex(block.heading), 'gi'), '');
    }
    
    // Remove common contamination
    cleaned = cleaned
      .replace(/^(Staff|Team|People|Board)\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleaned.length > 30 ? cleaned : null;
  }
  
  looksLikeJobTitle(text) {
    if (!text || text.length > 120 || text.length < 5) return false;
    
    const roleWords = [
      'director', 'manager', 'assistant', 'specialist', 'coordinator',
      'executive', 'lead', 'head', 'chief', 'senior', 'developer'
    ];
    
    const lowerText = text.toLowerCase();
    return roleWords.some(word => lowerText.includes(word)) && 
           !lowerText.includes('...') && // Not truncated text
           text.split(' ').length <= 8; // Reasonable title length
  }
  
  calculateSemanticBlockConfidence(block, mapping) {
    let confidence = 0.0;
    let factors = 0;
    
    // Name confidence
    if (mapping.name) {
      if (block.heading === mapping.name) confidence += 0.9;
      else confidence += 0.7;
      factors++;
    }
    
    // Title confidence  
    if (mapping.title) {
      if (block.role_hints.length > 0) confidence += 0.8;
      else confidence += 0.5;
      factors++;
    }
    
    // Bio confidence
    if (mapping.bio) {
      if (mapping.bio.length > 100) confidence += 0.7;
      else confidence += 0.5;
      factors++;
    }
    
    // Overall block quality bonus
    if (block.text_density > 20) confidence += 0.1;
    if (block.link_density < 0.05) confidence += 0.1;
    
    return factors > 0 ? confidence / factors : 0.0;
  }
  
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  getSchemaFields(schema) {
    if (schema.type === 'array' && schema.items?.properties) {
      return Object.keys(schema.items.properties);
    } else if (schema.properties) {
      return Object.keys(schema.properties);
    }
    return [];
  }
  
  mapFromStructuredData(data, fields) {
    const mapping = {};
    
    // Map common structured data fields
    if (data.name && fields.includes('name')) mapping.name = data.name;
    if (data.jobTitle && fields.includes('title')) mapping.title = data.jobTitle;
    if (data.description && fields.includes('bio')) mapping.bio = data.description;
    if (data.Person && data.Person.name && fields.includes('name')) mapping.name = data.Person.name;
    
    return Object.keys(mapping).length > 0 ? mapping : null;
  }
  
  extractEntityFromBlock(block, fields) {
    const entity = {};
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    
    // Enhanced entity extraction with confidence scoring
    if (fields.includes('name')) {
      entity.name = this.extractName(lines);
    }
    
    if (fields.includes('title')) {
      entity.title = this.extractTitle(lines, entity.name);
    }
    
    if (fields.includes('bio')) {
      entity.bio = this.extractBio(lines, entity.name, entity.title);
    }
    
    // Only return if we have substantial data
    const hasData = Object.values(entity).some(value => value && value.length > 2);
    return hasData ? entity : null;
  }
  
  extractName(lines) {
    for (const line of lines) {
      // Look for person name patterns - be more flexible
      const namePatterns = [
        /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/,  // John Smith
        /^([A-Z][a-z]+\s+[A-Z][a-z]+)$/,    // Whole line is name
        /([A-Z][a-z]+\s+[A-Z][a-z]+)/       // More lenient matching
      ];
      
      for (const pattern of namePatterns) {
        const nameMatch = line.match(pattern);
        if (nameMatch) {
          const name = nameMatch[1].trim();
          if (this.isValidPersonName(name)) {
            return name;
          }
        }
      }
    }
    return null;
  }
  
  extractTitle(lines, name) {
    const titleWords = ['Director', 'Manager', 'Executive', 'Assistant', 'Specialist', 'Coordinator'];
    
    for (const line of lines) {
      if (titleWords.some(word => line.includes(word))) {
        // Extract the title part
        let title = line;
        if (name && line.includes(name)) {
          title = line.replace(name, '').trim();
        }
        
        if (title.length > 0 && title.length < 100) {
          return title;
        }
      }
    }
    
    return null;
  }
  
  extractBio(lines, name, title) {
    let bio = lines.join(' ');
    
    // Clean bio by removing name and title
    if (name) bio = bio.replace(new RegExp(name, 'g'), '');
    if (title) bio = bio.replace(new RegExp(title, 'g'), '');
    
    // Clean up and validate
    bio = bio.replace(/\s+/g, ' ').trim();
    
    // Bio should be substantial
    return (bio.length > 20 && bio.length < 1000) ? bio : null;
  }
  
  isValidPersonName(name) {
    if (!name) return false;
    
    const words = name.split(' ');
    if (words.length !== 2) return false;
    
    // Check for proper capitalization and reasonable length
    return words.every(word => 
      /^[A-Z][a-z]{1,15}$/.test(word) && word.length >= 2
    );
  }
  
  calculateMappingConfidence(mapping, structuredData, metaData) {
    let confidence = 0.1; // Base confidence
    
    // Source priority scoring
    if (Object.keys(structuredData).length > 0) confidence += 0.4; // Structured data bonus
    if (Object.keys(metaData).length > 0) confidence += 0.2; // Meta data bonus
    
    // Field quality scoring
    if (mapping.name && this.isValidPersonName(mapping.name)) confidence += 0.2;
    if (mapping.title && mapping.title.length > 5 && mapping.title.length < 100) confidence += 0.15;
    if (mapping.bio && mapping.bio.length > 20 && mapping.bio.length < 800) confidence += 0.15;
    
    return Math.min(0.95, confidence);
  }
  
  validateAgainstSchema(mapping, schema) {
    const validation = { valid: true, errors: [] };
    const fields = this.getSchemaFields(schema);
    
    for (const field of fields) {
      if (schema.items?.properties?.[field]?.type === 'string') {
        if (mapping[field] && typeof mapping[field] !== 'string') {
          validation.valid = false;
          validation.errors.push(`${field} should be string, got ${typeof mapping[field]}`);
        }
      }
    }
    
    return validation;
  }
  
  repairInvalidMappings(mappings, validationResults) {
    return mappings.map((mapping, index) => {
      const validation = validationResults[index];
      if (validation.valid) return mapping;
      
      // Attempt repairs
      const repaired = { ...mapping };
      for (const error of validation.errors) {
        if (error.includes('should be string')) {
          const field = error.split(' ')[0];
          if (repaired[field] != null) {
            repaired[field] = String(repaired[field]);
          }
        }
      }
      
      return repaired;
    });
  }
  
  generateCitations(mapping, html, contentBlocks) {
    const citations = {};
    
    // Generate citations for each field
    for (const [field, value] of Object.entries(mapping)) {
      if (value && typeof value === 'string') {
        const citation = this.findSourceInContent(value, html, contentBlocks);
        if (citation) {
          citations[field] = citation;
        }
      }
    }
    
    return {
      field_citations: citations,
      confidence: Object.keys(citations).length / Object.keys(mapping).length
    };
  }
  
  findSourceInContent(value, html, contentBlocks) {
    // Find where this value appears in the source content
    const cleanValue = value.substring(0, 50); // First 50 chars for matching
    
    for (let i = 0; i < contentBlocks.length; i++) {
      if (contentBlocks[i].includes(cleanValue)) {
        return {
          source: 'content_block',
          block_index: i,
          confidence: 0.8,
          evidence: cleanValue
        };
      }
    }
    
    return {
      source: 'unknown',
      confidence: 0.3,
      evidence: 'extracted_from_page'
    };
  }
  
  rankMappings(mappings, confidenceScores, params = {}) {
    const tieBreaker = params.tie_breaker || 'confidence_desc';
    
    // Create combined array for sorting
    const combined = mappings.map((mapping, index) => ({
      mapping,
      confidence: confidenceScores[index] || 0,
      originalIndex: index
    }));
    
    // Sort based on tie breaker strategy
    if (tieBreaker === 'confidence_desc') {
      combined.sort((a, b) => b.confidence - a.confidence);
    } else if (tieBreaker === 'page_order_then_confidence') {
      combined.sort((a, b) => {
        if (Math.abs(a.confidence - b.confidence) < 0.1) {
          return a.originalIndex - b.originalIndex; // Page order for ties
        }
        return b.confidence - a.confidence; // Higher confidence first
      });
    }
    
    return combined.map(item => item.mapping);
  }
}

/**
 * Basic Planner v0.1 - Generates skill-based execution plans
 * Takes user request + schema, returns executable plan
 */
class BasicPlanner {
  generatePlan(task) {
    const { url, instructions, targetSchema, constraints = {} } = task;
    
    console.log('🎯 Generating plan for:', instructions);
    
    // Create plan based on extraction type
    const plan = {
      task_id: `extract_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      budget: {
        max_time: constraints.max_time || 15000, // 15 seconds
        max_tokens: constraints.max_tokens || 500,
        max_requests: constraints.max_requests || 2
      },
      steps: this.createSteps(instructions, targetSchema),
      constraints: {
        deterministic_order: true,
        max_results: constraints.max_results || 10,
        required_fields: this.getRequiredFields(targetSchema),
        quality_threshold: constraints.quality_threshold || 0.3
      }
    };
    
    console.log(`📋 Generated plan with ${plan.steps.length} steps`);
    
    return plan;
  }
  
  createSteps(instructions, targetSchema) {
    const steps = [];
    
    // Step 1: Always start by preserving HTML structure
    steps.push({
      skill: 'PreserveStructure',
      params: { html_input: true }
    });
    
    // Step 2: Segment content into blocks
    steps.push({
      skill: 'DiscoverBlocks',
      params: { min_size: 50 }
    });
    
    // Step 3: Try structured data first, fallback to meta harvesting
    steps.push({
      skill: 'DetectStructuredData',
      params: {},
      fallback: 'HarvestMeta'
    });
    
    // Step 4: Map fields to target schema (core intelligence)
    steps.push({
      skill: 'MapFields',
      params: {
        confidence_threshold: 0.3
      }
    });
    
    // Step 5: Validate and repair output
    steps.push({
      skill: 'ValidateOutput',
      params: { repair: true }
    });
    
    // Step 6: Generate citations for traceability
    steps.push({
      skill: 'CiteEvidence',
      params: {}
    });
    
    // Step 7: Rank results by confidence and constraints
    steps.push({
      skill: 'RankResults',
      params: {
        tie_breaker: 'page_order_then_confidence'
      }
    });
    
    return steps;
  }
  
  getRequiredFields(schema) {
    if (schema?.items?.properties) {
      return Object.keys(schema.items.properties);
    } else if (schema?.properties) {
      return Object.keys(schema.properties);
    }
    return [];
  }
}

/**
 * Simple Evaluator v0.1 - Scores extraction results for learning
 */
class SimpleEvaluator {
  evaluate(result, targetSchema, constraints = {}) {
    console.log('🔍 Evaluating extraction result');
    
    const metrics = {
      schema_validity: this.checkSchemaValidity(result.data, targetSchema),
      field_coverage: this.checkFieldCoverage(result.data, targetSchema),
      confidence_calibration: this.checkConfidenceCalibration(result.data),
      determinism: 0.8, // Placeholder - would need multiple runs to measure
      cost_efficiency: this.checkCostEfficiency(result.budget_used, result.data),
      freshness: 1.0 // Always fresh since we just extracted
    };
    
    // Weighted overall score
    const weights = {
      schema_validity: 0.3,
      field_coverage: 0.25,
      confidence_calibration: 0.2,
      determinism: 0.1,
      cost_efficiency: 0.1,
      freshness: 0.05
    };
    
    const overallScore = Object.entries(metrics).reduce((score, [metric, value]) => {
      return score + (weights[metric] * value);
    }, 0);
    
    console.log(`📊 Evaluation score: ${overallScore.toFixed(2)}`);
    
    return {
      overall_score: overallScore,
      metrics,
      issues: this.identifyIssues(result.data, metrics),
      recommendations: this.generateRecommendations(metrics)
    };
  }
  
  checkSchemaValidity(data, schema) {
    if (!Array.isArray(data)) return 0.0;
    
    let validCount = 0;
    for (const item of data) {
      if (this.validateItem(item, schema)) {
        validCount++;
      }
    }
    
    return data.length > 0 ? validCount / data.length : 0.0;
  }
  
  validateItem(item, schema) {
    if (!schema?.items?.properties) return true;
    
    const requiredFields = Object.keys(schema.items.properties);
    for (const field of requiredFields) {
      if (!item[field] || typeof item[field] !== 'string' || item[field].length < 2) {
        return false;
      }
    }
    
    return true;
  }
  
  checkFieldCoverage(data, schema) {
    if (!Array.isArray(data) || data.length === 0) return 0.0;
    
    const expectedFields = this.getSchemaFields(schema);
    if (expectedFields.length === 0) return 1.0;
    
    let totalCoverage = 0;
    for (const item of data) {
      const coveredFields = expectedFields.filter(field => 
        item[field] && typeof item[field] === 'string' && item[field].length > 0
      );
      totalCoverage += coveredFields.length / expectedFields.length;
    }
    
    return totalCoverage / data.length;
  }
  
  checkConfidenceCalibration(data) {
    if (!Array.isArray(data) || data.length === 0) return 0.5;
    
    // Simple confidence check - are confidence scores reasonable?
    let totalConfidence = 0;
    let itemsWithConfidence = 0;
    
    for (const item of data) {
      if (item.confidence && typeof item.confidence === 'number') {
        totalConfidence += item.confidence;
        itemsWithConfidence++;
      }
    }
    
    if (itemsWithConfidence === 0) return 0.3; // No confidence scores
    
    const avgConfidence = totalConfidence / itemsWithConfidence;
    
    // Reasonable confidence should be between 0.4 and 0.9
    if (avgConfidence >= 0.4 && avgConfidence <= 0.9) return 0.8;
    if (avgConfidence > 0.9) return 0.6; // Overconfident
    return 0.4; // Underconfident
  }
  
  checkCostEfficiency(budgetUsed, data) {
    if (!Array.isArray(data) || data.length === 0) return 0.0;
    
    const totalTime = budgetUsed?.time || 1000;
    const itemsPerSecond = (data.length / totalTime) * 1000;
    
    // Good efficiency: 1+ items per second
    return Math.min(1.0, itemsPerSecond);
  }
  
  getSchemaFields(schema) {
    if (schema?.items?.properties) {
      return Object.keys(schema.items.properties);
    } else if (schema?.properties) {
      return Object.keys(schema.properties);
    }
    return [];
  }
  
  identifyIssues(data, metrics) {
    const issues = [];
    
    if (metrics.schema_validity < 0.7) {
      issues.push('Low schema validity - many items missing required fields');
    }
    
    if (metrics.field_coverage < 0.6) {
      issues.push('Poor field coverage - extracting incomplete data');
    }
    
    if (metrics.confidence_calibration < 0.5) {
      issues.push('Confidence calibration issues - scores may be unreliable');
    }
    
    if (metrics.cost_efficiency < 0.3) {
      issues.push('Low cost efficiency - taking too long per extracted item');
    }
    
    return issues;
  }
  
  generateRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.field_coverage < 0.7) {
      recommendations.push('Consider expanding content block discovery');
      recommendations.push('Try alternative field mapping strategies');
    }
    
    if (metrics.confidence_calibration < 0.6) {
      recommendations.push('Review confidence scoring methodology');
      recommendations.push('Add more validation signals to confidence calculation');
    }
    
    if (metrics.cost_efficiency < 0.5) {
      recommendations.push('Optimize content segmentation for speed');
      recommendations.push('Consider reducing validation steps for simple extractions');
    }
    
    return recommendations;
  }
}

/**
 * Main plan-based processor - replaces old hardcoded extraction
 */
async function processWithPlanBasedSystem(content, params) {
  console.log('🚀 Using plan-based extraction system');
  
  try {
    // Create extraction task from parameters
    const task = {
      url: params.url,
      instructions: params.extractionInstructions,
      targetSchema: params.outputSchema,
      constraints: {
        max_results: 10,
        quality_threshold: 0.6,
        max_time: 10000
      }
    };
    
    // Generate plan
    const planner = new BasicPlanner();
    const plan = planner.generatePlan(task);
    
    // Execute plan
    const executor = new PlanExecutor();
    const initialInputs = {
      html: content, // Raw HTML content
      target_schema: params.outputSchema
    };
    
    const executionResult = await executor.executePlan(plan, initialInputs);
    
    if (!executionResult.success) {
      throw new Error(`Plan execution failed: ${executionResult.error}`);
    }
    
    // Evaluate results
    const evaluator = new SimpleEvaluator();
    const evaluation = evaluator.evaluate(executionResult, params.outputSchema);
    
    console.log(`✅ Plan-based extraction completed with score: ${evaluation.overall_score.toFixed(2)}`);
    
    return {
      success: true,
      data: executionResult.data,
      metadata: {
        strategy: 'plan_based_extraction',
        plan_id: plan.task_id,
        skills_used: plan.steps.map(step => step.skill),
        execution_time: executionResult.execution_time,
        budget_used: executionResult.budget_used,
        evaluation: evaluation,
        trace: executionResult.trace
      }
    };
    
  } catch (error) {
    console.error('Plan-based extraction failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Legacy extraction functions - will be removed once plan-based system is validated
 */
function extractStructuredArray(content, schema, instructions) {
  const items = [];
  const itemSchema = schema.items;
  
  if (!itemSchema || !itemSchema.properties) {
    return { success: false, error: 'Array schema missing item properties' };
  }
  
  const fields = Object.keys(itemSchema.properties);
  console.log('🎯 Extracting array with fields:', fields);
  
  // Parse instructions to understand what we're looking for
  const entityType = inferEntityType(instructions, fields);
  console.log('🧠 Inferred entity type:', entityType);
  
  // Split content into potential entity blocks
  const blocks = segmentContentIntoBlocks(content);
  console.log('📦 Content segmented into', blocks.length, 'blocks');
  
  // Extract fields from each block
  for (const block of blocks) {
    const extractedItem = extractFieldsFromBlock(block, fields, entityType);
    
    if (extractedItem && isValidExtraction(extractedItem, fields)) {
      items.push(extractedItem);
      console.log('✅ Extracted item:', extractedItem.name || extractedItem.title || 'Unknown');
    }
  }
  
  console.log(`🎉 Successfully extracted ${items.length} items`);
  return { success: true, data: items };
}

/**
 * Infer what type of entity we're extracting from instructions
 */
function inferEntityType(instructions, fields) {
  const lower = instructions.toLowerCase();
  
  if (lower.includes('person') || lower.includes('staff') || lower.includes('team') || 
      (fields.includes('name') && fields.includes('bio'))) {
    return 'person';
  }
  
  if (lower.includes('article') || lower.includes('story') || lower.includes('news')) {
    return 'article';
  }
  
  if (lower.includes('product') || lower.includes('item') || fields.includes('price')) {
    return 'product';
  }
  
  return 'generic';
}

/**
 * Intelligently segment content into blocks that might contain entities
 */
function segmentContentIntoBlocks(content) {
  // Strategy 1: Split by double newlines (paragraphs)
  let blocks = content.split('\n\n').filter(block => block.trim().length > 20);
  
  // Strategy 2: If no good blocks, try single newlines but group related content
  if (blocks.length < 2) {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    blocks = [];
    let currentBlock = '';
    
    for (const line of lines) {
      currentBlock += line + '\n';
      
      // End block if we hit what looks like a new entity or section
      if (currentBlock.length > 50 && 
          (line.length < 100 || // Short lines often end sections
           /\.$/.test(line.trim()) || // Lines ending with periods
           /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(lines[lines.indexOf(line) + 1] || ''))) { // Next line looks like a name
        
        blocks.push(currentBlock.trim());
        currentBlock = '';
      }
    }
    
    if (currentBlock.trim()) {
      blocks.push(currentBlock.trim());
    }
  }
  
  return blocks.filter(block => block.length > 10);
}

/**
 * Extract specific fields from a content block
 */
function extractFieldsFromBlock(block, fields, entityType) {
  const result = {};
  
  // Extract based on entity type patterns
  if (entityType === 'person') {
    return extractPersonFromBlock(block, fields);
  } else if (entityType === 'article') {
    return extractArticleFromBlock(block, fields);
  } else {
    return extractGenericFromBlock(block, fields);
  }
}

/**
 * Extract person fields from block
 */
function extractPersonFromBlock(block, fields) {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  
  // Look for name (usually first recognizable name in the block)
  let name = null;
  let title = null;
  let bio = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Name pattern: "First Last" at start of line or after simple words
    const nameMatch = line.match(/(?:^|\s)([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s|$)/);
    if (nameMatch && !name) {
      const candidateName = nameMatch[1];
      
      // Validate it's a real name, not random capitalized words
      if (isLikelyPersonName(candidateName)) {
        name = candidateName;
        
        // Title is often on same line after name or next line
        const afterName = line.substring(line.indexOf(candidateName) + candidateName.length).trim();
        if (afterName && afterName.length < 100 && isLikelyTitle(afterName)) {
          title = afterName;
        } else if (i + 1 < lines.length && isLikelyTitle(lines[i + 1])) {
          title = lines[i + 1];
        }
        
        break;
      }
    }
  }
  
  // Bio is usually the remaining substantial text
  if (name) {
    bio = block;
    // Remove name and title from bio
    if (title) {
      bio = bio.replace(name, '').replace(title, '');
    } else {
      bio = bio.replace(name, '');
    }
    
    // Clean up bio
    bio = bio.replace(/^\s*[^\w]*\s*/, '') // Remove leading non-word chars
              .replace(/\s+/g, ' ')
              .trim();
    
    if (bio.length < 20) {
      bio = block.split(name)[1] || block; // Take everything after name
      bio = bio.replace(/\s+/g, ' ').trim();
    }
  }
  
  const result = {};
  if (fields.includes('name') && name) result.name = name;
  if (fields.includes('title') && title) result.title = title || '';
  if (fields.includes('bio') && bio) result.bio = bio.substring(0, 500);
  
  return result;
}

/**
 * Check if a name looks like a real person name
 */
function isLikelyPersonName(name) {
  if (!name) return false;
  
  const words = name.trim().split(/\s+/);
  if (words.length !== 2) return false;
  
  // Both words should be capitalized and reasonable length
  return words.every(word => 
    /^[A-Z][a-z]{1,15}$/.test(word) && 
    word.length >= 2
  );
}

/**
 * Check if text looks like a job title
 */
function isLikelyTitle(text) {
  if (!text || text.length > 100) return false;
  
  const titleWords = [
    'Director', 'Manager', 'Assistant', 'Specialist', 'Executive', 
    'Coordinator', 'Administrator', 'Lead', 'Head', 'Chief'
  ];
  
  return titleWords.some(word => text.includes(word)) || 
         (text.length < 60 && /^[A-Z]/.test(text) && !text.includes('.'));
}

/**
 * Extract article fields from block (placeholder)
 */
function extractArticleFromBlock(block, fields) {
  // Implement article extraction logic
  return {};
}

/**
 * Extract generic fields from block (placeholder)
 */
function extractGenericFromBlock(block, fields) {
  // Implement generic extraction logic
  return {};
}

/**
 * Validate that extraction has required fields
 */
function isValidExtraction(item, fields) {
  // Must have at least one required field with substantial content
  return Object.keys(item).some(key => 
    fields.includes(key) && 
    item[key] && 
    item[key].toString().length > 1
  );
}

/**
 * Generic structured object extraction - learns patterns from instructions and schema  
 */
function extractStructuredObject(content, schema, instructions) {
  console.log('🎯 Extracting object with properties:', Object.keys(schema.properties || {}));
  
  // For object extraction, treat it as single-item array extraction
  const arrayResult = extractStructuredArray(content, {
    type: 'array',
    items: schema
  }, instructions);
  
  if (arrayResult.success && arrayResult.data.length > 0) {
    return { success: true, data: arrayResult.data[0] };
  }
  
  return { success: false, error: 'No object data found' };
}

/**
 * Core skill: ValidateOutput - Ensure output matches expected schema
 */
function validateOutputSkill(data, schema) {
  if (!schema) return { success: true, data, issues: [] };
  
  const issues = [];
  
  try {
    if (schema.type === 'array' && Array.isArray(data)) {
      // Validate array items
      if (schema.items && schema.items.properties) {
        const requiredFields = Object.keys(schema.items.properties);
        
        for (const item of data) {
          for (const field of requiredFields) {
            if (!item[field] || item[field] === '') {
              issues.push(`Missing or empty field: ${field}`);
            }
          }
        }
      }
    }
    
    return { success: true, data, issues };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Simple skill-based processor for structured extraction
 */
async function processWithSkills(content, params) {
  console.log('Processing with skills - Instructions:', params.extractionInstructions);
  console.log('Schema type:', params.outputSchema?.type);
  
  // Step 1: Map fields according to schema
  const mapResult = mapFieldsSkill(content, params.outputSchema, params.extractionInstructions);
  
  if (!mapResult.success) {
    throw new Error(`Field mapping failed: ${mapResult.error}`);
  }
  
  // Step 2: Validate output
  const validateResult = validateOutputSkill(mapResult.data, params.outputSchema);
  
  return {
    success: true,
    data: validateResult.data,
    metadata: {
      strategy: 'skill_based_extraction',
      skills_used: ['MapFields', 'ValidateOutput'],
      issues: validateResult.issues || [],
      confidence: validateResult.issues?.length === 0 ? 0.9 : 0.7
    }
  };
}

// Update job status in DynamoDB
async function updateJobStatus(jobId, status, result = null, error = null) {
  const updateExpression = ['SET #status = :status', '#updatedAt = :updatedAt'];
  const expressionAttributeNames = {
    '#status': 'status',
    '#updatedAt': 'updatedAt'
  };
  const expressionAttributeValues = {
    ':status': { S: status },
    ':updatedAt': { N: Date.now().toString() }
  };

  if (result) {
    updateExpression.push('#result = :result');
    expressionAttributeNames['#result'] = 'result';
    expressionAttributeValues[':result'] = { 
      S: JSON.stringify(result) 
    };
  }

  if (error) {
    updateExpression.push('#error = :error');
    expressionAttributeNames['#error'] = 'error';
    expressionAttributeValues[':error'] = { S: error };
  }

  try {
    await dynamodb.send(new UpdateItemCommand({
      TableName: 'atlas-codex-jobs',
      Key: { id: { S: jobId } },
      UpdateExpression: updateExpression.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }));
    console.log(`Job ${jobId} updated to status: ${status}`);
  } catch (err) {
    console.error(`Failed to update job ${jobId}:`, err);
    throw err;
  }
}

// Helper functions for content extraction
function extractMainContent(html) {
  // Try to find main content areas
  const mainPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*role=["']main["'][^>]*>([\s\S]*?)<\/div>/i
  ];
  
  for (const pattern of mainPatterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  
  // Fallback to body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : html;
}

function htmlToText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Add line breaks for better structure preservation
    .replace(/<\/?(h[1-6]|p|div|br|li|tr|td)([^>]*)>/gi, '\n')
    .replace(/<\/?(ul|ol|table)([^>]*)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up excess whitespace but preserve line breaks
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToMarkdown(html) {
  let md = html;
  
  // Headers
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n');
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n');
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n');
  
  // Bold and italic
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  
  // Links
  md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  
  // Images
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*?)["'][^>]*>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '![]($1)');
  
  // Lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
    return '\n' + content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n';
  });
  
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
    let counter = 1;
    return '\n' + content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${counter++}. $1\n`) + '\n';
  });
  
  // Paragraphs
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n');
  
  // Line breaks
  md = md.replace(/<br[^>]*>/gi, '\n');
  
  // Code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  
  // Blockquotes
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '\n> $1\n');
  
  // Tables (basic support)
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match, content) => {
    const rows = content.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    let table = '\n';
    rows.forEach((row, index) => {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      const rowContent = cells.map(cell => {
        return cell.replace(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/i, '$1').trim();
      }).join(' | ');
      table += `| ${rowContent} |\n`;
      if (index === 0) {
        table += '|' + cells.map(() => ' --- ').join('|') + '|\n';
      }
    });
    return table + '\n';
  });
  
  // Clean up remaining HTML
  md = htmlToText(md);
  
  // Clean up excessive newlines
  md = md.replace(/\n{3,}/g, '\n\n');
  
  return md.trim();
}

function extractLinks(html, baseUrl) {
  const links = [];
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const seen = new Set();
  
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = htmlToText(match[2]).trim();
    
    // Skip anchors and javascript links
    if (href.startsWith('#') || href.startsWith('javascript:')) continue;
    
    // Resolve relative URLs
    let absoluteUrl;
    try {
      absoluteUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
    } catch (e) {
      continue; // Invalid URL, skip
    }
    
    // Avoid duplicates
    if (seen.has(absoluteUrl)) continue;
    seen.add(absoluteUrl);
    
    links.push({
      text: text || absoluteUrl,
      href: absoluteUrl
    });
  }
  
  return links;
}

function extractStructuredData(html) {
  const data = {};
  
  // Extract meta tags
  const metaRegex = /<meta[^>]*(?:name|property)=["']([^"']+)["'][^>]*content=["']([^"']*?)["']/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    data[match[1]] = match[2];
  }
  
  // Extract JSON-LD structured data
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const jsonLdMatches = [];
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      jsonLdMatches.push(JSON.parse(match[1]));
    } catch (e) {
      // Invalid JSON, skip
    }
  }
  if (jsonLdMatches.length > 0) {
    data.jsonLd = jsonLdMatches;
  }
  
  return Object.keys(data).length > 0 ? data : null;
}

function detectLanguage(html) {
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  return langMatch ? langMatch[1].split('-')[0] : 'en';
}

function extractMetadata(html) {
  const metadata = {};
  
  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)</i);
  metadata.title = titleMatch ? titleMatch[1].trim() : '';
  
  // Description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*?)["']/i);
  metadata.description = descMatch ? descMatch[1] : '';
  
  // Author
  const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']*?)["']/i);
  metadata.author = authorMatch ? authorMatch[1] : null;
  
  // Keywords
  const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*?)["']/i);
  metadata.keywords = keywordsMatch ? keywordsMatch[1].split(',').map(k => k.trim()) : [];
  
  // OpenGraph data
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*?)["']/i);
  if (ogTitle) metadata.ogTitle = ogTitle[1];
  
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*?)["']/i);
  if (ogDesc) metadata.ogDescription = ogDesc[1];
  
  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*?)["']/i);
  if (ogImage) metadata.ogImage = ogImage[1];
  
  // Language
  metadata.language = detectLanguage(html);
  
  return metadata;
}

function generateSummary(text, maxLength = 500) {
  // Simple summary generation - take first paragraph or sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  let summary = '';
  
  for (const sentence of sentences) {
    if ((summary + sentence).length > maxLength) break;
    summary += sentence + ' ';
  }
  
  return summary.trim() || text.substring(0, maxLength);
}

// Process structured extraction based on instructions
function processStructuredExtraction(html, instructions, schema, postProcessing, existingData) {
  try {
    // For NYTimes-style article extraction
    if (instructions && (instructions.includes('top 10 article') || instructions.includes('articles'))) {
      const articles = [];
      
      // Find article elements (common patterns for NYTimes)
      const articlePatterns = [
        /<article[^>]*>([\\s\\S]*?)<\/article>/gi,
        /<div[^>]*class="[^"]*story[^"]*"[^>]*>([\\s\\S]*?)<\/div>/gi,
        /<section[^>]*data-testid="[^"]*story[^"]*"[^>]*>([\\s\\S]*?)<\/section>/gi
      ];
      
      // Extract articles using various patterns
      for (const pattern of articlePatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          if (articles.length >= 10) break;
          
          const articleHtml = match[0];
          
          // Extract title
          const titleMatch = articleHtml.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i);
          const title = titleMatch ? titleMatch[1].trim() : '';
          
          // Extract link
          const linkMatch = articleHtml.match(/href="([^"]+)"/i);
          const url = linkMatch ? linkMatch[1] : '';
          
          // Extract summary/description
          const summaryMatch = articleHtml.match(/<p[^>]*>([^<]+)<\/p>/i);
          const summary = summaryMatch ? summaryMatch[1].trim() : '';
          
          if (title && !title.includes('Advertisement')) {
            articles.push({
              title,
              url: url.startsWith('http') ? url : (url.startsWith('/') ? `https://nytimes.com${url}` : url),
              summary: summary.substring(0, 200),
              author: '',
              section: ''
            });
          }
        }
      }
      
      // If we couldn't find articles with patterns, try finding headlines
      if (articles.length === 0) {
        const headlineMatches = html.matchAll(/<h[1-3][^>]*>(<a[^>]*href="([^"]+)"[^>]*>)?([^<]+)(<\/a>)?<\/h[1-3]>/gi);
        for (const match of headlineMatches) {
          if (articles.length >= 10) break;
          const url = match[2] || '';
          const title = match[3].trim();
          if (title && !title.includes('Advertisement') && !title.includes('Subscribe')) {
            articles.push({
              title,
              url: url.startsWith('http') ? url : (url.startsWith('/') ? `https://nytimes.com${url}` : url),
              summary: '',
              author: '',
              section: ''
            });
          }
        }
      }
      
      return {
        articles: articles.slice(0, 10),
        extractedAt: new Date().toISOString(),
        totalFound: articles.length
      };
    }
    
    // For product/price extraction
    if (instructions && instructions.includes('product') && instructions.includes('price')) {
      const products = [];
      
      // Common e-commerce patterns
      const productPatterns = [
        /<div[^>]*class="[^"]*product[^"]*"[^>]*>([\\s\\S]*?)<\/div>/gi,
        /<li[^>]*class="[^"]*item[^"]*"[^>]*>([\\s\\S]*?)<\/li>/gi
      ];
      
      for (const pattern of productPatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          const productHtml = match[0];
          
          // Extract product name
          const nameMatch = productHtml.match(/<(?:h[1-5]|span|div)[^>]*>([^<]+)</i);
          const name = nameMatch ? nameMatch[1].trim() : '';
          
          // Extract price
          const priceMatch = productHtml.match(/\$([\\d,]+\.?\d*)/i);
          const price = priceMatch ? `$${priceMatch[1]}` : '';
          
          if (name && price) {
            products.push({ name, price, rating: '' });
          }
        }
      }
      
      return products;
    }
    
    // Default: return existing data with extraction note
    return {
      ...existingData,
      extractionNote: 'Structured extraction applied',
      instructions: instructions,
      postProcessing: postProcessing
    };
    
  } catch (error) {
    console.error('Structured extraction failed:', error);
    // Fall back to existing data
    return existingData;
  }
}

// Enhanced extraction with multiple format support
async function performExtraction(jobId, params) {
  const startTime = Date.now();
  
  try {
    console.log(`Starting extraction for job ${jobId}:`, params);
    
    // Update status to processing
    await updateJobStatus(jobId, 'processing');
    
    // Determine formats requested
    const formats = params.formats || ['markdown'];
    const includeMarkdown = formats.includes('markdown') || params.includeMarkdown;
    const includeHtml = formats.includes('html') || params.includeHtml;
    const includeLinks = formats.includes('links') || params.includeLinks;
    const includeSummary = formats.includes('summary');
    const includeJson = formats.includes('json') || params.includeStructured;
    const includeScreenshot = formats.includes('screenshot') || params.includeScreenshot;
    
    // Fetch the page
    const response = await fetch(params.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        ...params.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Extract metadata
    const metadata = extractMetadata(html);
    
    // Extract main content based on options
    let contentHtml = html;
    if (params.onlyMainContent !== false) {
      contentHtml = extractMainContent(html);
    }
    
    // Prepare result object
    const result = {
      success: true,
      data: {
        url: params.url,
        title: metadata.title,
        metadata: {
          ...metadata,
          strategy: params.strategy || 'enhanced_fetch',
          extractedAt: new Date().toISOString(),
          sourceUrl: params.url
        }
      },
      metadata: {
        strategy: params.strategy || 'enhanced_fetch',
        cost: 0.0001,
        responseTime: Date.now() - startTime,
        success: true
      }
    };
    
    // Check for structured extraction request
    const needsStructuredExtraction = params.formats && params.formats.includes('structured') && 
                                    params.extractionInstructions && params.outputSchema;
    
    if (needsStructuredExtraction) {
      console.log('🎯 Structured extraction requested - using plan-based system');
      
      try {
        // Convert HTML to text for plan processing
        const plainTextContent = htmlToText(contentHtml);
        
        // Process with plan-based system
        const skillResult = await processWithPlanBasedSystem(plainTextContent, params);
        
        if (skillResult.success) {
          // Replace the raw content with structured data
          result.data = {
            ...result.data,
            ...skillResult.data, // This is the structured extracted data
            extractionNote: 'Structured extraction applied',
            instructions: params.extractionInstructions,
            postProcessing: params.postProcessing
          };
          
          // Update metadata to reflect plan-based extraction
          result.data.metadata.strategy = 'plan_based_extraction';
          result.data.metadata.skills_used = skillResult.metadata.skills_used;
          result.data.metadata.plan_id = skillResult.metadata.plan_id;
          result.data.metadata.evaluation = skillResult.metadata.evaluation;
          result.data.metadata.confidence = skillResult.metadata.evaluation?.overall_score || 0.5;
          
          // Don't add raw content formats when structured data is returned
          console.log(`✅ Plan-based extraction successful - returned ${Array.isArray(skillResult.data) ? skillResult.data.length : 'structured'} items`);
        } else {
          console.log('❌ Plan-based extraction failed, falling back to raw content');
          // Fall back to regular content extraction
          const content = htmlToText(contentHtml);
          result.data.content = content;
        }
      } catch (error) {
        console.error('Plan-based extraction error:', error);
        // Fall back to regular content extraction
        const content = htmlToText(contentHtml);
        result.data.content = content;
        result.data.extractionError = error.message;
      }
    } else {
      // Regular content extraction
      if (includeMarkdown) {
        const markdown = htmlToMarkdown(contentHtml);
        result.data.markdown = markdown;
        result.data.content = markdown; // Default content field
      } else {
        result.data.content = htmlToText(contentHtml);
      }
    }
    
    if (includeHtml) {
      result.data.html = params.cleanedHtml ? contentHtml : html;
    }
    
    if (includeLinks) {
      result.data.links = extractLinks(html, params.url);
    }
    
    if (includeSummary) {
      result.data.summary = generateSummary(result.data.content);
    }
    
    if (includeJson) {
      result.data.structuredData = extractStructuredData(html);
    }
    
    if (includeScreenshot) {
      // Placeholder for screenshot functionality
      result.data.screenshot = null;
      result.data.screenshotMessage = "Screenshot capture requires browser automation (not available in basic mode)";
    }
    
    // Handle structured format with extraction instructions
    if (formats.includes('structured') && params.extractionInstructions) {
      result.data = processStructuredExtraction(
        html, 
        params.extractionInstructions,
        params.outputSchema,
        params.postProcessing,
        result.data
      );
    }
    
    // Update job with result
    await updateJobStatus(jobId, 'completed', result);
    
    console.log(`Job ${jobId} completed successfully`);
    return result;
    
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  }
}

// Crawl mode - extract multiple pages
async function performCrawl(jobId, params) {
  const startTime = Date.now();
  
  try {
    console.log(`Starting crawl for job ${jobId}:`, params);
    await updateJobStatus(jobId, 'processing');
    
    const maxPages = params.maxPages || 10;
    const maxDepth = params.maxDepth || 2;
    const includeSubdomains = params.includeSubdomains || false;
    
    const baseUrl = new URL(params.url);
    const visited = new Set();
    const toVisit = [{ url: params.url, depth: 0 }];
    const pages = [];
    
    while (toVisit.length > 0 && pages.length < maxPages) {
      const { url, depth } = toVisit.shift();
      
      if (visited.has(url) || depth > maxDepth) continue;
      visited.add(url);
      
      try {
        // Extract the page
        const extractParams = { ...params, url };
        const pageResult = await performExtraction(`${jobId}_page_${pages.length}`, extractParams);
        pages.push(pageResult.data);
        
        // Find links to crawl
        if (depth < maxDepth && pageResult.data.links) {
          for (const link of pageResult.data.links) {
            const linkUrl = new URL(link.href);
            
            // Check if we should crawl this link
            if (linkUrl.hostname === baseUrl.hostname || 
                (includeSubdomains && linkUrl.hostname.endsWith(baseUrl.hostname))) {
              if (!visited.has(link.href)) {
                toVisit.push({ url: link.href, depth: depth + 1 });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Failed to crawl ${url}:`, error);
      }
    }
    
    const result = {
      success: true,
      data: {
        url: params.url,
        pages: pages,
        totalPages: pages.length,
        metadata: {
          strategy: 'crawl',
          extractedAt: new Date().toISOString(),
          maxPages,
          maxDepth
        }
      },
      metadata: {
        strategy: 'crawl',
        cost: 0.0001 * pages.length,
        responseTime: Date.now() - startTime,
        success: true
      }
    };
    
    await updateJobStatus(jobId, 'completed', result);
    return result;
    
  } catch (error) {
    console.error(`Crawl ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  }
}

// Search mode - find specific content
async function performSearch(jobId, params) {
  try {
    console.log(`Starting search for job ${jobId}:`, params);
    await updateJobStatus(jobId, 'processing');
    
    // First extract the page
    const extractResult = await performExtraction(jobId + '_extract', params);
    
    // Search for the query in the content
    const searchQuery = params.searchQuery || params.query || '';
    const content = extractResult.data.content || '';
    const matches = [];
    
    if (searchQuery) {
      const regex = new RegExp(searchQuery, 'gi');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const start = Math.max(0, match.index - 100);
        const end = Math.min(content.length, match.index + searchQuery.length + 100);
        matches.push({
          text: content.substring(start, end),
          index: match.index,
          context: '...' + content.substring(start, end) + '...'
        });
      }
    }
    
    const result = {
      success: true,
      data: {
        ...extractResult.data,
        searchQuery,
        matches,
        matchCount: matches.length
      }
    };
    
    await updateJobStatus(jobId, 'completed', result);
    return result;
    
  } catch (error) {
    console.error(`Search ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  }
}

// Map mode - generate sitemap
async function performMap(jobId, params) {
  try {
    console.log(`Starting map for job ${jobId}:`, params);
    await updateJobStatus(jobId, 'processing');
    
    // Similar to crawl but only collect URLs
    const crawlResult = await performCrawl(jobId + '_crawl', { ...params, formats: ['links'] });
    
    // Build sitemap structure
    const sitemap = {
      url: params.url,
      pages: crawlResult.data.pages.map(page => ({
        url: page.url,
        title: page.title,
        links: page.links ? page.links.length : 0
      }))
    };
    
    const result = {
      success: true,
      data: {
        url: params.url,
        sitemap,
        totalPages: sitemap.pages.length,
        metadata: {
          strategy: 'map',
          extractedAt: new Date().toISOString()
        }
      }
    };
    
    await updateJobStatus(jobId, 'completed', result);
    return result;
    
  } catch (error) {
    console.error(`Map ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  }
}

// Lambda handler for SQS events
exports.handler = async (event) => {
  console.log('Enhanced Worker received event:', JSON.stringify(event, null, 2));
  
  const results = [];
  
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const { jobId, type, params } = message;
      
      console.log(`Processing ${type} job: ${jobId}`);
      
      let result;
      switch (type) {
        case 'extract':
        case 'scrape':
          result = await performExtraction(jobId, params);
          break;
          
        case 'crawl':
          result = await performCrawl(jobId, params);
          break;
          
        case 'search':
          result = await performSearch(jobId, params);
          break;
          
        case 'map':
          result = await performMap(jobId, params);
          break;
          
        default:
          throw new Error(`Unknown job type: ${type}`);
      }
      
      results.push({
        jobId,
        status: 'success',
        result
      });
      
    } catch (error) {
      console.error('Failed to process record:', error);
      results.push({
        messageId: record.messageId,
        status: 'error',
        error: error.message
      });
    }
  }
  
  // Return batch failures for SQS retry handling
  const failedMessages = results
    .filter(r => r.status === 'error')
    .map(r => ({ itemIdentifier: r.messageId }));
  
  console.log(`Processed ${results.length} messages, ${failedMessages.length} failures`);
  
  return {
    batchItemFailures: failedMessages
  };
};

/**
 * Test function for plan-based system - tests end-to-end execution
 */
async function testPlanBasedSystem() {
  console.log('🧪 Testing plan-based extraction system with real VMOTA data...');
  
  const vmotaHtml = `
    <html>
      <body>
        <div class="staff">
          <h2>Staff</h2>
          
          <div class="staff-member">
            <h3>Katrina Bruins</h3>
            <p class="title">Executive Director</p>
            <p class="bio">Katrina is a seasoned nonprofit leader with over a decade of experience in operations, program administration, and community partnership building. As Executive Director of VMOTA, she is passionate about using textile arts as a bridge to connect people, celebrate diverse perspectives, and inspire meaningful dialogue. With a background in leading humanitarian and cultural initiatives, Katrina has supported organizations through thoughtful strategy, mission-driven leadership, and a deep commitment to collaboration. She is SHRM-certified, holds a Master's in Spiritual Formation and Soul Care, and strives to cultivate long-term partnerships that enrich communities and elevate the power of art to tell stories that matter.</p>
          </div>
          
          <div class="staff-member">
            <h3>Lauryn Dove</h3>
            <p class="title">Administrative Assistant</p>
            <p class="bio">Lauryn is a visual artist with a teaching background. While working as a Curatorial and Education Assistant at the Bowdoin College Museum of Art, Lauryn fell in love with museums as cultural institutions. Lauryn's passion for the arts along with her experience in education coordination makes the Visions Museum of Textile Art the perfect place to call home. When she is not painting, Lauryn enjoys swimming in the ocean, eating delicious food, and being active.</p>
          </div>
          
          <div class="staff-member">
            <h3>Joel Ellazar</h3>
            <p class="title">Marketing Specialist</p>
            <p class="bio">Joel is a marketing professional who has worked in various industries over the past 20 years ranging from technology to consumer goods and medical to government contracts with companies like Buck Knives and Cosmetic Laser Dermatology. He is currently the marketing and communication specialist at Cygnet Theatre. His experience and skills will take VMOTA's marketing, social media, and public relations to the next level.</p>
          </div>
          
          <div class="staff-member">
            <h3>Armando Garcia</h3>
            <p class="title">Curatorial and Education Manager</p>
            <p class="bio">Formerly the Galleries Director of Baja Califonia Culture's Institute and the Deputy Director of Exhibitions at the Tijuana Cultural Center (CECUT), Armando is an experienced and dedicated professional in the world of fine arts. After graduating with a degree in architecture from the Western Technological and Higher Studies Institute (ITESO) of Guadalajara, Jalisco, Armando founded and directed the Rio Rita Art Gallery and Cultural Association in addition to serving as the Deputy Director of the Municipal Institute of Art and Culture (IMAC) in Tijuana, BC.</p>
          </div>
          
          <div class="staff-member">
            <h3>Jane La Motte</h3>
            <p class="title">Website Manager</p>
            <p class="bio">Jane comes to VMOTA after many years in two fields of design, theatrical set design and website development. Prior to working at the Museum, she launched The William & Ruby Hinson Photo Archive, a website developed to exhibit a personal collection of 1000+ slides, as well as sites for local artists and entrepreneurs, including textile artist Heather Urquhart. She has a B.A. in Philosophy & Mathematics from Yale University, an M.F.A. in Set Design from Virginia Tech, and Certifications I & II in Front End Web Design from San Diego College of Continuing Education.</p>
          </div>
          
          <div class="staff-member">
            <h3>Nilufer Leuthold</h3>
            <p class="title">Director of Development</p>
            <p class="bio">Nilufer has over 20 years of experience in international relations and diplomacy, starting her career at embassies overseas as the executive assistant to the ambassador and a diplomatic programs manager. She has worked extensively with the United Nations, particularly with UNICEF and UNHCR, supporting refugees and vulnerable populations, focusing on women and children. Additionally, she managed U.S. Department of State exchange programs in Nevada and Utah, overseeing international partnerships and fostering global collaboration. Nilufer served as a Global Ties U.S. DEIA committee member for three years, during which she was recognized with the Network Innovation Award for her contributions to advancing diversity, equity, inclusion, and accessibility. She brings a wealth of experience in program management, development, event planning, strategic partnerships, and intercultural communication and dialogue to support VMOTA in engaging diverse communities through art. Nilufer holds a B.A. in Business Studies from the Sudan University of Science and Technology and an M.A. in International Relations and Conflict Resolution, focusing on security issues in the Middle East and North Africa from the American Public University. Nilufer enjoys outdoor adventures with her husband and son.</p>
          </div>
          
          <h3>Board of Directors</h3>
          <div class="board-members">
            <p>Betty Colburn</p>
            <p>Barbara Dodson</p>
            <p>Sabrina Evans, Secretary</p>
            <p>Carrie Frederick, Treasurer</p>
            <p>Ann Olsen, Board Chair</p>
            <p>Gretchen Rhoads</p>
            <p>Christine Sharp</p>
            <p>Patty Usher</p>
          </div>
        </div>
      </body>
    </html>
  `;
  
  const testParams = {
    url: 'https://vmota.org/people/',
    extractionInstructions: 'Extract staff member information including name, title, and bio from the VMOTA staff page',
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
          bio: { type: 'string' }
        }
      }
    }
  };
  
  try {
    const result = await processWithPlanBasedSystem(vmotaHtml, testParams);
    
    console.log('🎉 Test Results:');
    console.log('Success:', result.success);
    console.log('Data items:', Array.isArray(result.data) ? result.data.length : typeof result.data);
    console.log('Plan ID:', result.metadata?.plan_id);
    console.log('Skills used:', result.metadata?.skills_used);
    console.log('Evaluation score:', result.metadata?.evaluation?.overall_score);
    
    if (result.success && result.data) {
      console.log('Sample extracted data:', JSON.stringify(result.data.slice ? result.data.slice(0, 2) : result.data, null, 2));
    }
    
    if (result.metadata?.evaluation?.issues?.length > 0) {
      console.log('Issues identified:', result.metadata.evaluation.issues);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
}

// Export test function for manual testing
if (require.main === module) {
  testPlanBasedSystem().then(result => {
    console.log('\n📋 Final test result:', result.success ? '✅ PASSED' : '❌ FAILED');
    process.exit(result.success ? 0 : 1);
  });
}

// Export for use in other modules
module.exports = {
  processWithPlanBasedSystem,
  PlanExecutor,
  BasicPlanner,
  SimpleEvaluator,
  testPlanBasedSystem
};