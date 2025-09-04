/**
 * Demo: Q&A Interface Usage Examples
 * 
 * Shows how the Q&A interface integrates with extraction results
 * and provides intelligent querying capabilities.
 */

// Simulate an extraction result with Q&A interface
function createMockExtractionResult() {
  const sampleData = [
    {
      title: "AI Revolution in Healthcare",
      author: "Dr. Sarah Johnson",
      date: "2025-01-15", 
      category: "Technology",
      views: 15420,
      shares: 342
    },
    {
      title: "Climate Change Solutions",
      author: "Prof. Michael Chen",
      date: "2025-01-14",
      category: "Environment", 
      views: 8930,
      shares: 156
    },
    {
      title: "Quantum Computing Breakthrough",
      author: "Dr. Sarah Johnson",
      date: "2025-01-13",
      category: "Technology",
      views: 22150,
      shares: 567
    },
    {
      title: "Sustainable Energy Future",
      author: "Lisa Rodriguez",
      date: "2025-01-12",
      category: "Environment",
      views: 12800,
      shares: 289
    }
  ];

  // Mock Q&A interface (would be real in production with OpenAI)
  const mockQAInterface = {
    ask: async (question) => {
      console.log(`🤖 Mock Q&A: "${question}"`);
      
      // Simulate intelligent responses based on the question
      if (question.toLowerCase().includes('most popular') || question.toLowerCase().includes('highest views')) {
        return {
          success: true,
          answer: "The most popular article is 'Quantum Computing Breakthrough' by Dr. Sarah Johnson with 22,150 views.",
          confidence: 0.95,
          data_points: ["Quantum Computing Breakthrough: 22,150 views"],
          details: "Based on view count analysis, the quantum computing article has the highest engagement with 22,150 views, significantly higher than the average of 14,825 views.",
          model_used: "gpt-5-mini"
        };
      }
      
      if (question.toLowerCase().includes('author') && question.toLowerCase().includes('most')) {
        return {
          success: true,
          answer: "Dr. Sarah Johnson is the most prolific author with 2 articles published.",
          confidence: 0.92,
          data_points: ["Dr. Sarah Johnson: 2 articles", "Other authors: 1 article each"],
          details: "Dr. Sarah Johnson has written both 'AI Revolution in Healthcare' and 'Quantum Computing Breakthrough', making her the most active contributor.",
          model_used: "gpt-5-nano"
        };
      }
      
      if (question.toLowerCase().includes('trend') || question.toLowerCase().includes('pattern')) {
        return {
          success: true,
          answer: "Technology articles are more popular than Environment articles, with an average of 18,785 views vs 10,865 views.",
          confidence: 0.88,
          data_points: ["Technology avg: 18,785 views", "Environment avg: 10,865 views"],
          details: "Technology articles show 73% higher engagement on average. Both Dr. Sarah Johnson's articles are in Technology and perform well.",
          insights: "Technology content resonates more with the audience, suggesting a tech-focused readership.",
          model_used: "gpt-5-mini"
        };
      }
      
      return {
        success: true,
        answer: "I can analyze the extracted article data. Try asking about popular articles, author patterns, or content trends.",
        confidence: 0.7,
        suggestions: ["What's the most popular article?", "Which author wrote the most?", "What trends do you see?"],
        model_used: "gpt-5-nano"
      };
    },

    insights: async () => {
      console.log('🧠 Generating insights...');
      return {
        success: true,
        insights: {
          key_findings: [
            "Technology articles significantly outperform Environment articles in engagement",
            "Dr. Sarah Johnson is a key contributor with high-performing content",
            "Recent articles show strong social sharing activity"
          ],
          trends: [
            "Technology content preferred by audience",
            "Articles by Dr. Sarah Johnson consistently perform well", 
            "Daily publishing schedule maintained"
          ],
          statistics: {
            total_articles: 4,
            avg_views: 14825,
            avg_shares: 338.5,
            top_category: "Technology"
          },
          recommendations: [
            "Increase technology content production",
            "Collaborate more with Dr. Sarah Johnson",
            "Analyze what makes quantum computing content successful"
          ]
        },
        model_used: "gpt-5"
      };
    },

    analyze: async (focusArea = 'all') => {
      console.log(`🔍 Analyzing patterns (focus: ${focusArea})...`);
      return {
        success: true,
        analysis: {
          patterns: {
            temporal: ["Daily publishing schedule", "Recent articles trend upward"],
            categorical: ["Technology: 50%", "Environment: 50%"],
            numerical: ["Views range: 8,930 - 22,150", "Shares correlate with views"]
          },
          anomalies: [
            {
              type: "High performer",
              details: "Quantum Computing article has 2.5x average views",
              severity: "medium"
            }
          ],
          statistics: {
            view_distribution: "Right-skewed with one high outlier",
            author_distribution: "Dr. Sarah Johnson: 50%, Others: 16.7% each"
          }
        },
        focus_area: focusArea
      };
    },

    summary: () => ({
      data_type: "array",
      size: 4,
      fields: ["title", "author", "date", "category", "views", "shares"],
      numeric_fields: ["views", "shares"]
    }),

    count: () => 4,
    fields: () => ["title", "author", "date", "category", "views", "shares"],
    
    stats: async (field) => {
      if (field === "views") {
        return {
          success: true,
          answer: "Views statistics: Min: 8,930, Max: 22,150, Average: 14,825, Total: 59,300",
          confidence: 1.0
        };
      }
      return { success: false, error: "Field not found" };
    }
  };

  return {
    success: true,
    data: sampleData,
    metadata: {
      processingMethod: 'unified_extractor_option_c',
      unifiedExtractor: true,
      multiPage: false,
      processingTime: 1250,
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            author: { type: "string" },
            date: { type: "string" },
            category: { type: "string" },
            views: { type: "number" },
            shares: { type: "number" }
          }
        }
      }
    },
    qa: mockQAInterface,
    enhanced_features: {
      natural_language_qa: true,
      pattern_analysis: true,
      insight_generation: true,
      conversational_queries: true
    }
  };
}

// Demo usage scenarios
async function demoQAUsage() {
  console.log('🎯 Atlas Codex Q&A Interface Demo\n');

  // Simulate an extraction
  console.log('1️⃣ Performing extraction...');
  const extractionResult = createMockExtractionResult();
  console.log('✅ Extracted', extractionResult.data.length, 'articles');
  console.log('✅ Q&A interface available:', !!extractionResult.qa);
  console.log();

  // Demo 1: Basic questioning
  console.log('2️⃣ Demo: Basic Q&A');
  const answer1 = await extractionResult.qa.ask("What's the most popular article?");
  console.log('Q:', "What's the most popular article?");
  console.log('A:', answer1.answer);
  console.log('Confidence:', answer1.confidence);
  console.log();

  // Demo 2: Author analysis
  console.log('3️⃣ Demo: Author Analysis');
  const answer2 = await extractionResult.qa.ask("Which author wrote the most articles?");
  console.log('Q:', "Which author wrote the most articles?");
  console.log('A:', answer2.answer);
  console.log('Details:', answer2.details);
  console.log();

  // Demo 3: Pattern recognition
  console.log('4️⃣ Demo: Pattern Recognition');
  const answer3 = await extractionResult.qa.ask("What trends do you see in the content?");
  console.log('Q:', "What trends do you see in the content?");
  console.log('A:', answer3.answer);
  console.log('Insights:', answer3.insights);
  console.log();

  // Demo 4: Quick stats
  console.log('5️⃣ Demo: Quick Statistics');
  console.log('Article count:', extractionResult.qa.count());
  console.log('Available fields:', extractionResult.qa.fields().join(', '));
  console.log('Data summary:', extractionResult.qa.summary());
  console.log();

  // Demo 5: Comprehensive insights
  console.log('6️⃣ Demo: Comprehensive Insights');
  const insights = await extractionResult.qa.insights();
  console.log('Key findings:', insights.insights.key_findings);
  console.log('Top category:', insights.insights.statistics.top_category);
  console.log('Recommendations:', insights.insights.recommendations.slice(0, 2));
  console.log();

  // Demo 6: Pattern analysis
  console.log('7️⃣ Demo: Pattern Analysis');
  const patterns = await extractionResult.qa.analyze('numerical');
  console.log('Numerical patterns:', patterns.analysis.patterns.numerical);
  console.log('Anomalies found:', patterns.analysis.anomalies.length);
  console.log();

  console.log('🎉 Q&A Interface Demo Completed!');
  console.log('\n📖 Usage Examples:');
  console.log('- result.qa.ask("What was the best performing product?")');
  console.log('- result.qa.ask("Calculate month-over-month growth")');
  console.log('- result.qa.ask("Find anomalies or outliers")');
  console.log('- result.qa.insights() // Get comprehensive analysis');
  console.log('- result.qa.analyze("temporal") // Focus on time patterns');
  console.log('- result.qa.stats("price") // Quick stats for a field');
}

// REST API usage examples
function showAPIExamples() {
  console.log('\n🌐 REST API Usage Examples:');
  console.log(`
  // Ask questions about extracted data
  POST /api/ask
  {
    "data": [{"product": "iPhone", "price": 999}],
    "question": "What is the most expensive product?"
  }

  // Get comprehensive insights
  POST /api/insights  
  {
    "data": [{"month": "Jan", "sales": 50000}]
  }

  // Analyze patterns
  POST /api/analyze
  {
    "data": [{"date": "2025-01-01", "revenue": 1000}],
    "focusArea": "temporal"
  }

  // Create persistent session
  POST /api/qa/session
  {
    "data": [{"item": "data"}],
    "title": "Sales Analysis Session"
  }

  // Ask questions in session
  POST /api/qa/session/{sessionId}
  {
    "question": "What trends do you see?",
    "action": "ask"
  }
  `);
}

// Run the demo
if (require.main === module) {
  demoQAUsage()
    .then(() => showAPIExamples())
    .catch(error => {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    });
}

module.exports = { demoQAUsage, createMockExtractionResult };