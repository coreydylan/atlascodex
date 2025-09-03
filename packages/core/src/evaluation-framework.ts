// Atlas Codex - Golden Dataset Evaluation Framework
// Comprehensive testing and validation system for template quality

import { ExtractionTemplate, DisplayTemplate, TelemetryEvent, createTelemetryEvent } from './template-types';
import { templateService } from './template-service';

// Test case definition
export interface TestCase {
  id: string;
  name: string;
  url: string;
  query: string;
  expectedTemplate?: string;
  expectedData: any;
  expectedFields: string[];
  category: 'people' | 'products' | 'news' | 'events' | 'jobs' | 'edge_case';
  difficulty: 'easy' | 'medium' | 'hard' | 'vmota'; // VMOTA = very hard edge cases
  tags: string[];
}

// Evaluation result
export interface EvaluationResult {
  testCase: TestCase;
  success: boolean;
  templateUsed?: string;
  templateConfidence?: number;
  extractedFields: string[];
  missingFields: string[];
  extraFields: string[];
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  responseTime: number;
  cost: number;
  errorMessage?: string;
}

// Suite evaluation result
export interface SuiteResult {
  suiteName: string;
  totalTests: number;
  passed: number;
  failed: number;
  avgAccuracy: number;
  avgPrecision: number;
  avgRecall: number;
  avgF1Score: number;
  avgResponseTime: number;
  totalCost: number;
  results: EvaluationResult[];
  summary: {
    byCategory: Record<string, { passed: number; total: number; accuracy: number }>;
    byDifficulty: Record<string, { passed: number; total: number; accuracy: number }>;
    templateUsage: Record<string, number>;
    commonFailures: string[];
  };
}

// Golden dataset for comprehensive testing
export const goldenTestCases: TestCase[] = [
  // People Directory Tests
  {
    id: 'stanford_faculty',
    name: 'Stanford CS Faculty Directory',
    url: 'https://cs.stanford.edu/directory/faculty',
    query: 'Get all faculty members with their details',
    expectedTemplate: 'people_directory_v1_0_0',
    expectedData: [
      {
        name: 'John Smith',
        title: 'Professor',
        department: 'Computer Science',
        email: 'jsmith@stanford.edu'
      }
    ],
    expectedFields: ['name', 'title', 'department', 'email'],
    category: 'people',
    difficulty: 'medium',
    tags: ['university', 'faculty', 'academic']
  },

  {
    id: 'company_team',
    name: 'Company Team Page',
    url: 'https://example-startup.com/team',
    query: 'Extract team members and their roles',
    expectedTemplate: 'people_directory_v1_0_0',
    expectedData: [
      {
        name: 'Sarah Johnson',
        title: 'CEO',
        bio: 'Former Google engineer',
        photo_url: 'https://example.com/sarah.jpg'
      }
    ],
    expectedFields: ['name', 'title', 'bio'],
    category: 'people',
    difficulty: 'easy',
    tags: ['company', 'startup', 'team']
  },

  // Product Catalog Tests  
  {
    id: 'amazon_products',
    name: 'Amazon Product Listing',
    url: 'https://amazon.com/s?k=laptops',
    query: 'Get product listings with prices and ratings',
    expectedTemplate: 'product_catalog_v1_0_0',
    expectedData: [
      {
        name: 'MacBook Pro',
        price: '$1,299.00',
        rating: '4.5',
        image_url: 'https://example.com/macbook.jpg'
      }
    ],
    expectedFields: ['name', 'price', 'rating'],
    category: 'products',
    difficulty: 'hard',
    tags: ['ecommerce', 'amazon', 'dynamic']
  },

  // News Articles Tests
  {
    id: 'tech_news',
    name: 'TechCrunch Articles',
    url: 'https://techcrunch.com',
    query: 'Extract latest news articles',
    expectedTemplate: 'news_articles_v1_0_0',
    expectedData: [
      {
        title: 'AI Breakthrough in 2024',
        author: 'Jane Doe',
        published_date: '2024-01-15',
        category: 'AI'
      }
    ],
    expectedFields: ['title', 'author', 'published_date'],
    category: 'news',
    difficulty: 'medium',
    tags: ['news', 'technology', 'blog']
  },

  // Edge Cases (VMOTA - Very Hard)
  {
    id: 'dynamic_spa',
    name: 'React SPA with Dynamic Content',
    url: 'https://vmota-test.vercel.app/dynamic-staff',
    query: 'Extract staff from dynamically loaded content',
    expectedTemplate: 'people_directory_v1_0_0',
    expectedData: [
      {
        name: 'Dynamic User',
        title: 'Software Engineer',
        department: 'Engineering'
      }
    ],
    expectedFields: ['name', 'title'],
    category: 'people',
    difficulty: 'vmota',
    tags: ['spa', 'dynamic', 'javascript', 'vmota']
  },

  {
    id: 'infinite_scroll',
    name: 'Infinite Scroll Product List',
    url: 'https://vmota-test.vercel.app/infinite-products',
    query: 'Extract products from infinite scroll',
    expectedTemplate: 'product_catalog_v1_0_0',
    expectedData: [
      {
        name: 'Product 1',
        price: '$99.99',
        availability: 'In Stock'
      }
    ],
    expectedFields: ['name', 'price'],
    category: 'products',
    difficulty: 'vmota',
    tags: ['infinite_scroll', 'dynamic', 'vmota']
  },

  // Template Edge Cases
  {
    id: 'mixed_content',
    name: 'Mixed Content Page',
    url: 'https://example.com/mixed-content',
    query: 'Extract mixed content that could match multiple templates',
    expectedData: [
      {
        title: 'Mixed Content',
        content: 'Complex content structure'
      }
    ],
    expectedFields: ['title', 'content'],
    category: 'edge_case',
    difficulty: 'hard',
    tags: ['ambiguous', 'multiple_patterns']
  },

  {
    id: 'no_template_match',
    name: 'Highly Specific Content',
    url: 'https://example.com/unique-format',
    query: 'Extract data from unique format with no template match',
    expectedData: [
      {
        title: 'Unique Content',
        metadata: 'Special format'
      }
    ],
    expectedFields: ['title'],
    category: 'edge_case',
    difficulty: 'vmota',
    tags: ['fallback', 'unique', 'no_template']
  }
];

// Evaluation framework
export class EvaluationFramework {
  private telemetryEvents: TelemetryEvent[] = [];

  /**
   * Run evaluation on a single test case
   */
  async evaluateTestCase(testCase: TestCase): Promise<EvaluationResult> {
    const startTime = Date.now();
    
    try {
      // Run extraction with templates
      const result = await templateService.extractWithTemplates({
        url: testCase.url,
        extractPrompt: testCase.query,
        useTemplates: true,
        displayGeneration: false
      });

      const responseTime = (Date.now() - startTime) / 1000;
      
      if (!result.success) {
        return {
          testCase,
          success: false,
          extractedFields: [],
          missingFields: testCase.expectedFields,
          extraFields: [],
          accuracy: 0,
          precision: 0,
          recall: 0,
          f1Score: 0,
          responseTime,
          cost: result.metadata.cost,
          errorMessage: result.error
        };
      }

      // Analyze extracted data
      const extractedFields = this.extractFieldNames(result.data);
      const missingFields = testCase.expectedFields.filter(f => !extractedFields.includes(f));
      const extraFields = extractedFields.filter(f => !testCase.expectedFields.includes(f));

      // Calculate metrics
      const precision = extractedFields.length > 0 ? 
        (extractedFields.length - extraFields.length) / extractedFields.length : 0;
      const recall = testCase.expectedFields.length > 0 ? 
        (testCase.expectedFields.length - missingFields.length) / testCase.expectedFields.length : 0;
      const f1Score = precision + recall > 0 ? 
        2 * (precision * recall) / (precision + recall) : 0;
      const accuracy = Math.max(0, 1 - (missingFields.length + extraFields.length) / testCase.expectedFields.length);

      return {
        testCase,
        success: missingFields.length === 0,
        templateUsed: result.template?.id,
        templateConfidence: result.template?.confidence,
        extractedFields,
        missingFields,
        extraFields,
        accuracy,
        precision,
        recall,
        f1Score,
        responseTime,
        cost: result.metadata.cost
      };

    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      return {
        testCase,
        success: false,
        extractedFields: [],
        missingFields: testCase.expectedFields,
        extraFields: [],
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        responseTime,
        cost: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Run evaluation on a test suite
   */
  async evaluateSuite(suiteName: string, testCases: TestCase[]): Promise<SuiteResult> {
    console.log(`🧪 Running evaluation suite: ${suiteName}`);
    console.log(`📊 Test cases: ${testCases.length}`);
    
    const results: EvaluationResult[] = [];
    
    for (const testCase of testCases) {
      console.log(`⏳ Running test: ${testCase.name}`);
      const result = await this.evaluateTestCase(testCase);
      results.push(result);
      
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${testCase.name}: ${(result.accuracy * 100).toFixed(1)}% accuracy`);
    }

    // Calculate suite metrics
    const passed = results.filter(r => r.success).length;
    const failed = results.length - passed;
    const avgAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
    const avgPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
    const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
    const avgF1Score = results.reduce((sum, r) => sum + r.f1Score, 0) / results.length;
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

    // Generate summary analytics
    const summary = this.generateSummary(results);

    return {
      suiteName,
      totalTests: results.length,
      passed,
      failed,
      avgAccuracy,
      avgPrecision,
      avgRecall,
      avgF1Score,
      avgResponseTime,
      totalCost,
      results,
      summary
    };
  }

  /**
   * Run the core template validation suite
   */
  async runCoreTemplateSuite(): Promise<SuiteResult> {
    return await this.evaluateSuite('core_templates_v1', goldenTestCases);
  }

  /**
   * Run VMOTA (Very Hard) test cases only
   */
  async runVMOTASuite(): Promise<SuiteResult> {
    const vmotaCases = goldenTestCases.filter(tc => tc.difficulty === 'vmota');
    return await this.evaluateSuite('vmota_edge_cases', vmotaCases);
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(suiteResult: SuiteResult): string {
    const { suiteName, totalTests, passed, failed, avgAccuracy, results } = suiteResult;
    
    const passRate = (passed / totalTests * 100).toFixed(1);
    const accuracyPercent = (avgAccuracy * 100).toFixed(1);
    
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Atlas Codex Template Evaluation Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #e1e5e9; padding-bottom: 20px; margin-bottom: 30px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #0366d6; }
        .metric-label { color: #586069; margin-top: 5px; }
        .test-results { margin-top: 30px; }
        .test-case { border: 1px solid #e1e5e9; border-radius: 8px; margin-bottom: 15px; padding: 20px; }
        .test-case.passed { border-left: 4px solid #28a745; }
        .test-case.failed { border-left: 4px solid #dc3545; }
        .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .test-name { font-weight: bold; font-size: 1.1em; }
        .test-status { padding: 4px 12px; border-radius: 4px; color: white; font-size: 0.9em; }
        .test-status.passed { background-color: #28a745; }
        .test-status.failed { background-color: #dc3545; }
        .test-details { color: #586069; font-size: 0.9em; }
        .test-metrics { display: flex; gap: 20px; margin-top: 10px; }
        .test-metric { font-size: 0.8em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Atlas Codex Template Evaluation Report</h1>
        <h2>${suiteName}</h2>
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="metrics">
        <div class="metric">
            <div class="metric-value">${passRate}%</div>
            <div class="metric-label">Pass Rate</div>
        </div>
        <div class="metric">
            <div class="metric-value">${accuracyPercent}%</div>
            <div class="metric-label">Avg Accuracy</div>
        </div>
        <div class="metric">
            <div class="metric-value">${passed}/${totalTests}</div>
            <div class="metric-label">Tests Passed</div>
        </div>
        <div class="metric">
            <div class="metric-value">$${suiteResult.totalCost.toFixed(3)}</div>
            <div class="metric-label">Total Cost</div>
        </div>
    </div>
    
    <div class="test-results">
        <h3>Test Results</h3>
        ${results.map(result => `
        <div class="test-case ${result.success ? 'passed' : 'failed'}">
            <div class="test-header">
                <div class="test-name">${result.testCase.name}</div>
                <div class="test-status ${result.success ? 'passed' : 'failed'}">
                    ${result.success ? 'PASSED' : 'FAILED'}
                </div>
            </div>
            <div class="test-details">
                <strong>URL:</strong> ${result.testCase.url}<br>
                <strong>Query:</strong> ${result.testCase.query}<br>
                <strong>Category:</strong> ${result.testCase.category} | 
                <strong>Difficulty:</strong> ${result.testCase.difficulty}
                ${result.templateUsed ? `<br><strong>Template Used:</strong> ${result.templateUsed} (${(result.templateConfidence! * 100).toFixed(1)}% confidence)` : ''}
                ${result.errorMessage ? `<br><strong>Error:</strong> ${result.errorMessage}` : ''}
            </div>
            <div class="test-metrics">
                <div class="test-metric"><strong>Accuracy:</strong> ${(result.accuracy * 100).toFixed(1)}%</div>
                <div class="test-metric"><strong>Precision:</strong> ${(result.precision * 100).toFixed(1)}%</div>
                <div class="test-metric"><strong>Recall:</strong> ${(result.recall * 100).toFixed(1)}%</div>
                <div class="test-metric"><strong>Response Time:</strong> ${result.responseTime.toFixed(2)}s</div>
                <div class="test-metric"><strong>Cost:</strong> $${result.cost.toFixed(4)}</div>
            </div>
            ${result.missingFields.length > 0 ? `
            <div style="margin-top: 10px; color: #dc3545; font-size: 0.9em;">
                <strong>Missing Fields:</strong> ${result.missingFields.join(', ')}
            </div>
            ` : ''}
        </div>
        `).join('')}
    </div>
</body>
</html>`;
    
    return html;
  }

  /**
   * Extract field names from extracted data
   */
  private extractFieldNames(data: any): string[] {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    
    const sample = data[0];
    if (typeof sample !== 'object') return [];
    
    return Object.keys(sample);
  }

  /**
   * Generate summary analytics
   */
  private generateSummary(results: EvaluationResult[]) {
    const byCategory: Record<string, { passed: number; total: number; accuracy: number }> = {};
    const byDifficulty: Record<string, { passed: number; total: number; accuracy: number }> = {};
    const templateUsage: Record<string, number> = {};
    const commonFailures: string[] = [];

    for (const result of results) {
      // By category
      const category = result.testCase.category;
      if (!byCategory[category]) {
        byCategory[category] = { passed: 0, total: 0, accuracy: 0 };
      }
      byCategory[category].total++;
      byCategory[category].accuracy += result.accuracy;
      if (result.success) byCategory[category].passed++;

      // By difficulty
      const difficulty = result.testCase.difficulty;
      if (!byDifficulty[difficulty]) {
        byDifficulty[difficulty] = { passed: 0, total: 0, accuracy: 0 };
      }
      byDifficulty[difficulty].total++;
      byDifficulty[difficulty].accuracy += result.accuracy;
      if (result.success) byDifficulty[difficulty].passed++;

      // Template usage
      if (result.templateUsed) {
        templateUsage[result.templateUsed] = (templateUsage[result.templateUsed] || 0) + 1;
      }

      // Common failures
      if (!result.success && result.errorMessage) {
        commonFailures.push(result.errorMessage);
      }
    }

    // Calculate averages
    Object.values(byCategory).forEach(cat => {
      cat.accuracy = cat.accuracy / cat.total;
    });
    Object.values(byDifficulty).forEach(diff => {
      diff.accuracy = diff.accuracy / diff.total;
    });

    return {
      byCategory,
      byDifficulty,
      templateUsage,
      commonFailures: [...new Set(commonFailures)]
    };
  }
}

// Export singleton
export const evaluationFramework = new EvaluationFramework();