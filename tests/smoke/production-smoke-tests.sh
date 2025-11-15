#!/bin/bash
#
# Production Smoke Tests for GraphMind Feature 008
# Run after deployment to verify critical paths
#
# Usage: bash tests/smoke/production-smoke-tests.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-https://graphmind-api.apex-web-services-llc-0d4.workers.dev}"
JWT_TOKEN="${JWT_TOKEN}"

echo "========================================="
echo "Production Smoke Tests - GraphMind"
echo "========================================="
echo "API URL: $API_URL"
echo ""

# Check if JWT_TOKEN is set
if [ -z "$JWT_TOKEN" ]; then
  echo -e "${RED}ERROR: JWT_TOKEN environment variable not set${NC}"
  echo "Set it with: export JWT_TOKEN='your_test_jwt_token'"
  exit 1
fi

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test helper function
test_endpoint() {
  local test_name="$1"
  local method="$2"
  local endpoint="$3"
  local expected_status="$4"
  local extra_args="${@:5}"

  echo -n "Test: $test_name... "

  local response
  local status_code

  response=$(curl -s -w "\n%{http_code}" \
    -X "$method" \
    "$API_URL$endpoint" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    $extra_args)

  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}PASS${NC} (HTTP $status_code)"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}FAIL${NC} (HTTP $status_code, expected $expected_status)"
    echo "Response: $body"
    ((TESTS_FAILED++))
    return 1
  fi
}

echo "Starting smoke tests..."
echo ""

# Test 1: Health Check (if endpoint exists)
if curl -s -f "$API_URL/api/health" > /dev/null 2>&1; then
  test_endpoint "Health check" "GET" "/api/health" "200"
else
  echo -e "${YELLOW}SKIP${NC}: Health check endpoint not found"
fi

# Test 2: POST /api/query/start (session creation)
echo -n "Test: POST /api/query/start (create session)... "
response=$(curl -s -w "\n%{http_code}" \
  -X POST \
  "$API_URL/api/query/start" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

status_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$status_code" = "200" ]; then
  SESSION_ID=$(echo "$body" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
  WEBSOCKET_URL=$(echo "$body" | grep -o '"websocket_url":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$SESSION_ID" ] && [ -n "$WEBSOCKET_URL" ]; then
    echo -e "${GREEN}PASS${NC} (HTTP $status_code)"
    echo "  Session ID: $SESSION_ID"
    echo "  WebSocket URL: $WEBSOCKET_URL"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}FAIL${NC} (Missing session_id or websocket_url)"
    echo "Response: $body"
    ((TESTS_FAILED++))
  fi
else
  echo -e "${RED}FAIL${NC} (HTTP $status_code)"
  echo "Response: $body"
  ((TESTS_FAILED++))
fi

# Test 3: GET /api/query/history (should work even with no queries)
test_endpoint "GET /api/query/history" "GET" "/api/query/history" "200"

# Test 4: GET /api/query/history with pagination
test_endpoint "GET /api/query/history with pagination" "GET" "/api/query/history?limit=10&offset=0" "200"

# Test 5: GET /api/query/:query_id (should 404 for non-existent ID)
test_endpoint "GET /api/query/:query_id (non-existent)" "GET" "/api/query/nonexistent-id" "404"

# Test 6: Unauthorized request (no JWT)
echo -n "Test: Unauthorized request (no JWT)... "
response=$(curl -s -w "\n%{http_code}" \
  -X POST \
  "$API_URL/api/query/start" \
  -H "Content-Type: application/json")

status_code=$(echo "$response" | tail -n1)

if [ "$status_code" = "401" ]; then
  echo -e "${GREEN}PASS${NC} (HTTP $status_code)"
  ((TESTS_PASSED++))
else
  echo -e "${RED}FAIL${NC} (HTTP $status_code, expected 401)"
  ((TESTS_FAILED++))
fi

# Test 7: CORS headers present
echo -n "Test: CORS headers present... "
cors_headers=$(curl -s -I \
  -X OPTIONS \
  "$API_URL/api/query/start" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type")

if echo "$cors_headers" | grep -qi "access-control-allow-origin"; then
  echo -e "${GREEN}PASS${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}FAIL${NC} (No CORS headers found)"
  ((TESTS_FAILED++))
fi

# Test 8: Rate limiting check (optional - only if you want to hit rate limits)
# echo -n "Test: Rate limiting (31 rapid requests)... "
# for i in {1..31}; do
#   status=$(curl -s -o /dev/null -w "%{http_code}" \
#     -X POST \
#     "$API_URL/api/query/start" \
#     -H "Authorization: Bearer $JWT_TOKEN")
#
#   if [ "$i" -eq 31 ] && [ "$status" = "429" ]; then
#     echo -e "${GREEN}PASS${NC} (Rate limit triggered on 31st request)"
#     ((TESTS_PASSED++))
#     break
#   fi
# done

echo ""
echo "========================================="
echo "Test Results"
echo "========================================="
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All smoke tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
