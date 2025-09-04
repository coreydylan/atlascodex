/**
 * Stage Guards Usage Examples
 * Demonstrates how to use the budget and latency enforcement system
 */

import { 
  StageGuards, 
  executeStageWithGuards,
  BudgetAwareEvidenceProcessor,
  BudgetDashboard,
  withBudgetGuards 
} from './stage-guards';
import { MonitoringService } from './monitoring';

/**
 * Example 1: Basic Stage Execution with Guards
 */
async function basicGuardedExecution() {
  // Simple function that might exceed budget
  const expensiveOperation = async (): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return 'operation complete';
  };

  try {
    const result = await executeStageWithGuards(
      'contract_generation', 
      expensiveOperation, 
      450 // estimated tokens
    );
    console.log('Stage completed:', result);
  } catch (error) {
    console.error('Stage failed:', error.message);
  }
}

/**
 * Example 2: Custom Budget Configuration
 */
async function customBudgetExample() {
  const monitoring = new MonitoringService();
  const guards = new StageGuards(monitoring);

  // Set custom budget for a new stage
  guards.setBudget('custom_analysis', {
    maxTokens: 750,
    maxLatencyMs: 2000,
    enableAbstention: true,
    abstentionThreshold: 0.6
  });

  // Register custom fallback
  guards.registerAbstentionCallback('custom_analysis', async (stage, reason) => {
    return {
      analysis: 'simplified',
      reason: `Abstained due to ${reason}`,
      fallback: true
    };
  });

  const result = await guards.executeWithGuards('custom_analysis', async () => {
    // Simulate analysis work
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { analysis: 'complete', details: 'full analysis results' };
  });

  console.log('Custom analysis result:', result);
}

/**
 * Example 3: Class Method Decorator
 */
class ExampleProcessor {
  @withBudgetGuards('validation', 100)
  async validateData(data: any): Promise<any> {
    // This method is automatically wrapped with budget guards
    await new Promise(resolve => setTimeout(resolve, 300));
    return { valid: true, data };
  }

  @withBudgetGuards('augmentation', 400)
  async augmentData(data: any): Promise<any> {
    // Another guarded method
    await new Promise(resolve => setTimeout(resolve, 800));
    return { ...data, augmented: true };
  }
}

/**
 * Example 4: Evidence-First Processing with Budgets
 */
async function evidenceFirstExample() {
  const processor = new BudgetAwareEvidenceProcessor();

  const context = {
    query: 'Extract Stanford CS faculty information',
    url: 'https://cs.stanford.edu/people/faculty',
    html: '<html>mock faculty page content</html>'
  };

  try {
    const results = await processor.processWithBudgets(context);
    console.log('Evidence-first processing completed:', results.length, 'stages');
  } catch (error) {
    console.error('Processing failed:', error.message);
  }
}

/**
 * Example 5: Budget Monitoring Dashboard
 */
async function monitoringDashboardExample() {
  const monitoring = new MonitoringService();
  const guards = new StageGuards(monitoring);
  const dashboard = new BudgetDashboard(guards);

  // Enable auto-adjustment
  const adjustmentInterval = dashboard.enableAutoAdjustment(10000); // Every 10 seconds

  // Run some operations to generate metrics
  for (let i = 0; i < 5; i++) {
    await executeStageWithGuards('contract_generation', async () => {
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
      return `contract_${i}`;
    }, 100 + Math.random() * 50);
  }

  // Get dashboard data
  const dashboardData = dashboard.getDashboardData();
  console.log('Budget Dashboard Data:');
  console.log('- Budget Status:', Object.keys(dashboardData.budgetStatus));
  console.log('- Report Summary:', dashboardData.budgetReport.summary);
  console.log('- Recommendations:', dashboardData.budgetReport.recommendations);

  clearInterval(adjustmentInterval);
}

/**
 * Example 6: Emergency Scenarios
 */
async function emergencyScenarioExample() {
  const monitoring = new MonitoringService();
  const guards = new StageGuards(monitoring);

  // Enable debug mode to see all events
  guards.enableDebugMode();

  // Simulate emergency scenario
  setTimeout(() => {
    guards.emergencyShutdown('High error rate detected');
  }, 1000);

  // Try to execute after emergency shutdown
  setTimeout(async () => {
    try {
      await guards.executeWithGuards('contract_generation', async () => {
        return 'should fail';
      });
    } catch (error) {
      console.log('Expected failure after emergency shutdown:', error.message);
    }
  }, 2000);
}

// Export examples for testing
export {
  basicGuardedExecution,
  customBudgetExample,
  ExampleProcessor,
  evidenceFirstExample,
  monitoringDashboardExample,
  emergencyScenarioExample
};
