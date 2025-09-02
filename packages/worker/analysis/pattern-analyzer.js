// Atlas Codex - Content Pattern Analyzer
// Analyzes HTML structure to find optimal extraction patterns

const cheerio = require('cheerio');

class PatternAnalyzer {
  constructor() {
    // Common content patterns across different site types
    this.patterns = {
      article: {
        selectors: [
          'article',
          '[role="article"]',
          '.post',
          '.article',
          '.entry-content',
          '.post-content',
          'main article',
          '#main-content',
          '.story-body'
        ],
        indicators: ['<p>', '<h1>', '<h2>', 'author', 'date', 'publish']
      },
      product: {
        selectors: [
          '.product',
          '[itemtype*="Product"]',
          '[data-product]',
          '.product-detail',
          '.pdp-container',
          '#product-detail',
          '.item-detail'
        ],
        indicators: ['price', 'add to cart', 'buy now', 'stock', 'sku']
      },
      listing: {
        selectors: [
          '.listing',
          '.results',
          '.search-results',
          '.product-grid',
          '.item-list',
          '[role="list"]',
          '.cards-container'
        ],
        indicators: ['results', 'items', 'showing', 'page', 'sort']
      },
      navigation: {
        selectors: [
          'nav',
          '[role="navigation"]',
          '.navigation',
          '.menu',
          '#menu',
          '.navbar',
          'header nav'
        ],
        indicators: ['menu', 'nav', 'home', 'about', 'contact']
      }
    };
  }

  /**
   * Analyze content patterns in HTML
   */
  async analyzePatterns(html, url) {
    console.log(`🔎 Analyzing content patterns for ${url}`);
    
    const $ = cheerio.load(html);
    
    const analysis = {
      contentType: this.detectContentType($, html),
      selectors: this.findOptimalSelectors($),
      structure: this.analyzeStructure($),
      repeatingPatterns: this.findRepeatingPatterns($),
      dataAttributes: this.findDataAttributes($),
      microdata: this.extractMicrodata($),
      navigation: this.analyzeNavigation($),
      forms: this.analyzeForms($),
      confidence: 0
    };
    
    // Calculate confidence based on pattern matches
    analysis.confidence = this.calculateConfidence(analysis);
    
    console.log(`   Content type: ${analysis.contentType} (confidence: ${analysis.confidence}%)`);
    
    return analysis;
  }

  /**
   * Detect the primary content type of the page
   */
  detectContentType($, html) {
    const scores = {};
    
    for (const [type, pattern] of Object.entries(this.patterns)) {
      scores[type] = 0;
      
      // Check selectors
      for (const selector of pattern.selectors) {
        if ($(selector).length > 0) {
          scores[type] += 10;
        }
      }
      
      // Check indicators in text
      const htmlLower = html.toLowerCase();
      for (const indicator of pattern.indicators) {
        if (htmlLower.includes(indicator)) {
          scores[type] += 5;
        }
      }
    }
    
    // Additional specific checks
    if ($('article').length > 0 || $('.article').length > 0) {
      scores.article += 20;
    }
    if ($('[itemtype*="Product"]').length > 0 || $('.price').length > 0) {
      scores.product += 20;
    }
    if ($('.search-results').length > 0 || $('.listing').length > 0) {
      scores.listing += 20;
    }
    
    // Find highest scoring type
    let maxScore = 0;
    let detectedType = 'unknown';
    
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedType = type;
      }
    }
    
    return detectedType;
  }

  /**
   * Find optimal selectors for content extraction
   */
  findOptimalSelectors($) {
    const selectors = {
      title: null,
      content: null,
      author: null,
      date: null,
      price: null,
      image: null,
      description: null
    };
    
    // Title selectors
    const titleCandidates = [
      'h1',
      '.title',
      '.headline',
      '[itemprop="headline"]',
      '.product-title',
      'meta[property="og:title"]'
    ];
    
    for (const selector of titleCandidates) {
      const element = $(selector).first();
      if (element.length > 0 && element.text().trim().length > 0) {
        selectors.title = selector;
        break;
      }
    }
    
    // Content selectors
    const contentCandidates = [
      'article',
      '.content',
      '.post-content',
      '.entry-content',
      '[itemprop="articleBody"]',
      '.product-description',
      'main'
    ];
    
    for (const selector of contentCandidates) {
      const element = $(selector).first();
      if (element.length > 0 && element.text().trim().length > 100) {
        selectors.content = selector;
        break;
      }
    }
    
    // Author selectors
    const authorCandidates = [
      '.author',
      '[itemprop="author"]',
      '.by-author',
      '.posted-by',
      '[rel="author"]'
    ];
    
    for (const selector of authorCandidates) {
      if ($(selector).length > 0) {
        selectors.author = selector;
        break;
      }
    }
    
    // Date selectors
    const dateCandidates = [
      'time',
      '[itemprop="datePublished"]',
      '.date',
      '.publish-date',
      '.posted-on'
    ];
    
    for (const selector of dateCandidates) {
      if ($(selector).length > 0) {
        selectors.date = selector;
        break;
      }
    }
    
    // Price selectors
    const priceCandidates = [
      '.price',
      '[itemprop="price"]',
      '.product-price',
      '.cost',
      '[data-price]'
    ];
    
    for (const selector of priceCandidates) {
      if ($(selector).length > 0) {
        selectors.price = selector;
        break;
      }
    }
    
    // Image selectors
    const imageCandidates = [
      'article img',
      '.featured-image',
      '[itemprop="image"]',
      '.product-image',
      'meta[property="og:image"]'
    ];
    
    for (const selector of imageCandidates) {
      if ($(selector).length > 0) {
        selectors.image = selector;
        break;
      }
    }
    
    return selectors;
  }

  /**
   * Analyze the overall structure of the page
   */
  analyzeStructure($) {
    const structure = {
      hasHeader: $('header').length > 0,
      hasNav: $('nav').length > 0,
      hasMain: $('main').length > 0,
      hasArticle: $('article').length > 0,
      hasAside: $('aside').length > 0,
      hasFooter: $('footer').length > 0,
      
      // Semantic HTML5
      usesSemantic: false,
      
      // Layout patterns
      layoutType: 'unknown',
      
      // Content hierarchy
      headingStructure: this.analyzeHeadings($),
      
      // Lists and grids
      hasList: $('ul, ol').length > 0,
      hasTable: $('table').length > 0,
      hasGrid: $('.grid, .row, [class*="col-"]').length > 0
    };
    
    // Determine if uses semantic HTML5
    structure.usesSemantic = structure.hasHeader || structure.hasNav || 
                             structure.hasMain || structure.hasArticle || 
                             structure.hasAside || structure.hasFooter;
    
    // Detect layout type
    if (structure.hasArticle) {
      structure.layoutType = 'article';
    } else if (structure.hasGrid || $('.product-grid').length > 0) {
      structure.layoutType = 'grid';
    } else if ($('table').length > 3) {
      structure.layoutType = 'table';
    } else if ($('ul li').length > 10 || $('.list-item').length > 5) {
      structure.layoutType = 'list';
    }
    
    return structure;
  }

  /**
   * Analyze heading structure
   */
  analyzeHeadings($) {
    const headings = {
      h1: $('h1').length,
      h2: $('h2').length,
      h3: $('h3').length,
      h4: $('h4').length,
      h5: $('h5').length,
      h6: $('h6').length,
      hierarchy: []
    };
    
    // Build heading hierarchy
    $('h1, h2, h3, h4, h5, h6').each((i, elem) => {
      headings.hierarchy.push({
        level: elem.tagName.toLowerCase(),
        text: $(elem).text().trim().substring(0, 100)
      });
    });
    
    return headings;
  }

  /**
   * Find repeating patterns (for lists/grids)
   */
  findRepeatingPatterns($) {
    const patterns = [];
    
    // Look for repeated class patterns
    const classCount = {};
    $('[class]').each((i, elem) => {
      const classes = $(elem).attr('class').split(' ');
      classes.forEach(cls => {
        if (cls && !cls.includes('col-') && !cls.includes('row')) {
          classCount[cls] = (classCount[cls] || 0) + 1;
        }
      });
    });
    
    // Find classes that repeat more than 3 times
    for (const [cls, count] of Object.entries(classCount)) {
      if (count > 3) {
        const elements = $(`.${cls}`);
        
        // Check if these elements have similar structure
        if (this.haveSimilarStructure(elements, $)) {
          patterns.push({
            selector: `.${cls}`,
            count,
            type: this.detectPatternType(elements, $),
            fields: this.extractPatternFields(elements.first(), $)
          });
        }
      }
    }
    
    // Sort by count
    patterns.sort((a, b) => b.count - a.count);
    
    return patterns;
  }

  /**
   * Check if elements have similar structure
   */
  haveSimilarStructure(elements, $) {
    if (elements.length < 2) return false;
    
    const structures = [];
    elements.slice(0, 3).each((i, elem) => {
      const structure = this.getElementStructure($(elem));
      structures.push(structure);
    });
    
    // Compare structures
    return structures.every(s => s === structures[0]);
  }

  /**
   * Get structure signature of an element
   */
  getElementStructure($elem) {
    const children = $elem.children();
    const signature = children.map((i, child) => child.tagName).get().join(',');
    return signature;
  }

  /**
   * Detect pattern type (product, article, etc.)
   */
  detectPatternType(elements, $) {
    const first = elements.first();
    const text = first.text().toLowerCase();
    
    if (first.find('.price, [class*="price"]').length > 0) {
      return 'product';
    }
    if (first.find('h2, h3, h4').length > 0 && first.find('p').length > 0) {
      return 'article';
    }
    if (first.find('img').length > 0) {
      return 'media';
    }
    
    return 'item';
  }

  /**
   * Extract fields from a pattern element
   */
  extractPatternFields($elem, $) {
    const fields = {};
    
    // Look for title
    const title = $elem.find('h1, h2, h3, h4, h5, h6, .title, .heading').first();
    if (title.length > 0) {
      fields.title = { selector: this.getRelativeSelector(title, $elem), sample: title.text().trim() };
    }
    
    // Look for description
    const desc = $elem.find('p, .description, .summary').first();
    if (desc.length > 0) {
      fields.description = { selector: this.getRelativeSelector(desc, $elem), sample: desc.text().trim().substring(0, 100) };
    }
    
    // Look for price
    const price = $elem.find('.price, [class*="price"], [data-price]').first();
    if (price.length > 0) {
      fields.price = { selector: this.getRelativeSelector(price, $elem), sample: price.text().trim() };
    }
    
    // Look for image
    const image = $elem.find('img').first();
    if (image.length > 0) {
      fields.image = { selector: 'img', attribute: 'src', sample: image.attr('src') };
    }
    
    // Look for link
    const link = $elem.find('a').first();
    if (link.length > 0) {
      fields.link = { selector: 'a', attribute: 'href', sample: link.attr('href') };
    }
    
    return fields;
  }

  /**
   * Get relative selector for an element within container
   */
  getRelativeSelector($elem, $container) {
    const classes = $elem.attr('class');
    if (classes) {
      const classList = classes.split(' ').filter(c => c && !c.includes('col-'));
      if (classList.length > 0) {
        return `.${classList[0]}`;
      }
    }
    
    return $elem.prop('tagName').toLowerCase();
  }

  /**
   * Find data attributes that might contain structured data
   */
  findDataAttributes($) {
    const dataAttrs = {};
    
    $('[data-product-id], [data-item-id], [data-article-id]').each((i, elem) => {
      const $elem = $(elem);
      const attrs = elem.attributes;
      
      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i];
        if (attr.name.startsWith('data-')) {
          const key = attr.name.substring(5);
          if (!dataAttrs[key]) {
            dataAttrs[key] = [];
          }
          dataAttrs[key].push({
            value: attr.value,
            element: $elem.prop('tagName').toLowerCase()
          });
        }
      }
    });
    
    return dataAttrs;
  }

  /**
   * Extract microdata/structured data
   */
  extractMicrodata($) {
    const microdata = {
      jsonLd: [],
      microdata: [],
      rdfa: [],
      openGraph: {},
      twitter: {}
    };
    
    // JSON-LD
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html());
        microdata.jsonLd.push(json);
      } catch (e) {
        // Invalid JSON
      }
    });
    
    // Microdata
    $('[itemscope]').each((i, elem) => {
      const $elem = $(elem);
      const item = {
        type: $elem.attr('itemtype'),
        properties: {}
      };
      
      $elem.find('[itemprop]').each((j, prop) => {
        const $prop = $(prop);
        const propName = $prop.attr('itemprop');
        item.properties[propName] = $prop.text().trim() || $prop.attr('content');
      });
      
      microdata.microdata.push(item);
    });
    
    // Open Graph
    $('meta[property^="og:"]').each((i, elem) => {
      const $elem = $(elem);
      const property = $elem.attr('property').substring(3);
      microdata.openGraph[property] = $elem.attr('content');
    });
    
    // Twitter Cards
    $('meta[name^="twitter:"]').each((i, elem) => {
      const $elem = $(elem);
      const name = $elem.attr('name').substring(8);
      microdata.twitter[name] = $elem.attr('content');
    });
    
    return microdata;
  }

  /**
   * Analyze navigation patterns
   */
  analyzeNavigation($) {
    const navigation = {
      primary: null,
      secondary: [],
      breadcrumbs: null,
      pagination: null
    };
    
    // Primary navigation
    const primaryNav = $('nav').first();
    if (primaryNav.length > 0) {
      navigation.primary = {
        selector: 'nav',
        linkCount: primaryNav.find('a').length,
        structure: this.getNavStructure(primaryNav, $)
      };
    }
    
    // Breadcrumbs
    const breadcrumbs = $('.breadcrumb, .breadcrumbs, [aria-label="breadcrumb"]').first();
    if (breadcrumbs.length > 0) {
      navigation.breadcrumbs = {
        selector: this.getSelectorForElement(breadcrumbs),
        items: breadcrumbs.find('a, span').map((i, elem) => $(elem).text().trim()).get()
      };
    }
    
    // Pagination
    const pagination = $('.pagination, .pager, [role="navigation"][aria-label*="pagination"]').first();
    if (pagination.length > 0) {
      navigation.pagination = {
        selector: this.getSelectorForElement(pagination),
        type: this.detectPaginationType(pagination, $)
      };
    }
    
    return navigation;
  }

  /**
   * Get navigation structure
   */
  getNavStructure($nav, $) {
    const structure = {
      type: 'unknown',
      depth: 1,
      itemCount: 0
    };
    
    // Check for nested navigation
    if ($nav.find('ul ul, ol ol').length > 0) {
      structure.type = 'nested';
      structure.depth = 2;
      if ($nav.find('ul ul ul, ol ol ol').length > 0) {
        structure.depth = 3;
      }
    } else if ($nav.find('ul, ol').length > 0) {
      structure.type = 'list';
    } else {
      structure.type = 'flat';
    }
    
    structure.itemCount = $nav.find('a').length;
    
    return structure;
  }

  /**
   * Detect pagination type
   */
  detectPaginationType($pagination, $) {
    if ($pagination.find('.next, [rel="next"]').length > 0) {
      return 'next-previous';
    }
    if ($pagination.find('[aria-label="Page"]').length > 0) {
      return 'numbered';
    }
    if ($pagination.text().toLowerCase().includes('load more')) {
      return 'load-more';
    }
    if ($pagination.text().toLowerCase().includes('show more')) {
      return 'show-more';
    }
    
    return 'unknown';
  }

  /**
   * Analyze forms on the page
   */
  analyzeForms($) {
    const forms = [];
    
    $('form').each((i, elem) => {
      const $form = $(elem);
      const form = {
        selector: this.getSelectorForElement($form),
        action: $form.attr('action'),
        method: $form.attr('method') || 'get',
        fields: [],
        type: this.detectFormType($form, $)
      };
      
      // Analyze form fields
      $form.find('input, select, textarea').each((j, field) => {
        const $field = $(field);
        form.fields.push({
          type: $field.attr('type') || $field.prop('tagName').toLowerCase(),
          name: $field.attr('name'),
          id: $field.attr('id'),
          required: $field.prop('required')
        });
      });
      
      forms.push(form);
    });
    
    return forms;
  }

  /**
   * Detect form type
   */
  detectFormType($form, $) {
    const text = $form.text().toLowerCase();
    const action = ($form.attr('action') || '').toLowerCase();
    
    if (text.includes('search') || action.includes('search')) {
      return 'search';
    }
    if (text.includes('login') || text.includes('sign in')) {
      return 'login';
    }
    if (text.includes('subscribe') || text.includes('newsletter')) {
      return 'subscribe';
    }
    if (text.includes('contact') || text.includes('message')) {
      return 'contact';
    }
    if ($form.find('[type="email"]').length > 0 && $form.find('[type="password"]').length > 0) {
      return 'authentication';
    }
    
    return 'unknown';
  }

  /**
   * Get selector for an element
   */
  getSelectorForElement($elem) {
    const id = $elem.attr('id');
    if (id) {
      return `#${id}`;
    }
    
    const classes = $elem.attr('class');
    if (classes) {
      const classList = classes.split(' ').filter(c => c && !c.includes('col-'));
      if (classList.length > 0) {
        return `.${classList[0]}`;
      }
    }
    
    return $elem.prop('tagName').toLowerCase();
  }

  /**
   * Calculate confidence score for pattern analysis
   */
  calculateConfidence(analysis) {
    let confidence = 0;
    
    // Content type detection
    if (analysis.contentType !== 'unknown') {
      confidence += 20;
    }
    
    // Selector quality
    const selectorCount = Object.values(analysis.selectors).filter(s => s !== null).length;
    confidence += Math.min(selectorCount * 10, 30);
    
    // Structure quality
    if (analysis.structure.usesSemantic) {
      confidence += 15;
    }
    
    // Repeating patterns found
    if (analysis.repeatingPatterns.length > 0) {
      confidence += 15;
    }
    
    // Microdata present
    if (analysis.microdata.jsonLd.length > 0 || 
        analysis.microdata.microdata.length > 0 ||
        Object.keys(analysis.microdata.openGraph).length > 0) {
      confidence += 20;
    }
    
    return Math.min(confidence, 100);
  }
}

module.exports = { PatternAnalyzer };