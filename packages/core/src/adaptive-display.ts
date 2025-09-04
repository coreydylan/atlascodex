/**
 * Adaptive Display Generation System
 * From Evidence-First Adaptive Extraction Plan
 * 
 * Creates display specifications from negotiated schemas that ensure
 * no phantom fields and optimal UX for different entity types.
 */

import { FieldSpec } from './schema-contracts';

// Core display specification interfaces
export interface DisplaySpec {
  displayType: 'clean_list' | 'card_grid' | 'detailed_table' | 'compact_table' | 'dashboard';
  priorityFields: string[];
  secondaryFields: string[];
  layout: {
    type: 'vertical_list' | 'horizontal_grid' | 'table' | 'dashboard_tiles';
    spacing: 'compact' | 'comfortable' | 'spacious';
    columns?: number;
    responsive?: boolean;
  };
  styling: {
    emphasize_custom_fields: boolean;
    show_field_types: boolean;
    highlight_required: boolean;
    card_style?: 'minimal' | 'elevated' | 'bordered';
  };
  interactions: {
    sortable: boolean;
    filterable: boolean;
    searchable: boolean;
    expandable: boolean;
  };
  customization: {
    field_labels: Record<string, string>;
    field_icons: Record<string, string>;
    color_scheme: 'default' | 'professional' | 'modern' | 'academic';
  };
  reasoning: string;
}

export interface DataCharacteristics {
  entity_count: number;
  field_count: number;
  has_long_text: boolean;
  has_urls: boolean;
  has_rich_content: boolean;
  uniform_structure: boolean;
  missing_data_rate: number;
}

export interface EntityTypeClassification {
  type: 'person' | 'organization' | 'product' | 'document' | 'event' | 'location' | 'generic';
  confidence: number;
  indicators: string[];
}

// GPT-5 structured JSON schema for display generation
export const displaySpecSchema = {
  type: 'object',
  properties: {
    displayType: {
      type: 'string',
      enum: ['clean_list', 'card_grid', 'detailed_table', 'compact_table', 'dashboard']
    },
    priorityFields: {
      type: 'array',
      items: { type: 'string' },
      description: 'Fields to display prominently (must exist in schema)'
    },
    secondaryFields: {
      type: 'array', 
      items: { type: 'string' },
      description: 'Additional fields to show in secondary position'
    },
    layout: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['vertical_list', 'horizontal_grid', 'table', 'dashboard_tiles']
        },
        spacing: {
          type: 'string',
          enum: ['compact', 'comfortable', 'spacious']
        },
        columns: { type: 'integer', minimum: 1, maximum: 6 },
        responsive: { type: 'boolean' }
      },
      required: ['type', 'spacing']
    },
    styling: {
      type: 'object',
      properties: {
        emphasize_custom_fields: { type: 'boolean' },
        show_field_types: { type: 'boolean' },
        highlight_required: { type: 'boolean' },
        card_style: {
          type: 'string',
          enum: ['minimal', 'elevated', 'bordered']
        }
      },
      required: ['emphasize_custom_fields', 'show_field_types', 'highlight_required']
    },
    interactions: {
      type: 'object', 
      properties: {
        sortable: { type: 'boolean' },
        filterable: { type: 'boolean' },
        searchable: { type: 'boolean' },
        expandable: { type: 'boolean' }
      },
      required: ['sortable', 'filterable', 'searchable', 'expandable']
    },
    customization: {
      type: 'object',
      properties: {
        field_labels: {
          type: 'object',
          additionalProperties: { type: 'string' }
        },
        field_icons: {
          type: 'object', 
          additionalProperties: { type: 'string' }
        },
        color_scheme: {
          type: 'string',
          enum: ['default', 'professional', 'modern', 'academic']
        }
      },
      required: ['field_labels', 'field_icons', 'color_scheme']
    },
    reasoning: {
      type: 'string',
      description: 'Explanation for why this display configuration was chosen'
    }
  },
  required: ['displayType', 'priorityFields', 'secondaryFields', 'layout', 'styling', 'interactions', 'customization', 'reasoning'],
  additionalProperties: false
};

/**
 * Adaptive Display Generator
 * 
 * Generates optimal display specifications from negotiated schemas, ensuring:
 * 1. No phantom fields - only references fields that exist in final schema
 * 2. Entity-appropriate layouts and interactions
 * 3. Custom field highlighting for discoverable fields
 * 4. Schema-driven layout decisions
 */
export class AdaptiveDisplayGenerator {
  
  /**
   * Generate display specification from negotiated schema
   */
  async generateFromSchema(
    finalSchema: FieldSpec[],
    extractedData: any[],
    originalQuery: string
  ): Promise<DisplaySpec> {
    
    // Analyze the schema and data
    const schemaAnalysis = {
      entity_type: this.inferEntityType(finalSchema),
      field_count: finalSchema.length,
      required_fields: finalSchema.filter(f => f.kind === 'required').map(f => f.name),
      optional_fields: finalSchema.filter(f => f.kind !== 'required').map(f => f.name),
      data_characteristics: this.analyzeDataCharacteristics(extractedData),
      custom_fields: finalSchema.filter(f => f.kind === 'expected' && 
        !this.isStandardField(f.name)).map(f => f.name)
    };

    // Use GPT-5 for intelligent display generation
    const response = await this.callGPT5ForDisplay(originalQuery, schemaAnalysis, extractedData);
    
    // Validate and clean the display specification
    return this.validateDisplayBinding(response, finalSchema);
  }

  /**
   * Infer entity type from field patterns and names
   */
  inferEntityType(schema: FieldSpec[]): EntityTypeClassification {
    const fieldNames = schema.map(f => f.name.toLowerCase());
    const indicators: string[] = [];
    
    // Person indicators
    const personFields = ['name', 'first_name', 'last_name', 'email', 'title', 'position', 'phone', 'bio', 'biography'];
    const personMatches = fieldNames.filter(f => personFields.some(p => f.includes(p))).length;
    
    // Organization indicators  
    const orgFields = ['department', 'organization', 'company', 'institution', 'division', 'faculty', 'school'];
    const orgMatches = fieldNames.filter(f => orgFields.some(o => f.includes(o))).length;
    
    // Product indicators
    const productFields = ['product', 'item', 'model', 'price', 'category', 'brand', 'sku', 'inventory'];
    const productMatches = fieldNames.filter(f => productFields.some(p => f.includes(p))).length;
    
    // Document indicators
    const docFields = ['title', 'author', 'date', 'content', 'summary', 'abstract', 'publication', 'journal'];
    const docMatches = fieldNames.filter(f => docFields.some(d => f.includes(d))).length;
    
    // Event indicators
    const eventFields = ['event', 'date', 'time', 'location', 'venue', 'schedule', 'registration'];
    const eventMatches = fieldNames.filter(f => eventFields.some(e => f.includes(e))).length;
    
    // Location indicators
    const locationFields = ['location', 'address', 'city', 'state', 'country', 'coordinates', 'zip', 'postal'];
    const locationMatches = fieldNames.filter(f => locationFields.some(l => f.includes(l))).length;

    // Determine best match
    const matches = [
      { type: 'person' as const, score: personMatches, indicators: fieldNames.filter(f => personFields.some(p => f.includes(p))) },
      { type: 'organization' as const, score: orgMatches, indicators: fieldNames.filter(f => orgFields.some(o => f.includes(o))) },
      { type: 'product' as const, score: productMatches, indicators: fieldNames.filter(f => productFields.some(p => f.includes(p))) },
      { type: 'document' as const, score: docMatches, indicators: fieldNames.filter(f => docFields.some(d => f.includes(d))) },
      { type: 'event' as const, score: eventMatches, indicators: fieldNames.filter(f => eventFields.some(e => f.includes(e))) },
      { type: 'location' as const, score: locationMatches, indicators: fieldNames.filter(f => locationFields.some(l => f.includes(l))) },
    ];

    const bestMatch = matches.reduce((a, b) => a.score > b.score ? a : b);
    
    return {
      type: bestMatch.score > 0 ? bestMatch.type : 'generic',
      confidence: Math.min(bestMatch.score / schema.length, 1.0),
      indicators: bestMatch.indicators
    };
  }

  /**
   * Analyze data characteristics for layout decisions
   */
  analyzeDataCharacteristics(data: any[]): DataCharacteristics {
    if (!data || data.length === 0) {
      return {
        entity_count: 0,
        field_count: 0,
        has_long_text: false,
        has_urls: false,
        has_rich_content: false,
        uniform_structure: true,
        missing_data_rate: 0
      };
    }

    const sample = data.slice(0, 10); // Analyze sample for performance
    const allFields = new Set<string>();
    let totalFieldCount = 0;
    let missingFieldCount = 0;
    let longTextCount = 0;
    let urlCount = 0;
    let richContentCount = 0;

    sample.forEach(item => {
      Object.keys(item).forEach(key => {
        allFields.add(key);
        totalFieldCount++;
        
        const value = item[key];
        
        // Check for missing/empty values
        if (value === null || value === undefined || value === '') {
          missingFieldCount++;
        }
        
        // Check for long text (>200 chars)
        if (typeof value === 'string' && value.length > 200) {
          longTextCount++;
        }
        
        // Check for URLs
        if (typeof value === 'string' && (value.startsWith('http') || value.includes('www.'))) {
          urlCount++;
        }
        
        // Check for rich content (HTML tags, markdown)
        if (typeof value === 'string' && (value.includes('<') || value.includes('[') || value.includes('**'))) {
          richContentCount++;
        }
      });
    });

    // Check structure uniformity
    const fieldCounts = sample.map(item => Object.keys(item).length);
    const uniformStructure = fieldCounts.every(count => count === fieldCounts[0]);

    return {
      entity_count: data.length,
      field_count: allFields.size,
      has_long_text: longTextCount > 0,
      has_urls: urlCount > 0,
      has_rich_content: richContentCount > 0,
      uniform_structure: uniformStructure,
      missing_data_rate: totalFieldCount > 0 ? missingFieldCount / totalFieldCount : 0
    };
  }

  /**
   * Check if a field name represents a standard/common field
   */
  isStandardField(fieldName: string): boolean {
    const standardFields = [
      'name', 'title', 'description', 'url', 'link', 'id', 'email', 'phone', 
      'address', 'location', 'date', 'time', 'price', 'category', 'type',
      'author', 'content', 'summary', 'tags', 'status', 'created', 'updated'
    ];
    
    const lowerFieldName = fieldName.toLowerCase();
    return standardFields.some(standard => 
      lowerFieldName.includes(standard) || standard.includes(lowerFieldName)
    );
  }

  /**
   * Call GPT-5 for intelligent display generation
   */
  private async callGPT5ForDisplay(
    originalQuery: string,
    schemaAnalysis: any,
    extractedData: any[]
  ): Promise<any> {
    
    // Mock GPT-5 call for now - in production, replace with actual OpenAI API call
    return this.generateMockDisplaySpec(originalQuery, schemaAnalysis, extractedData);
  }

  /**
   * Generate a mock display spec based on analysis (placeholder for GPT-5 integration)
   */
  private generateMockDisplaySpec(
    originalQuery: string,
    schemaAnalysis: any,
    extractedData: any[]
  ): any {
    const entityType = schemaAnalysis.entity_type;
    const fieldCount = schemaAnalysis.field_count;
    const customFields = schemaAnalysis.custom_fields || [];
    const dataChars = schemaAnalysis.data_characteristics;

    // Determine display type based on field count and data characteristics
    let displayType: string;
    if (fieldCount <= 2 && !dataChars.has_long_text) {
      displayType = 'clean_list';
    } else if (fieldCount <= 4 && entityType.type === 'person') {
      displayType = 'card_grid';
    } else if (fieldCount > 6 || dataChars.has_rich_content) {
      displayType = 'detailed_table';
    } else {
      displayType = 'compact_table';
    }

    // Determine priority fields (required fields first, then most informative)
    const priorityFields = schemaAnalysis.required_fields.slice(0, 2);
    const remainingFields = schemaAnalysis.optional_fields.filter((f: string) => !priorityFields.includes(f));
    
    // Add custom fields to secondary if they exist
    const secondaryFields = [...remainingFields.slice(0, 3), ...customFields.slice(0, 2)];

    // Layout decisions based on entity type and data characteristics
    const layout = {
      type: displayType === 'card_grid' ? 'horizontal_grid' : 
            displayType === 'clean_list' ? 'vertical_list' : 'table',
      spacing: dataChars.entity_count > 20 ? 'compact' : 'comfortable',
      columns: displayType === 'card_grid' ? Math.min(3, Math.ceil(Math.sqrt(dataChars.entity_count))) : undefined,
      responsive: true
    };

    // Styling based on content type
    const styling = {
      emphasize_custom_fields: customFields.length > 0,
      show_field_types: fieldCount > 5 || entityType.type === 'generic',
      highlight_required: schemaAnalysis.required_fields.length > 1,
      card_style: entityType.type === 'person' ? 'elevated' : 'minimal'
    };

    // Interactions based on data volume and structure
    const interactions = {
      sortable: dataChars.entity_count > 5 && dataChars.uniform_structure,
      filterable: fieldCount > 3 && dataChars.entity_count > 10,
      searchable: dataChars.entity_count > 20 || dataChars.has_long_text,
      expandable: dataChars.has_long_text || dataChars.has_rich_content
    };

    // Field customization
    const fieldLabels: Record<string, string> = {};
    const fieldIcons: Record<string, string> = {};
    
    // Generate friendly labels for custom fields
    customFields.forEach((field: string) => {
      fieldLabels[field] = this.generateFriendlyLabel(field);
      fieldIcons[field] = this.generateFieldIcon(field);
    });

    // Standard field icons
    if (priorityFields.includes('name')) fieldIcons['name'] = 'user';
    if (priorityFields.includes('email')) fieldIcons['email'] = 'mail';
    if (priorityFields.includes('title')) fieldIcons['title'] = 'bookmark';

    const colorScheme = entityType.type === 'person' ? 'professional' : 
                       entityType.type === 'organization' ? 'modern' : 
                       entityType.type === 'document' ? 'academic' : 'default';

    const reasoning = this.generateDisplayReasoning(displayType, entityType, customFields, dataChars);

    return {
      displayType,
      priorityFields,
      secondaryFields,
      layout,
      styling,
      interactions,
      customization: {
        field_labels: fieldLabels,
        field_icons: fieldIcons,
        color_scheme: colorScheme
      },
      reasoning
    };
  }

  /**
   * Generate friendly label for field name
   */
  private generateFriendlyLabel(fieldName: string): string {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate appropriate icon for field
   */
  private generateFieldIcon(fieldName: string): string {
    const lowerField = fieldName.toLowerCase();
    
    if (lowerField.includes('count') || lowerField.includes('number')) return 'hash';
    if (lowerField.includes('location') || lowerField.includes('address')) return 'map-pin';
    if (lowerField.includes('date') || lowerField.includes('time')) return 'calendar';
    if (lowerField.includes('url') || lowerField.includes('link')) return 'external-link';
    if (lowerField.includes('phone')) return 'phone';
    if (lowerField.includes('research') || lowerField.includes('area')) return 'search';
    if (lowerField.includes('department') || lowerField.includes('faculty')) return 'building';
    
    return 'info';
  }

  /**
   * Generate reasoning explanation for display choices
   */
  private generateDisplayReasoning(
    displayType: string,
    entityType: EntityTypeClassification,
    customFields: string[],
    dataChars: DataCharacteristics
  ): string {
    let reasoning = `Selected ${displayType} layout for ${entityType.type} entities. `;
    
    if (customFields.length > 0) {
      reasoning += `Highlighting ${customFields.length} custom field(s): ${customFields.join(', ')}. `;
    }
    
    if (dataChars.entity_count > 20) {
      reasoning += 'Using compact spacing for large dataset. ';
    }
    
    if (dataChars.has_long_text) {
      reasoning += 'Enabled expandable rows for long text content. ';
    }
    
    if (!dataChars.uniform_structure) {
      reasoning += 'Adapted for non-uniform data structure with optional field handling.';
    } else {
      reasoning += 'Optimized for consistent data structure.';
    }
    
    return reasoning;
  }

  /**
   * Validate display binding to ensure only available fields are referenced
   * 
   * CRITICAL: This prevents phantom field references in the UI
   */
  validateDisplayBinding(displaySpec: any, schema: FieldSpec[]): DisplaySpec {
    const availableFields = new Set(schema.map(f => f.name));
    
    // Filter out any field references not in final schema
    if (displaySpec.priorityFields) {
      displaySpec.priorityFields = displaySpec.priorityFields.filter((f: string) => availableFields.has(f));
    }
    
    if (displaySpec.secondaryFields) {
      displaySpec.secondaryFields = displaySpec.secondaryFields.filter((f: string) => availableFields.has(f));
    }

    // Clean field labels and icons to only reference available fields
    if (displaySpec.customization) {
      if (displaySpec.customization.field_labels) {
        displaySpec.customization.field_labels = Object.fromEntries(
          Object.entries(displaySpec.customization.field_labels)
            .filter(([field]) => availableFields.has(field))
        );
      }
      
      if (displaySpec.customization.field_icons) {
        displaySpec.customization.field_icons = Object.fromEntries(
          Object.entries(displaySpec.customization.field_icons)
            .filter(([field]) => availableFields.has(field))
        );
      }
    }

    // Ensure we have at least one priority field (fallback to first available)
    if (!displaySpec.priorityFields || displaySpec.priorityFields.length === 0) {
      displaySpec.priorityFields = [schema[0]?.name].filter(Boolean);
    }

    return displaySpec as DisplaySpec;
  }

  /**
   * Generate display specification for common entity types
   */
  generateStandardDisplay(entityType: string, fields: string[]): Partial<DisplaySpec> {
    const templates: Record<string, Partial<DisplaySpec>> = {
      person: {
        displayType: 'card_grid',
        layout: { type: 'horizontal_grid', spacing: 'comfortable', columns: 3, responsive: true },
        styling: { emphasize_custom_fields: true, show_field_types: false, highlight_required: true, card_style: 'elevated' },
        interactions: { sortable: true, filterable: true, searchable: true, expandable: false },
        customization: { field_labels: {}, field_icons: { name: 'user', email: 'mail' }, color_scheme: 'professional' }
      },
      organization: {
        displayType: 'compact_table',
        layout: { type: 'table', spacing: 'comfortable', responsive: true },
        styling: { emphasize_custom_fields: true, show_field_types: false, highlight_required: true },
        interactions: { sortable: true, filterable: true, searchable: true, expandable: false },
        customization: { field_labels: {}, field_icons: { name: 'building' }, color_scheme: 'modern' }
      },
      product: {
        displayType: 'card_grid',
        layout: { type: 'horizontal_grid', spacing: 'comfortable', columns: 2, responsive: true },
        styling: { emphasize_custom_fields: false, show_field_types: true, highlight_required: true, card_style: 'bordered' },
        interactions: { sortable: true, filterable: true, searchable: true, expandable: false },
        customization: { field_labels: {}, field_icons: { price: 'dollar-sign' }, color_scheme: 'default' }
      },
      document: {
        displayType: 'detailed_table',
        layout: { type: 'table', spacing: 'spacious', responsive: true },
        styling: { emphasize_custom_fields: false, show_field_types: true, highlight_required: true },
        interactions: { sortable: true, filterable: true, searchable: true, expandable: true },
        customization: { field_labels: {}, field_icons: { title: 'file-text' }, color_scheme: 'academic' }
      }
    };

    return templates[entityType] || templates.organization;
  }
}

/**
 * Helper functions for display generation
 */

export const DisplayUtils = {
  /**
   * Calculate optimal column count based on field count and screen size
   */
  calculateOptimalColumns(fieldCount: number, entityCount: number): number {
    if (fieldCount <= 2) return Math.min(4, Math.ceil(Math.sqrt(entityCount)));
    if (fieldCount <= 4) return Math.min(3, Math.ceil(Math.sqrt(entityCount / 2)));
    return Math.min(2, Math.ceil(Math.sqrt(entityCount / 3)));
  },

  /**
   * Determine if table layout is better than cards
   */
  shouldUseTableLayout(fieldCount: number, entityCount: number, hasLongText: boolean): boolean {
    return fieldCount > 5 || entityCount > 50 || hasLongText;
  },

  /**
   * Generate responsive breakpoints for grid layouts
   */
  generateResponsiveConfig(columns: number): Record<string, number> {
    return {
      mobile: 1,
      tablet: Math.min(2, columns),
      desktop: columns,
      widescreen: Math.min(columns + 1, 6)
    };
  }
};

export default AdaptiveDisplayGenerator;