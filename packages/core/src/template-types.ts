// Atlas Codex - Production Template System Types
// Secure, versioned templates with comprehensive governance

import { z } from 'zod';

// Template metadata with provenance tracking
export const TemplateMetaSchema = z.object({
  id: z.string(),
  version: z.string(),
  created_at: z.string(),
  created_by: z.string(),
  provenance: z.enum(['human', 'llm', 'hybrid']),
  scope: z.object({
    domains: z.array(z.string()).optional(),
    locales: z.array(z.string()).optional()
  }).optional(),
  negative_triggers: z.array(z.string()).optional(),
  guardrails: z.object({
    must_have: z.array(z.string()),
    must_not_have: z.array(z.string())
  }),
  deprecation: z.object({
    superseded_by: z.string().optional(),
    reason: z.string().optional()
  }).optional(),
  success_metrics: z.object({
    accuracy: z.number(),
    usage_count: z.number(),
    drift_score: z.number()
  })
});

// Extraction template schema with PII awareness
export const ExtractionTemplateSchema = z.object({
  id: z.string(),
  trigger_patterns: z.array(z.string()),
  confidence_indicators: z.array(z.string()),
  schema: z.object({
    type: z.literal('array'),
    items: z.object({
      type: z.literal('object'),
      properties: z.record(z.object({
        type: z.string(),
        description: z.string().optional(),
        format: z.string().optional(),
        pii: z.boolean().optional()
      })),
      required: z.array(z.string()).optional()
    })
  }),
  checksum: z.string().optional()
}).merge(TemplateMetaSchema);

// Display specification DSL (declarative, no code generation)
export const DisplaySpecSchema = z.object({
  template_name: z.string(),
  layout: z.object({
    kind: z.enum(['grid', 'list', 'table', 'masonry', 'timeline']),
    columns: z.object({
      mobile: z.number(),
      tablet: z.number(),
      desktop: z.number()
    }).optional(),
    gap: z.string().optional(),
    direction: z.enum(['row', 'column']).optional()
  }),
  components: z.array(z.object({
    type: z.string(),
    bind: z.string(),
    show: z.record(z.boolean()).optional(),
    props: z.record(z.any()).optional()
  })),
  interactions: z.array(z.object({
    on: z.string(),
    emit: z.string(),
    payload: z.string().optional()
  })).optional(),
  a11y: z.object({
    minContrast: z.enum(['AA', 'AAA']),
    keyboardNav: z.boolean(),
    screenReader: z.boolean().optional(),
    focusOrder: z.array(z.string()).optional()
  }),
  performance: z.object({
    virtualizeOver: z.number().optional(),
    lazyLoadImages: z.boolean().optional(),
    prefetchData: z.boolean().optional()
  }).optional(),
  i18n: z.object({
    pluralization: z.record(z.string()).optional(),
    dateFormat: z.string().optional(),
    numberFormat: z.string().optional()
  }).optional()
});

// Display template with metadata
export const DisplayTemplateSchema = z.object({
  id: z.string(),
  data_patterns: z.array(z.string()),
  ui_indicators: z.array(z.string()),
  display_spec: DisplaySpecSchema,
  compatibility: z.object({
    data_shapes: z.array(z.string()),
    min_items: z.number().optional(),
    max_items: z.number().optional(),
    required_fields: z.array(z.string())
  }),
  checksum: z.string().optional()
}).merge(TemplateMetaSchema);

// Template match result
export const TemplateMatchSchema = z.object({
  template: ExtractionTemplateSchema,
  confidence: z.number(),
  match_reasons: z.array(z.string()).optional()
});

// Display match result
export const DisplayMatchSchema = z.object({
  template: DisplayTemplateSchema,
  confidence: z.number(),
  data_compatibility: z.number(),
  match_reasons: z.array(z.string()).optional()
});

// Drift detection result
export const DriftResultSchema = z.object({
  template_id: z.string(),
  is_drifting: z.boolean(),
  drift_score: z.number(),
  failure_rate: z.number(),
  failed_fields: z.array(z.string()),
  recommendation: z.enum(['update', 'deprecate', 'fork', 'monitor'])
});

// Production telemetry events
export const TelemetryEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ExtractionTemplateMatched'),
    template_id: z.string(),
    confidence: z.number(),
    tokens_used: z.number(),
    timestamp: z.string()
  }),
  z.object({
    type: z.literal('ExtractionValidated'),
    score: z.number(),
    sampled_rate: z.number(),
    failures_by_field: z.record(z.number()),
    timestamp: z.string()
  }),
  z.object({
    type: z.literal('DisplaySpecGenerated'),
    display_template: z.string(),
    confidence: z.number(),
    a11y_score: z.number(),
    timestamp: z.string()
  }),
  z.object({
    type: z.literal('UserInteraction'),
    interaction_type: z.string(),
    dwell_ms: z.number(),
    conversion: z.boolean().optional(),
    timestamp: z.string()
  })
]);

// Export types
export type TemplateMeta = z.infer<typeof TemplateMetaSchema>;
export type ExtractionTemplate = z.infer<typeof ExtractionTemplateSchema>;
export type DisplaySpec = z.infer<typeof DisplaySpecSchema>;
export type DisplayTemplate = z.infer<typeof DisplayTemplateSchema>;
export type TemplateMatch = z.infer<typeof TemplateMatchSchema>;
export type DisplayMatch = z.infer<typeof DisplayMatchSchema>;
export type DriftResult = z.infer<typeof DriftResultSchema>;
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

// Utility functions
export function generateTemplateId(name: string, version: string = '1.0.0'): string {
  return `${name}_v${version.replace(/\./g, '_')}`;
}

export function calculateChecksum(template: object): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256')
    .update(JSON.stringify(template, Object.keys(template).sort()))
    .digest('hex');
}

export function validateTemplateIntegrity(template: ExtractionTemplate | DisplayTemplate): boolean {
  if (!template.checksum) return false;
  
  const { checksum, ...templateWithoutChecksum } = template;
  const calculatedChecksum = calculateChecksum(templateWithoutChecksum);
  
  return checksum === calculatedChecksum;
}

export function createTelemetryEvent(type: TelemetryEvent['type'], data: Omit<TelemetryEvent, 'type' | 'timestamp'>): TelemetryEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    ...data
  } as TelemetryEvent;
}