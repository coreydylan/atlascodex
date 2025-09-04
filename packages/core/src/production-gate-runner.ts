#!/usr/bin/env node

/**
 * Production Gate Runner CLI
 * 
 * Command-line interface for running the 10-Point Production Readiness Gate validation
 * 
 * Usage:
 *   npx tsx production-gate-runner.ts --all                    # Run all gates
 *   npx tsx production-gate-runner.ts --gate "Schema Strictness" # Run specific gate
 *   npx tsx production-gate-runner.ts --preflight             # Run pre-flight checklist
 *   npx tsx production-gate-runner.ts --report output.json    # Save report to file
 */

import { program } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import {
  ProductionGateRunner,
  ProductionGateValidator,
  type ProductionReadinessReport
} from './production-gate-checklist';

// ANSI color codes for better CLI output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function formatScore(score: number): string {
  const percentage = (score * 100).toFixed(1);
  const color = score >= 0.8 ? 'green' : score >= 0.6 ? 'yellow' : 'red';
  return colorize(`${percentage}%`, color);
}

function printGateResult(gate: any): void {
  const status = gate.passed 
    ? colorize('✅ PASSED', 'green')
    : colorize('❌ FAILED', 'red');
  
  const score = formatScore(gate.score);
  const testInfo = gate.testResults 
    ? ` (${gate.testResults.filter((t: any) => t.passed).length}/${gate.testResults.length} tests passed)`
    : '';
  
  console.log(`  ${status} ${colorize(gate.gate, 'bright')}: ${score}${testInfo}`);
  
  if (!gate.passed && gate.recommendations) {
    gate.recommendations.slice(0, 2).forEach((rec: string) => {
      console.log(`    ${colorize('💡', 'yellow')} ${rec}`);
    });
  }
}

async function saveReport(report: ProductionReadinessReport, outputPath: string): Promise<void> {
  try {
    const reportJson = JSON.stringify(report, null, 2);
    await fs.writeFile(outputPath, reportJson, 'utf8');
    console.log(colorize(`\n📄 Report saved to: ${outputPath}`, 'cyan'));
  } catch (error) {
    console.error(colorize(`❌ Failed to save report: ${error.message}`, 'red'));
  }
}

async function runAllGates(options: { report?: string, verbose?: boolean }): Promise<void> {
  console.log(colorize('\n🔍 Running Complete Production Readiness Gate Validation\n', 'bright'));
  
  const runner = new ProductionGateRunner();
  const report = await runner.runCompleteValidation();
  
  // Print summary
  const overallStatus = report.readyForProduction 
    ? colorize('✅ READY FOR PRODUCTION', 'green')
    : colorize('❌ NOT READY FOR PRODUCTION', 'red');
  
  const overallScore = formatScore(report.overallScore);
  
  console.log(colorize('📊 PRODUCTION READINESS REPORT', 'bright'));
  console.log(colorize('═'.repeat(50), 'blue'));
  console.log(`Overall Score: ${overallScore}`);
  console.log(`Status: ${overallStatus}`);
  console.log(`Gates Passed: ${colorize(`${report.gateResults.filter(g => g.passed).length}/10`, report.readyForProduction ? 'green' : 'red')}`);
  console.log(`Generated: ${colorize(new Date(report.timestamp).toLocaleString(), 'cyan')}`);
  
  console.log(colorize('\n📋 INDIVIDUAL GATE RESULTS:', 'bright'));
  console.log(colorize('─'.repeat(50), 'blue'));
  
  // Print each gate result
  report.gateResults.forEach(printGateResult);
  
  // Print critical failures
  if (report.criticalFailures.length > 0) {
    console.log(colorize('\n🚨 CRITICAL FAILURES:', 'red'));
    console.log(colorize('─'.repeat(50), 'red'));
    report.criticalFailures.forEach(failure => {
      console.log(`  ${colorize('•', 'red')} ${failure}`);
    });
  }
  
  // Print top recommendations
  if (report.recommendations.length > 0) {
    console.log(colorize('\n💡 TOP RECOMMENDATIONS:', 'yellow'));
    console.log(colorize('─'.repeat(50), 'yellow'));
    const validator = new ProductionGateValidator();
    const actionableRecs = validator.generateActionableRecommendations(report);
    
    actionableRecs.slice(0, 5).forEach(rec => {
      console.log(`  ${colorize('•', 'yellow')} ${rec}`);
    });
  }
  
  // Print deployment status
  console.log(colorize('\n🚀 DEPLOYMENT STATUS:', 'bright'));
  console.log(colorize('─'.repeat(50), 'blue'));
  if (report.readyForProduction) {
    console.log(colorize('  ✅ All production gates passed!', 'green'));
    console.log(colorize('  ✅ System is ready for production deployment', 'green'));
  } else {
    console.log(colorize('  ❌ Production deployment blocked', 'red'));
    console.log(colorize(`  ❌ ${report.criticalFailures.length} critical issue(s) must be resolved`, 'red'));
  }
  
  // Save report if requested
  if (options.report) {
    await saveReport(report, options.report);
  }
  
  // Print verbose details if requested
  if (options.verbose) {
    console.log(colorize('\n🔍 DETAILED TEST RESULTS:', 'bright'));
    console.log(colorize('─'.repeat(50), 'blue'));
    
    report.gateResults.forEach(gate => {
      if (gate.testResults && gate.testResults.length > 0) {
        console.log(colorize(`\n${gate.gate}:`, 'bright'));
        gate.testResults.forEach(test => {
          const testStatus = test.passed ? colorize('✅', 'green') : colorize('❌', 'red');
          console.log(`  ${testStatus} ${test.scenario}`);
          if (!test.passed && test.details.error) {
            console.log(`    ${colorize('Error:', 'red')} ${test.details.error}`);
          }
        });
      }
    });
  }
}

async function runSpecificGate(gateName: string, options: { verbose?: boolean }): Promise<void> {
  console.log(colorize(`\n🔍 Running ${gateName} Validation\n`, 'bright'));
  
  const runner = new ProductionGateRunner();
  const results = await runner.runSpecificGates([gateName]);
  
  if (results.length === 0) {
    console.error(colorize('❌ Gate not found or failed to run', 'red'));
    process.exit(1);
  }
  
  const gate = results[0];
  
  console.log(colorize('📊 GATE VALIDATION RESULT', 'bright'));
  console.log(colorize('═'.repeat(40), 'blue'));
  
  printGateResult(gate);
  
  if (gate.details) {
    console.log(colorize('\n📋 Details:', 'bright'));
    console.log(colorize('─'.repeat(40), 'blue'));
    Object.entries(gate.details).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        console.log(`  ${colorize(key, 'cyan')}: ${JSON.stringify(value, null, 2)}`);
      } else {
        console.log(`  ${colorize(key, 'cyan')}: ${value}`);
      }
    });
  }
  
  if (options.verbose && gate.testResults) {
    console.log(colorize('\n🔍 Test Results:', 'bright'));
    console.log(colorize('─'.repeat(40), 'blue'));
    gate.testResults.forEach(test => {
      const testStatus = test.passed ? colorize('✅', 'green') : colorize('❌', 'red');
      console.log(`  ${testStatus} ${test.scenario}`);
      if (test.details && Object.keys(test.details).length > 0) {
        console.log(`    ${JSON.stringify(test.details, null, 4)}`);
      }
    });
  }
  
  if (gate.recommendations && gate.recommendations.length > 0) {
    console.log(colorize('\n💡 Recommendations:', 'yellow'));
    console.log(colorize('─'.repeat(40), 'yellow'));
    gate.recommendations.forEach(rec => {
      console.log(`  ${colorize('•', 'yellow')} ${rec}`);
    });
  }
}

async function runPreFlightChecklist(): Promise<void> {
  console.log(colorize('\n🚀 Running Production Pre-Flight Checklist\n', 'bright'));
  
  const runner = new ProductionGateRunner();
  const result = await runner.runPreFlightChecklist();
  
  console.log(colorize('📊 PRE-FLIGHT CHECKLIST RESULTS', 'bright'));
  console.log(colorize('═'.repeat(50), 'blue'));
  
  result.results.forEach(check => {
    const status = check.passed 
      ? colorize('✅ PASSED', 'green')
      : colorize('❌ FAILED', 'red');
    
    console.log(`  ${status} ${colorize(check.name, 'bright')}`);
    console.log(`    ${check.description}`);
    
    if (!check.passed) {
      if (check.details.error) {
        console.log(`    ${colorize('Error:', 'red')} ${check.details.error}`);
      } else {
        console.log(`    ${colorize('Details:', 'yellow')} ${JSON.stringify(check.details, null, 2)}`);
      }
    }
  });
  
  const overallStatus = result.passed
    ? colorize('\n✅ PRE-FLIGHT CHECKLIST PASSED - Ready for deployment!', 'green')
    : colorize('\n❌ PRE-FLIGHT CHECKLIST FAILED - Issues must be resolved', 'red');
  
  console.log(colorize('\n🚀 DEPLOYMENT STATUS:', 'bright'));
  console.log(colorize('─'.repeat(50), 'blue'));
  console.log(overallStatus);
  console.log(`Checks Passed: ${colorize(`${result.results.filter(r => r.passed).length}/${result.results.length}`, result.passed ? 'green' : 'red')}`);
}

// CLI Program Setup
program
  .name('production-gate-runner')
  .description('Production Readiness Gate validation tool for Atlas Codex Evidence-First system')
  .version('1.0.0');

program
  .command('all')
  .description('Run all 10 production gates')
  .option('-r, --report <path>', 'Save detailed report to file')
  .option('-v, --verbose', 'Show detailed test results')
  .action(runAllGates);

program
  .command('gate')
  .description('Run a specific production gate')
  .argument('<name>', 'Gate name (e.g., "Schema Strictness", "Anchor ID System")')
  .option('-v, --verbose', 'Show detailed test results')
  .action(runSpecificGate);

program
  .command('preflight')
  .description('Run production pre-flight checklist')
  .action(runPreFlightChecklist);

program
  .command('list')
  .description('List all available production gates')
  .action(() => {
    console.log(colorize('\n📋 Available Production Gates:', 'bright'));
    console.log(colorize('═'.repeat(40), 'blue'));
    
    const gates = [
      'Schema Strictness',
      'Anchor ID System', 
      'Promotion Quorum',
      'Content Hashing',
      'Budget Enforcement',
      'State Machine',
      'Anti-Hallucination',
      'Performance',
      'Observability',
      'Rollback Readiness'
    ];
    
    gates.forEach((gate, index) => {
      console.log(`  ${colorize(`${index + 1}.`, 'cyan')} ${gate}`);
    });
    
    console.log(colorize('\nUsage Examples:', 'bright'));
    console.log(colorize('─'.repeat(40), 'blue'));
    console.log(`  ${colorize('Run all gates:', 'yellow')} npx tsx production-gate-runner.ts all`);
    console.log(`  ${colorize('Run specific gate:', 'yellow')} npx tsx production-gate-runner.ts gate "Schema Strictness"`);
    console.log(`  ${colorize('Run pre-flight:', 'yellow')} npx tsx production-gate-runner.ts preflight`);
    console.log(`  ${colorize('Save report:', 'yellow')} npx tsx production-gate-runner.ts all -r report.json`);
  });

// Handle no command provided
program
  .action(() => {
    console.log(colorize('🔍 Production Gate Runner', 'bright'));
    console.log(colorize('Use --help for usage instructions', 'cyan'));
    program.help();
  });

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (error) {
  if (error.code === 'commander.help' || error.code === 'commander.helpDisplayed') {
    process.exit(0);
  } else if (error.code === 'commander.version') {
    process.exit(0);
  } else {
    console.error(colorize(`❌ Error: ${error.message}`, 'red'));
    process.exit(1);
  }
}

// If no command was provided, show help
if (process.argv.length <= 2) {
  console.log(colorize('🔍 Production Gate Runner - Evidence-First System Validation', 'bright'));
  console.log(colorize('═'.repeat(60), 'blue'));
  console.log('Validates the 10-Point Production Readiness Gate checklist as specified');
  console.log('in the Evidence-First Adaptive Extraction Plan.');
  console.log('');
  program.help();
}