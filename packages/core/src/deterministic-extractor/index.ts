/**
 * Deterministic Extractor - Track A Processing
 * Based on EVIDENCE_FIRST_ADAPTIVE_EXTRACTION_PLAN_2025_09_03.md
 */

import { DeterministicFindings, SchemaContract, DOMEvidence } from '../types';

export class DeterministicExtractor {
  
  /**
   * Process DOM with schema contract to find deterministic evidence
   */
  async process(dom: Document, contract: SchemaContract): Promise<DeterministicFindings> {
    const findings: DeterministicFindings = {
      hits: [],
      misses: [],
      candidates: [],
      support_map: {}
    };

    // Process each field in contract
    for (const fieldSpec of contract.fields) {
      if (fieldSpec.kind === "discoverable") continue; // Skip discoverable in deterministic pass
      
      try {
        const detectionResults = await fieldSpec.detector.detect(dom);
        
        if (detectionResults.length === 0) {
          findings.misses.push({
            field: fieldSpec.name,
            reason: "no_matches_found",
            selectors_tried: fieldSpec.detector.getSelectors()
          });
          findings.support_map[fieldSpec.name] = 0;
          continue;
        }

        // Extract and validate values
        const validExtractions = [];
        for (const detection of detectionResults) {
          try {
            const extractedValue = await fieldSpec.extractor.extract(detection.element);
            
            // Run validators
            const validationResults = fieldSpec.validators.map(v => v.validate(extractedValue));
            if (validationResults.every(r => r.valid)) {
              validExtractions.push({
                field: fieldSpec.name,
                value: extractedValue,
                evidence: {
                  selector: detection.selector,
                  textContent: detection.element.textContent?.substring(0, 100),
                  dom_path: this.getDOMPath(detection.element)
                },
                confidence: detection.confidence
              });
            }
          } catch (extractionError) {
            console.warn(`Extraction failed for ${fieldSpec.name}:`, extractionError);
          }
        }

        findings.hits.push(...validExtractions);
        findings.support_map[fieldSpec.name] = validExtractions.length;
      } catch (error) {
        console.error(`Error processing field ${fieldSpec.name}:`, error);
        findings.misses.push({
          field: fieldSpec.name,
          reason: "processing_error",
          selectors_tried: fieldSpec.detector.getSelectors()
        });
        findings.support_map[fieldSpec.name] = 0;
      }
    }

    // Discover repeated patterns for potential new fields
    findings.candidates = await this.discoverPatterns(dom);

    return findings;
  }

  /**
   * Get DOM path for an element
   */
  private getDOMPath(element: Element): string {
    const path = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const tagName = current.tagName.toLowerCase();
      
      // Add index if there are siblings with the same tag
      const siblings = Array.from(current.parentNode?.children || []);
      const sameTagSiblings = siblings.filter(sibling => 
        sibling.tagName.toLowerCase() === tagName
      );
      
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current as Element);
        path.unshift(`${tagName}:nth-child(${index + 1})`);
      } else {
        path.unshift(tagName);
      }
      
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }

  /**
   * Discover repeated patterns that could become new fields
   */
  private async discoverPatterns(dom: Document): Promise<Array<{
    pattern: string;
    instances: number;
    sample_nodes: Element[];
  }>> {
    // Look for repeated label-value patterns
    const labelValuePairs = dom.querySelectorAll('dt, .label, strong, b');
    const patterns = new Map<string, Element[]>();

    labelValuePairs.forEach(label => {
      const labelText = label.textContent?.trim().toLowerCase();
      if (labelText && labelText.length > 2) {
        if (!patterns.has(labelText)) {
          patterns.set(labelText, []);
        }
        patterns.get(labelText)!.push(label);
      }
    });

    return Array.from(patterns.entries())
      .filter(([pattern, elements]) => elements.length >= 2) // At least 2 instances
      .map(([pattern, elements]) => ({
        pattern,
        instances: elements.length,
        sample_nodes: elements.slice(0, 3) // Sample for LLM analysis
      }));
  }
}