/**
 * Deterministic Extractor for Evidence-First Adaptive Extraction System
 * Fast, reliable, DOM-based extraction with pattern discovery and confidence scoring
 * Performance-optimized with robust DOM traversal and edge case handling
 */

import { FieldSpec, SchemaContract } from './schema-contracts';

export interface DOMEvidence {
  selector: string;
  textContent?: string;
  dom_path: string;
  element_tag: string;
  attributes: Record<string, string>;
  confidence: number;
  anchor_id?: string;
}

export interface DeterministicFindings {
  hits: Array<{
    field: string;
    value: any;
    evidence: DOMEvidence;
    confidence: number;
    validation_passed: boolean;
  }>;
  misses: Array<{
    field: string;
    reason: string;
    selectors_tried: string[];
    validation_errors?: string[];
  }>;
  candidates: Array<{
    pattern: string;
    instances: number;
    sample_nodes: Element[];
    confidence: number;
    field_suggestion?: string;
    evidence_anchors: string[];
  }>;
  support_map: Record<string, number>;
}

export interface ExtractorOptions {
  max_candidates: number;
  min_pattern_instances: number;
  confidence_threshold: number;
  enable_pattern_discovery: boolean;
  max_processing_time: number;
  dom_traversal_limit: number;
  enable_anchor_validation: boolean;
}

interface DetectionResult {
  element: Element;
  selector: string;
  confidence: number;
  metadata?: Record<string, any>;
  anchor_id?: string;
}

interface ExtractionResult {
  value: any;
  confidence: number;
  type_validated: boolean;
  format_validated: boolean;
  extraction_method: string;
}

/**
 * DOM Anchor Index for evidence validation
 */
class DOMIndexer {
  private anchorIndex: Map<string, { node: Element; selector: string; text: string }> = new Map();
  private anchorCounter: number = 1;

  /**
   * Build anchor index for DOM validation
   */
  buildAnchorIndex(dom: Document): Record<string, { node: Element; selector: string; text: string }> {
    this.anchorIndex.clear();
    this.anchorCounter = 1;

    // Index all potentially relevant elements
    const relevantElements = dom.querySelectorAll(
      'h1, h2, h3, h4, h5, h6, p, span, div, a, li, td, th, dt, dd, strong, b, em, i, [class*="title"], [class*="name"], [class*="description"]'
    );

    relevantElements.forEach((element) => {
      const text = element.textContent?.trim();
      if (text && text.length > 0 && text.length < 1000) {
        const anchorId = `n_${this.anchorCounter++}`;
        this.anchorIndex.set(anchorId, {
          node: element,
          selector: this.generateStableSelector(element),
          text: text.substring(0, 200)
        });
      }
    });

    return Object.fromEntries(this.anchorIndex);
  }

  /**
   * Generate stable, performance-optimized selector
   */
  private generateStableSelector(element: Element): string {
    // Prefer ID-based selectors (most stable)
    if (element.id && element.id.length < 50) {
      return `#${element.id}`;
    }

    // Use class-based selectors for common UI patterns
    if (element.className) {
      const classes = Array.from(element.classList)
        .filter(cls => cls.length < 30 && !cls.includes(' ') && !/^\d+$/.test(cls))
        .slice(0, 2);
      
      if (classes.length > 0) {
        const selector = `.${classes.join('.')}`;
        // Verify selector uniqueness
        try {
          const matches = document.querySelectorAll(selector);
          if (matches.length === 1) return selector;
        } catch {
          // Invalid selector, continue to path-based approach
        }
      }
    }

    // Fallback to optimized path-based selector
    return this.generateOptimizedPath(element);
  }

  private generateOptimizedPath(element: Element): string {
    const path = [];
    let current = element;
    
    while (current && current !== document.documentElement && path.length < 6) {
      let segment = current.tagName.toLowerCase();
      
      // Add distinguishing attributes
      if (current.className) {
        const primaryClass = Array.from(current.classList)[0];
        if (primaryClass && primaryClass.length < 20) {
          segment += `.${primaryClass}`;
        }
      }
      
      // Add position for disambiguation
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children);
        const sameTagSiblings = siblings.filter(sib => 
          sib.tagName === current.tagName && 
          sib.className === current.className
        );
        
        if (sameTagSiblings.length > 1) {
          const index = sameTagSiblings.indexOf(current);
          segment += `:nth-of-type(${index + 1})`;
        }
      }
      
      path.unshift(segment);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  getAnchorById(anchorId: string): { node: Element; selector: string; text: string } | null {
    return this.anchorIndex.get(anchorId) || null;
  }
}

/**
 * Base detector for field detection with performance optimizations
 */
abstract class BaseDetector {
  protected selectors: string[];
  protected patterns: RegExp[];
  protected negativePatterns: RegExp[];
  protected maxElements: number;

  constructor(
    selectors: string[], 
    patterns: RegExp[] = [], 
    negativePatterns: RegExp[] = [],
    maxElements: number = 50
  ) {
    this.selectors = selectors;
    this.patterns = patterns;
    this.negativePatterns = negativePatterns;
    this.maxElements = maxElements;
  }

  abstract detect(dom: Document): DetectionResult[];
  
  getSelectors(): string[] {
    return this.selectors;
  }

  /**
   * Performance-optimized confidence calculation
   */
  protected calculateConfidence(element: Element, matchMethod: string): number {
    let confidence = 0.5;

    // Base confidence by match method
    const methodBonus = {
      'exact_selector': 0.45,
      'pattern_match': 0.3,
      'semantic_match': 0.2,
      'fallback': -0.1
    };
    
    confidence += methodBonus[matchMethod] || 0;

    // Quick element context analysis
    const tagName = element.tagName;
    const classList = element.classList;
    const textContent = element.textContent?.toLowerCase() || '';

    // Tag-based confidence adjustments
    if (['H1', 'H2', 'H3'].includes(tagName)) confidence += 0.15;
    if (['STRONG', 'B'].includes(tagName)) confidence += 0.1;
    if (tagName === 'A' && element.getAttribute('href')) confidence += 0.1;

    // Class-based confidence adjustments
    if (classList.contains('title') || classList.contains('name') || classList.contains('header')) {
      confidence += 0.1;
    }

    // Content quality adjustments
    if (textContent.length > 5 && textContent.length < 100) confidence += 0.05;
    if (textContent.length > 100) confidence -= 0.05;

    // Negative pattern penalties
    if (this.negativePatterns.some(pattern => pattern.test(textContent))) {
      confidence -= 0.2;
    }

    // Navigation/UI penalties
    if (['nav', 'menu', 'breadcrumb', 'sidebar', 'footer', 'header'].some(cls => classList.contains(cls))) {
      confidence -= 0.15;
    }

    return Math.min(Math.max(confidence, 0.1), 0.98);
  }

  /**
   * Deduplicate detection results by content and position
   */
  protected deduplicate(results: DetectionResult[]): DetectionResult[] {
    const seen = new Map<string, DetectionResult>();
    
    for (const result of results) {
      const content = result.element.textContent?.trim();
      if (!content) continue;
      
      // Create composite key for deduplication
      const key = `${content}_${result.element.tagName}_${result.element.className}`;
      
      // Keep highest confidence result for each unique content
      const existing = seen.get(key);
      if (!existing || result.confidence > existing.confidence) {
        seen.set(key, result);
      }
    }
    
    return Array.from(seen.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.maxElements);
  }
}

/**
 * Optimized title detector with multiple strategies
 */
class TitleDetector extends BaseDetector {
  constructor() {
    super(
      [
        // High-priority selectors
        'h1', 'h2', '.title', '.name', '.department-name', '[data-name]',
        // Common patterns
        '.header-title', '.page-title', '.section-title', '.card-title',
        // Semantic selectors
        '[itemprop="name"]', '[data-title]', '.display-name'
      ],
      [
        /^[A-Z][a-zA-Z\s&,-]{2,150}$/, // Proper titles
        /^[A-Z][a-zA-Z\s]+Department$/i, // Department names
        /^(Dr\.|Prof\.|Mr\.|Ms\.)\s+[A-Z][a-zA-Z\s]+$/i // People names with titles
      ],
      [
        /^\d+$/, // Pure numbers
        /^(the|a|an)$/i, // Articles only
        /^(click|read|more|view|next|prev|previous|continue)$/i, // Navigation
        /^(menu|nav|breadcrumb|search|login|signup)$/i, // UI elements
        /^https?:\/\//, // URLs
        /^[\s\n\t]*$/ // Whitespace only
      ],
      30 // Max title candidates
    );
  }

  detect(dom: Document): DetectionResult[] {
    const results: DetectionResult[] = [];
    const processedTexts = new Set<string>();

    // Strategy 1: High-priority selectors (exact match)
    for (const selector of this.selectors.slice(0, 6)) { // First 6 are high-priority
      try {
        const elements = dom.querySelectorAll(selector);
        
        for (const element of Array.from(elements).slice(0, 10)) { // Limit per selector
          const text = element.textContent?.trim();
          if (!text || processedTexts.has(text) || text.length < 2 || text.length > 200) continue;
          
          // Quick negative pattern check
          if (this.negativePatterns.some(pattern => pattern.test(text.toLowerCase()))) continue;
          
          processedTexts.add(text);
          results.push({
            element,
            selector,
            confidence: this.calculateConfidence(element, 'exact_selector'),
            metadata: { 
              match_method: 'selector', 
              text_length: text.length,
              selector_priority: this.selectors.indexOf(selector)
            }
          });
        }
      } catch (selectorError) {
        console.warn(`Invalid selector: ${selector}`, selectorError);
      }
    }

    // Strategy 2: Pattern-based fallback (if not enough results)
    if (results.length < 3) {
      const candidateElements = dom.querySelectorAll('*');
      let examined = 0;
      
      for (const element of candidateElements) {
        if (examined++ > 1000) break; // Performance limit
        
        const text = element.textContent?.trim();
        if (!text || processedTexts.has(text)) continue;
        
        if (this.patterns.some(pattern => pattern.test(text))) {
          processedTexts.add(text);
          results.push({
            element,
            selector: this.generateFallbackSelector(element),
            confidence: this.calculateConfidence(element, 'pattern_match'),
            metadata: { match_method: 'pattern' }
          });
          
          if (results.length >= 20) break; // Enough candidates
        }
      }
    }

    return this.deduplicate(results);
  }

  private generateFallbackSelector(element: Element): string {
    if (element.id) return `#${element.id}`;
    
    const tagName = element.tagName.toLowerCase();
    let selector = tagName;
    
    if (element.className) {
      const classes = Array.from(element.classList)
        .filter(cls => cls.length > 0 && cls.length < 30)
        .slice(0, 2);
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    return selector;
  }
}

/**
 * Optimized description detector with content filtering
 */
class DescriptionDetector extends BaseDetector {
  constructor() {
    super(
      [
        // Primary content selectors
        '.description', '.summary', '.content', '.bio', '.about',
        // Paragraph selectors (filtered)
        'p:not(.nav):not(.menu)', '.text-content', '.body-text',
        // Semantic selectors
        '[itemprop="description"]', '[data-description]'
      ],
      [
        /^.{20,2000}$/, // Substantial content
        /^[A-Z][^.!?]*[.!?]\s*[A-Z]/, // Multi-sentence content
      ],
      [
        /^(click|read|more|view|next|previous|home|back)$/i, // Navigation
        /^(menu|nav|breadcrumb|search|login)$/i, // UI elements
        /^\d+(\.\d+)?$/, // Numbers only
        /^(©|copyright|all rights reserved)/i // Legal text
      ],
      10 // Max description candidates
    );
  }

  detect(dom: Document): DetectionResult[] {
    const results: DetectionResult[] = [];
    const processedTexts = new Set<string>();

    for (const selector of this.selectors) {
      try {
        const elements = dom.querySelectorAll(selector);
        
        for (const element of Array.from(elements).slice(0, 5)) {
          const text = element.textContent?.trim();
          if (!text || processedTexts.has(text)) continue;
          
          // Content quality filters
          if (text.length < 20 || text.length > 3000) continue;
          if (this.isNavigationOrUIText(text)) continue;
          if (this.negativePatterns.some(pattern => pattern.test(text))) continue;
          
          // Check for substantial content
          if (this.hasSubstantialContent(text)) {
            processedTexts.add(text);
            results.push({
              element,
              selector,
              confidence: this.calculateConfidence(element, 'exact_selector'),
              metadata: { 
                match_method: 'selector',
                text_length: text.length,
                word_count: text.split(/\s+/).length
              }
            });
          }
        }
      } catch (selectorError) {
        console.warn(`Invalid description selector: ${selector}`, selectorError);
      }
    }

    // Sort by content quality and confidence
    return results.sort((a, b) => {
      const aScore = a.confidence * (a.metadata?.text_length || 0);
      const bScore = b.confidence * (b.metadata?.text_length || 0);
      return bScore - aScore;
    }).slice(0, 5);
  }

  private isNavigationOrUIText(text: string): boolean {
    const navPatterns = [
      /^(next|previous|more|view|click|read|back|home|menu|nav)$/i,
      /^page \d+ of \d+$/i,
      /^(login|signup|register|subscribe)$/i,
      /^(search|filter|sort)$/i
    ];
    
    return navPatterns.some(pattern => pattern.test(text.trim()));
  }

  private hasSubstantialContent(text: string): boolean {
    const words = text.split(/\s+/);
    
    // Must have multiple words
    if (words.length < 5) return false;
    
    // Must have some longer words (not all short words)
    const longWords = words.filter(word => word.length > 4);
    if (longWords.length < 2) return false;
    
    // Must not be mostly numbers
    const numbers = words.filter(word => /^\d+$/.test(word));
    if (numbers.length > words.length * 0.5) return false;
    
    return true;
  }
}

/**
 * Performance-optimized link detector
 */
class LinkDetector extends BaseDetector {
  constructor() {
    super(
      ['a[href]', '[data-url]', '[data-link]'],
      [/^https?:\/\/.+/],
      [/javascript:|mailto:|tel:|#|\/\/$/] // Exclude JS, fragments, empty hrefs
    );
  }

  detect(dom: Document): DetectionResult[] {
    const results: DetectionResult[] = [];
    const processedHrefs = new Set<string>();

    const linkElements = dom.querySelectorAll('a[href]');
    
    for (const element of Array.from(linkElements).slice(0, 100)) { // Performance limit
      const href = element.getAttribute('href')?.trim();
      if (!href || processedHrefs.has(href)) continue;
      
      // Filter out unwanted links
      if (this.negativePatterns.some(pattern => pattern.test(href))) continue;
      if (href.length < 4 || href.length > 500) continue;
      
      const normalizedURL = this.normalizeURL(href);
      if (normalizedURL) {
        processedHrefs.add(href);
        results.push({
          element,
          selector: this.generateLinkSelector(element, href),
          confidence: this.calculateLinkConfidence(element, normalizedURL),
          metadata: { 
            href: normalizedURL,
            match_method: 'link_attribute',
            link_type: this.classifyLinkType(element, normalizedURL)
          }
        });
      }
    }

    return results.slice(0, 20); // Limit total results
  }

  private normalizeURL(href: string): string | null {
    try {
      if (href.startsWith('//')) return `https:${href}`;
      if (href.startsWith('/')) return href; // Keep relative URLs
      if (href.startsWith('http')) return href; // Already absolute
      if (!href.includes('://') && !href.startsWith('/')) {
        // Relative path or malformed URL
        return null;
      }
      return href;
    } catch {
      return null;
    }
  }

  private calculateLinkConfidence(element: Element, url: string): number {
    let confidence = 0.7;
    
    // URL quality
    if (url.startsWith('https://')) confidence += 0.1;
    if (url.includes('.edu') || url.includes('.gov') || url.includes('.org')) confidence += 0.05;
    
    // Link text quality
    const linkText = element.textContent?.trim() || '';
    if (linkText.length > 3 && linkText.length < 50) confidence += 0.1;
    if (linkText.toLowerCase() === 'read more' || linkText.toLowerCase() === 'learn more') confidence += 0.05;
    
    // Context clues
    const parent = element.parentElement;
    if (parent?.tagName === 'LI') confidence += 0.05;
    if (element.classList.contains('external-link')) confidence += 0.05;
    
    return Math.min(confidence, 0.95);
  }

  private classifyLinkType(element: Element, url: string): string {
    if (url.includes('mailto:')) return 'email';
    if (url.includes('tel:')) return 'phone';
    if (url.match(/\.(pdf|doc|docx|xls|xlsx)$/i)) return 'document';
    if (url.match(/\.(jpg|jpeg|png|gif|svg)$/i)) return 'image';
    if (element.classList.contains('external')) return 'external';
    if (url.startsWith('/') || url.includes(window.location?.hostname)) return 'internal';
    return 'external';
  }

  private generateLinkSelector(element: Element, href: string): string {
    if (element.id) return `#${element.id}`;
    
    // Use href as unique identifier when possible
    const shortHref = href.length < 100 ? href : href.substring(0, 50) + '...';
    return `a[href="${href}"]`;
  }
}

/**
 * Performance-optimized extractors
 */
class TextExtractor {
  extract(element: Element): ExtractionResult {
    const text = this.extractCleanText(element);
    
    return {
      value: text,
      confidence: this.calculateTextConfidence(text),
      type_validated: typeof text === 'string',
      format_validated: text.length > 0 && text.length < 1000,
      extraction_method: 'text_content'
    };
  }

  private extractCleanText(element: Element): string {
    // Clone to avoid modifying original DOM
    const clone = element.cloneNode(true) as Element;
    
    // Remove unwanted elements
    clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    
    // Get text and clean it
    const text = clone.textContent || '';
    return text.trim().replace(/\s+/g, ' ').substring(0, 1000);
  }

  private calculateTextConfidence(text: string): number {
    if (!text) return 0.0;
    if (text.length < 2) return 0.2;
    if (text.length > 500) return 0.7; // Very long text might be concatenated content
    
    // Quality indicators
    let confidence = 0.8;
    
    // Has mix of letters and appropriate punctuation
    if (/^[A-Za-z]/.test(text) && /[a-z]/.test(text)) confidence += 0.1;
    
    // Not all caps (unless appropriate)
    if (text === text.toUpperCase() && text.length > 10) confidence -= 0.2;
    
    // Not mostly numbers
    const numberRatio = (text.match(/\d/g) || []).length / text.length;
    if (numberRatio > 0.5) confidence -= 0.3;
    
    return Math.min(Math.max(confidence, 0.1), 0.95);
  }
}

/**
 * URL extractor with validation and normalization
 */
class URLExtractor {
  extract(element: Element): ExtractionResult {
    const url = this.extractURL(element);
    const isValid = url ? this.validateURL(url) : false;
    
    return {
      value: url,
      confidence: isValid ? 0.9 : (url ? 0.4 : 0.0),
      type_validated: typeof url === 'string',
      format_validated: isValid,
      extraction_method: 'href_attribute'
    };
  }

  private extractURL(element: Element): string | null {
    // Priority order for URL extraction
    const sources = [
      () => element.getAttribute('href'),
      () => element.getAttribute('data-url'),
      () => element.getAttribute('data-link'),
      () => element.getAttribute('src'),
      () => {
        // Extract URL from text content as fallback
        const text = element.textContent?.trim() || '';
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        return urlMatch ? urlMatch[0] : null;
      }
    ];

    for (const source of sources) {
      const url = source();
      if (url && url.trim()) {
        return this.normalizeURL(url.trim());
      }
    }

    return null;
  }

  private normalizeURL(url: string): string {
    // Basic cleanup
    url = url.replace(/['"]/g, ''); // Remove quotes
    
    // Handle protocol-relative URLs
    if (url.startsWith('//')) return `https:${url}`;
    
    // Keep relative URLs as-is for now
    if (url.startsWith('/')) return url;
    
    // Add protocol if missing
    if (!url.includes('://') && !url.startsWith('/')) {
      return `https://${url}`;
    }
    
    return url;
  }

  private validateURL(url: string): boolean {
    if (!url) return false;
    
    try {
      // Handle relative URLs
      const testURL = url.startsWith('/') ? `https://example.com${url}` : url;
      const parsed = new URL(testURL);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }
}

/**
 * Rich text extractor with formatting preservation
 */
class RichTextExtractor {
  extract(element: Element): ExtractionResult {
    const text = this.extractFormattedText(element);
    const confidence = this.calculateRichTextConfidence(text, element);
    
    return {
      value: text,
      confidence,
      type_validated: typeof text === 'string',
      format_validated: text.length >= 10 && text.length <= 5000,
      extraction_method: 'formatted_text'
    };
  }

  private extractFormattedText(element: Element): string {
    // Create a clean copy
    const clone = element.cloneNode(true) as Element;
    
    // Remove unwanted elements
    clone.querySelectorAll('script, style, noscript, nav, .nav, .menu, .breadcrumb').forEach(el => el.remove());
    
    // Convert block elements to newlines
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    clone.querySelectorAll('p, div, li').forEach(block => {
      if (block.nextSibling) {
        block.insertAdjacentText('afterend', '\n');
      }
    });
    
    // Extract and clean text
    let text = clone.textContent || '';
    
    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Preserve paragraph breaks
    text = text.replace(/\n\s*\n/g, '\n\n');
    
    // Limit length
    return text.substring(0, 5000);
  }

  private calculateRichTextConfidence(text: string, element: Element): number {
    if (!text || text.length < 10) return 0.1;
    
    let confidence = 0.7;
    
    // Length quality curve
    if (text.length >= 50 && text.length <= 1000) confidence += 0.1;
    if (text.length > 1000 && text.length <= 3000) confidence += 0.05;
    if (text.length > 3000) confidence -= 0.1; // Might be concatenated content
    
    // Sentence structure
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
    if (sentences.length >= 2) confidence += 0.1;
    if (sentences.length >= 5) confidence += 0.05;
    
    // Context clues
    const tagName = element.tagName.toLowerCase();
    if (['p', 'div', 'section', 'article'].includes(tagName)) confidence += 0.05;
    
    const classes = element.className.toLowerCase();
    if (classes.includes('description') || classes.includes('content') || classes.includes('summary')) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 0.9);
  }
}

/**
 * Base validator with performance optimizations
 */
abstract class BaseValidator {
  abstract validate(value: any): { valid: boolean; reason?: string; confidence?: number };
  
  protected isFastValidation(): boolean {
    return true; // Subclasses can override for expensive validations
  }
}

/**
 * Length-based validators (fast)
 */
class MinLengthValidator extends BaseValidator {
  constructor(private minLength: number) {
    super();
  }

  validate(value: any): { valid: boolean; reason?: string; confidence?: number } {
    const text = String(value || '');
    const isValid = text.length >= this.minLength;
    
    return {
      valid: isValid,
      reason: isValid ? undefined : `Length ${text.length} below minimum ${this.minLength}`,
      confidence: isValid ? 0.9 : 0.1
    };
  }
}

class MaxLengthValidator extends BaseValidator {
  constructor(private maxLength: number) {
    super();
  }

  validate(value: any): { valid: boolean; reason?: string; confidence?: number } {
    const text = String(value || '');
    const isValid = text.length <= this.maxLength;
    
    return {
      valid: isValid,
      reason: isValid ? undefined : `Length ${text.length} exceeds maximum ${this.maxLength}`,
      confidence: isValid ? 0.9 : 0.1
    };
  }
}

/**
 * Format validators with regex caching
 */
class URLFormatValidator extends BaseValidator {
  private static urlRegex = /^https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:\#(?:[\w.])*)?)?$/;

  validate(value: any): { valid: boolean; reason?: string; confidence?: number } {
    if (!value) return { valid: false, reason: 'URL is empty', confidence: 0.0 };
    
    const url = String(value).trim();
    
    // Handle relative URLs
    if (url.startsWith('/')) {
      return { valid: true, confidence: 0.8, reason: 'Relative URL' };
    }
    
    try {
      const parsed = new URL(url);
      const isValid = ['http:', 'https:'].includes(parsed.protocol);
      
      return {
        valid: isValid,
        reason: isValid ? undefined : `Invalid protocol: ${parsed.protocol}`,
        confidence: isValid ? 0.95 : 0.2
      };
    } catch (error) {
      // Fallback to regex for performance
      const regexValid = URLFormatValidator.urlRegex.test(url);
      return {
        valid: regexValid,
        reason: regexValid ? undefined : 'Invalid URL format',
        confidence: regexValid ? 0.8 : 0.1
      };
    }
  }
}

class EmailFormatValidator extends BaseValidator {
  private static emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  validate(value: any): { valid: boolean; reason?: string; confidence?: number } {
    if (!value) return { valid: false, reason: 'Email is empty', confidence: 0.0 };
    
    const email = String(value).trim().toLowerCase();
    const isValid = EmailFormatValidator.emailRegex.test(email) && email.length <= 254; // RFC limit
    
    return {
      valid: isValid,
      reason: isValid ? undefined : 'Invalid email format',
      confidence: isValid ? 0.95 : 0.1
    };
  }
}

/**
 * Main deterministic extractor class with performance optimizations
 */
export class DeterministicExtractor {
  private options: ExtractorOptions;
  private startTime: number = 0;
  private domIndexer: DOMIndexer;
  private processedNodes: Set<Element> = new Set();

  constructor(options: Partial<ExtractorOptions> = {}) {
    this.options = {
      max_candidates: 30,
      min_pattern_instances: 3,
      confidence_threshold: 0.6,
      enable_pattern_discovery: true,
      max_processing_time: 4000, // 4 seconds
      dom_traversal_limit: 5000,
      enable_anchor_validation: true,
      ...options
    };
    
    this.domIndexer = new DOMIndexer();
  }

  /**
   * Main processing method - extract structured data from DOM using schema contract
   */
  async process(dom: Document, contract: SchemaContract): Promise<DeterministicFindings> {
    this.startTime = Date.now();
    this.processedNodes.clear();
    
    const findings: DeterministicFindings = {
      hits: [],
      misses: [],
      candidates: [],
      support_map: {}
    };

    try {
      console.log(`🔍 Starting deterministic extraction for entity: ${contract.entity}`);
      console.log(`📊 Contract has ${contract.fields.length} fields (${contract.fields.filter(f => f.kind === 'required').length} required)`);

      // Build anchor index for evidence validation
      if (this.options.enable_anchor_validation) {
        console.time('AnchorIndexing');
        this.domIndexer.buildAnchorIndex(dom);
        console.timeEnd('AnchorIndexing');
      }

      // Phase 1: Process contract fields
      console.time('ContractFieldProcessing');
      await this.processContractFields(dom, contract, findings);
      console.timeEnd('ContractFieldProcessing');

      // Phase 2: Pattern discovery for new fields
      if (contract.governance.allowNewFields && this.options.enable_pattern_discovery) {
        console.time('PatternDiscovery');
        findings.candidates = await this.discoverPatterns(dom);
        console.timeEnd('PatternDiscovery');
      }

      // Phase 3: Calculate support map
      this.calculateSupportMap(findings);

      // Log results
      console.log(`✅ Deterministic extraction complete: ${findings.hits.length} hits, ${findings.misses.length} misses, ${findings.candidates.length} patterns`);
      console.log(`📈 Support map:`, findings.support_map);

      return findings;

    } catch (error) {
      console.error('❌ Deterministic extraction failed:', error);
      
      findings.misses.push({
        field: '_system_error',
        reason: `Processing error: ${error.message}`,
        selectors_tried: [],
        validation_errors: [error.message]
      });
      
      return findings;
    }
  }

  /**
   * Process each field defined in the contract with error handling
   */
  private async processContractFields(
    dom: Document, 
    contract: SchemaContract, 
    findings: DeterministicFindings
  ): Promise<void> {
    const contractFields = contract.fields.filter(f => f.kind !== 'discoverable');
    
    for (let i = 0; i < contractFields.length; i++) {
      const fieldSpec = contractFields[i];
      
      // Check timeout
      if (this.isTimeoutApproaching()) {
        console.warn(`⏰ Timeout approaching, skipping remaining ${contractFields.length - i} fields`);
        contractFields.slice(i).forEach(field => {
          findings.misses.push({
            field: field.name,
            reason: 'processing_timeout',
            selectors_tried: []
          });
        });
        break;
      }

      try {
        await this.processField(dom, fieldSpec, findings);
      } catch (fieldError) {
        console.error(`💥 Field processing failed for ${fieldSpec.name}:`, fieldError);
        findings.misses.push({
          field: fieldSpec.name,
          reason: `processing_error: ${fieldError.message}`,
          selectors_tried: [],
          validation_errors: [fieldError.message]
        });
      }
    }
  }

  /**
   * Process a single field specification with comprehensive validation
   */
  private async processField(
    dom: Document, 
    fieldSpec: FieldSpec, 
    findings: DeterministicFindings
  ): Promise<void> {
    console.log(`🔍 Processing field: ${fieldSpec.name} (${fieldSpec.kind})`);
    
    // Create field-specific detector and extractor
    const detector = this.createDetectorForField(fieldSpec);
    const extractor = this.createExtractorForField(fieldSpec);
    const validators = this.createValidatorsForField(fieldSpec);

    // Run detection
    const detectionResults = detector.detect(dom);
    console.log(`  📡 Found ${detectionResults.length} detection candidates`);
    
    if (detectionResults.length === 0) {
      findings.misses.push({
        field: fieldSpec.name,
        reason: 'no_detection_matches',
        selectors_tried: detector.getSelectors()
      });
      findings.support_map[fieldSpec.name] = 0;
      return;
    }

    // Extract and validate values
    const validExtractions = [];
    const validationErrors = [];
    let processed = 0;

    for (const detection of detectionResults) {
      if (processed++ > 10) break; // Limit processing per field
      
      try {
        // Extract value
        const extractionResult = extractor.extract(detection.element);
        
        if (!extractionResult.value) continue; // Skip empty values
        
        // Run validators
        const validationResults = validators.map(validator => {
          try {
            return validator.validate(extractionResult.value);
          } catch (validationError) {
            return { valid: false, reason: `Validation error: ${validationError.message}` };
          }
        });
        
        const allValidationsPassed = validationResults.every(result => result.valid);
        const avgValidationConfidence = validationResults
          .filter(r => r.valid)
          .reduce((sum, r) => sum + (r.confidence || 0.8), 0) / Math.max(validationResults.filter(r => r.valid).length, 1);
        
        if (!allValidationsPassed) {
          validationErrors.push(...validationResults.filter(r => !r.valid).map(r => r.reason || 'validation_failed'));
          continue;
        }

        // Calculate combined confidence with validation boost
        const combinedConfidence = Math.min(
          detection.confidence * 0.4 +
          extractionResult.confidence * 0.4 +
          avgValidationConfidence * 0.2,
          0.98
        );

        if (combinedConfidence >= this.options.confidence_threshold) {
          validExtractions.push({
            field: fieldSpec.name,
            value: extractionResult.value,
            evidence: this.createDOMEvidence(detection.element, detection.selector, detection.anchor_id),
            confidence: combinedConfidence,
            validation_passed: true
          });
        }

      } catch (extractionError) {
        console.warn(`  ⚠️ Extraction failed for ${fieldSpec.name}:`, extractionError.message);
        validationErrors.push(`extraction_error: ${extractionError.message}`);
      }
    }

    // Add results
    if (validExtractions.length > 0) {
      findings.hits.push(...validExtractions);
      console.log(`  ✅ Found ${validExtractions.length} valid extractions for ${fieldSpec.name}`);
    } else {
      findings.misses.push({
        field: fieldSpec.name,
        reason: validationErrors.length > 0 ? 'validation_failed' : 'no_valid_extractions',
        selectors_tried: detector.getSelectors(),
        validation_errors: validationErrors.slice(0, 5) // Limit error details
      });
      console.log(`  ❌ No valid extractions for ${fieldSpec.name}: ${validationErrors[0] || 'unknown'}`);
    }

    findings.support_map[fieldSpec.name] = validExtractions.length;
  }

  /**
   * Create appropriate detector for field
   */
  private createDetectorForField(fieldSpec: FieldSpec): BaseDetector {
    // Use existing field hints if available
    const selectors = fieldSpec.extractionHints?.selectors || [];
    
    // Add type-specific default selectors
    const typeSelectors = this.getTypeSpecificSelectors(fieldSpec.type, fieldSpec.name);
    const allSelectors = [...selectors, ...typeSelectors];
    
    const patterns = this.getTypeSpecificPatterns(fieldSpec.type);
    const negativePatterns = this.getTypeSpecificNegativePatterns(fieldSpec.type);
    
    switch (fieldSpec.name.toLowerCase()) {
      case 'name':
      case 'title':
        return new TitleDetector();
      case 'description':
      case 'summary':
      case 'bio':
      case 'about':
        return new DescriptionDetector();
      case 'url':
      case 'link':
      case 'website':
        return new LinkDetector();
      default:
        return new GenericDetector(allSelectors, patterns, negativePatterns);
    }
  }

  /**
   * Create appropriate extractor for field
   */
  private createExtractorForField(fieldSpec: FieldSpec): any {
    switch (fieldSpec.type) {
      case 'url':
        return new URLExtractor();
      case 'richtext':
        return new RichTextExtractor();
      default:
        return new TextExtractor();
    }
  }

  /**
   * Create validators for field
   */
  private createValidatorsForField(fieldSpec: FieldSpec): BaseValidator[] {
    const validators: BaseValidator[] = [];
    
    // Add validation from field specification
    if (fieldSpec.validation) {
      if (fieldSpec.validation.minLength) {
        validators.push(new MinLengthValidator(fieldSpec.validation.minLength));
      }
      if (fieldSpec.validation.maxLength) {
        validators.push(new MaxLengthValidator(fieldSpec.validation.maxLength));
      }
    }
    
    // Add type-specific validators
    switch (fieldSpec.type) {
      case 'url':
        validators.push(new URLFormatValidator());
        break;
      case 'email':
        validators.push(new EmailFormatValidator());
        break;
      default:
        // Default length constraints
        if (!validators.some(v => v instanceof MinLengthValidator)) {
          validators.push(new MinLengthValidator(1));
        }
        if (!validators.some(v => v instanceof MaxLengthValidator)) {
          validators.push(new MaxLengthValidator(2000));
        }
    }
    
    return validators;
  }

  /**
   * Get type-specific CSS selectors
   */
  private getTypeSpecificSelectors(type: string, fieldName: string): string[] {
    const baseSelectors: Record<string, string[]> = {
      'string': [
        `.${fieldName}`, `[data-${fieldName}]`, `.${fieldName}-text`,
        'h1', 'h2', 'h3', '.title', '.name', 'strong', 'b'
      ],
      'url': [
        'a[href]', `[data-${fieldName}]`, '.url', '.link', '[href]'
      ],
      'email': [
        'a[href^="mailto:"]', '.email', '[data-email]', 'a[href*="@"]'
      ],
      'richtext': [
        '.description', '.content', '.summary', '.bio', 'p', '.text'
      ]
    };
    
    return baseSelectors[type] || baseSelectors['string'];
  }

  /**
   * Get type-specific regex patterns
   */
  private getTypeSpecificPatterns(type: string): RegExp[] {
    const basePatterns: Record<string, RegExp[]> = {
      'string': [/^[A-Za-z][A-Za-z\s\-&,.']{1,200}$/],
      'url': [/^https?:\/\/[^\s]+$/],
      'email': [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/],
      'richtext': [/^.{20,2000}$/]
    };
    
    return basePatterns[type] || [];
  }

  /**
   * Get type-specific negative patterns
   */
  private getTypeSpecificNegativePatterns(type: string): RegExp[] {
    const negativePatterns: Record<string, RegExp[]> = {
      'string': [/^\d+$/, /^(click|more|view|read)$/i],
      'url': [/^javascript:|^mailto:|^tel:|^#$/],
      'email': [/^(noreply|no-reply)@/],
      'richtext': [/^(click|read|more|view|next)$/i]
    };
    
    return negativePatterns[type] || [];
  }

  /**
   * Create DOM evidence with anchor validation
   */
  private createDOMEvidence(element: Element, selector: string, anchorId?: string): DOMEvidence {
    return {
      selector,
      textContent: element.textContent?.substring(0, 200),
      dom_path: this.getDOMPath(element),
      element_tag: element.tagName.toLowerCase(),
      attributes: this.extractRelevantAttributes(element),
      confidence: 0.9,
      anchor_id: anchorId
    };
  }

  /**
   * Generate optimized DOM path for precise element identification
   */
  private getDOMPath(element: Element): string {
    const path = [];
    let current = element;
    
    while (current && current !== document.documentElement && path.length < 8) {
      let segment = current.tagName.toLowerCase();
      
      // Use ID if available (most stable)
      if (current.id && current.id.length < 50) {
        segment += `#${current.id}`;
        path.unshift(segment);
        break; // ID is unique, no need to continue
      }
      
      // Add distinguishing class
      if (current.className) {
        const stableClass = this.findStableClass(current);
        if (stableClass) segment += `.${stableClass}`;
      }
      
      // Add position for disambiguation
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children);
        const sameTagSiblings = siblings.filter(sib => 
          sib.tagName === current.tagName
        );
        
        if (sameTagSiblings.length > 1) {
          const index = sameTagSiblings.indexOf(current);
          segment += `:nth-of-type(${index + 1})`;
        }
      }
      
      path.unshift(segment);
      current = current.parentElement;
    }

    return path.length > 0 ? path.join(' > ') : 'unknown';
  }

  /**
   * Find the most stable class name for path generation
   */
  private findStableClass(element: Element): string | null {
    const classList = Array.from(element.classList);
    
    // Prefer semantic classes over utility classes
    const semanticClasses = classList.filter(cls => 
      cls.length > 3 && 
      cls.length < 30 && 
      !cls.match(/^(text-|bg-|p-|m-|w-|h-)/) && // Avoid utility classes
      !cls.match(/^\d+$/) && // Avoid numeric classes
      !cls.includes(' ')
    );
    
    // Return first stable semantic class
    return semanticClasses[0] || null;
  }

  /**
   * Extract relevant attributes for evidence tracking
   */
  private extractRelevantAttributes(element: Element): Record<string, string> {
    const relevantAttributes = ['class', 'id', 'data-name', 'data-id', 'href', 'src', 'alt', 'title', 'role'];
    const attributes: Record<string, string> = {};
    
    relevantAttributes.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value && value.length < 200) {
        attributes[attr] = value;
      }
    });
    
    return attributes;
  }

  /**
   * Discover repeated patterns with performance optimizations and confidence scoring
   */
  async discoverPatterns(dom: Document): Promise<Array<{
    pattern: string;
    instances: number;
    sample_nodes: Element[];
    confidence: number;
    field_suggestion?: string;
    evidence_anchors: string[];
  }>> {
    if (this.isTimeoutApproaching()) {
      console.log('⏰ Skipping pattern discovery due to time constraints');
      return [];
    }

    const candidates = [];
    
    try {
      // Strategy 1: Label-value patterns (high confidence)
      console.time('LabelValuePatterns');
      const labelValueCandidates = this.findLabelValuePatterns(dom);
      candidates.push(...labelValueCandidates);
      console.timeEnd('LabelValuePatterns');
      
      // Strategy 2: Structural patterns (medium confidence)
      if (!this.isTimeoutApproaching()) {
        console.time('StructuralPatterns');
        const structuralCandidates = this.findStructuralPatterns(dom);
        candidates.push(...structuralCandidates);
        console.timeEnd('StructuralPatterns');
      }
      
      // Strategy 3: Semantic patterns (high confidence)
      if (!this.isTimeoutApproaching()) {
        console.time('SemanticPatterns');
        const semanticCandidates = this.findSemanticPatterns(dom);
        candidates.push(...semanticCandidates);
        console.timeEnd('SemanticPatterns');
      }
      
    } catch (discoveryError) {
      console.warn('Pattern discovery failed:', discoveryError);
      return [];
    }
    
    // Filter, sort, and limit results
    return candidates
      .filter(c => c.instances >= this.options.min_pattern_instances)
      .sort((a, b) => (b.confidence * b.instances) - (a.confidence * a.instances))
      .slice(0, this.options.max_candidates);
  }

  /**
   * Find label-value pair patterns with optimized DOM traversal
   */
  private findLabelValuePatterns(dom: Document): Array<{
    pattern: string;
    instances: number;
    sample_nodes: Element[];
    confidence: number;
    field_suggestion?: string;
    evidence_anchors: string[];
  }> {
    const patterns = new Map<string, Element[]>();
    
    // Definition lists (high-quality structured data)
    const definitionTerms = dom.querySelectorAll('dt');
    definitionTerms.forEach(dt => {
      const labelText = dt.textContent?.trim().toLowerCase();
      if (this.isValidLabel(labelText)) {
        const pattern = this.normalizePatternText(labelText);
        if (!patterns.has(pattern)) patterns.set(pattern, []);
        patterns.get(pattern)!.push(dt);
      }
    });
    
    // Label elements and strong/bold text
    const labelElements = dom.querySelectorAll('strong, b, .label, .field-label, label');
    for (let i = 0; i < Math.min(labelElements.length, 500); i++) { // Performance limit
      const label = labelElements[i];
      const labelText = label.textContent?.trim().toLowerCase();
      
      if (this.isValidLabel(labelText)) {
        const pattern = this.normalizePatternText(labelText);
        if (!patterns.has(pattern)) patterns.set(pattern, []);
        patterns.get(pattern)!.push(label);
        
        this.processedNodes.add(label);
      }
    }

    return Array.from(patterns.entries())
      .filter(([pattern, elements]) => elements.length >= this.options.min_pattern_instances)
      .map(([pattern, elements]) => ({
        pattern,
        instances: elements.length,
        sample_nodes: elements.slice(0, 3),
        confidence: this.calculatePatternConfidence(pattern, elements, 'label_value'),
        field_suggestion: this.suggestFieldName(pattern),
        evidence_anchors: elements.slice(0, 5).map(el => this.getDOMPath(el))
      }));
  }

  /**
   * Find structural patterns (same classes, positions) with performance optimizations
   */
  private findStructuralPatterns(dom: Document): Array<{
    pattern: string;
    instances: number;
    sample_nodes: Element[];
    confidence: number;
    field_suggestion?: string;
    evidence_anchors: string[];
  }> {
    const structuralPatterns = new Map<string, Element[]>();
    const classesToCheck = new Set<string>();
    
    // First pass: collect interesting class patterns
    const elementsWithClasses = dom.querySelectorAll('[class]');
    for (let i = 0; i < Math.min(elementsWithClasses.length, 1000); i++) {
      const element = elementsWithClasses[i];
      const classes = Array.from(element.classList);
      
      // Look for semantic class patterns
      const semanticClasses = classes.filter(cls => 
        cls.length > 3 && 
        cls.length < 30 && 
        (cls.includes('item') || cls.includes('card') || cls.includes('entry') ||
         cls.includes('row') || cls.includes('field') || cls.includes('data'))
      );
      
      semanticClasses.forEach(cls => classesToCheck.add(cls));
    }

    // Second pass: find repeated patterns
    for (const className of Array.from(classesToCheck).slice(0, 50)) { // Limit classes to check
      try {
        const elements = dom.querySelectorAll(`.${className}`);
        
        if (elements.length >= this.options.min_pattern_instances && elements.length <= 200) {
          // Verify elements have similar content structure
          const contentSimilarity = this.calculateContentSimilarity(Array.from(elements).slice(0, 10));
          
          if (contentSimilarity > 0.5) {
            structuralPatterns.set(className, Array.from(elements));
          }
        }
      } catch (selectorError) {
        // Skip invalid class names
        continue;
      }
    }

    return Array.from(structuralPatterns.entries())
      .map(([pattern, elements]) => ({
        pattern: `class:${pattern}`,
        instances: elements.length,
        sample_nodes: elements.slice(0, 3),
        confidence: this.calculatePatternConfidence(pattern, elements, 'structural'),
        field_suggestion: this.inferFieldFromClassName(pattern),
        evidence_anchors: elements.slice(0, 5).map(el => this.getDOMPath(el))
      }));
  }

  /**
   * Find semantic patterns based on content analysis
   */
  private findSemanticPatterns(dom: Document): Array<{
    pattern: string;
    instances: number;
    sample_nodes: Element[];
    confidence: number;
    field_suggestion?: string;
    evidence_anchors: string[];
  }> {
    const semanticPatterns = new Map<string, Element[]>();
    
    // Pre-compiled semantic patterns for performance
    const semanticDetectors = [
      { 
        pattern: 'email', 
        regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/, 
        confidence: 0.95,
        selectors: ['*'] // Will be limited by traversal
      },
      { 
        pattern: 'phone', 
        regex: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/, 
        confidence: 0.9,
        selectors: ['*']
      },
      { 
        pattern: 'currency', 
        regex: /\$\d+(?:\.\d{2})?|\d+\.\d{2}\s*(?:USD|EUR|GBP)/, 
        confidence: 0.85,
        selectors: ['*']
      },
      { 
        pattern: 'percentage', 
        regex: /\b\d+(?:\.\d+)?%\b/, 
        confidence: 0.8,
        selectors: ['*']
      },
      { 
        pattern: 'date', 
        regex: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/, 
        confidence: 0.85,
        selectors: ['*']
      }
    ];

    // Process semantic patterns with performance limits
    for (const semantic of semanticDetectors) {
      const matchingElements: Element[] = [];
      let examined = 0;
      
      // Use text content search for better performance than querySelectorAll('*')
      const walker = document.createTreeWalker(
        dom.documentElement,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: () => {
            examined++;
            return examined > 1500 ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
          }
        }
      );
      
      let node;
      while (node = walker.nextNode()) {
        const element = node as Element;
        const text = element.textContent?.trim();
        
        if (text && semantic.regex.test(text) && !this.processedNodes.has(element)) {
          matchingElements.push(element);
          this.processedNodes.add(element);
          
          if (matchingElements.length >= 20) break; // Enough samples
        }
      }
      
      if (matchingElements.length >= this.options.min_pattern_instances) {
        semanticPatterns.set(semantic.pattern, matchingElements);
      }
    }

    return Array.from(semanticPatterns.entries())
      .map(([pattern, elements]) => ({
        pattern: `semantic:${pattern}`,
        instances: elements.length,
        sample_nodes: elements.slice(0, 3),
        confidence: 0.85, // High confidence for semantic patterns
        field_suggestion: pattern,
        evidence_anchors: elements.slice(0, 5).map(el => this.getDOMPath(el))
      }));
  }

  /**
   * Normalize pattern text for consistent matching
   */
  private normalizePatternText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special chars
      .replace(/\s+/g, '_') // Replace spaces
      .replace(/^(the|a|an)_/, '') // Remove articles
      .replace(/_{2,}/g, '_') // Collapse multiple underscores
      .replace(/^_|_$/g, '') // Trim underscores
      .substring(0, 50); // Limit length
  }

  /**
   * Suggest field name from pattern
   */
  private suggestFieldName(pattern: string): string {
    // Common field name mappings
    const mappings: Record<string, string> = {
      'full_name': 'name',
      'first_name': 'first_name',
      'last_name': 'last_name',
      'email_address': 'email',
      'phone_number': 'phone',
      'web_site': 'url',
      'home_page': 'url',
      'job_title': 'title',
      'department_name': 'department',
      'research_area': 'research_focus',
      'office_location': 'office',
      'contact_info': 'contact'
    };
    
    // Check for direct mapping
    if (mappings[pattern]) return mappings[pattern];
    
    // Clean up pattern text
    const fieldName = pattern
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
    
    return fieldName || 'discovered_field';
  }

  /**
   * Infer field name from class name patterns
   */
  private inferFieldFromClassName(className: string): string {
    const classLower = className.toLowerCase();
    
    // Direct matches
    if (classLower.includes('email')) return 'email';
    if (classLower.includes('phone')) return 'phone';
    if (classLower.includes('url') || classLower.includes('link')) return 'url';
    if (classLower.includes('title') || classLower.includes('name')) return 'name';
    if (classLower.includes('description') || classLower.includes('bio')) return 'description';
    if (classLower.includes('date') || classLower.includes('time')) return 'date';
    if (classLower.includes('price') || classLower.includes('cost')) return 'price';
    if (classLower.includes('image') || classLower.includes('photo')) return 'image';
    
    // Generic field name from class
    return classLower.replace(/[^a-z0-9]/g, '_').replace(/_{2,}/g, '_') || 'class_field';
  }

  /**
   * Calculate pattern confidence based on multiple factors
   */
  private calculatePatternConfidence(pattern: string, elements: Element[], type: string): number {
    let confidence = 0.5;
    
    // Base confidence by type
    const typeBonus = {
      'label_value': 0.2,
      'structural': 0.15,
      'semantic': 0.25
    };
    confidence += typeBonus[type] || 0;
    
    // Instance count bonus (more instances = higher confidence)
    const instanceBonus = Math.min(elements.length / 10, 0.15);
    confidence += instanceBonus;
    
    // Content consistency bonus
    const contentSimilarity = this.calculateContentSimilarity(elements.slice(0, 5));
    confidence += contentSimilarity * 0.1;
    
    // Semantic value bonus
    if (this.hasSemanticValue(pattern)) confidence += 0.1;
    
    // Position consistency bonus
    const positionConsistency = this.calculatePositionConsistency(elements.slice(0, 10));
    confidence += positionConsistency * 0.05;
    
    return Math.min(confidence, 0.95);
  }

  /**
   * Calculate content similarity between elements
   */
  private calculateContentSimilarity(elements: Element[]): number {
    if (elements.length < 2) return 0;
    
    const contentLengths = elements.map(el => el.textContent?.length || 0);
    const avgLength = contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length;
    
    if (avgLength === 0) return 0;
    
    // Calculate coefficient of variation (lower = more similar)
    const variance = contentLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / contentLengths.length;
    const cv = Math.sqrt(variance) / avgLength;
    
    // Convert to similarity score (0-1, higher = more similar)
    return Math.max(0, 1 - cv);
  }

  /**
   * Calculate position consistency for repeated patterns
   */
  private calculatePositionConsistency(elements: Element[]): number {
    if (elements.length < 2) return 0;
    
    try {
      const positions = elements.map(el => {
        const rect = el.getBoundingClientRect();
        return { x: rect.left, y: rect.top };
      });
      
      // Check if elements are in a grid or list pattern
      const xPositions = positions.map(p => p.x);
      const yPositions = positions.map(p => p.y);
      
      const xVariance = this.calculateVariance(xPositions);
      const yVariance = this.calculateVariance(yPositions);
      
      // Low variance in one dimension = good structure
      const hasStructure = xVariance < 100 || yVariance < 100; // Pixels
      
      return hasStructure ? 0.8 : 0.3;
    } catch {
      return 0.3; // Default for position calculation errors
    }
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    return numbers.reduce((sum, num) => sum + Math.pow(num - avg, 2), 0) / numbers.length;
  }

  /**
   * Check if text could be a valid label
   */
  private isValidLabel(text?: string): boolean {
    if (!text) return false;
    if (text.length < 2 || text.length > 50) return false;
    
    // Must contain letters
    if (!/[a-zA-Z]/.test(text)) return false;
    
    // Not mostly numbers
    const numberRatio = (text.match(/\d/g) || []).length / text.length;
    if (numberRatio > 0.7) return false;
    
    // Not navigation text
    const navWords = ['click', 'read', 'more', 'view', 'next', 'prev', 'home', 'back', 'menu', 'nav'];
    if (navWords.some(word => text.toLowerCase().includes(word))) return false;
    
    return true;
  }

  /**
   * Check if pattern has semantic value
   */
  private hasSemanticValue(pattern: string): boolean {
    const semanticKeywords = [
      'name', 'title', 'description', 'email', 'phone', 'address', 'date', 'price', 'cost',
      'category', 'type', 'status', 'location', 'department', 'role', 'position', 'office',
      'research', 'expertise', 'specialization', 'field', 'area', 'focus', 'interest'
    ];
    
    return semanticKeywords.some(keyword => pattern.includes(keyword));
  }

  /**
   * Calculate final support map with validation
   */
  private calculateSupportMap(findings: DeterministicFindings): void {
    // Initialize all fields in support map
    findings.misses.forEach(miss => {
      if (!(miss.field in findings.support_map)) {
        findings.support_map[miss.field] = 0;
      }
    });
    
    // Add hits to support map (may override misses if extractions were found)
    const fieldCounts = new Map<string, number>();
    findings.hits.forEach(hit => {
      fieldCounts.set(hit.field, (fieldCounts.get(hit.field) || 0) + 1);
    });
    
    fieldCounts.forEach((count, field) => {
      findings.support_map[field] = count;
    });
    
    // Add discovered patterns to support map
    findings.candidates.forEach(candidate => {
      if (candidate.field_suggestion) {
        findings.support_map[candidate.field_suggestion] = candidate.instances;
      }
    });
    
    console.log(`📊 Final support map: ${Object.keys(findings.support_map).length} fields tracked`);
  }

  /**
   * Check if timeout is approaching
   */
  private isTimeoutApproaching(): boolean {
    const elapsed = Date.now() - this.startTime;
    return elapsed > this.options.max_processing_time * 0.8; // 80% of time limit
  }
}

/**
 * Generic detector for custom fields
 */
class GenericDetector extends BaseDetector {
  constructor(selectors: string[], patterns: RegExp[] = [], negativePatterns: RegExp[] = []) {
    super(selectors, patterns, negativePatterns);
  }

  detect(dom: Document): DetectionResult[] {
    const results: DetectionResult[] = [];
    
    for (const selector of this.selectors.slice(0, 10)) { // Limit selectors
      try {
        const elements = dom.querySelectorAll(selector);
        
        for (const element of Array.from(elements).slice(0, 20)) { // Limit elements
          const text = element.textContent?.trim();
          if (!text) continue;
          
          // Apply patterns if provided
          if (this.patterns.length > 0) {
            if (!this.patterns.some(pattern => pattern.test(text))) continue;
          }
          
          // Apply negative patterns
          if (this.negativePatterns.some(pattern => pattern.test(text))) continue;
          
          results.push({
            element,
            selector,
            confidence: this.calculateConfidence(element, 'exact_selector'),
            metadata: { match_method: 'generic_selector' }
          });
        }
      } catch (selectorError) {
        console.warn(`Invalid generic selector: ${selector}`, selectorError);
      }
    }
    
    return this.deduplicate(results);
  }
}

/**
 * Factory function for performance-optimized deterministic extractor
 */
export function createDeterministicExtractor(options: Partial<ExtractorOptions> = {}): DeterministicExtractor {
  const performanceOptions: ExtractorOptions = {
    max_candidates: 25, // Reduced for performance
    min_pattern_instances: 3, // Quality over quantity
    confidence_threshold: 0.6, // Balanced threshold
    enable_pattern_discovery: true,
    max_processing_time: 3500, // Fast response time
    dom_traversal_limit: 3000, // Performance limit for large pages
    enable_anchor_validation: true,
    ...options
  };
  
  return new DeterministicExtractor(performanceOptions);
}

/**
 * Utility functions for creating optimized field specifications
 */
export const OptimizedFieldSpecFactory = {
  
  createFastNameField(): FieldSpec {
    return {
      name: 'name',
      type: 'text',
      priority: 'required',
      description: 'Primary name or title',
      validation: {
        minLength: 2,
        maxLength: 200
      },
      extractionHints: {
        selectors: ['h1', 'h2', '.title', '.name', '[data-name]'],
        keywords: ['name', 'title', 'header']
      }
    };
  },
  
  createFastDescriptionField(): FieldSpec {
    return {
      name: 'description',
      type: 'text',
      priority: 'expected',
      description: 'Content description or summary',
      validation: {
        minLength: 10,
        maxLength: 3000
      },
      extractionHints: {
        selectors: ['.description', '.summary', 'p:not(.nav)', '.content'],
        keywords: ['description', 'summary', 'about']
      }
    };
  },
  
  createFastURLField(): FieldSpec {
    return {
      name: 'url',
      type: 'url',
      priority: 'expected', 
      description: 'Associated URL or link',
      extractionHints: {
        selectors: ['a[href]', '[data-url]'],
        keywords: ['url', 'link', 'website']
      }
    };
  }
};

/**
 * Performance-optimized contract factory for common patterns
 */
export const OptimizedContractFactory = {
  
  createDepartmentContract(): SchemaContract {
    return {
      id: 'optimized_department',
      name: 'Department/Organization',
      description: 'Optimized extraction for organizational units',
      fields: [
        OptimizedFieldSpecFactory.createFastNameField(),
        OptimizedFieldSpecFactory.createFastDescriptionField(),
        OptimizedFieldSpecFactory.createFastURLField()
      ],
      metadata: {
        domain: 'academic',
        confidence: 0.9,
        source: 'template',
        created: new Date().toISOString(),
        userQuery: ''
      },
      validation: {
        minRequiredFields: 1,
        allowAdditionalFields: true,
        strictMode: false
      }
    };
  },
  
  createPersonContract(): SchemaContract {
    return {
      id: 'optimized_person',
      name: 'Person/Profile', 
      description: 'Optimized extraction for people profiles',
      fields: [
        OptimizedFieldSpecFactory.createFastNameField(),
        {
          name: 'email',
          type: 'email',
          priority: 'expected',
          description: 'Email address',
          extractionHints: {
            selectors: ['a[href^="mailto:"]', '.email', '[data-email]'],
            keywords: ['email', 'contact']
          }
        },
        OptimizedFieldSpecFactory.createFastDescriptionField(),
        {
          name: 'title',
          type: 'text',
          priority: 'expected',
          description: 'Job title or position',
          validation: {
            minLength: 3,
            maxLength: 100
          },
          extractionHints: {
            selectors: ['.title', '.position', '.role', '[data-title]'],
            keywords: ['title', 'position', 'role']
          }
        }
      ],
      metadata: {
        domain: 'people',
        confidence: 0.95,
        source: 'template',
        created: new Date().toISOString(),
        userQuery: ''
      },
      validation: {
        minRequiredFields: 1,
        allowAdditionalFields: true,
        strictMode: false
      }
    };
  }
};

/**
 * Export main extractor class and utilities
 */
export { DeterministicExtractor };
export default DeterministicExtractor;
