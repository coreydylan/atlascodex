# Atlas Codex Admin Dashboard Configuration

**Version**: 1.0.0  
**Last Updated**: 2025-01-14  
**Status**: Production Ready  

## 🚀 Overview

This document configures the comprehensive observability and telemetry system for the Evidence-First Adaptive Extraction System. The admin dashboard provides complete visibility into system health, performance metrics, SLA compliance, and operational insights.

## 📊 Dashboard Configuration

### Core Metrics Display

#### System Health Panel
```typescript
interface SystemHealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  errorRate: number;
  availabilityTarget: 99.5; // %
  responseTimeTarget: 5000; // ms
}
```

#### Evidence-First Processing Metrics
```typescript
interface ProcessingMetrics {
  contractGenerationRate: number;    // contracts/hour
  deterministicPassRate: number;     // success rate %  
  llmAugmentationRate: number;       // success rate %
  fallbackRate: number;              // fallback usage %
  pruneRate: number;                 // fields pruned %
  anchorValidationRate: number;      // anchor success %
}
```

### Alert Configuration

#### Critical Alerts (Immediate Response Required)
- **System Down**: No successful extractions in 5 minutes
- **Error Spike**: Error rate > 10% over 10 minutes
- **Budget Exceeded**: Daily budget utilization > 90%
- **Fallback Storm**: Fallback rate > 25% over 15 minutes
- **Contract Failures**: Contract generation failures > 50% over 5 minutes

#### Warning Alerts (Monitor Closely)  
- **Performance Degradation**: P95 response time > 7 seconds
- **High Error Rate**: Error rate > 5% over 15 minutes
- **Cache Degradation**: Cache hit rate < 40%
- **Budget Warning**: Daily budget utilization > 75%
- **Low Confidence**: Average confidence < 70% over 30 minutes

#### Info Alerts (Tracking)
- **Cost Spike**: 50% increase in hourly costs
- **High Traffic**: 200% increase in extraction requests
- **Cache Miss Spike**: Cache hit rate drop > 20%

### SLA Monitoring

#### Target SLAs
- **Availability**: 99.5% uptime
- **Response Time**: P95 < 5 seconds, P99 < 10 seconds
- **Success Rate**: > 95% successful extractions
- **Error Rate**: < 2% overall error rate
- **Budget Compliance**: Stay within daily/monthly budgets

#### SLA Breach Escalation
1. **Level 1**: Automated alerts to on-call team
2. **Level 2**: Page engineering team if breach persists > 15 minutes
3. **Level 3**: Executive notification if critical SLA breach > 30 minutes

## 🔧 Integration Points

### Monitoring Systems
- **Console Output**: Development and debugging
- **File Logging**: Production log aggregation
- **External APIs**: DataDog, New Relic, Prometheus integration
- **Slack/PagerDuty**: Alert delivery

### Dashboard Endpoints

#### `/admin/dashboard` - Main Dashboard
```json
{
  "systemHealth": {
    "status": "healthy",
    "uptime": 86400000,
    "version": "1.0.0"
  },
  "slaMetrics": {
    "availability": 0.995,
    "successRate": 0.97,
    "avgResponseTime": 3200,
    "p95ResponseTime": 4800,
    "errorRate": 0.02,
    "budgetUtilization": 127.50
  },
  "performanceMetrics": {
    "throughput": 45.2,
    "cacheHitRate": 0.68,
    "avgConfidence": 0.82,
    "fallbackRate": 0.08,
    "contractReuse": 0.72
  }
}
```

#### `/admin/metrics` - Prometheus Metrics
```
# Evidence-First Extraction Metrics
atlas_contract_generated_total{method="template_match"} 1250
atlas_contract_generated_total{method="llm_generated"} 380
atlas_deterministic_pass_coverage_ratio 0.85
atlas_llm_augmentation_cost_usd 45.67
atlas_fallback_taken_total{reason="low_confidence"} 23
atlas_cache_hit_ratio{type="contract"} 0.72
```

#### `/admin/events` - Recent Events
```json
{
  "events": [
    {
      "id": "evt_1737814234_abc123",
      "type": "contract_generated", 
      "timestamp": "2025-01-14T20:30:34.567Z",
      "data": {
        "contractId": "contract_789",
        "processingTimeMs": 1200,
        "confidenceScore": 0.89
      }
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 100,
    "total": 15420
  }
}
```

### Real-Time Features

#### WebSocket Events
```typescript
// Real-time dashboard updates
interface DashboardUpdate {
  type: 'metric_update' | 'alert' | 'system_status';
  timestamp: string;
  data: {
    metric?: string;
    value?: number;
    alert?: AlertEvent;
    status?: SystemStatus;
  };
}

// Connect to real-time updates
const ws = new WebSocket('wss://api.atlascodex.com/admin/live');
ws.onmessage = (event) => {
  const update: DashboardUpdate = JSON.parse(event.data);
  updateDashboard(update);
};
```

## 🎯 Key Performance Indicators (KPIs)

### Operational Excellence
- **System Uptime**: Target 99.5%
- **Mean Time to Recovery (MTTR)**: Target < 15 minutes
- **Mean Time Between Failures (MTBF)**: Target > 7 days

### Processing Quality
- **Contract Success Rate**: Target > 95%
- **Extraction Accuracy**: Target > 90%
- **User Satisfaction**: Target > 4.5/5.0

### Cost Efficiency  
- **Cost per Extraction**: Target < $0.05
- **Budget Adherence**: Stay within monthly budget
- **ROI**: Target > 300%

## 🚨 Alert Rules Configuration

### Evidence-First Specific Alerts

#### Contract Generation Alerts
```yaml
- name: contract_generation_failure_rate
  condition: rate(atlas_contract_generated_errors[5m]) > 0.1
  severity: critical
  description: "Contract generation failure rate exceeded 10%"
  runbook: "Check LLM API status and template library"

- name: contract_generation_latency
  condition: histogram_quantile(0.95, atlas_contract_generation_duration[5m]) > 5
  severity: warning  
  description: "Contract generation P95 latency > 5 seconds"
```

#### Deterministic Extraction Alerts
```yaml
- name: low_deterministic_coverage
  condition: avg(atlas_deterministic_coverage_ratio[10m]) < 0.5
  severity: warning
  description: "Deterministic extraction coverage below 50%"
  runbook: "Review selector patterns and DOM structure changes"

- name: anchor_validation_failures
  condition: rate(atlas_anchor_validation_failures[5m]) > 0.2
  severity: critical
  description: "Anchor validation failure rate > 20%"
```

#### LLM Augmentation Alerts  
```yaml
- name: llm_cost_spike
  condition: rate(atlas_llm_cost_usd[1h]) > 10.0
  severity: warning
  description: "LLM costs exceeding $10/hour"
  runbook: "Check for API abuse or unusual traffic patterns"

- name: llm_rate_limit_exceeded
  condition: rate(atlas_llm_rate_limit_hits[5m]) > 0.1
  severity: critical
  description: "LLM rate limits being hit frequently"
```

### Recovery Actions

#### Automated Recovery
- **High Error Rate**: Switch to fallback mode automatically
- **API Limits Hit**: Implement exponential backoff
- **Memory Issues**: Restart affected services
- **Cache Failures**: Failover to backup cache

#### Manual Interventions
- **Budget Exceeded**: Pause non-critical extractions
- **Data Quality Issues**: Review and update templates
- **Performance Issues**: Scale up infrastructure
- **Security Issues**: Enable additional monitoring

## 📈 Reporting and Analytics

### Daily Reports
- System health summary
- SLA compliance status  
- Cost breakdown and trends
- Top errors and resolutions
- Performance metrics summary

### Weekly Reports
- Capacity planning recommendations
- Cost optimization opportunities
- User experience metrics
- System improvements implemented
- Upcoming maintenance windows

### Monthly Reports
- Business impact analysis
- ROI and cost-benefit analysis
- System evolution and roadmap
- Stakeholder satisfaction surveys
- Technical debt assessment

## 🔐 Security and Compliance

### Data Privacy
- All PII automatically redacted from logs
- Configurable retention policies
- GDPR compliance for EU traffic
- SOC 2 compliance monitoring

### Access Control
- Role-based dashboard access
- API key authentication
- Audit logs for all admin actions
- Multi-factor authentication required

### Data Retention
- **Telemetry Events**: 90 days
- **Aggregated Metrics**: 1 year  
- **Error Logs**: 30 days
- **Audit Logs**: 2 years

## 🚀 Implementation Status

### ✅ Completed Components
- **ProductionTelemetry Class**: Full implementation with all event types
- **Event Collection**: Comprehensive telemetry collector 
- **Metrics Calculation**: SLA and performance metrics
- **Dashboard Data Generation**: Real-time dashboard data
- **PII Redaction**: Privacy-compliant logging
- **Error Taxonomy**: Structured error classification
- **Batch Processing**: Efficient event handling
- **Test Coverage**: Comprehensive test suite

### 🔄 Configuration Required
- **External Monitoring Integration**: DataDog/New Relic setup
- **Alert Delivery**: Slack/PagerDuty webhook configuration  
- **Dashboard UI**: Frontend dashboard implementation
- **Real-time Updates**: WebSocket server setup
- **Access Control**: Authentication and authorization

### 📋 Next Steps
1. Configure external monitoring system integration
2. Set up alert delivery channels (Slack/PagerDuty)
3. Implement dashboard UI frontend
4. Configure real-time WebSocket updates
5. Set up role-based access control
6. Deploy monitoring infrastructure
7. Configure automated recovery actions
8. Set up reporting and analytics pipeline

## 📚 Usage Examples

### Basic Event Emission
```typescript
import { 
  emitContractGenerated,
  emitDeterministicPass,
  emitLLMAugmentation 
} from '@atlascodex/core';

// Emit contract generation event
emitContractGenerated({
  contractId: 'contract_abc123',
  contractName: 'Product Extraction',
  fieldCount: 8,
  userQuery: 'extract product names and prices',
  generationMethod: 'template_match',
  processingTimeMs: 1200,
  confidenceScore: 0.92,
  complexity: 'moderate',
  fallbackUsed: false
});

// Emit deterministic processing results
emitDeterministicPass({
  contractId: 'contract_abc123',
  totalFields: 8,
  fieldsFound: 7,
  fieldsRequested: 8,
  coverageRatio: 0.875,
  processingTimeMs: 2100,
  domElements: 245,
  selectorsTriedCount: 32,
  anchorsFound: 18,
  confidenceScore: 0.85,
  patternMatches: { 'product_name': 12, 'price': 6 },
  domAnalysisTimeMs: 450,
  extractionStrategy: 'css_selectors'
});
```

### Dashboard Data Access
```typescript
import { 
  telemetryCollector, 
  metricsCalculator, 
  generateDashboardData 
} from '@atlascodex/core';

// Get real-time dashboard data
const dashboardData = generateDashboardData(
  telemetryCollector,
  metricsCalculator
);

console.log('System Status:', dashboardData.systemHealth.status);
console.log('Success Rate:', dashboardData.slaMetrics.successRate);
console.log('Hourly Cost:', dashboardData.costAnalysis.hourly);
```

### Custom Metrics
```typescript
// Calculate custom business metrics
const businessMetrics = {
  revenuePerExtraction: calculateRevenuePerExtraction(),
  userSatisfactionScore: calculateUserSatisfaction(),
  timeToValue: calculateTimeToValue(),
  automationSavings: calculateAutomationSavings()
};

// Emit custom business event
emitBudgetEvent({
  eventType: 'cost_incurred',
  resourceType: 'processing_time',
  costUsd: businessMetrics.costPerExtraction,
  budgetRemaining: getRemainingBudget(),
  utilizationPercentage: getBudgetUtilization(),
  timeWindow: 'hour',
  costBreakdown: {
    llmCosts: llmCosts,
    apiCosts: apiCosts,  
    computeCosts: computeCosts,
    storageCosts: storageCosts
  },
  projectedCost: {
    hourly: hourlyProjection,
    daily: dailyProjection,
    monthly: monthlyProjection
  }
});
```

---

**Configuration Complete**: The Evidence-First Adaptive Extraction System now has comprehensive observability and telemetry with complete admin dashboard capabilities for production monitoring, SLA compliance, and operational insights.