/**
 * Adaptive Display Generation System
 * Based on EVIDENCE_FIRST_ADAPTIVE_EXTRACTION_PLAN_2025_09_03.md
 */

import { DisplaySpec, FieldSpec } from '../types';

export class AdaptiveDisplayGenerator {
  
  /**
   * Generate display specification from final negotiated schema
   */
  async generateFromSchema(
    finalSchema: FieldSpec[],
    extractedData: any[],
    originalQuery: string
  ): Promise<DisplaySpec> {
    
    const schemaAnalysis = {
      entity_type: this.inferEntityType(finalSchema),
      field_count: finalSchema.length,
      required_fields: finalSchema.filter(f => f.kind === 'required').map(f => f.name),
      optional_fields: finalSchema.filter(f => f.kind !== 'required').map(f => f.name),
      data_characteristics: this.analyzeDataCharacteristics(extractedData),
      custom_fields: finalSchema.filter(f => f.kind === 'expected' && 
        !this.isStandardField(f.name)).map(f => f.name)
    };

    try {
      // TODO: Implement GPT-5 call for display generation
      const displaySpec = await this.generateDisplayWithGPT5(originalQuery, schemaAnalysis, extractedData);
      
      // Validate display only references available fields
      return this.validateDisplayBinding(displaySpec, finalSchema);
    } catch (error) {
      console.warn('Display generation failed, using fallback:', error);
      return this.generateFallbackDisplay(finalSchema);
    }
  }

  /**
   * Infer entity type from schema fields
   */
  private inferEntityType(schema: FieldSpec[]): string {
    const fieldNames = schema.map(f => f.name.toLowerCase());
    
    if (fieldNames.includes('email') || fieldNames.includes('phone') || fieldNames.includes('title')) {
      return 'person';
    }
    if (fieldNames.includes('price') || fieldNames.includes('cost')) {
      return 'product';
    }
    if (fieldNames.includes('date') || fieldNames.includes('time')) {
      return 'event';
    }
    if (fieldNames.includes('description') && fieldNames.includes('name')) {
      return 'organization';
    }
    
    return 'generic';
  }

  /**
   * Analyze characteristics of extracted data
   */
  private analyzeDataCharacteristics(data: any[]): any {
    if (!data || data.length === 0) {
      return { count: 0, has_images: false, has_links: false };
    }

    const sample = data[0];
    return {
      count: data.length,
      has_images: Object.keys(sample).some(key => key.includes('image') || key.includes('photo')),
      has_links: Object.keys(sample).some(key => key.includes('url') || key.includes('link')),
      field_count: Object.keys(sample).length,
      avg_text_length: this.calculateAverageTextLength(data)
    };
  }

  /**
   * Calculate average text length across data
   */
  private calculateAverageTextLength(data: any[]): number {
    if (data.length === 0) return 0;
    
    const totalLength = data.reduce((total, item) => {
      return total + Object.values(item).reduce((itemTotal: number, value: any) => {
        return itemTotal + (typeof value === 'string' ? value.length : 0);
      }, 0);
    }, 0);
    
    return Math.round(totalLength / data.length);
  }

  /**
   * Check if field is a standard field
   */
  private isStandardField(fieldName: string): boolean {
    const standardFields = [
      'name', 'title', 'description', 'url', 'link', 'email', 'phone',
      'date', 'time', 'price', 'cost', 'category', 'type', 'image'
    ];
    return standardFields.includes(fieldName.toLowerCase());
  }

  /**
   * Generate display specification using GPT-5 (placeholder)
   */
  private async generateDisplayWithGPT5(query: string, analysis: any, data: any[]): Promise<DisplaySpec> {
    // TODO: Implement actual GPT-5 call with response_format: json_schema
    
    // Mock implementation for now
    return this.generateFallbackDisplay(analysis.required_fields.concat(analysis.optional_fields));
  }

  /**
   * Generate fallback display when GPT-5 is unavailable
   */
  private generateFallbackDisplay(fields: FieldSpec[] | string[]): DisplaySpec {
    const fieldNames = Array.isArray(fields) ? 
      (typeof fields[0] === 'string' ? fields as string[] : (fields as FieldSpec[]).map(f => f.name)) :
      [];

    return {
      displayType: "clean_list",
      priorityFields: fieldNames.slice(0, 2), // First 2 fields as priority
      secondaryFields: fieldNames.slice(2), // Rest as secondary
      layout: {
        type: "vertical_list",
        spacing: "comfortable"
      },
      styling: {
        emphasize_custom_fields: true
      },
      reasoning: "Fallback display for reliable rendering"
    };
  }

  /**
   * Validate display only references available fields
   */
  private validateDisplayBinding(displaySpec: DisplaySpec, schema: FieldSpec[]): DisplaySpec {
    const availableFields = new Set(schema.map(f => f.name));
    
    // Remove any field references not in final schema
    if (displaySpec.priorityFields) {
      displaySpec.priorityFields = displaySpec.priorityFields.filter(f => availableFields.has(f));
    }
    if (displaySpec.secondaryFields) {
      displaySpec.secondaryFields = displaySpec.secondaryFields.filter(f => availableFields.has(f));
    }

    return displaySpec;
  }
}