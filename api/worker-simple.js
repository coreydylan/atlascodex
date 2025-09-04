// Atlas Codex Worker - Basic extraction without external dependencies
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

// Initialize clients
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });

// Update job status in DynamoDB
async function updateJobStatus(jobId, status, result = null, error = null) {
  const updateExpression = ['SET #status = :status', '#updatedAt = :updatedAt'];
  const expressionAttributeNames = {
    '#status': 'status',
    '#updatedAt': 'updatedAt'
  };
  const expressionAttributeValues = {
    ':status': { S: status },
    ':updatedAt': { N: Date.now().toString() }
  };

  if (result) {
    updateExpression.push('#result = :result');
    expressionAttributeNames['#result'] = 'result';
    expressionAttributeValues[':result'] = { 
      S: JSON.stringify(result) 
    };
  }

  if (error) {
    updateExpression.push('#error = :error');
    expressionAttributeNames['#error'] = 'error';
    expressionAttributeValues[':error'] = { S: error };
  }

  try {
    await dynamodb.send(new UpdateItemCommand({
      TableName: 'atlas-codex-jobs',
      Key: { id: { S: jobId } },
      UpdateExpression: updateExpression.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }));
    console.log(`Job ${jobId} updated to status: ${status}`);
  } catch (err) {
    console.error(`Failed to update job ${jobId}:`, err);
    throw err;
  }
}

// Simple extraction using built-in fetch
async function performExtraction(jobId, params) {
  try {
    console.log(`Starting extraction for job ${jobId}:`, params);
    
    // Update status to processing
    await updateJobStatus(jobId, 'processing');
    
    // Use built-in fetch for basic extraction
    const response = await fetch(params.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AtlasCodex/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Basic title extraction
    const titleMatch = html.match(/<title[^>]*>([^<]+)</i);
    const title = titleMatch ? titleMatch[1].trim() : 'Extracted Content';
    
    // Basic content extraction (remove HTML tags)
    const content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000); // Limit content length
    
    // Prepare result in Atlas Codex format
    const result = {
      success: true,
      data: {
        title: title,
        content: content,
        url: params.url,
        metadata: {
          strategy: 'basic_fetch',
          extractedAt: new Date().toISOString(),
          sourceUrl: params.url
        }
      },
      metadata: {
        strategy: 'basic_fetch',
        cost: 0.0001,
        responseTime: Date.now() - parseInt(jobId.split('_')[1]),
        success: true
      }
    };
    
    // Update job with result
    await updateJobStatus(jobId, 'completed', result);
    
    console.log(`Job ${jobId} completed successfully`);
    return result;
    
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  }
}

// Lambda handler for SQS events
exports.handler = async (event) => {
  console.log('Worker received event:', JSON.stringify(event, null, 2));
  
  const results = [];
  
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const { jobId, type, params } = message;
      
      console.log(`Processing ${type} job: ${jobId}`);
      
      let result;
      switch (type) {
        case 'extract':
        case 'scrape':
          result = await performExtraction(jobId, params);
          break;
          
        default:
          throw new Error(`Unknown job type: ${type}`);
      }
      
      results.push({
        jobId,
        status: 'success',
        result
      });
      
    } catch (error) {
      console.error('Failed to process record:', error);
      results.push({
        messageId: record.messageId,
        status: 'error',
        error: error.message
      });
    }
  }
  
  // Return batch failures for SQS retry handling
  const failedMessages = results
    .filter(r => r.status === 'error')
    .map(r => ({ itemIdentifier: r.messageId }));
  
  console.log(`Processed ${results.length} messages, ${failedMessages.length} failures`);
  
  return {
    batchItemFailures: failedMessages
  };
};