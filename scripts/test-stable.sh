#!/bin/bash
# Golden tests for stable functionality
# Usage: ./test-stable.sh [API_URL] [API_KEY]

set -e

API_URL="${1:-https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev}"
API_KEY="${2:-test-key-123}"

echo "🧪 Running Atlas Codex Stable Tests"
echo "   API: $API_URL"
echo "   Key: ${API_KEY:0:10}..."
echo ""

FAILED=0

# Test 1: Health Check
echo -n "1. Health Check... "
START=$(date +%s)
HEALTH=$(curl -s "$API_URL/health" | jq -r '.status' 2>/dev/null || echo "failed")
END=$(date +%s)
DURATION=$((END - START))

if [ "$HEALTH" = "healthy" ] && [ $DURATION -lt 5 ]; then
  echo "✅ PASS (${DURATION}s)"
else
  echo "❌ FAIL (status: $HEALTH, time: ${DURATION}s)"
  FAILED=$((FAILED + 1))
fi

# Test 2: VMOTA Team Extraction (should return 6)
echo -n "2. VMOTA Team Extraction... "
VMOTA_COUNT=$(curl -s "$API_URL/api/ai/process" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "prompt": "extract team members from vmota.org/people",
    "autoExecute": true,
    "UNIFIED_EXTRACTOR_ENABLED": true
  }' 2>/dev/null | jq '.result.data | length' 2>/dev/null || echo "0")

if [ "$VMOTA_COUNT" -eq 6 ] 2>/dev/null; then
  echo "✅ PASS (6 members)"
else
  echo "❌ FAIL (got $VMOTA_COUNT members, expected 6)"
  FAILED=$((FAILED + 1))
fi

# Test 3: Navigation Detection (SD Union Tribune)
echo -n "3. Navigation-Aware Extraction... "
SD_COUNT=$(curl -s "$API_URL/api/ai/process" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "input": "get all headlines from sandiegouniontribune.com",
    "autoExecute": true,
    "UNIFIED_EXTRACTOR_ENABLED": true
  }' 2>/dev/null | jq '.result.data | length' 2>/dev/null || echo "0")

if [ "$SD_COUNT" -gt 40 ] 2>/dev/null; then
  echo "✅ PASS ($SD_COUNT headlines)"
else
  echo "⚠️  WARN (got $SD_COUNT headlines, expected 50+)"
  # Don't fail on this - site might have changed
fi

# Test 4: API Key Validation
echo -n "4. API Key Validation... "
INVALID_RESPONSE=$(curl -s "$API_URL/api/extract" \
  -H "Content-Type: application/json" \
  -H "x-api-key: invalid-key-test" \
  -d '{"url": "test"}' 2>/dev/null | jq -r '.error' 2>/dev/null || echo "")

if [ "$INVALID_RESPONSE" = "Unauthorized" ]; then
  echo "✅ PASS (rejects invalid keys)"
else
  echo "❌ FAIL (security issue - accepts invalid keys)"
  FAILED=$((FAILED + 1))
fi

# Test 5: Response Time Check
echo -n "5. Performance Test... "
START=$(date +%s)
curl -s "$API_URL/api/extract" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "url": "https://example.com",
    "extractionInstructions": "Extract the heading",
    "UNIFIED_EXTRACTOR_ENABLED": true
  }' > /dev/null 2>&1
END=$(date +%s)
PERF_TIME=$((END - START))

if [ $PERF_TIME -lt 30 ]; then
  echo "✅ PASS (${PERF_TIME}s)"
else
  echo "⚠️  WARN (${PERF_TIME}s - might be slow)"
fi

echo ""
echo "========================================="
if [ $FAILED -eq 0 ]; then
  echo "✅ ALL CRITICAL TESTS PASSED!"
  echo "System is operating normally."
  exit 0
else
  echo "❌ $FAILED CRITICAL TESTS FAILED!"
  echo "System may need rollback. Check docs/RUNBOOKS/emergency-rollback.md"
  exit 1
fi