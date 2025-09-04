/**
 * Test suite for Adaptive Display Generation System
 */

import { AdaptiveDisplayGenerator, DisplaySpec, DisplayUtils } from './adaptive-display';
import { FieldSpec } from './schema-contracts';

// Mock data for testing
const mockPersonSchema: FieldSpec[] = [
  {
    name: 'name',
    kind: 'required',
    type: 'string',
    detector: {} as any,
    extractor: {} as any,
    validators: []
  },
  {
    name: 'email',
    kind: 'expected',
    type: 'email',
    detector: {} as any,
    extractor: {} as any,
    validators: []
  },
  {
    name: 'research_area',
    kind: 'expected',
    type: 'string',
    detector: {} as any,
    extractor: {} as any,
    validators: []
  }
];

const mockDepartmentSchema: FieldSpec[] = [
  {
    name: 'name',
    kind: 'required',
    type: 'string',
    detector: {} as any,
    extractor: {} as any,
    validators: []
  },
  {
    name: 'faculty_count',
    kind: 'expected',
    type: 'string',
    detector: {} as any,
    extractor: {} as any,
    validators: []
  }
];

const mockPersonData = [
  { name: 'Dr. Alice Smith', email: 'alice@university.edu', research_area: 'Quantum Computing' },
  { name: 'Prof. Bob Johnson', email: 'bob@university.edu', research_area: 'Machine Learning' },
  { name: 'Dr. Carol Wang', email: 'carol@university.edu', research_area: 'Robotics' }
];

const mockDepartmentData = [
  { name: 'Computer Science', faculty_count: '25' },
  { name: 'Electrical Engineering', faculty_count: '18' },
  { name: 'Mechanical Engineering', faculty_count: '22' }
];

describe('AdaptiveDisplayGenerator', () => {
  let generator: AdaptiveDisplayGenerator;

  beforeEach(() => {
    generator = new AdaptiveDisplayGenerator();
  });

  describe('Entity Type Inference', () => {
    test('should correctly identify person entities', () => {
      const result = generator.inferEntityType(mockPersonSchema);
      
      expect(result.type).toBe('person');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.indicators).toContain('email');
    });

    test('should correctly identify organization entities', () => {
      const result = generator.inferEntityType(mockDepartmentSchema);
      
      expect(result.type).toBe('organization');
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    test('should default to generic for unrecognizable patterns', () => {
      const genericSchema: FieldSpec[] = [
        {
          name: 'unknown_field',
          kind: 'required',
          type: 'string',
          detector: {} as any,
          extractor: {} as any,
          validators: []
        }
      ];
      
      const result = generator.inferEntityType(genericSchema);
      expect(result.type).toBe('generic');
    });
  });

  describe('Data Characteristics Analysis', () => {
    test('should analyze data characteristics correctly', () => {
      const result = generator.analyzeDataCharacteristics(mockPersonData);
      
      expect(result.entity_count).toBe(3);
      expect(result.field_count).toBe(3);
      expect(result.uniform_structure).toBe(true);
      expect(result.missing_data_rate).toBe(0);
    });

    test('should handle empty data', () => {
      const result = generator.analyzeDataCharacteristics([]);
      
      expect(result.entity_count).toBe(0);
      expect(result.field_count).toBe(0);
      expect(result.uniform_structure).toBe(true);
    });

    test('should detect long text content', () => {
      const longTextData = [
        { name: 'Test', description: 'A'.repeat(300) }
      ];
      
      const result = generator.analyzeDataCharacteristics(longTextData);
      expect(result.has_long_text).toBe(true);
    });

    test('should detect URLs', () => {
      const urlData = [
        { name: 'Test', url: 'https://example.com' }
      ];
      
      const result = generator.analyzeDataCharacteristics(urlData);
      expect(result.has_urls).toBe(true);
    });
  });

  describe('Standard Field Detection', () => {
    test('should identify standard fields', () => {
      expect(generator.isStandardField('name')).toBe(true);
      expect(generator.isStandardField('email')).toBe(true);
      expect(generator.isStandardField('description')).toBe(true);
      expect(generator.isStandardField('url')).toBe(true);
    });

    test('should identify custom fields', () => {
      expect(generator.isStandardField('research_area')).toBe(false);
      expect(generator.isStandardField('faculty_count')).toBe(false);
      expect(generator.isStandardField('custom_metric')).toBe(false);
    });
  });

  describe('Display Validation', () => {
    test('should validate display binding against schema', () => {
      const mockDisplaySpec = {
        displayType: 'card_grid',
        priorityFields: ['name', 'email', 'nonexistent_field'],
        secondaryFields: ['research_area', 'another_missing_field'],
        layout: { type: 'horizontal_grid', spacing: 'comfortable' },
        styling: { emphasize_custom_fields: true, show_field_types: false, highlight_required: true },
        interactions: { sortable: true, filterable: true, searchable: true, expandable: false },
        customization: { 
          field_labels: { nonexistent_field: 'Should be removed' }, 
          field_icons: { research_area: 'search' },
          color_scheme: 'professional'
        },
        reasoning: 'Test reasoning'
      } as any;

      const validatedSpec = generator.validateDisplayBinding(mockDisplaySpec, mockPersonSchema);
      
      // Should remove nonexistent fields
      expect(validatedSpec.priorityFields).not.toContain('nonexistent_field');
      expect(validatedSpec.secondaryFields).not.toContain('another_missing_field');
      
      // Should keep valid fields
      expect(validatedSpec.priorityFields).toContain('name');
      expect(validatedSpec.priorityFields).toContain('email');
      expect(validatedSpec.secondaryFields).toContain('research_area');
      
      // Should clean field customization
      expect(validatedSpec.customization.field_labels).not.toHaveProperty('nonexistent_field');
      expect(validatedSpec.customization.field_icons).toHaveProperty('research_area');
    });

    test('should ensure at least one priority field exists', () => {
      const mockDisplaySpec = {
        displayType: 'clean_list',
        priorityFields: [],
        secondaryFields: [],
        layout: { type: 'vertical_list', spacing: 'comfortable' },
        styling: { emphasize_custom_fields: false, show_field_types: false, highlight_required: false },
        interactions: { sortable: false, filterable: false, searchable: false, expandable: false },
        customization: { field_labels: {}, field_icons: {}, color_scheme: 'default' },
        reasoning: 'Test'
      } as any;

      const validatedSpec = generator.validateDisplayBinding(mockDisplaySpec, mockPersonSchema);
      
      // Should fallback to first available field
      expect(validatedSpec.priorityFields).toHaveLength(1);
      expect(validatedSpec.priorityFields[0]).toBe('name');
    });
  });

  describe('Display Generation from Schema', () => {
    test('should generate appropriate display for person entities', async () => {
      const displaySpec = await generator.generateFromSchema(
        mockPersonSchema,
        mockPersonData,
        'Extract faculty members with their research areas'
      );

      expect(displaySpec).toBeDefined();
      expect(displaySpec.priorityFields).toContain('name');
      expect(displaySpec.styling.emphasize_custom_fields).toBe(true); // research_area is custom
      expect(displaySpec.reasoning).toBeTruthy();
    });

    test('should generate appropriate display for department entities', async () => {
      const displaySpec = await generator.generateFromSchema(
        mockDepartmentSchema,
        mockDepartmentData,
        'Extract department names with faculty counts'
      );

      expect(displaySpec).toBeDefined();
      expect(displaySpec.priorityFields).toContain('name');
      expect(displaySpec.styling.emphasize_custom_fields).toBe(true); // faculty_count is custom
      expect(displaySpec.reasoning).toBeTruthy();
    });
  });

  describe('Standard Display Templates', () => {
    test('should generate person template', () => {
      const template = generator.generateStandardDisplay('person', ['name', 'email', 'research_area']);
      
      expect(template.displayType).toBe('card_grid');
      expect(template.customization?.color_scheme).toBe('professional');
      expect(template.styling?.card_style).toBe('elevated');
    });

    test('should generate organization template', () => {
      const template = generator.generateStandardDisplay('organization', ['name', 'faculty_count']);
      
      expect(template.displayType).toBe('compact_table');
      expect(template.customization?.color_scheme).toBe('modern');
    });

    test('should generate document template', () => {
      const template = generator.generateStandardDisplay('document', ['title', 'author', 'date']);
      
      expect(template.displayType).toBe('detailed_table');
      expect(template.customization?.color_scheme).toBe('academic');
      expect(template.interactions?.expandable).toBe(true);
    });
  });
});

describe('DisplayUtils', () => {
  test('should calculate optimal columns correctly', () => {
    expect(DisplayUtils.calculateOptimalColumns(2, 9)).toBe(3); // sqrt(9) = 3, min with 4
    expect(DisplayUtils.calculateOptimalColumns(5, 16)).toBe(2); // fieldCount > 4, min with sqrt(16/3)
  });

  test('should determine table layout appropriately', () => {
    expect(DisplayUtils.shouldUseTableLayout(6, 10, false)).toBe(true); // fieldCount > 5
    expect(DisplayUtils.shouldUseTableLayout(3, 60, false)).toBe(true); // entityCount > 50
    expect(DisplayUtils.shouldUseTableLayout(3, 10, true)).toBe(true); // hasLongText
    expect(DisplayUtils.shouldUseTableLayout(3, 10, false)).toBe(false); // none of the conditions
  });

  test('should generate responsive breakpoints', () => {
    const config = DisplayUtils.generateResponsiveConfig(4);
    
    expect(config.mobile).toBe(1);
    expect(config.tablet).toBe(2);
    expect(config.desktop).toBe(4);
    expect(config.widescreen).toBe(5);
  });

  test('should cap responsive breakpoints correctly', () => {
    const config = DisplayUtils.generateResponsiveConfig(10);
    expect(config.widescreen).toBe(6); // Should cap at 6
  });
});