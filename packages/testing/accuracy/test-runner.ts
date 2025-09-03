// Atlas Codex: Automated Accuracy Test Runner
// Comprehensive testing system that validates extraction accuracy systematically

import { AccuracyTestCase, ACCURACY_TEST_LIBRARY, getCriticalTestCases } from './test-cases';
import { AccuracyScorer, AccuracyResult, AccuracyIssue } from './accuracy-scorer';
import { processWithPlanBasedSystem } from '../../worker/worker-enhanced';

export interface AccuracySuiteResult {
  timestamp: string;
  overallScore: number;
  passRate: number;
  totalTests: number;
  passed: number;
  failed: number;
  categoryScores: Record<string, number>;
  commonIssues: IssuePattern[];
  regressions: Regression[];
  failures: TestFailure[];
  results: AccuracyResult[];
  recommendation: 'PASS' | 'NEEDS_IMPROVEMENT' | 'CRITICAL_FAILURES';
  summary: string;
}

export interface TestFailure {
  testCaseId: string;
  score: number;
  threshold: number;
  error?: string;
  issues: AccuracyIssue[];
  criticalIssues: AccuracyIssue[];
}

export interface IssuePattern {
  issueType: string;
  frequency: number;
  affectedTests: string[];
  severity: 'critical' | 'warning' | 'info';
  commonSuggestion: string;
}

export interface Regression {
  testCaseId: string;
  previousScore: number;
  currentScore: number;
  scoreDrop: number;
  impact: 'critical' | 'moderate' | 'minor';
}

export interface ExtractionResult {
  data: any;
  metadata: {
    confidence: number;
    responseTime: number;
    strategyUsed: string;
    cost?: number;
    tokensUsed?: number;
  };
}

export class AccuracyTestRunner {
  private accuracyScorer: AccuracyScorer;
  private baselineResults: Map<string, AccuracyResult> = new Map();

  constructor() {
    this.accuracyScorer = new AccuracyScorer();
  }

  async runFullAccuracySuite(): Promise<AccuracySuiteResult> {
    console.log('🧪 Starting comprehensive accuracy test suite...');
    console.log(`📊 Running ${ACCURACY_TEST_LIBRARY.length} test cases`);
    
    const startTime = Date.now();
    const results: AccuracyResult[] = [];
    const failures: TestFailure[] = [];

    // Run all test cases
    for (let i = 0; i < ACCURACY_TEST_LIBRARY.length; i++) {
      const testCase = ACCURACY_TEST_LIBRARY[i];
      console.log(`\n[${i + 1}/${ACCURACY_TEST_LIBRARY.length}] Testing: ${testCase.name}`);
      
      try {
        const result = await this.runSingleTest(testCase);
        results.push(result);
        
        // Check if test passed
        if (!result.passedThreshold) {
          const criticalIssues = result.issues.filter(issue => issue.severity === 'critical');
          failures.push({
            testCaseId: testCase.id,
            score: result.overallScore,
            threshold: testCase.confidenceThreshold,
            issues: result.issues,
            criticalIssues
          });
          
          console.log(`  ❌ FAILED: ${(result.overallScore * 100).toFixed(1)}% (threshold: ${(testCase.confidenceThreshold * 100).toFixed(1)}%)`);
          if (criticalIssues.length > 0) {
            console.log(`  🚨 Critical Issues: ${criticalIssues.length}`);
            criticalIssues.forEach(issue => {
              console.log(`    - ${issue.description}`);
            });
          }
        } else {
          console.log(`  ✅ PASSED: ${(result.overallScore * 100).toFixed(1)}%`);
        }
        
      } catch (error) {
        console.error(`  💥 ERROR: ${error.message}`);
        failures.push({
          testCaseId: testCase.id,
          score: 0,
          threshold: testCase.confidenceThreshold,
          error: error.message,
          issues: [],
          criticalIssues: []
        });
      }
    }

    const suiteResult = this.analyzeSuiteResults(results, failures);
    const duration = Date.now() - startTime;
    
    console.log(`\n🏁 Test Suite Complete (${(duration / 1000).toFixed(1)}s)`);
    console.log(`📊 Overall Score: ${(suiteResult.overallScore * 100).toFixed(1)}%`);
    console.log(`✅ Pass Rate: ${(suiteResult.passRate * 100).toFixed(1)}% (${suiteResult.passed}/${suiteResult.totalTests})`);
    console.log(`❌ Failures: ${suiteResult.failed}`);
    console.log(`🚨 Recommendation: ${suiteResult.recommendation}`);

    await this.generateDetailedReport(suiteResult);
    
    return suiteResult;
  }

  async runCriticalTestsOnly(): Promise<AccuracySuiteResult> {
    console.log('⚡ Running critical test cases only...');
    
    const criticalTests = getCriticalTestCases();
    const results: AccuracyResult[] = [];
    const failures: TestFailure[] = [];

    for (const testCase of criticalTests) {
      console.log(`🎯 Critical Test: ${testCase.name}`);
      
      try {
        const result = await this.runSingleTest(testCase);
        results.push(result);
        
        if (!result.passedThreshold) {
          failures.push({
            testCaseId: testCase.id,
            score: result.overallScore,
            threshold: testCase.confidenceThreshold,
            issues: result.issues,
            criticalIssues: result.issues.filter(i => i.severity === 'critical')
          });
        }
        
      } catch (error) {
        failures.push({
          testCaseId: testCase.id,
          score: 0,
          threshold: testCase.confidenceThreshold,
          error: error.message,
          issues: [],
          criticalIssues: []
        });
      }
    }

    return this.analyzeSuiteResults(results, failures);
  }

  async runRegressionCheck(): Promise<{ hasRegressions: boolean; regressions: Regression[] }> {
    console.log('🔍 Checking for accuracy regressions...');
    
    const criticalTests = getCriticalTestCases();
    const regressions: Regression[] = [];

    for (const testCase of criticalTests) {
      try {
        const currentResult = await this.runSingleTest(testCase);
        const previousResult = this.baselineResults.get(testCase.id);
        
        if (previousResult) {
          const scoreDrop = previousResult.overallScore - currentResult.overallScore;
          
          if (scoreDrop > 0.05) { // 5% drop is considered a regression
            const impact = scoreDrop > 0.2 ? 'critical' : 
                          scoreDrop > 0.1 ? 'moderate' : 'minor';
            
            regressions.push({
              testCaseId: testCase.id,
              previousScore: previousResult.overallScore,
              currentScore: currentResult.overallScore,
              scoreDrop,
              impact
            });
            
            console.log(`📉 Regression detected in ${testCase.name}: ${(scoreDrop * 100).toFixed(1)}% drop`);
          }
        }
        
        // Update baseline
        this.baselineResults.set(testCase.id, currentResult);
        
      } catch (error) {
        console.error(`❌ Regression check failed for ${testCase.name}:`, error.message);
      }
    }

    const hasRegressions = regressions.length > 0;
    
    if (hasRegressions) {
      console.log(`🚨 Found ${regressions.length} accuracy regressions!`);
      const criticalRegressions = regressions.filter(r => r.impact === 'critical');
      if (criticalRegressions.length > 0) {
        console.log(`💥 ${criticalRegressions.length} CRITICAL regressions detected!`);
      }
    } else {
      console.log('✅ No accuracy regressions detected');
    }

    return { hasRegressions, regressions };
  }

  private async runSingleTest(testCase: AccuracyTestCase): Promise<AccuracyResult> {
    const startTime = Date.now();
    
    // Run extraction using our production system
    const extractionResult = await this.runExtraction(testCase);
    
    // Score the extraction against expected results
    const accuracyResult = await this.accuracyScorer.scoreExtraction(
      testCase,
      extractionResult.data,
      {
        ...extractionResult.metadata,
        responseTime: Date.now() - startTime
      }
    );

    return accuracyResult;
  }

  private async runExtraction(testCase: AccuracyTestCase): Promise<ExtractionResult> {
    try {
      // Fetch the HTML content
      const response = await fetch(testCase.url, {
        headers: {
          'User-Agent': 'AtlasCodex-AccuracyTest/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const htmlContent = await response.text();
      
      // Prepare extraction parameters
      const extractionParams = {
        url: testCase.url,
        extractionInstructions: testCase.extractionInstructions,
        outputSchema: this.generateSchemaFromExpected(testCase.expectedResults),
        formats: ['structured'],
        postProcessing: null
      };
      
      // Run through our production extraction system
      const result = await processWithPlanBasedSystem(htmlContent, extractionParams);
      
      if (!result.success) {
        throw new Error(result.error || 'Extraction failed');
      }
      
      return {
        data: result.data,
        metadata: {
          confidence: result.metadata?.confidence || 0.5,
          responseTime: result.metadata?.processingTime || 0,
          strategyUsed: result.metadata?.strategy || 'unknown',
          cost: result.metadata?.cost,
          tokensUsed: result.metadata?.tokensUsed
        }
      };
      
    } catch (error) {
      console.error(`Extraction failed for ${testCase.url}:`, error.message);
      throw new Error(`Extraction failed: ${error.message}`);
    }
  }

  private generateSchemaFromExpected(expectedResults: any): any {
    // Generate JSON schema from expected results structure
    if (Array.isArray(expectedResults.people)) {
      return {
        type: 'object',
        properties: {
          people: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                title: { type: 'string' },
                bio: { type: 'string' }
              },
              required: ['name']
            }
          }
        }
      };
    }
    
    if (Array.isArray(expectedResults.products)) {
      return {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                price: { type: 'number' },
                availability: { type: 'string' }
              },
              required: ['name']
            }
          }
        }
      };
    }
    
    // Generic schema generation
    return {
      type: 'object',
      properties: this.inferSchemaProperties(expectedResults)
    };
  }

  private inferSchemaProperties(obj: any): any {
    const properties: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        properties[key] = {
          type: 'array',
          items: value.length > 0 ? this.inferSchemaFromValue(value[0]) : {}
        };
      } else {
        properties[key] = this.inferSchemaFromValue(value);
      }
    }
    
    return properties;
  }

  private inferSchemaFromValue(value: any): any {
    if (typeof value === 'string') return { type: 'string' };
    if (typeof value === 'number') return { type: 'number' };
    if (typeof value === 'boolean') return { type: 'boolean' };
    if (typeof value === 'object' && value !== null) {
      return {
        type: 'object',
        properties: this.inferSchemaProperties(value)
      };
    }
    return {};
  }

  private analyzeSuiteResults(results: AccuracyResult[], failures: TestFailure[]): AccuracySuiteResult {
    const totalTests = results.length + failures.filter(f => f.error).length;
    const passed = results.filter(r => r.passedThreshold).length;
    const failed = failures.length;
    
    // Calculate overall score
    const overallScore = results.length > 0 
      ? results.reduce((sum, r) => sum + r.overallScore, 0) / results.length 
      : 0;
    
    const passRate = totalTests > 0 ? passed / totalTests : 0;
    
    // Analyze by category
    const categoryScores = this.calculateCategoryScores(results);
    
    // Identify common issues
    const commonIssues = this.identifyCommonIssues(results);
    
    // Check for regressions (if we have baseline data)
    const regressions = this.detectRegressions(results);
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(overallScore, passRate, failures, commonIssues);
    
    // Generate summary
    const summary = this.generateSummary(overallScore, passRate, passed, failed, commonIssues);

    return {
      timestamp: new Date().toISOString(),
      overallScore,
      passRate,
      totalTests,
      passed,
      failed,
      categoryScores,
      commonIssues,
      regressions,
      failures,
      results,
      recommendation,
      summary
    };
  }

  private calculateCategoryScores(results: AccuracyResult[]): Record<string, number> {
    const categoryMap = new Map<string, AccuracyResult[]>();
    
    // Group results by test category
    for (const result of results) {
      const testCase = ACCURACY_TEST_LIBRARY.find(t => t.id === result.testCaseId);
      if (testCase) {
        if (!categoryMap.has(testCase.category)) {
          categoryMap.set(testCase.category, []);
        }
        categoryMap.get(testCase.category)!.push(result);
      }
    }
    
    // Calculate average score per category
    const categoryScores: Record<string, number> = {};
    for (const [category, categoryResults] of categoryMap.entries()) {
      categoryScores[category] = categoryResults.reduce((sum, r) => sum + r.overallScore, 0) / categoryResults.length;
    }
    
    return categoryScores;
  }

  private identifyCommonIssues(results: AccuracyResult[]): IssuePattern[] {
    const issueMap = new Map<string, { count: number; tests: Set<string>; severity: 'critical' | 'warning' | 'info'; suggestions: Set<string> }>();
    
    for (const result of results) {
      for (const issue of result.issues) {
        const key = `${issue.type}:${issue.description}`;
        if (!issueMap.has(key)) {
          issueMap.set(key, { 
            count: 0, 
            tests: new Set(), 
            severity: issue.severity,
            suggestions: new Set()
          });
        }
        
        const issueData = issueMap.get(key)!;
        issueData.count++;
        issueData.tests.add(result.testCaseId);
        issueData.suggestions.add(issue.suggestion);
      }
    }
    
    return Array.from(issueMap.entries())
      .map(([key, data]) => ({
        issueType: key.split(':')[0],
        frequency: data.count,
        affectedTests: Array.from(data.tests),
        severity: data.severity,
        commonSuggestion: Array.from(data.suggestions)[0] // Take first suggestion
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  private detectRegressions(results: AccuracyResult[]): Regression[] {
    // This would compare against stored baseline results
    // For now, return empty array
    return [];
  }

  private generateRecommendation(
    overallScore: number, 
    passRate: number, 
    failures: TestFailure[], 
    commonIssues: IssuePattern[]
  ): 'PASS' | 'NEEDS_IMPROVEMENT' | 'CRITICAL_FAILURES' {
    const criticalFailures = failures.filter(f => f.criticalIssues.length > 0);
    const criticalIssues = commonIssues.filter(i => i.severity === 'critical');
    
    if (criticalFailures.length > 0 || criticalIssues.length > 0) {
      return 'CRITICAL_FAILURES';
    }
    
    if (overallScore < 0.9 || passRate < 0.85) {
      return 'NEEDS_IMPROVEMENT';
    }
    
    return 'PASS';
  }

  private generateSummary(
    overallScore: number,
    passRate: number, 
    passed: number,
    failed: number,
    commonIssues: IssuePattern[]
  ): string {
    const criticalIssues = commonIssues.filter(i => i.severity === 'critical');
    
    let summary = `Accuracy: ${(overallScore * 100).toFixed(1)}%, Pass Rate: ${(passRate * 100).toFixed(1)}% (${passed}/${passed + failed})`;
    
    if (criticalIssues.length > 0) {
      summary += `. CRITICAL: ${criticalIssues.length} critical issue patterns detected`;
    }
    
    if (failed > 0) {
      summary += `. ${failed} tests failed requirements`;
    }
    
    return summary;
  }

  private async generateDetailedReport(suiteResult: AccuracySuiteResult): Promise<void> {
    const reportPath = `/tmp/accuracy-report-${Date.now()}.json`;
    
    try {
      const fs = await import('fs');
      await fs.promises.writeFile(reportPath, JSON.stringify(suiteResult, null, 2));
      console.log(`📋 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.warn('⚠️ Could not save detailed report:', error.message);
    }
  }

  // Public method to load baseline results (for regression detection)
  async loadBaseline(baselineData: Record<string, AccuracyResult>): Promise<void> {
    this.baselineResults = new Map(Object.entries(baselineData));
    console.log(`📊 Loaded ${this.baselineResults.size} baseline results for regression detection`);
  }
}

export default AccuracyTestRunner;