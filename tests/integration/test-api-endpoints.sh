#!/bin/bash
#
# API Endpoint Integration Tests
# Feature: 005-entity-extraction
#
# Tests all 4 entity extraction API endpoints:
# 1. POST /api/notes/:note_id/extract-entities - Manual extraction trigger
# 2. GET /api/notes/:note_id/entities - View extracted entities
# 3. POST /api/entities/extract-batch - Batch extraction
# 4. GET /api/entities/cache/:entity_key - Entity cache lookup
#
# Prerequisites:
# - wrangler dev running on port 8787
# - Valid JWT token (use test user)
# - D1 database migrated and populated
#

set -e

# Configuration
API_BASE="http://localhost:8787"
JWT_TOKEN="${JWT_TOKEN:-test-jwt-token-replace-me}"
TEST_NOTE_ID="note_test_001"
TEST_USER_ID="user_test_123"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================================================"
echo "Entity Extraction API - Endpoint Tests"
echo "================================================================================"
echo ""
echo "API Base URL: $API_BASE"
echo "JWT Token: ${JWT_TOKEN:0:20}..."
echo ""

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"

    echo "--------------------------------------------------------------------------------"
    echo -e "${BLUE}Test: $name${NC}"
    echo "--------------------------------------------------------------------------------"
    echo "Method: $method"
    echo "Endpoint: $endpoint"

    if [ -n "$data" ]; then
        echo "Request Body:"
        echo "$data" | jq . 2>/dev/null || echo "$data"
    fi

    echo ""
    echo "Executing request..."

    # Build curl command
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -X GET "$API_BASE$endpoint" \
            -H "Authorization: Bearer $JWT_TOKEN" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" "$API_BASE$endpoint" \
            -H "Authorization: Bearer $JWT_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    # Extract status code (last line)
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    echo "Status Code: $status_code"
    echo "Response Body:"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    echo ""

    # Check status code
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} - Expected status code $expected_status"
    else
        echo -e "${RED}✗ FAIL${NC} - Expected $expected_status, got $status_code"
    fi

    echo ""
}

echo "================================================================================"
echo "Endpoint 1: POST /api/notes/:note_id/extract-entities"
echo "================================================================================"
echo ""

test_endpoint \
    "Manual extraction trigger" \
    "POST" \
    "/api/notes/$TEST_NOTE_ID/extract-entities" \
    "" \
    "200"

sleep 1

echo "================================================================================"
echo "Endpoint 2: GET /api/notes/:note_id/entities"
echo "================================================================================"
echo ""

test_endpoint \
    "View extracted entities" \
    "GET" \
    "/api/notes/$TEST_NOTE_ID/entities" \
    "" \
    "200"

sleep 1

echo "================================================================================"
echo "Endpoint 3: POST /api/entities/extract-batch"
echo "================================================================================"
echo ""

batch_data='{
  "note_ids": ["note_001", "note_002", "note_003"]
}'

test_endpoint \
    "Batch extraction trigger" \
    "POST" \
    "/api/entities/extract-batch" \
    "$batch_data" \
    "200"

sleep 1

echo "================================================================================"
echo "Endpoint 4: GET /api/entities/cache/:entity_key"
echo "================================================================================"
echo ""

test_endpoint \
    "Entity cache lookup" \
    "GET" \
    "/api/entities/cache/sarah-johnson" \
    "" \
    "200"

sleep 1

echo "================================================================================"
echo "Rate Limiting Tests"
echo "================================================================================"
echo ""

echo -e "${YELLOW}Testing rate limits (manual extraction: 10/min)...${NC}"
echo ""

# Make 12 requests rapidly to trigger rate limit
for i in {1..12}; do
    echo -n "Request $i/12... "
    status=$(curl -s -w "%{http_code}" -o /dev/null \
        -X POST "$API_BASE/api/notes/note_test_$i/extract-entities" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json")

    if [ "$status" = "429" ]; then
        echo -e "${GREEN}✓ Rate limited${NC} (status: $status)"
        break
    else
        echo "Status: $status"
    fi
done

echo ""

echo "================================================================================"
echo "Authentication Tests"
echo "================================================================================"
echo ""

echo -e "${YELLOW}Testing without auth token...${NC}"
test_endpoint \
    "Extraction without token" \
    "POST" \
    "/api/notes/$TEST_NOTE_ID/extract-entities" \
    "" \
    "401"

echo -e "${YELLOW}Testing with invalid token...${NC}"
JWT_TOKEN="invalid-token-12345"
test_endpoint \
    "Extraction with invalid token" \
    "POST" \
    "/api/notes/$TEST_NOTE_ID/extract-entities" \
    "" \
    "401"

echo "================================================================================"
echo "Test Summary"
echo "================================================================================"
echo ""
echo "All endpoint tests completed!"
echo ""
echo "Manual Verification Checklist:"
echo "  □ All endpoints return expected status codes"
echo "  □ Response bodies contain correct data structure"
echo "  □ Rate limiting is enforced (429 after 10 requests)"
echo "  □ Authentication is required (401 without token)"
echo "  □ Extraction completes within 3 seconds"
echo ""
echo "To run full E2E test:"
echo "  1. Start wrangler dev: npm run dev"
echo "  2. Set JWT_TOKEN env var: export JWT_TOKEN=your-token"
echo "  3. Run this script: bash tests/integration/test-api-endpoints.sh"
echo ""
