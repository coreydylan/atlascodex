// tests/setup.js - Jest test setup configuration
require('dotenv').config();

// Mock OpenAI for testing
jest.mock('openai');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.GPT5_ENABLED = 'true';
process.env.GPT5_FALLBACK_ENABLED = 'true';
process.env.GPT5_REASONING_ENABLED = 'true';

// Mock environment variables for testing
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'test-api-key-mock';
}

// Set test timeouts
jest.setTimeout(30000);

// Global test helpers
global.mockAIResponse = (model, content, tokens = { prompt_tokens: 100, completion_tokens: 50 }) => ({
  content,
  model,
  usage: {
    ...tokens,
    total_tokens: tokens.prompt_tokens + tokens.completion_tokens
  },
  cost: {
    inputCost: (tokens.prompt_tokens / 1_000_000) * getModelPrice(model).input,
    outputCost: (tokens.completion_tokens / 1_000_000) * getModelPrice(model).output,
    get total() { return this.inputCost + this.outputCost; }
  }
});

function getModelPrice(model) {
  const prices = {
    'gpt-5': { input: 1.25, output: 10 },
    'gpt-5-mini': { input: 0.25, output: 2 },
    'gpt-5-nano': { input: 0.05, output: 0.40 },
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03 }
  };
  return prices[model] || { input: 0.01, output: 0.03 };
}

// Console setup for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  if (process.env.VERBOSE_TESTS !== 'true') {
    console.log = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  // Restore console functions
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});