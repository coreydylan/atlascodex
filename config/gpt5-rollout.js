
// Emergency rollback configuration
// Generated: 2025-09-04T07:33:37.721Z
// Rollback ID: rollback-1756971217722

const RolloutConfig = {
  trafficPercentage: {
    development: 0,
    staging: 0,
    production: 0
  },
  
  features: {
    reasoning: false,
    autoModelSelection: false,
    costOptimization: false,
    fallbackEnabled: true
  },
  
  shouldUseGPT5() {
    return false; // Emergency rollback active
  },
  
  rollbackActive: true,
  rollbackId: 'rollback-1756971217722',
  rollbackTimestamp: '2025-09-04T07:33:37.721Z'
};

module.exports = RolloutConfig;
