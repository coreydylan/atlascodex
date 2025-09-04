/**
 * Extraction Q&A Service - GPT-5 Enhanced
 * 
 * Makes extracted data queryable through natural language questions.
 * Provides intelligent analysis, insights, and conversational interaction with extracted data.
 * 
 * Features:
 * - Natural language Q&A about extraction results
 * - Intelligent data analysis and pattern recognition
 * - Cost-optimized GPT-5 model selection
 * - Context-aware responses with reasoning
 * - Calculation and insight generation
 * - Anomaly detection and trend analysis
 */

const reasoningEngine = require('./reasoning-engine');

class ExtractionQAService {
  constructor() {
    this.openai = null;
    this.initializeOpenAI();
    this.responseCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  initializeOpenAI() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey.length < 10) {
        console.warn('❌ OpenAI API key not found for Q&A service');
        return;
      }

      const OpenAI = require('openai');
      this.openai = new OpenAI({ apiKey });
      console.log('✅ Q&A Service OpenAI client initialized');
    } catch (error) {
      console.warn('❌ Failed to initialize OpenAI for Q&A:', error.message);
    }
  }

  /**
   * Select optimal GPT model based on question complexity
   */
  selectOptimalModel(question, dataSize) {
    const questionWords = question.split(' ').length;
    const hasCalculation = /calculate|sum|total|average|count|percentage|compare|analyze/i.test(question);
    const hasComplexReasoning = /why|how|explain|relationship|pattern|trend|insight|anomaly/i.test(question);
    const isLargeDataset = dataSize > 5000;

    // Complex analysis or large datasets need full GPT-5
    if (hasComplexReasoning || isLargeDataset || hasCalculation && questionWords > 15) {
      return {
        model: 'gpt-5',
        reasoning: true,
        reasoning_effort: 'high',
        cost: '$1.25/1M'
      };
    }

    // Standard questions with moderate complexity
    if (hasCalculation || questionWords > 8) {
      return {
        model: 'gpt-5-mini',
        reasoning: false,
        cost: '$0.25/1M'
      };
    }

    // Simple questions use nano
    return {
      model: 'gpt-5-nano',
      reasoning: false,
      cost: '$0.05/1M'
    };
  }

  /**
   * Generate cache key for response caching
   */
  generateCacheKey(question, dataHash) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(question + dataHash).digest('hex');
  }

  /**
   * Create data hash for caching
   */
  createDataHash(data) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Ask a natural language question about extracted data
   */
  async ask(extractedData, question, options = {}) {
    if (!this.openai) {
      return {
        success: false,
        error: 'OpenAI not initialized',
        answer: 'Q&A service is not available. Please check OpenAI configuration.'
      };
    }

    try {
      const dataHash = this.createDataHash(extractedData);
      const cacheKey = this.generateCacheKey(question, dataHash);

      // Check cache first
      if (this.responseCache.has(cacheKey) && !options.skipCache) {
        const cached = this.responseCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          console.log('📦 Returning cached Q&A response');
          return {
            success: true,
            answer: cached.answer,
            cached: true,
            confidence: cached.confidence,
            reasoning: cached.reasoning
          };
        }
      }

      // Select optimal model
      const dataSize = JSON.stringify(extractedData).length;
      const modelConfig = this.selectOptimalModel(question, dataSize);
      
      console.log(`🤖 Using ${modelConfig.model} for Q&A (estimated cost: ${modelConfig.cost})`);

      // Prepare data context with structure analysis
      const dataContext = await this.analyzeDataStructure(extractedData);

      // Create the prompt for Q&A
      const messages = [
        {
          role: 'system',
          content: `You are an intelligent data analyst assistant. You have access to extracted data and can answer questions about it with high accuracy.

Your capabilities:
- Answer questions about the data content
- Perform calculations (sums, averages, counts, percentages)
- Identify patterns and trends
- Compare data points
- Find anomalies or outliers
- Provide insights and analysis
- Explain relationships in the data

Data Structure Analysis:
${JSON.stringify(dataContext, null, 2)}

Guidelines:
- Be precise and accurate in your answers
- Show your work for calculations
- Cite specific data points when relevant
- If data is insufficient, clearly state limitations
- Provide confidence scores for your answers
- Use the exact data provided, don't make assumptions

Format your response as JSON with:
{
  "answer": "Direct answer to the question",
  "details": "Detailed explanation with supporting data",
  "confidence": 0.95,
  "data_points": ["specific data points used"],
  "calculations": "show mathematical work if applicable",
  "insights": "additional relevant insights"
}`
        },
        {
          role: 'user',
          content: `Data to analyze:
${JSON.stringify(extractedData, null, 2)}

Question: ${question}

Please analyze the data and provide a comprehensive answer.`
        }
      ];

      // Make the API call with selected model
      const response = await this.openai.chat.completions.create({
        model: modelConfig.model,
        messages: messages,
        temperature: 0.1, // Low temperature for factual accuracy
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Add reasoning if enabled
      let reasoning = null;
      if (modelConfig.reasoning) {
        reasoning = await reasoningEngine.explainReasoning(question, extractedData, result);
      }

      const finalResult = {
        success: true,
        answer: result.answer,
        details: result.details,
        confidence: result.confidence || 0.8,
        data_points: result.data_points || [],
        calculations: result.calculations,
        insights: result.insights,
        reasoning: reasoning,
        model_used: modelConfig.model,
        estimated_cost: modelConfig.cost
      };

      // Cache the result
      this.responseCache.set(cacheKey, {
        ...finalResult,
        timestamp: Date.now()
      });

      return finalResult;

    } catch (error) {
      console.error('❌ Q&A processing failed:', error);
      return {
        success: false,
        error: error.message,
        answer: 'I encountered an error while analyzing the data. Please try rephrasing your question or check if the data format is valid.'
      };
    }
  }

  /**
   * Analyze data structure to provide context
   */
  async analyzeDataStructure(data) {
    const analysis = {
      type: Array.isArray(data) ? 'array' : typeof data,
      length: Array.isArray(data) ? data.length : Object.keys(data || {}).length,
      fields: [],
      sample: null
    };

    if (Array.isArray(data) && data.length > 0) {
      // Analyze array structure
      const firstItem = data[0];
      if (typeof firstItem === 'object') {
        analysis.fields = Object.keys(firstItem);
        analysis.sample = firstItem;
      }
      
      // Check for numeric fields for calculations
      analysis.numeric_fields = analysis.fields.filter(field => {
        return data.some(item => typeof item[field] === 'number');
      });
    } else if (typeof data === 'object' && data !== null) {
      // Analyze object structure
      analysis.fields = Object.keys(data);
      analysis.sample = data;
    }

    return analysis;
  }

  /**
   * Generate insights about the extracted data
   */
  async generateInsights(extractedData, options = {}) {
    if (!this.openai) {
      return {
        success: false,
        error: 'OpenAI not initialized'
      };
    }

    try {
      const dataSize = JSON.stringify(extractedData).length;
      // Use full GPT-5 for comprehensive insights
      const modelConfig = {
        model: 'gpt-5',
        reasoning: true,
        reasoning_effort: 'high'
      };

      console.log('🧠 Generating insights with GPT-5 reasoning');

      const dataContext = await this.analyzeDataStructure(extractedData);

      const messages = [
        {
          role: 'system',
          content: `You are a data insights expert. Analyze the provided data and generate meaningful insights, patterns, and observations.

Focus on:
- Key trends and patterns
- Anomalies or outliers
- Statistical summaries
- Correlations and relationships
- Business implications
- Data quality observations
- Recommendations for further analysis

Provide insights in JSON format:
{
  "key_findings": ["most important discoveries"],
  "trends": ["identified trends"],
  "anomalies": ["unusual patterns or outliers"],
  "statistics": {"key": "value", "summary": "stats"},
  "recommendations": ["suggested actions or further analysis"],
  "data_quality": {"completeness": 0.95, "consistency": 0.88, "issues": []},
  "confidence": 0.92
}`
        },
        {
          role: 'user',
          content: `Data Structure:
${JSON.stringify(dataContext, null, 2)}

Data to analyze:
${JSON.stringify(extractedData, null, 2)}

Please generate comprehensive insights about this data.`
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: modelConfig.model,
        messages: messages,
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const insights = JSON.parse(response.choices[0].message.content);

      return {
        success: true,
        insights: insights,
        model_used: modelConfig.model,
        data_size: dataSize,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Insight generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze data for patterns and anomalies
   */
  async analyzePatterns(extractedData, focusArea = 'all') {
    if (!this.openai) {
      return {
        success: false,
        error: 'OpenAI not initialized'
      };
    }

    try {
      const messages = [
        {
          role: 'system',
          content: `You are a pattern analysis expert. Focus on identifying patterns, anomalies, and structural insights in the data.

Analysis areas:
- Temporal patterns (if dates/times present)
- Numerical patterns and distributions
- Categorical patterns and frequencies
- Structural patterns in the data organization
- Outliers and anomalies
- Missing data patterns

Provide analysis in JSON format:
{
  "patterns": {
    "temporal": ["time-based patterns if applicable"],
    "numerical": ["number patterns and distributions"],
    "categorical": ["category patterns and frequencies"],
    "structural": ["data organization patterns"]
  },
  "anomalies": [{"type": "description", "details": "specifics", "severity": "low|medium|high"}],
  "statistics": {"key_metrics": "values"},
  "recommendations": ["suggested focus areas"]
}`
        },
        {
          role: 'user',
          content: `Focus area: ${focusArea}

Data to analyze:
${JSON.stringify(extractedData, null, 2)}

Please identify patterns and anomalies in this data.`
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-mini', // Mini is sufficient for pattern analysis
        messages: messages,
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content);

      return {
        success: true,
        analysis: analysis,
        focus_area: focusArea,
        analyzed_at: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Pattern analysis failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a Q&A interface for extraction results
   */
  createQAInterface(extractedData) {
    return {
      ask: async (question) => {
        return await this.ask(extractedData, question);
      },
      
      insights: async () => {
        return await this.generateInsights(extractedData);
      },
      
      analyze: async (focusArea = 'all') => {
        return await this.analyzePatterns(extractedData, focusArea);
      },
      
      summary: () => {
        const dataContext = this.analyzeDataStructure(extractedData);
        return {
          data_type: dataContext.type,
          size: dataContext.length,
          fields: dataContext.fields,
          sample: dataContext.sample,
          numeric_fields: dataContext.numeric_fields || []
        };
      },
      
      // Helper methods for common questions
      count: () => Array.isArray(extractedData) ? extractedData.length : 1,
      
      fields: () => {
        if (Array.isArray(extractedData) && extractedData.length > 0) {
          return Object.keys(extractedData[0] || {});
        }
        return Object.keys(extractedData || {});
      },
      
      // Quick stats for numeric data
      stats: async (field) => {
        return await this.ask(extractedData, `Calculate statistics for the ${field} field including min, max, average, and total`);
      }
    };
  }

  /**
   * Clear response cache
   */
  clearCache() {
    this.responseCache.clear();
    console.log('🗑️ Q&A response cache cleared');
  }
}

// Export singleton instance
module.exports = new ExtractionQAService();