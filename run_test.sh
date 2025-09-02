#!/bin/bash

# Atlas Codex Standard Test Runner
# Usage: ./run_test.sh [vmota|stanford|error|all] [--verbose] [--save-results]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_ENDPOINT="${API_ENDPOINT:-http://localhost:3000}"
API_KEY="${API_KEY:-test-key-123}"
RESULTS_DIR="test_results"
VERBOSE=false
SAVE_RESULTS=false

# Parse arguments
TEST_TYPE="$1"
shift || true

while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose)
      VERBOSE=true
      shift
      ;;
    --save-results)
      SAVE_RESULTS=true
      mkdir -p "$RESULTS_DIR"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Utility functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
  echo -e "${RED}[FAIL]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

# Function to run a single test
run_test() {
  local test_name="$1"
  local payload_file="test_payloads/${test_name}_test.json"
  local timestamp=$(date +%Y%m%d_%H%M%S)
  
  log_info "Running $test_name test..."
  
  if [[ ! -f "$payload_file" ]]; then
    log_error "Payload file not found: $payload_file"
    return 1
  fi
  
  # Make the API call
  local response_file="temp_response_${test_name}.json"
  local start_time=$(date +%s)
  
  if curl -s -X POST "$API_ENDPOINT/api/extract" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d @"$payload_file" \
    -o "$response_file" \
    -w "%{http_code}" > temp_http_code; then
    
    local http_code=$(cat temp_http_code)
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Check if request succeeded
    if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
      log_success "$test_name test completed (${duration}s, HTTP $http_code)"
      
      # Analyze results based on test type
      analyze_test_results "$test_name" "$response_file" "$duration"
      
      # Save results if requested
      if [[ "$SAVE_RESULTS" == "true" ]]; then
        cp "$response_file" "$RESULTS_DIR/${test_name}_${timestamp}.json"
        log_info "Results saved to $RESULTS_DIR/${test_name}_${timestamp}.json"
      fi
      
    else
      log_error "$test_name test failed with HTTP $http_code"
      if [[ "$test_name" == "error" ]]; then
        log_success "Error test correctly returned error status (this is expected)"
        return 0
      fi
      return 1
    fi
  else
    log_error "$test_name test failed - could not reach API"
    return 1
  fi
  
  # Cleanup
  rm -f temp_http_code "$response_file"
}

# Function to analyze test results
analyze_test_results() {
  local test_name="$1"
  local response_file="$2"  
  local duration="$3"
  
  if [[ ! -f "$response_file" ]]; then
    log_error "Response file not found: $response_file"
    return 1
  fi
  
  # Parse JSON response (basic analysis)
  if command -v jq >/dev/null 2>&1; then
    local data_count=$(jq -r '.data | length // 0' "$response_file" 2>/dev/null || echo "0")
    local success=$(jq -r '.success // false' "$response_file" 2>/dev/null || echo "false")
    local evaluation_score=$(jq -r '.metadata.evaluation.overall_score // 0' "$response_file" 2>/dev/null || echo "0")
    
    log_info "Analysis for $test_name:"
    echo "  • Success: $success"
    echo "  • Data count: $data_count"
    echo "  • Evaluation score: $evaluation_score"
    echo "  • Duration: ${duration}s"
    
    # Test-specific validation
    case "$test_name" in
      vmota)
        if [[ "$data_count" -ge 5 ]]; then
          log_success "VMOTA extracted $data_count staff members (≥5 expected)"
        else
          log_warning "VMOTA only extracted $data_count staff members (≥5 expected)"
        fi
        
        if (( $(echo "$evaluation_score > 0.8" | bc -l) )); then
          log_success "VMOTA evaluation score: $evaluation_score (>0.8)"
        else
          log_warning "VMOTA evaluation score: $evaluation_score (target >0.8)"
        fi
        ;;
      stanford)
        if [[ "$data_count" -ge 7 ]]; then
          log_success "Stanford extracted $data_count staff members (≥7 expected)"
        else
          log_warning "Stanford only extracted $data_count staff members (≥7 expected)"
        fi
        ;;
      error)
        if [[ "$success" == "false" ]]; then
          log_success "Error test correctly failed (expected behavior)"
        else
          log_warning "Error test unexpectedly succeeded"
        fi
        ;;
    esac
    
    # Show verbose output if requested
    if [[ "$VERBOSE" == "true" ]]; then
      echo -e "\n${BLUE}Full Response:${NC}"
      jq . "$response_file"
    fi
  else
    log_warning "jq not installed - skipping detailed analysis"
    if [[ "$VERBOSE" == "true" ]]; then
      echo -e "\n${BLUE}Raw Response:${NC}"
      cat "$response_file"
    fi
  fi
}

# Main execution
main() {
  log_info "Atlas Codex Test Suite"
  log_info "API Endpoint: $API_ENDPOINT"
  log_info "Testing against: $TEST_TYPE"
  echo
  
  case "$TEST_TYPE" in
    vmota)
      run_test "vmota"
      ;;
    stanford) 
      run_test "stanford"
      ;;
    error)
      run_test "error"
      ;;
    all)
      log_info "Running all tests..."
      echo
      
      local failures=0
      
      if ! run_test "vmota"; then
        ((failures++))
      fi
      echo
      
      if ! run_test "stanford"; then
        ((failures++))
      fi
      echo
      
      if ! run_test "error"; then
        ((failures++))
      fi
      echo
      
      if [[ $failures -eq 0 ]]; then
        log_success "All tests passed! ✅"
      else
        log_error "$failures test(s) failed"
        exit 1
      fi
      ;;
    *)
      echo "Usage: $0 [vmota|stanford|error|all] [--verbose] [--save-results]"
      echo
      echo "Examples:"
      echo "  $0 vmota                    # Run VMOTA test"
      echo "  $0 all --verbose           # Run all tests with detailed output"
      echo "  $0 stanford --save-results # Run Stanford test and save results"
      exit 1
      ;;
  esac
}

# Check dependencies
if ! command -v curl >/dev/null 2>&1; then
  log_error "curl is required but not installed"
  exit 1
fi

if ! command -v bc >/dev/null 2>&1; then
  log_warning "bc not installed - some numeric comparisons may not work"
fi

# Run main function
main