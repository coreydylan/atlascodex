// tests/__mocks__/openai.js

// Mock factory function that creates successful responses
const mockSuccessfulResponse = (model = 'gpt-5-mini', content = '{"success": true}') => ({
  choices: [{
    message: {
      content
    }
  }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150
  },
  model
});

// Mock factory for error responses
const mockErrorResponse = (message = 'API Error') => {
  const error = new Error(message);
  error.status = 401;
  error.code = 'invalid_api_key';
  return error;
};

// Create mock function
const mockCreate = async (params) => {
  const { model = 'gpt-5-mini', messages = [] } = params;
  
  // Simulate API key validation
  if (process.env.OPENAI_API_KEY === 'test-api-key-mock') {
    // In test mode, return successful mocked responses
    const userMessage = messages.find(msg => msg.role === 'user')?.content || '';
    
    // Return appropriate mock response based on request
    if (userMessage.includes('Extract the title')) {
      return mockSuccessfulResponse('gpt-5-nano', '{"title": "Simple Title"}');
    } else if (userMessage.includes('simple')) {
      return mockSuccessfulResponse('gpt-5-nano', '{"url": "https://example.com", "type": "scrape", "formats": ["structured"]}');
    } else if (userMessage.includes('complex') || userMessage.includes('reasoning')) {
      return mockSuccessfulResponse('gpt-5', '{"url": "https://example.com", "type": "crawl", "formats": ["structured"], "reasoning": true}');
    } else {
      return mockSuccessfulResponse(model, '{"url": "https://example.com", "type": "scrape", "formats": ["structured"]}');
    }
  }
  
  // Simulate real API key validation failure
  throw mockErrorResponse('Incorrect API key provided');
};

// Create the mock OpenAI class
class MockOpenAI {
  constructor() {
    this.chat = {
      completions: {
        create: mockCreate
      }
    };
  }
}

module.exports = MockOpenAI;
module.exports.mockSuccessfulResponse = mockSuccessfulResponse;
module.exports.mockErrorResponse = mockErrorResponse;