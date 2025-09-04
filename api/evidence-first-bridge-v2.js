/**
 * Evidence-First Bridge V2 - GPT-5 Migration Implementation
 * 
 * Modernized extraction engine using GPT-5 with:
 * - Tiered model selection (nano/mini/full) for cost optimization
 * - Complexity-based routing for optimal performance
 * - Reasoning mode for complex extraction tasks
 * - Efficient HTML processing with truncation
 * - Confidence scoring based on model capabilities
 * - Full backward compatibility with existing interface
 */

const GPT5Client = require('./services/gpt5-client');

class EvidenceFirstBridgeV2 {
  constructor() {
    this.client = new GPT5Client();
    this.maxHtmlLength = 50000; // Prevent token overflow
    this.debugMode = process.env.NODE_ENV === 'development';
  }

  /**
   * Main extraction method - replaces legacy processWithEvidenceFirst
   * @param {string} html - Raw HTML content to extract from
   * @param {string} instructions - Extraction instructions from user
   * @param {object} options - Additional options (budget, maxPages, etc.)
   * @returns {Promise<object>} Extraction result with data and metadata
   */
  async extractFromHTML(html, instructions, options = {}) {
    const startTime = Date.now();
    
    try {
      // Calculate complexity to select optimal model
      const complexity = this.calculateExtractionComplexity(html, instructions);
      
      if (this.debugMode) {
        console.log(`📊 Extraction complexity: ${complexity.toFixed(2)}`);
      }

      // Generate extraction prompt with HTML truncation
      const prompt = this.buildExtractionPrompt(html, instructions);
      
      // Call GPT-5 with optimal model selection
      const result = await this.client.complete({
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        complexity,
        budget: options.budget || 0.005,
        requiresReasoning: this.needsReasoning(instructions),
        outputFormat: 'json'
      });

      // Parse and validate result
      let extractedData;
      try {
        extractedData = JSON.parse(result.content);
      } catch (parseError) {
        throw new Error(`Failed to parse GPT-5 response: ${parseError.message}`);
      }

      const processingTime = Date.now() - startTime;
      const confidence = this.calculateConfidence(result);

      return {
        success: true,
        data: Array.isArray(extractedData) ? extractedData : [extractedData],
        metadata: {
          processingMethod: 'evidence_first_bridge_v2_gpt5',
          processingTime,
          model: result.model,
          cost: result.cost,
          confidence,
          complexity,
          htmlLength: html.length,
          truncated: html.length > this.maxHtmlLength,
          reasoningUsed: this.needsReasoning(instructions),
          fallbackUsed: result.fallback || false,
          tokens: result.usage
        }
      };

    } catch (error) {
      console.error('GPT-5 extraction failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        data: [],
        metadata: {
          processingMethod: 'evidence_first_bridge_v2_gpt5',
          processingTime: Date.now() - startTime,
          failed: true,
          fallbackUsed: false
        }
      };
    }
  }

  /**
   * Calculate extraction complexity based on HTML size, instruction complexity, and task requirements
   * @param {string} html - HTML content to analyze
   * @param {string} instructions - User extraction instructions
   * @returns {number} Complexity score between 0 and 1
   */
  calculateExtractionComplexity(html, instructions) {
    // HTML size factor (0-0.4 scale)
    const htmlSize = Math.min(html.length / 100000, 0.4);
    
    // Instruction complexity (0-0.3 scale)
    const instructionLength = Math.min(instructions.length / 1000, 0.2);
    const technicalTerms = this.countTechnicalTerms(instructions) * 0.1;
    const instructionComplexity = Math.min(instructionLength + technicalTerms, 0.3);
    
    // Schema requirements (0.2 if present)
    const hasSchema = instructions.toLowerCase().includes('schema') ? 0.2 : 0;
    
    // Multi-page indicators (0.3 if present)  
    const multiPageKeywords = ['multi-page', 'all pages', 'crawl', 'navigate', 'pagination'];
    const multiPage = multiPageKeywords.some(keyword => 
      instructions.toLowerCase().includes(keyword)
    ) ? 0.3 : 0;

    // Analytical requirements
    const analyticalKeywords = ['analyze', 'compare', 'relationship', 'pattern', 'correlation'];
    const analytical = analyticalKeywords.some(keyword => 
      instructions.toLowerCase().includes(keyword)
    ) ? 0.2 : 0;

    return Math.min(
      htmlSize + instructionComplexity + hasSchema + multiPage + analytical, 
      1.0
    );
  }

  /**
   * Count technical terms in instructions to assess complexity
   * @param {string} instructions - User instructions
   * @returns {number} Count of technical terms found
   */
  countTechnicalTerms(instructions) {
    const technicalTerms = [
      'implement', 'algorithm', 'optimize', 'parse', 'validate',
      'schema', 'json', 'xml', 'api', 'database', 'query',
      'filter', 'aggregate', 'transform', 'normalize'
    ];
    
    const lowerInstructions = instructions.toLowerCase();
    return technicalTerms.filter(term => lowerInstructions.includes(term)).length;
  }

  /**
   * Determine if reasoning mode should be enabled based on instruction keywords
   * @param {string} instructions - User extraction instructions
   * @returns {boolean} True if reasoning mode should be used
   */
  needsReasoning(instructions) {
    const reasoningKeywords = [
      'analyze', 'compare', 'evaluate', 'determine', 'assess',
      'relationship', 'pattern', 'correlation', 'infer', 'deduce',
      'reason', 'logic', 'conclude', 'derive', 'interpret',
      'understand', 'explain', 'why', 'because', 'causality'
    ];
    
    const lowerInstructions = instructions.toLowerCase();
    return reasoningKeywords.some(keyword => lowerInstructions.includes(keyword));
  }

  /**
   * Build extraction prompt with HTML truncation for efficiency
   * @param {string} html - Raw HTML content  
   * @param {string} instructions - User instructions
   * @returns {string} Formatted prompt for GPT-5
   */
  buildExtractionPrompt(html, instructions) {
    // Truncate HTML if too long to prevent token overflow
    const truncatedHtml = html.length > this.maxHtmlLength 
      ? html.substring(0, this.maxHtmlLength) + '\n\n...[HTML content truncated for efficiency]'
      : html;

    return `Extract the following information from the provided HTML content:

EXTRACTION REQUEST:
${instructions}

IMPORTANT GUIDELINES:
1. Return ONLY valid JSON format - no explanations or markdown
2. Extract ALL matching items found in the HTML
3. If multiple items exist, return them as an array
4. Include only the fields specifically requested
5. Use clean, readable values (not raw HTML)
6. If data is missing for an item, omit that field entirely

HTML CONTENT:
${truncatedHtml}

Return the extracted data as JSON:`;
  }

  /**
   * Get system prompt optimized for GPT-5 extraction tasks
   * @returns {string} System prompt
   */
  getSystemPrompt() {
    return `You are a specialized data extraction engine powered by GPT-5. Your task is to extract structured information from HTML content with maximum accuracy and efficiency.

CORE CAPABILITIES:
- Parse HTML structure and content semantically
- Identify repeating patterns and data relationships
- Extract precise information based on user requirements
- Handle complex nested data structures
- Maintain data integrity and consistency

RESPONSE FORMAT:
- Always return valid JSON
- Use arrays for multiple items
- Use objects for single items with multiple fields
- Never include explanatory text outside the JSON
- Clean all extracted text values

QUALITY STANDARDS:
- Extract ALL matching items, not just the first few
- Preserve data relationships where relevant
- Handle edge cases gracefully
- Ensure consistent field naming across items`;
  }

  /**
   * Calculate confidence score based on the model used and extraction characteristics
   * @param {object} result - GPT-5 completion result
   * @returns {number} Confidence score between 0 and 1
   */
  calculateConfidence(result) {
    // Base confidence by model capability
    const baseConfidence = {
      'gpt-5': 0.98,
      'gpt-5-mini': 0.95, 
      'gpt-5-nano': 0.90,
      'gpt-4-turbo-preview': 0.85, // Fallback model
      'gpt-4o': 0.88 // Legacy fallback
    };

    let confidence = baseConfidence[result.model] || 0.80;

    // Adjust based on fallback usage
    if (result.fallback) {
      confidence *= 0.9; // Slight reduction for fallback
    }

    // Adjust based on token usage efficiency
    if (result.usage) {
      const tokenEfficiency = Math.min(result.usage.completion_tokens / result.usage.prompt_tokens, 1);
      if (tokenEfficiency > 0.5) {
        confidence *= 0.95; // Penalize overly verbose responses
      }
    }

    return Math.max(Math.min(confidence, 1.0), 0.0);
  }

  /**
   * Legacy compatibility method - maps to extractFromHTML
   * @param {string} htmlContent - HTML content
   * @param {object} params - Parameters object
   * @returns {Promise<object>} Extraction result
   */
  async processWithEvidenceFirst(htmlContent, params = {}) {
    const instructions = params.extractionInstructions || 'Extract all relevant data';
    const options = {
      budget: params.budget,
      maxPages: params.maxPages,
      includeSubdomains: params.includeSubdomains
    };

    return await this.extractFromHTML(htmlContent, instructions, options);
  }
}

/**
 * Factory function for backward compatibility
 * @returns {EvidenceFirstBridgeV2} New instance
 */
function createEvidenceFirstProcessor() {
  return new EvidenceFirstBridgeV2();
}

/**
 * Legacy wrapper function for existing integrations
 * @param {string} htmlContent - HTML content
 * @param {object} params - Parameters
 * @returns {Promise<object>} Extraction result
 */
async function processWithEvidenceFirst(htmlContent, params = {}) {
  const processor = new EvidenceFirstBridgeV2();
  return await processor.processWithEvidenceFirst(htmlContent, params);
}

// Export both class and compatibility functions
module.exports = {
  EvidenceFirstBridgeV2,
  createEvidenceFirstProcessor,
  processWithEvidenceFirst,
  // Legacy exports for backward compatibility
  EvidenceFirstProcessor: EvidenceFirstBridgeV2
};