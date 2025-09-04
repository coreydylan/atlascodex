# GPT-5 Prompt Engineering Fix Summary

## Problem Identified
GPT-4 was correctly extracting news headlines from NYTimes while GPT-5 was returning navigation items instead of actual article headlines.

## Root Cause
The GPT-5 implementation in `local-backend.js` was using minimal prompting (5 lines) compared to GPT-4's detailed prompting (25+ lines) in `evidence-first-bridge.js`.

### Key Differences Found:

**GPT-4 Prompt Structure:**
- Detailed system instructions with 4 main tasks
- Critical extraction rules including pattern recognition
- Specific guidance to distinguish content from navigation
- Quality check instructions
- Schema generation guidance

**GPT-5 Original Prompt:**
```javascript
'You are a precise data extraction system. Extract the requested information and return it as clean JSON.'
```

## Solution Implemented
Updated GPT-5 prompts to match GPT-4's comprehensive approach, including:

1. **Pattern Recognition Instructions**: Added guidance to identify repeating structural patterns
2. **Navigation Disambiguation**: Explicit rule stating "When asked for 'headlines' or 'articles', extract actual news/article content, NOT navigation items"
3. **Complete Extraction**: Instructions to extract ALL instances, not just first few
4. **Quality Checks**: Verification steps before returning data

## Updated GPT-5 Prompt Structure:
```javascript
messages: [
  {
    role: 'system',
    content: `You are a unified data extraction and schema generation system. Your task is to:
    1. ANALYZE the user's extraction request to understand what type of items they want
    2. IDENTIFY repeating structural patterns in the HTML that match the user's request
    3. GENERATE an appropriate JSON Schema for the requested data type
    4. EXTRACT ALL instances of the identified pattern from the HTML content
    
    CRITICAL INSTRUCTIONS FOR COMPLETE EXTRACTION:
    [... pattern recognition guidance ...]
    
    EXTRACTION RULES:
    1. When asked for "headlines" or "articles", extract actual news/article content, NOT navigation items
    [... additional rules ...]
    
    QUALITY CHECK:
    - Have you extracted ALL instances, not just the first few?
    - Are these actual content items, not navigation or UI elements?
    - Does your output match the user's specific request?`
  },
  {
    role: 'user',
    content: `USER REQUEST: ${extractionInstructions}
    
    HTML CONTENT:
    ${cleanedHtml}
    
    Extract the requested data and return as JSON.`
  }
]
```

## Test Results
After implementing the prompt updates:
- NYTimes headlines extraction now properly identifies article content vs navigation
- VMota people extraction completed successfully
- Example.com basic extraction working correctly

## Files Modified
- `/Users/coreydylan/Developer/atlas-gpt5-migration/local-backend.js` (lines 69-83 and 285-299)

## Next Steps
1. Apply similar prompt engineering to production GPT-5 implementation
2. Run full test suite to verify all extraction cases pass
3. Monitor cost impact (prompts increased from ~500 tokens to ~1500 tokens)