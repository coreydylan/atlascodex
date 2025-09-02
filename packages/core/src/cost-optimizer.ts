// Atlas Codex - Cost Optimization Engine
// Monitors and optimizes extraction costs across strategies

import { z } from 'zod';

// Cost tracking schemas
export const CostMetricsSchema = z.object({
  strategy: z.string(),
  baseCost: z.number(),
  actualCost: z.number(),
  llmTokens: z.number().optional(),
  browserTime: z.number().optional(),
  apiCalls: z.number().optional(),
  timestamp: z.string()
});

export const CostAnalysisSchema = z.object({
  domain: z.string(),
  period: z.object({
    start: z.string(),
    end: z.string()
  }),
  totalCost: z.number(),
  extractionCount: z.number(),
  avgCostPerExtraction: z.number(),
  costByStrategy: z.record(z.number()),
  llmUsagePercent: z.number(),
  recommendations: z.array(z.string()),
  projectedMonthlyCost: z.number()
});

export type CostMetrics = z.infer<typeof CostMetricsSchema>;
export type CostAnalysis = z.infer<typeof CostAnalysisSchema>;

export class CostOptimizer {
  private costHistory: Map<string, CostMetrics[]> = new Map();
  private costThresholds = {
    maxLLMPercent: 0.15, // 15% max LLM usage
    maxCostPerExtraction: 0.50,
    alertThreshold: 100, // Alert if daily cost exceeds $100
    optimizationThreshold: 0.20 // Optimize if cost > 20 cents per extraction
  };

  private strategyCosts = {
    static_fetch: 0.01,
    browser_render: 0.05,
    browser_js: 0.08,
    hybrid_smart: 0.15,
    gpt5_direct: 0.50,
    gpt5_reasoning: 0.75
  };

  /**
   * Track extraction cost
   */
  trackCost(
    domain: string,
    strategy: string,
    metadata: {
      duration?: number;
      llmTokens?: number;
      browserTime?: number;
      apiCalls?: number;
    }
  ): CostMetrics {
    const metrics: CostMetrics = {
      strategy,
      baseCost: this.strategyCosts[strategy as keyof typeof this.strategyCosts] || 0.10,
      actualCost: this.calculateActualCost(strategy, metadata),
      llmTokens: metadata.llmTokens,
      browserTime: metadata.browserTime,
      apiCalls: metadata.apiCalls,
      timestamp: new Date().toISOString()
    };

    // Store metrics
    if (!this.costHistory.has(domain)) {
      this.costHistory.set(domain, []);
    }
    this.costHistory.get(domain)!.push(metrics);

    // Check for cost alerts
    this.checkCostAlerts(domain, metrics);

    return metrics;
  }

  /**
   * Calculate actual cost based on usage
   */
  private calculateActualCost(
    strategy: string,
    metadata: any
  ): number {
    let cost = this.strategyCosts[strategy as keyof typeof this.strategyCosts] || 0.10;

    // Add LLM token costs
    if (metadata.llmTokens) {
      cost += (metadata.llmTokens / 1000) * 0.05; // $0.05 per 1K tokens
    }

    // Add browser compute costs
    if (metadata.browserTime) {
      cost += (metadata.browserTime / 1000) * 0.001; // $0.001 per second
    }

    // Add API call costs
    if (metadata.apiCalls) {
      cost += metadata.apiCalls * 0.001; // $0.001 per API call
    }

    return cost;
  }

  /**
   * Analyze costs for domain
   */
  analyzeCosts(domain: string, periodHours: number = 24): CostAnalysis {
    const history = this.costHistory.get(domain) || [];
    const cutoff = new Date(Date.now() - periodHours * 60 * 60 * 1000);
    
    const recentHistory = history.filter(
      m => new Date(m.timestamp) > cutoff
    );

    if (recentHistory.length === 0) {
      return this.getEmptyAnalysis(domain);
    }

    // Calculate totals
    const totalCost = recentHistory.reduce((sum, m) => sum + m.actualCost, 0);
    const avgCost = totalCost / recentHistory.length;

    // Cost by strategy
    const costByStrategy: Record<string, number> = {};
    recentHistory.forEach(m => {
      costByStrategy[m.strategy] = (costByStrategy[m.strategy] || 0) + m.actualCost;
    });

    // LLM usage percentage
    const llmCost = recentHistory
      .filter(m => m.strategy.includes('gpt'))
      .reduce((sum, m) => sum + m.actualCost, 0);
    const llmUsagePercent = totalCost > 0 ? llmCost / totalCost : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      avgCost,
      llmUsagePercent,
      costByStrategy
    );

    // Project monthly cost
    const dailyRate = totalCost * (24 / periodHours);
    const projectedMonthlyCost = dailyRate * 30;

    return {
      domain,
      period: {
        start: cutoff.toISOString(),
        end: new Date().toISOString()
      },
      totalCost,
      extractionCount: recentHistory.length,
      avgCostPerExtraction: avgCost,
      costByStrategy,
      llmUsagePercent,
      recommendations,
      projectedMonthlyCost
    };
  }

  /**
   * Generate cost optimization recommendations
   */
  private generateRecommendations(
    avgCost: number,
    llmUsagePercent: number,
    costByStrategy: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    // Check average cost
    if (avgCost > this.costThresholds.optimizationThreshold) {
      recommendations.push(
        `Average cost (${avgCost.toFixed(3)}) exceeds threshold - consider cheaper strategies`
      );
    }

    // Check LLM usage
    if (llmUsagePercent > this.costThresholds.maxLLMPercent) {
      recommendations.push(
        `LLM usage (${(llmUsagePercent * 100).toFixed(1)}%) exceeds 15% limit - reduce GPT-5 usage`
      );
    }

    // Find most expensive strategy
    const sortedStrategies = Object.entries(costByStrategy)
      .sort((a, b) => b[1] - a[1]);
    
    if (sortedStrategies.length > 0) {
      const [topStrategy, topCost] = sortedStrategies[0];
      if (topCost > 10) {
        recommendations.push(
          `${topStrategy} accounts for $${topCost.toFixed(2)} - consider alternatives`
        );
      }
    }

    // Suggest optimizations
    if (costByStrategy['gpt5_reasoning'] > 5) {
      recommendations.push('Replace gpt5_reasoning with gpt5_direct where possible');
    }

    if (costByStrategy['browser_js'] > costByStrategy['browser_render'] * 2) {
      recommendations.push('Test if browser_render is sufficient instead of browser_js');
    }

    if (!costByStrategy['static_fetch'] && avgCost > 0.10) {
      recommendations.push('Test static_fetch strategy for potential cost savings');
    }

    return recommendations;
  }

  /**
   * Optimize strategy selection based on cost
   */
  optimizeStrategySelection(
    domain: string,
    availableStrategies: string[],
    qualityRequirement: number = 0.7
  ): string {
    const analysis = this.analyzeCosts(domain);
    
    // Filter strategies by quality requirement
    // (In practice, would check historical quality scores)
    const viableStrategies = availableStrategies.filter(s => {
      const qualityScore = this.getStrategyQuality(s);
      return qualityScore >= qualityRequirement;
    });

    // Sort by cost
    viableStrategies.sort((a, b) => {
      const costA = this.strategyCosts[a as keyof typeof this.strategyCosts] || 0.10;
      const costB = this.strategyCosts[b as keyof typeof this.strategyCosts] || 0.10;
      return costA - costB;
    });

    // Check LLM usage constraint
    if (analysis.llmUsagePercent > this.costThresholds.maxLLMPercent) {
      // Filter out LLM strategies
      const nonLLMStrategies = viableStrategies.filter(
        s => !s.includes('gpt')
      );
      if (nonLLMStrategies.length > 0) {
        return nonLLMStrategies[0];
      }
    }

    return viableStrategies[0] || 'browser_render';
  }

  /**
   * Get strategy quality score (simplified)
   */
  private getStrategyQuality(strategy: string): number {
    const qualityScores = {
      static_fetch: 0.6,
      browser_render: 0.75,
      browser_js: 0.85,
      hybrid_smart: 0.80,
      gpt5_direct: 0.90,
      gpt5_reasoning: 0.95
    };
    return qualityScores[strategy as keyof typeof qualityScores] || 0.7;
  }

  /**
   * Check for cost alerts
   */
  private checkCostAlerts(domain: string, metrics: CostMetrics): void {
    // Check if cost exceeds max per extraction
    if (metrics.actualCost > this.costThresholds.maxCostPerExtraction) {
      console.warn(
        `⚠️ High cost alert for ${domain}: $${metrics.actualCost.toFixed(3)} per extraction`
      );
    }

    // Check daily spend
    const dailyAnalysis = this.analyzeCosts(domain, 24);
    if (dailyAnalysis.totalCost > this.costThresholds.alertThreshold) {
      console.warn(
        `⚠️ Daily cost alert for ${domain}: $${dailyAnalysis.totalCost.toFixed(2)}`
      );
    }
  }

  /**
   * Get cost report
   */
  getCostReport(): any {
    const report = {
      totalDomains: this.costHistory.size,
      totalExtractions: 0,
      totalCost: 0,
      avgCostPerExtraction: 0,
      costByStrategy: {} as Record<string, number>,
      topDomainsByCost: [] as any[],
      alerts: [] as string[]
    };

    // Aggregate across all domains
    for (const [domain, history] of this.costHistory) {
      const domainCost = history.reduce((sum, m) => sum + m.actualCost, 0);
      report.totalCost += domainCost;
      report.totalExtractions += history.length;

      // Track by strategy
      history.forEach(m => {
        report.costByStrategy[m.strategy] = 
          (report.costByStrategy[m.strategy] || 0) + m.actualCost;
      });

      // Track top domains
      report.topDomainsByCost.push({
        domain,
        cost: domainCost,
        extractions: history.length
      });
    }

    // Calculate averages
    report.avgCostPerExtraction = report.totalExtractions > 0 ?
      report.totalCost / report.totalExtractions : 0;

    // Sort top domains
    report.topDomainsByCost.sort((a, b) => b.cost - a.cost);
    report.topDomainsByCost = report.topDomainsByCost.slice(0, 10);

    // Check for alerts
    if (report.avgCostPerExtraction > this.costThresholds.optimizationThreshold) {
      report.alerts.push('Average cost per extraction exceeds optimization threshold');
    }

    const llmCost = (report.costByStrategy['gpt5_direct'] || 0) + 
                   (report.costByStrategy['gpt5_reasoning'] || 0);
    const llmPercent = report.totalCost > 0 ? llmCost / report.totalCost : 0;
    
    if (llmPercent > this.costThresholds.maxLLMPercent) {
      report.alerts.push(`LLM usage (${(llmPercent * 100).toFixed(1)}%) exceeds 15% limit`);
    }

    return report;
  }

  /**
   * Get empty analysis
   */
  private getEmptyAnalysis(domain: string): CostAnalysis {
    return {
      domain,
      period: {
        start: new Date().toISOString(),
        end: new Date().toISOString()
      },
      totalCost: 0,
      extractionCount: 0,
      avgCostPerExtraction: 0,
      costByStrategy: {},
      llmUsagePercent: 0,
      recommendations: ['No data available for analysis'],
      projectedMonthlyCost: 0
    };
  }
}