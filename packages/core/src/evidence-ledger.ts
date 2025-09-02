// Atlas Codex - Evidence Ledger
// Cryptographic evidence management for extraction verification

import { z } from 'zod';
import * as crypto from 'crypto';
import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

// Evidence schemas
export const EvidenceEntrySchema = z.object({
  id: z.string(),
  jobId: z.string(),
  domain: z.string(),
  url: z.string(),
  timestamp: z.string(),
  
  // Extraction evidence
  extraction: z.object({
    strategy: z.string(),
    duration: z.number(),
    dataHash: z.string(),
    htmlSnapshotHash: z.string().optional(),
    contentStats: z.object({
      titleLength: z.number(),
      contentLength: z.number(),
      imageCount: z.number(),
      linkCount: z.number()
    })
  }),
  
  // Cryptographic proof
  proof: z.object({
    hash: z.string(),
    signature: z.string(),
    algorithm: z.string(),
    nonce: z.string()
  }),
  
  // Chain reference
  chain: z.object({
    previousHash: z.string().optional(),
    blockNumber: z.number(),
    merkleRoot: z.string().optional()
  }),
  
  // Verification
  verification: z.object({
    verified: z.boolean(),
    verifiedAt: z.string().optional(),
    verifier: z.string().optional()
  })
});

export type EvidenceEntry = z.infer<typeof EvidenceEntrySchema>;

export const EvidenceLedgerSchema = z.object({
  domain: z.string(),
  entries: z.array(EvidenceEntrySchema),
  lastBlockNumber: z.number(),
  lastHash: z.string(),
  merkleTree: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type EvidenceLedger = z.infer<typeof EvidenceLedgerSchema>;

export class EvidenceLedgerService {
  private client: DynamoDBClient;
  private tableName: string;
  private secret: string;

  constructor(config?: { region?: string; tableName?: string; secret?: string }) {
    this.client = new DynamoDBClient({ 
      region: config?.region || process.env.AWS_REGION || 'us-west-2' 
    });
    this.tableName = config?.tableName || 'atlas-evidence-ledger';
    this.secret = config?.secret || process.env.EVIDENCE_SECRET || 'atlas-codex-evidence-v1';
  }

  /**
   * Create evidence entry for extraction
   */
  async createEvidence(
    jobId: string,
    url: string,
    extractionData: any,
    extractionMetadata: any
  ): Promise<EvidenceEntry> {
    const domain = new URL(url).hostname;
    const timestamp = new Date().toISOString();
    
    // Get previous entry for chain
    const previousEntry = await this.getLatestEntry(domain);
    
    // Generate evidence entry
    const entry: EvidenceEntry = {
      id: this.generateEvidenceId(jobId, timestamp),
      jobId,
      domain,
      url,
      timestamp,
      
      extraction: {
        strategy: extractionMetadata.strategy || 'unknown',
        duration: extractionMetadata.duration || 0,
        dataHash: this.hashData(extractionData),
        htmlSnapshotHash: extractionMetadata.htmlHash,
        contentStats: {
          titleLength: extractionData.title?.length || 0,
          contentLength: extractionData.content?.length || 0,
          imageCount: extractionData.images?.length || 0,
          linkCount: extractionData.links?.length || 0
        }
      },
      
      proof: this.generateProof(extractionData, extractionMetadata, previousEntry || undefined),
      
      chain: {
        previousHash: previousEntry?.proof?.hash,
        blockNumber: (previousEntry?.chain?.blockNumber || 0) + 1,
        merkleRoot: undefined // Will be calculated when building tree
      },
      
      verification: {
        verified: false
      }
    };
    
    // Store evidence
    await this.storeEvidence(entry);
    
    return entry;
  }

  /**
   * Generate cryptographic proof
   */
  private generateProof(
    data: any,
    metadata: any,
    previousEntry?: EvidenceEntry
  ): EvidenceEntry['proof'] {
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Create canonical representation
    const canonical = JSON.stringify({
      data: this.hashData(data),
      metadata: this.hashData(metadata),
      previous: previousEntry?.proof.hash || 'genesis',
      nonce
    });
    
    // Generate hash
    const hash = crypto
      .createHash('sha256')
      .update(canonical)
      .digest('hex');
    
    // Generate signature
    const signature = crypto
      .createHmac('sha512', this.secret)
      .update(hash)
      .digest('hex');
    
    return {
      hash,
      signature,
      algorithm: 'sha256-hmac-sha512',
      nonce
    };
  }

  /**
   * Verify evidence entry
   */
  async verifyEvidence(entry: EvidenceEntry): Promise<boolean> {
    try {
      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha512', this.secret)
        .update(entry.proof.hash)
        .digest('hex');
      
      if (entry.proof.signature !== expectedSignature) {
        console.error('Signature verification failed');
        return false;
      }
      
      // Verify chain if not genesis block
      if (entry.chain.previousHash) {
        const previousEntry = await this.getEntryByHash(entry.chain.previousHash);
        if (!previousEntry) {
          console.error('Previous entry not found in chain');
          return false;
        }
        
        // Verify block number sequence
        if (entry.chain.blockNumber !== previousEntry.chain.blockNumber + 1) {
          console.error('Invalid block number sequence');
          return false;
        }
      }
      
      // Update verification status
      entry.verification = {
        verified: true,
        verifiedAt: new Date().toISOString(),
        verifier: 'EvidenceLedgerService'
      };
      
      await this.updateVerification(entry.id, entry.verification);
      
      return true;
    } catch (error) {
      console.error('Evidence verification failed:', error);
      return false;
    }
  }

  /**
   * Build Merkle tree for entries
   */
  buildMerkleTree(entries: EvidenceEntry[]): string[] {
    if (entries.length === 0) return [];
    
    // Leaf nodes are entry hashes
    let level = entries.map(e => e.proof.hash);
    const tree = [...level];
    
    // Build tree levels
    while (level.length > 1) {
      const newLevel: string[] = [];
      
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left; // Duplicate if odd number
        
        const combined = crypto
          .createHash('sha256')
          .update(left + right)
          .digest('hex');
        
        newLevel.push(combined);
        tree.push(combined);
      }
      
      level = newLevel;
    }
    
    return tree;
  }

  /**
   * Get Merkle root
   */
  getMerkleRoot(entries: EvidenceEntry[]): string {
    const tree = this.buildMerkleTree(entries);
    return tree.length > 0 ? tree[tree.length - 1] : '';
  }

  /**
   * Generate Merkle proof for entry
   */
  generateMerkleProof(entry: EvidenceEntry, entries: EvidenceEntry[]): string[] {
    const proof: string[] = [];
    const tree = this.buildMerkleTree(entries);
    
    let index = entries.findIndex(e => e.id === entry.id);
    if (index === -1) return proof;
    
    let levelSize = entries.length;
    let levelOffset = 0;
    
    while (levelSize > 1) {
      const isRightNode = index % 2 === 1;
      const siblingIndex = isRightNode ? index - 1 : index + 1;
      
      if (siblingIndex < levelSize) {
        proof.push(tree[levelOffset + siblingIndex]);
      }
      
      index = Math.floor(index / 2);
      levelOffset += levelSize;
      levelSize = Math.ceil(levelSize / 2);
    }
    
    return proof;
  }

  /**
   * Verify Merkle proof
   */
  verifyMerkleProof(
    entry: EvidenceEntry,
    proof: string[],
    root: string
  ): boolean {
    let hash = entry.proof.hash;
    let index = 0; // Track position in tree
    
    for (const sibling of proof) {
      const isRightNode = index % 2 === 1;
      
      if (isRightNode) {
        hash = crypto
          .createHash('sha256')
          .update(sibling + hash)
          .digest('hex');
      } else {
        hash = crypto
          .createHash('sha256')
          .update(hash + sibling)
          .digest('hex');
      }
      
      index = Math.floor(index / 2);
    }
    
    return hash === root;
  }

  /**
   * Store evidence in DynamoDB
   */
  private async storeEvidence(entry: EvidenceEntry): Promise<void> {
    const params = {
      TableName: this.tableName,
      Item: marshall(entry)
    };

    await this.client.send(new PutItemCommand(params));
  }

  /**
   * Get latest entry for domain
   */
  private async getLatestEntry(domain: string): Promise<EvidenceEntry | null> {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: '#domain = :domain',
      ExpressionAttributeNames: {
        '#domain': 'domain'
      },
      ExpressionAttributeValues: marshall({
        ':domain': domain
      }),
      ScanIndexForward: false,
      Limit: 1
    };

    const result = await this.client.send(new QueryCommand(params));
    
    if (result.Items && result.Items.length > 0) {
      return unmarshall(result.Items[0]) as EvidenceEntry;
    }
    
    return null;
  }

  /**
   * Get entry by hash
   */
  private async getEntryByHash(hash: string): Promise<EvidenceEntry | null> {
    // Would need GSI on hash field for efficient lookup
    // For now, simplified implementation
    const params = {
      TableName: this.tableName,
      FilterExpression: 'proof.#hash = :hash',
      ExpressionAttributeNames: {
        '#hash': 'hash'
      },
      ExpressionAttributeValues: marshall({
        ':hash': hash
      })
    };

    // Note: Scan is not efficient, should use GSI in production
    // Simplified for demo
    return null;
  }

  /**
   * Update verification status
   */
  private async updateVerification(
    id: string,
    verification: EvidenceEntry['verification']
  ): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: marshall({ id }),
      UpdateExpression: 'SET verification = :verification',
      ExpressionAttributeValues: marshall({
        ':verification': verification
      })
    };

    await this.client.send(new UpdateItemCommand(params));
  }

  /**
   * Get evidence for job
   */
  async getEvidenceForJob(jobId: string): Promise<EvidenceEntry | null> {
    const params = {
      TableName: this.tableName,
      FilterExpression: 'jobId = :jobId',
      ExpressionAttributeValues: marshall({
        ':jobId': jobId
      })
    };

    // Simplified - would use GSI in production
    return null;
  }

  /**
   * Get evidence ledger for domain
   */
  async getLedgerForDomain(domain: string): Promise<EvidenceLedger> {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: '#domain = :domain',
      ExpressionAttributeNames: {
        '#domain': 'domain'
      },
      ExpressionAttributeValues: marshall({
        ':domain': domain
      })
    };

    const result = await this.client.send(new QueryCommand(params));
    const entries = result.Items?.map(item => unmarshall(item) as EvidenceEntry) || [];
    
    const merkleTree = this.buildMerkleTree(entries);
    
    return {
      domain,
      entries,
      lastBlockNumber: entries[entries.length - 1]?.chain.blockNumber || 0,
      lastHash: entries[entries.length - 1]?.proof.hash || '',
      merkleTree,
      createdAt: entries[0]?.timestamp || new Date().toISOString(),
      updatedAt: entries[entries.length - 1]?.timestamp || new Date().toISOString()
    };
  }

  /**
   * Export evidence for audit
   */
  exportEvidenceForAudit(entry: EvidenceEntry): any {
    return {
      id: entry.id,
      jobId: entry.jobId,
      url: entry.url,
      timestamp: entry.timestamp,
      hash: entry.proof.hash,
      signature: entry.proof.signature,
      blockNumber: entry.chain.blockNumber,
      previousHash: entry.chain.previousHash,
      verified: entry.verification.verified,
      contentStats: entry.extraction.contentStats
    };
  }

  /**
   * Helper: Generate evidence ID
   */
  private generateEvidenceId(jobId: string, timestamp: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${jobId}:${timestamp}`)
      .digest('hex');
    return `ev_${hash.substring(0, 12)}`;
  }

  /**
   * Helper: Hash data
   */
  private hashData(data: any): string {
    const canonical = JSON.stringify(data, Object.keys(data).sort());
    return crypto
      .createHash('sha256')
      .update(canonical)
      .digest('hex');
  }
}