// Atlas Codex - GPT-5 Extraction Module
// Handles GPT-5 based content extraction with proper parameters

const crypto = require('crypto');

class GPT5Extractor {
  constructor(options = {}) {
    this.config = {
      apiKey: process.env.OPENAI_API_KEY || options.apiKey,
      baseUrl: options.baseUrl || 'https://api.openai.com/v1',
      model: options.model || 'gpt-5',
      maxTokens: options.maxTokens || 4000,
      defaultVerbosity: options.defaultVerbosity || 2,
      defaultReasoningEffort: options.defaultReasoningEffort || 'medium',
      timeout: options.timeout || 30000,
      ...options
    };
    
    this.extractionTemplates = this.loadTemplates();
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalTokensUsed: 0,
      totalCost: 0
    };
  }

  /**
   * Load extraction templates
   */
  loadTemplates() {
    return {
      basic: {
        system: `You are an expert content extractor. Extract structured information from HTML/text content.
                Always return valid JSON with the requested fields.`,
        fields: ['title', 'content', 'summary', 'metadata']
      },
      
      article: {
        system: `You are extracting article content. Focus on the main article body, author, date, and categories.
                Ignore navigation, ads, and unrelated content.`,
        fields: ['title', 'author', 'publishDate', 'content', 'summary', 'categories', 'tags']
      },
      
      product: {
        system: `You are extracting e-commerce product information. Focus on product details, pricing, and specifications.`,
        fields: ['name', 'price', 'currency', 'description', 'specifications', 'availability', 'images', 'reviews']
      },
      
      documentation: {
        system: `You are extracting technical documentation. Preserve code examples and maintain structure.`,
        fields: ['title', 'sections', 'codeExamples', 'parameters', 'returnValues', 'examples']
      },
      
      metadata: {
        system: `Extract comprehensive metadata and structured data from the content.`,
        fields: ['title', 'description', 'keywords', 'author', 'publishDate', 'modifiedDate', 'schema']
      }
    };
  }

  /**
   * Main GPT-5 extraction method
   */
  async extract(content, options = {}) {
    console.log('🤖 GPT-5 extraction initiated');
    
    const startTime = Date.now();
    const extractionId = this.generateExtractionId();
    
    try {
      // Select template
      const template = this.selectTemplate(options.type || 'basic');
      
      // Build prompt
      const prompt = this.buildPrompt(content, template, options);
      
      // Set GPT-5 parameters
      const parameters = this.buildParameters(options);
      
      // Make API call
      const response = await this.callGPT5API(prompt, parameters);
      
      // Parse and validate response
      const extracted = this.parseResponse(response, template);
      
      // Calculate metrics
      const duration = Date.now() - startTime;
      const tokensUsed = response.usage?.total_tokens || 0;
      const cost = this.calculateCost(tokensUsed);
      
      // Update metrics
      this.updateMetrics(true, tokensUsed, cost);
      
      console.log(`  ✅ GPT-5 extraction complete (${duration}ms, ${tokensUsed} tokens, $${cost.toFixed(4)})`);
      
      return {
        id: extractionId,
        success: true,
        data: extracted,
        metadata: {
          template: options.type || 'basic',
          model: this.config.model,
          verbosity: parameters.verbosity,
          reasoning_effort: parameters.reasoning_effort,
          tokensUsed,
          cost,
          duration
        }
      };
      
    } catch (error) {
      console.error(`  ❌ GPT-5 extraction failed: ${error.message}`);
      
      this.updateMetrics(false, 0, 0);
      
      return {
        id: extractionId,
        success: false,
        error: error.message,
        fallback: this.basicExtraction(content)
      };
    }
  }

  /**
   * Build extraction prompt
   */
  buildPrompt(content, template, options) {
    // Truncate content to fit token limits
    const maxContentLength = 6000;
    const truncatedContent = content.substring(0, maxContentLength);
    
    // Build field-specific instructions
    const fieldInstructions = this.buildFieldInstructions(
      options.fields || template.fields,
      options
    );
    
    // Build the complete prompt
    const messages = [
      {
        role: 'system',
        content: template.system
      },
      {
        role: 'user',
        content: `Extract the following information from the provided content:

${fieldInstructions}

Additional requirements:
- Return valid JSON format
- Use null for missing fields
- Preserve important details
- Remove boilerplate and navigation content
${options.preserveFormatting ? '- Preserve original formatting where possible' : ''}
${options.includeConfidence ? '- Include confidence scores for each field' : ''}

Content to extract from:
---
${truncatedContent}
---

Return the extracted data as JSON.`
      }
    ];
    
    // Add examples if provided
    if (options.examples) {
      messages.splice(1, 0, ...this.formatExamples(options.examples));
    }
    
    return messages;
  }

  /**
   * Build field-specific instructions
   */
  buildFieldInstructions(fields, options) {
    const instructions = fields.map(field => {
      const fieldConfig = options.fieldConfig?.[field] || {};
      
      let instruction = `- ${field}:`;
      
      // Add type hint
      if (fieldConfig.type) {
        instruction += ` (${fieldConfig.type})`;
      }
      
      // Add description
      if (fieldConfig.description) {
        instruction += ` ${fieldConfig.description}`;
      }
      
      // Add constraints
      if (fieldConfig.maxLength) {
        instruction += ` [max ${fieldConfig.maxLength} chars]`;
      }
      
      if (fieldConfig.required) {
        instruction += ` [required]`;
      }
      
      return instruction;
    }).join('\n');
    
    return instructions;
  }

  /**
   * Build GPT-5 parameters
   */
  buildParameters(options) {
    return {
      model: this.config.model,
      messages: [], // Will be set by API call
      max_tokens: options.maxTokens || this.config.maxTokens,
      
      // GPT-5 specific parameters
      verbosity: options.verbosity || this.config.defaultVerbosity,
      reasoning_effort: options.reasoning_effort || this.config.defaultReasoningEffort,
      
      // Response format
      response_format: { 
        type: 'json_object' 
      },
      
      // Optional parameters
      ...(options.stop && { stop: options.stop }),
      ...(options.presence_penalty && { presence_penalty: options.presence_penalty }),
      ...(options.frequency_penalty && { frequency_penalty: options.frequency_penalty })
    };
  }

  /**
   * Call GPT-5 API
   */
  async callGPT5API(messages, parameters) {
    // In production, this would make actual API call
    // For now, simulating the response
    
    console.log('    Calling GPT-5 API...');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate response based on parameters
    const simulatedResponse = this.simulateGPT5Response(messages, parameters);
    
    return simulatedResponse;
  }

  /**
   * Simulate GPT-5 response for testing
   */
  simulateGPT5Response(messages, parameters) {
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    
    // Extract based on verbosity and reasoning effort
    const verbosity = parameters.verbosity || 2;
    const reasoning = parameters.reasoning_effort || 'medium';
    
    let extractedData = {
      title: "Sample Extracted Title",
      content: "This is the main content extracted by GPT-5.",
      summary: verbosity >= 2 ? "A comprehensive summary of the content." : "Brief summary.",
      metadata: {
        extractedAt: new Date().toISOString(),
        confidence: reasoning === 'high' ? 0.95 : 0.85
      }
    };
    
    // Add more fields for higher verbosity
    if (verbosity >= 3) {
      extractedData.detailed_analysis = "Detailed analysis of the content structure and meaning.";
      extractedData.entities = ["Entity1", "Entity2", "Entity3"];
      extractedData.topics = ["Topic1", "Topic2"];
    }
    
    // Add reasoning for high effort
    if (reasoning === 'high') {
      extractedData.extraction_reasoning = {
        title: "Title found in <title> tag and confirmed by h1 element",
        content: "Main content identified by article tag and text density",
        confidence_factors: ["Clear HTML structure", "Consistent formatting", "No ambiguity"]
      };
    }
    
    return {
      id: 'sim_' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: parameters.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify(extractedData)
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 500 + verbosity * 100,
        completion_tokens: 200 + verbosity * 50,
        total_tokens: 700 + verbosity * 150
      }
    };
  }

  /**
   * Parse GPT-5 response
   */
  parseResponse(response, template) {
    try {
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('Empty response from GPT-5');
      }
      
      // Parse JSON response
      const parsed = JSON.parse(content);
      
      // Validate required fields
      const missingFields = template.fields.filter(field => 
        parsed[field] === undefined && !this.isOptionalField(field)
      );
      
      if (missingFields.length > 0) {
        console.warn(`  ⚠️ Missing fields in GPT-5 response: ${missingFields.join(', ')}`);
      }
      
      // Clean and normalize data
      return this.normalizeExtractedData(parsed, template);
      
    } catch (error) {
      console.error(`  ❌ Failed to parse GPT-5 response: ${error.message}`);
      throw error;
    }
  }

  /**
   * Normalize extracted data
   */
  normalizeExtractedData(data, template) {
    const normalized = {};
    
    template.fields.forEach(field => {
      if (data[field] !== undefined) {
        normalized[field] = this.normalizeField(field, data[field]);
      } else {
        normalized[field] = this.getDefaultValue(field);
      }
    });
    
    // Add any additional fields from response
    Object.keys(data).forEach(key => {
      if (!normalized[key]) {
        normalized[key] = data[key];
      }
    });
    
    return normalized;
  }

  /**
   * Normalize individual field
   */
  normalizeField(fieldName, value) {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return null;
    }
    
    // Field-specific normalization
    switch (fieldName) {
      case 'price':
        return typeof value === 'string' ? 
          parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
      
      case 'publishDate':
      case 'modifiedDate':
        return this.normalizeDate(value);
      
      case 'tags':
      case 'categories':
        return Array.isArray(value) ? value : [value].filter(Boolean);
      
      case 'images':
        return Array.isArray(value) ? 
          value.map(img => typeof img === 'string' ? { url: img } : img) : [];
      
      default:
        return value;
    }
  }

  /**
   * Basic extraction fallback
   */
  basicExtraction(content) {
    // Simple regex-based extraction as fallback
    const title = content.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || 
                 content.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] || 
                 'Untitled';
    
    const description = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] || '';
    
    // Remove HTML tags for content
    const textContent = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000);
    
    return {
      title,
      description,
      content: textContent,
      method: 'fallback'
    };
  }

  /**
   * Select appropriate template
   */
  selectTemplate(type) {
    return this.extractionTemplates[type] || this.extractionTemplates.basic;
  }

  /**
   * Format examples for few-shot learning
   */
  formatExamples(examples) {
    return examples.flatMap(example => [
      {
        role: 'user',
        content: example.input
      },
      {
        role: 'assistant',
        content: JSON.stringify(example.output)
      }
    ]);
  }

  /**
   * Check if field is optional
   */
  isOptionalField(field) {
    const optionalFields = ['summary', 'tags', 'categories', 'metadata', 'author'];
    return optionalFields.includes(field);
  }

  /**
   * Get default value for field
   */
  getDefaultValue(field) {
    const defaults = {
      title: '',
      content: '',
      summary: null,
      author: null,
      publishDate: null,
      tags: [],
      categories: [],
      images: [],
      metadata: {}
    };
    
    return defaults[field] !== undefined ? defaults[field] : null;
  }

  /**
   * Normalize date strings
   */
  normalizeDate(dateStr) {
    if (!dateStr) return null;
    
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? dateStr : date.toISOString();
    } catch {
      return dateStr;
    }
  }

  /**
   * Calculate API cost
   */
  calculateCost(tokens) {
    // GPT-5 pricing (hypothetical)
    const costPer1kTokens = 0.05; // $0.05 per 1K tokens
    return (tokens / 1000) * costPer1kTokens;
  }

  /**
   * Update metrics
   */
  updateMetrics(success, tokens, cost) {
    this.metrics.totalCalls++;
    
    if (success) {
      this.metrics.successfulCalls++;
      this.metrics.totalTokensUsed += tokens;
      this.metrics.totalCost += cost;
    } else {
      this.metrics.failedCalls++;
    }
  }

  /**
   * Generate extraction ID
   */
  generateExtractionId() {
    return 'gpt5_' + crypto.randomBytes(6).toString('hex');
  }

  /**
   * Get extraction statistics
   */
  getStatistics() {
    const successRate = this.metrics.totalCalls > 0 ?
      this.metrics.successfulCalls / this.metrics.totalCalls : 0;
    
    const avgTokensPerCall = this.metrics.successfulCalls > 0 ?
      this.metrics.totalTokensUsed / this.metrics.successfulCalls : 0;
    
    const avgCostPerCall = this.metrics.successfulCalls > 0 ?
      this.metrics.totalCost / this.metrics.successfulCalls : 0;
    
    return {
      ...this.metrics,
      successRate,
      avgTokensPerCall,
      avgCostPerCall
    };
  }
}

module.exports = { GPT5Extractor };