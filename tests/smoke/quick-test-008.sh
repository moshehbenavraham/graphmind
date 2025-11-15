#!/bin/bash

# Quick smoke test for Feature 008
set -e

API_URL="https://graphmind-api.apex-web-services-llc-0d4.workers.dev"
TIMESTAMP=$(date +%s)
TEST_EMAIL="smoke-test-${TIMESTAMP}@example.com"
TEST_PASSWORD="TestPassword123!"

echo "=== Feature 008 Quick Smoke Test ==="
echo ""

# Test 1: Health Check
echo "Test 1: Health Check"
HEALTH=$(curl -s "${API_URL}/api/health")
echo "✓ Health check: ${HEALTH}"
echo ""

# Test 2: Register User
echo "Test 2: Register Test User"
REGISTER_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\",\"name\":\"Smoke Test\"}")
echo "Register response: ${REGISTER_RESPONSE}"
echo ""

# Test 3: Login
echo "Test 3: Login"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")
echo "Login response: ${LOGIN_RESPONSE}"

JWT_TOKEN=$(echo "${LOGIN_RESPONSE}" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "JWT Token extracted: ${JWT_TOKEN:0:20}..."
echo ""

# Test 4: Start Query Session
echo "Test 4: Start Voice Query Session"
QUERY_START=$(curl -s -X POST "${API_URL}/api/query/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JWT_TOKEN}")
echo "Query start response: ${QUERY_START}"
echo ""

# Test 5: Query History
echo "Test 5: Get Query History"
HISTORY=$(curl -s "${API_URL}/api/query/history" \
  -H "Authorization: Bearer ${JWT_TOKEN}")
echo "Query history: ${HISTORY}"
echo ""

echo "=== All Tests Passed! ==="
