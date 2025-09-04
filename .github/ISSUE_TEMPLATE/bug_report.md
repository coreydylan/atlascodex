---
name: Bug report
about: Create a report to help us improve Atlas Codex
title: '[BUG] '
labels: bug
assignees: ''
---

## 🐛 Bug Description
A clear and concise description of what the bug is.

## 🔄 To Reproduce
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## 🎯 Expected Behavior
A clear and concise description of what you expected to happen.

## 📱 Actual Behavior
What actually happened instead.

## 🖼️ Screenshots
If applicable, add screenshots to help explain your problem.

## 🌐 Environment
**Website URL**: The URL you were trying to extract from
**Extraction Request**: 
```json
{
  "url": "https://example.com",
  "extractionInstructions": "your instructions here",
  "UNIFIED_EXTRACTOR_ENABLED": true
}
```

**Response Received**:
```json
{
  "paste": "response here"
}
```

**System Info**:
- OS: [e.g. iOS, Windows, macOS]
- Browser: [e.g. chrome, safari]
- Version: [e.g. 22]

## 🔍 Additional Context
Add any other context about the problem here.

## 🧪 API Test Results
Please test the API directly and include results:

```bash
curl -X POST "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev/api/extract" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: test-key-123" \
  -d '{
    "url": "YOUR_URL_HERE",
    "extractionInstructions": "YOUR_INSTRUCTIONS", 
    "UNIFIED_EXTRACTOR_ENABLED": true
  }'
```

**API Response**:
```json
{
  "paste": "api response here"
}
```

## ✅ Checklist
- [ ] I have tested this with the direct API
- [ ] I have checked if this issue already exists
- [ ] I have provided a clear reproduction case
- [ ] I have included the exact URL and extraction instructions