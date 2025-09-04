/**
 * Evidence-First Anchor System
 * DOM indexing with opaque anchor IDs and cross-validation
 */

import { DOMEvidence } from './schema-contracts';

// Core anchor system interfaces
export interface AnchorID {
  id: string;
  type: 'deterministic' | 'computed' | 'fallback';
  confidence: number;
}

export interface DOMNode {
  element: Element;
  anchor: AnchorID;
  selector: string;
  xpath: string;
  domPath: string;
  textContent: string;
  attributes: Record<string, string>;
  position: {
    index: number;
    siblingIndex: number;
    depth: number;
  };
  stability: {
    score: number;
    factors: string[];
  };
}

export interface AnchorIndex {
  nodes: Map<string, DOMNode>;
  selectors: Map<string, string[]>; // selector -> anchor IDs
  xpaths: Map<string, string[]>;    // xpath -> anchor IDs
  textIndex: Map<string, string[]>; // text hash -> anchor IDs
  metadata: {
    totalNodes: number;
    indexedAt: number;
    pageUrl: string;
    stability: number;
  };
}

export interface CrossValidationResult {
  anchors: {
    primary: AnchorID;
    secondary: AnchorID[];
  };
  agreement: number;
  conflicts: Array<{
    anchor1: AnchorID;
    anchor2: AnchorID;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  recommendations: Array<{
    action: 'use_primary' | 'merge_evidence' | 'request_manual_review';
    reason: string;
    anchorId: string;
  }>;
}

/**
 * Anchor System - Core DOM indexing and ID management
 */
export class AnchorSystem {
  private index: AnchorIndex;
  private hashCache: Map<string, string> = new Map();

  constructor() {
    this.index = {
      nodes: new Map(),
      selectors: new Map(),
      xpaths: new Map(),
      textIndex: new Map(),
      metadata: {
        totalNodes: 0,
        indexedAt: Date.now(),
        pageUrl: '',
        stability: 0
      }
    };
  }

  /**
   * Index a DOM document and create anchor points
   */
  async indexDocument(document: Document, url: string): Promise<AnchorIndex> {
    this.index.metadata.pageUrl = url;
    this.index.metadata.indexedAt = Date.now();

    // Clear existing indexes
    this.clearIndex();

    // Walk the DOM tree and create anchors
    const walker = document.createTreeWalker(
      document.body || document.documentElement,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node: Node) => {
          const element = node as Element;
          // Skip script, style, and other non-content elements
          const tagName = element.tagName.toLowerCase();
          if (['script', 'style', 'meta', 'link', 'head'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          // Only index elements with meaningful content or important structural role
          if (element.textContent?.trim() || this.isStructuralElement(element)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node: Node | null;
    let nodeIndex = 0;

    while (node = walker.nextNode()) {
      const element = node as Element;
      await this.createAnchorForElement(element, nodeIndex++);
    }

    // Calculate overall stability score
    this.index.metadata.stability = this.calculateIndexStability();
    this.index.metadata.totalNodes = this.index.nodes.size;

    return this.index;
  }

  /**
   * Create an anchor for a specific element
   */
  private async createAnchorForElement(element: Element, index: number): Promise<void> {
    // Generate multiple selector strategies
    const selectors = this.generateSelectors(element);
    const xpath = this.generateXPath(element);
    const domPath = this.generateDOMPath(element);
    
    // Create anchor ID using multiple strategies
    const anchorId = this.generateAnchorId(element, selectors, xpath);
    
    // Calculate stability score
    const stability = this.calculateElementStability(element, selectors);
    
    // Extract attributes
    const attributes: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }

    // Create DOM node entry
    const domNode: DOMNode = {
      element,
      anchor: anchorId,
      selector: selectors.primary,
      xpath,
      domPath,
      textContent: element.textContent?.trim() || '',
      attributes,
      position: {
        index,
        siblingIndex: this.getSiblingIndex(element),
        depth: this.getElementDepth(element)
      },
      stability
    };

    // Add to indexes
    this.index.nodes.set(anchorId.id, domNode);
    
    // Index by selector
    for (const selector of selectors.all) {
      if (!this.index.selectors.has(selector)) {
        this.index.selectors.set(selector, []);
      }
      this.index.selectors.get(selector)!.push(anchorId.id);
    }

    // Index by xpath
    if (!this.index.xpaths.has(xpath)) {
      this.index.xpaths.set(xpath, []);
    }
    this.index.xpaths.get(xpath)!.push(anchorId.id);

    // Index by text content hash
    if (domNode.textContent) {
      const textHash = this.hashContent(domNode.textContent);
      if (!this.index.textIndex.has(textHash)) {
        this.index.textIndex.set(textHash, []);
      }
      this.index.textIndex.get(textHash)!.push(anchorId.id);
    }
  }

  /**
   * Generate opaque anchor ID using multiple strategies
   */
  private generateAnchorId(element: Element, selectors: any, xpath: string): AnchorID {
    // Strategy 1: Deterministic based on stable attributes
    const stableAttrs = ['id', 'data-testid', 'data-cy', 'name'];
    let deterministicId = '';
    
    for (const attr of stableAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        deterministicId = this.hashContent(`${attr}:${value}`);
        return {
          id: deterministicId,
          type: 'deterministic',
          confidence: 0.95
        };
      }
    }

    // Strategy 2: Computed based on content and structure
    const contentHash = this.hashContent(element.textContent?.trim() || '');
    const structureHash = this.hashContent(`${element.tagName}:${selectors.primary}`);
    const computedId = this.hashContent(`${contentHash}:${structureHash}`);
    
    if (element.textContent?.trim() && selectors.primary) {
      return {
        id: computedId,
        type: 'computed',
        confidence: 0.85
      };
    }

    // Strategy 3: Fallback using position and xpath
    const positionHash = this.hashContent(`${xpath}:${Date.now()}`);
    return {
      id: positionHash,
      type: 'fallback',
      confidence: 0.60
    };
  }

  /**
   * Generate multiple CSS selectors for an element
   */
  private generateSelectors(element: Element): { primary: string; all: string[] } {
    const selectors: string[] = [];

    // ID selector (highest priority)
    if (element.id) {
      selectors.push(`#${element.id}`);
    }

    // Class-based selectors
    if (element.className) {
      const classes = element.className.trim().split(/\s+/).filter(c => c.length > 0);
      if (classes.length > 0) {
        // Single class selectors
        classes.forEach(cls => selectors.push(`.${cls}`));
        // Combined class selector
        if (classes.length > 1) {
          selectors.push(`.${classes.join('.')}`);
        }
      }
    }

    // Attribute-based selectors
    const meaningfulAttrs = ['name', 'type', 'role', 'data-testid'];
    meaningfulAttrs.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) {
        selectors.push(`[${attr}="${value}"]`);
      }
    });

    // Tag-based selector with nth-child
    const tagSelector = this.generateTagSelector(element);
    if (tagSelector) {
      selectors.push(tagSelector);
    }

    // Fallback: use tag name
    if (selectors.length === 0) {
      selectors.push(element.tagName.toLowerCase());
    }

    return {
      primary: selectors[0],
      all: selectors
    };
  }

  /**
   * Generate XPath for an element
   */
  private generateXPath(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let tagName = current.tagName.toLowerCase();
      
      // Count siblings with same tag name
      let siblingIndex = 1;
      let sibling: Element | null = current.previousElementSibling;
      while (sibling) {
        if (sibling.tagName.toLowerCase() === tagName) {
          siblingIndex++;
        }
        sibling = sibling.previousElementSibling;
      }

      const part = siblingIndex > 1 ? `${tagName}[${siblingIndex}]` : tagName;
      parts.unshift(part);

      current = current.parentElement;
    }

    return '/' + parts.join('/');
  }

  /**
   * Generate DOM path string
   */
  private generateDOMPath(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;

    while (current) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break; // IDs are unique, we can stop here
      }

      if (current.className) {
        const classes = current.className.trim().split(/\s+/).slice(0, 2); // Limit to first 2 classes
        selector += '.' + classes.join('.');
      }

      path.unshift(selector);
      current = current.parentElement;

      // Limit depth to prevent overly long paths
      if (path.length >= 8) break;
    }

    return path.join(' > ');
  }

  /**
   * Cross-validate anchors for consistency
   */
  async crossValidateAnchors(anchorIds: string[]): Promise<CrossValidationResult> {
    if (anchorIds.length < 2) {
      const anchor = anchorIds[0] ? this.index.nodes.get(anchorIds[0])?.anchor : null;
      return {
        anchors: {
          primary: anchor || { id: '', type: 'fallback', confidence: 0 },
          secondary: []
        },
        agreement: anchor ? 1.0 : 0.0,
        conflicts: [],
        recommendations: []
      };
    }

    const nodes = anchorIds.map(id => this.index.nodes.get(id)).filter(Boolean) as DOMNode[];
    const conflicts: CrossValidationResult['conflicts'] = [];
    const recommendations: CrossValidationResult['recommendations'] = [];

    // Check for conflicts in selectors
    const selectors = new Set(nodes.map(n => n.selector));
    if (selectors.size > 1) {
      for (let i = 0; i < nodes.length - 1; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[i].selector !== nodes[j].selector) {
            conflicts.push({
              anchor1: nodes[i].anchor,
              anchor2: nodes[j].anchor,
              issue: 'Selector mismatch',
              severity: 'medium'
            });
          }
        }
      }
    }

    // Check text content consistency
    const textContents = new Set(nodes.map(n => n.textContent).filter(Boolean));
    if (textContents.size > 1) {
      conflicts.push({
        anchor1: nodes[0].anchor,
        anchor2: nodes[1].anchor,
        issue: 'Content mismatch',
        severity: 'high'
      });
    }

    // Calculate agreement score
    const totalChecks = 2; // selector + content checks
    const agreement = Math.max(0, (totalChecks - conflicts.length) / totalChecks);

    // Sort nodes by confidence and stability
    const sortedNodes = nodes.sort((a, b) => 
      (b.anchor.confidence * b.stability.score) - (a.anchor.confidence * a.stability.score)
    );

    // Generate recommendations
    if (conflicts.length > 0) {
      if (agreement > 0.7) {
        recommendations.push({
          action: 'use_primary',
          reason: 'Minor conflicts detected, use highest confidence anchor',
          anchorId: sortedNodes[0].anchor.id
        });
      } else if (agreement > 0.4) {
        recommendations.push({
          action: 'merge_evidence',
          reason: 'Moderate conflicts, merge evidence from multiple anchors',
          anchorId: sortedNodes[0].anchor.id
        });
      } else {
        recommendations.push({
          action: 'request_manual_review',
          reason: 'Significant conflicts detected, manual review required',
          anchorId: sortedNodes[0].anchor.id
        });
      }
    }

    return {
      anchors: {
        primary: sortedNodes[0].anchor,
        secondary: sortedNodes.slice(1).map(n => n.anchor)
      },
      agreement,
      conflicts,
      recommendations
    };
  }

  /**
   * Find anchors by selector
   */
  findAnchorsBySelector(selector: string): DOMNode[] {
    const anchorIds = this.index.selectors.get(selector) || [];
    return anchorIds.map(id => this.index.nodes.get(id)).filter(Boolean) as DOMNode[];
  }

  /**
   * Find anchors by text content
   */
  findAnchorsByText(text: string): DOMNode[] {
    const textHash = this.hashContent(text);
    const anchorIds = this.index.textIndex.get(textHash) || [];
    return anchorIds.map(id => this.index.nodes.get(id)).filter(Boolean) as DOMNode[];
  }

  /**
   * Get anchor by ID
   */
  getAnchor(anchorId: string): DOMNode | undefined {
    return this.index.nodes.get(anchorId);
  }

  /**
   * Convert anchor to DOM evidence format
   */
  anchorToDOMEvidence(anchorId: string): DOMEvidence | null {
    const node = this.index.nodes.get(anchorId);
    if (!node) return null;

    return {
      selector: node.selector,
      textContent: node.textContent,
      dom_path: node.domPath
    };
  }

  // Helper methods
  private clearIndex(): void {
    this.index.nodes.clear();
    this.index.selectors.clear();
    this.index.xpaths.clear();
    this.index.textIndex.clear();
  }

  private isStructuralElement(element: Element): boolean {
    const structuralTags = ['nav', 'header', 'footer', 'main', 'section', 'article', 'aside'];
    return structuralTags.includes(element.tagName.toLowerCase());
  }

  private calculateElementStability(element: Element, selectors: any): { score: number; factors: string[] } {
    let score = 0.5; // Base score
    const factors: string[] = [];

    // ID presence boosts stability
    if (element.id) {
      score += 0.3;
      factors.push('has_id');
    }

    // Stable classes boost stability
    const classes = element.className?.split(/\s+/) || [];
    const stableClasses = classes.filter(cls => !cls.match(/^(temp-|tmp-|gen-|\d)/));
    if (stableClasses.length > 0) {
      score += 0.2;
      factors.push('stable_classes');
    }

    // Data attributes boost stability
    const hasDataAttrs = Array.from(element.attributes).some(attr => attr.name.startsWith('data-'));
    if (hasDataAttrs) {
      score += 0.2;
      factors.push('data_attributes');
    }

    // Text content stability
    if (element.textContent && element.textContent.trim().length > 0) {
      score += 0.1;
      factors.push('has_content');
    }

    return {
      score: Math.min(score, 1.0),
      factors
    };
  }

  private calculateIndexStability(): number {
    const nodes = Array.from(this.index.nodes.values());
    if (nodes.length === 0) return 0;

    const totalStability = nodes.reduce((sum, node) => sum + node.stability.score, 0);
    return totalStability / nodes.length;
  }

  private getSiblingIndex(element: Element): number {
    let index = 0;
    let sibling: Element | null = element.previousElementSibling;
    
    while (sibling) {
      index++;
      sibling = sibling.previousElementSibling;
    }
    
    return index;
  }

  private getElementDepth(element: Element): number {
    let depth = 0;
    let parent: Element | null = element.parentElement;
    
    while (parent) {
      depth++;
      parent = parent.parentElement;
    }
    
    return depth;
  }

  private generateTagSelector(element: Element): string {
    const parent = element.parentElement;
    if (!parent) return element.tagName.toLowerCase();

    const tagName = element.tagName.toLowerCase();
    const siblings = Array.from(parent.children).filter(child => 
      child.tagName.toLowerCase() === tagName
    );

    if (siblings.length === 1) {
      return tagName;
    }

    const index = siblings.indexOf(element) + 1;
    return `${tagName}:nth-of-type(${index})`;
  }

  private hashContent(content: string): string {
    if (this.hashCache.has(content)) {
      return this.hashCache.get(content)!;
    }

    // Simple hash function for content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    const hashStr = Math.abs(hash).toString(36);
    this.hashCache.set(content, hashStr);
    return hashStr;
  }

  /**
   * Get index metadata and statistics
   */
  getIndexMetadata(): AnchorIndex['metadata'] {
    return { ...this.index.metadata };
  }

  /**
   * Export index for serialization
   */
  exportIndex(): any {
    return {
      metadata: this.index.metadata,
      nodeCount: this.index.nodes.size,
      selectorCount: this.index.selectors.size,
      xpathCount: this.index.xpaths.size,
      textIndexCount: this.index.textIndex.size
    };
  }
}

/**
 * Create and return a new AnchorSystem instance
 */
export function createAnchorSystem(): AnchorSystem {
  return new AnchorSystem();
}

/**
 * Utility function to validate anchor ID format
 */
export function isValidAnchorId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && /^[a-zA-Z0-9]+$/.test(id);
}