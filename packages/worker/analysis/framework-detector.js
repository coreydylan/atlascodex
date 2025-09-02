// Atlas Codex - Advanced Framework Detection
// Detects web frameworks, CMSs, and technologies used by websites

class FrameworkDetector {
  constructor() {
    // Comprehensive framework detection patterns
    this.frameworks = {
      // JavaScript Frameworks
      'react': {
        patterns: [/__REACT_DEVTOOLS_GLOBAL_HOOK__/, /_reactRootContainer/, /data-reactroot/],
        scripts: [/react(-dom)?(?:\.production)?(?:\.min)?\.js/],
        meta: [],
        headers: [],
        confidence: 0
      },
      'vue': {
        patterns: [/__VUE__/, /__VUE_DEVTOOLS_GLOBAL_HOOK__/],
        scripts: [/vue(?:\.global)?(?:\.prod)?(?:\.min)?\.js/],
        meta: [],
        headers: [],
        confidence: 0
      },
      'angular': {
        patterns: [/ng-version/, /ng-/, /\[ng\\\]/],
        scripts: [/angular(?:\.min)?\.js/, /zone\.js/],
        meta: [],
        headers: [],
        confidence: 0
      },
      'svelte': {
        patterns: [/__svelte/],
        scripts: [/svelte/],
        meta: [],
        headers: [],
        confidence: 0
      },
      
      // Meta-frameworks
      'next.js': {
        patterns: [/__NEXT_DATA__/, /_next\/static/],
        scripts: [/_next\/static\/chunks/],
        meta: [{ name: 'next-head-count' }],
        headers: ['x-powered-by: Next.js'],
        confidence: 0
      },
      'nuxt': {
        patterns: [/__NUXT__/, /_nuxt/],
        scripts: [/_nuxt\//],
        meta: [],
        headers: [],
        confidence: 0
      },
      'gatsby': {
        patterns: [/___gatsby/, /gatsby-/],
        scripts: [/gatsby/],
        meta: [{ name: 'generator', content: 'Gatsby' }],
        headers: [],
        confidence: 0
      },
      'remix': {
        patterns: [/__remix/],
        scripts: [/remix/],
        meta: [],
        headers: [],
        confidence: 0
      },
      
      // CMS Platforms
      'wordpress': {
        patterns: [/wp-content/, /wp-includes/, /wp-json/],
        scripts: [/wp-includes\/js/, /wp-content\/plugins/],
        meta: [{ name: 'generator', content: 'WordPress' }],
        headers: ['x-powered-by: W3 Total Cache'],
        confidence: 0
      },
      'drupal': {
        patterns: [/\/sites\/default\/files/, /drupal/],
        scripts: [/drupal\.js/],
        meta: [{ name: 'generator', content: 'Drupal' }],
        headers: ['x-drupal-cache'],
        confidence: 0
      },
      'joomla': {
        patterns: [/\/components\/com_/, /joomla/],
        scripts: [/joomla/],
        meta: [{ name: 'generator', content: 'Joomla' }],
        headers: [],
        confidence: 0
      },
      
      // E-commerce Platforms
      'shopify': {
        patterns: [/cdn\.shopify/, /shopify/, /myshopify\.com/],
        scripts: [/cdn\.shopify\.com/],
        meta: [{ property: 'og:platform', content: 'Shopify' }],
        headers: ['x-shopify-stage'],
        confidence: 0
      },
      'woocommerce': {
        patterns: [/woocommerce/, /wc-/],
        scripts: [/woocommerce/],
        meta: [],
        headers: [],
        confidence: 0
      },
      'magento': {
        patterns: [/mage/, /Magento/],
        scripts: [/magento/],
        meta: [],
        headers: ['x-magento-'],
        confidence: 0
      },
      'bigcommerce': {
        patterns: [/bigcommerce/],
        scripts: [/bigcommerce/],
        meta: [],
        headers: [],
        confidence: 0
      },
      
      // Static Site Generators
      'jekyll': {
        patterns: [],
        scripts: [],
        meta: [{ name: 'generator', content: 'Jekyll' }],
        headers: [],
        confidence: 0
      },
      'hugo': {
        patterns: [],
        scripts: [],
        meta: [{ name: 'generator', content: 'Hugo' }],
        headers: [],
        confidence: 0
      },
      
      // Hosting/CDN Detection
      'cloudflare': {
        patterns: [/cloudflare/],
        scripts: [/cloudflare-static/],
        meta: [],
        headers: ['cf-ray', 'cf-cache-status'],
        confidence: 0
      },
      'vercel': {
        patterns: [],
        scripts: [],
        meta: [],
        headers: ['x-vercel-id', 'x-vercel-cache'],
        confidence: 0
      },
      'netlify': {
        patterns: [],
        scripts: [],
        meta: [],
        headers: ['x-nf-request-id', 'x-netlify-'],
        confidence: 0
      }
    };
  }

  /**
   * Detect framework from HTML and headers
   */
  async detect(url, html, headers = {}) {
    console.log(`🔍 Detecting framework for ${url}`);
    
    const detectedFrameworks = [];
    
    // Check each framework
    for (const [name, framework] of Object.entries(this.frameworks)) {
      let confidence = 0;
      const signals = [];
      
      // Check HTML patterns
      for (const pattern of framework.patterns) {
        if (pattern.test(html)) {
          confidence += 30;
          signals.push(`pattern: ${pattern}`);
        }
      }
      
      // Check script sources
      for (const scriptPattern of framework.scripts) {
        if (scriptPattern.test(html)) {
          confidence += 25;
          signals.push(`script: ${scriptPattern}`);
        }
      }
      
      // Check meta tags
      for (const meta of framework.meta) {
        if (meta.name && html.includes(`name="${meta.name}"`)) {
          confidence += 20;
          signals.push(`meta: ${meta.name}`);
        }
        if (meta.property && html.includes(`property="${meta.property}"`)) {
          confidence += 20;
          signals.push(`meta property: ${meta.property}`);
        }
        if (meta.content && html.includes(meta.content)) {
          confidence += 15;
          signals.push(`meta content: ${meta.content}`);
        }
      }
      
      // Check headers
      for (const headerPattern of framework.headers) {
        const [headerName, headerValue] = headerPattern.split(': ');
        if (headers[headerName]?.includes(headerValue)) {
          confidence += 35;
          signals.push(`header: ${headerPattern}`);
        }
      }
      
      if (confidence > 0) {
        detectedFrameworks.push({
          name,
          confidence: Math.min(confidence, 100),
          signals
        });
      }
    }
    
    // Sort by confidence
    detectedFrameworks.sort((a, b) => b.confidence - a.confidence);
    
    // Get additional technology stack info
    const techStack = this.detectTechStack(html, headers);
    
    return {
      primary: detectedFrameworks[0]?.name || 'unknown',
      frameworks: detectedFrameworks,
      techStack,
      confidence: detectedFrameworks[0]?.confidence || 0
    };
  }

  /**
   * Detect additional technology stack
   */
  detectTechStack(html, headers) {
    const tech = {
      language: [],
      server: [],
      cdn: [],
      analytics: [],
      advertising: [],
      fonts: [],
      javascript: [],
      css: []
    };
    
    // Language detection from headers
    if (headers['x-powered-by']) {
      const powered = headers['x-powered-by'].toLowerCase();
      if (powered.includes('php')) tech.language.push('PHP');
      if (powered.includes('asp')) tech.language.push('ASP.NET');
      if (powered.includes('express')) tech.language.push('Node.js/Express');
    }
    
    // Server detection
    if (headers['server']) {
      const server = headers['server'].toLowerCase();
      if (server.includes('nginx')) tech.server.push('nginx');
      if (server.includes('apache')) tech.server.push('Apache');
      if (server.includes('cloudflare')) tech.cdn.push('Cloudflare');
      if (server.includes('vercel')) tech.server.push('Vercel');
    }
    
    // Analytics detection
    if (html.includes('google-analytics.com') || html.includes('gtag(')) {
      tech.analytics.push('Google Analytics');
    }
    if (html.includes('googletagmanager.com')) {
      tech.analytics.push('Google Tag Manager');
    }
    if (html.includes('facebook.com/tr')) {
      tech.analytics.push('Facebook Pixel');
    }
    if (html.includes('segment.com') || html.includes('analytics.js')) {
      tech.analytics.push('Segment');
    }
    if (html.includes('hotjar.com')) {
      tech.analytics.push('Hotjar');
    }
    
    // JavaScript libraries
    if (html.includes('jquery')) tech.javascript.push('jQuery');
    if (html.includes('lodash')) tech.javascript.push('Lodash');
    if (html.includes('axios')) tech.javascript.push('Axios');
    if (html.includes('moment.js')) tech.javascript.push('Moment.js');
    
    // CSS frameworks
    if (html.includes('bootstrap')) tech.css.push('Bootstrap');
    if (html.includes('tailwind')) tech.css.push('Tailwind CSS');
    if (html.includes('bulma')) tech.css.push('Bulma');
    if (html.includes('materialize')) tech.css.push('Materialize');
    
    // Font services
    if (html.includes('fonts.googleapis.com')) tech.fonts.push('Google Fonts');
    if (html.includes('use.typekit.net')) tech.fonts.push('Adobe Fonts');
    
    return tech;
  }

  /**
   * Detect if site is a Single Page Application
   */
  detectSPA(html, dynamicHtml = null) {
    const signals = {
      isSPA: false,
      confidence: 0,
      indicators: []
    };
    
    // Check for minimal initial HTML
    const bodyContent = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || '';
    const textContent = bodyContent.replace(/<[^>]+>/g, '').trim();
    
    if (textContent.length < 100) {
      signals.confidence += 30;
      signals.indicators.push('minimal initial content');
    }
    
    // Check for root mounting points
    if (html.includes('id="root"') || html.includes('id="app"')) {
      signals.confidence += 25;
      signals.indicators.push('root mounting point');
    }
    
    // Check for heavy JavaScript bundles
    const scriptTags = html.match(/<script[^>]*>/g) || [];
    if (scriptTags.length > 10) {
      signals.confidence += 20;
      signals.indicators.push('many script tags');
    }
    
    // Check for routing libraries
    if (html.includes('react-router') || html.includes('vue-router')) {
      signals.confidence += 25;
      signals.indicators.push('client-side routing');
    }
    
    // Compare static vs dynamic content if available
    if (dynamicHtml && dynamicHtml.length > html.length * 1.5) {
      signals.confidence += 30;
      signals.indicators.push('significant dynamic content');
    }
    
    signals.isSPA = signals.confidence >= 50;
    
    return signals;
  }

  /**
   * Get framework-specific optimization hints
   */
  getOptimizationHints(framework) {
    const hints = {
      'react': {
        selectors: ['[data-reactroot]', '.react-component'],
        waitFor: 'networkidle',
        requiresJS: true,
        tips: ['Wait for React hydration', 'Check for lazy-loaded components']
      },
      'vue': {
        selectors: ['[data-v-]', '#app'],
        waitFor: 'networkidle',
        requiresJS: true,
        tips: ['Wait for Vue mounting', 'Handle v-if conditional rendering']
      },
      'next.js': {
        selectors: ['#__next'],
        waitFor: 'domcontentloaded',
        requiresJS: false, // SSR/SSG
        tips: ['Can use static fetch for SSG pages', 'Check _next/data for JSON']
      },
      'wordpress': {
        selectors: ['.wp-content', 'article', '.post'],
        waitFor: 'domcontentloaded',
        requiresJS: false,
        tips: ['Use REST API if available', 'Check for wp-json endpoint']
      },
      'shopify': {
        selectors: ['.product', '.collection', '[data-product-id]'],
        waitFor: 'networkidle',
        requiresJS: true,
        tips: ['Check for Shopify AJAX API', 'Handle dynamic pricing']
      },
      'unknown': {
        selectors: ['main', 'article', '.content', '#content'],
        waitFor: 'networkidle',
        requiresJS: false,
        tips: ['Try static fetch first', 'Use generic selectors']
      }
    };
    
    return hints[framework] || hints['unknown'];
  }
}

module.exports = { FrameworkDetector };