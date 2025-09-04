/**
 * Extractor Implementations for Evidence-First System
 * Based on EVIDENCE_FIRST_ADAPTIVE_EXTRACTION_PLAN_2025_09_03.md
 */

import { Extractor } from '../types';

/**
 * Text content extractor
 */
export class TextExtractor implements Extractor {
  async extract(element: Element): Promise<string> {
    return element.textContent?.trim() || '';
  }
}

/**
 * Rich text/HTML content extractor
 */
export class RichTextExtractor implements Extractor {
  async extract(element: Element): Promise<string> {
    // Extract inner HTML but clean it up
    const html = element.innerHTML;
    
    // Remove script and style tags
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .trim();
    
    return cleanHtml || element.textContent?.trim() || '';
  }
}

/**
 * URL extractor from links
 */
export class URLExtractor implements Extractor {
  async extract(element: Element): Promise<string> {
    if (element.tagName.toLowerCase() === 'a') {
      return (element as HTMLAnchorElement).href || '';
    }
    
    // Look for URL in data attributes or other places
    const url = element.getAttribute('data-url') ||
                element.getAttribute('href') ||
                element.textContent?.trim();
    
    return url || '';
  }
}

/**
 * Generic extractor with smart content detection
 */
export class GenericExtractor implements Extractor {
  async extract(element: Element): Promise<any> {
    const tagName = element.tagName.toLowerCase();
    
    // Handle different element types appropriately
    switch (tagName) {
      case 'a':
        return (element as HTMLAnchorElement).href || element.textContent?.trim();
      
      case 'img':
        return (element as HTMLImageElement).src || (element as HTMLImageElement).alt;
      
      case 'input':
        return (element as HTMLInputElement).value || (element as HTMLInputElement).placeholder;
      
      case 'select':
        const selectedOption = (element as HTMLSelectElement).selectedOptions[0];
        return selectedOption?.textContent || selectedOption?.value;
      
      default:
        // For most elements, extract text content
        const text = element.textContent?.trim();
        
        // Try to detect if this looks like structured data
        if (text?.includes('@') && text.includes('.')) {
          return text; // Likely an email
        }
        if (text?.match(/^\d{3}-\d{3}-\d{4}$/)) {
          return text; // Likely a phone number
        }
        if (text?.match(/https?:\/\//)) {
          return text; // Likely a URL
        }
        
        return text || '';
    }
  }
}

/**
 * Email extractor with validation
 */
export class EmailExtractor implements Extractor {
  async extract(element: Element): Promise<string> {
    let text = '';
    
    if (element.tagName.toLowerCase() === 'a' && (element as HTMLAnchorElement).href.startsWith('mailto:')) {
      text = (element as HTMLAnchorElement).href.replace('mailto:', '');
    } else {
      text = element.textContent?.trim() || '';
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(text)) {
      return text;
    }
    
    // Try to extract email from text
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    return emailMatch?.[0] || '';
  }
}

/**
 * Phone number extractor with formatting
 */
export class PhoneExtractor implements Extractor {
  async extract(element: Element): Promise<string> {
    const text = element.textContent?.trim() || '';
    
    // Common phone number patterns
    const patterns = [
      /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
      /\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
      /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }
    
    return text;
  }
}