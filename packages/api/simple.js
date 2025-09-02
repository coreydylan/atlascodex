// Simple test handler
exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: 'Atlas Codex API is running!',
      path: event.path,
      method: event.httpMethod,
      timestamp: new Date().toISOString()
    })
  };
};