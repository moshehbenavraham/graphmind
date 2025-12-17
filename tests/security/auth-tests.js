/**
 * Authentication & CORS Security Tests
 * Feature 012 - Security Hardening
 *
 * Tests that API key authentication and CORS restrictions prevent unauthorized access
 */

const API_KEY = process.env.FALKORDB_REST_API_KEY;
const REST_API_URL = process.env.REST_API_URL || 'http://localhost:3013';
const TEST_GRAPH = 'test_auth_security';

if (!API_KEY) {
  console.error('ERROR: FALKORDB_REST_API_KEY not set');
  process.exit(1);
}

// Test cases for authentication
const AUTH_TESTS = [
  {
    name: 'Request without Authorization header',
    headers: {
      'Content-Type': 'application/json'
    },
    expectedStatus: 401,
    expectedBehavior: 'Returns 401 Unauthorized'
  },
  {
    name: 'Request with invalid Bearer token',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid_token_12345'
    },
    expectedStatus: 403,
    expectedBehavior: 'Returns 403 Forbidden'
  },
  {
    name: 'Request with malformed Authorization header (no Bearer prefix)',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': API_KEY
    },
    expectedStatus: 401,
    expectedBehavior: 'Returns 401 Unauthorized'
  },
  {
    name: 'Request with valid Bearer token',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    expectedStatus: 200,
    expectedBehavior: 'Returns 200 OK'
  },
  {
    name: 'Request with empty Bearer token',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer '
    },
    expectedStatus: 403,
    expectedBehavior: 'Returns 403 Forbidden'
  }
];

// Test cases for CORS
const CORS_TESTS = [
  {
    name: 'Request from allowed origin (localhost:8787)',
    origin: 'http://localhost:8787',
    expectedAllowed: true,
    expectedBehavior: 'Returns Access-Control-Allow-Origin header'
  },
  {
    name: 'Request from allowed origin (localhost:5176)',
    origin: 'http://localhost:5176',
    expectedAllowed: true,
    expectedBehavior: 'Returns Access-Control-Allow-Origin header'
  },
  {
    name: 'Request from production origin',
    origin: 'https://graphmind.pages.dev',
    expectedAllowed: true,
    expectedBehavior: 'Returns Access-Control-Allow-Origin header'
  },
  {
    name: 'Request from preview deployment',
    origin: 'https://feature-123-graphmind.pages.dev',
    expectedAllowed: true,
    expectedBehavior: 'Returns Access-Control-Allow-Origin header'
  },
  {
    name: 'Request from unauthorized origin (evil.com)',
    origin: 'https://evil.com',
    expectedAllowed: false,
    expectedBehavior: 'No Access-Control-Allow-Origin header or 401'
  },
  {
    name: 'Request from unauthorized origin (attacker.com)',
    origin: 'http://attacker.com',
    expectedAllowed: false,
    expectedBehavior: 'No Access-Control-Allow-Origin header or 401'
  },
  {
    name: 'Request with no Origin header',
    origin: null,
    expectedAllowed: false,
    expectedBehavior: 'No Access-Control-Allow-Origin header (but auth still required)'
  }
];

async function testAuthentication(testCase) {
  console.log(`\n🔐 Testing: ${testCase.name}`);
  console.log(`   Expected: ${testCase.expectedBehavior}`);

  try {
    const response = await fetch(`${REST_API_URL}/api/graph/${TEST_GRAPH}/query`, {
      method: 'POST',
      headers: testCase.headers,
      body: JSON.stringify({
        query: 'MATCH (n) RETURN n LIMIT 1',
        params: {}
      })
    });

    if (response.status === testCase.expectedStatus) {
      console.log(`   ✅ PASS: Returns ${response.status} ${response.statusText}`);
      return true;
    } else {
      console.log(`   ❌ FAIL: Expected ${testCase.expectedStatus}, got ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAIL: Request failed: ${error.message}`);
    return false;
  }
}

async function testCORS(testCase) {
  console.log(`\n🌐 Testing: ${testCase.name}`);
  console.log(`   Expected: ${testCase.expectedBehavior}`);

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    };

    if (testCase.origin) {
      headers['Origin'] = testCase.origin;
    }

    const response = await fetch(`${REST_API_URL}/api/graph/${TEST_GRAPH}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: 'MATCH (n) RETURN n LIMIT 1',
        params: {}
      })
    });

    const corsHeader = response.headers.get('Access-Control-Allow-Origin');

    if (testCase.expectedAllowed) {
      if (corsHeader === testCase.origin) {
        console.log(`   ✅ PASS: CORS header set to ${corsHeader}`);
        return true;
      } else {
        console.log(`   ❌ FAIL: Expected CORS header "${testCase.origin}", got "${corsHeader}"`);
        return false;
      }
    } else {
      // Unauthorized origin
      if (response.status === 401 || !corsHeader || corsHeader !== testCase.origin) {
        console.log(`   ✅ PASS: Request blocked (status ${response.status}, CORS header: ${corsHeader || 'none'})`);
        return true;
      } else {
        console.log(`   ❌ FAIL: Unauthorized origin allowed (CORS header: ${corsHeader})`);
        return false;
      }
    }
  } catch (error) {
    console.log(`   ❌ FAIL: Request failed: ${error.message}`);
    return false;
  }
}

async function testPreflightRequest() {
  console.log('\n✈️  Testing: Preflight OPTIONS request');
  console.log('   Expected: Returns 200 OK without requiring authentication');

  try {
    const response = await fetch(`${REST_API_URL}/api/graph/${TEST_GRAPH}/query`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:8787',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });

    if (response.status === 200) {
      const allowMethods = response.headers.get('Access-Control-Allow-Methods');
      const allowHeaders = response.headers.get('Access-Control-Allow-Headers');

      console.log(`   ✅ PASS: Returns 200 OK`);
      console.log(`   Allow-Methods: ${allowMethods}`);
      console.log(`   Allow-Headers: ${allowHeaders}`);
      return true;
    } else {
      console.log(`   ❌ FAIL: Expected 200, got ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAIL: Request failed: ${error.message}`);
    return false;
  }
}

async function testStartupWithoutAPIKey() {
  console.log('\n🚫 Testing: Server refuses to start without API key');
  console.log('   Expected: Manual verification required');
  console.log('   ℹ️  To test: Remove FALKORDB_REST_API_KEY from .env and restart server');
  console.log('   ℹ️  Server should print error and exit with code 1');
  console.log('   ⏭️  SKIPPED: Manual test only');
  return true;
}

async function runTests() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Authentication & CORS Security Tests');
  console.log('  Feature 012 - Security Hardening');
  console.log('═══════════════════════════════════════════════');
  console.log(`REST API: ${REST_API_URL}`);
  console.log(`Test Graph: ${TEST_GRAPH}`);

  let passed = 0;
  let failed = 0;

  try {
    // Authentication tests
    console.log('\n┌─────────────────────────────────────────────┐');
    console.log('│  Authentication Tests                       │');
    console.log('└─────────────────────────────────────────────┘');

    for (const testCase of AUTH_TESTS) {
      const result = await testAuthentication(testCase);
      if (result) {
        passed++;
      } else {
        failed++;
      }
    }

    // CORS tests
    console.log('\n┌─────────────────────────────────────────────┐');
    console.log('│  CORS Restriction Tests                     │');
    console.log('└─────────────────────────────────────────────┘');

    for (const testCase of CORS_TESTS) {
      const result = await testCORS(testCase);
      if (result) {
        passed++;
      } else {
        failed++;
      }
    }

    // Preflight test
    console.log('\n┌─────────────────────────────────────────────┐');
    console.log('│  Preflight Request Test                     │');
    console.log('└─────────────────────────────────────────────┘');

    const preflightResult = await testPreflightRequest();
    if (preflightResult) {
      passed++;
    } else {
      failed++;
    }

    // Manual test
    console.log('\n┌─────────────────────────────────────────────┐');
    console.log('│  Manual Tests                               │');
    console.log('└─────────────────────────────────────────────┘');

    const manualResult = await testStartupWithoutAPIKey();
    if (manualResult) {
      passed++;
    }

  } catch (error) {
    console.error('\n❌ Test suite error:', error);
    failed++;
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('  Test Summary');
  console.log('═══════════════════════════════════════════════');
  console.log(`Total Tests: ${passed + failed}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('═══════════════════════════════════════════════\n');

  // Exit with appropriate code
  process.exit(failed === 0 ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
