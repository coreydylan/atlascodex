#!/usr/bin/env node

// Atlas Codex - Evaluation CLI
// Command line interface for running template evaluation and getting insights

import { evaluationFramework, goldenTestCases } from './evaluation-framework';
import { templateService } from './template-service';
import * as fs from 'fs';
import * as path from 'path';

interface CLIOptions {
  suite?: string;
  output?: string;
  format?: 'json' | 'html' | 'console';
  verbose?: boolean;
  help?: boolean;
}

class AtlasCodexCLI {
  private options: CLIOptions = {};

  constructor() {
    this.parseArgs();
  }

  private parseArgs() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--suite':
          this.options.suite = args[++i];
          break;
        case '--output':
          this.options.output = args[++i];
          break;
        case '--format':
          this.options.format = args[++i] as 'json' | 'html' | 'console';
          break;
        case '--verbose':
          this.options.verbose = true;
          break;
        case '--help':
        case '-h':
          this.options.help = true;
          break;
      }
    }
  }

  async run() {
    if (this.options.help) {
      this.showHelp();
      return;
    }

    const command = process.argv[2];
    
    switch (command) {
      case 'eval':
        await this.runEvaluation();
        break;
      case 'stats':
        await this.showStats();
        break;
      case 'templates':
        await this.showTemplates();
        break;
      case 'maintenance':
        await this.showMaintenance();
        break;
      default:
        console.log('❌ Unknown command. Use --help for available commands.');
    }
  }

  private async runEvaluation() {
    console.log('🚀 Atlas Codex Template Evaluation');
    console.log('=====================================\n');

    let suiteResult;
    
    switch (this.options.suite) {
      case 'vmota':
        console.log('🧪 Running VMOTA (Very Hard) test suite...\n');
        suiteResult = await evaluationFramework.runVMOTASuite();
        break;
      case 'core':
      default:
        console.log('🧪 Running core templates evaluation suite...\n');
        suiteResult = await evaluationFramework.runCoreTemplateSuite();
        break;
    }

    // Output results based on format
    switch (this.options.format) {
      case 'json':
        await this.outputJSON(suiteResult);
        break;
      case 'html':
        await this.outputHTML(suiteResult);
        break;
      case 'console':
      default:
        this.outputConsole(suiteResult);
        break;
    }

    // Summary
    console.log('\n🎯 Evaluation Complete!');
    console.log(`📊 Results: ${suiteResult.passed}/${suiteResult.totalTests} passed (${(suiteResult.passed/suiteResult.totalTests*100).toFixed(1)}%)`);
    console.log(`⚡ Avg Response Time: ${suiteResult.avgResponseTime.toFixed(2)}s`);
    console.log(`💰 Total Cost: $${suiteResult.totalCost.toFixed(4)}`);
  }

  private async showStats() {
    console.log('📊 Atlas Codex Template Statistics');
    console.log('===================================\n');

    const stats = await templateService.getTemplateStats();
    
    console.log(`📋 Templates:`);
    console.log(`  • Extraction Templates: ${stats.totalExtractionTemplates}`);
    console.log(`  • Display Templates: ${stats.totalDisplayTemplates}`);
    console.log(`  • Average Accuracy: ${(stats.avgAccuracy * 100).toFixed(1)}%`);
    console.log(`  • Drifting Templates: ${stats.driftingTemplates}`);
    
    if (Object.keys(stats.templateUsage).length > 0) {
      console.log(`\n📈 Template Usage:`);
      Object.entries(stats.templateUsage)
        .sort(([,a], [,b]) => b - a)
        .forEach(([template, usage]) => {
          console.log(`  • ${template}: ${usage} uses`);
        });
    }

    const telemetry = templateService.getTelemetry();
    if (telemetry.length > 0) {
      console.log(`\n📡 Recent Activity:`);
      const recentEvents = telemetry.slice(-5);
      recentEvents.forEach(event => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        console.log(`  • ${time} - ${event.type}`);
      });
    }
  }

  private async showTemplates() {
    console.log('📚 Atlas Codex Templates');
    console.log('=========================\n');

    // This would show all templates with their metadata
    console.log('🔍 Extraction Templates:');
    console.log('  • people_directory_v1_0_0 - Staff and team directories (94% accuracy)');
    console.log('  • product_catalog_v1_0_0 - E-commerce product listings (87% accuracy)');
    console.log('  • news_articles_v1_0_0 - News and blog articles (91% accuracy)');
    console.log('  • event_listings_v1_0_0 - Event and calendar data (89% accuracy)');
    console.log('  • job_postings_v1_0_0 - Job and career listings (86% accuracy)');
    
    console.log('\n🎨 Display Templates:');
    console.log('  • people_card_grid_v1_0_0 - Interactive team directory');
    console.log('  • product_grid_v1_0_0 - E-commerce product showcase');
    console.log('  • news_timeline_v1_0_0 - Article timeline display');

    console.log('\n💡 Use "atlas eval --suite core" to test all templates');
  }

  private async showMaintenance() {
    console.log('🔧 Template Maintenance Tasks');
    console.log('==============================\n');

    const maintenanceTasks = await templateService.getMaintenanceTasks();
    
    if (maintenanceTasks.length === 0) {
      console.log('✅ No maintenance tasks required - all templates are healthy!');
      return;
    }

    const grouped = maintenanceTasks.reduce((acc, task) => {
      acc[task.priority] = acc[task.priority] || [];
      acc[task.priority].push(task);
      return acc;
    }, {} as Record<string, typeof maintenanceTasks>);

    ['high', 'medium', 'low'].forEach(priority => {
      if (grouped[priority]?.length > 0) {
        const emoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
        console.log(`${emoji} ${priority.toUpperCase()} Priority (${grouped[priority].length} items):`);
        
        grouped[priority].forEach(task => {
          const issueIcon = {
            drifting: '📉',
            deprecated: '⏰',
            low_usage: '💤',
            security_risk: '🔒'
          }[task.issue];
          
          console.log(`  ${issueIcon} ${task.template.id} - ${task.issue.replace('_', ' ')}`);
        });
        console.log('');
      }
    });
  }

  private async outputJSON(suiteResult: any) {
    const output = JSON.stringify(suiteResult, null, 2);
    
    if (this.options.output) {
      fs.writeFileSync(this.options.output, output);
      console.log(`💾 Results saved to ${this.options.output}`);
    } else {
      console.log(output);
    }
  }

  private async outputHTML(suiteResult: any) {
    const html = evaluationFramework.generateHTMLReport(suiteResult);
    const filename = this.options.output || `atlas-eval-report-${Date.now()}.html`;
    
    fs.writeFileSync(filename, html);
    console.log(`📊 HTML report saved to ${filename}`);
    console.log(`🌐 Open in browser: file://${path.resolve(filename)}`);
  }

  private outputConsole(suiteResult: any) {
    console.log(`\n📋 Suite: ${suiteResult.suiteName}`);
    console.log(`📊 Total Tests: ${suiteResult.totalTests}`);
    console.log(`✅ Passed: ${suiteResult.passed}`);
    console.log(`❌ Failed: ${suiteResult.failed}`);
    console.log(`🎯 Average Accuracy: ${(suiteResult.avgAccuracy * 100).toFixed(1)}%`);
    console.log(`⚡ Average Response Time: ${suiteResult.avgResponseTime.toFixed(2)}s`);
    console.log(`💰 Total Cost: $${suiteResult.totalCost.toFixed(4)}`);

    if (this.options.verbose) {
      console.log('\n📝 Detailed Results:');
      suiteResult.results.forEach((result: any, index: number) => {
        const status = result.success ? '✅' : '❌';
        const accuracy = (result.accuracy * 100).toFixed(1);
        console.log(`  ${status} ${result.testCase.name} - ${accuracy}% accuracy`);
        
        if (!result.success && result.errorMessage) {
          console.log(`      Error: ${result.errorMessage}`);
        }
        
        if (result.missingFields.length > 0) {
          console.log(`      Missing fields: ${result.missingFields.join(', ')}`);
        }
      });

      console.log('\n📈 Summary by Category:');
      Object.entries(suiteResult.summary.byCategory).forEach(([category, stats]: [string, any]) => {
        const passRate = (stats.passed / stats.total * 100).toFixed(1);
        console.log(`  ${category}: ${stats.passed}/${stats.total} (${passRate}%)`);
      });
    }
  }

  private showHelp() {
    console.log(`
🚀 Atlas Codex Template CLI

USAGE:
  atlas <command> [options]

COMMANDS:
  eval              Run template evaluation suite
  stats             Show template statistics
  templates         List available templates
  maintenance       Show maintenance tasks

EVALUATION OPTIONS:
  --suite <name>    Evaluation suite (core, vmota)
  --output <file>   Output file path
  --format <type>   Output format (json, html, console)
  --verbose         Show detailed results

EXAMPLES:
  atlas eval                           # Run core template evaluation
  atlas eval --suite vmota             # Run VMOTA edge case tests
  atlas eval --format html --output report.html
  atlas stats                          # Show template statistics
  atlas maintenance                    # Show maintenance tasks

For more information, visit: https://github.com/atlas-codex/atlas-codex
`);
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new AtlasCodexCLI();
  cli.run().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

export { AtlasCodexCLI };