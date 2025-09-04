# Production Readiness Gate Checklist

This document provides comprehensive documentation for the 10-Point Production Readiness Gate validation system, as specified in the Evidence-First Adaptive Extraction Plan.

## Overview

The Production Readiness Gate system ensures that ALL 10 critical checkboxes pass before production deployment. This system validates the complete Evidence-First Adaptive Extraction infrastructure for production safety, reliability, and performance.

## The 10 Production Gates

### ✅ Gate 1: Schema Strictness
- **Requirement**: `additionalProperties: false` + `unevaluatedProperties: false` enforcement
- **Validation**: AJV strict mode with comprehensive validation
- **Tests**: Schema validation, phantom field rejection, strictness enforcement

### ✅ Gate 2: Anchor ID System  
- **Requirement**: Only opaque IDs (n_12345), no CSS selectors exposed to LLM
- **Validation**: Cross-validation ensures anchor values round-trip correctly
- **Tests**: ID pattern validation, cross-extraction verification, selector isolation

### ✅ Gate 3: Promotion Quorum Enforcement
- **Requirement**: K=5 entities ∧ M=3 blocks minimum for field promotion
- **Validation**: Strict counters with metadata exposure
- **Tests**: Quorum validation, counter accuracy, promotion denial below thresholds

### ✅ Gate 4: Content Hashing Verification
- **Requirement**: Cache hit rates >60%, idempotency keys prevent duplicate work
- **Validation**: Normalized DOM hashing with consistent key generation
- **Tests**: Hash consistency, dynamic content normalization, cache simulation

### ✅ Gate 5: Budget Enforcement Testing
- **Requirement**: Token (500/400/100) & time budgets (800/1200/600ms) with abstention
- **Validation**: Stage guards with fallback behavior
- **Tests**: Budget limits, timeout enforcement, abstention validation

### ✅ Gate 6: State Machine Validation
- **Requirement**: Strict mode drops entities, soft mode demotes fields
- **Validation**: Mode-specific behavior with metadata tracking
- **Tests**: Entity dropping, field demotion, metadata accuracy

### ✅ Gate 7: Anti-Hallucination Golden Tests
- **Requirement**: No phantom fields, evidence-backed extraction only
- **Validation**: Golden test suite with automated CI/CD integration
- **Tests**: "No emails → no email field", evidence requirement, cross-validation

### ✅ Gate 8: Performance Benchmarks
- **Requirement**: P95 < 5s, cost < $0.05 per extraction, fallback rate < 1%
- **Validation**: Performance metrics with SLA enforcement
- **Tests**: Latency benchmarks, cost validation, fallback rate monitoring

### ✅ Gate 9: Observability Verification
- **Requirement**: 5 event types flowing, dashboard metrics accessible
- **Validation**: Structured logging with monitoring integration
- **Tests**: Event type validation, metric endpoint verification, alert configuration

### ✅ Gate 10: Rollback Readiness
- **Requirement**: Feature flag, kill-switch, fallback system working under load
- **Validation**: Graceful degradation with API compatibility
- **Tests**: Feature flag control, emergency fallback, load handling

## Quick Start

### Install Dependencies

```bash
cd packages/core
npm install
```

### Run All Gates

```bash
# Run complete validation
npm run production-gates:all

# Or run specific gate
npm run production-gates gate "Schema Strictness"

# Run pre-flight checklist
npm run production-gates:preflight
```

### Programmatic Usage

```typescript
import { ProductionGateRunner, ProductionGateValidator } from '@atlas-codex/core';

// Run complete validation
const runner = new ProductionGateRunner();
const report = await runner.runCompleteValidation();

console.log(`Ready for Production: ${report.readyForProduction}`);
console.log(`Overall Score: ${(report.overallScore * 100).toFixed(1)}%`);

// Run specific gates
const results = await runner.runSpecificGates(['Schema Strictness', 'Performance']);
results.forEach(gate => {
  console.log(`${gate.gate}: ${gate.passed ? 'PASSED' : 'FAILED'} (${(gate.score * 100).toFixed(1)}%)`);
});
```

## CLI Usage

### Available Commands

```bash
# Show all available gates
npx tsx src/production-gate-runner.ts list

# Run all gates with verbose output
npx tsx src/production-gate-runner.ts all --verbose

# Run specific gate
npx tsx src/production-gate-runner.ts gate "Anchor ID System" --verbose

# Run pre-flight checklist  
npx tsx src/production-gate-runner.ts preflight

# Save report to file
npx tsx src/production-gate-runner.ts all --report production-report.json
```

### Example Output

```
🔍 Running Complete Production Readiness Gate Validation

📊 PRODUCTION READINESS REPORT
══════════════════════════════════════════════════════
Overall Score: 95.2%
Status: ✅ READY FOR PRODUCTION
Gates Passed: 10/10
Generated: 1/14/2025, 10:30:00 AM

📋 INDIVIDUAL GATE RESULTS:
──────────────────────────────────────────────────────
  ✅ PASSED Schema Strictness: 100.0% (4/4 tests passed)
  ✅ PASSED Anchor ID System: 100.0% (5/5 tests passed)
  ✅ PASSED Promotion Quorum: 100.0% (4/4 tests passed)
  ✅ PASSED Content Hashing: 100.0% (5/5 tests passed)
  ✅ PASSED Budget Enforcement: 100.0% (5/5 tests passed)
  ✅ PASSED State Machine: 100.0% (5/5 tests passed)
  ✅ PASSED Anti-Hallucination: 100.0% (5/5 tests passed)
  ✅ PASSED Performance: 100.0% (6/6 tests passed)
  ✅ PASSED Observability: 100.0% (5/5 tests passed)
  ✅ PASSED Rollback Readiness: 90.0% (4/5 tests passed)

🚀 DEPLOYMENT STATUS:
──────────────────────────────────────────────────────
  ✅ All production gates passed!
  ✅ System is ready for production deployment
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Production Gate Validation
on: [push, pull_request]

jobs:
  production-gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Dependencies
        run: |
          cd packages/core
          npm install
      
      - name: Run Production Gates
        run: |
          cd packages/core
          npm run production-gates:all
      
      - name: Upload Gate Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: production-gate-report
          path: packages/core/production-report.json
```

### Pre-deployment Validation Script

```bash
#!/bin/bash
# pre-deploy.sh - Run before production deployment

set -e

echo "🚀 Pre-deployment Production Gate Validation"

cd packages/core

# Run pre-flight checklist first
echo "Step 1: Running pre-flight checklist..."
npm run production-gates:preflight

if [ $? -ne 0 ]; then
  echo "❌ Pre-flight checklist failed. Deployment blocked."
  exit 1
fi

# Run complete gate validation
echo "Step 2: Running complete gate validation..."
npm run production-gates:all --report production-report.json

if [ $? -ne 0 ]; then
  echo "❌ Production gates validation failed. Deployment blocked."
  exit 1
fi

echo "✅ All production gates passed. Deployment approved!"
```

## Test Structure

Each gate includes comprehensive test scenarios:

### Example: Schema Strictness Tests

1. **schema_has_additional_properties_false**: Validates `additionalProperties: false`
2. **schema_has_unevaluated_properties_false**: Validates `unevaluatedProperties: false`
3. **validator_rejects_extra_properties**: Tests phantom field rejection
4. **schema_missing_strictness**: Negative test for non-strict schemas

### Test Result Format

```typescript
interface GateValidationResult {
  gate: string;
  passed: boolean;
  score: number; // 0.0 - 1.0
  details: any;
  recommendations?: string[];
  testResults?: Array<{
    scenario: string;
    passed: boolean;
    details: any;
  }>;
}
```

## Monitoring Integration

### Metrics Collection

The system exposes metrics for monitoring:

```typescript
// Example monitoring integration
class ProductionGateMonitoring {
  async collectMetrics(report: ProductionReadinessReport): Promise<void> {
    // Send metrics to monitoring system
    await this.sendMetric('production_gates.overall_score', report.overallScore);
    await this.sendMetric('production_gates.gates_passed', 
      report.gateResults.filter(g => g.passed).length);
    
    // Individual gate metrics
    report.gateResults.forEach(gate => {
      const gateName = gate.gate.toLowerCase().replace(/\s+/g, '_');
      await this.sendMetric(`production_gates.${gateName}.score`, gate.score);
      await this.sendMetric(`production_gates.${gateName}.passed`, gate.passed ? 1 : 0);
    });
    
    // Alerts
    if (!report.readyForProduction) {
      await this.sendAlert('critical', 'Production deployment blocked by gate failures', {
        failed_gates: report.gateResults.filter(g => !g.passed).map(g => g.gate)
      });
    }
  }
}
```

### Scheduled Validation

```typescript
// Example: Hourly production health checks
setInterval(async () => {
  const runner = new ProductionGateRunner();
  const criticalGates = ['Schema Strictness', 'Anti-Hallucination', 'Performance'];
  const results = await runner.runSpecificGates(criticalGates);
  
  const allPassed = results.every(gate => gate.passed);
  if (!allPassed) {
    await alertingSystem.sendAlert('Production gate failure detected in scheduled check');
  }
}, 60 * 60 * 1000); // Every hour
```

## Customization

### Adding Custom Gates

```typescript
class CustomProductionGateValidator extends ProductionGateValidator {
  async validateCustomSecurityRequirements(): Promise<GateValidationResult> {
    // Implement organization-specific requirements
    const securityChecks = [
      { name: 'ssl_certificate_valid', passed: true },
      { name: 'api_rate_limiting_enabled', passed: true },
      // ... more checks
    ];
    
    const passedCount = securityChecks.filter(check => check.passed).length;
    const score = passedCount / securityChecks.length;
    
    return {
      gate: 'Custom Security',
      passed: score >= 1.0,
      score,
      details: { security_checks: securityChecks }
    };
  }
}
```

### Environment-Specific Configuration

```typescript
const gateConfig = {
  development: {
    requiredScore: 0.8,
    skipGates: ['Performance'] // Skip performance tests in dev
  },
  staging: {
    requiredScore: 0.95,
    skipGates: []
  },
  production: {
    requiredScore: 1.0, // All gates must pass
    skipGates: []
  }
};
```

## Troubleshooting

### Common Issues

#### Gate 1: Schema Strictness Failures
- **Issue**: Phantom fields not being rejected
- **Solution**: Ensure AJV is configured with `strict: true, unevaluated: true`
- **Check**: Verify schema has `additionalProperties: false`

#### Gate 2: Anchor ID System Failures  
- **Issue**: CSS selectors exposed to LLM
- **Solution**: Use only opaque IDs like `n_12345` in LLM communication
- **Check**: Implement cross-validation to verify anchor values

#### Gate 7: Anti-Hallucination Failures
- **Issue**: Golden tests failing
- **Solution**: Implement evidence requirements for all fields
- **Check**: Run golden test suite: "no emails → no email field"

#### Gate 8: Performance Failures
- **Issue**: P95 latency > 5s
- **Solution**: Optimize extraction pipeline, implement caching
- **Check**: Load test across various website types

### Debug Mode

```typescript
// Enable detailed logging
process.env.PRODUCTION_GATE_DEBUG = 'true';

const validator = new ProductionGateValidator();
const report = await validator.runFullValidation();
```

### Manual Validation Commands

```bash
# Test specific gate with maximum verbosity
npx tsx src/production-gate-runner.ts gate "Schema Strictness" --verbose

# Run pre-flight with debug output
DEBUG=production-gates:* npm run production-gates:preflight

# Generate detailed report
npx tsx src/production-gate-runner.ts all --report detailed-report.json --verbose
```

## Production Deployment Checklist

Before deploying to production, ensure:

- [ ] All 10 production gates pass (100% score required)
- [ ] Pre-flight checklist passes
- [ ] CI/CD pipeline includes gate validation
- [ ] Monitoring and alerting configured
- [ ] Rollback procedures tested
- [ ] Team trained on gate requirements

### Final Verification Commands

```bash
# 1. Schema strictness enforcement
curl -X POST /api/extract -d '{"url":"test.com","query":"extract names"}' | jq '.result.data[0] | keys | length > 3' # Should be false

# 2. Anchor ID validation
curl -X POST /api/extract -d '{"url":"test.com","query":"extract emails"}' | grep -o '"n_[0-9]*"' | wc -l # Should be > 0

# 3. Performance benchmark  
time curl -X POST /api/extract -d '{"url":"large-site.com","query":"extract all data"}' # Should complete < 5s

# 4. Kill switch test
curl -X POST /admin/feature-flags -d '{"evidence_first_enabled": false}' && curl -X POST /api/extract -d '{"url":"test.com","query":"test"}' | jq '.result.metadata.processing_method' # Should fallback
```

## Support

For issues with the Production Gate Checklist system:

1. Check the [troubleshooting section](#troubleshooting)
2. Run gates individually to isolate issues
3. Enable debug mode for detailed logging
4. Review test results for specific failure details

The Production Readiness Gate system ensures that the Evidence-First Adaptive Extraction system meets all critical requirements for production deployment with comprehensive validation, monitoring, and safety guarantees.