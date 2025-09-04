# Promotion Quorum System Implementation

## Overview

The Promotion Quorum System (K entities, M blocks) is a production-grade field promotion validation system that enforces evidence requirements for field promotion decisions in the Atlas Codex Evidence-First Adaptive Extraction System.

## Core Requirements Implemented

### ✅ K Entities ∧ M Blocks Validation
- **K entities**: Minimum number of entity instances required (default: 5)
- **M blocks**: Minimum number of distinct content blocks required (default: 3)
- **Both conditions must be satisfied** for field promotion to occur

### ✅ FieldPromotionManager Class
- Manages entity registration and block tracking
- Enforces promotion quorum validation with `enforcePromotionQuorum()` method
- Configurable thresholds via `PROMOTION_QUORUM_CONFIG`
- Comprehensive validation logic that requires both entity count AND block distribution

### ✅ Block Tracking System
- Identifies source blocks for entities based on DOM evidence
- Tracks block characteristics and structural signatures
- Detects duplicate blocks and calculates diversity scores
- Analyzes block depth and distribution patterns

### ✅ Promotion Metadata Exposure
- Full transparency with counters for entities and blocks
- Confidence scoring based on evidence quality and block diversity
- Detailed promotion decisions with reasoning
- Historical tracking of all promotion decisions

### ✅ Schema Negotiation Integration
- Integration helper `integrateWithSchemaNegotiation()` method
- Enhanced negotiator class `QuorumEnhancedNegotiator`
- Seamless integration with existing Evidence-First system
- Validation utility `validateFieldPromotionQuorum()`

### ✅ Comprehensive Validation Logic
- Entity count validation (≥5 by default)
- Block distribution validation (≥3 by default)
- Combined validation requiring both conditions
- Error handling and edge case management

## Files Created

1. **`/src/promotion-quorum.ts`** - Main implementation
   - `FieldPromotionManager` class
   - Configuration constants and types
   - Core validation and decision logic
   - Integration utilities

2. **`/src/promotion-quorum-example.ts`** - Integration example
   - `QuorumEnhancedNegotiator` class
   - Demonstration of system usage
   - Mock data creation utilities

3. **`/src/__tests__/promotion-quorum.test.ts`** - Comprehensive tests
   - 18 test cases covering all functionality
   - Entity registration and validation tests
   - Integration and configuration tests
   - Error handling and edge case tests

## Key Features

### Configurable Thresholds
```typescript
const PROMOTION_QUORUM_CONFIG = {
  K_ENTITIES_MIN: 5,     // Minimum entities required
  M_BLOCKS_MIN: 3,       // Minimum blocks required
  MAX_BLOCK_DEPTH: 10,   // Maximum DOM depth
  BLOCK_SIMILARITY_THRESHOLD: 0.8
};
```

### Promotion Decision Structure
```typescript
interface PromotionDecision {
  fieldName: string;
  shouldPromote: boolean;
  metadata: PromotionQuorumMetadata;
  reason: string;
  evidence: {
    entities: EntityInstance[];
    blocks: ContentBlock[];
  };
}
```

### Integration with Schema Negotiation
```typescript
// Enhanced negotiator with quorum validation
const negotiator = new QuorumEnhancedNegotiator(5, 3, true);
const result = negotiator.negotiate(contract, findings, augmentation);

// Result includes quorum analysis
console.log(result.quorum_analysis.validated_fields);
console.log(result.quorum_analysis.rejected_details);
```

## Usage Examples

### Basic Usage
```typescript
import { FieldPromotionManager, PROMOTION_QUORUM_CONFIG } from './promotion-quorum';

const manager = new FieldPromotionManager();

// Register entities
manager.registerEntity({
  id: 'entity_1',
  fieldName: 'title',
  value: 'Sample Title',
  evidence: domEvidence,
  blockId: 'block_1',
  confidence: 0.9,
  extractedAt: new Date()
});

// Check promotion eligibility
const validation = manager.enforcePromotionQuorum('title');
console.log(`Valid: ${validation.isValid}`);
console.log(`Entities: ${validation.entityCount}, Blocks: ${validation.blockCount}`);
```

### Integration with Existing System
```typescript
import { QuorumEnhancedNegotiator } from './promotion-quorum-example';

const negotiator = new QuorumEnhancedNegotiator();
const result = negotiator.negotiate(contract, findings, augmentation);

// Promotion decisions are now validated with quorum requirements
result.final_schema.forEach(field => {
  if (field.promotion_metadata) {
    console.log(`${field.name}: ${field.promotion_metadata.isPromotionValid}`);
  }
});
```

## Test Coverage

All 18 tests pass, covering:
- ✅ Entity registration and management
- ✅ K entities threshold enforcement
- ✅ M blocks threshold enforcement
- ✅ Combined validation logic
- ✅ Promotion decision making
- ✅ Schema negotiation integration
- ✅ Configuration and statistics
- ✅ Block analysis and diversity scoring
- ✅ Error handling and edge cases
- ✅ Utility functions

## Integration Points

The Promotion Quorum System integrates seamlessly with:
- **EvidenceFirstNegotiator** - Enhanced field promotion validation
- **Schema Contracts** - Enforcement of promotion policies
- **Deterministic Extractor** - Entity evidence validation
- **LLM Augmentation** - Augmented field proposal validation
- **Adaptive Display** - Schema-driven display generation

## Production Readiness

The implementation is production-ready with:
- ✅ Comprehensive error handling
- ✅ TypeScript type safety
- ✅ Extensive test coverage
- ✅ Configurable thresholds
- ✅ Performance optimizations
- ✅ Clear documentation and examples
- ✅ Integration with existing systems