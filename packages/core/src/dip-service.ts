// Atlas Codex - DIP Service for Database Operations
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DomainIntelligenceProfile, DomainIntelligenceProfileSchema, isDIPStale } from './dip';

export class DIPService {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(process.env.DYNAMODB_ENDPOINT && {
        endpoint: process.env.DYNAMODB_ENDPOINT
      })
    });
    
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.DYNAMODB_DIPS_TABLE || 'atlas-codex-dips-dev';
  }

  /**
   * Get a DIP for a specific domain
   */
  async getDIP(domain: string): Promise<DomainIntelligenceProfile | null> {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { domain }
      });

      const response = await this.docClient.send(command);
      
      if (!response.Item) {
        return null;
      }

      // Validate with Zod schema
      const validated = DomainIntelligenceProfileSchema.parse(response.Item);
      return validated;
    } catch (error) {
      console.error(`Error getting DIP for ${domain}:`, error);
      return null;
    }
  }

  /**
   * Save or update a DIP
   */
  async saveDIP(dip: DomainIntelligenceProfile): Promise<void> {
    try {
      // Validate with Zod before saving
      const validated = DomainIntelligenceProfileSchema.parse(dip);
      
      const command = new PutCommand({
        TableName: this.tableName,
        Item: validated,
        ConditionExpression: 'attribute_not_exists(domain) OR #version < :version',
        ExpressionAttributeNames: {
          '#version': 'version'
        },
        ExpressionAttributeValues: {
          ':version': validated.version
        }
      });

      await this.docClient.send(command);
      console.log(`✅ DIP saved for domain: ${dip.domain} (v${dip.version})`);
    } catch (error) {
      const err = error as Error;
      if (err.name === 'ConditionalCheckFailedException') {
        console.warn(`DIP version conflict for ${dip.domain}. A newer version exists.`);
      } else {
        console.error(`Error saving DIP for ${dip.domain}:`, error);
      }
      throw error;
    }
  }

  /**
   * Update specific fields of a DIP
   */
  async updateDIP(domain: string, updates: Partial<DomainIntelligenceProfile>): Promise<void> {
    try {
      // Build update expression dynamically
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'domain' && value !== undefined) {
          const placeholder = `#${key}`;
          const valuePlaceholder = `:${key}`;
          
          updateExpressions.push(`${placeholder} = ${valuePlaceholder}`);
          expressionAttributeNames[placeholder] = key;
          expressionAttributeValues[valuePlaceholder] = value;
        }
      });

      // Always update lastUpdated
      updateExpressions.push('#lastUpdated = :lastUpdated');
      expressionAttributeNames['#lastUpdated'] = 'lastUpdated';
      expressionAttributeValues[':lastUpdated'] = new Date().toISOString();

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { domain },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(domain)',
        ReturnValues: 'ALL_NEW'
      });

      const response = await this.docClient.send(command);
      console.log(`✅ DIP updated for domain: ${domain}`);
    } catch (error) {
      const err = error as Error;
      if (err.name === 'ConditionalCheckFailedException') {
        console.warn(`DIP not found for domain: ${domain}`);
      } else {
        console.error(`Error updating DIP for ${domain}:`, error);
      }
      throw error;
    }
  }

  /**
   * Check if a DIP is stale
   */
  async isDIPStale(domain: string, maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<boolean> {
    const dip = await this.getDIP(domain);
    
    if (!dip) {
      return true; // No DIP exists, so it's "stale"
    }

    return isDIPStale(dip, maxAgeMs);
  }

  /**
   * List all DIPs with optional limit
   */
  async listDIPs(limit?: number): Promise<DomainIntelligenceProfile[]> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        ...(limit && { Limit: limit })
      });

      const response = await this.docClient.send(command);
      
      if (!response.Items || response.Items.length === 0) {
        return [];
      }

      // Validate each item with Zod
      const validated = response.Items.map(item => 
        DomainIntelligenceProfileSchema.parse(item)
      );

      return validated;
    } catch (error) {
      console.error('Error listing DIPs:', error);
      return [];
    }
  }

  /**
   * Delete a DIP
   */
  async deleteDIP(domain: string): Promise<void> {
    try {
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: { domain },
        ConditionExpression: 'attribute_exists(domain)'
      });

      await this.docClient.send(command);
      console.log(`✅ DIP deleted for domain: ${domain}`);
    } catch (error) {
      const err = error as Error;
      if (err.name === 'ConditionalCheckFailedException') {
        console.warn(`DIP not found for domain: ${domain}`);
      } else {
        console.error(`Error deleting DIP for ${domain}:`, error);
      }
      throw error;
    }
  }

  /**
   * Get DIPs by confidence level
   */
  async getDIPsByConfidence(minConfidence: number): Promise<DomainIntelligenceProfile[]> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'confidence >= :minConfidence',
        ExpressionAttributeValues: {
          ':minConfidence': minConfidence
        }
      });

      const response = await this.docClient.send(command);
      
      if (!response.Items || response.Items.length === 0) {
        return [];
      }

      return response.Items.map(item => 
        DomainIntelligenceProfileSchema.parse(item)
      );
    } catch (error) {
      console.error('Error getting DIPs by confidence:', error);
      return [];
    }
  }

  /**
   * Get stale DIPs that need updating
   */
  async getStaleDIPs(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<DomainIntelligenceProfile[]> {
    const allDIPs = await this.listDIPs();
    return allDIPs.filter(dip => isDIPStale(dip, maxAgeMs));
  }

  /**
   * Get DIP statistics
   */
  async getDIPStatistics(): Promise<{
    totalDIPs: number;
    averageConfidence: number;
    strategyDistribution: Record<string, number>;
    staleDIPs: number;
  }> {
    const allDIPs = await this.listDIPs();
    
    if (allDIPs.length === 0) {
      return {
        totalDIPs: 0,
        averageConfidence: 0,
        strategyDistribution: {},
        staleDIPs: 0
      };
    }

    const strategyDistribution: Record<string, number> = {};
    let totalConfidence = 0;
    let staleDIPs = 0;

    allDIPs.forEach(dip => {
      // Count strategy usage
      const strategy = dip.optimalStrategy.strategy;
      strategyDistribution[strategy] = (strategyDistribution[strategy] || 0) + 1;
      
      // Sum confidence
      totalConfidence += dip.confidence;
      
      // Count stale DIPs
      if (isDIPStale(dip)) {
        staleDIPs++;
      }
    });

    return {
      totalDIPs: allDIPs.length,
      averageConfidence: totalConfidence / allDIPs.length,
      strategyDistribution,
      staleDIPs
    };
  }
}

// Export singleton instance
export const dipService = new DIPService();