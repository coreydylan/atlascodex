/**
 * Detector Implementations for Evidence-First System
 * Based on EVIDENCE_FIRST_ADAPTIVE_EXTRACTION_PLAN_2025_09_03.md
 */

import { Detector } from '../types';

/**
 * Base detector class with common functionality
 */
abstract class BaseDetector implements Detector {
  protected selectors: string[];

  constructor(selectors: string[]) {
    this.selectors = selectors;
  }

  abstract detect(dom: Document): Promise<Array<{
    element: Element;
    selector: string;
    confidence: number;
  }>>;

  getSelectors(): string[] {
    return this.selectors;
  }

  /**
   * Calculate confidence based on element properties
   */
  protected calculateConfidence(element: Element, selector: string): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence for semantic selectors
    if (selector.includes('h1') || selector.includes('.title')) confidence += 0.3;
    if (selector.includes('h2') || selector.includes('h3')) confidence += 0.2;
    
    // Boost for content quality
    const textLength = element.textContent?.trim().length || 0;
    if (textLength > 10) confidence += 0.1;
    if (textLength > 50) confidence += 0.1;
    
    // Reduce confidence for nested elements
    const depth = this.getElementDepth(element);
    if (depth > 5) confidence -= 0.1;
    
    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  /**
   * Get element depth in DOM tree
   */
  private getElementDepth(element: Element): number {
    let depth = 0;
    let current = element.parentElement;
    while (current) {
      depth++;
      current = current.parentElement;
    }
    return depth;
  }
}

/**
 * Title/Header detector for name fields
 */
export class TitleDetector extends BaseDetector {
  async detect(dom: Document): Promise<Array<{
    element: Element;
    selector: string;
    confidence: number;
  }>> {
    const results = [];

    for (const selector of this.selectors) {
      const elements = dom.querySelectorAll(selector);
      for (const element of elements) {
        if (element.textContent?.trim() && element.textContent.trim().length > 2) {
          results.push({
            element,
            selector,
            confidence: this.calculateConfidence(element, selector)
          });
        }
      }
    }

    // Sort by confidence descending
    return results.sort((a, b) => b.confidence - a.confidence);
  }
}

/**
 * Description/content detector
 */
export class DescriptionDetector extends BaseDetector {
  async detect(dom: Document): Promise<Array<{
    element: Element;
    selector: string;
    confidence: number;
  }>> {
    const results = [];

    for (const selector of this.selectors) {
      const elements = dom.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.trim();
        if (text && text.length > 10) {
          results.push({
            element,
            selector,
            confidence: this.calculateConfidence(element, selector)
          });
        }
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}

/**
 * Link detector for URL fields
 */
export class LinkDetector extends BaseDetector {
  async detect(dom: Document): Promise<Array<{
    element: Element;
    selector: string;
    confidence: number;
  }>> {
    const results = [];

    for (const selector of this.selectors) {
      const elements = dom.querySelectorAll(selector);
      for (const element of elements) {
        const href = (element as HTMLAnchorElement).href;
        if (href && this.isValidURL(href)) {
          results.push({
            element,
            selector,
            confidence: this.calculateConfidence(element, selector) + 0.2 // Boost for valid URLs
          });
        }
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Generic detector for flexible field matching
 */
export class GenericDetector extends BaseDetector {
  async detect(dom: Document): Promise<Array<{
    element: Element;
    selector: string;
    confidence: number;
  }>> {
    const results = [];

    for (const selector of this.selectors) {
      try {
        const elements = dom.querySelectorAll(selector);
        for (const element of elements) {
          if (element.textContent?.trim()) {
            results.push({
              element,
              selector,
              confidence: this.calculateConfidence(element, selector)
            });
          }
        }
      } catch (error) {
        console.warn(`Invalid selector: ${selector}`, error);
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}