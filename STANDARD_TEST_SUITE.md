# Atlas Codex Standard Test Suite

This document defines the 3 core tests we use to validate system functionality at each development phase.

## Test 1: VMOTA Staff Page (Primary Validation)
**Purpose**: Validates the core use case that drove the entire redesign
**URL**: `https://vmota.org/people/`
**Expected**: Extract 6 staff members with clean data, no board contamination

### Request Payload:
```json
{
  "url": "https://vmota.org/people/",
  "formats": ["structured"],
  "extractionInstructions": "Extract staff member information including name, title, and bio from the VMOTA staff page",
  "outputSchema": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "title": {"type": "string"},
        "bio": {"type": "string"}
      },
      "required": ["name"]
    }
  }
}
```

### Success Criteria:
- [x] **Data Quality**: Extract exactly 6 staff members:
  - Katrina Bruins, Executive Director
  - Lauryn Dove, Administrative Assistant  
  - Joel Ellazar, Marketing Specialist
  - Armando Garcia, Curatorial and Education Manager
  - Jane La Motte, Website Manager
  - Nilufer Leuthold, Director of Development
- [x] **No Contamination**: Zero "Board of Directors" entries in results
- [x] **Clean Separation**: Names, titles, and bios properly separated (no mashed together text)
- [x] **Evaluation Score**: Overall confidence ≥ 0.8
- [x] **Pattern Tests**: Pass ≥ 6/7 generic pattern tests
- [x] **Architecture**: System uses two-pass execution with DOM processing

### Command Line Test:
```bash
curl -X POST https://your-api-endpoint/api/extract \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key-123" \
  -d @test_payloads/vmota_test.json
```

---

## Test 2: Complex University Staff Page (Stress Test)
**Purpose**: Tests system on a more complex page with multiple staff sections
**URL**: `https://www.stanford.edu/academics/departments/`
**Expected**: Handle complex layouts, multiple sections, diverse content

### Request Payload:
```json
{
  "url": "https://www.stanford.edu/academics/departments/",
  "formats": ["structured"],  
  "extractionInstructions": "Extract academic staff and faculty information including names, titles, and departments",
  "outputSchema": {
    "type": "array",
    "items": {
      "type": "object", 
      "properties": {
        "name": {"type": "string"},
        "title": {"type": "string"},
        "department": {"type": "string"},
        "bio": {"type": "string"}
      },
      "required": ["name"]
    }
  }
}
```

### Success Criteria:
- [x] **Scalability**: Extract ≥10 staff/faculty members  
- [x] **Navigation Filtering**: No navigation menus in results
- [x] **Department Handling**: Properly categorize by department when possible
- [x] **Performance**: Complete within budget constraints (≤20 seconds)
- [x] **Block Classification**: BlockClassifier successfully filters navigation/footer content
- [x] **Error Resilience**: No crashes on complex HTML structure

### Command Line Test:
```bash
curl -X POST https://your-api-endpoint/api/extract \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key-123" \
  -d @test_payloads/stanford_test.json
```

---

## Test 3: Error Handling & Edge Cases (Robustness Test)
**Purpose**: Validates system resilience and fallback mechanisms
**URL**: `https://example.com/nonexistent-page` (intentionally broken)
**Expected**: Graceful error handling, proper fallbacks

### Request Payload:
```json
{
  "url": "https://httpstat.us/404",
  "formats": ["structured"],
  "extractionInstructions": "Extract any people information if available", 
  "outputSchema": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "title": {"type": "string"}
      }
    }
  }
}
```

### Success Criteria:
- [x] **Error Handling**: Returns proper error response (not crash)
- [x] **Error Messages**: Clear, helpful error message
- [x] **Status Codes**: Correct HTTP status code (400/404/500)
- [x] **Logging**: Error properly logged for debugging
- [x] **Fallback Chain**: System attempts fallback strategies
- [x] **Recovery**: System remains stable for subsequent requests

### Additional Edge Cases to Test:
1. **Malformed JSON**: Invalid extractionInstructions
2. **Missing Schema**: No outputSchema provided
3. **Invalid URL**: Completely malformed URL
4. **Timeout**: Very slow-loading page
5. **Empty Page**: Page with no extractable content

### Command Line Test:
```bash
# Test 404 error
curl -X POST https://your-api-endpoint/api/extract \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key-123" \
  -d @test_payloads/error_test.json

# Test malformed request  
curl -X POST https://your-api-endpoint/api/extract \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key-123" \
  -d '{"invalid": "json without required fields"}'
```

---

## Test Execution Workflow

### Quick Validation (5 minutes):
```bash
# Run just VMOTA test to verify core functionality
./run_test.sh vmota
```

### Full Validation (15 minutes):
```bash  
# Run all 3 tests in sequence
./run_test.sh all
```

### Continuous Integration:
```bash
# Run after each major change
./run_test.sh all --verbose --save-results
```

## Test Result Format

Each test should return results in this format:

```json
{
  "test_name": "vmota_staff_extraction",
  "passed": true,
  "score": 0.87,
  "details": {
    "extracted_count": 6,
    "expected_count": 6,
    "pattern_tests_passed": 7,
    "pattern_tests_total": 7,
    "evaluation_score": 0.87,
    "execution_time_ms": 8420,
    "architecture_used": "two_pass_extraction"
  },
  "issues": [],
  "raw_response": {...}
}
```

## Success Thresholds

**System is considered HEALTHY when:**
- VMOTA test: ≥85% success rate (extracts ≥5/6 staff members)  
- Stanford test: ≥70% success rate (extracts ≥7/10 staff members)
- Error test: 100% graceful error handling (no crashes)

**System needs attention when:**
- Any test fails completely
- VMOTA success rate drops below 80%  
- Pattern tests pass rate drops below 75%
- Execution time exceeds 30 seconds consistently

---

*This test suite evolves with the system. Update test criteria as new phases are added.*