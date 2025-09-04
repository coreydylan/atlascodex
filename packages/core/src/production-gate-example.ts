/**
 * Production Gate Checklist - Usage Examples
 * 
 * Comprehensive examples demonstrating how to use the 10-Point Production 
 * Readiness Gate validation system in various scenarios.
 */

import {
  ProductionGateValidator,
  ProductionGateRunner,
  type ProductionReadinessReport,
  type GateValidationResult
} from './production-gate-checklist';

/**
 * Example 1: Basic Gate Validation
 * Run all production gates and get a comprehensive report
 */
export async function basicGateValidationExample(): Promise<void> {
  console.log('🔍 Example 1: Basic Gate Validation\n');

  const validator = new ProductionGateValidator();
  
  try {
    // Run complete validation
    const report = await validator.runFullValidation();
    
    console.log(`Overall Score: ${(report.overallScore * 100).toFixed(1)}%`);
    console.log(`Ready for Production: ${report.readyForProduction ? 'YES' : 'NO'}`);
    console.log(`Gates Passed: ${report.gateResults.filter(g => g.passed).length}/10`);
    
    // Show failed gates
    const failedGates = report.gateResults.filter(gate => !gate.passed);
    if (failedGates.length > 0) {
      console.log('\nFailed Gates:');
      failedGates.forEach(gate => {
        console.log(`  ❌ ${gate.gate}: ${(gate.score * 100).toFixed(1)}%`);
      });
    }
    
    // Show recommendations
    if (report.recommendations.length > 0) {
      console.log('\nTop Recommendations:');
      report.recommendations.slice(0, 3).forEach(rec => {
        console.log(`  💡 ${rec}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  }
}

/**
 * Example 2: Individual Gate Testing
 * Test specific gates in isolation for detailed debugging
 */
export async function individualGateTestingExample(): Promise<void> {
  console.log('🔍 Example 2: Individual Gate Testing\n');

  const runner = new ProductionGateRunner();
  
  // Test critical safety gates first
  const criticalGates = ['Schema Strictness', 'Anchor ID System', 'Anti-Hallucination'];
  
  for (const gateName of criticalGates) {
    console.log(`Testing ${gateName}...`);
    
    const results = await runner.runSpecificGates([gateName]);
    const gate = results[0];
    
    console.log(`  Status: ${gate.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  Score: ${(gate.score * 100).toFixed(1)}%`);
    console.log(`  Tests: ${gate.testResults?.filter(t => t.passed).length}/${gate.testResults?.length} passed`);
    
    if (!gate.passed && gate.recommendations) {
      console.log(`  Recommendation: ${gate.recommendations[0]}`);
    }
    console.log('');
  }
}

/**
 * Example 3: Pre-Production Validation Workflow
 * Comprehensive validation workflow for production deployment
 */
export async function preProductionWorkflowExample(): Promise<void> {
  console.log('🔍 Example 3: Pre-Production Validation Workflow\n');

  const runner = new ProductionGateRunner();
  
  try {
    // Step 1: Run pre-flight checklist
    console.log('Step 1: Running pre-flight checklist...');
    const preflightResult = await runner.runPreFlightChecklist();
    
    if (!preflightResult.passed) {
      console.log('❌ Pre-flight checklist failed. Blocking deployment.');
      console.log('Failed checks:');
      preflightResult.results
        .filter(check => !check.passed)
        .forEach(check => {
          console.log(`  • ${check.name}: ${check.details.error || 'Failed'}`);
        });
      return;
    }
    
    console.log('✅ Pre-flight checklist passed.\n');
    
    // Step 2: Run complete gate validation
    console.log('Step 2: Running complete gate validation...');
    const report = await runner.runCompleteValidation();
    
    if (!report.readyForProduction) {
      console.log('❌ Production readiness validation failed.');
      console.log('Critical failures:');
      report.criticalFailures.forEach(failure => {
        console.log(`  • ${failure}`);
      });
      return;
    }
    
    console.log('✅ All production gates passed!');
    
    // Step 3: Generate deployment summary
    console.log('\nStep 3: Deployment Summary');
    console.log('─'.repeat(40));
    console.log(`Overall Score: ${(report.overallScore * 100).toFixed(1)}%`);
    console.log(`Validation Time: ${new Date(report.timestamp).toLocaleString()}`);
    console.log(`System Version: ${report.version}`);
    console.log('\n🚀 SYSTEM IS READY FOR PRODUCTION DEPLOYMENT! 🚀');
    
  } catch (error) {
    console.error('❌ Validation workflow failed:', error.message);
  }
}

/**
 * Example 4: Continuous Integration Validation
 * Gate validation suitable for CI/CD pipelines
 */
export async function ciValidationExample(): Promise<boolean> {
  console.log('🔍 Example 4: CI/CD Pipeline Validation\n');

  const validator = new ProductionGateValidator();
  
  try {
    const report = await validator.runFullValidation();
    
    // CI-friendly output
    console.log(`PRODUCTION_READY=${report.readyForProduction}`);
    console.log(`OVERALL_SCORE=${report.overallScore.toFixed(3)}`);
    console.log(`GATES_PASSED=${report.gateResults.filter(g => g.passed).length}`);
    console.log(`CRITICAL_FAILURES=${report.criticalFailures.length}`);
    
    // Output for CI metrics
    report.gateResults.forEach(gate => {
      const gateName = gate.gate.replace(/\s+/g, '_').toUpperCase();
      console.log(`GATE_${gateName}=${gate.passed ? 1 : 0}`);
      console.log(`SCORE_${gateName}=${gate.score.toFixed(3)}`);
    });
    
    // Exit with appropriate code for CI
    if (report.readyForProduction) {
      console.log('✅ CI: Production gates validation PASSED');
      return true;
    } else {
      console.log('❌ CI: Production gates validation FAILED');
      console.log('Failed gates:', report.gateResults.filter(g => !g.passed).map(g => g.gate).join(', '));
      return false;
    }
    
  } catch (error) {
    console.error('❌ CI: Validation error:', error.message);
    return false;
  }
}

/**
 * Example 5: Custom Gate Configuration
 * How to extend the validation system with custom requirements
 */
export async function customGateConfigurationExample(): Promise<void> {
  console.log('🔍 Example 5: Custom Gate Configuration\n');

  class CustomProductionGateValidator extends ProductionGateValidator {
    /**
     * Add custom validation for organization-specific requirements
     */
    async validateCustomSecurityRequirements(): Promise<GateValidationResult> {
      console.log('Running custom security validation...');
      
      // Example: Check for security compliance
      const securityChecks = [
        { name: 'ssl_certificate_valid', passed: true },
        { name: 'api_rate_limiting_enabled', passed: true },
        { name: 'input_sanitization_active', passed: true },
        { name: 'audit_logging_configured', passed: true }
      ];
      
      const passedCount = securityChecks.filter(check => check.passed).length;
      const score = passedCount / securityChecks.length;
      
      return {
        gate: 'Custom Security',
        passed: score >= 1.0,
        score,
        details: {
          total_checks: securityChecks.length,
          passed_checks: passedCount,
          security_checks: securityChecks
        },
        recommendations: score < 1.0 ? [
          'Review failed security checks',
          'Ensure all security requirements are met',
          'Consult security team for compliance verification'
        ] : []
      };
    }
    
    /**
     * Enhanced validation including custom gates
     */
    async runEnhancedValidation(): Promise<ProductionReadinessReport> {
      // Run standard validation
      const standardReport = await this.runFullValidation();
      
      // Add custom validation
      const customSecurityResult = await this.validateCustomSecurityRequirements();
      
      // Merge results
      const enhancedGateResults = [...standardReport.gateResults, customSecurityResult];
      const enhancedOverallScore = enhancedGateResults.reduce((sum, gate) => sum + gate.score, 0) / enhancedGateResults.length;
      const enhancedReadyForProduction = enhancedGateResults.every(gate => gate.passed);
      
      return {
        ...standardReport,
        overallScore: enhancedOverallScore,
        readyForProduction: enhancedReadyForProduction,
        gateResults: enhancedGateResults
      };
    }
  }
  
  const customValidator = new CustomProductionGateValidator();
  const report = await customValidator.runEnhancedValidation();
  
  console.log(`Enhanced Validation Results:`);
  console.log(`  Gates: ${report.gateResults.length} (including custom)`);
  console.log(`  Overall Score: ${(report.overallScore * 100).toFixed(1)}%`);
  console.log(`  Ready for Production: ${report.readyForProduction ? 'YES' : 'NO'}`);
  
  // Show custom gate result
  const customGate = report.gateResults.find(gate => gate.gate === 'Custom Security');
  if (customGate) {
    console.log(`  Custom Security Gate: ${customGate.passed ? '✅ PASSED' : '❌ FAILED'}`);
  }
}

/**
 * Example 6: Monitoring and Alerting Integration
 * How to integrate gate validation with monitoring systems
 */
export async function monitoringIntegrationExample(): Promise<void> {
  console.log('🔍 Example 6: Monitoring Integration\n');

  const validator = new ProductionGateValidator();
  
  // Mock monitoring system
  class MockMonitoringSystem {
    static sendMetric(name: string, value: number, tags?: Record<string, string>): void {
      console.log(`METRIC: ${name}=${value} ${tags ? JSON.stringify(tags) : ''}`);
    }
    
    static sendAlert(level: 'info' | 'warning' | 'critical', message: string, details?: any): void {
      const emoji = level === 'critical' ? '🚨' : level === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`ALERT [${level.toUpperCase()}]: ${emoji} ${message}`);
      if (details) {
        console.log(`  Details: ${JSON.stringify(details, null, 2)}`);
      }
    }
  }
  
  try {
    const report = await validator.runFullValidation();
    
    // Send metrics to monitoring system
    MockMonitoringSystem.sendMetric('production_gates.overall_score', report.overallScore);
    MockMonitoringSystem.sendMetric('production_gates.gates_passed', report.gateResults.filter(g => g.passed).length);
    MockMonitoringSystem.sendMetric('production_gates.critical_failures', report.criticalFailures.length);
    
    // Send individual gate metrics
    report.gateResults.forEach(gate => {
      const gateName = gate.gate.toLowerCase().replace(/\s+/g, '_');
      MockMonitoringSystem.sendMetric(`production_gates.${gateName}.score`, gate.score);
      MockMonitoringSystem.sendMetric(`production_gates.${gateName}.passed`, gate.passed ? 1 : 0);
    });
    
    // Send alerts based on results
    if (!report.readyForProduction) {
      MockMonitoringSystem.sendAlert('critical', 'Production deployment blocked by gate failures', {
        overall_score: report.overallScore,
        failed_gates: report.gateResults.filter(g => !g.passed).map(g => g.gate),
        critical_failures: report.criticalFailures
      });
    } else if (report.overallScore < 0.95) {
      MockMonitoringSystem.sendAlert('warning', 'Production gates passed but score below 95%', {
        overall_score: report.overallScore,
        recommendations: report.recommendations.slice(0, 3)
      });
    } else {
      MockMonitoringSystem.sendAlert('info', 'All production gates passed with high score', {
        overall_score: report.overallScore
      });
    }
    
  } catch (error) {
    MockMonitoringSystem.sendAlert('critical', 'Production gate validation system failure', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Example 7: Scheduled Gate Validation
 * How to run periodic validation checks
 */
export async function scheduledValidationExample(): Promise<void> {
  console.log('🔍 Example 7: Scheduled Validation (Simulation)\n');

  const validator = new ProductionGateValidator();
  
  // Simulate running validation every hour
  const simulateScheduledRun = async (runNumber: number): Promise<void> => {
    console.log(`\n--- Scheduled Run #${runNumber} at ${new Date().toLocaleString()} ---`);
    
    try {
      // Run subset of critical gates for performance
      const runner = new ProductionGateRunner();
      const criticalGates = ['Schema Strictness', 'Anti-Hallucination', 'Performance'];
      const results = await runner.runSpecificGates(criticalGates);
      
      const allPassed = results.every(gate => gate.passed);
      const avgScore = results.reduce((sum, gate) => sum + gate.score, 0) / results.length;
      
      console.log(`  Critical Gates Status: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
      console.log(`  Average Score: ${(avgScore * 100).toFixed(1)}%`);
      
      if (!allPassed) {
        const failedGates = results.filter(gate => !gate.passed);
        console.log(`  Failed Gates: ${failedGates.map(g => g.gate).join(', ')}`);
        
        // In real implementation, this would trigger alerts
        console.log('  🚨 ALERT: Critical gate failure detected in scheduled check');
      }
      
      // Store results (in real implementation, this would be a database/time series)
      const runResult = {
        timestamp: new Date().toISOString(),
        run_number: runNumber,
        critical_gates_passed: allPassed,
        average_score: avgScore,
        individual_results: results.map(gate => ({
          gate: gate.gate,
          passed: gate.passed,
          score: gate.score
        }))
      };
      
      console.log(`  📊 Run data logged: ${JSON.stringify(runResult, null, 2)}`);
      
    } catch (error) {
      console.error(`  ❌ Scheduled run #${runNumber} failed:`, error.message);
    }
  };
  
  // Simulate 3 scheduled runs
  for (let i = 1; i <= 3; i++) {
    await simulateScheduledRun(i);
    // In real implementation, this would be actual time intervals
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  console.log('🚀 Production Gate Checklist - Comprehensive Examples\n');
  console.log('═'.repeat(60));
  
  const examples = [
    { name: 'Basic Gate Validation', fn: basicGateValidationExample },
    { name: 'Individual Gate Testing', fn: individualGateTestingExample },
    { name: 'Pre-Production Workflow', fn: preProductionWorkflowExample },
    { name: 'CI/CD Integration', fn: ciValidationExample },
    { name: 'Custom Gate Configuration', fn: customGateConfigurationExample },
    { name: 'Monitoring Integration', fn: monitoringIntegrationExample },
    { name: 'Scheduled Validation', fn: scheduledValidationExample }
  ];
  
  for (const example of examples) {
    try {
      console.log(`\n${'─'.repeat(60)}`);
      await example.fn();
      console.log(`✅ Example "${example.name}" completed successfully`);
    } catch (error) {
      console.error(`❌ Example "${example.name}" failed:`, error.message);
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log('🎉 All examples completed!');
  console.log('\nNext Steps:');
  console.log('1. Integrate production gate validation into your CI/CD pipeline');
  console.log('2. Set up monitoring and alerting for gate validation results');
  console.log('3. Schedule periodic validation checks');
  console.log('4. Customize gates for your organization-specific requirements');
  console.log('5. Train team on production readiness gate requirements');
}

// CLI runner for examples
if (require.main === module) {
  const exampleName = process.argv[2];
  
  switch (exampleName) {
    case 'basic':
      basicGateValidationExample();
      break;
    case 'individual':
      individualGateTestingExample();
      break;
    case 'workflow':
      preProductionWorkflowExample();
      break;
    case 'ci':
      ciValidationExample().then(success => process.exit(success ? 0 : 1));
      break;
    case 'custom':
      customGateConfigurationExample();
      break;
    case 'monitoring':
      monitoringIntegrationExample();
      break;
    case 'scheduled':
      scheduledValidationExample();
      break;
    case 'all':
    default:
      runAllExamples();
      break;
  }
}