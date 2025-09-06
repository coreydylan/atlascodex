/**
 * GPT-5 Extraction Patterns
 * Adapted from OpenAI Cookbook for Atlas Codex
 */

const OpenAI = require('openai');

// Pattern 1: Structured Data Extraction with Schema Validation
class StructuredExtractor {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async extractWithSchema(text, schema) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `Extract information according to this JSON schema: ${JSON.stringify(schema)}`
        },
        {
          role: 'user',
          content: text
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1 // Low temperature for consistency
    });

    return JSON.parse(response.choices[0].message.content);
  }
}

// Pattern 2: Entity Extraction with Reasoning
class EntityExtractor {
  async extractEntitiesWithReasoning(text) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: 'Extract all entities (people, places, organizations, dates) and explain your reasoning.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      reasoning: true,
      reasoning_effort: 'medium'
    });

    return {
      entities: JSON.parse(response.choices[0].message.content),
      reasoning: response.choices[0].reasoning_content
    };
  }
}

// Pattern 3: Hierarchical Extraction for Long Documents
class HierarchicalExtractor {
  async extractFromLongDocument(document, chunkSize = 5000) {
    const chunks = this.chunkDocument(document, chunkSize);
    const chunkResults = [];

    // First pass: Extract from each chunk
    for (const chunk of chunks) {
      const result = await this.extractFromChunk(chunk);
      chunkResults.push(result);
    }

    // Second pass: Combine and refine
    return await this.combineResults(chunkResults);
  }

  chunkDocument(document, size) {
    const chunks = [];
    for (let i = 0; i < document.length; i += size) {
      chunks.push(document.slice(i, i + size));
    }
    return chunks;
  }

  async extractFromChunk(chunk) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-5-nano', // Use nano for individual chunks
      messages: [
        {
          role: 'system',
          content: 'Extract key information from this text chunk.'
        },
        {
          role: 'user',
          content: chunk
        }
      ],
      max_tokens: 500
    });

    return response.choices[0].message.content;
  }

  async combineResults(results) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-5-mini', // Use mini for combination
      messages: [
        {
          role: 'system',
          content: 'Combine and deduplicate these extraction results into a coherent summary.'
        },
        {
          role: 'user',
          content: JSON.stringify(results)
        }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }
}

// Pattern 4: Multi-Modal Extraction (Text + Structure)
class MultiModalExtractor {
  async extractFromHTML(html) {
    // Extract both content and structure
    const response = await this.openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: `Extract information considering both text content and HTML structure.
                   Pay attention to:
                   - Headings hierarchy
                   - Lists and their relationships
                   - Tables and data relationships
                   - Links and navigation structure`
        },
        {
          role: 'user',
          content: html
        }
      ],
      reasoning: true,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }
}

// Pattern 5: Adaptive Extraction with Confidence Scores
class AdaptiveExtractor {
  async extractWithConfidence(text, requirements) {
    const models = ['gpt-5-nano', 'gpt-5-mini', 'gpt-5'];
    let bestResult = null;
    let highestConfidence = 0;

    for (const model of models) {
      const result = await this.tryExtraction(model, text, requirements);
      
      if (result.confidence > highestConfidence) {
        highestConfidence = result.confidence;
        bestResult = result;
      }

      // Early exit if confidence is high enough
      if (result.confidence > 0.95) break;
    }

    return bestResult;
  }

  async tryExtraction(model, text, requirements) {
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Extract according to these requirements: ${requirements}
                   Also provide a confidence score (0-1) for your extraction.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      ...result,
      model,
      confidence: result.confidence || this.estimateConfidence(model)
    };
  }

  estimateConfidence(model) {
    const baseConfidence = {
      'gpt-5': 0.95,
      'gpt-5-mini': 0.85,
      'gpt-5-nano': 0.75
    };
    return baseConfidence[model] || 0.7;
  }
}

// Pattern 6: Chain-of-Thought Extraction
class ChainOfThoughtExtractor {
  async extractWithCoT(text, objective) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: `Think step-by-step to extract information.
                   1. First, identify what needs to be extracted
                   2. Then, locate relevant sections
                   3. Extract the information
                   4. Validate and structure the output`
        },
        {
          role: 'user',
          content: `Objective: ${objective}\n\nText: ${text}`
        }
      ],
      reasoning: true,
      verbosity: 'verbose'
    });

    return {
      result: response.choices[0].message.content,
      thinking: response.choices[0].reasoning_content
    };
  }
}

// Pattern 7: Iterative Refinement Extraction
class IterativeExtractor {
  async extractWithRefinement(text, requirements, maxIterations = 3) {
    let result = await this.initialExtraction(text, requirements);
    
    for (let i = 0; i < maxIterations; i++) {
      const validation = await this.validateExtraction(result, requirements);
      
      if (validation.isComplete) break;
      
      result = await this.refineExtraction(text, result, validation.feedback);
    }
    
    return result;
  }

  async initialExtraction(text, requirements) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: 'Extract information according to requirements.'
        },
        {
          role: 'user',
          content: `Requirements: ${requirements}\n\nText: ${text}`
        }
      ]
    });

    return response.choices[0].message.content;
  }

  async validateExtraction(extraction, requirements) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: 'Validate if the extraction meets all requirements. Return {isComplete: boolean, feedback: string}'
        },
        {
          role: 'user',
          content: `Requirements: ${requirements}\n\nExtraction: ${extraction}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async refineExtraction(text, previousExtraction, feedback) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: 'Refine the extraction based on feedback.'
        },
        {
          role: 'user',
          content: `Text: ${text}\n\nPrevious: ${previousExtraction}\n\nFeedback: ${feedback}`
        }
      ],
      reasoning: true
    });

    return response.choices[0].message.content;
  }
}

// Export all patterns
module.exports = {
  StructuredExtractor,
  EntityExtractor,
  HierarchicalExtractor,
  MultiModalExtractor,
  AdaptiveExtractor,
  ChainOfThoughtExtractor,
  IterativeExtractor
};

// Example usage
async function demonstratePatterns() {
  // 1. Structured extraction
  const structured = new StructuredExtractor();
  const articleSchema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      author: { type: 'string' },
      date: { type: 'string' },
      summary: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } }
    }
  };
  
  const article = await structured.extractWithSchema(
    'Article text here...', 
    articleSchema
  );

  // 2. Entity extraction with reasoning
  const entities = new EntityExtractor();
  const result = await entities.extractEntitiesWithReasoning(
    'Apple Inc. CEO Tim Cook announced new products in Cupertino on September 4, 2025.'
  );

  // 3. Long document processing
  const hierarchical = new HierarchicalExtractor();
  const longDoc = await hierarchical.extractFromLongDocument(
    'Very long document text...',
    5000
  );

  // 4. HTML extraction
  const multiModal = new MultiModalExtractor();
  const htmlData = await multiModal.extractFromHTML(
    '<html><body><h1>Title</h1><p>Content</p></body></html>'
  );

  // 5. Adaptive extraction
  const adaptive = new AdaptiveExtractor();
  const bestResult = await adaptive.extractWithConfidence(
    'Complex text requiring analysis...',
    'Extract all financial metrics and relationships'
  );

  // 6. Chain of thought
  const cot = new ChainOfThoughtExtractor();
  const thoughtful = await cot.extractWithCoT(
    'Research paper abstract...',
    'Extract methodology and key findings'
  );

  // 7. Iterative refinement
  const iterative = new IterativeExtractor();
  const refined = await iterative.extractWithRefinement(
    'Product description...',
    'Extract all technical specifications',
    3
  );

  return {
    structured: article,
    entities: result,
    hierarchical: longDoc,
    multiModal: htmlData,
    adaptive: bestResult,
    chainOfThought: thoughtful,
    iterative: refined
  };
}

// Performance comparison function
async function comparePatterns(text, requirements) {
  const patterns = {
    structured: new StructuredExtractor(),
    entity: new EntityExtractor(),
    hierarchical: new HierarchicalExtractor(),
    adaptive: new AdaptiveExtractor(),
    cot: new ChainOfThoughtExtractor()
  };

  const results = {};

  for (const [name, extractor] of Object.entries(patterns)) {
    const start = Date.now();
    
    try {
      const result = await extractor.extract(text, requirements);
      results[name] = {
        success: true,
        latency: Date.now() - start,
        result
      };
    } catch (error) {
      results[name] = {
        success: false,
        error: error.message
      };
    }
  }

  return results;
}