/**
 * Cypher Injection Security Tests
 * Feature 012 - Security Hardening
 *
 * Tests that query parameterization prevents injection attacks
 * All injection attempts should return 0 or appropriate results without data leakage
 */

const API_KEY = process.env.FALKORDB_REST_API_KEY;
const REST_API_URL = process.env.REST_API_URL || 'http://localhost:3013';
const TEST_GRAPH = 'test_injection_security';

if (!API_KEY) {
  console.error('ERROR: FALKORDB_REST_API_KEY not set');
  process.exit(1);
}

// Injection test payloads
const INJECTION_PAYLOADS = [
  {
    name: 'Quote escape bypass',
    payload: 'Alice\\" OR 1=1 //',
    expectedBehavior: 'Returns 0 results (no person named "Alice\\" OR 1=1 //")'
  },
  {
    name: 'Logic manipulation with true',
    payload: 'Bob\\" OR true RETURN * //',
    expectedBehavior: 'Returns 0 results'
  },
  {
    name: 'Additional WITH clause injection',
    payload: 'Carol\\" WITH 1 AS x MATCH (n) RETURN n //',
    expectedBehavior: 'Returns 0 results'
  },
  {
    name: 'UNION injection attempt',
    payload: 'Dave\\" UNION MATCH (secret) RETURN secret //',
    expectedBehavior: 'Returns 0 results'
  },
  {
    name: 'Comment injection',
    payload: 'Eve\\" // MATCH (all) RETURN all',
    expectedBehavior: 'Returns 0 results'
  },
  {
    name: 'Multi-line injection',
    payload: 'Frank\\"\nMATCH (x) RETURN x',
    expectedBehavior: 'Returns 0 results'
  },
  {
    name: 'Nested quote injection',
    payload: 'Grace\\"\\" OR \\"\\"\\"=\\"',
    expectedBehavior: 'Returns 0 results'
  },
  {
    name: 'Backtick injection',
    payload: 'Henry\\` OR 1=1 `',
    expectedBehavior: 'Returns 0 results'
  },
  {
    name: 'Unicode escape injection',
    payload: 'Iris\\u0022 OR 1=1 //',
    expectedBehavior: 'Returns 0 results'
  },
  {
    name: 'NULL byte injection',
    payload: 'Jack\\x00\\" OR true //',
    expectedBehavior: 'Returns 0 results'
  }
];

// Valid special character tests (should work if entity exists)
const VALID_SPECIAL_CHARS = [
  {
    name: 'Apostrophe in name',
    payload: "O'Reilly",
    expectedBehavior: 'Works correctly if entity exists'
  },
  {
    name: 'Unicode characters',
    payload: 'José',
    expectedBehavior: 'Works correctly if entity exists'
  },
  {
    name: 'Hyphenated name',
    payload: 'Mary-Jane',
    expectedBehavior: 'Works correctly if entity exists'
  }
];

async function queryGraph(query, params = {}) {
  const response = await fetch(`${REST_API_URL}/api/graph/${TEST_GRAPH}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({ query, params })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Query failed (${response.status}): ${error}`);
  }

  return response.json();
}

async function setupTestData() {
  console.log('\n📦 Setting up test data...');

  // Create a few test nodes
  const testNodes = [
    { name: 'Alice', type: 'Person' },
    { name: 'Bob', type: 'Person' },
    { name: "O'Reilly", type: 'Person' },
    { name: 'José', type: 'Person' }
  ];

  for (const node of testNodes) {
    try {
      await queryGraph(
        'CREATE (n:Person {name: $name, test: true})',
        { name: node.name }
      );
      console.log(`  ✓ Created test node: ${node.name}`);
    } catch (error) {
      console.error(`  ✗ Failed to create ${node.name}:`, error.message);
    }
  }
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  try {
    const result = await queryGraph('MATCH (n:Person {test: true}) DELETE n');
    console.log(`  ✓ Deleted test nodes`);
  } catch (error) {
    console.error(`  ✗ Cleanup failed:`, error.message);
  }
}

async function testInjectionPayload(testCase) {
  console.log(`\n🔍 Testing: ${testCase.name}`);
  console.log(`   Payload: "${testCase.payload}"`);
  console.log(`   Expected: ${testCase.expectedBehavior}`);

  try {
    // Test query that would be vulnerable if not parameterized
    const result = await queryGraph(
      'MATCH (n:Person {name: $name}) RETURN n LIMIT 1',
      { name: testCase.payload }
    );

    const resultCount = result.data?.length || 0;

    if (resultCount === 0) {
      console.log(`   ✅ PASS: Returns 0 results (injection blocked)`);
      return true;
    } else if (resultCount === 1) {
      // Only acceptable if we created a test entity with this exact name
      const returnedName = result.data[0]?.n?.properties?.name;
      if (returnedName === testCase.payload) {
        console.log(`   ✅ PASS: Returns matching entity (legitimate match)`);
        return true;
      } else {
        console.log(`   ❌ FAIL: Returned unexpected entity: ${returnedName}`);
        return false;
      }
    } else {
      console.log(`   ❌ FAIL: Returned ${resultCount} results (possible data leakage)`);
      return false;
    }
  } catch (error) {
    // Errors are acceptable (query validation caught it)
    console.log(`   ✅ PASS: Query rejected with error (${error.message})`);
    return true;
  }
}

async function testValidSpecialChars(testCase) {
  console.log(`\n🔍 Testing: ${testCase.name}`);
  console.log(`   Payload: "${testCase.payload}"`);
  console.log(`   Expected: ${testCase.expectedBehavior}`);

  try {
    const result = await queryGraph(
      'MATCH (n:Person {name: $name}) RETURN n LIMIT 1',
      { name: testCase.payload }
    );

    const resultCount = result.data?.length || 0;

    if (resultCount === 1) {
      const returnedName = result.data[0]?.n?.properties?.name;
      if (returnedName === testCase.payload) {
        console.log(`   ✅ PASS: Correctly handles special characters`);
        return true;
      } else {
        console.log(`   ⚠️  WARN: Unexpected result: ${returnedName}`);
        return false;
      }
    } else if (resultCount === 0) {
      console.log(`   ✅ PASS: Returns 0 results (entity doesn't exist)`);
      return true;
    } else {
      console.log(`   ❌ FAIL: Returned ${resultCount} results`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAIL: Query failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Cypher Injection Security Tests');
  console.log('  Feature 012 - Security Hardening');
  console.log('═══════════════════════════════════════════════');
  console.log(`REST API: ${REST_API_URL}`);
  console.log(`Test Graph: ${TEST_GRAPH}`);

  let passed = 0;
  let failed = 0;

  try {
    // Setup test data
    await setupTestData();

    // Test injection payloads
    console.log('\n┌─────────────────────────────────────────────┐');
    console.log('│  Injection Attack Prevention Tests         │');
    console.log('└─────────────────────────────────────────────┘');

    for (const testCase of INJECTION_PAYLOADS) {
      const result = await testInjectionPayload(testCase);
      if (result) {
        passed++;
      } else {
        failed++;
      }
    }

    // Test valid special characters
    console.log('\n┌─────────────────────────────────────────────┐');
    console.log('│  Valid Special Character Tests              │');
    console.log('└─────────────────────────────────────────────┘');

    for (const testCase of VALID_SPECIAL_CHARS) {
      const result = await testValidSpecialChars(testCase);
      if (result) {
        passed++;
      } else {
        failed++;
      }
    }

    // Cleanup
    await cleanupTestData();

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
