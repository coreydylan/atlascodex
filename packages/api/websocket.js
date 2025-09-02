// Atlas Codex WebSocket Handler - Real-time job updates
const { DynamoDBClient, PutItemCommand, DeleteItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });

// Store WebSocket connection
exports.connect = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const timestamp = Date.now();
  
  try {
    await dynamodb.send(new PutItemCommand({
      TableName: process.env.CONNECTIONS_TABLE || 'atlas-codex-connections',
      Item: {
        connectionId: { S: connectionId },
        timestamp: { N: timestamp.toString() },
        ttl: { N: Math.floor((timestamp + 3600000) / 1000).toString() } // 1 hour TTL
      }
    }));
    
    console.log('WebSocket connected:', connectionId);
    
    return {
      statusCode: 200,
      body: 'Connected'
    };
  } catch (error) {
    console.error('Connection error:', error);
    return {
      statusCode: 500,
      body: 'Failed to connect'
    };
  }
};

// Remove WebSocket connection
exports.disconnect = async (event) => {
  const connectionId = event.requestContext.connectionId;
  
  try {
    await dynamodb.send(new DeleteItemCommand({
      TableName: process.env.CONNECTIONS_TABLE || 'atlas-codex-connections',
      Key: {
        connectionId: { S: connectionId }
      }
    }));
    
    console.log('WebSocket disconnected:', connectionId);
    
    return {
      statusCode: 200,
      body: 'Disconnected'
    };
  } catch (error) {
    console.error('Disconnect error:', error);
    return {
      statusCode: 500,
      body: 'Failed to disconnect'
    };
  }
};

// Handle default WebSocket messages
exports.default = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const body = JSON.parse(event.body || '{}');
  
  console.log('WebSocket message:', body);
  
  // Echo back for now
  const apiGateway = new ApiGatewayManagementApiClient({
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`
  });
  
  try {
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        type: 'echo',
        message: 'WebSocket connection working!',
        timestamp: Date.now()
      })
    }));
    
    return {
      statusCode: 200,
      body: 'Message sent'
    };
  } catch (error) {
    console.error('Send message error:', error);
    return {
      statusCode: 500,
      body: 'Failed to send message'
    };
  }
};

// Broadcast job updates to all connected clients
exports.broadcastJobUpdate = async (jobId, status, result = null, error = null) => {
  try {
    // Get all active connections
    const connections = await dynamodb.send(new ScanCommand({
      TableName: process.env.CONNECTIONS_TABLE || 'atlas-codex-connections',
      ProjectionExpression: 'connectionId'
    }));
    
    if (!connections.Items || connections.Items.length === 0) {
      console.log('No active WebSocket connections');
      return;
    }
    
    const apiGateway = new ApiGatewayManagementApiClient({
      endpoint: process.env.WEBSOCKET_API_ENDPOINT?.replace('wss://', 'https://') || 'https://example.com'
    });
    
    const message = JSON.stringify({
      type: 'job_update',
      jobId: jobId,
      status: status,
      result: result,
      error: error,
      timestamp: Date.now()
    });
    
    const sendPromises = connections.Items.map(async (connection) => {
      const connectionId = connection.connectionId.S;
      
      try {
        await apiGateway.send(new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: message
        }));
        console.log(`Sent update to connection ${connectionId}`);
      } catch (error) {
        console.error(`Failed to send to ${connectionId}:`, error);
        
        // Remove stale connection
        if (error.name === 'GoneException') {
          await dynamodb.send(new DeleteItemCommand({
            TableName: process.env.CONNECTIONS_TABLE || 'atlas-codex-connections',
            Key: { connectionId: { S: connectionId } }
          }));
        }
      }
    });
    
    await Promise.all(sendPromises);
    console.log(`Broadcasted job update for ${jobId} to ${connections.Items.length} connections`);
    
  } catch (error) {
    console.error('Broadcast error:', error);
  }
};