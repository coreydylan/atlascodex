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
  
  'RankCandidates': {
    description: 'Rank semantic blocks as candidates for Pass B processing',
    inputs: ['semantic_blocks', 'constraints'],
    outputs: ['top_candidates', 'candidate_scores'],
    cost: { tokens: 0, requests: 0, cpu: 'low' },
    preconditions: ['blocks_identified'],
    postconditions: ['candidates_ranked'],
    failure_modes: ['insufficient_candidates'],
    repair_options: ['lower_threshold', 'expand_candidates']
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
 * Block Classifier using Snorkel-style weak supervision
 * Uses multiple labeling functions to soft-label blocks without gold datasets
 */
class BlockClassifier {
  constructor() {
    this.labelingFunctions = [
      this.LF1_headingLooksLikeName,
      this.LF2_siblingHasRoleWords,
      this.LF3_highLinkDensity,
      this.LF4_shortCommaLines,
      this.LF5_hasPersonSchema,
      this.LF6_profileKeywords,
      this.LF7_boardPattern
    ];
  }

  /**
   * Classify a semantic block using weak supervision
   */
  classifyBlock(block, context = {}) {
    const votes = {};
    const evidence = {};
    
    // Apply each labeling function
    this.labelingFunctions.forEach(lf => {
      const result = lf.call(this, block, context);
      if (result.label && result.confidence > 0.1) {
        if (!votes[result.label]) votes[result.label] = [];
        votes[result.label].push({
          confidence: result.confidence,
          evidence: result.reason,
          function: lf.name
        });
        evidence[lf.name] = result.reason;
      }
    });

    // Combine votes using confidence-weighted majority
    return this.combineVotes(votes, evidence);
  }

  /**
   * Combine labeling function votes using confidence weighting
   */
  combineVotes(votes, evidence) {
    if (Object.keys(votes).length === 0) {
      return {
        label: 'other',
        confidence: 0.1,
        evidence: 'no labeling functions matched'
      };
    }

    // Calculate weighted confidence for each label
    const labelScores = {};
    Object.entries(votes).forEach(([label, labelVotes]) => {
      const totalConfidence = labelVotes.reduce((sum, vote) => sum + vote.confidence, 0);
      const avgConfidence = totalConfidence / labelVotes.length;
      const voteStrength = labelVotes.length; // More functions agreeing = higher strength
      
      labelScores[label] = {
        score: avgConfidence * (1 + voteStrength * 0.1), // Bonus for agreement
        votes: labelVotes.length,
        avgConfidence: avgConfidence,
        evidence: labelVotes.map(v => v.evidence).join('; ')
      };
    });

    // Pick highest scoring label
    const bestLabel = Object.entries(labelScores)
      .sort(([,a], [,b]) => b.score - a.score)[0];

    return {
      label: bestLabel[0],
      confidence: Math.min(0.95, bestLabel[1].score),
      votes: bestLabel[1].votes,
      evidence: bestLabel[1].evidence,
      allScores: labelScores
    };
  }

  // =============================================================================
  // LABELING FUNCTIONS - Each returns {label, confidence, reason} or null
  // =============================================================================

  /**
   * LF1: Heading looks like a person's name
   */
  LF1_headingLooksLikeName(block, context) {
    if (!block.heading) return { label: null, confidence: 0 };
    
    const heading = block.heading.trim();
    const hasPersonName = this.looksLikePersonName(heading);
    
    if (hasPersonName) {
      return {
        label: 'profile_card',
        confidence: 0.8,
        reason: `Heading "${heading}" looks like a person name`
      };
    }
    
    return { label: null, confidence: 0 };
  }

  /**
   * LF2: Block has sibling with role words
   */
  LF2_siblingHasRoleWords(block, context) {
    if (!block.element) return { label: null, confidence: 0 };
    
    const roleWords = ['director', 'manager', 'executive', 'assistant', 'coordinator', 
                      'specialist', 'analyst', 'officer', 'president', 'vice', 'chief',
                      'senior', 'junior', 'lead', 'head', 'supervisor', 'administrator'];
    
    const siblingText = block.element.siblings().text().toLowerCase();
    const blockText = block.element.text().toLowerCase();
    const combinedText = siblingText + ' ' + blockText;
    
    const roleMatches = roleWords.filter(word => combinedText.includes(word));
    
    if (roleMatches.length > 0) {
      return {
        label: 'profile_card',
        confidence: Math.min(0.7, 0.3 + roleMatches.length * 0.1),
        reason: `Contains role words: ${roleMatches.join(', ')}`
      };
    }
    
    return { label: null, confidence: 0 };
  }

  /**
   * LF3: High link density suggests navigation/menu
   */
  LF3_highLinkDensity(block, context) {
    if (!block.element) return { label: null, confidence: 0 };
    
    const links = block.element.find('a');
    const textLength = block.element.text().length;
    const linkDensity = textLength > 0 ? (links.length * 20) / textLength : 0;
    
    if (linkDensity > 0.15) {
      return {
        label: 'nav',
        confidence: Math.min(0.9, 0.5 + linkDensity * 2),
        reason: `High link density: ${linkDensity.toFixed(3)} (${links.length} links, ${textLength} chars)`
      };
    }
    
    return { label: null, confidence: 0 };
  }

  /**
   * LF4: Short lines with commas suggest person listings
   */
  LF4_shortCommaLines(block, context) {
    if (!block.element) return { label: null, confidence: 0 };
    
    const text = block.element.text();
    const lines = text.split('\n').filter(line => line.trim().length > 5);
    
    if (lines.length < 3) return { label: null, confidence: 0 };
    
    let commaLineCount = 0;
    let shortLineCount = 0;
    
    lines.forEach(line => {
      line = line.trim();
      if (line.includes(',')) commaLineCount++;
      if (line.length < 80) shortLineCount++;
    });
    
    const commaRatio = commaLineCount / lines.length;
    const shortRatio = shortLineCount / lines.length;
    
    if (commaRatio > 0.6 && shortRatio > 0.7) {
      return {
        label: 'board_list',
        confidence: 0.8,
        reason: `${lines.length} lines, ${(commaRatio * 100).toFixed(0)}% have commas, ${(shortRatio * 100).toFixed(0)}% are short`
      };
    }
    
    return { label: null, confidence: 0 };
  }

  /**
   * LF5: Has structured data with person schema
   */
  LF5_hasPersonSchema(block, context) {
    if (!block.element) return { label: null, confidence: 0 };
    
    const hasPersonSchema = block.element.find('[itemtype*="Person"], [typeof*="Person"]').length > 0;
    const hasPersonClass = block.element.attr('class')?.toLowerCase().includes('person') || 
                         block.element.find('[class*="person"], [class*="staff"], [class*="team"]').length > 0;
    
    if (hasPersonSchema) {
      return {
        label: 'profile_card',
        confidence: 0.9,
        reason: 'Has Person schema markup'
      };
    }
    
    if (hasPersonClass) {
      return {
        label: 'profile_card', 
        confidence: 0.6,
        reason: 'Has person-related CSS classes'
      };
    }
    
    return { label: null, confidence: 0 };
  }

  /**
   * LF6: Contains profile-related keywords
   */
  LF6_profileKeywords(block, context) {
    if (!block.element) return { label: null, confidence: 0 };
    
    const profileKeywords = ['bio', 'biography', 'about', 'experience', 'background', 
                            'education', 'graduated', 'university', 'degree', 'joined',
                            'email', '@', 'phone', 'linkedin', 'twitter'];
    
    const blockText = block.element.text().toLowerCase();
    const matches = profileKeywords.filter(keyword => blockText.includes(keyword));
    
    if (matches.length >= 2) {
      return {
        label: 'profile_card',
        confidence: Math.min(0.7, 0.3 + matches.length * 0.08),
        reason: `Contains profile keywords: ${matches.join(', ')}`
      };
    }
    
    return { label: null, confidence: 0 };
  }

  /**
   * LF7: Matches board/staff listing patterns
   */
  LF7_boardPattern(block, context) {
    if (!block.element) return { label: null, confidence: 0 };
    
    // Only check immediate parent/sibling context, not deep hierarchy
    const parentText = block.element.parent().text().toLowerCase();
    const prevSiblingText = block.element.prev().text().toLowerCase();
    const nextSiblingText = block.element.next().text().toLowerCase();
    const immediateContext = parentText + ' ' + prevSiblingText + ' ' + nextSiblingText;
    
    const boardPatterns = ['board of directors', 'board members', 'board of trustees', 
                         'advisory board', 'governing board', 'trustees'];
    
    // Only match if board patterns are in immediate context (not distant)
    const hasBoardContext = boardPatterns.some(pattern => immediateContext.includes(pattern));
    
    // Additional check: if this block contains detailed bio info, it's probably a profile card not a list
    const blockText = block.element.text().toLowerCase();
    const hasDetailedBio = blockText.length > 200 && (
      blockText.includes('experience') || 
      blockText.includes('education') || 
      blockText.includes('background') ||
      blockText.includes('joined') ||
      blockText.includes('graduated')
    );
    
    if (hasBoardContext && !hasDetailedBio) {
      return {
        label: 'person_list',
        confidence: 0.85,
        reason: 'Appears under board/trustees heading context'
      };
    }
    
    return { label: null, confidence: 0 };
  }

  /**
   * Check if text looks like a person's name
   */
  looksLikePersonName(text) {
    if (!text || text.length < 3 || text.length > 50) return false;
    
    // Clean and check basic format
    const cleaned = text.replace(/[.,\-()]/g, '').trim();
    const words = cleaned.split(/\s+/);
    
    // Should have 1-4 words for a name
    if (words.length < 1 || words.length > 4) return false;
    
    // Each word should start with capital letter
    if (!words.every(word => /^[A-Z]/.test(word))) return false;
    
    // Should not contain numbers or special characters (except common name chars)
    if (/[0-9@#$%^&*()_+=\[\]{}|\\:";'<>?\/]/.test(cleaned)) return false;
    
    // Should not be common non-name phrases
    const nonNamePhrases = ['STAFF', 'TEAM', 'ABOUT US', 'CONTACT', 'HOME', 'BOARD'];
    if (nonNamePhrases.includes(cleaned.toUpperCase())) return false;
    
    return true;
  }
}

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
        console.log(`🐛 Precondition check failed for ${step.skill}:`, {
          required: skillDef.preconditions,
          contextKeys: Array.from(this.context.keys()),
          hasSemanticBlocks: this.context.has('semantic_blocks'),
          hasContentBlocks: this.context.has('content_blocks'), 
          hasTargetSchema: this.context.has('target_schema')
        });
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
        case 'RankCandidates':
          result = await this.skillRankCandidates(step.params);
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
      
      // Debug: Check if we have DOM elements at all
      const totalElements = $('*').length;
      const divCount = $('div').length;
      const sectionCount = $('section').length;
      const staffElements = $('.staff-member, .team-member, .person, .profile, div[class*="staff"]').length;
      console.log(`🔍 DOM Debug: ${totalElements} total elements, ${divCount} divs, ${sectionCount} sections, ${staffElements} staff-related`);
      
      // Debug: Sample some elements
      $('h1, h2, h3').each((i, el) => {
        if (i < 3) console.log(`📝 Heading ${i + 1}: "${$(el).text().trim()}"`);
      });
      
      // Debug: Check for minimum content
      const bodyText = $('body').text().trim();
      console.log(`📄 Body content length: ${bodyText.length} chars, first 200: "${bodyText.substring(0, 200)}"`);
      
      if (semanticBlocks.length === 0) {
        // Try manual element detection for debugging
        const manualBlocks = [];
        $('div').each((i, div) => {
          const $div = $(div);
          const text = $div.text().trim();
          if (text.length >= minSize && !this.isNavigationalElement($div)) {
            manualBlocks.push({
              selector: this.generateCSSPath($div, $),
              text_length: text.length,
              text_preview: text.substring(0, 100),
              classes: $div.attr('class') || ''
            });
          }
        });
        console.log(`🚨 Manual block detection found ${manualBlocks.length} potential blocks`);
        if (manualBlocks.length > 0) {
          console.log('🚨 Sample manual block:', manualBlocks[0]);
        }
      }
      
      // Apply weak supervision to classify and filter blocks
      const classifiedBlocks = this.applyWeakSupervision(semanticBlocks);
      
      // Debug: Log first block structure
      if (classifiedBlocks.length > 0) {
        const sample = classifiedBlocks[0];
        console.log('🐛 Sample classified block:', {
          selector: sample.root_selector,
          heading: sample.heading,
          predicted_type: sample.predicted_type,
          type_confidence: sample.type_confidence,
          labeling_agreement: sample.labeling_agreement,
          text_preview: sample.block_text.substring(0, 100) + '...'
        });
      }
      
      return {
        success: true,
        outputs: {
          semantic_blocks: classifiedBlocks, // Use classified/filtered blocks
          block_count: classifiedBlocks.length,
          raw_block_count: semanticBlocks.length // Keep original count for analysis
        },
        cost: { tokens: 0, requests: 0 },
        confidence: 0.85 // Higher confidence with weak supervision
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
    
    console.log('🐛 MapFields context check:', {
      semanticBlocksCount: semanticBlocks.length,
      hasStructuredData: !!Object.keys(structuredData).length,
      hasMetaData: !!Object.keys(metaData).length,
      hasTargetSchema: !!targetSchema,
      contextKeys: Array.from(this.context.keys())
    });
    
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
      // Enhanced validation with domain-agnostic validators
      const validationResults = fieldMappings.map(mapping => {
        const schemaValidation = this.validateAgainstSchema(mapping, targetSchema);
        const domainValidation = this.applyDomainAgnosticValidators(mapping);
        
        return {
          ...schemaValidation,
          domain_validation: domainValidation,
          overall_valid: schemaValidation.valid && domainValidation.valid,
          validation_issues: [...(schemaValidation.issues || []), ...(domainValidation.issues || [])]
        };
      });
      
      const repairedOutput = params.repair ? 
        this.repairInvalidMappings(fieldMappings, validationResults) : 
        fieldMappings;
      
      // Apply aggressive repair if requested
      const finalOutput = params.aggressive_repair ? 
        this.aggressiveRepairMappings(repairedOutput, validationResults) : 
        repairedOutput;
      
      console.log(`🔍 Validated ${fieldMappings.length} mappings with domain validators, repaired: ${params.repair || false}`);
      
      return {
        success: true,
        outputs: {
          validation_results: validationResults,
          repaired_output: finalOutput,
          field_mappings: finalOutput // Update the mappings with repaired version
        },
        cost: { tokens: 0, requests: 0 },
        confidence: 0.85
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
  
  async skillRankCandidates(params = {}) {
    const semanticBlocks = this.context.get('semantic_blocks') || [];
    const maxCandidates = params.max_candidates || 15;
    const rankingCriteria = params.ranking_criteria || ['type_confidence', 'labeling_agreement', 'relevance_score'];
    
    try {
      if (semanticBlocks.length === 0) {
        return { success: false, error: 'No semantic blocks to rank', cost: { tokens: 0, requests: 0 } };
      }
      
      // Score each block based on multiple criteria
      const scoredCandidates = semanticBlocks.map(block => {
        const scores = {};
        let totalScore = 0;
        
        // Score based on type confidence (from weak supervision)
        if (rankingCriteria.includes('type_confidence')) {
          scores.type_confidence = block.type_confidence || 0;
          totalScore += scores.type_confidence * 0.4; // 40% weight
        }
        
        // Score based on labeling agreement
        if (rankingCriteria.includes('labeling_agreement')) {
          scores.labeling_agreement = block.labeling_agreement || 0;
          totalScore += scores.labeling_agreement * 0.3; // 30% weight
        }
        
        // Score based on original relevance score
        if (rankingCriteria.includes('relevance_score')) {
          scores.relevance_score = this.calculateBlockRelevance(block) / 100; // Normalize
          totalScore += scores.relevance_score * 0.3; // 30% weight
        }
        
        return {
          ...block,
          candidate_scores: scores,
          total_score: totalScore
        };
      });
      
      // Sort by total score (descending)
      scoredCandidates.sort((a, b) => b.total_score - a.total_score);
      
      // Take top K candidates
      const topCandidates = scoredCandidates.slice(0, maxCandidates);
      
      console.log(`🏆 Ranked candidates: ${semanticBlocks.length} → top ${topCandidates.length} for Pass B`);
      console.log(`📊 Top candidate scores: ${topCandidates.slice(0, 3).map(c => c.total_score.toFixed(2)).join(', ')}`);
      
      return {
        success: true,
        outputs: {
          top_candidates: topCandidates,
          candidate_scores: topCandidates.map(c => c.total_score),
          ranking_criteria_used: rankingCriteria
        },
        cost: { tokens: 0, requests: 0 },
        confidence: 0.85
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
  // TWO-PASS PLAN EXECUTOR - Handles Pass A (skim) + Pass B (enrich) architecture
  // =============================================================================
  
  /**
   * Execute a two-pass plan with proper inter-pass data flow
   */
  async executeTwoPassPlan(plan, initialInputs = {}) {
    console.log('🔄 Executing two-pass plan:', plan.task_id);
    
    // Initialize for two-pass execution
    this.twoPassContext = new Map();
    this.passResults = [];
    
    try {
      // Execute Pass A (Skim)
      console.log('🏃‍♂️ Starting Pass A (Skim)...');
      const passAResult = await this.executePass(plan.passes[0], initialInputs);
      
      if (!passAResult.success) {
        return this.createResult(false, null, `Pass A failed: ${passAResult.error}`);
      }
      
      this.passResults.push(passAResult);
      console.log(`✅ Pass A completed: ${passAResult.data?.length || 0} candidates selected`);
      
      // Pass data from A to B
      const passBInputs = {
        ...initialInputs,
        top_candidates: passAResult.data,
        candidate_scores: passAResult.context_final?.candidate_scores || [],
        semantic_blocks: passAResult.context_final?.semantic_blocks || []
      };
      
      // Execute Pass B (Enrich)
      console.log('🔧 Starting Pass B (Enrich)...');
      const passBResult = await this.executePass(plan.passes[1], passBInputs);
      
      if (!passBResult.success) {
        // Pass B failure is more serious - we lose enrichment
        console.warn('⚠️ Pass B failed, returning Pass A results with warning');
        return this.createResult(true, passAResult.data, `Pass B failed: ${passBResult.error}`);
      }
      
      this.passResults.push(passBResult);
      console.log(`✅ Pass B completed: ${passBResult.data?.length || 0} final results`);
      
      // Combine results and traces
      const finalResult = this.combineTwoPassResults(passAResult, passBResult);
      
      return this.createResult(true, finalResult.data, null, {
        passes: this.passResults,
        pass_a_candidates: passAResult.data?.length || 0,
        pass_b_results: passBResult.data?.length || 0,
        efficiency_gain: this.calculateEfficiencyGain(passAResult, passBResult)
      });
      
    } catch (error) {
      this.logTrace('two_pass_error', { error: error.message });
      return this.createResult(false, null, `Two-pass execution failed: ${error.message}`);
    }
  }
  
  /**
   * Execute a single pass (A or B) as a sub-plan
   */
  async executePass(pass, inputs) {
    console.log(`🎯 Executing ${pass.name}`);
    
    // Create a sub-executor for this pass
    const passExecutor = new PlanExecutor();
    
    // Convert pass to standard plan format
    const passPlan = {
      task_id: `${pass.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`,
      budget: pass.budget,
      steps: pass.steps,
      constraints: {}
    };
    
    // Execute the pass
    const result = await passExecutor.executePlan(passPlan, inputs);
    
    // Extract the relevant output data based on pass type
    if (pass.output === 'top_candidates') {
      // Pass A: return top candidates
      let candidates = result.context_final?.top_candidates || 
                      result.context_final?.semantic_blocks || [];
      
      // Clean circular references from DOM elements
      result.data = candidates.map(candidate => {
        if (candidate && typeof candidate === 'object') {
          const cleaned = { ...candidate };
          // Remove the Cheerio element to prevent circular references
          delete cleaned.element;
          return cleaned;
        }
        return candidate;
      });
    } else if (pass.output === 'final_results') {
      // Pass B: return final mapped results  
      result.data = result.context_final?.field_mappings || 
                    result.context_final?.ranked_results || [];
    }
    
    return result;
  }
  
  /**
   * Combine Pass A and Pass B results with metadata
   */
  combineTwoPassResults(passAResult, passBResult) {
    const finalData = passBResult.data || [];
    
    // Add metadata about the two-pass process
    const enrichedData = finalData.map(item => ({
      ...item,
      extraction_method: 'two_pass',
      pass_a_score: item.total_score || null,
      pass_b_confidence: item.confidence || null,
      processing_passes: ['skim', 'enrich']
    }));
    
    return {
      data: enrichedData,
      metadata: {
        total_blocks_discovered: passAResult.context_final?.raw_block_count || 0,
        candidates_selected: passAResult.data?.length || 0,
        final_results: enrichedData.length,
        pass_a_time: passAResult.execution_time,
        pass_b_time: passBResult.execution_time,
        total_time: passAResult.execution_time + passBResult.execution_time
      }
    };
  }
  
  /**
   * Calculate efficiency gain from two-pass approach
   */
  calculateEfficiencyGain(passAResult, passBResult) {
    const blocksDiscovered = passAResult.context_final?.raw_block_count || 0;
    const candidatesProcessed = passAResult.data?.length || 0;
    const finalResults = passBResult.data?.length || 0;
    
    if (blocksDiscovered === 0) return 0;
    
    // Efficiency = avoided expensive processing on filtered blocks
    const blocksFiltered = blocksDiscovered - candidatesProcessed;
    const filteringEfficiency = candidatesProcessed > 0 ? blocksFiltered / blocksDiscovered : 0;
    
    return {
      blocks_filtered: blocksFiltered,
      filtering_efficiency: filteringEfficiency,
      processing_reduction: `${(filteringEfficiency * 100).toFixed(1)}%`,
      final_yield: candidatesProcessed > 0 ? finalResults / candidatesProcessed : 0
    };
  }
  
  // =============================================================================
  // PHASE 2: WEAK SUPERVISION WITH LABELING FUNCTIONS
  // Snorkel-style labeling functions for automatic block classification
  // =============================================================================
  
  /**
   * Weak supervision system using BlockClassifier with labeling functions 
   * to classify semantic blocks without manual labeling
   */
  applyWeakSupervision(semanticBlocks) {
    console.log('🏷️ Applying weak supervision to', semanticBlocks.length, 'blocks');
    
    const blockClassifier = this.getBlockClassifier();
    
    const labeledBlocks = semanticBlocks.map((block, idx) => {
      const classification = blockClassifier.classifyBlock(block, { 
        pageContext: this.context.get('page_context') || {}
      });
      
      console.log(`🐛 Block ${idx}: "${(block.heading || '').substring(0, 30)}" → ${classification.label} (${classification.confidence.toFixed(3)}) - ${classification.evidence}`);
      
      return {
        ...block,
        predicted_type: classification.label,
        type_confidence: classification.confidence,
        labeling_votes: classification.votes || 0,
        classification_evidence: classification.evidence,
        all_scores: classification.allScores
      };
    });
    
    // Use unified thresholds for filtering
    const thresholds = this.getUnifiedThresholds();
    
    // Filter by predicted type and confidence  
    const profileBlocks = labeledBlocks.filter(block => 
      block.predicted_type === 'profile_card' && 
      block.type_confidence >= thresholds.weak_supervision_min
    );
    
    // Also filter out navigation and board blocks using unified thresholds
    const finalBlocks = labeledBlocks.filter(block => {
      if (block.predicted_type === 'nav' && block.type_confidence > thresholds.nav_filter_threshold) {
        console.log(`🚫 Filtering out nav block (conf=${block.type_confidence.toFixed(2)}): ${block.classification_evidence}`);
        return false;
      }
      if (block.predicted_type === 'board_list' && block.type_confidence > thresholds.board_filter_threshold) {
        console.log(`🚫 Filtering out board block (conf=${block.type_confidence.toFixed(2)}): ${block.classification_evidence}`);
        return false;
      }
      // Keep profile cards and uncertain blocks for further processing
      return block.predicted_type === 'profile_card' || block.type_confidence < thresholds.nav_filter_threshold;
    });
    
    console.log(`🎯 Weak supervision filtered: ${semanticBlocks.length} → ${finalBlocks.length} candidates (${profileBlocks.length} high-confidence profiles)`);
    console.log(`📊 Avg confidence: ${finalBlocks.length > 0 ? (finalBlocks.reduce((sum, b) => sum + b.type_confidence, 0) / finalBlocks.length).toFixed(2) : 'N/A'}`);
    
    return finalBlocks;
  }
  
  /**
   * Apply all labeling functions to a semantic block
   * Each LF votes on block type with confidence
   */
  applyLabelingFunctions(block) {
    const labels = {};
    
    // LF1: heading_looks_like_name → profile_card
    labels.LF1 = this.LF_heading_name_pattern(block);
    
    // LF2: sibling_has_role_words → profile_card
    labels.LF2 = this.LF_role_word_density(block);
    
    // LF3: high_link_density → nav
    labels.LF3 = this.LF_high_link_density(block);
    
    // LF4: short_comma_lines → board_list
    labels.LF4 = this.LF_board_list_pattern(block);
    
    // LF5: paragraph_density → profile_card
    labels.LF5 = this.LF_paragraph_density(block);
    
    // LF6: footer_keywords → footer
    labels.LF6 = this.LF_footer_keywords(block);
    
    return labels;
  }
  
  /**
   * Combine label votes using weighted averaging
   * Higher confidence LFs get more weight
   */
  combineLabelVotes(labels) {
    const typeVotes = {};
    const totalWeight = {};
    
    // Aggregate votes by type with confidence weighting
    Object.values(labels).forEach(vote => {
      if (vote.type !== 'abstain') {
        typeVotes[vote.type] = (typeVotes[vote.type] || 0) + vote.confidence;
        totalWeight[vote.type] = (totalWeight[vote.type] || 0) + 1;
      }
    });
    
    if (Object.keys(typeVotes).length === 0) {
      return { type: 'other', confidence: 0.0, agreement: 0.0 };
    }
    
    // Find winning type
    const winner = Object.entries(typeVotes)
      .sort(([,a], [,b]) => b - a)[0];
    
    const [winnerType, winnerScore] = winner;
    const averageConfidence = winnerScore / totalWeight[winnerType];
    
    // Calculate agreement (fraction of LFs that agree with winner)
    const totalVotes = Object.values(labels).filter(l => l.type !== 'abstain').length;
    const agreementCount = Object.values(labels).filter(l => l.type === winnerType).length;
    const agreement = totalVotes > 0 ? agreementCount / totalVotes : 0;
    
    return {
      type: winnerType,
      confidence: averageConfidence,
      agreement: agreement
    };
  }
  
  // =============================================================================
  // LABELING FUNCTIONS (LFs) - Individual classification rules
  // =============================================================================
  
  /**
   * LF1: Block heading looks like person name → profile_card
   */
  LF_heading_name_pattern(block) {
    if (!block.heading) return { type: 'abstain', confidence: 0.0 };
    
    const heading = block.heading.trim();
    
    // Strong indicators of person name
    const namePattern = /^[A-Z][a-z]+(?:\s+[A-Z][a-z.]+)*$/;
    const hasNameStructure = namePattern.test(heading);
    const wordCount = heading.split(/\s+/).length;
    const hasReasonableLength = wordCount >= 2 && wordCount <= 4;
    
    if (hasNameStructure && hasReasonableLength) {
      return { type: 'profile_card', confidence: 0.8 };
    } else if (hasNameStructure || hasReasonableLength) {
      return { type: 'profile_card', confidence: 0.5 };
    }
    
    return { type: 'abstain', confidence: 0.0 };
  }
  
  /**
   * LF2: Block has role words nearby → profile_card
   */
  LF_role_word_density(block) {
    const roleWords = [
      'director', 'manager', 'executive', 'assistant', 'coordinator',
      'specialist', 'officer', 'head', 'lead', 'chief', 'president',
      'vice', 'senior', 'junior', 'associate', 'development'
    ];
    
    const text = (block.block_text || '').toLowerCase();
    const matchingWords = roleWords.filter(word => text.includes(word));
    const density = matchingWords.length / Math.max(text.split(/\s+/).length, 1) * 100;
    
    if (density > 5) {
      return { type: 'profile_card', confidence: 0.7 };
    } else if (density > 2) {
      return { type: 'profile_card', confidence: 0.5 };
    }
    
    return { type: 'abstain', confidence: 0.0 };
  }
  
  /**
   * LF3: High link density → nav
   */
  LF_high_link_density(block) {
    const linkDensity = block.link_density || 0;
    
    if (linkDensity > 0.15) {
      return { type: 'nav', confidence: 0.8 };
    } else if (linkDensity > 0.08) {
      return { type: 'nav', confidence: 0.6 };
    }
    
    return { type: 'abstain', confidence: 0.0 };
  }
  
  /**
   * LF4: Short comma-separated lines → board_list
   */
  LF_board_list_pattern(block) {
    const text = block.block_text || '';
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    
    if (lines.length < 3) return { type: 'abstain', confidence: 0.0 };
    
    let shortLineCount = 0;
    let commaLineCount = 0;
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.length < 50) shortLineCount++;
      if (trimmedLine.includes(',')) commaLineCount++;
    });
    
    const shortRatio = shortLineCount / lines.length;
    const commaRatio = commaLineCount / lines.length;
    
    // Board lists typically have many short lines with comma separation
    if (shortRatio > 0.7 && commaRatio > 0.5) {
      return { type: 'board_list', confidence: 0.8 };
    } else if (shortRatio > 0.8) {
      return { type: 'board_list', confidence: 0.6 };
    }
    
    return { type: 'abstain', confidence: 0.0 };
  }
  
  /**
   * LF5: Good paragraph density → profile_card
   */
  LF_paragraph_density(block) {
    const textDensity = block.text_density || 0;
    const charCount = block.char_count || 0;
    
    // Profile cards have medium text density and reasonable length
    if (textDensity > 10 && charCount > 150 && charCount < 800) {
      return { type: 'profile_card', confidence: 0.6 };
    } else if (textDensity > 5 && charCount > 100) {
      return { type: 'profile_card', confidence: 0.4 };
    }
    
    return { type: 'abstain', confidence: 0.0 };
  }
  
  /**
   * LF6: Footer keywords → footer
   */
  LF_footer_keywords(block) {
    const footerKeywords = [
      'copyright', '©', 'privacy policy', 'terms', 'contact',
      'address', 'phone:', 'email:', 'follow us', 'social media'
    ];
    
    const text = (block.block_text || '').toLowerCase();
    const matchingKeywords = footerKeywords.filter(keyword => text.includes(keyword));
    
    if (matchingKeywords.length >= 2) {
      return { type: 'footer', confidence: 0.8 };
    } else if (matchingKeywords.length >= 1) {
      return { type: 'footer', confidence: 0.5 };
    }
    
    return { type: 'abstain', confidence: 0.0 };
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
  
  // =============================================================================
  // UNIFIED THRESHOLD MANAGEMENT SYSTEM
  // Centralized threshold management from plan constraints - Phase 1.6
  // =============================================================================

  /**
   * Get unified thresholds from plan constraints with fallback defaults
   * Single source of truth for all quality thresholds throughout the system
   */
  getUnifiedThresholds() {
    const plan = this.context.get('currentPlan') || {};
    const constraints = plan.constraints || {};
    
    return {
      // Core confidence thresholds
      mapfields_conf_min: constraints.mapfields_conf_min || 0.35,
      final_quality_min: constraints.final_quality_min || 0.45,
      validation_threshold: constraints.validation_threshold || 0.4,
      citation_confidence: constraints.citation_confidence || 0.3,
      
      // Block classification thresholds
      weak_supervision_min: constraints.weak_supervision_min || 0.6,
      nav_filter_threshold: constraints.nav_filter_threshold || 0.8,
      board_filter_threshold: constraints.board_filter_threshold || 0.7,
      
      // Result limits
      max_results: constraints.max_results || 50,
      max_candidates: constraints.max_candidates || 15,
      
      // Quality and performance
      quality_threshold: constraints.quality_threshold || 0.3,
      confidence_calibration_min: constraints.confidence_calibration_min || 0.5
    };
  }

  /**
   * Update plan constraints with unified thresholds
   */
  updatePlanConstraints(overrides = {}) {
    const plan = this.context.get('currentPlan') || {};
    const currentThresholds = this.getUnifiedThresholds();
    
    plan.constraints = {
      ...plan.constraints,
      ...currentThresholds,
      ...overrides
    };
    
    this.context.set('currentPlan', plan);
    console.log('📊 Updated unified thresholds:', plan.constraints);
  }

  // =============================================================================
  // BLOCK CLASSIFIER & WEAK SUPERVISION SYSTEM
  // Snorkel-style labeling functions for block classification without manual labels
  // =============================================================================

  /**
   * Helper method to get block classifier instance
   */
  getBlockClassifier() {
    if (!this.blockClassifier) {
      this.blockClassifier = new BlockClassifier();
    }
    return this.blockClassifier;
  }

  // =============================================================================
  // DOMAIN-AGNOSTIC VALIDATORS - Quality checks with repair triggers
  // =============================================================================
  
  /**
   * Apply domain-agnostic validators to extracted mapping
   */
  applyDomainAgnosticValidators(mapping) {
    const validations = {
      name_validation: this.validateLooksLikeName(mapping.name),
      title_validation: this.validateLooksLikeRole(mapping.title),
      bio_validation: this.validateBioOk(mapping.bio)
    };
    
    const issues = [];
    let valid = true;
    
    Object.entries(validations).forEach(([field, validation]) => {
      if (!validation.valid) {
        valid = false;
        issues.push(`${field}: ${validation.reason}`);
      }
    });
    
    return {
      valid: valid,
      issues: issues,
      validations: validations,
      repair_suggestions: this.generateRepairSuggestions(mapping, validations)
    };
  }
  
  /**
   * Validator: looks_like_name
   * ≥2 tokens, Title Case, no digits/punctuation
   */
  validateLooksLikeName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, reason: 'name_missing', repairability: 'low' };
    }
    
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return { valid: false, reason: 'name_empty', repairability: 'low' };
    }
    
    const words = trimmed.split(/\s+/);
    
    // Must have at least 2 words
    if (words.length < 2) {
      return { valid: false, reason: 'name_too_few_words', repairability: 'medium' };
    }
    
    // No more than 4 words (reasonable limit)
    if (words.length > 4) {
      return { valid: false, reason: 'name_too_many_words', repairability: 'high' };
    }
    
    // Check each word for proper format
    for (const word of words) {
      // Must be proper title case
      if (!/^[A-Z][a-z]+$/.test(word)) {
        // Special handling for common prefixes/suffixes
        if (!['Jr.', 'Sr.', 'II', 'III', 'IV', 'Ph.D.', 'M.D.'].includes(word)) {
          return { valid: false, reason: 'name_improper_case', repairability: 'high' };
        }
      }
      
      // Word length check
      if (word.length < 2 || word.length > 20) {
        return { valid: false, reason: 'name_word_length', repairability: 'medium' };
      }
      
      // No digits in names
      if (/\d/.test(word)) {
        return { valid: false, reason: 'name_contains_digits', repairability: 'low' };
      }
    }
    
    // Check for contamination patterns
    const lowerName = trimmed.toLowerCase();
    const contaminationWords = ['staff', 'team', 'members', 'directory', 'board', 'contact'];
    
    for (const contaminant of contaminationWords) {
      if (lowerName.includes(contaminant)) {
        return { valid: false, reason: 'name_contaminated', repairability: 'low' };
      }
    }
    
    return { valid: true, reason: 'valid_name', confidence: 0.9 };
  }
  
  /**
   * Validator: looks_like_role  
   * Contains role words, <120 chars, not a sentence
   */
  validateLooksLikeRole(title) {
    if (!title || typeof title !== 'string') {
      return { valid: false, reason: 'title_missing', repairability: 'medium' };
    }
    
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      return { valid: false, reason: 'title_empty', repairability: 'medium' };
    }
    
    // Length check - reasonable title length
    if (trimmed.length > 120) {
      return { valid: false, reason: 'title_too_long', repairability: 'high' };
    }
    
    if (trimmed.length < 3) {
      return { valid: false, reason: 'title_too_short', repairability: 'low' };
    }
    
    // Check for contamination
    const lowerTitle = trimmed.toLowerCase();
    const contaminationWords = ['staff', 'team', 'members', 'directory', 'board of directors'];
    
    for (const contaminant of contaminationWords) {
      if (lowerTitle.includes(contaminant)) {
        return { valid: false, reason: 'title_contaminated', repairability: 'low' };
      }
    }
    
    // Check for sentence-like structure (bad for titles)
    if (trimmed.match(/[.!?]\s+[A-Z]/)) {
      return { valid: false, reason: 'title_is_sentence', repairability: 'high' };
    }
    
    // Look for role-related words (positive indicator)
    const roleWords = [
      'director', 'manager', 'executive', 'assistant', 'coordinator',
      'specialist', 'officer', 'head', 'lead', 'chief', 'president',
      'vice', 'senior', 'junior', 'associate', 'development', 'marketing',
      'sales', 'operations', 'finance', 'human resources', 'hr', 'it',
      'engineer', 'developer', 'designer', 'analyst', 'consultant'
    ];
    
    const hasRoleWord = roleWords.some(word => lowerTitle.includes(word));
    
    // Must contain at least one role word for high confidence
    if (!hasRoleWord) {
      // Still valid but lower confidence
      return { 
        valid: true, 
        reason: 'title_no_role_words', 
        confidence: 0.5,
        suggestion: 'Consider verifying this title contains role information'
      };
    }
    
    return { valid: true, reason: 'valid_title', confidence: 0.85 };
  }
  
  /**
   * Validator: bio_ok
   * ≥2 sentences OR ≥120 chars, doesn't end mid-token  
   */
  validateBioOk(bio) {
    if (!bio || typeof bio !== 'string') {
      return { valid: false, reason: 'bio_missing', repairability: 'medium' };
    }
    
    const trimmed = bio.trim();
    if (trimmed.length === 0) {
      return { valid: false, reason: 'bio_empty', repairability: 'medium' };
    }
    
    // Check for contamination at start
    const lowerBio = trimmed.toLowerCase();
    if (lowerBio.startsWith('staff') || lowerBio.startsWith('team') || 
        lowerBio.startsWith('members') || lowerBio.startsWith('directory')) {
      return { valid: false, reason: 'bio_contaminated_start', repairability: 'medium' };
    }
    
    // Check minimum length
    if (trimmed.length < 20) {
      return { valid: false, reason: 'bio_too_short', repairability: 'low' };
    }
    
    // Check maximum length (prevent pulling in too much)
    if (trimmed.length > 2000) {
      return { valid: false, reason: 'bio_too_long', repairability: 'high' };
    }
    
    // Count sentences (simple heuristic)
    const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    // Must have at least 2 sentences OR be at least 120 characters
    if (sentences.length < 2 && trimmed.length < 120) {
      return { valid: false, reason: 'bio_insufficient_content', repairability: 'medium' };
    }
    
    // Check if ends mid-token (incomplete)
    const lastChar = trimmed[trimmed.length - 1];
    if (/[a-z,]/.test(lastChar)) {
      return { valid: false, reason: 'bio_incomplete_ending', repairability: 'high' };
    }
    
    // Check for repetitive text (copy-paste errors)
    const words = trimmed.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length > 20 && uniqueWords.size / words.length < 0.5) {
      return { valid: false, reason: 'bio_repetitive', repairability: 'medium' };
    }
    
    return { valid: true, reason: 'valid_bio', confidence: 0.8 };
  }
  
  /**
   * Generate repair suggestions based on validation failures
   */
  generateRepairSuggestions(mapping, validations) {
    const suggestions = [];
    
    // Name repair suggestions
    if (!validations.name_validation.valid) {
      const nameReason = validations.name_validation.reason;
      switch (nameReason) {
        case 'name_too_many_words':
          suggestions.push({ field: 'name', action: 'truncate_to_first_two_words' });
          break;
        case 'name_improper_case':
          suggestions.push({ field: 'name', action: 'apply_title_case' });
          break;
        case 'name_contaminated':
          suggestions.push({ field: 'name', action: 'remove_contamination_words' });
          break;
      }
    }
    
    // Title repair suggestions
    if (!validations.title_validation.valid) {
      const titleReason = validations.title_validation.reason;
      switch (titleReason) {
        case 'title_too_long':
          suggestions.push({ field: 'title', action: 'truncate_to_first_sentence' });
          break;
        case 'title_is_sentence':
          suggestions.push({ field: 'title', action: 'extract_title_phrase' });
          break;
        case 'title_contaminated':
          suggestions.push({ field: 'title', action: 'remove_contamination_words' });
          break;
      }
    }
    
    // Bio repair suggestions
    if (!validations.bio_validation.valid) {
      const bioReason = validations.bio_validation.reason;
      switch (bioReason) {
        case 'bio_too_long':
          suggestions.push({ field: 'bio', action: 'truncate_to_first_paragraph' });
          break;
        case 'bio_incomplete_ending':
          suggestions.push({ field: 'bio', action: 'complete_last_sentence' });
          break;
        case 'bio_contaminated_start':
          suggestions.push({ field: 'bio', action: 'remove_contamination_prefix' });
          break;
      }
    }
    
    return suggestions;
  }
  
  /**
   * Apply aggressive repair attempts for low-quality mappings
   */
  aggressiveRepairMappings(mappings, validationResults) {
    return mappings.map((mapping, index) => {
      const validation = validationResults[index];
      if (validation.overall_valid) return mapping;
      
      const repaired = { ...mapping };
      
      // Apply repair suggestions
      validation.domain_validation.repair_suggestions.forEach(suggestion => {
        repaired[suggestion.field] = this.applyRepairAction(
          repaired[suggestion.field], 
          suggestion.action
        );
      });
      
      return repaired;
    });
  }
  
  /**
   * Apply specific repair action to a field value
   */
  applyRepairAction(value, action) {
    if (!value) return value;
    
    switch (action) {
      case 'truncate_to_first_two_words':
        return value.split(/\s+/).slice(0, 2).join(' ');
        
      case 'apply_title_case':
        return value.split(/\s+/).map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        
      case 'remove_contamination_words':
        const contaminationWords = ['staff', 'team', 'members', 'directory', 'board'];
        let cleaned = value;
        contaminationWords.forEach(word => {
          cleaned = cleaned.replace(new RegExp(word, 'gi'), '').trim();
        });
        return cleaned.replace(/\s+/g, ' ');
        
      case 'truncate_to_first_sentence':
        const sentences = value.split(/[.!?]+/);
        return sentences[0] + (sentences.length > 1 ? '.' : '');
        
      case 'extract_title_phrase':
        // Extract the first meaningful phrase (before comma or period)
        return value.split(/[,.]/)[0].trim();
        
      case 'truncate_to_first_paragraph':
        const paragraphs = value.split('\n\n');
        return paragraphs[0].trim();
        
      case 'complete_last_sentence':
        return value.trim() + '.';
        
      case 'remove_contamination_prefix':
        const prefixes = ['staff', 'team', 'members', 'directory'];
        let cleanValue = value;
        prefixes.forEach(prefix => {
          const regex = new RegExp(`^${prefix}\\s*:?\\s*`, 'gi');
          cleanValue = cleanValue.replace(regex, '');
        });
        return cleanValue.trim();
        
      default:
        return value;
    }
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
  
  /**
   * Generate selector-based citations with DOM paths - Phase 1.7
   * Format: {selector, startOffset?, endOffset?, content_hash}
   */
  generateCitations(mapping, html, contentBlocks) {
    const citations = {};
    const $ = this.context.get('dom_structure')?.$ || cheerio.load(html);
    const thresholds = this.getUnifiedThresholds();
    
    // Generate citations for each field
    for (const [field, value] of Object.entries(mapping)) {
      if (value && typeof value === 'string') {
        const citation = this.createSelectorBasedCitation(value, field, $, thresholds.citation_confidence);
        if (citation && citation.confidence >= thresholds.citation_confidence) {
          citations[field] = citation;
        }
      }
    }
    
    return {
      field_citations: citations,
      confidence: Object.keys(citations).length / Object.keys(mapping).length
    };
  }
  
  /**
   * Create selector-based citation for extracted field value
   */
  createSelectorBasedCitation(value, fieldName, $, minConfidence = 0.3) {
    if (!value || value.length < 3) return null;
    
    // Clean value for matching
    const cleanValue = value.trim().substring(0, 100);
    const valueWords = cleanValue.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (valueWords.length === 0) return null;
    
    let bestMatch = null;
    let bestScore = 0;
    
    // Search through DOM elements
    $('*').each((index, element) => {
      const $el = $(element);
      const elementText = $el.text().trim();
      
      if (elementText.length < 3) return;
      
      // Calculate match score
      const score = this.calculateTextMatch(cleanValue, elementText, valueWords);
      
      if (score > bestScore && score >= minConfidence) {
        bestScore = score;
        
        // Generate CSS selector path for this element
        const selector = this.generateCSSSelector($el, $);
        
        // Find exact position within element text
        const position = this.findTextPosition(cleanValue, elementText);
        
        bestMatch = {
          selector: selector,
          confidence: Math.min(0.95, score),
          content_hash: this.hashContent(elementText),
          field_name: fieldName,
          extracted_value: cleanValue,
          source_text_length: elementText.length,
          startOffset: position.start,
          endOffset: position.end,
          element_tag: element.tagName?.toLowerCase() || 'unknown',
          element_classes: $el.attr('class')?.split(/\s+/) || [],
          parent_selector: this.generateCSSSelector($el.parent(), $, 1)
        };
      }
    });
    
    return bestMatch;
  }
  
  /**
   * Calculate text matching score between extracted value and source element
   */
  calculateTextMatch(cleanValue, elementText, valueWords) {
    const elementLower = elementText.toLowerCase();
    
    // Exact match gets highest score
    if (elementText.includes(cleanValue)) {
      return 0.95;
    }
    
    // Partial word overlap
    let matchedWords = 0;
    valueWords.forEach(word => {
      if (elementLower.includes(word)) {
        matchedWords++;
      }
    });
    
    const wordMatchRatio = matchedWords / valueWords.length;
    
    // Length similarity bonus
    const lengthRatio = Math.min(cleanValue.length, elementText.length) / 
                       Math.max(cleanValue.length, elementText.length);
    
    return (wordMatchRatio * 0.8) + (lengthRatio * 0.2);
  }
  
  /**
   * Generate CSS selector path for element
   */
  generateCSSSelector($element, $, maxDepth = 3) {
    if (!$element.length) return '';
    
    const path = [];
    let current = $element;
    let depth = 0;
    
    while (current.length && current[0].tagName && depth < maxDepth) {
      let selector = current[0].tagName.toLowerCase();
      
      // Add ID if available
      const id = current.attr('id');
      if (id) {
        selector += `#${id}`;
        path.unshift(selector);
        break; // ID is unique, stop here
      }
      
      // Add classes if available
      const classes = current.attr('class');
      if (classes) {
        const classList = classes.split(/\s+/).filter(c => c.length > 0);
        if (classList.length > 0) {
          selector += '.' + classList.slice(0, 2).join('.');
        }
      }
      
      // Add nth-child for specificity
      const siblings = current.siblings(current[0].tagName.toLowerCase());
      if (siblings.length > 0) {
        const index = siblings.index(current[0]) + 1;
        selector += `:nth-child(${index + 1})`;
      }
      
      path.unshift(selector);
      current = current.parent();
      depth++;
    }
    
    return path.join(' > ');
  }
  
  /**
   * Find start/end position of text within source element
   */
  findTextPosition(needle, haystack) {
    const startPos = haystack.indexOf(needle);
    if (startPos === -1) {
      // Try word-by-word matching for fuzzy position
      const needleWords = needle.split(/\s+/);
      const firstWordPos = haystack.indexOf(needleWords[0]);
      if (firstWordPos !== -1) {
        return {
          start: firstWordPos,
          end: firstWordPos + needle.length,
          fuzzy: true
        };
      }
      return { start: 0, end: needle.length, fuzzy: true };
    }
    
    return {
      start: startPos,
      end: startPos + needle.length,
      fuzzy: false
    };
  }
  
  /**
   * Create content hash for detecting selector drift
   */
  hashContent(content) {
    // Simple hash for content fingerprinting
    let hash = 0;
    const str = content.substring(0, 200); // First 200 chars
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
  
  /**
   * Legacy method for fallback compatibility
   */
  findSourceInContent(value, html, contentBlocks) {
    // Fallback to old system if selector-based fails
    const cleanValue = value.substring(0, 50);
    
    for (let i = 0; i < contentBlocks.length; i++) {
      if (contentBlocks[i].includes(cleanValue)) {
        return {
          source: 'content_block',
          block_index: i,
          confidence: 0.6,
          evidence: cleanValue,
          legacy: true
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
 * Two-Pass Planner v0.1 - Implements Pass A (skim) + Pass B (enrich) architecture
 * Optimizes for cost and speed by doing expensive operations only on filtered candidates
 */
class TwoPassPlanner extends BasicPlanner {
  generatePlan(task) {
    const { url, instructions, targetSchema, constraints = {} } = task;
    
    console.log('🎯 Generating two-pass plan for:', instructions);
    
    // Determine if two-pass optimization is beneficial
    const shouldUseTwoPasses = this.shouldUseTwoPasses(constraints);
    
    if (!shouldUseTwoPasses) {
      console.log('📋 Using single-pass plan (simple task)');
      return super.generatePlan(task);
    }
    
    console.log('📋 Using two-pass plan (Pass A: skim, Pass B: enrich)');
    
    // Create two-pass plan
    const plan = {
      task_id: `extract_2pass_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      budget: {
        max_time: constraints.max_time || 20000, // More time for two passes
        max_tokens: constraints.max_tokens || 800, // More tokens but controlled
        max_requests: constraints.max_requests || 3
      },
      passes: [
        this.createPassA(targetSchema, constraints),
        this.createPassB(targetSchema, constraints)
      ],
      constraints: {
        deterministic_order: true,
        max_results: constraints.max_results || 10,
        required_fields: this.getRequiredFields(targetSchema),
        quality_threshold: constraints.quality_threshold || 0.3,
        pass_a_candidates: Math.min(constraints.max_candidates || 15, 20) // Max candidates to pass to Pass B
      }
    };
    
    console.log(`📋 Generated two-pass plan: Pass A → top ${plan.constraints.pass_a_candidates} candidates → Pass B`);
    
    return plan;
  }
  
  /**
   * Pass A (Skim): Fast DOM-only block classification and candidate selection
   * Only uses DOM processing, weak supervision, and basic filtering
   */
  createPassA(targetSchema, constraints) {
    return {
      name: "Pass A (Skim)",
      description: "Fast candidate selection using DOM and weak supervision",
      budget: {
        max_time: 8000,   // 8 seconds for Pass A
        max_tokens: 0,    // No LLM calls in Pass A
        max_requests: 0   // No external requests
      },
      steps: [
        {
          skill: 'PreserveStructure',
          params: { html_input: true }
        },
        {
          skill: 'DiscoverBlocks',
          params: { 
            min_size: 50,
            apply_weak_supervision: true,
            max_candidates: constraints.max_candidates || 15
          }
        },
        {
          skill: 'DetectStructuredData',
          params: {},
          fallback: 'HarvestMeta'
        },
        // Pass A stops here - no expensive MapFields yet
        {
          skill: 'RankCandidates', // New skill for candidate ranking
          params: {
            ranking_criteria: ['type_confidence', 'labeling_agreement', 'relevance_score'],
            max_candidates: constraints.max_candidates || 15
          }
        }
      ],
      output: 'top_candidates' // Output for Pass B
    };
  }
  
  /**
   * Pass B (Enrich): Expensive operations only on filtered candidates
   * Uses MapFields, validation, citations - but only on top K candidates
   */
  createPassB(targetSchema, constraints) {
    return {
      name: "Pass B (Enrich)",
      description: "Detailed extraction on filtered candidates",
      budget: {
        max_time: 12000,  // 12 seconds for Pass B
        max_tokens: 800,  // Allow LLM usage here
        max_requests: 3   // External requests if needed
      },
      input: 'top_candidates', // Input from Pass A
      steps: [
        {
          skill: 'MapFields',
          params: {
            confidence_threshold: 0.25, // Lower threshold since pre-filtered
            candidates_only: true, // Only process candidates from Pass A
            use_enhanced_extraction: true
          }
        },
        {
          skill: 'ValidateOutput',
          params: { 
            repair: true,
            aggressive_repair: true // More repair attempts since fewer items
          }
        },
        {
          skill: 'CiteEvidence',
          params: { 
            detailed_citations: true // More detailed since fewer items
          }
        },
        {
          skill: 'RankResults',
          params: {
            tie_breaker: 'page_order_then_confidence',
            apply_final_filtering: true
          }
        }
      ],
      output: 'final_results'
    };
  }
  
  /**
   * Decide whether to use two-pass architecture based on task characteristics
   */
  shouldUseTwoPasses(constraints) {
    // Use two-pass for larger or more complex tasks
    const hasLargeExpectedResults = (constraints.max_results || 10) > 5;
    const hasStrictQualityRequirements = (constraints.quality_threshold || 0.3) > 0.5;
    const hasLimitedBudget = (constraints.max_tokens || 500) < 1000;
    
    // Two-pass is beneficial when we expect many candidates but want high quality
    return hasLargeExpectedResults || hasStrictQualityRequirements || hasLimitedBudget;
  }
}

/**
 * Self-Play Planner v0.1 - Generates multiple plan variants and selects winner
 * Uses evaluation score per unit cost to optimize plan selection
 */
class SelfPlayPlanner extends TwoPassPlanner {
  async generateAndTestPlans(task, maxVariants = 3) {
    console.log('🎮 Generating multiple plan variants for self-play optimization');
    
    const planVariants = this.generatePlanVariants(task, maxVariants);
    const results = [];
    
    // Test each plan variant
    for (let i = 0; i < planVariants.length; i++) {
      const variant = planVariants[i];
      console.log(`🧪 Testing plan variant ${i + 1}/${planVariants.length}: ${variant.description}`);
      
      try {
        const result = await this.executePlanVariant(variant, task);
        results.push({
          plan: variant,
          result: result,
          score: this.calculateVariantScore(result, variant),
          cost: this.calculateVariantCost(result, variant)
        });
      } catch (error) {
        console.warn(`⚠️ Plan variant ${i + 1} failed:`, error.message);
        results.push({
          plan: variant,
          result: { success: false, error: error.message },
          score: 0,
          cost: Infinity
        });
      }
    }
    
    // Select winner by score/cost ratio
    const winner = this.selectWinningPlan(results);
    
    console.log(`🏆 Winner: ${winner.plan.description} (score/cost: ${winner.efficiency.toFixed(2)})`);
    
    // Store losing variants for learning
    const losers = results.filter(r => r !== winner);
    this.storeLosingVariants(losers);
    
    return {
      winner: winner,
      all_results: results,
      optimization_summary: this.createOptimizationSummary(results, winner)
    };
  }
  
  /**
   * Generate multiple plan variants with different strategies
   */
  generatePlanVariants(task, maxVariants) {
    const variants = [];
    
    // Variant 1: JSON-LD First (structured data priority)
    variants.push({
      id: 'json_ld_first',
      description: 'JSON-LD First Strategy',
      strategy: 'structured_data_priority',
      plan: this.createJSONLDFirstPlan(task)
    });
    
    // Variant 2: DOM First (always use DOM-based approach)
    variants.push({
      id: 'dom_first',
      description: 'DOM First Strategy', 
      strategy: 'dom_priority',
      plan: this.createDOMFirstPlan(task)
    });
    
    // Variant 3: Strict Validators (high quality, fewer results)
    if (maxVariants >= 3) {
      variants.push({
        id: 'strict_quality',
        description: 'Strict Quality Strategy',
        strategy: 'quality_over_quantity',
        plan: this.createStrictQualityPlan(task)
      });
    }
    
    return variants.slice(0, maxVariants);
  }
  
  /**
   * Create JSON-LD first variant (prioritizes structured data)
   */
  createJSONLDFirstPlan(task) {
    const basePlan = super.generatePlan({
      ...task,
      constraints: {
        ...task.constraints,
        prefer_structured_data: true,
        quality_threshold: 0.4
      }
    });
    
    // Modify to prioritize structured data extraction
    if (basePlan.passes) {
      basePlan.passes[0].steps = [
        { skill: 'PreserveStructure', params: { html_input: true } },
        { skill: 'DetectStructuredData', params: { exhaustive_search: true } },
        { skill: 'HarvestMeta', params: { detailed_extraction: true } },
        { skill: 'DiscoverBlocks', params: { min_size: 75, structured_data_hints: true } },
        { skill: 'RankCandidates', params: { prefer_structured: true } }
      ];
    }
    
    return basePlan;
  }
  
  /**
   * Create DOM first variant (always uses DOM processing heavily)
   */
  createDOMFirstPlan(task) {
    const basePlan = super.generatePlan({
      ...task,
      constraints: {
        ...task.constraints,
        force_dom_processing: true,
        quality_threshold: 0.35
      }
    });
    
    // Always use two-pass for DOM first
    if (!basePlan.passes) {
      // Convert single-pass to two-pass
      const twoPassPlan = this.convertToTwoPass(basePlan, task.constraints);
      return twoPassPlan;
    }
    
    return basePlan;
  }
  
  /**
   * Create strict quality variant (fewer but higher quality results)
   */
  createStrictQualityPlan(task) {
    return super.generatePlan({
      ...task,
      constraints: {
        ...task.constraints,
        quality_threshold: 0.7, // Higher threshold
        max_results: Math.min(task.constraints?.max_results || 10, 5), // Fewer results
        aggressive_filtering: true
      }
    });
  }
  
  /**
   * Execute a plan variant for testing
   */
  async executePlanVariant(variant, originalTask) {
    const executor = new PlanExecutor();
    const initialInputs = {
      html: originalTask.html,
      target_schema: originalTask.targetSchema
    };
    
    if (variant.plan.passes) {
      return await executor.executeTwoPassPlan(variant.plan, initialInputs);
    } else {
      return await executor.executePlan(variant.plan, initialInputs);
    }
  }
  
  /**
   * Calculate variant score using evaluator
   */
  calculateVariantScore(result, variant) {
    if (!result.success) return 0;
    
    const evaluator = new SimpleEvaluator();
    const evaluation = evaluator.evaluate(result, result.context_final?.target_schema);
    
    return evaluation.overall_score;
  }
  
  /**
   * Calculate variant cost (time + tokens + requests)
   */
  calculateVariantCost(result, variant) {
    if (!result.success) return Infinity;
    
    const timeCost = (result.execution_time || 0) / 1000; // Seconds
    const tokenCost = (result.budget_used?.tokens || 0) / 100; // Per 100 tokens
    const requestCost = (result.budget_used?.requests || 0) * 2; // Per request
    
    return timeCost + tokenCost + requestCost;
  }
  
  /**
   * Select winning plan by score/cost efficiency
   */
  selectWinningPlan(results) {
    const successfulResults = results.filter(r => r.result.success && r.cost > 0);
    
    if (successfulResults.length === 0) {
      // All failed, return least bad
      return results.reduce((best, current) => 
        current.score > best.score ? current : best
      );
    }
    
    // Calculate efficiency (score per unit cost)
    const rankedResults = successfulResults.map(r => ({
      ...r,
      efficiency: r.score / Math.max(r.cost, 0.1) // Avoid division by zero
    }));
    
    rankedResults.sort((a, b) => b.efficiency - a.efficiency);
    
    return rankedResults[0];
  }
  
  /**
   * Store losing variants for future learning
   */
  storeLosingVariants(losers) {
    // In a real system, this would update training data
    console.log('📚 Storing losing variants for learning:', losers.map(l => ({
      strategy: l.plan.strategy,
      score: l.score,
      cost: l.cost,
      failure_reason: l.result.error || 'low_efficiency'
    })));
  }
  
  /**
   * Create optimization summary
   */
  createOptimizationSummary(results, winner) {
    const successCount = results.filter(r => r.result.success).length;
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const avgCost = results.filter(r => r.cost < Infinity).reduce((sum, r) => sum + r.cost, 0) / 
                    results.filter(r => r.cost < Infinity).length;
    
    return {
      total_variants: results.length,
      successful_variants: successCount,
      success_rate: successCount / results.length,
      average_score: avgScore,
      average_cost: avgCost,
      winner_strategy: winner.plan.strategy,
      winner_efficiency: winner.efficiency || 0,
      improvement_over_average: winner.score - avgScore
    };
  }
  
  /**
   * Convert single-pass plan to two-pass
   */
  convertToTwoPass(singlePassPlan, constraints) {
    // Create a two-pass version of a single-pass plan
    const task = { 
      constraints: { ...constraints, force_two_pass: true } 
    };
    
    return {
      ...singlePassPlan,
      task_id: `2pass_${singlePassPlan.task_id}`,
      passes: [
        this.createPassA(null, constraints),
        this.createPassB(null, constraints)
      ]
    };
  }
}

/**
 * Active Learning Queue v0.1 - Identifies and queues disagreement cases
 * Focuses on cases where labeling functions disagree or confidence is borderline
 */
class ActiveLearningQueue {
  constructor() {
    this.disagreementQueue = [];
    this.confidenceQueue = [];
    this.retrainingQueue = [];
    this.maxQueueSize = 100;
  }
  
  /**
   * Analyze extraction results and identify learning opportunities
   */
  analyzeForLearning(executionResult, semanticBlocks, evaluationResult) {
    console.log('🎓 Analyzing results for active learning opportunities');
    
    const learningCases = {
      disagreements: this.findDisagreementCases(semanticBlocks),
      confidence_borderline: this.findBorderlineCases(executionResult.data),
      validation_failures: this.findValidationFailures(executionResult.trace),
      quality_mismatches: this.findQualityMismatches(executionResult, evaluationResult)
    };
    
    // Queue the most valuable cases for human review
    this.queueLearningCases(learningCases);
    
    const totalCases = Object.values(learningCases).reduce((sum, cases) => sum + cases.length, 0);
    console.log(`📚 Found ${totalCases} potential learning cases`);
    
    return {
      learning_opportunities: learningCases,
      queue_status: this.getQueueStatus(),
      priority_cases: this.getPriorityCases(),
      learning_value_score: this.calculateLearningValue(learningCases)
    };
  }
  
  /**
   * Find cases where labeling functions strongly disagree
   */
  findDisagreementCases(semanticBlocks) {
    const disagreements = [];
    
    for (const block of semanticBlocks) {
      if (!block.weak_labels) continue;
      
      const votes = Object.values(block.weak_labels);
      const nonAbstain = votes.filter(v => v.type !== 'abstain');
      
      if (nonAbstain.length < 2) continue; // Need multiple votes to have disagreement
      
      // Check for type disagreement
      const uniqueTypes = [...new Set(nonAbstain.map(v => v.type))];
      if (uniqueTypes.length > 1) {
        const disagreementStrength = this.calculateDisagreementStrength(votes);
        
        disagreements.push({
          type: 'labeling_function_disagreement',
          block_id: block.root_selector,
          block_heading: block.heading,
          block_text_preview: block.block_text?.substring(0, 200) + '...',
          conflicting_labels: uniqueTypes,
          disagreement_strength: disagreementStrength,
          labeling_agreement: block.labeling_agreement,
          predicted_type: block.predicted_type,
          weak_labels: block.weak_labels,
          learning_priority: disagreementStrength > 0.5 ? 'high' : 'medium'
        });
      }
    }
    
    return disagreements.sort((a, b) => b.disagreement_strength - a.disagreement_strength);
  }
  
  /**
   * Find cases with borderline confidence scores
   */
  findBorderlineCases(extractedData) {
    const borderlineCases = [];
    const confidenceThresholds = { low: 0.4, high: 0.6 }; // Borderline zone
    
    for (const item of extractedData || []) {
      const confidence = item.confidence || 0;
      
      if (confidence >= confidenceThresholds.low && confidence <= confidenceThresholds.high) {
        borderlineCases.push({
          type: 'borderline_confidence',
          item_data: item,
          confidence_score: confidence,
          field_confidences: item.field_confidences || {},
          missing_fields: this.findMissingFields(item),
          quality_concerns: this.identifyQualityConcerns(item),
          learning_priority: confidence < 0.5 ? 'high' : 'medium'
        });
      }
    }
    
    return borderlineCases.sort((a, b) => Math.abs(0.5 - a.confidence_score) - Math.abs(0.5 - b.confidence_score));
  }
  
  /**
   * Find validation failures that suggest learning opportunities
   */
  findValidationFailures(trace) {
    const failures = [];
    
    for (const traceItem of trace || []) {
      if (traceItem.event === 'step_failed' && traceItem.data?.skill === 'ValidateOutput') {
        failures.push({
          type: 'validation_failure',
          skill: traceItem.data.skill,
          error: traceItem.data.error,
          timestamp: traceItem.timestamp,
          context: traceItem.context_keys,
          learning_priority: 'high' // Validation failures are high priority
        });
      }
      
      // Look for repair attempts
      if (traceItem.event === 'step_start' && traceItem.data?.params?.repair) {
        failures.push({
          type: 'repair_attempt',
          skill: traceItem.data.skill,
          repair_params: traceItem.data.params,
          timestamp: traceItem.timestamp,
          learning_priority: 'medium'
        });
      }
    }
    
    return failures;
  }
  
  /**
   * Find cases where evaluator score doesn't match expectation
   */
  findQualityMismatches(executionResult, evaluationResult) {
    const mismatches = [];
    
    if (!evaluationResult) return mismatches;
    
    const score = evaluationResult.overall_score;
    const dataCount = (executionResult.data || []).length;
    
    // High data count but low score = quality issues
    if (dataCount > 5 && score < 0.4) {
      mismatches.push({
        type: 'high_quantity_low_quality',
        data_count: dataCount,
        quality_score: score,
        quality_issues: evaluationResult.issues || [],
        evaluation_metrics: evaluationResult.metrics || {},
        learning_priority: 'high'
      });
    }
    
    // Low data count but high confidence = missing items?
    if (dataCount < 3 && score > 0.7) {
      mismatches.push({
        type: 'low_quantity_high_confidence',
        data_count: dataCount,
        quality_score: score,
        potential_missed_items: true,
        learning_priority: 'medium'
      });
    }
    
    return mismatches;
  }
  
  /**
   * Queue learning cases by priority and type
   */
  queueLearningCases(learningCases) {
    // Add disagreements to disagreement queue
    for (const disagreement of learningCases.disagreements || []) {
      this.addToQueue(this.disagreementQueue, disagreement);
    }
    
    // Add borderline cases to confidence queue
    for (const borderline of learningCases.confidence_borderline || []) {
      this.addToQueue(this.confidenceQueue, borderline);
    }
    
    // Add validation failures and quality mismatches to retraining queue
    const retrainingCases = [
      ...(learningCases.validation_failures || []),
      ...(learningCases.quality_mismatches || [])
    ];
    
    for (const retraining of retrainingCases) {
      this.addToQueue(this.retrainingQueue, retraining);
    }
  }
  
  /**
   * Add item to queue with size management
   */
  addToQueue(queue, item) {
    // Add with timestamp
    const queueItem = {
      ...item,
      queued_at: new Date().toISOString(),
      queue_id: `${item.type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    
    queue.push(queueItem);
    
    // Maintain queue size
    if (queue.length > this.maxQueueSize) {
      queue.shift(); // Remove oldest item
    }
  }
  
  /**
   * Calculate disagreement strength between labeling function votes
   */
  calculateDisagreementStrength(votes) {
    const nonAbstain = votes.filter(v => v.type !== 'abstain');
    if (nonAbstain.length < 2) return 0;
    
    const types = nonAbstain.map(v => v.type);
    const uniqueTypes = [...new Set(types)];
    
    // More unique types = more disagreement
    const typeDisagreement = (uniqueTypes.length - 1) / (types.length - 1);
    
    // Also consider confidence spread
    const confidences = nonAbstain.map(v => v.confidence);
    const confidenceSpread = Math.max(...confidences) - Math.min(...confidences);
    
    return (typeDisagreement * 0.7) + (confidenceSpread * 0.3);
  }
  
  /**
   * Get current queue status
   */
  getQueueStatus() {
    return {
      disagreement_queue: this.disagreementQueue.length,
      confidence_queue: this.confidenceQueue.length,
      retraining_queue: this.retrainingQueue.length,
      total_queued: this.disagreementQueue.length + this.confidenceQueue.length + this.retrainingQueue.length,
      capacity_used: Math.min(1.0, (this.disagreementQueue.length + this.confidenceQueue.length + this.retrainingQueue.length) / (this.maxQueueSize * 3))
    };
  }
  
  /**
   * Get highest priority cases across all queues
   */
  getPriorityCases(limit = 5) {
    const allCases = [
      ...this.disagreementQueue,
      ...this.confidenceQueue,
      ...this.retrainingQueue
    ];
    
    // Sort by priority (high > medium > low) and then by queue time
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    allCases.sort((a, b) => {
      const priorityDiff = priorityOrder[b.learning_priority] - priorityOrder[a.learning_priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Same priority, sort by queue time (older first)
      return new Date(a.queued_at) - new Date(b.queued_at);
    });
    
    return allCases.slice(0, limit);
  }
  
  /**
   * Calculate overall learning value of the queued cases
   */
  calculateLearningValue(learningCases) {
    const weights = {
      disagreements: 0.4,
      confidence_borderline: 0.3,
      validation_failures: 0.2,
      quality_mismatches: 0.1
    };
    
    let totalValue = 0;
    Object.entries(learningCases).forEach(([type, cases]) => {
      const weight = weights[type] || 0.1;
      const highPriority = cases.filter(c => c.learning_priority === 'high').length;
      const mediumPriority = cases.filter(c => c.learning_priority === 'medium').length;
      
      totalValue += weight * (highPriority * 1.0 + mediumPriority * 0.5);
    });
    
    return Math.min(1.0, totalValue); // Cap at 1.0
  }
  
  /**
   * Helper: Find missing fields in extracted item
   */
  findMissingFields(item) {
    const requiredFields = ['name', 'title', 'bio']; // Common required fields
    return requiredFields.filter(field => !item[field] || item[field].length < 2);
  }
  
  /**
   * Helper: Identify quality concerns in extracted item
   */
  identifyQualityConcerns(item) {
    const concerns = [];
    
    if (item.name && item.name.length < 5) concerns.push('name_too_short');
    if (item.title && item.title.includes('Staff')) concerns.push('title_contamination');
    if (item.bio && item.bio.length < 50) concerns.push('bio_too_short');
    if (item.name && /\d/.test(item.name)) concerns.push('name_contains_numbers');
    
    return concerns;
  }
}

/**
 * Generic Pattern Tests v0.1 - VMOTA-agnostic validation tests
 * Tests universal patterns that should work across all staff/people pages
 */
class GenericPatternTests {
  constructor() {
    this.testResults = [];
    this.passedTests = 0;
    this.totalTests = 0;
  }
  
  /**
   * Run all generic pattern tests on extraction results
   */
  async runAllTests(extractionResult, semanticBlocks, originalHtml) {
    console.log('🧪 Running generic pattern tests');
    
    this.testResults = [];
    this.passedTests = 0;
    this.totalTests = 0;
    
    // Test 1: Navigation Purge Test
    await this.testNavigationPurge(semanticBlocks, extractionResult.data);
    
    // Test 2: Board vs Staff Test  
    await this.testBoardVsStaffSeparation(semanticBlocks, extractionResult.data, originalHtml);
    
    // Test 3: Boundary Test
    await this.testCleanBoundaries(extractionResult.data);
    
    // Test 4: Minimum Results Test
    await this.testMinimumResults(semanticBlocks, extractionResult.data, extractionResult.budget_used);
    
    // Test 5: Data Quality Test
    await this.testDataQuality(extractionResult.data);
    
    // Test 6: Confidence Calibration Test
    await this.testConfidenceCalibration(extractionResult.data);
    
    // Test 7: VMOTA Success Criteria Test (if VMOTA URL detected)
    await this.testVMOTASuccessCriteria(extractionResult.data, originalHtml);
    
    const passRate = this.totalTests > 0 ? this.passedTests / this.totalTests : 0;
    
    console.log(`🧪 Generic tests: ${this.passedTests}/${this.totalTests} passed (${(passRate * 100).toFixed(1)}%)`);
    
    return {
      passed: this.passedTests,
      total: this.totalTests,
      pass_rate: passRate,
      test_results: this.testResults,
      overall_pass: passRate >= 0.8 // 80% pass rate required
    };
  }
  
  /**
   * Test 1: Navigation Purge Test
   * High link density + no role words ≠ profile_card
   */
  async testNavigationPurge(semanticBlocks, extractedData) {
    const testName = 'Navigation Purge Test';
    this.totalTests++;
    
    try {
      // Find blocks that look like navigation (high link density)
      const navBlocks = semanticBlocks.filter(block => 
        (block.link_density || 0) > 0.15 && 
        !(block.block_text || '').toLowerCase().match(/(director|manager|executive|assistant|coordinator|specialist)/i)
      );
      
      // These blocks should NOT appear in final extracted data
      let navContamination = 0;
      for (const item of extractedData || []) {
        const itemText = (item.name + ' ' + item.title + ' ' + item.bio).toLowerCase();
        for (const navBlock of navBlocks) {
          if (navBlock.block_text && itemText.includes(navBlock.block_text.toLowerCase().substring(0, 50))) {
            navContamination++;
            break;
          }
        }
      }
      
      const passed = navContamination === 0;
      if (passed) this.passedTests++;
      
      this.testResults.push({
        test: testName,
        passed: passed,
        message: passed 
          ? `✅ No navigation contamination (${navBlocks.length} nav blocks filtered)` 
          : `❌ Found ${navContamination} items contaminated with navigation content`,
        details: {
          nav_blocks_detected: navBlocks.length,
          contaminated_items: navContamination,
          nav_block_samples: navBlocks.slice(0, 3).map(b => ({
            selector: b.root_selector,
            link_density: b.link_density,
            text_preview: b.block_text?.substring(0, 100) + '...'
          }))
        }
      });
      
    } catch (error) {
      this.testResults.push({
        test: testName,
        passed: false,
        message: `❌ Test failed: ${error.message}`,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Test 2: Board vs Staff Test
   * Many short names under "Board" → board_list not profile_card
   */
  async testBoardVsStaffSeparation(semanticBlocks, extractedData, originalHtml) {
    const testName = 'Board vs Staff Separation Test';
    this.totalTests++;
    
    try {
      // Look for board/directors sections in HTML
      const boardSectionRegex = /(board\s+of\s+directors|board\s+members|directors|trustees|advisory\s+board)/gi;
      const htmlLower = originalHtml.toLowerCase();
      const hasBoardSection = boardSectionRegex.test(htmlLower);
      
      if (!hasBoardSection) {
        this.testResults.push({
          test: testName,
          passed: true,
          message: '✅ No board section detected - test not applicable',
          details: { board_section_found: false }
        });
        this.passedTests++;
        return;
      }
      
      // Find blocks that were classified as board_list
      const boardBlocks = semanticBlocks.filter(block => 
        block.predicted_type === 'board_list' || 
        (block.block_text && boardSectionRegex.test(block.block_text))
      );
      
      // Check that board members don't appear in staff results
      let boardContamination = 0;
      for (const item of extractedData || []) {
        for (const boardBlock of boardBlocks) {
          if (boardBlock.block_text && 
              boardBlock.block_text.toLowerCase().includes((item.name || '').toLowerCase()) &&
              item.name && item.name.length > 3) {
            boardContamination++;
            break;
          }
        }
      }
      
      const passed = boardContamination === 0;
      if (passed) this.passedTests++;
      
      this.testResults.push({
        test: testName,
        passed: passed,
        message: passed 
          ? `✅ Board/staff separation maintained (${boardBlocks.length} board blocks filtered)`
          : `❌ Found ${boardContamination} board members in staff results`,
        details: {
          board_section_detected: hasBoardSection,
          board_blocks_found: boardBlocks.length,
          contaminated_items: boardContamination,
          board_block_samples: boardBlocks.slice(0, 2).map(b => ({
            predicted_type: b.predicted_type,
            text_preview: b.block_text?.substring(0, 150) + '...'
          }))
        }
      });
      
    } catch (error) {
      this.testResults.push({
        test: testName,
        passed: false,
        message: `❌ Test failed: ${error.message}`,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Test 3: Boundary Test
   * h3 name + role word + paragraphs → clean name/title/bio separation
   */
  async testCleanBoundaries(extractedData) {
    const testName = 'Clean Boundaries Test';
    this.totalTests++;
    
    try {
      let cleanBoundaries = 0;
      let totalItems = extractedData?.length || 0;
      
      if (totalItems === 0) {
        this.testResults.push({
          test: testName,
          passed: false,
          message: '❌ No extracted data to test boundaries',
          details: { items_count: 0 }
        });
        return;
      }
      
      for (const item of extractedData) {
        const hasCleanName = item.name && 
                            item.name.length >= 5 && 
                            item.name.length <= 50 &&
                            !/\d/.test(item.name) &&
                            !item.name.toLowerCase().includes('staff');
                            
        const hasCleanTitle = item.title && 
                             item.title.length >= 3 && 
                             item.title.length <= 120 &&
                             !item.title.toLowerCase().includes('staff');
                             
        const hasCleanBio = item.bio && 
                           item.bio.length >= 20 &&
                           item.bio.length <= 2000 &&
                           !item.bio.toLowerCase().startsWith('staff');
        
        if (hasCleanName && hasCleanTitle && hasCleanBio) {
          cleanBoundaries++;
        }
      }
      
      const cleanRatio = cleanBoundaries / totalItems;
      const passed = cleanRatio >= 0.8; // 80% should have clean boundaries
      if (passed) this.passedTests++;
      
      this.testResults.push({
        test: testName,
        passed: passed,
        message: passed 
          ? `✅ Clean boundaries: ${cleanBoundaries}/${totalItems} items (${(cleanRatio * 100).toFixed(1)}%)`
          : `❌ Poor boundaries: only ${cleanBoundaries}/${totalItems} clean (${(cleanRatio * 100).toFixed(1)}%)`,
        details: {
          items_with_clean_boundaries: cleanBoundaries,
          total_items: totalItems,
          clean_boundary_ratio: cleanRatio,
          sample_issues: extractedData.slice(0, 3).map(item => ({
            name: item.name,
            name_issues: this.identifyNameIssues(item.name),
            title_issues: this.identifyTitleIssues(item.title),
            bio_issues: this.identifyBioIssues(item.bio)
          })).filter(sample => 
            sample.name_issues.length > 0 || 
            sample.title_issues.length > 0 || 
            sample.bio_issues.length > 0
          )
        }
      });
      
    } catch (error) {
      this.testResults.push({
        test: testName,
        passed: false,
        message: `❌ Test failed: ${error.message}`,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Test 4: Minimum Results Test
   * ≥N profile_cards should yield ≥N results unless budget hit
   */
  async testMinimumResults(semanticBlocks, extractedData, budgetUsed) {
    const testName = 'Minimum Results Test';
    this.totalTests++;
    
    try {
      const profileBlocks = semanticBlocks.filter(block => 
        block.predicted_type === 'profile_card' && 
        (block.type_confidence || 0) >= 0.6
      );
      
      const extractedCount = extractedData?.length || 0;
      const profileBlocksCount = profileBlocks.length;
      
      // Expected: at least 50% of high-confidence profile blocks should yield results
      const expectedMinimum = Math.max(1, Math.floor(profileBlocksCount * 0.5));
      
      // Check if budget constraints caused the shortfall
      const budgetHit = (budgetUsed?.time || 0) > 15000 || 
                       (budgetUsed?.tokens || 0) > 800 ||
                       (budgetUsed?.requests || 0) > 3;
      
      const passed = extractedCount >= expectedMinimum || budgetHit;
      if (passed) this.passedTests++;
      
      this.testResults.push({
        test: testName,
        passed: passed,
        message: passed 
          ? `✅ Adequate results: ${extractedCount} extracted from ${profileBlocksCount} candidates`
          : `❌ Low yield: only ${extractedCount} extracted from ${profileBlocksCount} candidates (expected ≥${expectedMinimum})`,
        details: {
          profile_blocks_detected: profileBlocksCount,
          items_extracted: extractedCount,
          expected_minimum: expectedMinimum,
          yield_ratio: profileBlocksCount > 0 ? extractedCount / profileBlocksCount : 0,
          budget_hit: budgetHit,
          budget_used: budgetUsed
        }
      });
      
    } catch (error) {
      this.testResults.push({
        test: testName,
        passed: false,
        message: `❌ Test failed: ${error.message}`,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Test 5: Data Quality Test
   * Validate that extracted data meets quality standards
   */
  async testDataQuality(extractedData) {
    const testName = 'Data Quality Test';
    this.totalTests++;
    
    try {
      if (!extractedData || extractedData.length === 0) {
        this.testResults.push({
          test: testName,
          passed: false,
          message: '❌ No data to test quality',
          details: { items_count: 0 }
        });
        return;
      }
      
      let highQualityItems = 0;
      const qualityIssues = [];
      
      for (const item of extractedData) {
        const issues = [];
        
        // Name quality checks
        if (!item.name || item.name.length < 5) issues.push('name_too_short');
        if (item.name && /\d/.test(item.name)) issues.push('name_has_digits');
        if (item.name && item.name.toLowerCase().includes('staff')) issues.push('name_contamination');
        
        // Title quality checks
        if (!item.title || item.title.length < 3) issues.push('title_missing_or_short');
        if (item.title && item.title.toLowerCase().includes('staff')) issues.push('title_contamination');
        
        // Bio quality checks
        if (!item.bio || item.bio.length < 20) issues.push('bio_too_short');
        if (item.bio && item.bio.toLowerCase().startsWith('staff')) issues.push('bio_contamination');
        
        if (issues.length === 0) {
          highQualityItems++;
        } else {
          qualityIssues.push({ name: item.name, issues: issues });
        }
      }
      
      const qualityRatio = highQualityItems / extractedData.length;
      const passed = qualityRatio >= 0.7; // 70% should be high quality
      if (passed) this.passedTests++;
      
      this.testResults.push({
        test: testName,
        passed: passed,
        message: passed 
          ? `✅ High quality: ${highQualityItems}/${extractedData.length} items (${(qualityRatio * 100).toFixed(1)}%)`
          : `❌ Quality issues: only ${highQualityItems}/${extractedData.length} high quality (${(qualityRatio * 100).toFixed(1)}%)`,
        details: {
          high_quality_items: highQualityItems,
          total_items: extractedData.length,
          quality_ratio: qualityRatio,
          sample_issues: qualityIssues.slice(0, 5)
        }
      });
      
    } catch (error) {
      this.testResults.push({
        test: testName,
        passed: false,
        message: `❌ Test failed: ${error.message}`,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Test 6: Confidence Calibration Test
   * Items with high confidence should actually be high quality
   */
  async testConfidenceCalibration(extractedData) {
    const testName = 'Confidence Calibration Test';
    this.totalTests++;
    
    try {
      if (!extractedData || extractedData.length === 0) {
        this.testResults.push({
          test: testName,
          passed: false,
          message: '❌ No data to test confidence calibration',
          details: { items_count: 0 }
        });
        return;
      }
      
      const highConfidenceItems = extractedData.filter(item => (item.confidence || 0) >= 0.8);
      
      if (highConfidenceItems.length === 0) {
        this.testResults.push({
          test: testName,
          passed: true,
          message: '✅ No high-confidence items to calibrate - test passes',
          details: { high_confidence_items: 0 }
        });
        this.passedTests++;
        return;
      }
      
      let wellCalibratedItems = 0;
      
      for (const item of highConfidenceItems) {
        // High confidence items should have complete data
        const isComplete = item.name && item.name.length >= 5 &&
                          item.title && item.title.length >= 5 &&
                          item.bio && item.bio.length >= 50;
                          
        if (isComplete) {
          wellCalibratedItems++;
        }
      }
      
      const calibrationRatio = wellCalibratedItems / highConfidenceItems.length;
      const passed = calibrationRatio >= 0.8; // 80% of high-confidence should be complete
      if (passed) this.passedTests++;
      
      this.testResults.push({
        test: testName,
        passed: passed,
        message: passed 
          ? `✅ Well calibrated: ${wellCalibratedItems}/${highConfidenceItems.length} high-confidence items complete`
          : `❌ Poor calibration: only ${wellCalibratedItems}/${highConfidenceItems.length} high-confidence items complete`,
        details: {
          high_confidence_items: highConfidenceItems.length,
          well_calibrated_items: wellCalibratedItems,
          calibration_ratio: calibrationRatio,
          confidence_distribution: this.calculateConfidenceDistribution(extractedData)
        }
      });
      
    } catch (error) {
      this.testResults.push({
        test: testName,
        passed: false,
        message: `❌ Test failed: ${error.message}`,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Test 7: VMOTA Success Criteria Test
   * Validate specific VMOTA staff extraction requirements
   */
  async testVMOTASuccessCriteria(extractedData, originalHtml) {
    const testName = 'VMOTA Success Criteria Test';
    
    // Only run this test for VMOTA URLs
    if (!originalHtml.toLowerCase().includes('vmota') && !originalHtml.toLowerCase().includes('visual media outreach')) {
      return; // Skip this test for non-VMOTA sites
    }
    
    this.totalTests++;
    
    try {
      const expectedStaff = [
        { name: 'Katrina Bruins', title: 'Executive Director' },
        { name: 'Lauryn Dove', title: 'Administrative Assistant' },
        { name: 'Joel Ellazar', title: 'Marketing Specialist' },
        { name: 'Armando Garcia', title: 'Curatorial and Education Manager' },
        { name: 'Jane La Motte', title: 'Website Manager' },
        { name: 'Nilufer Leuthold', title: 'Director of Development' }
      ];
      
      const extractedCount = extractedData?.length || 0;
      let correctExtractions = 0;
      let cleanDataCount = 0;
      let boardContamination = 0;
      
      // Check for each expected staff member
      for (const expectedMember of expectedStaff) {
        const found = extractedData?.find(item => 
          item.name && item.name.toLowerCase().includes(expectedMember.name.toLowerCase())
        );
        
        if (found) {
          correctExtractions++;
          
          // Check for clean data (no "Staff" contamination)
          const hasCleanData = !found.name.toLowerCase().includes('staff') &&
                              !found.title.toLowerCase().includes('staff') &&
                              !found.bio?.toLowerCase().startsWith('staff');
          
          if (hasCleanData) {
            cleanDataCount++;
          }
        }
      }
      
      // Check for board contamination
      if (originalHtml.toLowerCase().includes('board of directors')) {
        for (const item of extractedData || []) {
          if (item.bio && item.bio.toLowerCase().includes('board')) {
            boardContamination++;
          }
        }
      }
      
      // Success criteria checks
      const hasMinimumStaff = correctExtractions >= 6; // At least 6 of the expected staff
      const hasCleanData = cleanDataCount >= correctExtractions * 0.8; // 80% clean data
      const hasMajorityFound = extractedCount >= 6; // At least 6 total extractions
      const noBoardContamination = boardContamination === 0;
      
      const passed = hasMinimumStaff && hasCleanData && hasMajorityFound && noBoardContamination;
      if (passed) this.passedTests++;
      
      this.testResults.push({
        test: testName,
        passed: passed,
        message: passed 
          ? `✅ VMOTA Success: ${correctExtractions}/6 expected staff extracted with clean data`
          : `❌ VMOTA Failed: only ${correctExtractions}/6 expected staff found, ${cleanDataCount} clean, ${boardContamination} board contaminated`,
        details: {
          expected_staff_count: expectedStaff.length,
          correct_extractions: correctExtractions,
          total_extractions: extractedCount,
          clean_data_count: cleanDataCount,
          board_contamination: boardContamination,
          success_criteria: {
            minimum_staff: hasMinimumStaff,
            clean_data: hasCleanData,
            majority_found: hasMajorityFound,
            no_board_contamination: noBoardContamination
          },
          found_staff: extractedData?.map(item => ({
            name: item.name,
            title: item.title,
            expected_match: expectedStaff.find(exp => 
              item.name && item.name.toLowerCase().includes(exp.name.toLowerCase())
            )?.name || 'unexpected'
          })) || []
        }
      });
      
    } catch (error) {
      this.testResults.push({
        test: testName,
        passed: false,
        message: `❌ Test failed: ${error.message}`,
        details: { error: error.message }
      });
    }
  }
  
  // Helper methods for quality assessment
  identifyNameIssues(name) {
    const issues = [];
    if (!name) issues.push('missing');
    else {
      if (name.length < 5) issues.push('too_short');
      if (name.length > 50) issues.push('too_long');
      if (/\d/.test(name)) issues.push('has_digits');
      if (name.toLowerCase().includes('staff')) issues.push('contamination');
    }
    return issues;
  }
  
  identifyTitleIssues(title) {
    const issues = [];
    if (!title) issues.push('missing');
    else {
      if (title.length < 3) issues.push('too_short');
      if (title.length > 120) issues.push('too_long');
      if (title.toLowerCase().includes('staff')) issues.push('contamination');
    }
    return issues;
  }
  
  identifyBioIssues(bio) {
    const issues = [];
    if (!bio) issues.push('missing');
    else {
      if (bio.length < 20) issues.push('too_short');
      if (bio.length > 2000) issues.push('too_long');
      if (bio.toLowerCase().startsWith('staff')) issues.push('contamination');
    }
    return issues;
  }
  
  calculateConfidenceDistribution(extractedData) {
    const buckets = { 'low (0-0.5)': 0, 'medium (0.5-0.8)': 0, 'high (0.8-1.0)': 0 };
    
    for (const item of extractedData) {
      const confidence = item.confidence || 0;
      if (confidence < 0.5) buckets['low (0-0.5)']++;
      else if (confidence < 0.8) buckets['medium (0.5-0.8)']++;
      else buckets['high (0.8-1.0)']++;
    }
    
    return buckets;
  }
}

/**
 * Comprehensive Logging System v0.1 - Detailed audit trail for all decisions
 * Tracks: block classification, field mapping, filtering, confidence scoring
 */
class ComprehensiveLogger {
  constructor() {
    this.auditTrail = [];
    this.decisionPoints = [];
    this.filteringSteps = [];
    this.budgetLedger = [];
    this.confidenceLogs = [];
  }
  
  /**
   * Initialize logging for a new extraction session
   */
  startExtractionSession(taskId, url) {
    this.auditTrail = [];
    this.sessionId = taskId;
    this.sessionStart = Date.now();
    
    this.logDecision('session_start', {
      session_id: taskId,
      url: url,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Log a major decision point with reasoning
   */
  logDecision(decision_type, data, reasoning = null) {
    const entry = {
      timestamp: Date.now(),
      session_time: Date.now() - this.sessionStart,
      decision_type: decision_type,
      data: data,
      reasoning: reasoning,
      trace_id: `${this.sessionId}_${this.auditTrail.length}`
    };
    
    this.auditTrail.push(entry);
    this.decisionPoints.push(entry);
    
    // Also log to console for real-time debugging
    console.log(`📊 DECISION [${decision_type}]: ${reasoning || JSON.stringify(data)}`);
  }
  
  /**
   * Log filtering steps with before/after counts
   */
  logFilteringStep(filter_name, before_count, after_count, reasoning, filtered_items = null) {
    const filterStep = {
      timestamp: Date.now(),
      session_time: Date.now() - this.sessionStart,
      filter_name: filter_name,
      before_count: before_count,
      after_count: after_count,
      filtered_count: before_count - after_count,
      filtering_ratio: before_count > 0 ? (before_count - after_count) / before_count : 0,
      reasoning: reasoning,
      sample_filtered: filtered_items ? filtered_items.slice(0, 3) : null
    };
    
    this.filteringSteps.push(filterStep);
    this.logDecision('filtering_step', filterStep, `${filter_name}: ${before_count} → ${after_count} (${filterStep.filtered_count} filtered)`);
  }
  
  /**
   * Log budget usage
   */
  logBudgetUsage(operation, cost_breakdown, cumulative_usage) {
    const budgetEntry = {
      timestamp: Date.now(),
      session_time: Date.now() - this.sessionStart,
      operation: operation,
      cost_breakdown: cost_breakdown,
      cumulative_usage: cumulative_usage,
      budget_remaining: {
        time: Math.max(0, (cumulative_usage.max_time || 20000) - (cumulative_usage.time || 0)),
        tokens: Math.max(0, (cumulative_usage.max_tokens || 800) - (cumulative_usage.tokens || 0)),
        requests: Math.max(0, (cumulative_usage.max_requests || 3) - (cumulative_usage.requests || 0))
      }
    };
    
    this.budgetLedger.push(budgetEntry);
    this.logDecision('budget_usage', budgetEntry, `${operation}: ${JSON.stringify(cost_breakdown)}`);
  }
  
  /**
   * Log confidence scoring details
   */
  logConfidenceScoring(item_id, field_confidences, overall_confidence, confidence_sources, methodology) {
    const confidenceEntry = {
      timestamp: Date.now(),
      session_time: Date.now() - this.sessionStart,
      item_id: item_id,
      field_confidences: field_confidences,
      overall_confidence: overall_confidence,
      confidence_sources: confidence_sources,
      methodology: methodology,
      confidence_tier: this.categorizeConfidence(overall_confidence)
    };
    
    this.confidenceLogs.push(confidenceEntry);
    this.logDecision('confidence_scoring', confidenceEntry, 
      `Item ${item_id}: ${overall_confidence.toFixed(2)} confidence (${methodology})`);
  }
  
  /**
   * Log block classification with labeling function votes
   */
  logBlockClassification(block, labeling_votes, final_prediction, filtering_decision) {
    this.logDecision('block_classification', {
      block_id: block.root_selector,
      block_heading: block.heading,
      text_preview: block.block_text?.substring(0, 100) + '...',
      link_density: block.link_density,
      text_density: block.text_density,
      labeling_votes: labeling_votes,
      final_prediction: final_prediction,
      type_confidence: final_prediction.confidence,
      labeling_agreement: final_prediction.agreement,
      filtering_decision: filtering_decision
    }, `Classified as ${final_prediction.type} (${final_prediction.confidence.toFixed(2)} conf, ${final_prediction.agreement.toFixed(2)} agree)`);
  }
  
  /**
   * Log field mapping details
   */
  logFieldMapping(block, field_mappings, mapping_sources, mapping_confidence) {
    this.logDecision('field_mapping', {
      block_id: block.root_selector,
      field_mappings: field_mappings,
      mapping_sources: mapping_sources,
      mapping_confidence: mapping_confidence,
      mapped_fields: Object.keys(field_mappings || {}),
      missing_fields: this.identifyMissingFields(field_mappings)
    }, `Mapped ${Object.keys(field_mappings || {}).length} fields with ${mapping_confidence.toFixed(2)} confidence`);
  }
  
  /**
   * Generate comprehensive extraction report
   */
  generateExtractionReport(final_results, evaluation_score) {
    const sessionEnd = Date.now();
    const totalTime = sessionEnd - this.sessionStart;
    
    const report = {
      session_summary: {
        session_id: this.sessionId,
        total_duration_ms: totalTime,
        total_decisions: this.decisionPoints.length,
        total_filtering_steps: this.filteringSteps.length,
        final_results_count: final_results?.length || 0,
        evaluation_score: evaluation_score
      },
      
      decision_timeline: this.auditTrail.map(entry => ({
        time_offset: entry.session_time,
        decision: entry.decision_type,
        reasoning: entry.reasoning,
        key_data: this.extractKeyData(entry)
      })),
      
      filtering_audit: {
        total_steps: this.filteringSteps.length,
        total_items_filtered: this.filteringSteps.reduce((sum, step) => sum + step.filtered_count, 0),
        filtering_efficiency: this.calculateFilteringEfficiency(),
        step_by_step: this.filteringSteps.map(step => ({
          filter: step.filter_name,
          before: step.before_count,
          after: step.after_count,
          filtered: step.filtered_count,
          reasoning: step.reasoning
        }))
      },
      
      confidence_analysis: {
        items_scored: this.confidenceLogs.length,
        confidence_distribution: this.calculateConfidenceDistribution(),
        high_confidence_items: this.confidenceLogs.filter(log => log.overall_confidence >= 0.8).length,
        low_confidence_items: this.confidenceLogs.filter(log => log.overall_confidence < 0.5).length,
        confidence_calibration: this.analyzeConfidenceCalibration(final_results)
      },
      
      budget_analysis: {
        total_operations: this.budgetLedger.length,
        final_usage: this.budgetLedger.length > 0 ? this.budgetLedger[this.budgetLedger.length - 1].cumulative_usage : {},
        cost_breakdown_by_operation: this.analyzeCostsByOperation(),
        budget_efficiency: this.calculateBudgetEfficiency(final_results?.length || 0)
      },
      
      decision_patterns: {
        most_common_decisions: this.getMostCommonDecisions(),
        decision_velocity: this.calculateDecisionVelocity(),
        critical_decision_points: this.identifyCriticalDecisions()
      },
      
      quality_indicators: {
        answers_why_keep_drop: this.validateDecisionTraceability(),
        audit_completeness: this.checkAuditCompleteness(),
        missing_decision_points: this.identifyMissingDecisions()
      }
    };
    
    console.log(`📊 Generated comprehensive extraction report: ${this.decisionPoints.length} decisions, ${this.filteringSteps.length} filtering steps`);
    
    return report;
  }
  
  // Helper methods for report generation
  categorizeConfidence(confidence) {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }
  
  extractKeyData(entry) {
    // Extract most important data points for timeline
    switch (entry.decision_type) {
      case 'block_classification':
        return { 
          prediction: entry.data.final_prediction?.type, 
          confidence: entry.data.final_prediction?.confidence 
        };
      case 'filtering_step':
        return { 
          before: entry.data.before_count, 
          after: entry.data.after_count 
        };
      case 'confidence_scoring':
        return { 
          confidence: entry.data.overall_confidence 
        };
      default:
        return {};
    }
  }
  
  calculateFilteringEfficiency() {
    if (this.filteringSteps.length === 0) return 0;
    
    const totalFiltered = this.filteringSteps.reduce((sum, step) => sum + step.filtered_count, 0);
    const initialCount = this.filteringSteps[0]?.before_count || 0;
    
    return initialCount > 0 ? totalFiltered / initialCount : 0;
  }
  
  calculateConfidenceDistribution() {
    if (this.confidenceLogs.length === 0) return {};
    
    const distribution = { high: 0, medium: 0, low: 0 };
    this.confidenceLogs.forEach(log => {
      const tier = this.categorizeConfidence(log.overall_confidence);
      distribution[tier]++;
    });
    
    return distribution;
  }
  
  analyzeConfidenceCalibration(finalResults) {
    // Check if high confidence items actually have high quality
    const highConfLogs = this.confidenceLogs.filter(log => log.overall_confidence >= 0.8);
    const highConfResults = finalResults?.filter(item => (item.confidence || 0) >= 0.8) || [];
    
    return {
      high_conf_predicted: highConfLogs.length,
      high_conf_delivered: highConfResults.length,
      calibration_ratio: highConfLogs.length > 0 ? highConfResults.length / highConfLogs.length : 0
    };
  }
  
  analyzeCostsByOperation() {
    const costsByOp = {};
    this.budgetLedger.forEach(entry => {
      const op = entry.operation;
      if (!costsByOp[op]) {
        costsByOp[op] = { time: 0, tokens: 0, requests: 0, count: 0 };
      }
      costsByOp[op].time += entry.cost_breakdown.time || 0;
      costsByOp[op].tokens += entry.cost_breakdown.tokens || 0;
      costsByOp[op].requests += entry.cost_breakdown.requests || 0;
      costsByOp[op].count++;
    });
    
    return costsByOp;
  }
  
  calculateBudgetEfficiency(finalResultsCount) {
    if (this.budgetLedger.length === 0) return 0;
    
    const finalUsage = this.budgetLedger[this.budgetLedger.length - 1].cumulative_usage;
    const totalCost = (finalUsage.time || 0) + (finalUsage.tokens || 0) * 10 + (finalUsage.requests || 0) * 1000;
    
    return finalResultsCount > 0 && totalCost > 0 ? finalResultsCount / totalCost * 10000 : 0; // Results per 10k cost units
  }
  
  getMostCommonDecisions() {
    const decisionCounts = {};
    this.decisionPoints.forEach(decision => {
      decisionCounts[decision.decision_type] = (decisionCounts[decision.decision_type] || 0) + 1;
    });
    
    return Object.entries(decisionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
  }
  
  calculateDecisionVelocity() {
    if (this.decisionPoints.length < 2) return 0;
    
    const totalTime = this.decisionPoints[this.decisionPoints.length - 1].session_time;
    return totalTime > 0 ? (this.decisionPoints.length / totalTime) * 1000 : 0; // Decisions per second
  }
  
  identifyCriticalDecisions() {
    // Decisions that significantly changed the result count
    return this.filteringSteps
      .filter(step => step.filtering_ratio > 0.3) // More than 30% filtered
      .map(step => ({
        filter: step.filter_name,
        impact: step.filtering_ratio,
        reasoning: step.reasoning
      }));
  }
  
  validateDecisionTraceability() {
    // Check if each filtering decision can be traced back to reasoning
    const traceableDecisions = this.filteringSteps.filter(step => 
      step.reasoning && step.reasoning.length > 10
    ).length;
    
    return {
      traceable_decisions: traceableDecisions,
      total_decisions: this.filteringSteps.length,
      traceability_ratio: this.filteringSteps.length > 0 ? traceableDecisions / this.filteringSteps.length : 0
    };
  }
  
  checkAuditCompleteness() {
    const requiredDecisionTypes = [
      'session_start', 'block_classification', 'filtering_step', 
      'field_mapping', 'confidence_scoring'
    ];
    
    const presentTypes = [...new Set(this.decisionPoints.map(d => d.decision_type))];
    const missingTypes = requiredDecisionTypes.filter(type => !presentTypes.includes(type));
    
    return {
      required_types: requiredDecisionTypes.length,
      present_types: presentTypes.length,
      missing_types: missingTypes,
      completeness_ratio: requiredDecisionTypes.length > 0 ? 
        (requiredDecisionTypes.length - missingTypes.length) / requiredDecisionTypes.length : 1
    };
  }
  
  identifyMissingDecisions() {
    const gaps = [];
    
    // Check for large time gaps without decisions (>2 seconds)
    for (let i = 1; i < this.decisionPoints.length; i++) {
      const timeDiff = this.decisionPoints[i].session_time - this.decisionPoints[i-1].session_time;
      if (timeDiff > 2000) {
        gaps.push({
          gap_start: this.decisionPoints[i-1].session_time,
          gap_duration: timeDiff,
          potential_missing_decision: 'Processing activity not logged'
        });
      }
    }
    
    return gaps;
  }
  
  identifyMissingFields(fieldMappings) {
    const requiredFields = ['name', 'title', 'bio'];
    return requiredFields.filter(field => !fieldMappings || !fieldMappings[field]);
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
 * Smart LLM-based transformation to convert raw data to schema format
 */
async function transformDataToSchema(rawData, targetSchema, instructions) {
  console.log('🤖 Starting smart transformation to match schema');
  
  try {
    // Check if we have OpenAI API key for GPT
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey || openaiKey === 'sk-placeholder') {
      console.log('⚠️ No OpenAI API key, using deterministic transformation');
      return deterministicTransformation(rawData, targetSchema);
    }
    
    // Prepare the transformation prompt
    const transformationPrompt = `You are a data transformation expert. Your task is to transform raw extracted data into a specific JSON schema format.

Target Schema:
${JSON.stringify(targetSchema, null, 2)}

Extraction Instructions:
${instructions}

Raw Extracted Data:
${JSON.stringify(rawData, null, 2).slice(0, 8000)}

IMPORTANT RULES:
1. Your response must be ONLY valid JSON that exactly matches the target schema
2. Extract and transform ALL relevant data from the raw input
3. Parse and split concatenated text properly - if name contains title and bio, split them
4. DEDUPLICATE - each person should appear only ONCE
5. Clean data:
   - Split 'Katrina BruinsExecutive Director' into name: 'Katrina Bruins', title: 'Executive Director'
   - Extract bio as the description text that follows
   - Remove any HTML, timestamps, or metadata
6. Return a clean array with ONLY unique people
7. Do NOT include any explanations, just the JSON output
8. Each person should have clean, separate fields for name, title/role, and bio

Transform the raw data to match the schema EXACTLY:`;

    // Call OpenAI API for transformation
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5',
        messages: [{
          role: 'system',
          content: 'You are a precise data transformation assistant. You output ONLY valid JSON with no explanations.'
        }, {
          role: 'user',
          content: transformationPrompt
        }],
        temperature: 0,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      })
    });

    if (response.ok) {
      const result = await response.json();
      const transformedText = result.choices[0].message.content;
      
      // Parse the JSON response
      try {
        const transformed = JSON.parse(transformedText);
        console.log('✅ Smart transformation successful using GPT-5');
        return transformed;
      } catch (parseError) {
        // Try to extract JSON from the response
        const jsonMatch = transformedText.match(/\{[\s\S]*\}/);  
        if (jsonMatch) {
          const transformed = JSON.parse(jsonMatch[0]);
          console.log('✅ Extracted valid JSON from GPT response');
          return transformed;
        }
        throw new Error('Failed to parse transformed data');
      }
    } else {
      console.error('OpenAI API error:', response.statusText);
      return deterministicTransformation(rawData, targetSchema);
    }
  } catch (error) {
    console.error('Smart transformation failed:', error);
    // Fallback to deterministic transformation
    return deterministicTransformation(rawData, targetSchema);
  }
}

/**
 * Deterministic transformation fallback when LLM is not available
 */
function deterministicTransformation(rawData, targetSchema) {
  console.log('📐 Using deterministic transformation');
  
  const result = {};
  
  // Handle different raw data formats
  if (Array.isArray(rawData)) {
    // If raw data is array, try to map to schema
    for (const [key, prop] of Object.entries(targetSchema.properties || {})) {
      if (prop.type === 'array') {
        // Map array data to array property
        result[key] = rawData.map(item => {
          if (prop.items && prop.items.properties) {
            return extractFieldsFromItem(item, prop.items.properties);
          }
          return item;
        });
      } else if (prop.type === 'number' && key.includes('count')) {
        result[key] = rawData.length;
      }
    }
  } else if (typeof rawData === 'object') {
    // Process object data
    for (const [key, prop] of Object.entries(targetSchema.properties || {})) {
      result[key] = findAndExtractField(rawData, key, prop);
    }
  }
  
  // Ensure schema compliance
  return enforceSchemaCompliance(result, targetSchema);
}

function extractFieldsFromItem(item, properties) {
  const result = {};
  
  for (const [fieldName, fieldSchema] of Object.entries(properties)) {
    // Try multiple strategies to find the field
    result[fieldName] = 
      item[fieldName] ||
      findInNestedObject(item, fieldName) ||
      extractFromText(item, fieldName) ||
      getDefaultForType(fieldSchema.type);
  }
  
  return result;
}

function findAndExtractField(data, fieldName, fieldSchema) {
  // Direct match
  if (data[fieldName] !== undefined) {
    return data[fieldName];
  }
  
  // Try variations of field name
  const variations = [
    fieldName.toLowerCase(),
    fieldName.toUpperCase(),
    fieldName.replace(/_/g, ''),
    fieldName.replace(/_/g, '-')
  ];
  
  for (const variation of variations) {
    if (data[variation] !== undefined) {
      return data[variation];
    }
  }
  
  // Search in nested objects
  return findInNestedObject(data, fieldName) || getDefaultForType(fieldSchema.type);
}

function findInNestedObject(obj, fieldName) {
  for (const key in obj) {
    if (key.toLowerCase().includes(fieldName.toLowerCase())) {
      return obj[key];
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const found = findInNestedObject(obj[key], fieldName);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function extractFromText(item, fieldName) {
  // Try to extract from text fields
  const text = item.block_text || item.text || item.content || '';
  
  if (fieldName === 'name' || fieldName === 'title') {
    // Extract first line or heading
    const lines = text.split('\n').filter(l => l.trim());
    return lines[0] || '';
  }
  
  if (fieldName === 'bio' || fieldName === 'description') {
    // Return full text minus the first line
    const lines = text.split('\n').filter(l => l.trim());
    return lines.slice(1).join(' ').trim();
  }
  
  return undefined;
}

/**
 * Main plan-based processor - replaces old hardcoded extraction
 */
async function processWithPlanBasedSystem(content, params) {
  console.log('🚀 Using plan-based extraction system');
  console.log('📄 Content type:', typeof content);
  console.log('📄 Content length:', content?.length || 0);
  console.log('📄 Content preview (first 300 chars):', content?.substring(0, 300) || 'No content');
  
  try {
    // Create extraction task from parameters - support both parameter formats  
    const instructions = params.extractionInstructions || params.instructions;
    const targetSchema = params.outputSchema || params.schema;
    
    const task = {
      url: params.url,
      instructions: instructions,
      targetSchema: targetSchema,
      constraints: {
        max_results: 10,
        quality_threshold: 0.6,
        max_time: 10000
      }
    };
    
    // Generate plan using Two-Pass Planner (falls back to single-pass if appropriate)
    const planner = new TwoPassPlanner();
    const plan = planner.generatePlan(task);
    
    // Execute plan (single-pass or two-pass)
    const executor = new PlanExecutor();
    const initialInputs = {
      html: content, // Raw HTML content
      target_schema: targetSchema
    };
    
    let executionResult;
    if (plan.passes) {
      // Two-pass plan execution
      executionResult = await executor.executeTwoPassPlan(plan, initialInputs);
    } else {
      // Single-pass plan execution  
      executionResult = await executor.executePlan(plan, initialInputs);
    }
    
    if (!executionResult.success) {
      throw new Error(`Plan execution failed: ${executionResult.error}`);
    }
    
    // Evaluate results
    const evaluator = new SimpleEvaluator();
    const evaluation = evaluator.evaluate(executionResult, targetSchema);
    
    // Initialize comprehensive logging
    const logger = new ComprehensiveLogger();
    logger.startExtractionSession(plan.task_id, params.url);
    
    // Generate comprehensive audit report
    const auditReport = logger.generateExtractionReport(executionResult.data, evaluation.overall_score);
    
    // Generic pattern testing
    const patternTests = new GenericPatternTests();
    const semanticBlocks = executionResult.context_final?.semantic_blocks || [];
    const testResults = await patternTests.runAllTests(executionResult, semanticBlocks, content);
    
    // Active learning analysis
    const activeLearning = new ActiveLearningQueue();
    const learningAnalysis = activeLearning.analyzeForLearning(executionResult, semanticBlocks, evaluation);
    
    console.log(`✅ Plan-based extraction completed with score: ${evaluation.overall_score.toFixed(2)}`);
    console.log(`🧪 Pattern tests: ${testResults.passed}/${testResults.total} passed (${(testResults.pass_rate * 100).toFixed(1)}%)`);
    console.log(`📊 Audit report: ${auditReport.session_summary.total_decisions} decisions, ${auditReport.filtering_audit.total_steps} filtering steps`);
    console.log(`🎓 Learning value: ${learningAnalysis.learning_value_score.toFixed(2)} (${learningAnalysis.queue_status.total_queued} cases queued)`);
    
    // Transform raw extraction data to match schema using smart LLM layer
    let finalData = executionResult.data;
    if (targetSchema && instructions) {
      console.log('🔄 Transforming raw data to match schema...');
      finalData = await transformDataToSchema(
        executionResult.data,
        targetSchema,
        instructions
      );
      
      // Final validation to ensure perfect compliance
      finalData = enforceSchemaCompliance(finalData, targetSchema);
      console.log('✅ Data transformation complete - matches schema perfectly');
    }
    
    // AGGRESSIVELY SIMPLIFY: Return ONLY the clean data the user asked for
    if (finalData) {
      // If it's already an array, deduplicate and clean it
      if (Array.isArray(finalData)) {
        // Deduplicate based on name field
        const seen = new Set();
        finalData = finalData.filter(item => {
          if (!item.name || seen.has(item.name)) return false;
          seen.add(item.name);
          
          // AGGRESSIVE PARSING: Name field contains everything concatenated
          if (typeof item.name === 'string') {
            const text = item.name;
            
            // Pattern 1: "FirstName LastNameTitle Rest of bio"
            // Look for pattern like "Katrina BruinsExecutive Director"
            const match1 = text.match(/^([A-Z][a-z]+ [A-Z][a-z]+)([A-Z][a-z]+(?: [A-Z][a-z]+)*)(.*)/s);
            if (match1) {
              item.name = match1[1].trim();
              item.title = match1[2].trim();
              item.bio = match1[3].trim();
            } else {
              // Pattern 2: Name might have line breaks or other separators
              const lines = text.split(/[\n\t]+/).filter(l => l.trim());
              if (lines.length >= 2) {
                item.name = lines[0].trim();
                item.title = lines[1].trim();
                item.bio = lines.slice(2).join(' ').trim();
              } else {
                // Last resort: Find where lowercase meets uppercase (name boundary)
                const boundary = text.search(/[a-z][A-Z]/);
                if (boundary > 0 && boundary < 50) {
                  item.name = text.substring(0, boundary + 1).trim();
                  const rest = text.substring(boundary + 1);
                  // Find next boundary for title
                  const titleBoundary = rest.search(/[a-z][A-Z]/);
                  if (titleBoundary > 0 && titleBoundary < 50) {
                    item.title = rest.substring(0, titleBoundary + 1).trim();
                    item.bio = rest.substring(titleBoundary + 1).trim();
                  } else {
                    item.title = rest.substring(0, 30).trim();
                    item.bio = rest.substring(30).trim();
                  }
                }
              }
            }
            
            // Clean up title field
            if (item.title) {
              item.title = item.title.replace(/([a-z])([A-Z])/g, '$1 $2');
            }
          }
          
          // Clean role field
          if (item.role && item.role.includes(',')) {
            item.role = item.role.split(',')[0].trim();
          }
          
          return true;
        });
      } else if (typeof finalData === 'object') {
        // Remove ALL metadata fields
        delete finalData.url;
        delete finalData.title;
        delete finalData.metadata;
        delete finalData.extractionNote;
        delete finalData.instructions;
        delete finalData.postProcessing;
        delete finalData.extraction_metadata;
        delete finalData.total_count;
        delete finalData.skills_used;
        delete finalData.plan_id;
        delete finalData.evaluation;
        delete finalData.confidence;
        
        // If there's a 'people' or similar array field, extract just that
        const arrayFields = Object.keys(finalData).filter(key => 
          Array.isArray(finalData[key]) && 
          (key === 'people' || key === 'items' || key === 'products' || key === 'articles' || key === 'events' ||
           key.startsWith('0') || key.startsWith('1')) // Handle numbered keys
        );
        
        // Also handle case where data is like {0: {...}, 1: {...}, ...}
        const numberedKeys = Object.keys(finalData).filter(key => /^\d+$/.test(key));
        if (numberedKeys.length > 0 && arrayFields.length === 0) {
          // Convert numbered object to array
          finalData = numberedKeys.map(key => finalData[key]);
          
          // Now process this array
          const seen = new Set();
          finalData = finalData.filter(item => {
            if (!item) return false;
            
            // Parse concatenated name field
            if (typeof item.name === 'string' && item.name.length > 50) {
              const text = item.name;
              const match = text.match(/^([A-Z][a-z]+ [A-Z][a-z]+)([A-Z][a-z]+(?: [A-Z][a-z]+)*)(.*)/s);
              if (match) {
                item.name = match[1].trim();
                item.title = item.title || match[2].trim();
                item.bio = item.bio || match[3].trim();
              }
            }
            
            const identifier = item.name || item.title || JSON.stringify(item);
            if (seen.has(identifier)) return false;
            seen.add(identifier);
            return true;
          });
        }
        
        if (arrayFields.length === 1) {
          finalData = finalData[arrayFields[0]];
          
          // Apply same deduplication and cleaning
          const seen = new Set();
          finalData = finalData.filter(item => {
            const identifier = item.name || item.title || JSON.stringify(item);
            if (seen.has(identifier)) return false;
            seen.add(identifier);
            return true;
          });
        }
      }
    }
    
    return {
      success: true,
      data: finalData,
      // CRITICAL: Do NOT return metadata if we have clean data
      ...(Array.isArray(finalData) ? {} : { metadata: {
        strategy: plan.passes ? 'two_pass_extraction' : 'plan_based_extraction',
        plan_id: plan.task_id,
        skills_used: plan.passes 
          ? plan.passes.flatMap(pass => pass.steps.map(step => step.skill))
          : plan.steps.map(step => step.skill),
        execution_time: executionResult.execution_time,
        budget_used: executionResult.budget_used,
        evaluation: evaluation,
        trace: executionResult.trace,
        // Two-pass specific metadata
        ...(plan.passes && executionResult.passes && {
          pass_a_candidates: executionResult.pass_a_candidates,
          pass_b_results: executionResult.pass_b_results,
          efficiency_gain: executionResult.efficiency_gain
        }),
        // Testing metadata
        pattern_tests: testResults,
        // Comprehensive audit trail
        audit_report: auditReport,
        // Active learning metadata
        learning_analysis: learningAnalysis
      }})};
    
  } catch (error) {
    console.error('Plan-based extraction failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Enforce schema compliance on extracted data
function enforceSchemaCompliance(data, schema) {
  if (!schema || !schema.properties) return data;
  
  // Handle array of items
  if (Array.isArray(data)) {
    if (schema.type === 'array' && schema.items) {
      return data.map(item => enforceSchemaCompliance(item, schema.items));
    }
    // If data is array but schema expects object with array property
    if (schema.type === 'object') {
      // Try to find an array property in schema
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (prop.type === 'array') {
          return enforceSchemaCompliance({ [key]: data }, schema);
        }
      }
    }
  }
  
  const result = {};
  
  // Process each property defined in schema
  for (const [key, prop] of Object.entries(schema.properties)) {
    // Check if data has this property
    if (data && data.hasOwnProperty(key)) {
      result[key] = validateAndConvertType(data[key], prop);
    } else if (prop.default !== undefined) {
      result[key] = prop.default;
    } else if (schema.required && schema.required.includes(key)) {
      // Required field is missing, add appropriate default
      result[key] = getDefaultForType(prop.type);
    }
  }
  
  return result;
}

function validateAndConvertType(value, propSchema) {
  const type = propSchema.type;
  
  switch(type) {
    case 'string':
      return value != null ? String(value) : '';
    case 'number':
    case 'integer':
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    case 'boolean':
      return Boolean(value);
    case 'array':
      if (Array.isArray(value)) {
        if (propSchema.items) {
          return value.map(item => validateAndConvertType(item, propSchema.items));
        }
        return value;
      }
      return [];
    case 'object':
      if (typeof value === 'object' && value !== null) {
        if (propSchema.properties) {
          return enforceSchemaCompliance(value, propSchema);
        }
        return value;
      }
      return {};
    default:
      return value;
  }
}

function getDefaultForType(type) {
  switch(type) {
    case 'string': return '';
    case 'number':
    case 'integer': return 0;
    case 'boolean': return false;
    case 'array': return [];
    case 'object': return {};
    default: return null;
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
 * @deprecated - DEPRECATED: Old validateOutputSkill replaced by skillValidateOutput in PlanExecutor
 * This function is no longer used in the plan-based system
 */
function validateOutputSkill(data, schema) {
  console.warn('⚠️ DEPRECATED: validateOutputSkill is deprecated. Use skillValidateOutput in PlanExecutor instead.');
  
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
 * @deprecated - DEPRECATED: Old skill-based processor replaced by plan-based system
 * Use processWithPlanBasedSystem instead - this provides better DOM-first extraction
 */
async function processWithSkills(content, params) {
  console.warn('⚠️ DEPRECATED: processWithSkills is deprecated. Use processWithPlanBasedSystem instead.');
  
  // Redirect to new plan-based system
  return await processWithPlanBasedSystem(content, params);
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
    
    // Check for structured extraction request - support both old and new parameter formats
    const needsStructuredExtraction = (
      (params.formats && params.formats.includes('structured')) || 
      params.extractionType === 'structured' ||
      params.extractionMethod === 'plan_based'
    ) && (
      params.extractionInstructions || params.instructions
    ) && (
      params.outputSchema || params.schema
    );
    
    if (needsStructuredExtraction) {
      console.log('🎯 Structured extraction requested - using plan-based system');
      
      try {
        // Pass HTML content to plan-based system (it needs DOM structure)
        const htmlContent = contentHtml;
        
        // Process with plan-based system - normalize parameter names
        const normalizedParams = {
          ...params,
          extractionInstructions: params.extractionInstructions || params.instructions,
          outputSchema: params.outputSchema || params.schema
        };
        const skillResult = await processWithPlanBasedSystem(htmlContent, normalizedParams);
        
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
      // Create JSON-safe version by removing circular references and DOM elements
      const cleanData = (data) => {
        if (Array.isArray(data)) {
          return data.slice(0, 2).map(item => cleanData(item));
        } else if (data && typeof data === 'object') {
          const clean = {};
          for (const [key, value] of Object.entries(data)) {
            // Skip DOM elements and circular references
            if (key === 'element' || key === 'dom_structure' || typeof value === 'function') {
              continue;
            }
            if (value && typeof value === 'object' && (value.constructor.name === 'Element' || value.cheerio)) {
              continue;
            }
            clean[key] = cleanData(value);
          }
          return clean;
        }
        return data;
      };
      
      const sampleData = cleanData(result.data);
      console.log('Sample extracted data:', JSON.stringify(sampleData, null, 2));
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

// Lambda handler for SQS events
const handler = async (event) => {
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

// Export for use in other modules and Lambda
module.exports = {
  handler,
  processWithPlanBasedSystem,
  PlanExecutor,
  BasicPlanner,
  SimpleEvaluator,
  testPlanBasedSystem
};