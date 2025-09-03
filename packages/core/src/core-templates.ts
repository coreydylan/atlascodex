// Atlas Codex - Production Core Templates
// Hand-crafted, battle-tested extraction templates with comprehensive security

import { ExtractionTemplate, DisplayTemplate, generateTemplateId, calculateChecksum } from './template-types';

// Core extraction templates for common data patterns
export const coreExtractionTemplates: ExtractionTemplate[] = [
  {
    id: generateTemplateId('people_directory'),
    trigger_patterns: ['staff', 'team', 'employees', 'people', 'directory', 'faculty', 'crew', 'members'],
    negative_triggers: ['board of directors', 'leadership team', 'executive team', 'advisory board'],
    confidence_indicators: ['job title', 'contact info', 'department', 'email', 'phone', 'photo'],
    guardrails: {
      must_have: ['name'],
      must_not_have: ['password', 'ssn', 'credit card', 'api_key', 'token']
    },
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name', pii: true },
          title: { type: 'string', description: 'Job title or position' },
          department: { type: 'string', description: 'Department or division' },
          email: { type: 'string', format: 'email', description: 'Email address', pii: true },
          phone: { type: 'string', description: 'Phone number', pii: true },
          photo_url: { type: 'string', format: 'uri', description: 'Profile photo URL' },
          bio: { type: 'string', description: 'Brief biography' },
          location: { type: 'string', description: 'Office location' },
          linkedin_url: { type: 'string', format: 'uri', description: 'LinkedIn profile' }
        },
        required: ['name']
      }
    },
    scope: { domains: ['company', 'university', 'organization'] },
    provenance: 'human',
    version: '1.0.0',
    created_at: new Date().toISOString(),
    created_by: 'atlas-core-team',
    success_metrics: { accuracy: 0.94, usage_count: 0, drift_score: 0 },
    checksum: ''
  },

  {
    id: generateTemplateId('product_catalog'),
    trigger_patterns: ['products', 'shop', 'store', 'catalog', 'items', 'inventory', 'merchandise'],
    negative_triggers: ['about us', 'contact', 'privacy policy'],
    confidence_indicators: ['pricing', 'add to cart', 'product images', 'buy now', 'in stock'],
    guardrails: {
      must_have: ['product', 'price'],
      must_not_have: ['password', 'credit_card', 'payment_info']
    },
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Product name' },
          price: { type: 'string', description: 'Product price' },
          currency: { type: 'string', description: 'Price currency' },
          description: { type: 'string', description: 'Product description' },
          image_url: { type: 'string', format: 'uri', description: 'Product image URL' },
          availability: { type: 'string', description: 'Stock status' },
          category: { type: 'string', description: 'Product category' },
          sku: { type: 'string', description: 'Product SKU' },
          rating: { type: 'string', description: 'Customer rating' },
          review_count: { type: 'string', description: 'Number of reviews' }
        },
        required: ['name', 'price']
      }
    },
    scope: { domains: ['ecommerce', 'retail', 'marketplace'] },
    provenance: 'human',
    version: '1.0.0',
    created_at: new Date().toISOString(),
    created_by: 'atlas-core-team',
    success_metrics: { accuracy: 0.87, usage_count: 0, drift_score: 0 },
    checksum: ''
  },

  {
    id: generateTemplateId('news_articles'),
    trigger_patterns: ['news', 'articles', 'blog', 'posts', 'stories', 'headlines'],
    negative_triggers: ['products', 'shop', 'buy'],
    confidence_indicators: ['publish date', 'author', 'headline', 'byline', 'article body'],
    guardrails: {
      must_have: ['title', 'content'],
      must_not_have: ['password', 'private', 'confidential']
    },
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Article title' },
          content: { type: 'string', description: 'Article content' },
          author: { type: 'string', description: 'Article author' },
          published_date: { type: 'string', description: 'Publication date' },
          category: { type: 'string', description: 'Article category' },
          tags: { type: 'string', description: 'Article tags' },
          image_url: { type: 'string', format: 'uri', description: 'Featured image' },
          read_time: { type: 'string', description: 'Estimated read time' },
          excerpt: { type: 'string', description: 'Article excerpt' }
        },
        required: ['title']
      }
    },
    scope: { domains: ['news', 'blog', 'media'] },
    provenance: 'human',
    version: '1.0.0',
    created_at: new Date().toISOString(),
    created_by: 'atlas-core-team',
    success_metrics: { accuracy: 0.91, usage_count: 0, drift_score: 0 },
    checksum: ''
  },

  {
    id: generateTemplateId('event_listings'),
    trigger_patterns: ['events', 'calendar', 'schedule', 'meetings', 'conferences', 'workshops'],
    confidence_indicators: ['date', 'time', 'location', 'register', 'rsvp', 'tickets'],
    guardrails: {
      must_have: ['event', 'date'],
      must_not_have: ['password', 'private_key']
    },
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title' },
          date: { type: 'string', description: 'Event date' },
          time: { type: 'string', description: 'Event time' },
          location: { type: 'string', description: 'Event location' },
          description: { type: 'string', description: 'Event description' },
          organizer: { type: 'string', description: 'Event organizer' },
          price: { type: 'string', description: 'Ticket price' },
          registration_url: { type: 'string', format: 'uri', description: 'Registration link' },
          category: { type: 'string', description: 'Event category' }
        },
        required: ['title', 'date']
      }
    },
    scope: { domains: ['events', 'conference', 'meetup'] },
    provenance: 'human',
    version: '1.0.0',
    created_at: new Date().toISOString(),
    created_by: 'atlas-core-team',
    success_metrics: { accuracy: 0.89, usage_count: 0, drift_score: 0 },
    checksum: ''
  },

  {
    id: generateTemplateId('job_postings'),
    trigger_patterns: ['jobs', 'careers', 'positions', 'openings', 'hiring', 'employment'],
    confidence_indicators: ['salary', 'benefits', 'requirements', 'apply', 'qualifications'],
    guardrails: {
      must_have: ['job', 'title'],
      must_not_have: ['password', 'social_security']
    },
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Job title' },
          company: { type: 'string', description: 'Company name' },
          location: { type: 'string', description: 'Job location' },
          description: { type: 'string', description: 'Job description' },
          requirements: { type: 'string', description: 'Job requirements' },
          salary: { type: 'string', description: 'Salary information' },
          employment_type: { type: 'string', description: 'Full-time, part-time, contract' },
          posted_date: { type: 'string', description: 'Date posted' },
          apply_url: { type: 'string', format: 'uri', description: 'Application link' },
          remote_ok: { type: 'string', description: 'Remote work allowed' }
        },
        required: ['title', 'company']
      }
    },
    scope: { domains: ['jobs', 'careers', 'hiring'] },
    provenance: 'human',
    version: '1.0.0',
    created_at: new Date().toISOString(),
    created_by: 'atlas-core-team',
    success_metrics: { accuracy: 0.86, usage_count: 0, drift_score: 0 },
    checksum: ''
  }
];

// Add checksums to templates
coreExtractionTemplates.forEach(template => {
  const { checksum, ...templateWithoutChecksum } = template;
  template.checksum = calculateChecksum(templateWithoutChecksum);
});

// Core display templates for common UI patterns
export const coreDisplayTemplates: DisplayTemplate[] = [
  {
    id: generateTemplateId('people_card_grid'),
    data_patterns: ['people', 'staff', 'team', 'directory'],
    ui_indicators: ['profile', 'contact', 'team page'],
    compatibility: {
      data_shapes: ['people_directory'],
      min_items: 1,
      required_fields: ['name']
    },
    display_spec: {
      template_name: 'people_card_grid',
      layout: {
        kind: 'grid',
        columns: { mobile: 1, tablet: 2, desktop: 3 },
        gap: '1rem'
      },
      components: [
        {
          type: 'ProfileCard',
          bind: 'people[].*',
          show: { photo: true, department: true, contact: true }
        },
        {
          type: 'FilterBar',
          bind: 'controls',
          props: { filters: ['department', 'title'] }
        },
        {
          type: 'SearchBox',
          bind: 'controls',
          props: { target: 'people', placeholder: 'Search team members...' }
        }
      ],
      interactions: [
        { on: 'card.click', emit: 'contact', payload: 'people[].contact' },
        { on: 'filter.change', emit: 'filter', payload: 'filter.value' }
      ],
      a11y: {
        minContrast: 'AA',
        keyboardNav: true,
        screenReader: true,
        focusOrder: ['search', 'filters', 'cards']
      },
      performance: {
        virtualizeOver: 50,
        lazyLoadImages: true
      }
    },
    provenance: 'human',
    version: '1.0.0',
    created_at: new Date().toISOString(),
    created_by: 'atlas-core-team',
    guardrails: {
      must_have: ['display'],
      must_not_have: ['script', 'eval']
    },
    success_metrics: { accuracy: 0.92, usage_count: 0, drift_score: 0 },
    checksum: ''
  },

  {
    id: generateTemplateId('product_grid'),
    data_patterns: ['products', 'catalog', 'shop', 'store'],
    ui_indicators: ['ecommerce', 'shopping', 'products'],
    compatibility: {
      data_shapes: ['product_catalog'],
      min_items: 1,
      required_fields: ['name', 'price']
    },
    display_spec: {
      template_name: 'product_grid',
      layout: {
        kind: 'masonry',
        columns: { mobile: 1, tablet: 2, desktop: 4 },
        gap: '1.5rem'
      },
      components: [
        {
          type: 'ProductCard',
          bind: 'products[].*',
          show: { image: true, price: true, rating: true }
        },
        {
          type: 'FilterSidebar',
          bind: 'controls',
          props: { filters: ['category', 'price_range', 'rating'] }
        },
        {
          type: 'SortControls',
          bind: 'controls',
          props: { options: ['price_asc', 'price_desc', 'rating', 'newest'] }
        }
      ],
      interactions: [
        { on: 'card.click', emit: 'view_product', payload: 'products[].url' },
        { on: 'add_to_cart.click', emit: 'add_to_cart', payload: 'products[].sku' }
      ],
      a11y: {
        minContrast: 'AA',
        keyboardNav: true,
        screenReader: true
      },
      performance: {
        virtualizeOver: 100,
        lazyLoadImages: true,
        prefetchData: true
      },
      i18n: {
        pluralization: { 'product': 'products', 'item': 'items' },
        numberFormat: 'currency'
      }
    },
    provenance: 'human',
    version: '1.0.0',
    created_at: new Date().toISOString(),
    created_by: 'atlas-core-team',
    guardrails: {
      must_have: ['display'],
      must_not_have: ['script', 'eval']
    },
    success_metrics: { accuracy: 0.88, usage_count: 0, drift_score: 0 },
    checksum: ''
  },

  {
    id: generateTemplateId('news_timeline'),
    data_patterns: ['news', 'articles', 'blog', 'posts'],
    ui_indicators: ['news', 'blog', 'articles', 'timeline'],
    compatibility: {
      data_shapes: ['news_articles'],
      min_items: 1,
      required_fields: ['title']
    },
    display_spec: {
      template_name: 'news_timeline',
      layout: {
        kind: 'timeline',
        direction: 'column',
        gap: '2rem'
      },
      components: [
        {
          type: 'ArticleCard',
          bind: 'articles[].*',
          show: { image: true, excerpt: true, date: true, author: true }
        },
        {
          type: 'CategoryFilter',
          bind: 'controls',
          props: { categories: 'articles[].category' }
        },
        {
          type: 'Pagination',
          bind: 'controls',
          props: { itemsPerPage: 10 }
        }
      ],
      interactions: [
        { on: 'article.click', emit: 'read_article', payload: 'articles[].url' },
        { on: 'category.select', emit: 'filter_category', payload: 'category.value' }
      ],
      a11y: {
        minContrast: 'AA',
        keyboardNav: true,
        screenReader: true
      },
      performance: {
        virtualizeOver: 20,
        lazyLoadImages: true
      }
    },
    provenance: 'human',
    version: '1.0.0',
    created_at: new Date().toISOString(),
    created_by: 'atlas-core-team',
    guardrails: {
      must_have: ['display'],
      must_not_have: ['script', 'eval']
    },
    success_metrics: { accuracy: 0.85, usage_count: 0, drift_score: 0 },
    checksum: ''
  }
];

// Add checksums to display templates
coreDisplayTemplates.forEach(template => {
  const { checksum, ...templateWithoutChecksum } = template;
  template.checksum = calculateChecksum(templateWithoutChecksum);
});

// Minimal fallback templates for graceful degradation
export const minimalFallbackTemplates: ExtractionTemplate[] = [
  {
    id: generateTemplateId('minimal_list'),
    trigger_patterns: ['list', 'items', 'collection'],
    confidence_indicators: ['multiple items', 'repeated structure'],
    guardrails: {
      must_have: ['item'],
      must_not_have: ['password', 'private']
    },
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Item title' },
          description: { type: 'string', description: 'Item description' },
          url: { type: 'string', format: 'uri', description: 'Item URL' }
        },
        required: ['title']
      }
    },
    provenance: 'human',
    version: '1.0.0',
    created_at: new Date().toISOString(),
    created_by: 'atlas-core-team',
    success_metrics: { accuracy: 0.70, usage_count: 0, drift_score: 0 },
    checksum: ''
  },

  {
    id: generateTemplateId('minimal_content'),
    trigger_patterns: ['content', 'text', 'article'],
    confidence_indicators: ['text content', 'paragraphs', 'headings'],
    guardrails: {
      must_have: ['content'],
      must_not_have: ['password', 'secret']
    },
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string', description: 'Content heading' },
          content: { type: 'string', description: 'Main content' },
          metadata: { type: 'string', description: 'Additional metadata' }
        },
        required: ['content']
      }
    },
    provenance: 'human',
    version: '1.0.0',
    created_at: new Date().toISOString(),
    created_by: 'atlas-core-team',
    success_metrics: { accuracy: 0.65, usage_count: 0, drift_score: 0 },
    checksum: ''
  }
];

// Add checksums to minimal templates
minimalFallbackTemplates.forEach(template => {
  const { checksum, ...templateWithoutChecksum } = template;
  template.checksum = calculateChecksum(templateWithoutChecksum);
});

// Template categories for easy lookup
export const templateCategories = {
  people: ['people_directory'],
  ecommerce: ['product_catalog'],
  content: ['news_articles', 'minimal_content'],
  events: ['event_listings'],
  jobs: ['job_postings'],
  fallback: ['minimal_list', 'minimal_content']
};

// Export all templates
export const allCoreTemplates = [
  ...coreExtractionTemplates,
  ...minimalFallbackTemplates
];

export const allDisplayTemplates = coreDisplayTemplates;