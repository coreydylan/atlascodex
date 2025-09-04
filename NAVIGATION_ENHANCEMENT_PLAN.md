# Navigation-Enhanced Unified Extractor

## Current State
- ✅ Single-page unified extraction working perfectly
- ✅ Multi-page crawling infrastructure exists (`performCrawl`)
- ❌ Gap: Unified extractor doesn't leverage crawling capabilities

## Enhanced Architecture Plan

### 1. Multi-Page Unified Extraction
```javascript
async function performUnifiedCrawlExtraction(params) {
  // Step 1: Discover all relevant pages
  const crawlResult = await performCrawl(params.jobId, {
    ...params,
    maxPages: params.maxPages || 50,
    maxDepth: params.maxDepth || 3
  });
  
  // Step 2: Apply unified extractor to each page
  const extractedData = [];
  for (const page of crawlResult.pages) {
    const pageResult = await processWithUnifiedExtractor(page.content, {
      ...params,
      url: page.url
    });
    extractedData.push(...pageResult.data);
  }
  
  // Step 3: Deduplicate and merge results
  return deduplicateAndMerge(extractedData);
}
```

### 2. Smart Navigation Patterns

#### Pattern Recognition
- **Pagination**: `Next`, `Page 2`, `More →`
- **Category Navigation**: `View All`, `See More`, `Browse Categories`
- **Detail Links**: `Read More`, `View Profile`, `Learn More`

#### Navigation Types
1. **Horizontal Navigation**: Pagination (1,2,3...)
2. **Vertical Navigation**: Category drilling (Products → Electronics → Phones)
3. **Detail Navigation**: List → Individual item pages
4. **Search Results**: Multiple result pages

### 3. Use Cases We Could Support

#### Team Directory with Individual Profiles
```
Request: "Get all team members with full bios from company.com/team"
Current: Extracts summary info from team overview page
Enhanced: Follows each person's profile link for complete bio
```

#### Product Catalog Navigation  
```
Request: "Extract all products from store.com/products"
Current: Gets products visible on first page only
Enhanced: Navigates through all pagination pages automatically
```

#### Multi-Section Extraction
```
Request: "Get all courses from university.edu/catalog" 
Current: Limited to courses on main catalog page
Enhanced: Navigates into each department/category automatically
```

### 4. Implementation Approach

#### Option A: Crawl-First Architecture
1. Discover all relevant pages via crawling
2. Apply unified extractor to each discovered page
3. Merge and deduplicate results

#### Option B: Pattern-Aware Navigation
1. Unified extractor identifies navigation elements
2. Follows pagination/detail links intelligently  
3. Continues until no more relevant pages

#### Option C: Hybrid Approach (Recommended)
1. Initial unified extraction on entry page
2. AI detects if more pages likely exist
3. Selective crawling based on extraction patterns
4. Continued unified extraction until complete

### 5. Enhanced User Interface

#### Current
```
"extract name, role, and bio from vmota.org/people"
```

#### Enhanced
```
"extract all team members including full profiles from vmota.org/people"
// Auto-detects individual profile pages and navigates to them

"get all products from store.com (navigate through all pages)"
// Explicitly requests multi-page navigation

"extract course catalog from university.edu - follow all department links"  
// Category-based navigation request
```

## Implementation Priority

### Phase 1: Basic Multi-Page Support
- Integrate existing `performCrawl` with unified extractor
- Support explicit multi-page requests
- Simple pagination following

### Phase 2: Smart Navigation Detection  
- AI identifies when single page has incomplete data
- Automatic detection of "more details" links
- Intelligent follow-up page discovery

### Phase 3: Advanced Pattern Recognition
- Category/section-based navigation
- Search result pagination
- Dynamic content loading detection

## Technical Benefits

1. **Universal Coverage**: No content left behind due to pagination
2. **Complete Data**: Full details from individual item pages
3. **Scalable**: Works for small sites (5 pages) to large catalogs (500+ pages)
4. **Intelligent**: Only navigates when additional value detected
5. **Efficient**: Avoids unnecessary crawling when single page sufficient