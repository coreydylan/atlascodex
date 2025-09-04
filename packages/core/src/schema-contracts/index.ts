/**
 * Schema Contract Generation System
 * Based on EVIDENCE_FIRST_ADAPTIVE_EXTRACTION_PLAN_2025_09_03.md
 */

import { SchemaContract, FieldSpec, ContractGenerationOptions } from '../types';
import { TitleDetector, DescriptionDetector, LinkDetector, GenericDetector } from '../detectors';
import { TextExtractor, RichTextExtractor, URLExtractor, GenericExtractor } from '../extractors';
import { MinLengthValidator, MaxLengthValidator, URLFormatValidator } from '../validators';

export class SchemaContractGenerator {
  /**
   * Generate schema contract from user query and page content
   */
  async generateContract(userQuery: string, pageContent: string, options: ContractGenerationOptions = {}): Promise<SchemaContract> {
    // TODO: Implement GPT-5 contract generation with structured output
    // For now, return a deterministic contract based on query analysis
    
    const entity = this.inferEntityType(userQuery);
    const fields = this.generateFieldSpecs(userQuery, entity);
    
    return {
      entity,
      fields,
      governance: {
        allowNewFields: true,
        newFieldPolicy: "evidence_first",
        min_support_threshold: 3,
        max_discoverable_fields: 5
      }
    };
  }

  /**
   * Infer entity type from user query
   */
  private inferEntityType(userQuery: string): string {
    const query = userQuery.toLowerCase();
    
    if (query.includes('department') || query.includes('division') || query.includes('unit')) {
      return 'organizational_unit';
    }
    if (query.includes('person') || query.includes('people') || query.includes('staff') || query.includes('team')) {
      return 'person';
    }
    if (query.includes('product') || query.includes('item') || query.includes('price')) {
      return 'product';
    }
    if (query.includes('article') || query.includes('news') || query.includes('story')) {
      return 'article';
    }
    if (query.includes('event') || query.includes('calendar') || query.includes('schedule')) {
      return 'event';
    }
    
    return 'generic';
  }

  /**
   * Generate field specifications based on query and entity type
   */
  private generateFieldSpecs(userQuery: string, entity: string): FieldSpec[] {
    const fields: FieldSpec[] = [];
    
    // Always include a name field as required
    fields.push({
      name: 'name',
      kind: 'required',
      type: 'string',
      detector: new TitleDetector(['h1', 'h2', 'h3', '.title', '.name', '.department-name']),
      extractor: new TextExtractor(),
      validators: [new MinLengthValidator(2), new MaxLengthValidator(100)]
    });

    // Add entity-specific fields
    switch (entity) {
      case 'organizational_unit':
        fields.push(
          {
            name: 'description',
            kind: 'expected',
            type: 'richtext',
            detector: new DescriptionDetector(['.description', '.summary', 'p']),
            extractor: new RichTextExtractor(),
            validators: [new MinLengthValidator(10)]
          },
          {
            name: 'url',
            kind: 'expected',
            type: 'url',
            detector: new LinkDetector(['a[href]']),
            extractor: new URLExtractor(),
            validators: [new URLFormatValidator()]
          }
        );
        break;
        
      case 'person':
        fields.push(
          {
            name: 'title',
            kind: 'expected',
            type: 'string',
            detector: new GenericDetector(['.title', '.position', '.role']),
            extractor: new TextExtractor(),
            validators: [new MinLengthValidator(2)]
          },
          {
            name: 'email',
            kind: 'expected',
            type: 'email',
            detector: new GenericDetector(['a[href^="mailto:"]', '.email']),
            extractor: new GenericExtractor(),
            validators: []
          }
        );
        break;
        
      // Add more entity types as needed
    }

    return fields;
  }

  /**
   * Build example department contract (from the plan)
   */
  static buildDepartmentContract(): SchemaContract {
    return {
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
  }
}