/**
 * Atlas Generator Demo
 * Shows how the new skill-based extraction system works
 */

const { createAtlasGenerator, atlas } = require('../packages/core/src/atlas-generator');

/**
 * Demo 1: Simple article extraction
 */
async function demoArticleExtraction() {
  console.log('=== Demo 1: Article Extraction ===');
  
  try {
    const result = await atlas.extractArticles('https://nytimes.com', {
      max_items: 5
    });
    
    console.log(`✅ Success: ${result.success}`);
    console.log(`🎯 Confidence: ${Math.round(result.confidence * 100)}%`);
    console.log(`⏱️ Execution time: ${result.execution_time}ms`);
    console.log(`📊 Quality score: ${Math.round(result.evaluation.score * 100)}%`);
    
    if (result.success && result.data) {
      if (Array.isArray(result.data)) {
        console.log(`📰 Found ${result.data.length} articles:`);
        result.data.slice(0, 3).forEach((article, i) => {
          console.log(`  ${i + 1}. ${article.title}`);
          console.log(`     ${article.url}`);
          if (article.summary) console.log(`     "${article.summary.substring(0, 100)}..."`);
        });
      } else if (result.data.articles) {
        console.log(`📰 Found ${result.data.articles.length} articles:`);
        result.data.articles.slice(0, 3).forEach((article, i) => {
          console.log(`  ${i + 1}. ${article.title}`);
          console.log(`     ${article.url}`);
          if (article.summary) console.log(`     "${article.summary.substring(0, 100)}..."`);
        });
      } else {
        console.log('📰 Raw data:', JSON.stringify(result.data, null, 2));
      }
    }
    
    if (result.evaluation && result.evaluation.issues.length > 0) {
      console.log(`⚠️ Issues: ${result.evaluation.issues.join(', ')}`);
    }
    
    if (result.evaluation && result.evaluation.suggestions.length > 0) {
      console.log(`💡 Suggestions: ${result.evaluation.suggestions.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
  
  console.log('');
}

/**
 * Demo 2: Custom extraction task
 */
async function demoCustomTask() {
  console.log('=== Demo 2: Custom Task ===');
  
  try {
    const result = await atlas.extract({
      description: 'Extract top 3 tech articles with author and publication date',
      url: 'https://techcrunch.com',
      intent: 'collect',
      domain: 'news',
      targetType: 'news.article'
    }, {
      url: 'https://techcrunch.com'
    });
    
    console.log(`✅ Success: ${result.success}`);
    console.log(`🎯 Confidence: ${Math.round(result.confidence * 100)}%`);
    console.log(`📋 Plan steps: ${result.plan_used.plan.length}`);
    
    if (result.success && result.data) {
      console.log('📰 Extracted data:', JSON.stringify(result.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
  
  console.log('');
}

/**
 * Demo 3: Generator with AI planning
 */
async function demoAiPlanning() {
  console.log('=== Demo 3: AI-Powered Planning ===');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('⚠️ Skipping AI demo - no OpenAI API key');
    return;
  }
  
  try {
    const smartAtlas = createAtlasGenerator({
      openai_api_key: apiKey,
      use_ai_planner: true,
      debug: true,
      max_time: 20000
    });
    
    const result = await smartAtlas.extract({
      description: 'Get the latest business news with stock market focus',
      url: 'https://bloomberg.com',
      intent: 'collect',
      domain: 'news'
    }, {
      url: 'https://bloomberg.com'
    });
    
    console.log(`✅ Success: ${result.success}`);
    console.log(`🤖 AI-generated plan: ${result.plan_used.plan.length} steps`);
    console.log(`📊 Plan quality: ${result.evaluation.score}`);
    
    if (result.trace) {
      console.log('🔍 Execution trace:');
      result.trace.forEach(step => {
        console.log(`  - ${step.skill}: ${step.confidence || 0}% confidence (${step.time}ms)`);
      });
    }
    
  } catch (error) {
    console.error('❌ AI demo failed:', error.message);
  }
  
  console.log('');
}

/**
 * Demo 4: Product extraction
 */
async function demoProductExtraction() {
  console.log('=== Demo 4: Product Extraction ===');
  
  try {
    const result = await atlas.extractProducts('https://amazon.com/bestsellers', {
      max_items: 5
    });
    
    console.log(`✅ Success: ${result.success}`);
    console.log(`🛒 Product extraction confidence: ${Math.round(result.confidence * 100)}%`);
    
    if (result.success && result.data) {
      console.log('🛒 Products:', JSON.stringify(result.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Product demo failed:', error.message);
  }
  
  console.log('');
}

/**
 * Demo 5: Analytics and learning
 */
async function demoAnalytics() {
  console.log('=== Demo 5: System Analytics ===');
  
  const analytics = atlas.getAnalytics();
  
  console.log('📈 System Performance:');
  console.log(`  Average Score: ${Math.round(analytics.avg_score * 100)}%`);
  console.log(`  Success Rate: ${Math.round(analytics.success_rate * 100)}%`);
  console.log(`  Most Reliable Skills: ${analytics.most_reliable_skills.join(', ')}`);
  console.log(`  Common Failures: ${analytics.common_failures.join(', ')}`);
  
  console.log('');
}

/**
 * Demo 6: Plan visualization
 */
async function demoPlanVisualization() {
  console.log('=== Demo 6: Plan Visualization ===');
  
  try {
    // Just generate a plan without executing
    const { RulePlanner } = require('../packages/core/src/planner');
    
    const plan = RulePlanner.generatePlan({
      description: 'Extract top news articles',
      url: 'https://nytimes.com',
      intent: 'collect',
      domain: 'news'
    });
    
    console.log('📋 Generated Execution Plan:');
    console.log(`  Task: ${plan.task}`);
    console.log(`  Steps (${plan.plan.length}):`);
    
    plan.plan.forEach((step, i) => {
      console.log(`    ${i + 1}. ${step.use}`);
      if (step.with) {
        console.log(`       params: ${JSON.stringify(step.with)}`);
      }
      if (step.or) {
        console.log(`       fallback: ${step.or.use}`);
      }
    });
    
    console.log(`  Success Criteria: ${plan.success_criteria.join(', ')}`);
    console.log(`  Failure Modes: ${plan.failure_modes.join(', ')}`);
    console.log(`  Estimated Cost: ${plan.estimated_cost.time}ms, ${plan.estimated_cost.cpu} CPU`);
    
  } catch (error) {
    console.error('❌ Plan demo failed:', error.message);
  }
  
  console.log('');
}

/**
 * Run all demos
 */
async function runAllDemos() {
  console.log('🚀 Atlas Generator Demo Suite');
  console.log('============================\n');
  
  await demoArticleExtraction();
  await demoCustomTask();
  await demoAiPlanning();
  await demoProductExtraction();
  await demoAnalytics();
  await demoPlanVisualization();
  
  console.log('✨ All demos completed!');
}

// Run demos if this file is executed directly
if (require.main === module) {
  runAllDemos().catch(error => {
    console.error('Demo suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  demoArticleExtraction,
  demoCustomTask,
  demoAiPlanning,
  demoProductExtraction,
  demoAnalytics,
  demoPlanVisualization,
  runAllDemos
};