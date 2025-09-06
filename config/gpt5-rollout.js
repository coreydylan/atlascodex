
// GPT-5 Production Rollout Configuration
// Updated: September 4, 2025
// GPT-5 Released: August 7, 2025
// Status: Active rollout starting at 10%

const RolloutConfig = {
  // Gradual rollout percentages by environment
  trafficPercentage: {
    development: 100,  // Full GPT-5 in dev for testing
    staging: 50,       // 50% traffic in staging for A/B testing
    production: 10     // Start with 10% in production
  },
  
  // GPT-5 feature flags
  features: {
    reasoning: true,           // Enable reasoning_effort parameter
    autoModelSelection: true,  // Enable tiered model selection
    costOptimization: true,    // Enable cost-based routing
    fallbackEnabled: true,     // Keep fallback for safety
    verbosityControl: true     // Enable verbosity parameter
  },
  
  // Model availability status
  models: {
    'gpt-5': {
      available: true,
      knowledgeCutoff: '2024-09-30'
    },
    'gpt-5-mini': {
      available: true,
      knowledgeCutoff: '2024-05-30'
    },
    'gpt-5-nano': {
      available: true,
      knowledgeCutoff: '2024-05-30'
    }
  },
  
  // Gradual rollout schedule
  schedule: [
    { date: '2025-09-04', percentage: 10 },  // Today - start small
    { date: '2025-09-06', percentage: 25 },  // After 2 days
    { date: '2025-09-08', percentage: 50 },  // After weekend
    { date: '2025-09-11', percentage: 75 },  // Mid-week next week
    { date: '2025-09-15', percentage: 100 }  // Full rollout
  ],
  
  // Should use GPT-5 based on traffic percentage
  shouldUseGPT5() {
    const env = process.env.NODE_ENV || 'development';
    const percentage = this.trafficPercentage[env];
    
    // Check if forced via environment variable
    if (process.env.FORCE_GPT5 === 'true') return true;
    if (process.env.FORCE_GPT4 === 'true') return false;
    
    // Random sampling based on percentage
    return Math.random() * 100 < percentage;
  },
  
  // Get current rollout status
  getStatus() {
    const now = new Date();
    const currentSchedule = this.schedule.find(s => 
      new Date(s.date) <= now
    );
    
    return {
      active: true,
      rollbackActive: false,
      currentPercentage: currentSchedule?.percentage || 10,
      environment: process.env.NODE_ENV || 'development',
      timestamp: now.toISOString()
    };
  },
  
  rollbackActive: false,
  rollbackId: null,
  rollbackTimestamp: null
};

module.exports = RolloutConfig;
