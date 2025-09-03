// Atlas Codex: Real-Time Production Accuracy Monitoring
// Monitors every extraction for accuracy issues and provides instant alerts

import { AccuracyScorer, AccuracyResult } from '../../testing/accuracy/accuracy-scorer';

export interface AccuracyAssessment {
  timestamp: string;
  extractionId: string;
  url: string;
  overallScore: number;
  confidence: number;
  issues: ProductionIssue[];
  recommendations: string[];
  severity: 'ok' | 'warning' | 'critical';
  shouldAlert: boolean;
}

export interface ProductionIssue {
  type: 'duplication' | 'aggregate_block' | 'low_confidence' | 'structural_error' | 'semantic_error' | 'data_quality';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  impact: string;
  suggestion: string;
  affectedFields?: string[];
  evidence?: any;
}

export interface AccuracyTrend {
  timeWindow: string;
  averageScore: number;
  totalExtractions: number;
  issueCount: number;
  criticalIssueCount: number;
  trendDirection: 'improving' | 'stable' | 'degrading';
}

export interface AccuracyAlert {
  id: string;
  timestamp: string;
  type: 'critical_accuracy' | 'duplicate_detection' | 'aggregate_blocks' | 'quality_degradation';
  severity: 'warning' | 'critical';
  message: string;
  extractionId: string;
  url: string;
  details: any;
  actionRequired: boolean;
}

export class ProductionAccuracyMonitor {
  private accuracyScorer: AccuracyScorer;
  private recentAssessments: AccuracyAssessment[] = [];
  private alertThresholds = {
    criticalScore: 0.7,
    duplicateThreshold: 2,
    confidenceThreshold: 0.6,
    maxAggregateBlocks: 0
  };

  constructor() {
    this.accuracyScorer = new AccuracyScorer();
  }

  async monitorExtraction(extractionResult: any): Promise<AccuracyAssessment> {
    console.log(`🔍 Monitoring accuracy for extraction: ${extractionResult.jobId}`);
    
    const assessment: AccuracyAssessment = {
      timestamp: new Date().toISOString(),
      extractionId: extractionResult.jobId || 'unknown',
      url: extractionResult.url || 'unknown',
      overallScore: 1.0,
      confidence: extractionResult.metadata?.confidence || 0.5,
      issues: [],
      recommendations: [],
      severity: 'ok',
      shouldAlert: false
    };

    // Run comprehensive quality checks
    await Promise.all([
      this.checkDataStructureQuality(extractionResult, assessment),
      this.checkDuplicationIssues(extractionResult, assessment),
      this.checkAggregateBlockContamination(extractionResult, assessment),
      this.checkConfidenceAlignment(extractionResult, assessment),
      this.checkSemanticCoherence(extractionResult, assessment),
      this.checkCompleteness(extractionResult, assessment)
    ]);

    // Calculate overall score based on issues
    assessment.overallScore = this.calculateRealTimeScore(assessment.issues, assessment.confidence);
    
    // Determine severity and alert necessity
    assessment.severity = this.determineSeverity(assessment);
    assessment.shouldAlert = this.shouldTriggerAlert(assessment);
    
    // Generate recommendations
    assessment.recommendations = this.generateRealtimeRecommendations(assessment);

    // Store for trend analysis
    this.storeAssessment(assessment);

    // Send alerts if necessary
    if (assessment.shouldAlert) {
      await this.sendAccuracyAlert(assessment);
    }

    console.log(`  Accuracy Score: ${(assessment.overallScore * 100).toFixed(1)}% (${assessment.severity})`);
    if (assessment.issues.length > 0) {
      console.log(`  Issues: ${assessment.issues.length} (${assessment.issues.filter(i => i.severity === 'critical').length} critical)`);
    }

    return assessment;
  }

  private async checkDuplicationIssues(extractionResult: any, assessment: AccuracyAssessment): Promise<void> {
    if (!Array.isArray(extractionResult.data?.people)) return;

    const people = extractionResult.data.people;
    const duplicates = this.findDuplicates(people);

    if (duplicates.length > 0) {
      assessment.issues.push({
        type: 'duplication',
        severity: 'critical',
        description: `Found ${duplicates.length} duplicate people in extraction`,
        impact: 'Severely reduces data quality and user trust',
        suggestion: 'Enhance deduplication algorithm with semantic similarity',
        affectedFields: ['people'],
        evidence: duplicates.map(d => ({ name: d.name, duplicateOf: d.duplicateOf }))
      });

      console.log(`  🚨 CRITICAL: ${duplicates.length} duplicate people detected`);
    }
  }

  private async checkAggregateBlockContamination(extractionResult: any, assessment: AccuracyAssessment): Promise<void> {
    if (!Array.isArray(extractionResult.data?.people)) return;

    const people = extractionResult.data.people;
    const aggregateBlocks = this.findAggregateBlocks(people);

    if (aggregateBlocks.length > 0) {
      assessment.issues.push({
        type: 'aggregate_block',
        severity: 'critical',
        description: `Found ${aggregateBlocks.length} aggregate blocks extracted as individual people`,
        impact: 'Fundamentally incorrect extraction - not individual entities',
        suggestion: 'Improve GPT prompts to exclude aggregate/summary content',
        affectedFields: ['people'],
        evidence: aggregateBlocks.map(block => ({ name: block.name, reason: this.getAggregateReason(block) }))
      });

      console.log(`  🚨 CRITICAL: ${aggregateBlocks.length} aggregate blocks detected`);
    }
  }

  private async checkDataStructureQuality(extractionResult: any, assessment: AccuracyAssessment): Promise<void> {
    const data = extractionResult.data;

    // Check for empty or malformed data
    if (!data || Object.keys(data).length === 0) {
      assessment.issues.push({
        type: 'structural_error',
        severity: 'critical',
        description: 'Extraction returned empty or null data',
        impact: 'Complete extraction failure',
        suggestion: 'Check extraction pipeline and error handling'
      });
      return;
    }

    // Check for expected data types
    if (data.people && !Array.isArray(data.people)) {
      assessment.issues.push({
        type: 'structural_error',
        severity: 'warning',
        description: 'People data is not an array',
        impact: 'Data structure inconsistency',
        suggestion: 'Ensure consistent data structure formatting'
      });
    }

    if (data.products && !Array.isArray(data.products)) {
      assessment.issues.push({
        type: 'structural_error',
        severity: 'warning',
        description: 'Products data is not an array',
        impact: 'Data structure inconsistency',
        suggestion: 'Ensure consistent data structure formatting'
      });
    }

    // Check for required fields
    if (Array.isArray(data.people)) {
      const peopleWithoutNames = data.people.filter(person => !person.name || person.name.trim().length < 2);
      if (peopleWithoutNames.length > 0) {
        assessment.issues.push({
          type: 'data_quality',
          severity: 'warning',
          description: `Found ${peopleWithoutNames.length} people with missing or invalid names`,
          impact: 'Reduces data usability and quality',
          suggestion: 'Improve name extraction and validation',
          evidence: peopleWithoutNames
        });
      }
    }
  }

  private async checkConfidenceAlignment(extractionResult: any, assessment: AccuracyAssessment): Promise<void> {
    const confidence = extractionResult.metadata?.confidence || 0;
    const dataComplexity = this.assessDataComplexity(extractionResult.data);

    // Low confidence with high data complexity suggests extraction uncertainty
    if (confidence < this.alertThresholds.confidenceThreshold && dataComplexity > 0.7) {
      assessment.issues.push({
        type: 'low_confidence',
        severity: 'warning',
        description: `Low confidence (${(confidence * 100).toFixed(1)}%) with complex data extraction`,
        impact: 'Extraction results may be unreliable',
        suggestion: 'Review extraction strategy or content complexity'
      });
    }

    // High confidence with simple/empty data suggests overconfidence
    if (confidence > 0.9 && dataComplexity < 0.3) {
      assessment.issues.push({
        type: 'low_confidence',
        severity: 'info',
        description: 'High confidence with minimal data extraction',
        impact: 'Possible overconfidence in simple extraction',
        suggestion: 'Validate confidence calibration'
      });
    }
  }

  private async checkSemanticCoherence(extractionResult: any, assessment: AccuracyAssessment): Promise<void> {
    // Check if extracted names look like real names
    if (Array.isArray(extractionResult.data?.people)) {
      const suspiciousNames = extractionResult.data.people.filter(person => 
        this.isSuspiciousName(person.name)
      );

      if (suspiciousNames.length > 0) {
        assessment.issues.push({
          type: 'semantic_error',
          severity: 'warning',
          description: `Found ${suspiciousNames.length} people with suspicious/non-name text`,
          impact: 'May indicate extraction of non-person content',
          suggestion: 'Improve person name validation and filtering',
          evidence: suspiciousNames.map(p => p.name)
        });
      }
    }
  }

  private async checkCompleteness(extractionResult: any, assessment: AccuracyAssessment): Promise<void> {
    const data = extractionResult.data;
    
    // If we have people but no additional info, flag as potentially incomplete
    if (Array.isArray(data.people) && data.people.length > 0) {
      const peopleWithMinimalInfo = data.people.filter(person => 
        person.name && (!person.title || person.title.length < 3) && (!person.bio || person.bio.length < 10)
      );

      if (peopleWithMinimalInfo.length > data.people.length * 0.7) {
        assessment.issues.push({
          type: 'data_quality',
          severity: 'info',
          description: `${peopleWithMinimalInfo.length}/${data.people.length} people have minimal information`,
          impact: 'Extracted data may be incomplete',
          suggestion: 'Check if source contains more detailed information'
        });
      }
    }
  }

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================

  private findDuplicates(people: any[]): any[] {
    const seen = new Set<string>();
    const duplicates = [];

    for (const person of people) {
      if (!person.name) continue;
      
      const normalizedName = this.normalizeName(person.name);
      if (seen.has(normalizedName)) {
        duplicates.push({
          ...person,
          duplicateOf: normalizedName,
          reason: 'Normalized name match'
        });
      } else {
        seen.add(normalizedName);
      }
    }

    return duplicates;
  }

  private findAggregateBlocks(people: any[]): any[] {
    const aggregatePatterns = [
      /^(our\s+)?(team|staff|faculty|leadership|management|board|directors?)\s*/i,
      /^(meet\s+)?(the\s+)?(team|staff|crew|faculty|leadership)/i,
      /^\d+\s+(people|members|employees|staff|team)/i,
      /^(all|total|entire)\s+(staff|employees|team|faculty)/i,
      /^staff\s+(directory|listing|page|members?)/i,
      /^team\s+(members?|directory|page)/i,
      /^(leadership|management)\s+(team|group)/i
    ];

    return people.filter(person => {
      if (!person.name) return false;
      
      const name = person.name.toLowerCase().trim();
      return aggregatePatterns.some(pattern => pattern.test(name));
    });
  }

  private getAggregateReason(block: any): string {
    const name = block.name?.toLowerCase() || '';
    if (name.includes('team')) return 'Contains "team" keyword';
    if (name.includes('staff')) return 'Contains "staff" keyword';
    if (name.includes('leadership')) return 'Contains "leadership" keyword';
    if (/^\d+\s+(people|members)/.test(name)) return 'Starts with number + people/members';
    return 'Matches aggregate pattern';
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isSuspiciousName(name: string): boolean {
    if (!name || name.length < 2) return true;
    
    const suspiciousPatterns = [
      /^(page|section|content|text|description|info)/i,
      /^(click|read|view|see|learn)/i,
      /^https?:\/\//i,
      /^[0-9]+$/,
      /^(undefined|null|none|n\/a)$/i,
      /^.{1,2}$/  // Very short names
    ];

    return suspiciousPatterns.some(pattern => pattern.test(name));
  }

  private assessDataComplexity(data: any): number {
    let complexity = 0;
    
    if (Array.isArray(data.people)) {
      complexity += Math.min(data.people.length / 10, 1) * 0.4; // Number of people
      
      const avgFieldCount = data.people.reduce((sum, person) => 
        sum + Object.keys(person).length, 0) / data.people.length;
      complexity += Math.min(avgFieldCount / 5, 1) * 0.3; // Field richness
      
      const avgTextLength = data.people.reduce((sum, person) => 
        sum + (person.bio?.length || 0) + (person.title?.length || 0), 0) / data.people.length;
      complexity += Math.min(avgTextLength / 200, 1) * 0.3; // Text richness
    }

    return Math.min(complexity, 1);
  }

  private calculateRealTimeScore(issues: ProductionIssue[], confidence: number): number {
    let baseScore = confidence;

    // Apply penalties for issues
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          baseScore *= 0.3; // Severe penalty
          break;
        case 'warning':
          baseScore *= 0.7; // Moderate penalty
          break;
        case 'info':
          baseScore *= 0.9; // Minor penalty
          break;
      }
    }

    return Math.max(0, Math.min(1, baseScore));
  }

  private determineSeverity(assessment: AccuracyAssessment): 'ok' | 'warning' | 'critical' {
    const criticalIssues = assessment.issues.filter(i => i.severity === 'critical');
    const warningIssues = assessment.issues.filter(i => i.severity === 'warning');

    if (criticalIssues.length > 0 || assessment.overallScore < this.alertThresholds.criticalScore) {
      return 'critical';
    }
    
    if (warningIssues.length > 0 || assessment.overallScore < 0.85) {
      return 'warning';
    }

    return 'ok';
  }

  private shouldTriggerAlert(assessment: AccuracyAssessment): boolean {
    // Always alert on critical issues
    if (assessment.severity === 'critical') return true;
    
    // Alert on specific issue types
    const alertableTypes = ['duplication', 'aggregate_block'];
    return assessment.issues.some(issue => 
      alertableTypes.includes(issue.type) && issue.severity !== 'info'
    );
  }

  private generateRealtimeRecommendations(assessment: AccuracyAssessment): string[] {
    const recommendations: string[] = [];
    
    const criticalIssues = assessment.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('IMMEDIATE ACTION REQUIRED: Critical accuracy issues detected');
    }
    
    const duplicates = assessment.issues.filter(i => i.type === 'duplication');
    if (duplicates.length > 0) {
      recommendations.push('Enhance deduplication algorithm - duplicates detected');
    }
    
    const aggregateBlocks = assessment.issues.filter(i => i.type === 'aggregate_block');
    if (aggregateBlocks.length > 0) {
      recommendations.push('Improve GPT prompts to exclude aggregate content');
    }
    
    if (assessment.overallScore < 0.8) {
      recommendations.push('Consider fallback extraction strategy for this content type');
    }

    return recommendations;
  }

  private storeAssessment(assessment: AccuracyAssessment): void {
    // Keep only recent assessments for trend analysis
    this.recentAssessments.push(assessment);
    if (this.recentAssessments.length > 1000) {
      this.recentAssessments = this.recentAssessments.slice(-500);
    }
  }

  private async sendAccuracyAlert(assessment: AccuracyAssessment): Promise<void> {
    const alert: AccuracyAlert = {
      id: `accuracy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: assessment.timestamp,
      type: this.getAlertType(assessment),
      severity: assessment.severity === 'critical' ? 'critical' : 'warning',
      message: this.generateAlertMessage(assessment),
      extractionId: assessment.extractionId,
      url: assessment.url,
      details: {
        score: assessment.overallScore,
        confidence: assessment.confidence,
        issues: assessment.issues,
        recommendations: assessment.recommendations
      },
      actionRequired: assessment.severity === 'critical'
    };

    // Log alert (in production, send to monitoring system)
    console.log('🚨 ACCURACY ALERT:', alert.message);
    console.log(`   Details: Score ${(alert.details.score * 100).toFixed(1)}%, ${alert.details.issues.length} issues`);

    // TODO: Send to actual alerting system (PagerDuty, Slack, etc.)
    // await this.sendToAlertingSystem(alert);
  }

  private getAlertType(assessment: AccuracyAssessment): AccuracyAlert['type'] {
    if (assessment.issues.some(i => i.type === 'duplication')) return 'duplicate_detection';
    if (assessment.issues.some(i => i.type === 'aggregate_block')) return 'aggregate_blocks';
    if (assessment.overallScore < this.alertThresholds.criticalScore) return 'quality_degradation';
    return 'critical_accuracy';
  }

  private generateAlertMessage(assessment: AccuracyAssessment): string {
    const score = (assessment.overallScore * 100).toFixed(1);
    const criticalIssues = assessment.issues.filter(i => i.severity === 'critical');
    
    if (criticalIssues.length > 0) {
      return `Critical accuracy issues detected (Score: ${score}%): ${criticalIssues.map(i => i.type).join(', ')}`;
    }
    
    return `Accuracy below threshold (Score: ${score}%) for ${assessment.url}`;
  }

  // ========================================
  // TREND ANALYSIS
  // ========================================

  getAccuracyTrend(timeWindowMinutes: number = 60): AccuracyTrend {
    const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);
    const recentAssessments = this.recentAssessments.filter(a => 
      new Date(a.timestamp).getTime() > cutoffTime
    );

    if (recentAssessments.length === 0) {
      return {
        timeWindow: `${timeWindowMinutes}min`,
        averageScore: 0,
        totalExtractions: 0,
        issueCount: 0,
        criticalIssueCount: 0,
        trendDirection: 'stable'
      };
    }

    const averageScore = recentAssessments.reduce((sum, a) => sum + a.overallScore, 0) / recentAssessments.length;
    const totalIssues = recentAssessments.reduce((sum, a) => sum + a.issues.length, 0);
    const criticalIssues = recentAssessments.reduce((sum, a) => 
      sum + a.issues.filter(i => i.severity === 'critical').length, 0
    );

    // Simple trend calculation (compare first half vs second half)
    const midpoint = Math.floor(recentAssessments.length / 2);
    const firstHalfAvg = recentAssessments.slice(0, midpoint)
      .reduce((sum, a) => sum + a.overallScore, 0) / midpoint;
    const secondHalfAvg = recentAssessments.slice(midpoint)
      .reduce((sum, a) => sum + a.overallScore, 0) / (recentAssessments.length - midpoint);

    let trendDirection: 'improving' | 'stable' | 'degrading' = 'stable';
    const improvement = secondHalfAvg - firstHalfAvg;
    if (improvement > 0.05) trendDirection = 'improving';
    else if (improvement < -0.05) trendDirection = 'degrading';

    return {
      timeWindow: `${timeWindowMinutes}min`,
      averageScore,
      totalExtractions: recentAssessments.length,
      issueCount: totalIssues,
      criticalIssueCount: criticalIssues,
      trendDirection
    };
  }

  // ========================================
  // PUBLIC INTERFACE
  // ========================================

  async getSystemHealthSummary(): Promise<{
    overall: 'healthy' | 'degraded' | 'critical';
    score: number;
    trend: AccuracyTrend;
    recentAlerts: number;
    recommendations: string[];
  }> {
    const trend = this.getAccuracyTrend(60);
    const recentAlerts = this.recentAssessments
      .filter(a => a.shouldAlert && new Date(a.timestamp).getTime() > Date.now() - 3600000)
      .length;

    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (trend.averageScore < 0.7 || trend.criticalIssueCount > 0) overall = 'critical';
    else if (trend.averageScore < 0.85 || recentAlerts > 5) overall = 'degraded';

    const recommendations: string[] = [];
    if (trend.criticalIssueCount > 0) {
      recommendations.push('Address critical accuracy issues immediately');
    }
    if (trend.trendDirection === 'degrading') {
      recommendations.push('Investigate accuracy degradation trend');
    }
    if (recentAlerts > 10) {
      recommendations.push('High alert volume - review system stability');
    }

    return {
      overall,
      score: trend.averageScore,
      trend,
      recentAlerts,
      recommendations
    };
  }
}

export default ProductionAccuracyMonitor;