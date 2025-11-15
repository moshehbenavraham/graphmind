#!/bin/bash

###############################################################################
# Production Smoke Tests for Feature 008: Voice Query Input & Graph Querying
#
# Tests critical production endpoints to verify system is operational
# Run after deployment to validate Feature 008 functionality
#
# Usage:
#   bash tests/smoke/production-voice-query-smoke-tests.sh
#
# Environment Variables:
#   API_URL - Production API URL (default: https://graphmind-api.apex-web-services-llc-0d4.workers.dev)
#   JWT_TOKEN - Valid JWT token for authentication (required)
###############################################################################

# Note: Not using 'set -e' to ensure all tests run even if some fail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-https://graphmind-api.apex-web-services-llc-0d4.workers.dev}"
JWT_TOKEN="${JWT_TOKEN:-}"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test results
declare -a FAILED_TESTS

###############################################################################
# Helper Functions
###############################################################################

print_header() {
  echo ""
  echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
  echo ""
}

print_test() {
  echo -e "${YELLOW}→${NC} Testing: $1"
}

print_pass() {
  echo -e "${GREEN}✓${NC} PASS: $1"
  ((TESTS_PASSED++))
}

print_fail() {
  echo -e "${RED}✗${NC} FAIL: $1"
  echo -e "${RED}  Reason: $2${NC}"
  ((TESTS_FAILED++))
  FAILED_TESTS+=("$1: $2")
}

print_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} WARNING: $1"
}

run_test() {
  ((TESTS_RUN++))
}

###############################################################################
# Prerequisite Checks
###############################################################################

check_prerequisites() {
  print_header "Prerequisite Checks"

  # Check curl is installed
  if ! command -v curl &> /dev/null; then
    echo -e "${RED}✗ curl is not installed${NC}"
    exit 1
  fi
  print_pass "curl is installed"

  # Check jq is installed (optional, for JSON parsing)
  if ! command -v jq &> /dev/null; then
    print_warning "jq is not installed (optional, used for prettier JSON output)"
  else
    print_pass "jq is installed"
  fi

  # Check JWT token is provided
  if [ -z "$JWT_TOKEN" ]; then
    print_warning "JWT_TOKEN not provided - authentication tests will be skipped"
    echo -e "${YELLOW}  Set JWT_TOKEN environment variable to test authenticated endpoints${NC}"
  else
    print_pass "JWT_TOKEN provided"
  fi

  print_info "API URL: $API_URL"
}

###############################################################################
# Test 1: Health Check
###############################################################################

test_health_check() {
  run_test
  print_test "API Health Check"

  RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/health" 2>&1)
  HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" = "200" ]; then
    print_pass "Health check returned 200 OK"

    # Check if response contains expected fields
    if echo "$BODY" | grep -q '"status"'; then
      print_pass "Health check response contains status field"
    else
      print_fail "Health check response missing status field" "$BODY"
    fi
  else
    print_fail "Health check failed" "HTTP $HTTP_CODE"
  fi
}

###############################################################################
# Test 2: POST /api/query/start (Session Creation)
###############################################################################

test_query_start() {
  run_test
  print_test "POST /api/query/start (Create query session)"

  if [ -z "$JWT_TOKEN" ]; then
    print_warning "Skipping - JWT_TOKEN not provided"
    return
  fi

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "$API_URL/api/query/start" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    2>&1)

  HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" = "200" ]; then
    print_pass "Query start returned 200 OK"

    # Check for session_id in response
    if echo "$BODY" | grep -q '"session_id"'; then
      print_pass "Response contains session_id"
    else
      print_fail "Response missing session_id" "$BODY"
    fi

    # Check for websocket_url in response
    if echo "$BODY" | grep -q '"websocket_url"'; then
      print_pass "Response contains websocket_url"
    else
      print_fail "Response missing websocket_url" "$BODY"
    fi
  elif [ "$HTTP_CODE" = "401" ]; then
    print_fail "Authentication failed" "Invalid JWT token"
  elif [ "$HTTP_CODE" = "429" ]; then
    print_warning "Rate limit exceeded - this might be expected"
  else
    print_fail "Query start failed" "HTTP $HTTP_CODE - $BODY"
  fi
}

###############################################################################
# Test 3: GET /api/query/history (Query History)
###############################################################################

test_query_history() {
  run_test
  print_test "GET /api/query/history (Retrieve query history)"

  if [ -z "$JWT_TOKEN" ]; then
    print_warning "Skipping - JWT_TOKEN not provided"
    return
  fi

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET "$API_URL/api/query/history" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    2>&1)

  HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" = "200" ]; then
    print_pass "Query history returned 200 OK"

    # Check for queries array in response
    if echo "$BODY" | grep -q '"queries"'; then
      print_pass "Response contains queries array"
    else
      print_fail "Response missing queries array" "$BODY"
    fi
  elif [ "$HTTP_CODE" = "401" ]; then
    print_fail "Authentication failed" "Invalid JWT token"
  else
    print_fail "Query history failed" "HTTP $HTTP_CODE - $BODY"
  fi
}

###############################################################################
# Test 4: FalkorDB Connection (via health check)
###############################################################################

test_falkordb_connection() {
  run_test
  print_test "FalkorDB Connection Health"

  RESPONSE=$(curl -s "$API_URL/api/health" 2>&1)

  # Check if health response indicates FalkorDB is connected
  if echo "$RESPONSE" | grep -q '"falkordb"' || echo "$RESPONSE" | grep -q '"graph"'; then
    if echo "$RESPONSE" | grep -q '"healthy"' || echo "$RESPONSE" | grep -q '"connected"'; then
      print_pass "FalkorDB connection is healthy"
    else
      print_fail "FalkorDB connection unhealthy" "$RESPONSE"
    fi
  else
    print_warning "Health check doesn't report FalkorDB status - cannot verify"
  fi
}

###############################################################################
# Test 5: Rate Limiting (Optional - aggressive test)
###############################################################################

test_rate_limiting() {
  run_test
  print_test "Rate Limiting (Optional)"

  if [ -z "$JWT_TOKEN" ]; then
    print_warning "Skipping - JWT_TOKEN not provided"
    return
  fi

  print_info "This test intentionally hits rate limits - may take time"

  # Make multiple requests rapidly (don't hit 30, just test a few)
  RATE_LIMIT_HIT=false
  for i in {1..5}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$API_URL/api/query/start" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json")

    if [ "$HTTP_CODE" = "429" ]; then
      RATE_LIMIT_HIT=true
      break
    fi
  done

  if [ "$RATE_LIMIT_HIT" = true ]; then
    print_pass "Rate limiting is working (429 returned)"
  else
    print_info "Rate limit not hit in 5 requests (30/hour limit may not be reached)"
  fi
}

###############################################################################
# Test 6: CORS Headers
###############################################################################

test_cors_headers() {
  run_test
  print_test "CORS Headers (OPTIONS preflight)"

  RESPONSE=$(curl -s -I \
    -X OPTIONS "$API_URL/api/query/start" \
    -H "Origin: https://example.com" \
    -H "Access-Control-Request-Method: POST" \
    2>&1)

  if echo "$RESPONSE" | grep -qi "Access-Control-Allow"; then
    print_pass "CORS headers present"
  else
    print_fail "CORS headers missing" "OPTIONS request did not return CORS headers"
  fi
}

###############################################################################
# Test 7: Invalid Authentication
###############################################################################

test_invalid_auth() {
  run_test
  print_test "Invalid Authentication Handling"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API_URL/api/query/start" \
    -H "Authorization: Bearer invalid_token_12345" \
    -H "Content-Type: application/json")

  if [ "$HTTP_CODE" = "401" ]; then
    print_pass "Invalid authentication correctly returns 401"
  elif [ "$HTTP_CODE" = "403" ]; then
    print_pass "Invalid authentication correctly returns 403"
  else
    print_fail "Invalid authentication handling" "Expected 401/403, got $HTTP_CODE"
  fi
}

###############################################################################
# Test 8: Missing Authentication
###############################################################################

test_missing_auth() {
  run_test
  print_test "Missing Authentication Handling"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API_URL/api/query/start" \
    -H "Content-Type: application/json")

  if [ "$HTTP_CODE" = "401" ]; then
    print_pass "Missing authentication correctly returns 401"
  elif [ "$HTTP_CODE" = "403" ]; then
    print_pass "Missing authentication correctly returns 403"
  else
    print_fail "Missing authentication handling" "Expected 401/403, got $HTTP_CODE"
  fi
}

###############################################################################
# Summary Report
###############################################################################

print_summary() {
  print_header "Test Summary"

  echo -e "Total Tests Run:    ${TESTS_RUN}"
  echo -e "${GREEN}Tests Passed:       ${TESTS_PASSED}${NC}"
  echo -e "${RED}Tests Failed:       ${TESTS_FAILED}${NC}"
  echo ""

  if [ ${TESTS_FAILED} -gt 0 ]; then
    echo -e "${RED}Failed Tests:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
      echo -e "${RED}  ✗ $test${NC}"
    done
    echo ""
  fi

  # Calculate pass rate
  if [ ${TESTS_RUN} -gt 0 ]; then
    PASS_RATE=$((TESTS_PASSED * 100 / TESTS_RUN))
    echo -e "Pass Rate: ${PASS_RATE}%"
  fi

  echo ""
  if [ ${TESTS_FAILED} -eq 0 ]; then
    echo -e "${GREEN}✓ All smoke tests passed! Production system is operational.${NC}"
    return 0
  else
    echo -e "${RED}✗ Some smoke tests failed. Review failures before proceeding.${NC}"
    return 1
  fi
}

###############################################################################
# Main Execution
###############################################################################

main() {
  print_header "Feature 008: Voice Query - Production Smoke Tests"

  echo "Testing production deployment of Voice Query Input & Graph Querying"
  echo "This suite validates critical functionality is working correctly"
  echo ""

  # Prerequisites
  check_prerequisites

  # Run Tests
  print_header "Running Tests"

  test_health_check
  test_query_start
  test_query_history
  test_falkordb_connection
  test_cors_headers
  test_invalid_auth
  test_missing_auth
  test_rate_limiting  # Optional, may hit limits

  # Summary
  print_summary
  EXIT_CODE=$?

  exit $EXIT_CODE
}

# Execute main function
main
