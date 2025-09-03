// Atlas Codex: Comprehensive Accuracy Scoring System
// Measures extraction accuracy against ground truth with detailed analysis

import crypto from 'crypto';
import { AccuracyTestCase } from './test-cases';

export interface AccuracyResult {
  testCaseId: string;
  timestamp: string;
  overallScore: number; // 0-1
  passedThreshold: boolean;
  fieldScores: Record<string, FieldScore>;
  issues: AccuracyIssue[];
  extractionMetadata: ExtractionMetadata;
  recommendations: string[];
}

export interface FieldScore {
  field: string;
  expected: any;
  actual: any;
  score: number; // 0-1
  scoreType: 'exact_match' | 'semantic_match' | 'partial_match' | 'missing' | 'extra' | 'type_mismatch';
  explanation: string;
  weight: number; // Importance of this field (0-1)
}

export interface AccuracyIssue {
  type: 'duplication' | 'aggregate_block' | 'missing_required' | 'low_confidence' | 'type_mismatch' | 'semantic_error' | 'structural_error';
  severity: 'critical' | 'warning' | 'info';
  field?: string;
  description: string;
  impact: string;
  suggestion: string;
  evidence?: any;
}

export interface ExtractionMetadata {
  responseTime: number;
  strategyUsed: string;
  confidence: number;
  tokensUsed?: number;
  cost?: number;
}

export class AccuracyScorer {
  private semanticSimilarityCache = new Map<string, number>();

  async scoreExtraction(
    testCase: AccuracyTestCase,
    actualResults: any,
    extractionMetadata: ExtractionMetadata
  ): Promise<AccuracyResult> {
    console.log(`🎯 Scoring accuracy for test: ${testCase.name}`);
    
    const fieldScores: Record<string, FieldScore> = {};
    const issues: AccuracyIssue[] = [];
    
    // Step 1: Score individual fields
    const flatExpected = this.flattenObject(testCase.expectedResults);
    const flatActual = this.flattenObject(actualResults);
    
    for (const [fieldPath, expectedValue] of Object.entries(flatExpected)) {
      const actualValue = this.getValueByPath(actualResults, fieldPath);
      const fieldScore = await this.scoreField(fieldPath, expectedValue, actualValue, testCase);
      fieldScores[fieldPath] = fieldScore;
      
      // Generate issues for poor field scores
      if (fieldScore.score < 0.8) {
        issues.push(this.createFieldIssue(fieldScore, testCase));
      }
    }
    
    // Step 2: Detect structural and semantic issues
    const structuralIssues = await this.detectStructuralIssues(actualResults, testCase);
    issues.push(...structuralIssues);
    
    // Step 3: Calculate overall score with weighted fields
    const overallScore = this.calculateOverallScore(fieldScores);
    
    // Step 4: Generate recommendations
    const recommendations = this.generateRecommendations(issues, fieldScores, testCase);
    
    const result: AccuracyResult = {
      testCaseId: testCase.id,
      timestamp: new Date().toISOString(),
      overallScore,
      passedThreshold: overallScore >= testCase.confidenceThreshold,
      fieldScores,
      issues,
      extractionMetadata,
      recommendations
    };
    
    console.log(`  Overall Score: ${(overallScore * 100).toFixed(1)}% (threshold: ${(testCase.confidenceThreshold * 100).toFixed(1)}%)`);
    console.log(`  Issues Found: ${issues.length} (${issues.filter(i => i.severity === 'critical').length} critical)`);
    
    return result;
  }

  private async scoreField(
    fieldPath: string, 
    expected: any, 
    actual: any, 
    testCase: AccuracyTestCase
  ): Promise<FieldScore> {
    const weight = this.calculateFieldWeight(fieldPath, testCase);
    
    // Missing field
    if (actual === undefined || actual === null) {
      return {
        field: fieldPath,
        expected,
        actual,
        score: 0,
        scoreType: 'missing',
        explanation: 'Field is missing from extraction results',
        weight
      };
    }
    
    // Exact match (perfect score)
    if (this.isExactMatch(expected, actual)) {
      return {
        field: fieldPath,
        expected,
        actual,
        score: 1.0,
        scoreType: 'exact_match',
        explanation: 'Perfect exact match',
        weight
      };
    }
    
    // Type mismatch
    if (typeof expected !== typeof actual && !this.isAcceptableTypeCoercion(expected, actual)) {
      return {
        field: fieldPath,
        expected,
        actual,
        score: 0.1,
        scoreType: 'type_mismatch',
        explanation: `Type mismatch: expected ${typeof expected}, got ${typeof actual}`,
        weight
      };
    }
    
    // String comparison with semantic similarity
    if (typeof expected === 'string' && typeof actual === 'string') {
      const similarity = await this.calculateSemanticSimilarity(expected, actual);
      return {
        field: fieldPath,
        expected,
        actual,
        score: similarity,
        scoreType: similarity > 0.8 ? 'semantic_match' : 'partial_match',
        explanation: `Semantic similarity: ${(similarity * 100).toFixed(1)}%`,
        weight
      };
    }
    
    // Number comparison with tolerance
    if (typeof expected === 'number' && typeof actual === 'number') {
      const tolerance = this.getNumberTolerance(fieldPath);
      const diff = Math.abs(expected - actual) / Math.max(Math.abs(expected), 1);
      const score = Math.max(0, 1 - (diff / tolerance));
      
      return {
        field: fieldPath,
        expected,
        actual,
        score,
        scoreType: score > 0.95 ? 'exact_match' : 'partial_match',
        explanation: `Numeric difference: ${(diff * 100).toFixed(2)}% (tolerance: ${(tolerance * 100).toFixed(2)}%)`,
        weight
      };
    }
    
    // Array comparison (for lists of people, products, etc.)
    if (Array.isArray(expected) && Array.isArray(actual)) {
      return await this.scoreArrayField(fieldPath, expected, actual, testCase);
    }
    
    // Object comparison
    if (typeof expected === 'object' && typeof actual === 'object') {
      return await this.scoreObjectField(fieldPath, expected, actual, testCase);
    }
    
    // Fallback partial match
    return {
      field: fieldPath,
      expected,
      actual,
      score: 0.3,
      scoreType: 'partial_match',
      explanation: 'Partial match - different formats but potentially valid',
      weight
    };
  }

  private async scoreArrayField(
    fieldPath: string,
    expected: any[],
    actual: any[],
    testCase: AccuracyTestCase
  ): Promise<FieldScore> {
    if (expected.length === 0 && actual.length === 0) {
      return {
        field: fieldPath,
        expected,
        actual,
        score: 1.0,
        scoreType: 'exact_match',
        explanation: 'Both arrays are empty',
        weight: this.calculateFieldWeight(fieldPath, testCase)
      };
    }
    
    // For people/entity arrays, use semantic matching
    if (this.isEntityArray(expected)) {
      return await this.scoreEntityArray(fieldPath, expected, actual, testCase);
    }
    
    // For simple arrays, use set comparison
    const expectedSet = new Set(expected.map(item => JSON.stringify(item)));
    const actualSet = new Set(actual.map(item => JSON.stringify(item)));
    
    const intersection = new Set([...expectedSet].filter(x => actualSet.has(x)));
    const union = new Set([...expectedSet, ...actualSet]);
    
    const jaccardScore = union.size > 0 ? intersection.size / union.size : 1.0;
    
    return {
      field: fieldPath,
      expected,
      actual,
      score: jaccardScore,
      scoreType: jaccardScore > 0.9 ? 'semantic_match' : 'partial_match',
      explanation: `Array similarity (Jaccard): ${(jaccardScore * 100).toFixed(1)}%`,
      weight: this.calculateFieldWeight(fieldPath, testCase)
    };
  }

  private async scoreEntityArray(
    fieldPath: string,
    expected: any[],
    actual: any[],
    testCase: AccuracyTestCase
  ): Promise<FieldScore> {
    const weight = this.calculateFieldWeight(fieldPath, testCase);
    
    // Special handling for people arrays
    if (fieldPath.includes('people') && testCase.category === 'team_members') {
      return await this.scorePeopleArray(fieldPath, expected, actual, weight);
    }
    
    // General entity array scoring
    let totalScore = 0;
    let matchedEntities = 0;
    
    for (const expectedEntity of expected) {
      let bestMatch = 0;
      
      for (const actualEntity of actual) {
        const entitySimilarity = await this.calculateEntitySimilarity(expectedEntity, actualEntity);
        bestMatch = Math.max(bestMatch, entitySimilarity);
      }
      
      totalScore += bestMatch;
      if (bestMatch > 0.7) matchedEntities++;
    }
    
    const avgScore = expected.length > 0 ? totalScore / expected.length : 1.0;
    
    // Penalize extra entities (potential duplicates or false positives)
    const extraPenalty = actual.length > expected.length ? 
      Math.min(0.3, (actual.length - expected.length) / expected.length) : 0;
    
    const finalScore = Math.max(0, avgScore - extraPenalty);
    
    return {
      field: fieldPath,
      expected,
      actual,
      score: finalScore,
      scoreType: finalScore > 0.8 ? 'semantic_match' : 'partial_match',
      explanation: `Entity matching: ${matchedEntities}/${expected.length} matched, ${actual.length - expected.length} extra`,
      weight
    };
  }

  private async scorePeopleArray(
    fieldPath: string,
    expected: any[],
    actual: any[],
    weight: number
  ): Promise<FieldScore> {
    // Critical people array scoring with duplicate detection
    const duplicates = this.findDuplicatePeople(actual);
    const aggregateBlocks = this.findAggregateBlocks(actual);
    
    let baseScore = 0;
    let matchedPeople = 0;
    
    // Score individual person matches
    for (const expectedPerson of expected) {
      let bestMatch = 0;
      
      for (const actualPerson of actual) {
        if (this.isAggregatePerson(actualPerson)) continue; // Skip aggregate blocks
        
        const personSimilarity = await this.calculatePersonSimilarity(expectedPerson, actualPerson);
        bestMatch = Math.max(bestMatch, personSimilarity);
      }
      
      baseScore += bestMatch;
      if (bestMatch > 0.7) matchedPeople++;
    }
    
    const avgScore = expected.length > 0 ? baseScore / expected.length : 1.0;
    
    // Apply penalties
    let finalScore = avgScore;
    
    // Heavy penalty for duplicates (critical issue)
    if (duplicates.length > 0) {
      finalScore *= Math.max(0.1, 1 - (duplicates.length / actual.length));
    }
    
    // Heavy penalty for aggregate blocks (critical issue)  
    if (aggregateBlocks.length > 0) {
      finalScore *= Math.max(0.2, 1 - (aggregateBlocks.length / actual.length));
    }
    
    // Moderate penalty for excess people
    const excessPeople = Math.max(0, actual.length - expected.length - duplicates.length - aggregateBlocks.length);
    if (excessPeople > 0) {
      finalScore *= Math.max(0.7, 1 - (excessPeople / expected.length * 0.3));
    }
    
    return {
      field: fieldPath,
      expected,
      actual,
      score: Math.max(0, finalScore),
      scoreType: finalScore > 0.8 ? 'semantic_match' : 'partial_match',
      explanation: `People: ${matchedPeople}/${expected.length} matched, ${duplicates.length} duplicates, ${aggregateBlocks.length} aggregate blocks`,
      weight
    };
  }

  // ========================================
  // ISSUE DETECTION
  // ========================================

  private async detectStructuralIssues(results: any, testCase: AccuracyTestCase): Promise<AccuracyIssue[]> {
    const issues: AccuracyIssue[] = [];
    
    // Team member specific issues
    if (testCase.category === 'team_members' && results.people) {
      issues.push(...await this.detectTeamMemberIssues(results.people));
    }
    
    // Product specific issues
    if (testCase.category === 'products' && results.products) {
      issues.push(...await this.detectProductIssues(results.products));
    }
    
    // General confidence issues
    if (results.metadata?.confidence && results.metadata.confidence < testCase.confidenceThreshold) {
      issues.push({
        type: 'low_confidence',
        severity: 'warning',
        description: `Extraction confidence ${results.metadata.confidence} below threshold ${testCase.confidenceThreshold}`,
        impact: 'May indicate extraction uncertainty',
        suggestion: 'Review extraction strategy or content complexity'
      });
    }
    
    return issues;
  }

  private async detectTeamMemberIssues(people: any[]): Promise<AccuracyIssue[]> {
    const issues: AccuracyIssue[] = [];
    
    // Detect duplicates
    const duplicates = this.findDuplicatePeople(people);
    if (duplicates.length > 0) {
      issues.push({
        type: 'duplication',
        severity: 'critical',
        description: `Found ${duplicates.length} duplicate people`,
        impact: 'Reduces data quality and user trust',
        suggestion: 'Improve deduplication algorithm with semantic similarity',
        evidence: duplicates
      });
    }
    
    // Detect aggregate blocks
    const aggregateBlocks = this.findAggregateBlocks(people);
    if (aggregateBlocks.length > 0) {
      issues.push({
        type: 'aggregate_block',
        severity: 'critical',
        description: `Found ${aggregateBlocks.length} aggregate blocks extracted as people`,
        impact: 'Fundamentally incorrect extraction - not individual people',
        suggestion: 'Enhance person vs aggregate detection in extraction prompts',
        evidence: aggregateBlocks
      });
    }
    
    // Detect incomplete people (missing required fields)
    const incompletePeople = people.filter(person => !person.name || person.name.length < 3);
    if (incompletePeople.length > 0) {
      issues.push({
        type: 'missing_required',
        severity: 'warning',
        description: `Found ${incompletePeople.length} people with missing or invalid names`,
        impact: 'Extracted entities may not be valid people',
        suggestion: 'Improve name extraction and validation',
        evidence: incompletePeople
      });
    }
    
    return issues;
  }

  private async detectProductIssues(products: any[]): Promise<AccuracyIssue[]> {
    const issues: AccuracyIssue[] = [];
    
    // Detect products with invalid prices
    const invalidPrices = products.filter(product => 
      product.price !== null && (typeof product.price !== 'number' || product.price <= 0)
    );
    
    if (invalidPrices.length > 0) {
      issues.push({
        type: 'structural_error',
        severity: 'warning',
        description: `Found ${invalidPrices.length} products with invalid prices`,
        impact: 'Price information may be unreliable',
        suggestion: 'Improve price parsing and validation',
        evidence: invalidPrices
      });
    }
    
    return issues;
  }

  // ========================================
  // SIMILARITY CALCULATIONS
  // ========================================

  private async calculateSemanticSimilarity(text1: string, text2: string): Promise<number> {
    const cacheKey = `${text1}|${text2}`;
    if (this.semanticSimilarityCache.has(cacheKey)) {
      return this.semanticSimilarityCache.get(cacheKey)!;
    }
    
    // Normalize texts
    const norm1 = this.normalizeText(text1);
    const norm2 = this.normalizeText(text2);
    
    // Exact match after normalization
    if (norm1 === norm2) {
      this.semanticSimilarityCache.set(cacheKey, 1.0);
      return 1.0;
    }
    
    // Simple similarity measures (can be enhanced with ML models)
    const levenshteinSimilarity = this.calculateLevenshteinSimilarity(norm1, norm2);
    const jaccardSimilarity = this.calculateJaccardSimilarity(norm1, norm2);
    
    // Combined score
    const similarity = (levenshteinSimilarity * 0.7) + (jaccardSimilarity * 0.3);
    
    this.semanticSimilarityCache.set(cacheKey, similarity);
    return similarity;
  }

  private async calculatePersonSimilarity(person1: any, person2: any): Promise<number> {
    let totalScore = 0;
    let weightSum = 0;
    
    // Name similarity (highest weight)
    if (person1.name && person2.name) {
      const nameSimilarity = await this.calculateSemanticSimilarity(person1.name, person2.name);
      totalScore += nameSimilarity * 0.6;
      weightSum += 0.6;
    }
    
    // Title similarity (medium weight)
    if (person1.title && person2.title) {
      const titleSimilarity = await this.calculateSemanticSimilarity(person1.title, person2.title);
      totalScore += titleSimilarity * 0.3;
      weightSum += 0.3;
    }
    
    // Bio similarity (lower weight)
    if (person1.bio && person2.bio) {
      const bioSimilarity = await this.calculateSemanticSimilarity(person1.bio, person2.bio);
      totalScore += bioSimilarity * 0.1;
      weightSum += 0.1;
    }
    
    return weightSum > 0 ? totalScore / weightSum : 0;
  }

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================

  private findDuplicatePeople(people: any[]): any[] {
    const duplicates: any[] = [];
    const seen = new Set<string>();
    
    for (const person of people) {
      if (!person.name) continue;
      
      const normalizedName = this.normalizeText(person.name);
      if (seen.has(normalizedName)) {
        duplicates.push(person);
      } else {
        seen.add(normalizedName);
      }
    }
    
    return duplicates;
  }

  private findAggregateBlocks(people: any[]): any[] {
    const aggregatePatterns = [
      /^(our\s+)?(team|staff|faculty|leadership|management)\s/i,
      /^(meet\s+)?(the\s+)?(team|staff)/i,
      /^\d+\s+(people|members|employees)/i,
      /^(all|total)\s+staff/i
    ];
    
    return people.filter(person => {
      const name = person.name || '';
      return aggregatePatterns.some(pattern => pattern.test(name));
    });
  }

  private isAggregatePerson(person: any): boolean {
    return this.findAggregateBlocks([person]).length > 0;
  }

  private normalizeText(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1.0;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private calculateJaccardSimilarity(str1: string, str2: string): number {
    const tokens1 = new Set(str1.split(/\s+/));
    const tokens2 = new Set(str2.split(/\s+/));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return union.size > 0 ? intersection.size / union.size : 1.0;
  }

  private calculateOverallScore(fieldScores: Record<string, FieldScore>): number {
    const scores = Object.values(fieldScores);
    if (scores.length === 0) return 0;
    
    const weightedSum = scores.reduce((sum, score) => sum + (score.score * score.weight), 0);
    const totalWeight = scores.reduce((sum, score) => sum + score.weight, 0);
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private calculateFieldWeight(fieldPath: string, testCase: AccuracyTestCase): number {
    // Higher weights for more important fields
    if (fieldPath.includes('name')) return 1.0;
    if (fieldPath.includes('title')) return 0.8;
    if (fieldPath.includes('price')) return 0.9;
    if (fieldPath.includes('people')) return 1.0;
    if (fieldPath.includes('products')) return 1.0;
    
    return 0.5; // Default weight
  }

  private generateRecommendations(
    issues: AccuracyIssue[],
    fieldScores: Record<string, FieldScore>,
    testCase: AccuracyTestCase
  ): string[] {
    const recommendations: string[] = [];
    
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('CRITICAL: Address critical accuracy issues before production deployment');
    }
    
    const duplicateIssues = issues.filter(i => i.type === 'duplication');
    if (duplicateIssues.length > 0) {
      recommendations.push('Enhance deduplication logic with semantic similarity matching');
    }
    
    const aggregateIssues = issues.filter(i => i.type === 'aggregate_block');
    if (aggregateIssues.length > 0) {
      recommendations.push('Improve GPT prompts to exclude aggregate/summary blocks');
    }
    
    const lowScoreFields = Object.values(fieldScores).filter(f => f.score < 0.7);
    if (lowScoreFields.length > 0) {
      recommendations.push(`Improve extraction for low-scoring fields: ${lowScoreFields.map(f => f.field).join(', ')}`);
    }
    
    return recommendations;
  }

  // Helper functions for object manipulation
  private flattenObject(obj: any, prefix: string = ''): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(result, this.flattenObject(obj[key], newKey));
        } else {
          result[newKey] = obj[key];
        }
      }
    }
    
    return result;
  }

  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private isExactMatch(expected: any, actual: any): boolean {
    return JSON.stringify(expected) === JSON.stringify(actual);
  }

  private isAcceptableTypeCoercion(expected: any, actual: any): boolean {
    // Allow string numbers to match numbers
    if (typeof expected === 'number' && typeof actual === 'string') {
      return !isNaN(Number(actual));
    }
    if (typeof expected === 'string' && typeof actual === 'number') {
      return !isNaN(Number(expected));
    }
    
    return false;
  }

  private getNumberTolerance(fieldPath: string): number {
    if (fieldPath.includes('price')) return 0.05; // 5% tolerance for prices
    return 0.01; // 1% tolerance for other numbers
  }

  private isEntityArray(array: any[]): boolean {
    return array.length > 0 && 
           typeof array[0] === 'object' && 
           array[0] !== null &&
           ('name' in array[0] || 'title' in array[0] || 'id' in array[0]);
  }

  private async calculateEntitySimilarity(entity1: any, entity2: any): Promise<number> {
    if (!entity1 || !entity2) return 0;
    
    let totalScore = 0;
    let fieldCount = 0;
    
    const commonFields = Object.keys(entity1).filter(key => key in entity2);
    
    for (const field of commonFields) {
      if (typeof entity1[field] === 'string' && typeof entity2[field] === 'string') {
        const similarity = await this.calculateSemanticSimilarity(entity1[field], entity2[field]);
        totalScore += similarity;
        fieldCount++;
      }
    }
    
    return fieldCount > 0 ? totalScore / fieldCount : 0;
  }

  private createFieldIssue(fieldScore: FieldScore, testCase: AccuracyTestCase): AccuracyIssue {
    return {
      type: fieldScore.scoreType === 'missing' ? 'missing_required' : 'semantic_error',
      severity: fieldScore.score < 0.5 ? 'critical' : 'warning',
      field: fieldScore.field,
      description: `Field "${fieldScore.field}" scored ${(fieldScore.score * 100).toFixed(1)}%: ${fieldScore.explanation}`,
      impact: `Reduces accuracy for ${testCase.category} extraction`,
      suggestion: fieldScore.scoreType === 'missing' 
        ? 'Ensure extraction captures all required fields'
        : 'Improve field extraction accuracy or normalize formatting'
    };
  }
}

export default AccuracyScorer;