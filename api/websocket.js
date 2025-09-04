// Atlas Codex WebSocket Handlers
const { DynamoDBClient, PutItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });

// WebSocket connect handler
exports.connect = async (event) => {
  const { connectionId } = event.requestContext;
  
  try {
    await dynamodb.send(new PutItemCommand({
      TableName: process.env.CONNECTIONS_TABLE || 'atlas-codex-connections',
      Item: {
        connectionId: { S: connectionId },
        timestamp: { N: Date.now().toString() },
        ttl: { N: Math.floor(Date.now() / 1000) + 3600 } // 1 hour TTL
      }
    }));
    
    console.log(`WebSocket connected: ${connectionId}`);
    return { statusCode: 200 };
  } catch (error) {
    console.error('WebSocket connect error:', error);
    return { statusCode: 500 };
  }
};

// WebSocket disconnect handler
exports.disconnect = async (event) => {
  const { connectionId } = event.requestContext;
  
  try {
    await dynamodb.send(new DeleteItemCommand({
      TableName: process.env.CONNECTIONS_TABLE || 'atlas-codex-connections',
      Key: {
        connectionId: { S: connectionId }
      }
    }));
    
    console.log(`WebSocket disconnected: ${connectionId}`);
    return { statusCode: 200 };
  } catch (error) {
    console.error('WebSocket disconnect error:', error);
    return { statusCode: 500 };
  }
};

// WebSocket default handler
exports.default = async (event) => {
  const { connectionId } = event.requestContext;
  console.log(`WebSocket message from ${connectionId}:`, event.body);
  
  // Echo the message back for now
  return { statusCode: 200 };
};