/**
 * Integration test for Adaptive Display Generation with Evidence-First system
 * Demonstrates the complete flow from schema negotiation to display generation
 */

import { AdaptiveDisplayGenerator } from './adaptive-display';
import { FieldSpec } from './schema-contracts';

describe('Adaptive Display Integration', () => {
  let generator: AdaptiveDisplayGenerator;

  beforeEach(() => {
    generator = new AdaptiveDisplayGenerator();
  });

  test('should handle MIT departments example from Evidence-First plan', async () => {
    // Simulated final schema after negotiation (as described in the plan)
    const finalSchema: FieldSpec[] = [
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
        kind: 'expected', // Promoted from discovery
        type: 'string',
        detector: {} as any,
        extractor: {} as any,
        validators: []
      }
    ];

    // Simulated extracted data (as described in the plan)
    const extractedData = [
      { name: "Aeronautics and Astronautics", faculty_count: "25" },
      { name: "Biological Engineering", faculty_count: "18" },
      { name: "Chemical Engineering", faculty_count: "22" },
      { name: "Civil and Environmental Engineering", faculty_count: "28" },
      { name: "Electrical Engineering and Computer Science", faculty_count: "45" },
      { name: "Materials Science and Engineering", faculty_count: "15" },
      { name: "Mechanical Engineering", faculty_count: "32" },
      { name: "Nuclear Science and Engineering", faculty_count: "12" },
      { name: "Institute for Medical Engineering and Science", faculty_count: "20" }
    ];

    const originalQuery = "extract just the names of the different departments at the MIT school of engineering";

    // Generate adaptive display
    const displaySpec = await generator.generateFromSchema(
      finalSchema,
      extractedData,
      originalQuery
    );

    // Verify display specification matches plan expectations
    expect(displaySpec).toBeDefined();
    expect(displaySpec.displayType).toBe('clean_list'); // Expected from plan for simple 2-field data
    expect(displaySpec.priorityFields).toContain('name');
    expect(displaySpec.secondaryFields).toContain('faculty_count');
    expect(displaySpec.styling.emphasize_custom_fields).toBe(true); // faculty_count is custom/discovered
    expect(displaySpec.reasoning).toContain('faculty_count'); // Should mention the custom field
    
    // Verify no phantom fields are referenced
    const allReferencedFields = [
      ...displaySpec.priorityFields,
      ...displaySpec.secondaryFields,
      ...Object.keys(displaySpec.customization.field_labels),
      ...Object.keys(displaySpec.customization.field_icons)
    ];
    
    allReferencedFields.forEach(field => {
      expect(finalSchema.map(f => f.name)).toContain(field);
    });
  });

  test('should handle person directory example with pruned fields', async () => {
    // Schema after negotiation where email was pruned due to zero evidence
    const finalSchema: FieldSpec[] = [
      {
        name: 'name',
        kind: 'required',
        type: 'string',
        detector: {} as any,
        extractor: {} as any,
        validators: []
      },
      {
        name: 'title',
        kind: 'expected',
        type: 'string',
        detector: {} as any,
        extractor: {} as any,
        validators: []
      },
      {
        name: 'research_area', // Custom discovered field
        kind: 'expected',
        type: 'string',
        detector: {} as any,
        extractor: {} as any,
        validators: []
      }
    ];

    const extractedData = [
      { name: 'Dr. Alice Smith', title: 'Professor', research_area: 'Quantum Computing' },
      { name: 'Prof. Bob Johnson', title: 'Associate Professor', research_area: 'Machine Learning' },
      { name: 'Dr. Carol Wang', title: 'Assistant Professor', research_area: 'Robotics' }
    ];

    const displaySpec = await generator.generateFromSchema(
      finalSchema,
      extractedData,
      'extract faculty members with their research areas'
    );

    expect(displaySpec).toBeDefined();
    
    // Should NOT reference email field (was pruned)
    const allReferencedFields = [
      ...displaySpec.priorityFields,
      ...displaySpec.secondaryFields,
      ...Object.keys(displaySpec.customization.field_labels),
      ...Object.keys(displaySpec.customization.field_icons)
    ];
    
    expect(allReferencedFields).not.toContain('email');
    
    // Should emphasize the custom research_area field
    expect(displaySpec.styling.emphasize_custom_fields).toBe(true);
    expect(displaySpec.secondaryFields).toContain('research_area');
  });

  test('should generate appropriate display for different entity types', async () => {
    // Product schema
    const productSchema: FieldSpec[] = [
      {
        name: 'name',
        kind: 'required',
        type: 'string',
        detector: {} as any,
        extractor: {} as any,
        validators: []
      },
      {
        name: 'price',
        kind: 'expected',
        type: 'string',
        detector: {} as any,
        extractor: {} as any,
        validators: []
      }
    ];

    const productData = [
      { name: 'Widget A', price: '$19.99' },
      { name: 'Widget B', price: '$29.99' }
    ];

    const displaySpec = await generator.generateFromSchema(
      productSchema,
      productData,
      'extract products with prices'
    );

    // Should detect product entity and adapt display accordingly
    expect(displaySpec.displayType).toBeTruthy();
    expect(displaySpec.priorityFields).toContain('name');
    expect(displaySpec.reasoning).toBeTruthy();
  });

  test('should handle empty or minimal data gracefully', async () => {
    const minimalSchema: FieldSpec[] = [
      {
        name: 'name',
        kind: 'required',
        type: 'string',
        detector: {} as any,
        extractor: {} as any,
        validators: []
      }
    ];

    const displaySpec = await generator.generateFromSchema(
      minimalSchema,
      [{ name: 'Single Item' }],
      'extract name only'
    );

    expect(displaySpec).toBeDefined();
    expect(displaySpec.priorityFields).toContain('name');
    expect(displaySpec.displayType).toBe('clean_list'); // Should default to simple list for minimal data
  });

  test('should ensure ZERO phantom fields in any scenario', async () => {
    // Test various scenarios to ensure no phantom fields are ever referenced
    const scenarios = [
      {
        schema: [
          { name: 'name', kind: 'required' as const, type: 'string' as const },
          { name: 'custom_field', kind: 'expected' as const, type: 'string' as const }
        ],
        data: [{ name: 'Test', custom_field: 'Value' }],
        query: 'test query'
      },
      {
        schema: [
          { name: 'title', kind: 'required' as const, type: 'string' as const }
        ],
        data: [{ title: 'Document Title' }],
        query: 'extract documents'
      }
    ];

    for (const scenario of scenarios) {
      const schema: FieldSpec[] = scenario.schema.map(s => ({
        ...s,
        detector: {} as any,
        extractor: {} as any,
        validators: []
      }));

      const displaySpec = await generator.generateFromSchema(
        schema,
        scenario.data,
        scenario.query
      );

      // Collect all field references in the display spec
      const allReferencedFields = new Set([
        ...displaySpec.priorityFields,
        ...displaySpec.secondaryFields,
        ...Object.keys(displaySpec.customization.field_labels),
        ...Object.keys(displaySpec.customization.field_icons)
      ]);

      const availableFields = new Set(schema.map(f => f.name));

      // CRITICAL: Every referenced field must exist in the schema
      allReferencedFields.forEach(field => {
        expect(availableFields.has(field)).toBe(true);
      });
    }
  });
});