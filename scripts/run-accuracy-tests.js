#!/usr/bin/env node
// Atlas Codex: Accuracy Testing CLI
// Command-line interface for running comprehensive accuracy tests

const { AccuracyTestRunner } = require('../packages/testing/accuracy/test-runner');
const { ACCURACY_TEST_LIBRARY, getCriticalTestCases } = require('../packages/testing/accuracy/test-cases');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'full';
  
  console.log('🎯 Atlas Codex Accuracy Testing System');
  console.log('=====================================\n');
  
  const testRunner = new AccuracyTestRunner();
  
  try {
    let result;
    
    switch (command) {
      case 'full':
        console.log('Running full accuracy test suite...');
        result = await testRunner.runFullAccuracySuite();
        break;
        
      case 'critical':
        console.log('Running critical tests only...');
        result = await testRunner.runCriticalTestsOnly();
        break;
        
      case 'regression':
        console.log('Running regression check...');
        const regressionResult = await testRunner.runRegressionCheck();
        console.log('\n📊 Regression Check Results:');
        console.log(`Regressions Found: ${regressionResult.regressions.length}`);
        
        if (regressionResult.hasRegressions) {
          console.log('\n🚨 REGRESSIONS DETECTED:');
          for (const regression of regressionResult.regressions) {
            console.log(`  ${regression.testCaseId}: ${(regression.scoreDrop * 100).toFixed(1)}% drop (${regression.impact})`);
          }
          process.exit(1);
        } else {
          console.log('✅ No regressions detected');
          process.exit(0);
        }
        break;
        
      case 'validate':
        console.log('Validating test cases...');
        const { validateAllTestCases } = require('../packages/testing/accuracy/test-cases');
        const validationResults = validateAllTestCases();
        
        if (Object.keys(validationResults).length === 0) {
          console.log('✅ All test cases are valid');
          process.exit(0);
        } else {
          console.log('❌ Test case validation errors:');
          for (const [testId, errors] of Object.entries(validationResults)) {
            console.log(`  ${testId}: ${errors.join(', ')}`);
          }
          process.exit(1);
        }
        break;
        
      default:
        console.log('Unknown command. Available commands:');
        console.log('  full      - Run full accuracy test suite');
        console.log('  critical  - Run critical tests only');
        console.log('  regression - Check for accuracy regressions');
        console.log('  validate  - Validate test case definitions');
        process.exit(1);
    }
    
    if (result) {
      // Print summary
      console.log('\n' + '='.repeat(50));
      console.log('🏁 ACCURACY TEST RESULTS');
      console.log('='.repeat(50));
      console.log(result.summary);
      console.log(`\nRecommendation: ${result.recommendation}`);
      
      // Print category breakdown
      if (Object.keys(result.categoryScores).length > 0) {
        console.log('\n📊 Category Scores:');
        for (const [category, score] of Object.entries(result.categoryScores)) {
          console.log(`  ${category}: ${(score * 100).toFixed(1)}%`);
        }
      }
      
      // Print common issues
      if (result.commonIssues.length > 0) {
        console.log('\n⚠️ Common Issues:');
        result.commonIssues.slice(0, 5).forEach(issue => {
          console.log(`  ${issue.severity.toUpperCase()}: ${issue.issueType} (${issue.frequency}x)`);
        });
      }
      
      // Print failures
      if (result.failures.length > 0) {
        console.log('\n❌ Failed Tests:');
        result.failures.forEach(failure => {
          console.log(`  ${failure.testCaseId}: ${(failure.score * 100).toFixed(1)}% (need ${(failure.threshold * 100).toFixed(1)}%)`);
          if (failure.criticalIssues.length > 0) {
            console.log(`    🚨 ${failure.criticalIssues.length} critical issues`);
          }
        });
      }
      
      // Exit with appropriate code
      const exitCode = result.recommendation === 'PASS' ? 0 : 1;
      process.exit(exitCode);
    }
    
  } catch (error) {
    console.error('💥 Accuracy testing failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled promise rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };