/**
 * Promotion Quorum System (K entities, M blocks)
 * Production-grade field promotion validation with configurable thresholds
 * 
 * This system enforces evidence requirements for field promotion decisions:
 * - K entities: Minimum number of entity instances required (default: 5)
 * - M blocks: Minimum number of distinct content blocks required (default: 3)
 * 
 * Both conditions must be satisfied for field promotion to occur.
 */

import { FieldSpec, DOMEvidence } from './schema-negotiator';

// Configuration constants for promotion thresholds
export const PROMOTION_QUORUM_CONFIG = {
  K_ENTITIES_MIN: 5,  // Minimum entities required for promotion
  M_BLOCKS_MIN: 3,    // Minimum blocks required for promotion
  MAX_BLOCK_DEPTH: 10,    // Maximum DOM depth for block identification
  BLOCK_SIMILARITY_THRESHOLD: 0.8  // Threshold for block similarity detection
};

export type PromotionQuorumConfig = {
  K_ENTITIES_MIN: number;
  M_BLOCKS_MIN: number;
  MAX_BLOCK_DEPTH: number;
  BLOCK_SIMILARITY_THRESHOLD: number;
};

// Types for promotion quorum system
export interface EntityInstance {
  id: string;
  fieldName: string;
  value: any;
  evidence: DOMEvidence;
  blockId: string;
  confidence: number;
  extractedAt: Date;
}

export interface ContentBlock {
  id: string;
  selector: string;
  domPath: string;
  entityCount: number;
  fieldsFound: Set<string>;
  depth: number;
  characteristics: BlockCharacteristics;
}

export interface BlockCharacteristics {
  tagName: string;
  classNames: string[];
  attributes: Record<string, string>;
  textLength: number;
  childCount: number;
  structuralSignature: string;
}

export interface PromotionQuorumMetadata {
  entityCount: number;
  blockCount: number;
  entityDistribution: Record<string, number>;
  blockDistribution: Record<string, number>;
  meetsEntityThreshold: boolean;
  meetsBlockThreshold: boolean;
  isPromotionValid: boolean;
  confidenceScore: number;
  blockAnalysis: {
    uniqueBlocks: ContentBlock[];
    duplicateBlocks: string[];
    averageBlockDepth: number;
    blockDiversityScore: number;
  };
}

export interface PromotionDecision {
  fieldName: string;
  shouldPromote: boolean;
  metadata: PromotionQuorumMetadata;
  reason: string;
  evidence: {
    entities: EntityInstance[];
    blocks: ContentBlock[];
  };
}

export interface QuorumValidationResult {
  isValid: boolean;
  entityCount: number;
  blockCount: number;
  errors: string[];
  warnings: string[];
  metadata: PromotionQuorumMetadata;
}

/**
 * Field Promotion Manager
 * 
 * Manages the promotion quorum system with explicit K entities ∧ M blocks validation.
 * Provides comprehensive tracking and validation for field promotion decisions.
 */
export class FieldPromotionManager {
  private entities: Map<string, EntityInstance[]> = new Map();
  private blocks: Map<string, ContentBlock> = new Map();
  private promotionHistory: Map<string, PromotionDecision> = new Map();
  
  constructor(
    private config: PromotionQuorumConfig = PROMOTION_QUORUM_CONFIG,
    private enableLogging = true
  ) {
    this.log('FieldPromotionManager initialized', { config });
  }

  /**
   * Register an entity instance for field promotion consideration
   */
  registerEntity(entity: EntityInstance): void {
    const fieldEntities = this.entities.get(entity.fieldName) || [];
    fieldEntities.push(entity);
    this.entities.set(entity.fieldName, fieldEntities);
    
    // Ensure block is registered
    this.ensureBlockRegistered(entity);
    
    this.log(`Entity registered for field: ${entity.fieldName}`, {
      entityId: entity.id,
      blockId: entity.blockId,
      totalEntities: fieldEntities.length
    });
  }

  /**
   * Register a content block for tracking
   */
  registerBlock(block: ContentBlock): void {
    this.blocks.set(block.id, block);
    this.log(`Block registered: ${block.id}`, { block });
  }

  /**
   * Enforce promotion quorum validation
   * 
   * This is the core method that validates both K entities AND M blocks requirements.
   * Both conditions must be satisfied for promotion to be valid.
   */
  enforcePromotionQuorum(fieldName: string): QuorumValidationResult {
    const entities = this.entities.get(fieldName) || [];
    const entityCount = entities.length;
    
    // Get unique blocks that contain this field
    const fieldBlocks = this.getFieldBlocks(fieldName);
    const blockCount = fieldBlocks.size;
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate K entities threshold
    const meetsEntityThreshold = entityCount >= this.config.K_ENTITIES_MIN;
    if (!meetsEntityThreshold) {
      errors.push(
        `Entity threshold not met: ${entityCount} < ${this.config.K_ENTITIES_MIN} (field: ${fieldName})`
      );
    }
    
    // Validate M blocks threshold
    const meetsBlockThreshold = blockCount >= this.config.M_BLOCKS_MIN;
    if (!meetsBlockThreshold) {
      errors.push(
        `Block threshold not met: ${blockCount} < ${this.config.M_BLOCKS_MIN} (field: ${fieldName})`
      );
    }
    
    // Calculate metadata
    const metadata = this.generatePromotionMetadata(fieldName, entities, fieldBlocks);
    
    // Add warnings for edge cases
    if (meetsEntityThreshold && entityCount < 10) {
      warnings.push(`Low entity count for field ${fieldName}: consider increasing sample size`);
    }
    
    if (meetsBlockThreshold && metadata.blockAnalysis.blockDiversityScore < 0.5) {
      warnings.push(`Low block diversity for field ${fieldName}: blocks may be too similar`);
    }
    
    const isValid = meetsEntityThreshold && meetsBlockThreshold;
    
    this.log(`Promotion quorum validation for ${fieldName}`, {
      isValid,
      entityCount,
      blockCount,
      errors,
      warnings
    });
    
    return {
      isValid,
      entityCount,
      blockCount,
      errors,
      warnings,
      metadata
    };
  }

  /**
   * Make promotion decision for a field based on quorum validation
   */
  evaluateFieldPromotion(
    fieldName: string,
    currentFieldSpec?: FieldSpec
  ): PromotionDecision {
    const validation = this.enforcePromotionQuorum(fieldName);
    const entities = this.entities.get(fieldName) || [];
    const fieldBlocks = Array.from(this.getFieldBlocks(fieldName).values());
    
    let reason: string;
    let shouldPromote: boolean;
    
    if (validation.isValid) {
      shouldPromote = true;
      reason = `Field promotion approved: ${validation.entityCount} entities across ${validation.blockCount} blocks meets quorum requirements (K≥${this.config.K_ENTITIES_MIN}, M≥${this.config.M_BLOCKS_MIN})`;
    } else {
      shouldPromote = false;
      reason = `Field promotion denied: ${validation.errors.join('; ')}`;
    }
    
    const decision: PromotionDecision = {
      fieldName,
      shouldPromote,
      metadata: validation.metadata,
      reason,
      evidence: {
        entities,
        blocks: fieldBlocks
      }
    };
    
    // Store decision history
    this.promotionHistory.set(fieldName, decision);
    
    this.log(`Promotion decision for ${fieldName}`, {
      shouldPromote,
      reason,
      entityCount: validation.entityCount,
      blockCount: validation.blockCount
    });
    
    return decision;
  }

  /**
   * Get promotion metadata for transparency
   */
  getPromotionMetadata(fieldName: string): PromotionQuorumMetadata | null {
    const entities = this.entities.get(fieldName) || [];
    if (entities.length === 0) return null;
    
    const fieldBlocks = this.getFieldBlocks(fieldName);
    return this.generatePromotionMetadata(fieldName, entities, fieldBlocks);
  }

  /**
   * Get all promotion decisions made
   */
  getPromotionHistory(): Map<string, PromotionDecision> {
    return new Map(this.promotionHistory);
  }

  /**
   * Clear all data (for testing or reset)
   */
  clear(): void {
    this.entities.clear();
    this.blocks.clear();
    this.promotionHistory.clear();
    this.log('FieldPromotionManager cleared');
  }

  /**
   * Get statistics about current state
   */
  getStatistics() {
    const totalEntities = Array.from(this.entities.values()).reduce(
      (sum, entities) => sum + entities.length, 
      0
    );
    
    const fieldStats = Array.from(this.entities.entries()).map(([field, entities]) => ({
      field,
      entityCount: entities.length,
      blockCount: this.getFieldBlocks(field).size,
      meetsQuorum: this.enforcePromotionQuorum(field).isValid
    }));
    
    return {
      totalFields: this.entities.size,
      totalEntities,
      totalBlocks: this.blocks.size,
      fieldsWithQuorum: fieldStats.filter(s => s.meetsQuorum).length,
      fieldBreakdown: fieldStats
    };
  }

  /**
   * Integration point with schema negotiation system
   * 
   * This method can be called from the EvidenceFirstNegotiator to validate
   * field promotions before they are applied to the schema.
   */
  integrateWithSchemaNegotiation(
    fieldProposals: Array<{
      name: string;
      support: number;
      evidence: DOMEvidence[];
    }>
  ): Array<{
    name: string;
    support: number;
    evidence: DOMEvidence[];
    quorumValid: boolean;
    quorumReason: string;
  }> {
    return fieldProposals.map(proposal => {
      // Register entities from evidence for quorum calculation
      proposal.evidence.forEach((evidence, index) => {
        const entity: EntityInstance = {
          id: `${proposal.name}_${index}`,
          fieldName: proposal.name,
          value: evidence.textContent || '',
          evidence,
          blockId: this.deriveBlockId(evidence),
          confidence: evidence.confidence || 0.8,
          extractedAt: new Date()
        };
        
        this.registerEntity(entity);
      });
      
      const decision = this.evaluateFieldPromotion(proposal.name);
      
      return {
        ...proposal,
        quorumValid: decision.shouldPromote,
        quorumReason: decision.reason
      };
    });
  }

  // Private helper methods

  private ensureBlockRegistered(entity: EntityInstance): void {
    if (!this.blocks.has(entity.blockId)) {
      const block = this.createBlockFromEvidence(entity.blockId, entity.evidence);
      this.registerBlock(block);
    }
    
    // Update block with this field
    const block = this.blocks.get(entity.blockId)!;
    block.fieldsFound.add(entity.fieldName);
    block.entityCount++;
  }

  private createBlockFromEvidence(blockId: string, evidence: DOMEvidence): ContentBlock {
    const domPath = evidence.dom_path;
    const pathParts = domPath.split(' > ');
    
    return {
      id: blockId,
      selector: evidence.selector,
      domPath: domPath,
      entityCount: 0,
      fieldsFound: new Set(),
      depth: pathParts.length,
      characteristics: this.analyzeBlockCharacteristics(evidence)
    };
  }

  private analyzeBlockCharacteristics(evidence: DOMEvidence): BlockCharacteristics {
    const selector = evidence.selector;
    const pathParts = evidence.dom_path.split(' > ');
    const lastElement = pathParts[pathParts.length - 1] || '';
    
    // Extract tag name and classes from selector
    const tagMatch = selector.match(/^(\w+)/);
    const classMatch = selector.match(/\.([\w-]+)/g);
    
    return {
      tagName: tagMatch?.[1] || 'unknown',
      classNames: classMatch?.map(c => c.slice(1)) || [],
      attributes: {},  // Would need DOM access for full attributes
      textLength: evidence.textContent?.length || 0,
      childCount: 0,  // Would need DOM access
      structuralSignature: this.generateStructuralSignature(evidence.dom_path)
    };
  }

  private generateStructuralSignature(domPath: string): string {
    // Create a structural signature based on the DOM path
    const pathParts = domPath.split(' > ');
    const signature = pathParts
      .map(part => part.replace(/\[\d+\]/g, '[]'))  // Normalize indices
      .join('>')
      .toLowerCase();
    
    return signature;
  }

  private getFieldBlocks(fieldName: string): Map<string, ContentBlock> {
    const entities = this.entities.get(fieldName) || [];
    const fieldBlocks = new Map<string, ContentBlock>();
    
    for (const entity of entities) {
      const block = this.blocks.get(entity.blockId);
      if (block) {
        fieldBlocks.set(block.id, block);
      }
    }
    
    return fieldBlocks;
  }

  private generatePromotionMetadata(
    fieldName: string,
    entities: EntityInstance[],
    fieldBlocks: Map<string, ContentBlock>
  ): PromotionQuorumMetadata {
    const entityCount = entities.length;
    const blockCount = fieldBlocks.size;
    
    // Calculate distributions
    const entityDistribution = this.calculateEntityDistribution(entities);
    const blockDistribution = this.calculateBlockDistribution(fieldBlocks);
    
    // Calculate confidence score
    const avgConfidence = entities.reduce((sum, e) => sum + e.confidence, 0) / entityCount;
    const blockDiversityScore = this.calculateBlockDiversityScore(Array.from(fieldBlocks.values()));
    const confidenceScore = (avgConfidence + blockDiversityScore) / 2;
    
    // Threshold checks
    const meetsEntityThreshold = entityCount >= this.config.K_ENTITIES_MIN;
    const meetsBlockThreshold = blockCount >= this.config.M_BLOCKS_MIN;
    
    // Block analysis
    const uniqueBlocks = Array.from(fieldBlocks.values());
    const duplicateBlocks = this.findDuplicateBlocks(uniqueBlocks);
    const averageBlockDepth = uniqueBlocks.reduce((sum, b) => sum + b.depth, 0) / uniqueBlocks.length;
    
    return {
      entityCount,
      blockCount,
      entityDistribution,
      blockDistribution,
      meetsEntityThreshold,
      meetsBlockThreshold,
      isPromotionValid: meetsEntityThreshold && meetsBlockThreshold,
      confidenceScore,
      blockAnalysis: {
        uniqueBlocks,
        duplicateBlocks,
        averageBlockDepth: isNaN(averageBlockDepth) ? 0 : averageBlockDepth,
        blockDiversityScore
      }
    };
  }

  private calculateEntityDistribution(entities: EntityInstance[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const entity of entities) {
      distribution[entity.blockId] = (distribution[entity.blockId] || 0) + 1;
    }
    
    return distribution;
  }

  private calculateBlockDistribution(blocks: Map<string, ContentBlock>): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    blocks.forEach((block, blockId) => {
      distribution[blockId] = block.entityCount;
    });
    
    return distribution;
  }

  private calculateBlockDiversityScore(blocks: ContentBlock[]): number {
    if (blocks.length <= 1) return 1.0;
    
    // Calculate diversity based on structural signatures
    const signatures = new Set(blocks.map(b => b.characteristics.structuralSignature));
    const uniqueSignatures = signatures.size;
    const totalBlocks = blocks.length;
    
    // Diversity score: ratio of unique signatures to total blocks
    return uniqueSignatures / totalBlocks;
  }

  private findDuplicateBlocks(blocks: ContentBlock[]): string[] {
    const signatureMap = new Map<string, string[]>();
    
    for (const block of blocks) {
      const signature = block.characteristics.structuralSignature;
      const blockIds = signatureMap.get(signature) || [];
      blockIds.push(block.id);
      signatureMap.set(signature, blockIds);
    }
    
    const duplicates: string[] = [];
    signatureMap.forEach((blockIds, signature) => {
      if (blockIds.length > 1) {
        duplicates.push(...blockIds.slice(1)); // All but the first are considered duplicates
      }
    });
    
    return duplicates;
  }

  private deriveBlockId(evidence: DOMEvidence): string {
    // Create a stable block ID based on DOM path and selector
    const pathHash = this.simpleHash(evidence.dom_path);
    const selectorHash = this.simpleHash(evidence.selector);
    return `block_${pathHash}_${selectorHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private log(message: string, data?: any): void {
    if (this.enableLogging) {
      console.log(`[FieldPromotionManager] ${message}`, data || '');
    }
  }
}

/**
 * Utility function to create a promotion manager with specific thresholds
 */
export function createPromotionManager(
  entityThreshold?: number,
  blockThreshold?: number,
  enableLogging = true
): FieldPromotionManager {
  const config = {
    K_ENTITIES_MIN: entityThreshold || PROMOTION_QUORUM_CONFIG.K_ENTITIES_MIN,
    M_BLOCKS_MIN: blockThreshold || PROMOTION_QUORUM_CONFIG.M_BLOCKS_MIN,
    MAX_BLOCK_DEPTH: PROMOTION_QUORUM_CONFIG.MAX_BLOCK_DEPTH,
    BLOCK_SIMILARITY_THRESHOLD: PROMOTION_QUORUM_CONFIG.BLOCK_SIMILARITY_THRESHOLD
  };
  
  return new FieldPromotionManager(config, enableLogging);
}

/**
 * Integration helper for schema negotiation
 * 
 * This function can be imported and used by the EvidenceFirstNegotiator
 * to enforce promotion quorum requirements before promoting fields.
 */
export function validateFieldPromotionQuorum(
  promotionManager: FieldPromotionManager,
  fieldName: string,
  evidence: DOMEvidence[],
  minEntityCount = PROMOTION_QUORUM_CONFIG.K_ENTITIES_MIN,
  minBlockCount = PROMOTION_QUORUM_CONFIG.M_BLOCKS_MIN
): {
  valid: boolean;
  reason: string;
  metadata: PromotionQuorumMetadata | null;
} {
  // Register evidence as entities
  evidence.forEach((ev, index) => {
    const entity: EntityInstance = {
      id: `${fieldName}_${index}`,
      fieldName,
      value: ev.textContent || '',
      evidence: ev,
      blockId: `block_${Math.random().toString(36).substr(2, 9)}`,
      confidence: ev.confidence || 0.8,
      extractedAt: new Date()
    };
    
    promotionManager.registerEntity(entity);
  });
  
  const decision = promotionManager.evaluateFieldPromotion(fieldName);
  
  return {
    valid: decision.shouldPromote,
    reason: decision.reason,
    metadata: decision.metadata
  };
}

/**
 * Export main class and utilities
 */
export default FieldPromotionManager;