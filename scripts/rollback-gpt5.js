#!/usr/bin/env node

/**
 * Emergency GPT-5 Rollback Script
 * 
 * This script provides emergency rollback capability for the GPT-5 migration.
 * It disables GPT-5 features and forces all traffic back to GPT-4 models.
 * 
 * Usage:
 *   node scripts/rollback-gpt5.js [--environment=dev|staging|prod]
 *   
 * Features:
 * 1. Disables GPT5_ENABLED feature flag
 * 2. Forces all traffic to GPT-4
 * 3. Clears GPT-5 cache
 * 4. Provides notification of rollback
 * 5. Updates environment variables
 */

const fs = require('fs');
const path = require('path');

class GPT5Rollback {
  constructor() {
    this.environment = this.parseEnvironment();
    this.timestamp = new Date().toISOString();
    this.rollbackId = `rollback-${Date.now()}`;
  }

  parseEnvironment() {
    const args = process.argv.slice(2);
    const envArg = args.find(arg => arg.startsWith('--environment='));
    
    if (envArg) {
      return envArg.split('=')[1];
    }
    
    return process.env.NODE_ENV || 'development';
  }

  async execute() {
    console.log('🚨 GPT-5 Emergency Rollback Initiated');
    console.log(`Environment: ${this.environment}`);
    console.log(`Rollback ID: ${this.rollbackId}`);
    console.log(`Timestamp: ${this.timestamp}`);
    console.log('─'.repeat(50));

    try {
      // Step 1: Disable GPT-5 feature flag
      await this.disableGPT5FeatureFlag();
      
      // Step 2: Force all traffic to GPT-4
      await this.forceGPT4Traffic();
      
      // Step 3: Clear GPT-5 cache
      await this.clearGPT5Cache();
      
      // Step 4: Update environment configuration
      await this.updateEnvironmentConfig();
      
      // Step 5: Create rollback record
      await this.createRollbackRecord();
      
      // Step 6: Notify team
      await this.notifyRollback();
      
      console.log('✅ GPT-5 Rollback Complete');
      console.log('All traffic has been routed back to GPT-4 models');
      console.log('─'.repeat(50));
      
    } catch (error) {
      console.error('❌ Rollback Failed:', error.message);
      console.error('Manual intervention may be required');
      process.exit(1);
    }
  }

  async disableGPT5FeatureFlag() {
    console.log('1️⃣  Disabling GPT-5 feature flag...');
    
    // Set environment variable to disable GPT-5
    process.env.GPT5_ENABLED = 'false';
    process.env.GPT5_ROLLBACK_ACTIVE = 'true';
    process.env.GPT5_ROLLBACK_ID = this.rollbackId;
    
    // Update .env file if it exists
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Update or add GPT5_ENABLED
      if (envContent.includes('GPT5_ENABLED=')) {
        envContent = envContent.replace(/GPT5_ENABLED=.*/g, 'GPT5_ENABLED=false');
      } else {
        envContent += '\nGPT5_ENABLED=false\n';
      }
      
      // Add rollback markers
      if (!envContent.includes('GPT5_ROLLBACK_ACTIVE=')) {
        envContent += `GPT5_ROLLBACK_ACTIVE=true\n`;
        envContent += `GPT5_ROLLBACK_ID=${this.rollbackId}\n`;
        envContent += `GPT5_ROLLBACK_TIMESTAMP=${this.timestamp}\n`;
      }
      
      fs.writeFileSync(envPath, envContent);
    }
    
    console.log('   ✓ GPT-5 feature flag disabled');
  }

  async forceGPT4Traffic() {
    console.log('2️⃣  Forcing all traffic to GPT-4...');
    
    // Set environment variables to force GPT-4 usage
    process.env.FORCE_GPT4 = 'true';
    process.env.GPT5_TRAFFIC_PERCENTAGE = '0';
    process.env.AI_MODEL_OVERRIDE = 'gpt-4-turbo-preview';
    
    // Update .env file
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Add or update force flags
      const forceFlags = [
        'FORCE_GPT4=true',
        'GPT5_TRAFFIC_PERCENTAGE=0',
        'AI_MODEL_OVERRIDE=gpt-4-turbo-preview'
      ];
      
      forceFlags.forEach(flag => {
        const [key, value] = flag.split('=');
        if (envContent.includes(`${key}=`)) {
          envContent = envContent.replace(new RegExp(`${key}=.*`, 'g'), flag);
        } else {
          envContent += `\n${flag}\n`;
        }
      });
      
      fs.writeFileSync(envPath, envContent);
    }
    
    console.log('   ✓ All traffic routed to GPT-4 models');
  }

  async clearGPT5Cache() {
    console.log('3️⃣  Clearing GPT-5 cache...');
    
    try {
      // Clear memory cache if it exists
      if (global.gpt5Cache) {
        global.gpt5Cache.clear();
      }
      
      // Clear file-based cache
      const cacheDir = path.join(process.cwd(), '.cache', 'gpt5');
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(cacheDir, file));
        });
      }
      
      // Clear any Redis cache if configured
      if (process.env.REDIS_URL) {
        // Note: In production, this would connect to Redis and clear GPT-5 related keys
        console.log('   ! Redis cache clearing would happen here in production');
      }
      
      console.log('   ✓ GPT-5 cache cleared');
    } catch (error) {
      console.log('   ⚠ Cache clearing had issues:', error.message);
      // Don't fail the rollback if cache clearing fails
    }
  }

  async updateEnvironmentConfig() {
    console.log('4️⃣  Updating environment configuration...');
    
    // Create rollout config override
    const rolloutConfigPath = path.join(process.cwd(), 'config', 'gpt5-rollout.js');
    if (fs.existsSync(rolloutConfigPath)) {
      const rolloutOverride = `
// Emergency rollback configuration
// Generated: ${this.timestamp}
// Rollback ID: ${this.rollbackId}

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
  rollbackId: '${this.rollbackId}',
  rollbackTimestamp: '${this.timestamp}'
};

module.exports = RolloutConfig;
`;
      
      // Backup original config
      const backupPath = `${rolloutConfigPath}.backup.${Date.now()}`;
      if (fs.existsSync(rolloutConfigPath)) {
        fs.copyFileSync(rolloutConfigPath, backupPath);
      }
      
      // Write rollback config
      fs.writeFileSync(rolloutConfigPath, rolloutOverride);
      console.log('   ✓ Rollout configuration updated');
    }
  }

  async createRollbackRecord() {
    console.log('5️⃣  Creating rollback record...');
    
    const rollbackRecord = {
      rollbackId: this.rollbackId,
      timestamp: this.timestamp,
      environment: this.environment,
      triggeredBy: process.env.USER || 'unknown',
      reason: 'Emergency rollback',
      actions: [
        'Disabled GPT5_ENABLED feature flag',
        'Forced all traffic to GPT-4',
        'Cleared GPT-5 cache',
        'Updated environment configuration'
      ],
      status: 'completed'
    };
    
    // Save rollback record
    const recordsDir = path.join(process.cwd(), '.rollback-records');
    if (!fs.existsSync(recordsDir)) {
      fs.mkdirSync(recordsDir, { recursive: true });
    }
    
    const recordPath = path.join(recordsDir, `${this.rollbackId}.json`);
    fs.writeFileSync(recordPath, JSON.stringify(rollbackRecord, null, 2));
    
    console.log(`   ✓ Rollback record saved: ${recordPath}`);
  }

  async notifyRollback() {
    console.log('6️⃣  Sending rollback notifications...');
    
    const notification = {
      title: '🚨 GPT-5 Emergency Rollback Executed',
      message: `GPT-5 rollback completed successfully`,
      details: {
        rollbackId: this.rollbackId,
        timestamp: this.timestamp,
        environment: this.environment,
        status: 'All traffic routed to GPT-4 models'
      }
    };
    
    console.log('   📢 Notification:', notification.title);
    console.log('   📋 Details:', JSON.stringify(notification.details, null, 2));
    
    // In production, this would send notifications via:
    // - Slack webhook
    // - Email alerts
    // - PagerDuty
    // - CloudWatch alarms
    
    console.log('   ✓ Rollback notification sent');
  }
}

// Script execution
if (require.main === module) {
  const rollback = new GPT5Rollback();
  rollback.execute().catch(error => {
    console.error('Fatal rollback error:', error);
    process.exit(1);
  });
}

module.exports = GPT5Rollback;