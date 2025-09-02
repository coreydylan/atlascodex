// Job Monitor - Detects and handles stuck jobs
const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-west-2' });

// Check for stuck jobs and handle them
exports.handler = async (event) => {
  console.log('🔍 Job Monitor running...');
  
  const now = Date.now();
  const STUCK_THRESHOLD = 5 * 60 * 1000; // 5 minutes
  const HEARTBEAT_THRESHOLD = 2 * 60 * 1000; // 2 minutes
  
  try {
    // Scan for jobs in 'processing' status
    const scanResult = await dynamodb.send(new ScanCommand({
      TableName: process.env.JOBS_TABLE || 'atlas-codex-jobs',
      FilterExpression: '#status = :processing',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':processing': { S: 'processing' }
      }
    }));
    
    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.log('✅ No processing jobs found');
      return { statusCode: 200, message: 'No stuck jobs' };
    }
    
    console.log(`Found ${scanResult.Items.length} processing jobs to check`);
    
    const stuckJobs = [];
    const recoveredJobs = [];
    
    for (const item of scanResult.Items) {
      const jobId = item.id.S;
      const updatedAt = parseInt(item.updatedAt?.N || '0');
      const heartbeat = parseInt(item.heartbeat?.N || '0');
      const createdAt = parseInt(item.createdAt?.N || updatedAt);
      
      const timeSinceUpdate = now - updatedAt;
      const timeSinceHeartbeat = now - heartbeat;
      const totalJobTime = now - createdAt;
      
      console.log(`Job ${jobId}:`, {
        timeSinceUpdate: Math.round(timeSinceUpdate / 1000) + 's',
        timeSinceHeartbeat: Math.round(timeSinceHeartbeat / 1000) + 's',
        totalJobTime: Math.round(totalJobTime / 1000) + 's'
      });
      
      // Check if job is stuck
      let isStuck = false;
      let reason = '';
      
      // Job has been running too long without updates
      if (timeSinceUpdate > STUCK_THRESHOLD) {
        isStuck = true;
        reason = `No update for ${Math.round(timeSinceUpdate / 1000)}s`;
      }
      
      // Heartbeat has stopped (if heartbeat exists)
      if (heartbeat > 0 && timeSinceHeartbeat > HEARTBEAT_THRESHOLD) {
        isStuck = true;
        reason = `Heartbeat stopped ${Math.round(timeSinceHeartbeat / 1000)}s ago`;
      }
      
      // Job has been running for more than 10 minutes total
      if (totalJobTime > 10 * 60 * 1000) {
        isStuck = true;
        reason = `Running for ${Math.round(totalJobTime / 60000)} minutes`;
      }
      
      if (isStuck) {
        console.log(`⚠️ Job ${jobId} appears stuck: ${reason}`);
        stuckJobs.push({ jobId, reason });
        
        // Try to recover or mark as failed
        try {
          // Check if job has partial results
          const hasResults = item.result?.S || item.extractedData?.L?.length > 0;
          
          if (hasResults) {
            // Mark as completed with partial results
            await dynamodb.send(new UpdateItemCommand({
              TableName: process.env.JOBS_TABLE || 'atlas-codex-jobs',
              Key: { id: { S: jobId } },
              UpdateExpression: 'SET #status = :completed, #error = :error, #updatedAt = :now',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#error': 'error',
                '#updatedAt': 'updatedAt'
              },
              ExpressionAttributeValues: {
                ':completed': { S: 'completed' },
                ':error': { S: `Job recovered by monitor: ${reason} (partial results available)` },
                ':now': { N: now.toString() }
              }
            }));
            
            console.log(`✅ Recovered job ${jobId} with partial results`);
            recoveredJobs.push({ jobId, status: 'completed_partial' });
            
          } else {
            // Mark as failed
            await dynamodb.send(new UpdateItemCommand({
              TableName: process.env.JOBS_TABLE || 'atlas-codex-jobs',
              Key: { id: { S: jobId } },
              UpdateExpression: 'SET #status = :failed, #error = :error, #updatedAt = :now',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#error': 'error',
                '#updatedAt': 'updatedAt'
              },
              ExpressionAttributeValues: {
                ':failed': { S: 'failed' },
                ':error': { S: `Job terminated by monitor: ${reason}` },
                ':now': { N: now.toString() }
              }
            }));
            
            console.log(`❌ Marked job ${jobId} as failed`);
            recoveredJobs.push({ jobId, status: 'failed' });
            
            // Send to DLQ for investigation
            if (process.env.DLQ_URL) {
              await sqs.send(new SendMessageCommand({
                QueueUrl: process.env.DLQ_URL,
                MessageBody: JSON.stringify({
                  jobId,
                  reason,
                  originalJob: item,
                  timestamp: new Date().toISOString()
                })
              }));
            }
          }
          
        } catch (err) {
          console.error(`Failed to recover job ${jobId}:`, err);
        }
      }
    }
    
    // Check for orphaned jobs (created but never started)
    const orphanScanResult = await dynamodb.send(new ScanCommand({
      TableName: process.env.JOBS_TABLE || 'atlas-codex-jobs',
      FilterExpression: '#status = :pending AND #createdAt < :threshold',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#createdAt': 'createdAt'
      },
      ExpressionAttributeValues: {
        ':pending': { S: 'pending' },
        ':threshold': { N: (now - 10 * 60 * 1000).toString() } // 10 minutes old
      }
    }));
    
    if (orphanScanResult.Items && orphanScanResult.Items.length > 0) {
      console.log(`Found ${orphanScanResult.Items.length} orphaned pending jobs`);
      
      for (const item of orphanScanResult.Items) {
        const jobId = item.id.S;
        
        await dynamodb.send(new UpdateItemCommand({
          TableName: process.env.JOBS_TABLE || 'atlas-codex-jobs',
          Key: { id: { S: jobId } },
          UpdateExpression: 'SET #status = :failed, #error = :error, #updatedAt = :now',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#error': 'error',
            '#updatedAt': 'updatedAt'
          },
          ExpressionAttributeValues: {
            ':failed': { S: 'failed' },
            ':error': { S: 'Job never started - marked as failed by monitor' },
            ':now': { N: now.toString() }
          }
        }));
        
        console.log(`❌ Marked orphaned job ${jobId} as failed`);
      }
    }
    
    // Log summary
    const summary = {
      checked: scanResult.Items.length,
      stuck: stuckJobs.length,
      recovered: recoveredJobs.length,
      orphaned: orphanScanResult.Items?.length || 0
    };
    
    console.log('📊 Monitor Summary:', summary);
    
    // Send alert if there are stuck jobs
    if (stuckJobs.length > 0) {
      console.error('🚨 ALERT: Found stuck jobs:', stuckJobs);
      // Here you could send an SNS notification, Slack message, etc.
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify(summary)
    };
    
  } catch (error) {
    console.error('Monitor error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Cleanup old completed jobs (optional)
async function cleanupOldJobs() {
  const RETENTION_DAYS = 7;
  const cutoffTime = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
  
  try {
    const scanResult = await dynamodb.send(new ScanCommand({
      TableName: process.env.JOBS_TABLE || 'atlas-codex-jobs',
      FilterExpression: '#status IN (:completed, :failed) AND #updatedAt < :cutoff',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':completed': { S: 'completed' },
        ':failed': { S: 'failed' },
        ':cutoff': { N: cutoffTime.toString() }
      }
    }));
    
    if (scanResult.Items && scanResult.Items.length > 0) {
      console.log(`Found ${scanResult.Items.length} old jobs to clean up`);
      
      // Set TTL on old jobs instead of deleting immediately
      for (const item of scanResult.Items) {
        await dynamodb.send(new UpdateItemCommand({
          TableName: process.env.JOBS_TABLE || 'atlas-codex-jobs',
          Key: { id: { S: item.id.S } },
          UpdateExpression: 'SET #ttl = :ttl',
          ExpressionAttributeNames: { '#ttl': 'ttl' },
          ExpressionAttributeValues: {
            ':ttl': { N: Math.floor(Date.now() / 1000 + 86400).toString() } // Delete in 24 hours
          }
        }));
      }
    }
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}