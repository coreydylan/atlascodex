/**
 * Promotion Quorum System Tests
 * Comprehensive test suite for the K entities ∧ M blocks validation system
 */

import {
  FieldPromotionManager,
  createPromotionManager,
  validateFieldPromotionQuorum,
  PROMOTION_QUORUM_CONFIG,
  EntityInstance,
  ContentBlock,
  PromotionDecision
} from '../promotion-quorum';
import { DOMEvidence } from '../schema-negotiator';

describe('FieldPromotionManager', () => {
  let manager: FieldPromotionManager;

  beforeEach(() => {
    manager = new FieldPromotionManager(PROMOTION_QUORUM_CONFIG, false); // Disable logging for tests
  });

  afterEach(() => {
    manager.clear();
  });

  describe('Entity Registration', () => {
    it('should register entities correctly', () => {
      const entity: EntityInstance = {
        id: 'entity_1',
        fieldName: 'title',
        value: 'Sample Title',
        evidence: {
          selector: '.title',
          textContent: 'Sample Title',
          dom_path: 'html > body > div > h1',
          confidence: 0.9
        },
        blockId: 'block_1',
        confidence: 0.9,
        extractedAt: new Date()
      };

      manager.registerEntity(entity);
      const stats = manager.getStatistics();
      
      expect(stats.totalEntities).toBe(1);
      expect(stats.totalFields).toBe(1);
      expect(stats.fieldBreakdown[0].field).toBe('title');
      expect(stats.fieldBreakdown[0].entityCount).toBe(1);
    });

    it('should handle multiple entities for the same field', () => {
      const entities = Array.from({ length: 6 }, (_, i) => ({
        id: `entity_${i}`,
        fieldName: 'title',
        value: `Title ${i}`,
        evidence: {
          selector: '.title',
          textContent: `Title ${i}`,
          dom_path: `html > body > div[${i}] > h1`,
          confidence: 0.8
        },
        blockId: `block_${i}`,
        confidence: 0.8,
        extractedAt: new Date()
      }));

      entities.forEach(entity => manager.registerEntity(entity));
      
      const stats = manager.getStatistics();
      expect(stats.totalEntities).toBe(6);
      expect(stats.fieldBreakdown[0].entityCount).toBe(6);
    });
  });

  describe('Promotion Quorum Validation', () => {
    it('should enforce K entities threshold (K=5)', () => {
      // Add only 3 entities (below threshold)
      for (let i = 0; i < 3; i++) {
        manager.registerEntity({
          id: `entity_${i}`,
          fieldName: 'title',
          value: `Title ${i}`,
          evidence: {
            selector: '.title',
            textContent: `Title ${i}`,
            dom_path: `html > body > div[${i}] > h1`,
            confidence: 0.8
          },
          blockId: `block_${i}`,
          confidence: 0.8,
          extractedAt: new Date()
        });
      }

      const result = manager.enforcePromotionQuorum('title');
      
      expect(result.isValid).toBe(false);
      expect(result.entityCount).toBe(3);
      expect(result.errors).toContain('Entity threshold not met: 3 < 5 (field: title)');
    });

    it('should enforce M blocks threshold (M=3)', () => {
      // Add 5 entities but all in same block (below block threshold)
      for (let i = 0; i < 5; i++) {
        manager.registerEntity({
          id: `entity_${i}`,
          fieldName: 'title',
          value: `Title ${i}`,
          evidence: {
            selector: '.title',
            textContent: `Title ${i}`,
            dom_path: 'html > body > div > h1', // Same path = same block
            confidence: 0.8
          },
          blockId: 'block_1', // Same block for all
          confidence: 0.8,
          extractedAt: new Date()
        });
      }

      const result = manager.enforcePromotionQuorum('title');
      
      expect(result.isValid).toBe(false);
      expect(result.entityCount).toBe(5);
      expect(result.blockCount).toBe(1);
      expect(result.errors).toContain('Block threshold not met: 1 < 3 (field: title)');
    });

    it('should pass validation when both K entities AND M blocks thresholds are met', () => {
      // Add 5 entities across 3 different blocks
      const blocks = ['block_1', 'block_2', 'block_3'];
      
      for (let i = 0; i < 5; i++) {
        const blockId = blocks[i % 3]; // Distribute across blocks
        manager.registerEntity({
          id: `entity_${i}`,
          fieldName: 'title',
          value: `Title ${i}`,
          evidence: {
            selector: '.title',
            textContent: `Title ${i}`,
            dom_path: `html > body > div[${Math.floor(i/2)}] > h1`,
            confidence: 0.8
          },
          blockId,
          confidence: 0.8,
          extractedAt: new Date()
        });
      }

      const result = manager.enforcePromotionQuorum('title');
      
      expect(result.isValid).toBe(true);
      expect(result.entityCount).toBe(5);
      expect(result.blockCount).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should provide detailed metadata about the promotion decision', () => {
      // Add 6 entities across 4 blocks for rich metadata
      const blocks = ['block_1', 'block_2', 'block_3', 'block_4'];
      
      for (let i = 0; i < 6; i++) {
        const blockId = blocks[i % 4];
        manager.registerEntity({
          id: `entity_${i}`,
          fieldName: 'title',
          value: `Title ${i}`,
          evidence: {
            selector: '.title',
            textContent: `Title ${i}`,
            dom_path: `html > body > section[${Math.floor(i/2)}] > h1`,
            confidence: 0.8
          },
          blockId,
          confidence: 0.8,
          extractedAt: new Date()
        });
      }

      const result = manager.enforcePromotionQuorum('title');
      
      expect(result.metadata.entityCount).toBe(6);
      expect(result.metadata.blockCount).toBe(4);
      expect(result.metadata.meetsEntityThreshold).toBe(true);
      expect(result.metadata.meetsBlockThreshold).toBe(true);
      expect(result.metadata.isPromotionValid).toBe(true);
      expect(result.metadata.confidenceScore).toBeGreaterThan(0);
      expect(result.metadata.blockAnalysis.uniqueBlocks).toHaveLength(4);
    });
  });

  describe('Field Promotion Decisions', () => {
    it('should make correct promotion decisions', () => {
      // Set up valid scenario
      for (let i = 0; i < 5; i++) {
        const blockId = `block_${i % 3}`; // 3 blocks
        manager.registerEntity({
          id: `entity_${i}`,
          fieldName: 'description',
          value: `Description ${i}`,
          evidence: {
            selector: '.description',
            textContent: `Description ${i}`,
            dom_path: `html > body > article[${Math.floor(i/2)}] > p`,
            confidence: 0.85
          },
          blockId,
          confidence: 0.85,
          extractedAt: new Date()
        });
      }

      const decision = manager.evaluateFieldPromotion('description');
      
      expect(decision.shouldPromote).toBe(true);
      expect(decision.fieldName).toBe('description');
      expect(decision.reason).toContain('Field promotion approved');
      expect(decision.evidence.entities).toHaveLength(5);
      expect(decision.evidence.blocks).toHaveLength(3);
    });

    it('should deny promotion for insufficient evidence', () => {
      // Add only 2 entities in 1 block (fails both thresholds)
      for (let i = 0; i < 2; i++) {
        manager.registerEntity({
          id: `entity_${i}`,
          fieldName: 'author',
          value: `Author ${i}`,
          evidence: {
            selector: '.author',
            textContent: `Author ${i}`,
            dom_path: 'html > body > div > span',
            confidence: 0.7
          },
          blockId: 'block_1',
          confidence: 0.7,
          extractedAt: new Date()
        });
      }

      const decision = manager.evaluateFieldPromotion('author');
      
      expect(decision.shouldPromote).toBe(false);
      expect(decision.reason).toContain('Field promotion denied');
      expect(decision.reason).toContain('Entity threshold not met');
      expect(decision.reason).toContain('Block threshold not met');
    });
  });

  describe('Integration with Schema Negotiation', () => {
    it('should integrate with field proposals from schema negotiation', () => {
      const fieldProposals = [
        {
          name: 'title',
          support: 5,
          evidence: Array.from({ length: 5 }, (_, i) => ({
            selector: '.title',
            textContent: `Title ${i}`,
            dom_path: `html > body > article[${i}] > h1`,
            confidence: 0.9
          }))
        },
        {
          name: 'subtitle',
          support: 2,
          evidence: Array.from({ length: 2 }, (_, i) => ({
            selector: '.subtitle',
            textContent: `Subtitle ${i}`,
            dom_path: `html > body > article[0] > h2`,
            confidence: 0.8
          }))
        }
      ];

      const results = manager.integrateWithSchemaNegotiation(fieldProposals);
      
      expect(results).toHaveLength(2);
      
      // Title should pass (5 entities, likely distributed across blocks)
      const titleResult = results.find(r => r.name === 'title');
      expect(titleResult?.quorumValid).toBe(true);
      expect(titleResult?.quorumReason).toContain('approved');
      
      // Subtitle should fail (only 2 entities, likely in 1 block)
      const subtitleResult = results.find(r => r.name === 'subtitle');
      expect(subtitleResult?.quorumValid).toBe(false);
      expect(subtitleResult?.quorumReason).toContain('denied');
    });
  });

  describe('Configuration and Statistics', () => {
    it('should support custom thresholds', () => {
      const customManager = createPromotionManager(3, 2, false); // Lower thresholds
      
      // Add 3 entities across 2 blocks
      for (let i = 0; i < 3; i++) {
        const blockId = i < 2 ? 'block_1' : 'block_2';
        customManager.registerEntity({
          id: `entity_${i}`,
          fieldName: 'custom_field',
          value: `Value ${i}`,
          evidence: {
            selector: '.custom',
            textContent: `Value ${i}`,
            dom_path: `html > body > div[${Math.floor(i/2)}] > span`,
            confidence: 0.8
          },
          blockId,
          confidence: 0.8,
          extractedAt: new Date()
        });
      }

      const result = customManager.enforcePromotionQuorum('custom_field');
      expect(result.isValid).toBe(true); // Should pass with lower thresholds
    });

    it('should provide comprehensive statistics', () => {
      // Add entities for multiple fields
      const fieldData = [
        { field: 'title', entities: 6, blocks: 3 },
        { field: 'author', entities: 3, blocks: 2 },
        { field: 'date', entities: 8, blocks: 4 }
      ];

      fieldData.forEach(({ field, entities, blocks }) => {
        for (let i = 0; i < entities; i++) {
          const blockId = `${field}_block_${i % blocks}`;
          manager.registerEntity({
            id: `${field}_entity_${i}`,
            fieldName: field,
            value: `${field} value ${i}`,
            evidence: {
              selector: `.${field}`,
              textContent: `${field} value ${i}`,
              dom_path: `html > body > div[${Math.floor(i / blocks)}] > .${field}`,
              confidence: 0.8
            },
            blockId,
            confidence: 0.8,
            extractedAt: new Date()
          });
        }
      });

      const stats = manager.getStatistics();
      
      expect(stats.totalFields).toBe(3);
      expect(stats.totalEntities).toBe(17); // 6 + 3 + 8
      expect(stats.fieldsWithQuorum).toBe(2); // title and date should meet quorum, author should not
      expect(stats.fieldBreakdown).toHaveLength(3);
    });
  });

  describe('Block Analysis and Diversity', () => {
    it('should detect duplicate blocks correctly', () => {
      // Add entities with similar DOM structures (should be detected as similar blocks)
      for (let i = 0; i < 5; i++) {
        manager.registerEntity({
          id: `entity_${i}`,
          fieldName: 'product_name',
          value: `Product ${i}`,
          evidence: {
            selector: '.product-title',
            textContent: `Product ${i}`,
            dom_path: `html > body > div.product-list > div.product-item > h3`, // Similar structure
            confidence: 0.8
          },
          blockId: `block_${i}`, // Different blocks but similar structure
          confidence: 0.8,
          extractedAt: new Date()
        });
      }

      const metadata = manager.getPromotionMetadata('product_name');
      
      expect(metadata).toBeTruthy();
      expect(metadata!.blockAnalysis.blockDiversityScore).toBeLessThan(1.0); // Should detect similarity
      expect(metadata!.blockAnalysis.averageBlockDepth).toBeGreaterThan(0);
    });

    it('should calculate confidence scores based on evidence quality', () => {
      // Add high-confidence entities
      for (let i = 0; i < 5; i++) {
        manager.registerEntity({
          id: `entity_${i}`,
          fieldName: 'high_confidence_field',
          value: `Value ${i}`,
          evidence: {
            selector: '.reliable-selector',
            textContent: `Value ${i}`,
            dom_path: `html > body > section[${i}] > p`,
            confidence: 0.95
          },
          blockId: `block_${i % 3}`,
          confidence: 0.95,
          extractedAt: new Date()
        });
      }

      const metadata = manager.getPromotionMetadata('high_confidence_field');
      
      expect(metadata).toBeTruthy();
      expect(metadata!.confidenceScore).toBeGreaterThan(0.6); // Should have reasonable confidence
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty field names gracefully', () => {
      const result = manager.enforcePromotionQuorum('');
      
      expect(result.isValid).toBe(false);
      expect(result.entityCount).toBe(0);
      expect(result.blockCount).toBe(0);
    });

    it('should handle non-existent fields', () => {
      const result = manager.enforcePromotionQuorum('non_existent_field');
      
      expect(result.isValid).toBe(false);
      expect(result.entityCount).toBe(0);
      expect(result.errors).toContain('Entity threshold not met: 0 < 5 (field: non_existent_field)');
    });

    it('should maintain promotion history', () => {
      // Add valid scenario
      for (let i = 0; i < 5; i++) {
        manager.registerEntity({
          id: `entity_${i}`,
          fieldName: 'test_field',
          value: `Value ${i}`,
          evidence: {
            selector: '.test',
            textContent: `Value ${i}`,
            dom_path: `html > body > div[${i % 3}] > span`,
            confidence: 0.8
          },
          blockId: `block_${i % 3}`,
          confidence: 0.8,
          extractedAt: new Date()
        });
      }

      manager.evaluateFieldPromotion('test_field');
      const history = manager.getPromotionHistory();
      
      expect(history.size).toBe(1);
      expect(history.has('test_field')).toBe(true);
      expect(history.get('test_field')?.shouldPromote).toBe(true);
    });
  });
});

describe('Utility Functions', () => {
  describe('createPromotionManager', () => {
    it('should create manager with custom configuration', () => {
      const manager = createPromotionManager(10, 5, false);
      
      // Test that custom thresholds are applied
      const result = manager.enforcePromotionQuorum('test');
      expect(result.errors[0]).toContain('10'); // Custom entity threshold
      expect(result.errors[1]).toContain('5');  // Custom block threshold
    });
  });

  describe('validateFieldPromotionQuorum', () => {
    it('should validate field promotion with provided evidence', () => {
      const manager = new FieldPromotionManager(PROMOTION_QUORUM_CONFIG, false);
      
      const evidence: DOMEvidence[] = Array.from({ length: 5 }, (_, i) => ({
        selector: '.test',
        textContent: `Test ${i}`,
        dom_path: `html > body > div[${i % 3}] > span`,
        confidence: 0.8
      }));

      const result = validateFieldPromotionQuorum(manager, 'test_field', evidence);
      
      expect(result.valid).toBe(true);
      expect(result.reason).toContain('approved');
      expect(result.metadata).toBeTruthy();
    });
  });
});