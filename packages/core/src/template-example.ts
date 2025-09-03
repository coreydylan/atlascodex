#!/usr/bin/env node

// Atlas Codex - Template System Demo
// Comprehensive example showing the production-grade template system in action

import { 
  templateService,
  evaluationFramework,
  ExtractionTemplate,
  DisplayTemplate,
  goldenTestCases
} from './index';

class TemplateSystemDemo {
  async runFullDemo() {
    console.log('🚀 Atlas Codex Template System Demo');
    console.log('====================================\n');

    await this.demonstrateTemplateMatching();
    await this.demonstrateDisplayGeneration();
    await this.demonstrateEndToEndExtraction();
    await this.demonstrateEvaluationFramework();
    await this.demonstrateMaintenanceInsights();
    
    console.log('✅ Demo completed successfully!');
  }

  async demonstrateTemplateMatching() {
    console.log('📋 1. Template Matching & Intelligence');
    console.log('=====================================');

    // Test different types of queries
    const testQueries = [
      {
        url: 'https://stanford.edu/cs/faculty',
        query: 'Get all faculty members with their contact information',
        expected: 'people_directory'
      },
      {
        url: 'https://amazon.com/s?k=laptops',
        query: 'Extract product listings with prices and reviews', 
        expected: 'product_catalog'
      },
      {
        url: 'https://techcrunch.com/latest',
        query: 'Get latest news articles',
        expected: 'news_articles'
      }
    ];

    for (const test of testQueries) {
      console.log(`\n🔍 Query: "${test.query}"`);
      console.log(`📎 URL: ${test.url}`);

      const recommendations = await templateService.getTemplateRecommendations(
        test.url, 
        test.query
      );

      if (recommendations.length > 0) {
        const best = recommendations[0];
        console.log(`✅ Best Match: ${best.template.id}`);
        console.log(`🎯 Confidence: ${(best.confidence * 100).toFixed(1)}%`);
        console.log(`📝 Reasons: ${best.match_reasons?.join(', ') || 'Pattern matching'}`);
        
        // Show template details
        console.log(`📊 Template Success Rate: ${(best.template.success_metrics.accuracy * 100).toFixed(1)}%`);
        console.log(`🔐 Security: ${best.template.guardrails.must_not_have.length} forbidden patterns`);
      } else {
        console.log('❌ No matching templates found');
      }
    }
  }

  async demonstrateDisplayGeneration() {
    console.log('\n\n🎨 2. Smart Display Generation');
    console.log('==============================');

    // Test display generation for different data types
    const testData = [
      {
        type: 'Team Members',
        data: [
          { name: 'Dr. Sarah Chen', title: 'Lead AI Researcher', department: 'Research', email: 'sarah@company.com' },
          { name: 'Mike Johnson', title: 'Senior Developer', department: 'Engineering', email: 'mike@company.com' },
          { name: 'Lisa Wang', title: 'Product Manager', department: 'Product', email: 'lisa@company.com' }
        ],
        query: 'team directory'
      },
      {
        type: 'Products',
        data: [
          { name: 'MacBook Pro M3', price: '$1,999', rating: '4.8', category: 'Laptops' },
          { name: 'iPad Air', price: '$599', rating: '4.6', category: 'Tablets' },
          { name: 'iPhone 15 Pro', price: '$999', rating: '4.9', category: 'Phones' }
        ],
        query: 'product catalog'
      }
    ];

    for (const test of testData) {
      console.log(`\n📊 Data Type: ${test.type} (${test.data.length} items)`);
      
      const displayMatch = await templateService.getDisplayRecommendations(
        test.data,
        test.query,
        { device: 'desktop', locale: 'en-US' }
      );

      if (displayMatch) {
        console.log(`✅ Display Template: ${displayMatch.template.id}`);
        console.log(`🎯 Confidence: ${(displayMatch.confidence * 100).toFixed(1)}%`);
        console.log(`📱 Layout: ${displayMatch.template.display_spec.layout.kind}`);
        console.log(`♿ Accessibility: ${displayMatch.template.display_spec.a11y.minContrast} contrast`);
        
        // Show component breakdown
        const components = displayMatch.template.display_spec.components.map(c => c.type);
        console.log(`🧩 Components: ${components.join(', ')}`);
        
        // Show performance features
        const perf = displayMatch.template.display_spec.performance;
        if (perf) {
          console.log(`⚡ Performance: Virtualization ${perf.virtualizeOver ? `after ${perf.virtualizeOver} items` : 'disabled'}`);
        }
      } else {
        console.log('❌ No suitable display template found');
      }
    }
  }

  async demonstrateEndToEndExtraction() {
    console.log('\n\n🔄 3. End-to-End Template-Enhanced Extraction');
    console.log('==============================================');

    const testExtractions = [
      {
        url: 'https://example-company.com/team',
        query: 'Extract team members with their roles and contact info',
        generateDisplay: true
      },
      {
        url: 'https://example-store.com/products',
        query: 'Get product catalog with pricing and availability',
        generateDisplay: true
      }
    ];

    for (const test of testExtractions) {
      console.log(`\n🌐 URL: ${test.url}`);
      console.log(`📝 Query: ${test.query}`);

      const result = await templateService.extractWithTemplates({
        url: test.url,
        extractPrompt: test.query,
        useTemplates: true,
        displayGeneration: test.generateDisplay,
        userContext: {
          device: 'desktop',
          locale: 'en-US'
        }
      });

      console.log(`📊 Success: ${result.success ? '✅' : '❌'}`);
      console.log(`⏱️ Time: ${result.metadata.extractionTime.toFixed(2)}s`);
      console.log(`💰 Cost: $${result.metadata.cost.toFixed(4)}`);

      if (result.template) {
        console.log(`🎯 Template Used: ${result.template.id} (${(result.template.confidence * 100).toFixed(1)}% confidence)`);
        console.log(`📋 Match Reasons: ${result.template.match_reasons.join(', ')}`);
      }

      if (result.displaySpec) {
        console.log(`🎨 Display Generated: ${result.displaySpec.template_id}`);
        console.log(`📱 UI Confidence: ${(result.displaySpec.confidence * 100).toFixed(1)}%`);
      }

      if (result.success && result.data) {
        const dataInfo = Array.isArray(result.data) 
          ? `${result.data.length} items extracted`
          : 'Single item extracted';
        console.log(`📦 Data: ${dataInfo}`);
      }

      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      }
    }
  }

  async demonstrateEvaluationFramework() {
    console.log('\n\n🧪 4. Golden Dataset Evaluation');
    console.log('===============================');

    console.log('📚 Available Test Cases:');
    
    // Show test case categories
    const categories = goldenTestCases.reduce((acc, tc) => {
      acc[tc.category] = (acc[tc.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(categories).forEach(([category, count]) => {
      console.log(`  • ${category}: ${count} test cases`);
    });

    // Run a mini evaluation on a subset
    console.log('\n🚀 Running Mini Evaluation (2 test cases)...');
    const subset = goldenTestCases.slice(0, 2);
    
    const results = await Promise.all(
      subset.map(testCase => evaluationFramework.evaluateTestCase(testCase))
    );

    let passed = 0;
    let totalAccuracy = 0;

    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const accuracy = (result.accuracy * 100).toFixed(1);
      
      console.log(`${status} ${result.testCase.name}: ${accuracy}% accuracy`);
      console.log(`   ⏱️  ${result.responseTime.toFixed(2)}s | 💰 $${result.cost.toFixed(4)}`);
      
      if (result.templateUsed) {
        console.log(`   🎯 Template: ${result.templateUsed} (${(result.templateConfidence! * 100).toFixed(1)}%)`);
      }
      
      if (result.missingFields.length > 0) {
        console.log(`   ❌ Missing: ${result.missingFields.join(', ')}`);
      }

      if (result.success) passed++;
      totalAccuracy += result.accuracy;
    });

    const passRate = (passed / results.length * 100).toFixed(1);
    const avgAccuracy = (totalAccuracy / results.length * 100).toFixed(1);

    console.log(`\n📊 Mini Evaluation Results:`);
    console.log(`   ✅ Pass Rate: ${passRate}%`);
    console.log(`   🎯 Avg Accuracy: ${avgAccuracy}%`);
    console.log(`   💡 Use "npm run eval" for full evaluation`);
  }

  async demonstrateMaintenanceInsights() {
    console.log('\n\n🔧 5. Template Maintenance & Analytics');
    console.log('=====================================');

    // Show template statistics
    const stats = await templateService.getTemplateStats();
    console.log('📊 Template Library Stats:');
    console.log(`   📋 Extraction Templates: ${stats.totalExtractionTemplates}`);
    console.log(`   🎨 Display Templates: ${stats.totalDisplayTemplates}`);
    console.log(`   🎯 Average Accuracy: ${(stats.avgAccuracy * 100).toFixed(1)}%`);
    console.log(`   📉 Drifting Templates: ${stats.driftingTemplates}`);

    // Show maintenance tasks
    const maintenanceTasks = await templateService.getMaintenanceTasks();
    if (maintenanceTasks.length > 0) {
      console.log('\n🔧 Maintenance Tasks:');
      
      const byPriority = maintenanceTasks.reduce((acc, task) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(byPriority).forEach(([priority, count]) => {
        const emoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
        console.log(`   ${emoji} ${priority.toUpperCase()}: ${count} tasks`);
      });

      // Show a few examples
      maintenanceTasks.slice(0, 3).forEach(task => {
        const issueIcon = {
          drifting: '📉',
          deprecated: '⏰', 
          low_usage: '💤',
          security_risk: '🔒'
        }[task.issue];
        
        console.log(`     ${issueIcon} ${task.template.id}: ${task.issue.replace('_', ' ')}`);
      });
    } else {
      console.log('\n✅ No maintenance tasks - all templates healthy!');
    }

    // Show recent telemetry
    const telemetry = templateService.getTelemetry();
    if (telemetry.length > 0) {
      console.log('\n📡 Recent Activity (last 5 events):');
      telemetry.slice(-5).forEach(event => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        console.log(`   📊 ${time}: ${event.type}`);
      });
    }

    console.log('\n💡 Template System Commands:');
    console.log('   🧪 npm run eval           - Run full evaluation suite');
    console.log('   🎯 npm run eval:vmota     - Run VMOTA edge cases');  
    console.log('   📊 npm run stats          - Show detailed statistics');
    console.log('   📋 npm run templates      - List all templates');
  }

  async demonstrateSecurityFeatures() {
    console.log('\n\n🔒 6. Security & Compliance Features');
    console.log('====================================');

    console.log('🛡️  Security Guardrails:');
    console.log('   • Template integrity validation with checksums');
    console.log('   • PII detection and marking in schemas');
    console.log('   • Negative evidence filtering');
    console.log('   • No code generation - only declarative JSON specs');
    console.log('   • Supply chain security with signed templates');

    console.log('\n♿ Accessibility (A11y) Compliance:');
    console.log('   • WCAG AA/AAA contrast requirements');
    console.log('   • Keyboard navigation support');
    console.log('   • Screen reader compatibility');
    console.log('   • Focus order specification');

    console.log('\n⚡ Performance & Scalability:');
    console.log('   • Virtualization for large datasets (>100 items)');
    console.log('   • Lazy loading of images and content');
    console.log('   • Vector-based semantic search');
    console.log('   • Circuit breakers and cost controls');

    console.log('\n📊 Production Monitoring:');
    console.log('   • Real-time drift detection');
    console.log('   • Template success rate tracking');
    console.log('   • Cost and latency budgets');
    console.log('   • Structured telemetry events');
  }
}

// Run demo if called directly
if (require.main === module) {
  const demo = new TemplateSystemDemo();
  demo.runFullDemo().catch(error => {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
  });
}

export { TemplateSystemDemo };