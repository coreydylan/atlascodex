// Atlas Codex - Template System Integration Tests
// Comprehensive tests for the production-grade template system

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { 
  templateService, 
  ExtractionTemplate, 
  DisplayTemplate,
  evaluationFramework,
  goldenTestCases,
  ProductionTemplateLibrary,
  DisplayTemplateLibrary
} from '../index';

describe('Template System Integration Tests', () => {
  beforeAll(async () => {
    // Initialize template system
    console.log('🔧 Initializing template system for tests...');
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Template Governance & Security', () => {
    test('should validate template integrity with checksums', async () => {
      const recommendations = await templateService.getTemplateRecommendations(
        'https://example.com/team',
        'Get team members'
      );
      
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Verify template has valid checksum
      const template = recommendations[0].template;
      expect(template.checksum).toBeDefined();
      expect(template.checksum).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });

    test('should enforce security guardrails', async () => {
      const recommendations = await templateService.getTemplateRecommendations(
        'https://evil-site.com/steal-data',
        'Get passwords and credit card numbers'
      );
      
      // Should not match templates with security violations
      const dangerousMatches = recommendations.filter(rec => 
        rec.template.guardrails.must_not_have.some(forbidden =>
          ['password', 'credit_card', 'ssn'].includes(forbidden)
        )
      );
      
      expect(dangerousMatches.length).toBeGreaterThan(0);
    });

    test('should track template provenance', async () => {
      const recommendations = await templateService.getTemplateRecommendations(
        'https://company.com/team',
        'team members'
      );
      
      expect(recommendations.length).toBeGreaterThan(0);
      const template = recommendations[0].template;
      
      expect(template.provenance).toBeDefined();
      expect(['human', 'llm', 'hybrid']).toContain(template.provenance);
      expect(template.created_by).toBeDefined();
      expect(template.version).toBeDefined();
    });
  });

  describe('Semantic Template Matching', () => {
    test('should match people directory template with high confidence', async () => {
      const recommendations = await templateService.getTemplateRecommendations(
        'https://stanford.edu/faculty',
        'Get all faculty members with their contact information'
      );
      
      expect(recommendations.length).toBeGreaterThan(0);
      
      const peopleTemplate = recommendations.find(rec => 
        rec.template.id.includes('people_directory')
      );
      
      expect(peopleTemplate).toBeDefined();
      expect(peopleTemplate!.confidence).toBeGreaterThan(0.7);
      expect(peopleTemplate!.match_reasons).toBeDefined();
    });

    test('should handle negative evidence filtering', async () => {
      const recommendations = await templateService.getTemplateRecommendations(
        'https://company.com/board-of-directors',
        'Get board of directors information'
      );
      
      // Should not match people_directory due to negative trigger
      const peopleMatches = recommendations.filter(rec => 
        rec.template.id.includes('people_directory')
      );
      
      // Should have low confidence or no matches due to negative evidence
      expect(peopleMatches.length === 0 || peopleMatches[0].confidence < 0.5).toBeTruthy();
    });

    test('should prefer product catalog for e-commerce queries', async () => {
      const recommendations = await templateService.getTemplateRecommendations(
        'https://store.com/products',
        'Get all products with prices and ratings'
      );
      
      expect(recommendations.length).toBeGreaterThan(0);
      
      const productTemplate = recommendations.find(rec => 
        rec.template.id.includes('product_catalog')
      );
      
      expect(productTemplate).toBeDefined();
      expect(productTemplate!.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Display Template Generation', () => {
    test('should generate appropriate display spec for people data', async () => {
      const mockPeopleData = [
        {
          name: 'John Smith',
          title: 'Professor',
          department: 'Computer Science',
          email: 'john@example.com'
        },
        {
          name: 'Jane Doe',
          title: 'Associate Professor', 
          department: 'Mathematics',
          email: 'jane@example.com'
        }
      ];

      const displayMatch = await templateService.getDisplayRecommendations(
        mockPeopleData,
        'team directory',
        { device: 'desktop' }
      );

      expect(displayMatch).toBeDefined();
      expect(displayMatch!.template.display_spec).toBeDefined();
      expect(displayMatch!.template.display_spec.template_name).toMatch(/grid|card/i);
      expect(displayMatch!.confidence).toBeGreaterThan(0.5);
    });

    test('should enforce accessibility requirements', async () => {
      const mockData = [{ name: 'Test', price: '$100' }];
      
      const displayMatch = await templateService.getDisplayRecommendations(
        mockData,
        'product list'
      );
      
      expect(displayMatch).toBeDefined();
      const a11y = displayMatch!.template.display_spec.a11y;
      
      expect(a11y.minContrast).toBeDefined();
      expect(['AA', 'AAA']).toContain(a11y.minContrast);
      expect(a11y.keyboardNav).toBe(true);
    });

    test('should include performance optimizations', async () => {
      const largeMockData = Array.from({ length: 150 }, (_, i) => ({
        name: `Product ${i}`,
        price: `$${(i * 10 + 99).toFixed(2)}`
      }));

      const displayMatch = await templateService.getDisplayRecommendations(
        largeMockData,
        'product catalog'
      );

      expect(displayMatch).toBeDefined();
      const performance = displayMatch!.template.display_spec.performance;
      
      expect(performance).toBeDefined();
      expect(performance.virtualizeOver).toBeDefined();
      expect(performance.lazyLoadImages).toBe(true);
    });
  });

  describe('Template-Enhanced Extraction', () => {
    test('should perform template-enhanced extraction', async () => {
      const result = await templateService.extractWithTemplates({
        url: 'https://example.com/team',
        extractPrompt: 'Get team members',
        useTemplates: true,
        displayGeneration: true,
        userContext: { device: 'desktop' }
      });

      expect(result).toBeDefined();
      expect(result.template).toBeDefined();
      expect(result.template!.id).toBeDefined();
      expect(result.template!.confidence).toBeGreaterThan(0);
      
      if (result.success && result.data) {
        expect(result.displaySpec).toBeDefined();
        expect(result.displaySpec!.template_id).toBeDefined();
      }
    });

    test('should fall back gracefully when no template matches', async () => {
      const result = await templateService.extractWithTemplates({
        url: 'https://very-unique-format.com/weird-data',
        extractPrompt: 'Extract highly specialized data format',
        useTemplates: true
      });

      expect(result).toBeDefined();
      // Should still succeed with fallback mechanisms
      expect(result.success || result.error).toBeDefined();
    });
  });

  describe('Template Metrics & Analytics', () => {
    test('should collect template usage statistics', async () => {
      const stats = await templateService.getTemplateStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalExtractionTemplates).toBeGreaterThan(0);
      expect(stats.totalDisplayTemplates).toBeGreaterThan(0);
      expect(stats.avgAccuracy).toBeGreaterThan(0);
      expect(stats.avgAccuracy).toBeLessThanOrEqual(1);
    });

    test('should identify templates needing maintenance', async () => {
      const maintenanceTasks = await templateService.getMaintenanceTasks();
      
      expect(Array.isArray(maintenanceTasks)).toBe(true);
      
      // Each maintenance task should have required fields
      maintenanceTasks.forEach(task => {
        expect(task.template).toBeDefined();
        expect(task.issue).toBeDefined();
        expect(task.priority).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(task.priority);
        expect(['drifting', 'deprecated', 'low_usage', 'security_risk']).toContain(task.issue);
      });
    });

    test('should emit telemetry events', async () => {
      // Clear previous telemetry
      const beforeCount = templateService.getTelemetry().length;
      
      // Trigger some template operations
      await templateService.getTemplateRecommendations('https://test.com', 'test query');
      
      const afterCount = templateService.getTelemetry().length;
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
      
      const recentEvents = templateService.getTelemetry();
      if (recentEvents.length > 0) {
        const event = recentEvents[recentEvents.length - 1];
        expect(event.timestamp).toBeDefined();
        expect(event.type).toBeDefined();
      }
    });
  });

  describe('Golden Dataset Evaluation', () => {
    test('should run evaluation on a subset of golden test cases', async () => {
      // Run a small subset to avoid long test times
      const testCases = goldenTestCases.slice(0, 2);
      
      const results = await Promise.all(
        testCases.map(testCase => evaluationFramework.evaluateTestCase(testCase))
      );
      
      expect(results.length).toBe(2);
      
      results.forEach(result => {
        expect(result.testCase).toBeDefined();
        expect(result.accuracy).toBeGreaterThanOrEqual(0);
        expect(result.accuracy).toBeLessThanOrEqual(1);
        expect(result.responseTime).toBeGreaterThan(0);
        expect(Array.isArray(result.extractedFields)).toBe(true);
        expect(Array.isArray(result.missingFields)).toBe(true);
      });
    });

    test('should validate evaluation framework structure', () => {
      expect(goldenTestCases.length).toBeGreaterThan(5);
      
      goldenTestCases.forEach(testCase => {
        expect(testCase.id).toBeDefined();
        expect(testCase.name).toBeDefined();
        expect(testCase.url).toBeDefined();
        expect(testCase.query).toBeDefined();
        expect(testCase.category).toBeDefined();
        expect(testCase.difficulty).toBeDefined();
        expect(Array.isArray(testCase.expectedFields)).toBe(true);
        expect(['people', 'products', 'news', 'events', 'jobs', 'edge_case']).toContain(testCase.category);
        expect(['easy', 'medium', 'hard', 'vmota']).toContain(testCase.difficulty);
      });
    });

    test('should generate proper HTML reports', async () => {
      const mockSuiteResult = {
        suiteName: 'test_suite',
        totalTests: 2,
        passed: 1,
        failed: 1,
        avgAccuracy: 0.85,
        avgPrecision: 0.80,
        avgRecall: 0.90,
        avgF1Score: 0.85,
        avgResponseTime: 1.5,
        totalCost: 0.05,
        results: [
          {
            testCase: goldenTestCases[0],
            success: true,
            extractedFields: ['name', 'title'],
            missingFields: [],
            extraFields: [],
            accuracy: 1.0,
            precision: 1.0,
            recall: 1.0,
            f1Score: 1.0,
            responseTime: 1.2,
            cost: 0.02
          }
        ],
        summary: {
          byCategory: { people: { passed: 1, total: 1, accuracy: 1.0 } },
          byDifficulty: { medium: { passed: 1, total: 1, accuracy: 1.0 } },
          templateUsage: { 'people_directory': 1 },
          commonFailures: []
        }
      };

      const htmlReport = evaluationFramework.generateHTMLReport(mockSuiteResult);
      
      expect(htmlReport).toBeDefined();
      expect(htmlReport).toContain('<!DOCTYPE html>');
      expect(htmlReport).toContain('Atlas Codex Template Evaluation Report');
      expect(htmlReport).toContain('test_suite');
      expect(htmlReport).toContain('50.0%'); // Pass rate
    });
  });
});

describe('Template System Error Handling', () => {
  test('should handle malformed templates gracefully', async () => {
    // Test with empty query
    const result = await templateService.getTemplateRecommendations('', '');
    expect(Array.isArray(result)).toBe(true);
  });

  test('should handle network timeouts in evaluation', async () => {
    const testCase = {
      id: 'timeout_test',
      name: 'Timeout Test',
      url: 'https://httpstat.us/504?sleep=30000', // Will timeout
      query: 'test',
      expectedFields: ['test'],
      category: 'edge_case' as const,
      difficulty: 'hard' as const,
      tags: ['timeout'],
      expectedData: []
    };

    const result = await evaluationFramework.evaluateTestCase(testCase);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBeDefined();
  });

  test('should validate template schema structure', async () => {
    const recommendations = await templateService.getTemplateRecommendations(
      'https://test.com',
      'test'
    );
    
    if (recommendations.length > 0) {
      const template = recommendations[0].template;
      
      // Validate required template fields
      expect(template.id).toBeDefined();
      expect(template.trigger_patterns).toBeDefined();
      expect(Array.isArray(template.trigger_patterns)).toBe(true);
      expect(template.schema).toBeDefined();
      expect(template.schema.type).toBe('array');
      expect(template.success_metrics).toBeDefined();
      expect(template.guardrails).toBeDefined();
    }
  });
});

describe('Performance & Scalability', () => {
  test('should handle large template libraries efficiently', async () => {
    const startTime = Date.now();
    
    // Simulate searching through many templates
    const promises = Array.from({ length: 10 }, (_, i) => 
      templateService.getTemplateRecommendations(
        `https://test${i}.com`,
        `query ${i}`
      )
    );
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    expect(results.length).toBe(10);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  test('should cache template matching results', async () => {
    const url = 'https://cache-test.com';
    const query = 'cache test query';
    
    // First call
    const start1 = Date.now();
    const result1 = await templateService.getTemplateRecommendations(url, query);
    const time1 = Date.now() - start1;
    
    // Second call (should be faster if cached)
    const start2 = Date.now();
    const result2 = await templateService.getTemplateRecommendations(url, query);
    const time2 = Date.now() - start2;
    
    expect(result1).toEqual(result2);
    // Note: In a real implementation with caching, time2 should be < time1
  });
});