/**
 * Evidence-First Schema Contracts System
 * Complete implementation as specified in the Evidence-First Adaptive Extraction Plan
 */

// ===== CORE TYPES =====

export type FieldKind = "required" | "expected" | "discoverable";
export type FieldType = "string" | "email" | "url" | "enum" | "richtext" | "array" | "number" | "date" | "phone" | "image" | "boolean" | "object";

export interface FieldSpec {
  name: string;
  kind: FieldKind;
  type: FieldType;
  detector: Detector;        // cheap, deterministic predicate(s)
  extractor: Extractor;      // how to pull value if detector hits
  validators: Validator[];   // type/format checks
  min_support?: number;      // e.g., need k instances before we accept a new field
}

export interface SchemaContract {
  entity: string;           // "person", "department", "product", etc.
  fields: FieldSpec[];
  governance: {
    allowNewFields: boolean;     // discovery gate
    newFieldPolicy: "evidence_first" | "strict"; 
    min_support_threshold: number;  // minimum instances for field promotion
    max_discoverable_fields: number; // prevent schema explosion
  };
}

export interface DOMEvidence {
  selector: string;
  textContent?: string;
  dom_path: string;
}

export interface DetectionResult {
  element: Element;
  selector: string;
  confidence: number;
}

// ===== DETECTOR SYSTEM =====

export abstract class Detector {
  abstract detect(dom: Document): Promise<DetectionResult[]>;
  abstract getSelectors(): string[];
}

export class TitleDetector extends Detector {
  constructor(private selectors: string[]) {
    super();
  }

  async detect(dom: Document): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];
    
    for (const selector of this.selectors) {
      try {
        const elements = dom.querySelectorAll(selector);
        elements.forEach((element, index) => {
          const text = element.textContent?.trim();
          if (text && text.length >= 2 && text.length <= 100) {
            results.push({
              element,
              selector: `${selector}:nth-child(${index + 1})`,
              confidence: this.calculateTitleConfidence(text, element)
            });
          }
        });
      } catch (error) {
        console.warn(`TitleDetector selector failed: ${selector}`, error);
      }
    }
    
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private calculateTitleConfidence(text: string, element: Element): number {
    let confidence = 0.5; // base confidence
    
    // Prefer shorter, more title-like text
    if (text.length < 50) confidence += 0.2;
    if (text.length < 20) confidence += 0.1;
    
    // Boost confidence for title-like tags
    const tagName = element.tagName.toLowerCase();
    if (['h1', 'h2', 'h3'].includes(tagName)) confidence += 0.3;
    if (tagName === 'title') confidence += 0.4;
    
    // Boost for title-like classes
    const className = element.className?.toLowerCase() || '';
    if (className.includes('title')) confidence += 0.2;
    if (className.includes('name')) confidence += 0.15;
    if (className.includes('header')) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  getSelectors(): string[] {
    return this.selectors;
  }
}

export class DescriptionDetector extends Detector {
  constructor(private selectors: string[]) {
    super();
  }

  async detect(dom: Document): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];
    
    for (const selector of this.selectors) {
      try {
        const elements = dom.querySelectorAll(selector);
        elements.forEach((element, index) => {
          const text = element.textContent?.trim();
          if (text && text.length >= 10) {
            results.push({
              element,
              selector: `${selector}:nth-child(${index + 1})`,
              confidence: this.calculateDescriptionConfidence(text, element)
            });
          }
        });
      } catch (error) {
        console.warn(`DescriptionDetector selector failed: ${selector}`, error);
      }
    }
    
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private calculateDescriptionConfidence(text: string, element: Element): number {
    let confidence = 0.4; // base confidence
    
    // Prefer longer, more descriptive text
    if (text.length > 50) confidence += 0.1;
    if (text.length > 100) confidence += 0.1;
    if (text.length > 200) confidence += 0.1;
    
    // Boost for description-like classes
    const className = element.className?.toLowerCase() || '';
    if (className.includes('description')) confidence += 0.3;
    if (className.includes('summary')) confidence += 0.25;
    if (className.includes('content')) confidence += 0.2;
    if (className.includes('detail')) confidence += 0.15;
    
    // Boost for paragraph tags
    if (element.tagName.toLowerCase() === 'p') confidence += 0.15;
    
    return Math.min(confidence, 1.0);
  }

  getSelectors(): string[] {
    return this.selectors;
  }
}

export class LinkDetector extends Detector {
  constructor(private selectors: string[]) {
    super();
  }

  async detect(dom: Document): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];
    
    for (const selector of this.selectors) {
      try {
        const elements = dom.querySelectorAll(selector);
        elements.forEach((element, index) => {
          const href = element.getAttribute('href');
          if (href && this.isValidUrl(href)) {
            results.push({
              element,
              selector: `${selector}:nth-child(${index + 1})`,
              confidence: this.calculateLinkConfidence(href, element)
            });
          }
        });
      } catch (error) {
        console.warn(`LinkDetector selector failed: ${selector}`, error);
      }
    }
    
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url, 'https://example.com'); // Allow relative URLs
      return true;
    } catch {
      return false;
    }
  }

  private calculateLinkConfidence(href: string, element: Element): number {
    let confidence = 0.6; // base confidence for valid links
    
    // Boost for absolute URLs
    if (href.startsWith('http')) confidence += 0.2;
    
    // Boost for meaningful URLs (not just fragments)
    if (href.length > 10 && !href.startsWith('#')) confidence += 0.1;
    
    // Boost for link text that suggests it's a main link
    const text = element.textContent?.toLowerCase() || '';
    if (text.includes('more') || text.includes('read') || text.includes('visit')) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  getSelectors(): string[] {
    return this.selectors;
  }
}

export class GenericDetector extends Detector {
  constructor(private domAnchors: string[]) {
    super();
  }

  async detect(dom: Document): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];
    
    for (const anchor of this.domAnchors) {
      try {
        // Assume anchor is a CSS selector
        const elements = dom.querySelectorAll(anchor);
        elements.forEach((element, index) => {
          if (element.textContent?.trim()) {
            results.push({
              element,
              selector: `${anchor}:nth-child(${index + 1})`,
              confidence: 0.7 // Generic confidence
            });
          }
        });
      } catch (error) {
        console.warn(`GenericDetector anchor failed: ${anchor}`, error);
      }
    }
    
    return results;
  }

  getSelectors(): string[] {
    return this.domAnchors;
  }
}

// ===== EXTRACTOR SYSTEM =====

export abstract class Extractor {
  abstract extract(element: Element): Promise<any>;
}

export class TextExtractor extends Extractor {
  async extract(element: Element): Promise<string> {
    return element.textContent?.trim() || '';
  }
}

export class RichTextExtractor extends Extractor {
  async extract(element: Element): Promise<string> {
    // Extract rich text with basic formatting preserved
    const text = element.innerHTML || element.textContent || '';
    return text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
               .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
               .trim();
  }
}

export class URLExtractor extends Extractor {
  async extract(element: Element): Promise<string> {
    // Extract URL from href attribute
    const href = element.getAttribute('href');
    if (href) {
      // Convert relative URLs to absolute if needed
      try {
        const url = new URL(href, window.location?.href || 'https://example.com');
        return url.toString();
      } catch {
        return href; // Return as-is if conversion fails
      }
    }
    
    // Fallback: look for URLs in text content
    const text = element.textContent || '';
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    return urlMatch ? urlMatch[1] : '';
  }
}

export class GenericExtractor extends Extractor {
  async extract(element: Element): Promise<string> {
    return element.textContent?.trim() || '';
  }
}

// ===== VALIDATOR SYSTEM =====

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export abstract class Validator {
  abstract validate(value: any): ValidationResult;
}

export class MinLengthValidator extends Validator {
  constructor(private minLength: number) {
    super();
  }

  validate(value: any): ValidationResult {
    const str = String(value || '');
    const valid = str.length >= this.minLength;
    return {
      valid,
      message: valid ? undefined : `Value must be at least ${this.minLength} characters long`
    };
  }
}

export class MaxLengthValidator extends Validator {
  constructor(private maxLength: number) {
    super();
  }

  validate(value: any): ValidationResult {
    const str = String(value || '');
    const valid = str.length <= this.maxLength;
    return {
      valid,
      message: valid ? undefined : `Value must be at most ${this.maxLength} characters long`
    };
  }
}

export class URLFormatValidator extends Validator {
  validate(value: any): ValidationResult {
    const str = String(value || '');
    if (!str) return { valid: false, message: 'URL cannot be empty' };
    
    try {
      new URL(str);
      return { valid: true };
    } catch {
      // Try with protocol prefix
      try {
        new URL(`https://${str}`);
        return { valid: true };
      } catch {
        return { valid: false, message: 'Invalid URL format' };
      }
    }
  }
}

// ===== CONTRACT GENERATION =====

export interface ContractGenerationOptions {
  model?: string;
  reasoning_effort?: string;
  verbosity?: string;
  response_format?: any;
  max_tokens?: number;
  abstain_on_insufficient_evidence?: boolean;
}

/**
 * Generate Schema Contract using GPT-5 with the exact prompt structure from the plan
 */
export async function generateSchemaContract(
  userQuery: string, 
  pageContent: string,
  options: ContractGenerationOptions = {}
): Promise<SchemaContract> {
  
  // Use a mock OpenAI call since we don't have access to GPT-5 in this environment
  // In production, this would call the actual OpenAI API
  const contractSpec = await callGPT5Mock({
    model: options.model || 'gpt-5-mini',
    reasoning_effort: options.reasoning_effort || 'high',
    verbosity: options.verbosity || 'high',
    messages: [{
      role: 'system',
      content: `You are a schema architect. Create a schema contract with three field types:

REQUIRED: Must exist or extraction fails (core entity identifiers)
EXPECTED: Usually present, extract if found (common attributes) 
DISCOVERABLE: Open slots for custom fields found on this specific site

Be conservative with required fields. Be generous with expected fields.
Focus on what's actually detectable from DOM structure and content patterns.`
    }, {
      role: 'user',
      content: `Query: "${userQuery}"
Page content sample: ${pageContent.substring(0, 2000)}...

Generate a schema contract for this extraction request.`
    }],
    response_format: {
      type: 'json_schema',
      json_schema: {
        schema: {
          type: 'object',
          properties: {
            entity: { type: 'string' },
            required_fields: {
              type: 'array',
              items: {
                type: 'object', 
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  detectors: { type: 'array', items: { type: 'string' } },
                  reasoning: { type: 'string' }
                }
              }
            },
            expected_fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  detectors: { type: 'array', items: { type: 'string' } },
                  reasoning: { type: 'string' }
                }
              }
            },
            governance: {
              type: 'object',
              properties: {
                allowNewFields: { type: 'boolean' },
                min_support_threshold: { type: 'integer' }
              }
            }
          }
        }
      }
    },
    ...options
  });

  return buildSchemaContract(contractSpec);
}

// Mock GPT-5 call for demonstration purposes
async function callGPT5Mock(params: any): Promise<any> {
  // This is a mock implementation that returns a reasonable contract
  // In production, this would call the actual OpenAI API
  
  const userQuery = params.messages[1].content.split('Query: "')[1]?.split('"')[0] || '';
  
  // Analyze query to determine entity type and fields
  const queryLower = userQuery.toLowerCase();
  let entity = 'generic_item';
  let requiredFields = [];
  let expectedFields = [];
  
  if (queryLower.includes('department') || queryLower.includes('organizational')) {
    entity = 'organizational_unit';
    requiredFields = [
      { name: 'name', type: 'string', detectors: ['h1', 'h2', 'h3', '.title', '.department-name'], reasoning: 'Department name is essential identifier' }
    ];
    expectedFields = [
      { name: 'description', type: 'richtext', detectors: ['.description', '.summary', 'p'], reasoning: 'Descriptions commonly found on department pages' },
      { name: 'url', type: 'url', detectors: ['a[href]'], reasoning: 'Department pages often have links to more info' }
    ];
  } else if (queryLower.includes('people') || queryLower.includes('person') || queryLower.includes('staff') || queryLower.includes('faculty')) {
    entity = 'person';
    requiredFields = [
      { name: 'name', type: 'string', detectors: ['h1', 'h2', 'h3', '.name', '.person-name'], reasoning: 'Name is essential for person identification' }
    ];
    expectedFields = [
      { name: 'title', type: 'string', detectors: ['.title', '.position', '.role'], reasoning: 'Job titles commonly displayed' },
      { name: 'email', type: 'email', detectors: ['a[href^="mailto:"]', '.email'], reasoning: 'Contact information often available' },
      { name: 'department', type: 'string', detectors: ['.department', '.affiliation'], reasoning: 'Departmental affiliation commonly shown' }
    ];
  } else if (queryLower.includes('product') || queryLower.includes('item')) {
    entity = 'product';
    requiredFields = [
      { name: 'name', type: 'string', detectors: ['h1', '.product-name', '.title'], reasoning: 'Product name is essential' }
    ];
    expectedFields = [
      { name: 'price', type: 'string', detectors: ['.price', '.cost', '.amount'], reasoning: 'Price commonly displayed for products' },
      { name: 'description', type: 'richtext', detectors: ['.description', '.summary'], reasoning: 'Product descriptions are standard' }
    ];
  } else {
    // Generic extraction
    requiredFields = [
      { name: 'title', type: 'string', detectors: ['h1', 'h2', 'h3', '.title'], reasoning: 'Title serves as primary identifier' }
    ];
    expectedFields = [
      { name: 'content', type: 'richtext', detectors: ['p', '.content', '.description'], reasoning: 'Content is commonly available' },
      { name: 'url', type: 'url', detectors: ['a[href]'], reasoning: 'Links often present for more information' }
    ];
  }
  
  return {
    entity,
    required_fields: requiredFields,
    expected_fields: expectedFields,
    governance: {
      allowNewFields: true,
      min_support_threshold: 3
    }
  };
}

/**
 * Build SchemaContract from the GPT-5 response specification
 */
export function buildSchemaContract(contractSpec: any): SchemaContract {
  const fields: FieldSpec[] = [];
  
  // Process required fields
  for (const field of contractSpec.required_fields || []) {
    fields.push({
      name: field.name,
      kind: 'required',
      type: field.type as FieldType,
      detector: createDetector(field.name, field.detectors || []),
      extractor: createExtractor(field.type),
      validators: createValidators(field.type),
      min_support: 1
    });
  }
  
  // Process expected fields
  for (const field of contractSpec.expected_fields || []) {
    fields.push({
      name: field.name,
      kind: 'expected',
      type: field.type as FieldType,
      detector: createDetector(field.name, field.detectors || []),
      extractor: createExtractor(field.type),
      validators: createValidators(field.type),
      min_support: 2
    });
  }
  
  return {
    entity: contractSpec.entity || 'generic_item',
    fields,
    governance: {
      allowNewFields: contractSpec.governance?.allowNewFields ?? true,
      newFieldPolicy: 'evidence_first',
      min_support_threshold: contractSpec.governance?.min_support_threshold || 3,
      max_discoverable_fields: 5
    }
  };
}

// Helper functions for building detectors, extractors, and validators
function createDetector(fieldName: string, selectors: string[]): Detector {
  const name = fieldName.toLowerCase();
  
  if (name.includes('name') || name.includes('title')) {
    return new TitleDetector(selectors.length > 0 ? selectors : ['h1', 'h2', 'h3', '.title', '.name']);
  } else if (name.includes('description') || name.includes('content') || name.includes('summary')) {
    return new DescriptionDetector(selectors.length > 0 ? selectors : ['.description', '.summary', 'p', '.content']);
  } else if (name.includes('url') || name.includes('link')) {
    return new LinkDetector(selectors.length > 0 ? selectors : ['a[href]']);
  } else {
    return new GenericDetector(selectors.length > 0 ? selectors : [`.${name}`, `[data-${name}]`, `.${name}-value`]);
  }
}

function createExtractor(fieldType: string): Extractor {
  switch (fieldType) {
    case 'url':
      return new URLExtractor();
    case 'richtext':
      return new RichTextExtractor();
    default:
      return new TextExtractor();
  }
}

function createValidators(fieldType: string): Validator[] {
  const validators: Validator[] = [];
  
  switch (fieldType) {
    case 'string':
    case 'richtext':
      validators.push(new MinLengthValidator(1));
      validators.push(new MaxLengthValidator(1000));
      break;
    case 'url':
      validators.push(new URLFormatValidator());
      break;
    case 'email':
      validators.push(new MinLengthValidator(3));
      // Could add EmailFormatValidator here
      break;
  }
  
  return validators;
}

// ===== DEPARTMENT CONTRACT EXAMPLE =====

export const departmentContract: SchemaContract = {
  entity: "organizational_unit",
  fields: [
    {
      name: "name",
      kind: "required",
      type: "string", 
      detector: new TitleDetector(["h1", "h2", "h3", ".title", ".department-name"]),
      extractor: new TextExtractor(),
      validators: [new MinLengthValidator(2), new MaxLengthValidator(100)]
    },
    {
      name: "description", 
      kind: "expected",
      type: "richtext",
      detector: new DescriptionDetector([".description", ".summary", "p"]),
      extractor: new RichTextExtractor(),
      validators: [new MinLengthValidator(10)]
    },
    {
      name: "url",
      kind: "expected", 
      type: "url",
      detector: new LinkDetector(["a[href]"]),
      extractor: new URLExtractor(),
      validators: [new URLFormatValidator()]
    }
  ],
  governance: {
    allowNewFields: true,
    newFieldPolicy: "evidence_first",
    min_support_threshold: 3,
    max_discoverable_fields: 5
  }
};

// Export all the main classes and functions
export {
  generateSchemaContract,
  buildSchemaContract,
  departmentContract
};