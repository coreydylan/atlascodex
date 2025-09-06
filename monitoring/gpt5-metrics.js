// monitoring/gpt5-metrics.js
class GPT5Metrics {
  constructor() {
    this.metrics = {
      calls: 0,
      costs: 0,
      errors: 0,
      fallbacks: 0,
      models: {}
    };
  }

  track(result) {
    this.metrics.calls++;
    this.metrics.costs += result.cost.total;
    
    if (result.fallback) {
      this.metrics.fallbacks++;
    }
    
    if (!this.metrics.models[result.model]) {
      this.metrics.models[result.model] = 0;
    }
    this.metrics.models[result.model]++;
  }

  getReport() {
    return {
      totalCalls: this.metrics.calls,
      totalCost: this.metrics.costs.toFixed(2),
      averageCost: (this.metrics.costs / this.metrics.calls).toFixed(4),
      errorRate: (this.metrics.errors / this.metrics.calls * 100).toFixed(2) + '%',
      fallbackRate: (this.metrics.fallbacks / this.metrics.calls * 100).toFixed(2) + '%',
      modelDistribution: this.metrics.models
    };
  }
}

module.exports = GPT5Metrics;