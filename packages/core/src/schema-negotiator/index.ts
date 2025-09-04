/**
 * Evidence-First Schema Negotiation System
 * Based on EVIDENCE_FIRST_ADAPTIVE_EXTRACTION_PLAN_2025_09_03.md
 */

import { NegotiationResult, SchemaContract, DeterministicFindings, LLMAugmentationResult, FieldSpec } from '../types';
import { GenericDetector, GenericExtractor } from '../detectors';

export class EvidenceFirstNegotiator {
  
  /**
   * Negotiate final schema based on evidence
   */
  negotiate(
    contract: SchemaContract,
    deterministicFindings: DeterministicFindings,
    augmentationResult: LLMAugmentationResult
  ): NegotiationResult {
    
    const finalFields: FieldSpec[] = [];
    const changes = { pruned: [], added: [], demoted: [] };
    
    // 1. Process required fields - must exist or fail
    for (const field of contract.fields.filter(f => f.kind === "required")) {
      const support = deterministicFindings.support_map[field.name] || 0;
      
      if (support === 0) {
        return {
          status: "error",
          final_schema: [],
          changes,
          evidence_summary: { total_support: 0, field_coverage: {}, reliability_score: 0 },
          reason: `Missing required field: ${field.name}. Selectors tried: ${
            deterministicFindings.misses.find(m => m.field === field.name)?.selectors_tried.join(", ") || "none"
          }`
        };
      }
      
      finalFields.push(field);
    }

    // 2. Process expected fields - prune if zero evidence
    for (const field of contract.fields.filter(f => f.kind === "expected")) {
      const support = deterministicFindings.support_map[field.name] || 0;
      const supportPercentage = support / Math.max(deterministicFindings.support_map[contract.fields[0]?.name] || 1, 1);
      
      if (support === 0) {
        changes.pruned.push({
          field: field.name,
          reason: "zero_evidence_found",
          support: 0
        });
        continue;
      }
      
      // Demote to optional if weak support
      if (supportPercentage < 0.3) {
        const demotedField = { ...field, kind: "expected" as const }; // Keep as expected but mark as demoted
        finalFields.push(demotedField);
        changes.demoted.push({
          field: field.name,
          from: "expected",
          to: "optional",
          support: supportPercentage
        });
      } else {
        finalFields.push(field);
      }
    }

    // 3. Promote discoverable fields with sufficient evidence
    for (const proposal of augmentationResult.new_field_proposals) {
      if (proposal.support >= contract.governance.min_support_threshold) {
        const newField: FieldSpec = {
          name: proposal.name,
          kind: "expected",
          type: proposal.type as any,
          detector: new GenericDetector(proposal.evidence.map(e => e.selector)),
          extractor: new GenericExtractor(),
          validators: this.getValidatorsForType(proposal.type)
        };
        
        finalFields.push(newField);
        changes.added.push({
          field: proposal.name,
          support: proposal.support,
          source: "discovery"
        });
      }
    }

    // Calculate evidence summary
    const totalSupport = Object.values(deterministicFindings.support_map).reduce((a, b) => a + b, 0);
    const fieldCoverage = deterministicFindings.support_map;
    const reliabilityScore = finalFields.length > 0 ? totalSupport / finalFields.length : 0;

    return {
      status: "success",
      final_schema: finalFields,
      changes,
      evidence_summary: {
        total_support: totalSupport,
        field_coverage: fieldCoverage,
        reliability_score: Math.min(reliabilityScore, 1.0)
      }
    };
  }

  /**
   * Get appropriate validators for a field type
   */
  private getValidatorsForType(type: string): any[] {
    // TODO: Implement proper validator creation based on type
    // For now, return empty array as validators are imported from separate module
    return [];
  }
}