/**
 * Promotion Quorum System Integration Example
 * 
 * This example demonstrates how the Promotion Quorum System integrates with
 * the existing Evidence-First Schema Negotiation system to enforce field
 * promotion requirements.
 */

import {
  FieldPromotionManager,
  createPromotionManager,
  validateFieldPromotionQuorum,
  PROMOTION_QUORUM_CONFIG,
  EntityInstance,
  PromotionDecision
} from './promotion-quorum';

import {
  EvidenceFirstNegotiator,
  SchemaContract,
  DeterministicFindings,
  LLMAugmentationResult,
  DOMEvidence,
  createBasicContract
} from './schema-negotiator';

/**
 * Enhanced Evidence-First Negotiator with Promotion Quorum Integration
 * 
 * This class extends the standard negotiation process with promotion quorum
 * validation to ensure field promotions meet both entity count (K) and
 * block distribution (M) requirements.
 */
export class QuorumEnhancedNegotiator extends EvidenceFirstNegotiator {
  private promotionManager: FieldPromotionManager;

  constructor(
    entityThreshold = PROMOTION_QUORUM_CONFIG.K_ENTITIES_MIN,
    blockThreshold = PROMOTION_QUORUM_CONFIG.M_BLOCKS_MIN,
    enableLogging = false
  ) {
    super();
    this.promotionManager = createPromotionManager(entityThreshold, blockThreshold, enableLogging);
  }

  /**
   * Enhanced negotiate method with promotion quorum validation
   */
  negotiate(
    contract: SchemaContract,
    deterministicFindings: DeterministicFindings,
    augmentationResult: LLMAugmentationResult
  ) {
    // First, run the standard negotiation process
    const standardResult = super.negotiate(contract, deterministicFindings, augmentationResult);

    if (standardResult.status === "error") {
      return standardResult;
    }

    // Now enhance with promotion quorum validation
    const enhancedResult = this.enhanceWithPromotionQuorum(
      standardResult,
      contract,
      deterministicFindings,
      augmentationResult
    );

    return enhancedResult;
  }

  /**
   * Enhance negotiation result with promotion quorum validation
   */
  private enhanceWithPromotionQuorum(
    standardResult: any,
    contract: SchemaContract,
    deterministicFindings: DeterministicFindings,
    augmentationResult: LLMAugmentationResult
  ) {
    const quorumValidatedFields = [];
    const quorumRejectedFields = [];

    // Register entities for quorum analysis
    this.registerEntitiesFromFindings(deterministicFindings);
    this.registerEntitiesFromAugmentation(augmentationResult);

    // Validate each field in the final schema
    for (const field of standardResult.final_schema) {
      const decision = this.promotionManager.evaluateFieldPromotion(field.name);
      
      if (decision.shouldPromote || field.kind === "required") {
        // Required fields bypass quorum, others must meet quorum
        quorumValidatedFields.push({
          ...field,
          promotion_metadata: field.kind === "required" ? null : decision.metadata
        });
      } else {
        quorumRejectedFields.push({
          field: field.name,
          reason: decision.reason,
          metadata: decision.metadata
        });
      }
    }

    // Update the result with quorum analysis
    return {
      ...standardResult,
      final_schema: quorumValidatedFields,
      quorum_analysis: {
        validated_fields: quorumValidatedFields.length,
        rejected_fields: quorumRejectedFields.length,
        rejected_details: quorumRejectedFields,
        promotion_statistics: this.promotionManager.getStatistics(),
        thresholds_applied: {
          entity_threshold: this.promotionManager['config'].K_ENTITIES_MIN,
          block_threshold: this.promotionManager['config'].M_BLOCKS_MIN
        }
      }
    };
  }

  /**
   * Register entities from deterministic findings
   */
  private registerEntitiesFromFindings(findings: DeterministicFindings) {
    findings.hits.forEach((hit, index) => {
      const entity: EntityInstance = {
        id: `det_${hit.field}_${index}`,
        fieldName: hit.field,
        value: hit.value,
        evidence: hit.evidence,
        blockId: this.deriveBlockId(hit.evidence),
        confidence: hit.confidence,
        extractedAt: new Date()
      };

      this.promotionManager.registerEntity(entity);
    });
  }

  /**
   * Register entities from LLM augmentation
   */
  private registerEntitiesFromAugmentation(augmentation: LLMAugmentationResult) {
    // Register field completions
    augmentation.field_completions.forEach((completion, index) => {
      const entity: EntityInstance = {
        id: `llm_${completion.field}_${index}`,
        fieldName: completion.field,
        value: completion.value,
        evidence: completion.evidence,
        blockId: this.deriveBlockId(completion.evidence),
        confidence: 0.8, // LLM completions get moderate confidence
        extractedAt: new Date()
      };

      this.promotionManager.registerEntity(entity);
    });

    // Register new field proposals
    augmentation.new_field_proposals.forEach((proposal) => {
      proposal.evidence.forEach((evidence, index) => {
        const entity: EntityInstance = {
          id: `proposal_${proposal.name}_${index}`,
          fieldName: proposal.name,
          value: evidence.textContent || '',
          evidence,
          blockId: this.deriveBlockId(evidence),
          confidence: proposal.confidence,
          extractedAt: new Date()
        };

        this.promotionManager.registerEntity(entity);
      });
    });
  }

  /**
   * Derive block ID from DOM evidence
   */
  private deriveBlockId(evidence: DOMEvidence): string {
    // Simple block ID derivation - in practice this could be more sophisticated
    const pathHash = this.simpleHash(evidence.dom_path);
    const selectorHash = this.simpleHash(evidence.selector);
    return `block_${pathHash}_${selectorHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get promotion manager for advanced analysis
   */
  getPromotionManager(): FieldPromotionManager {
    return this.promotionManager;
  }

  /**
   * Clear promotion data (useful for processing multiple pages)
   */
  clearPromotionData(): void {
    this.promotionManager.clear();
  }
}

/**
 * Example usage demonstrating the Promotion Quorum System
 */
export function demonstratePromotionQuorumSystem() {
  console.log('=== Promotion Quorum System Demonstration ===\n');

  // 1. Create an enhanced negotiator with custom thresholds
  const negotiator = new QuorumEnhancedNegotiator(
    5, // K entities minimum
    3, // M blocks minimum
    true // Enable logging
  );

  // 2. Create a sample schema contract
  const contract = createBasicContract(
    'product',
    ['name'], // required
    ['price', 'description', 'rating'], // expected
    {
      allowNewFields: true,
      min_support_threshold: 3,
      max_discoverable_fields: 3
    }
  );

  // 3. Mock deterministic findings with varying support levels
  const deterministicFindings: DeterministicFindings = {
    hits: [
      // Strong support for 'name' field (6 hits across different blocks)
      ...Array.from({ length: 6 }, (_, i) => ({
        field: 'name',
        value: `Product ${i}`,
        evidence: {
          selector: '.product-name',
          textContent: `Product ${i}`,
          dom_path: `html > body > div.products > div.product[${i}] > h2`,
          confidence: 0.9
        },
        confidence: 0.9
      })),
      
      // Moderate support for 'price' field (4 hits across 2 blocks)
      ...Array.from({ length: 4 }, (_, i) => ({
        field: 'price',
        value: `$${(i + 1) * 10}`,
        evidence: {
          selector: '.price',
          textContent: `$${(i + 1) * 10}`,
          dom_path: `html > body > div.products > div.product[${Math.floor(i / 2)}] > .price`,
          confidence: 0.8
        },
        confidence: 0.8
      })),
      
      // Weak support for 'description' field (2 hits in 1 block)
      ...Array.from({ length: 2 }, (_, i) => ({
        field: 'description',
        value: `Description ${i}`,
        evidence: {
          selector: '.description',
          textContent: `Description ${i}`,
          dom_path: 'html > body > div.products > div.product[0] > .description',
          confidence: 0.7
        },
        confidence: 0.7
      }))
    ],
    misses: [
      {
        field: 'rating',
        reason: 'selector_not_found',
        selectors_tried: ['.rating', '.stars', '[data-rating]']
      }
    ],
    candidates: [],
    support_map: {
      'name': 6,
      'price': 4,
      'description': 2,
      'rating': 0
    }
  };

  // 4. Mock LLM augmentation with new field proposals
  const augmentationResult: LLMAugmentationResult = {
    field_completions: [
      {
        field: 'rating',
        value: '4.5 stars',
        evidence: {
          selector: '.rating-text',
          textContent: '4.5 stars',
          dom_path: 'html > body > div.products > div.product[0] > .rating-section',
          confidence: 0.8
        }
      }
    ],
    new_field_proposals: [
      {
        name: 'brand',
        type: 'string',
        support: 5,
        confidence: 0.85,
        dom_anchors: ['.brand'],
        evidence: Array.from({ length: 5 }, (_, i) => ({
          selector: '.brand',
          textContent: `Brand ${i}`,
          dom_path: `html > body > div.products > div.product[${i % 3}] > .brand`,
          confidence: 0.85
        }))
      },
      {
        name: 'category',
        type: 'string',
        support: 2,
        confidence: 0.7,
        dom_anchors: ['.category'],
        evidence: Array.from({ length: 2 }, (_, i) => ({
          selector: '.category',
          textContent: `Category ${i}`,
          dom_path: 'html > body > div.products > div.product[0] > .category',
          confidence: 0.7
        }))
      }
    ],
    normalizations: []
  };

  // 5. Run negotiation with promotion quorum validation
  console.log('Running negotiation with promotion quorum validation...\n');
  const result = negotiator.negotiate(contract, deterministicFindings, augmentationResult);

  // 6. Display results
  console.log('=== NEGOTIATION RESULTS ===');
  console.log(`Status: ${result.status}`);
  console.log(`Final schema fields: ${result.final_schema.length}`);
  
  console.log('\n=== FINAL SCHEMA ===');
  result.final_schema.forEach((field: any) => {
    console.log(`- ${field.name} (${field.kind})`);
    if (field.promotion_metadata) {
      const metadata = field.promotion_metadata;
      console.log(`  → Entities: ${metadata.entityCount}, Blocks: ${metadata.blockCount}`);
      console.log(`  → Promotion valid: ${metadata.isPromotionValid}`);
    }
  });

  console.log('\n=== QUORUM ANALYSIS ===');
  if (result.quorum_analysis) {
    const qa = result.quorum_analysis;
    console.log(`Validated fields: ${qa.validated_fields}`);
    console.log(`Rejected fields: ${qa.rejected_fields}`);
    console.log(`Thresholds: K≥${qa.thresholds_applied.entity_threshold}, M≥${qa.thresholds_applied.block_threshold}`);
    
    if (qa.rejected_details.length > 0) {
      console.log('\nRejected field details:');
      qa.rejected_details.forEach((rejection: any) => {
        console.log(`- ${rejection.field}: ${rejection.reason}`);
      });
    }
  }

  // 7. Show promotion statistics
  console.log('\n=== PROMOTION STATISTICS ===');
  const stats = negotiator.getPromotionManager().getStatistics();
  console.log(`Total fields analyzed: ${stats.totalFields}`);
  console.log(`Total entities: ${stats.totalEntities}`);
  console.log(`Total blocks: ${stats.totalBlocks}`);
  console.log(`Fields meeting quorum: ${stats.fieldsWithQuorum}`);

  console.log('\nField breakdown:');
  stats.fieldBreakdown.forEach(field => {
    console.log(`- ${field.field}: ${field.entityCount} entities, ${field.blockCount} blocks, ` +
                `quorum: ${field.meetsQuorum ? '✓' : '✗'}`);
  });

  return result;
}

/**
 * Utility function to create mock evidence for testing
 */
export function createMockEvidence(
  fieldName: string,
  entityCount: number,
  blockCount: number,
  confidenceRange: [number, number] = [0.7, 0.9]
): DOMEvidence[] {
  const evidence: DOMEvidence[] = [];
  const blocksPerEntity = Math.ceil(entityCount / blockCount);

  for (let i = 0; i < entityCount; i++) {
    const blockIndex = Math.floor(i / blocksPerEntity);
    const confidence = confidenceRange[0] + 
      (confidenceRange[1] - confidenceRange[0]) * Math.random();

    evidence.push({
      selector: `.${fieldName}`,
      textContent: `${fieldName} value ${i}`,
      dom_path: `html > body > section[${blockIndex}] > div.item[${i}] > .${fieldName}`,
      confidence
    });
  }

  return evidence;
}

/**
 * Export the enhanced negotiator for use in other modules
 */
export default QuorumEnhancedNegotiator;