"""
Modal.com Browser Worker for Atlas Codex
This handles the heavy browser work serverlessly
"""

import modal
import json
from playwright.async_api import async_playwright
import hashlib
from datetime import datetime

# Create Modal app
app = modal.App("atlas-codex-browsers")

# Define image with Playwright installed
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "playwright==1.40.0",
    "httpx",
    "beautifulsoup4",
    "lxml"
).run_commands(
    "playwright install-deps chromium",
    "playwright install chromium"
)

@app.function(
    image=image,
    timeout=60,
    memory=2048,
    cpu=2.0,
    concurrency_limit=100,
    retries=modal.Retries(max_retries=2)
)
async def scrape_page(url: str, options: dict = {}):
    """
    Scrape a single page with Playwright
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox'
            ]
        )
        
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent=options.get('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        )
        
        page = await context.new_page()
        
        # Block ads if requested
        if options.get('blockAds', True):
            await page.route('**/*', lambda route: route.abort() 
                if any(ad in route.request.url for ad in ['doubleclick', 'google-analytics', 'facebook'])
                else route.continue_()
            )
        
        # Navigate to page
        response = await page.goto(url, wait_until='networkidle', timeout=30000)
        
        # Wait if specified
        if wait_time := options.get('waitFor'):
            await page.wait_for_timeout(wait_time)
        
        # Extract data
        html = await page.content()
        markdown = await page.evaluate('() => document.body.innerText')
        
        # Get metadata
        metadata = await page.evaluate('''() => ({
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.content,
            language: document.documentElement.lang,
            author: document.querySelector('meta[name="author"]')?.content
        })''')
        
        # Get links
        links = await page.evaluate('''() => 
            Array.from(document.querySelectorAll('a')).map(a => ({
                href: a.href,
                text: a.textContent.trim()
            }))
        ''')
        
        # Take screenshot if requested
        screenshot = None
        if 'screenshot' in options.get('formats', []):
            screenshot = await page.screenshot(full_page=True)
        
        await browser.close()
        
        # Create evidence
        content_hash = hashlib.sha256(html.encode()).hexdigest()
        
        return {
            'url': url,
            'status': response.status,
            'metadata': metadata,
            'html': html if 'html' in options.get('formats', []) else None,
            'markdown': markdown if 'markdown' in options.get('formats', []) else None,
            'links': links if 'links' in options.get('formats', []) else None,
            'screenshot': screenshot.hex() if screenshot else None,
            'evidence': {
                'hash': content_hash,
                'timestamp': datetime.utcnow().isoformat(),
                'browserUsed': True
            }
        }

@app.function(
    image=image,
    timeout=300,
    memory=4096,
    cpu=4.0
)
async def crawl_site(start_url: str, options: dict = {}):
    """
    Crawl multiple pages from a starting URL
    """
    max_pages = options.get('maxPages', 10)
    include_patterns = options.get('includePatterns', [])
    exclude_patterns = options.get('excludePatterns', [])
    
    visited = set()
    to_visit = [start_url]
    results = []
    
    while to_visit and len(results) < max_pages:
        url = to_visit.pop(0)
        
        if url in visited:
            continue
            
        visited.add(url)
        
        # Check patterns
        if exclude_patterns and any(pattern in url for pattern in exclude_patterns):
            continue
        if include_patterns and not any(pattern in url for pattern in include_patterns):
            continue
        
        try:
            # Scrape the page
            page_data = await scrape_page.remote(url, options)
            results.append({
                'url': url,
                'status': 'success',
                'data': page_data
            })
            
            # Add discovered links
            if options.get('followLinks') and page_data.get('links'):
                for link in page_data['links']:
                    if link['href'].startswith(start_url) and link['href'] not in visited:
                        to_visit.append(link['href'])
                        
        except Exception as e:
            results.append({
                'url': url,
                'status': 'failed',
                'error': str(e)
            })
    
    return {
        'stats': {
            'totalPages': len(results),
            'successfulPages': sum(1 for r in results if r['status'] == 'success'),
            'failedPages': sum(1 for r in results if r['status'] == 'failed')
        },
        'pages': results
    }

@app.local_entrypoint()
async def test():
    """Test the worker locally"""
    result = await scrape_page.remote(
        "https://example.com",
        {"formats": ["markdown", "links"]}
    )
    print(json.dumps(result, indent=2))

# Deploy with: modal deploy workers/browser-worker.py