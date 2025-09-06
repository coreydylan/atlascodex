/**
 * Centralized Environment Configuration
 * This file ensures all environment variables are properly synced across services
 */

const environments = {
  development: {
    API_URL: 'https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev',
    API_KEY: 'test-key-123',
    WEBSOCKET_URL: 'wss://dev-websocket.atlascodex.com',
    DYNAMODB_SUFFIX: 'dev',
    NODE_ENV: 'development'
  },
  production: {
    API_URL: 'https://s7vo1vic8b.execute-api.us-west-2.amazonaws.com/production',
    API_KEY: 'atlas-prod-key-2024',
    WEBSOCKET_URL: 'wss://prod-websocket.atlascodex.com',
    DYNAMODB_SUFFIX: 'production',
    NODE_ENV: 'production'
  }
};

// Get current environment
const env = process.env.NODE_ENV || process.env.VERCEL_ENV || 'development';
const config = environments[env] || environments.development;

// Export for Node.js (Lambda, serverless)
module.exports = {
  ...config,
  // Add service-specific prefixes
  getViteEnv() {
    return Object.entries(config).reduce((acc, [key, value]) => {
      acc[`VITE_${key}`] = value;
      return acc;
    }, {});
  },
  getProcessEnv() {
    return Object.entries(config).reduce((acc, [key, value]) => {
      acc[`REACT_APP_${key}`] = value; // For legacy support
      acc[key] = value;
      return acc;
    }, {});
  },
  // Validate that all required vars are present
  validate() {
    const required = ['API_URL', 'API_KEY', 'NODE_ENV'];
    const missing = required.filter(key => !config[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    return true;
  }
};