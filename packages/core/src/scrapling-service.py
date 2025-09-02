"""
Atlas Codex - Scrapling Service
Adaptive web scraping with self-healing selectors
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from scrapling import Fetcher, StealthyFetcher, AsyncFetcher
import json
import asyncio
from datetime import datetime
import hashlib

app = FastAPI(title="Atlas Codex Scrapling Service")

# Enable CORS for internal API calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScraplingRequest(BaseModel):
    url: str
    strategy: str = Field(default="adaptive", description="Scraping strategy: adaptive, stealth, or standard")
    selectors: Optional[Dict[str, str]] = Field(default=None, description="CSS/XPath selectors to extract")
    auto_save: bool = Field(default=True, description="Enable adaptive selector saving")
    javascript: bool = Field(default=False, description="Enable JavaScript rendering")
    timeout: int = Field(default=30000, description="Timeout in milliseconds")
    headers: Optional[Dict[str, str]] = Field(default=None, description="Custom headers")
    
class ScraplingResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]]
    content: Optional[str]
    metadata: Dict[str, Any]
    adaptive_selectors: Optional[Dict[str, str]]
    cost: float
    response_time: float
    error: Optional[str]

class AdaptiveSelector(BaseModel):
    original: str
    adapted: Optional[str]
    confidence: float
    last_updated: str

# Store for adaptive selectors (in production, use DynamoDB)
adaptive_store: Dict[str, Dict[str, AdaptiveSelector]] = {}

def get_domain_hash(url: str) -> str:
    """Generate consistent hash for domain"""
    from urllib.parse import urlparse
    domain = urlparse(url).netloc
    return hashlib.md5(domain.encode()).hexdigest()

@app.post("/scrape", response_model=ScraplingResponse)
async def scrape(request: ScraplingRequest):
    """
    Main scraping endpoint with adaptive capabilities
    """
    start_time = datetime.now()
    
    try:
        # Select appropriate fetcher based on strategy
        if request.strategy == "stealth":
            fetcher = StealthyFetcher(
                headless=True,
                disable_images=True,
                extra_headers=request.headers or {}
            )
        elif request.strategy == "async":
            fetcher = AsyncFetcher()
        else:
            fetcher = Fetcher()
        
        # Fetch the page
        if request.strategy == "async":
            page = await fetcher.fetch(request.url, timeout=request.timeout)
        else:
            fetch_kwargs = {"timeout": request.timeout}
            if request.strategy == "stealth" and request.javascript:
                fetch_kwargs["render_js"] = True
            page = fetcher.fetch(request.url, **fetch_kwargs)
        
        # Extract data using selectors
        extracted_data = {}
        adaptive_selectors = {}
        
        if request.selectors:
            domain_hash = get_domain_hash(request.url)
            domain_selectors = adaptive_store.get(domain_hash, {})
            
            for key, selector in request.selectors.items():
                try:
                    # Try original selector first
                    elements = page.css(selector, auto_save=request.auto_save)
                    
                    if not elements and domain_selectors.get(key):
                        # Try adaptive selector if original fails
                        adaptive_selector = domain_selectors[key].adapted
                        if adaptive_selector:
                            elements = page.css(adaptive_selector)
                            adaptive_selectors[key] = adaptive_selector
                    
                    if elements:
                        # Extract text or attributes
                        if len(elements) == 1:
                            extracted_data[key] = elements[0].text
                        else:
                            extracted_data[key] = [el.text for el in elements]
                        
                        # Update adaptive store if selector changed
                        if request.auto_save and key in adaptive_selectors:
                            if domain_hash not in adaptive_store:
                                adaptive_store[domain_hash] = {}
                            
                            adaptive_store[domain_hash][key] = AdaptiveSelector(
                                original=selector,
                                adapted=adaptive_selectors[key],
                                confidence=0.95,
                                last_updated=datetime.now().isoformat()
                            )
                except Exception as e:
                    extracted_data[key] = f"Error: {str(e)}"
        
        # Calculate response metrics
        response_time = (datetime.now() - start_time).total_seconds()
        
        # Estimate cost (based on strategy and features used)
        cost = 0.0001  # Base cost
        if request.strategy == "stealth":
            cost += 0.0004
        if request.javascript:
            cost += 0.0002
        
        return ScraplingResponse(
            success=True,
            data=extracted_data if extracted_data else None,
            content=page.html if not request.selectors else None,
            metadata={
                "url": request.url,
                "strategy": request.strategy,
                "title": page.title,
                "status_code": getattr(page, 'status_code', 200),
                "content_length": len(page.html),
                "adaptive_enabled": request.auto_save
            },
            adaptive_selectors=adaptive_selectors if adaptive_selectors else None,
            cost=cost,
            response_time=response_time,
            error=None
        )
        
    except Exception as e:
        response_time = (datetime.now() - start_time).total_seconds()
        return ScraplingResponse(
            success=False,
            data=None,
            content=None,
            metadata={"url": request.url, "strategy": request.strategy},
            adaptive_selectors=None,
            cost=0,
            response_time=response_time,
            error=str(e)
        )

@app.get("/adaptive-selectors/{domain_hash}")
async def get_adaptive_selectors(domain_hash: str):
    """
    Retrieve stored adaptive selectors for a domain
    """
    selectors = adaptive_store.get(domain_hash, {})
    return {
        "domain_hash": domain_hash,
        "selectors": {k: v.dict() for k, v in selectors.items()},
        "count": len(selectors)
    }

@app.post("/adaptive-selectors/update")
async def update_adaptive_selector(domain_hash: str, key: str, selector: AdaptiveSelector):
    """
    Manually update an adaptive selector
    """
    if domain_hash not in adaptive_store:
        adaptive_store[domain_hash] = {}
    
    adaptive_store[domain_hash][key] = selector
    return {"success": True, "message": "Adaptive selector updated"}

@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy",
        "service": "scrapling",
        "adaptive_domains": len(adaptive_store),
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)