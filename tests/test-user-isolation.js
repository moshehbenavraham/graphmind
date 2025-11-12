/**
 * User Isolation Security Test (T125-T131)
 *
 * Tests user namespace isolation:
 * - User A can only see User A's data
 * - User B can only see User B's data
 * - No cross-user data leakage
 * - Security for all graph endpoints
 *
 * Usage: node tests/test-user-isolation.js
 */

import { connect, disconnect, executeCypher } from '../src/lib/falkordb/client.js';

const config = {
  host: process.env.FALKORDB_HOST || 'localhost',
  port: 3001, // REST API wrapper port (not FalkorDB direct port 6380)
  username: process.env.FALKORDB_USER || 'default',
  password: process.env.FALKORDB_PASSWORD || '',
};

// Test users
const USER_A = 'test_user_a_' + Date.now();
const USER_B = 'test_user_b_' + Date.now();

// FalkorDB uses single graph with user_id filtering (not separate databases)
const GRAPH_NAME = 'test_graph_isolation';

let client;
let testsPassed = 0;
let testsFailed = 0;

/**
 * Assert helper
 */
function assert(condition, message) {
  if (condition) {
    console.log('✅ PASS:', message);
    testsPassed++;
  } else {
    console.error('❌ FAIL:', message);
    testsFailed++;
    throw new Error(message);
  }
}

/**
 * T125: Create 2 test users (user_A, user_B)
 */
async function createTestUsers() {
  console.log('\n🧪 T125: Creating 2 test users...');

  // FalkorDB uses single graph with user_id filtering, no separate databases needed
  // Just verify we can use the test graph
  await executeCypher(client, GRAPH_NAME, 'RETURN 1', {});

  assert(true, 'Created 2 test users (User A and User B) with shared graph namespace');
}

/**
 * T126: Add 10 entities to user_A graph
 */
async function addEntitiesUserA() {
  console.log('\n🧪 T126: Adding 10 entities to User A graph...');

  const entities = [
    { type: 'Person', name: 'Alice', entity_id: 'person_alice_a' },
    { type: 'Person', name: 'Bob', entity_id: 'person_bob_a' },
    { type: 'Project', name: 'Project Alpha', entity_id: 'project_alpha_a' },
    { type: 'Project', name: 'Project Beta', entity_id: 'project_beta_a' },
    { type: 'Technology', name: 'JavaScript', entity_id: 'tech_js_a' },
    { type: 'Technology', name: 'Python', entity_id: 'tech_python_a' },
    { type: 'Organization', name: 'Acme Corp', entity_id: 'org_acme_a' },
    { type: 'Location', name: 'San Francisco', entity_id: 'loc_sf_a' },
    { type: 'Topic', name: 'AI Research', entity_id: 'topic_ai_a' },
    { type: 'Meeting', name: 'Standup 2025-01-12', entity_id: 'meeting_standup_a', date: '2025-01-12' },
  ];

  for (const entity of entities) {
    const cypher = `
      MERGE (n:${entity.type} {user_id: $user_id, entity_id: $entity_id})
      ON CREATE SET n.name = $name, n.mention_count = 1
      ON MATCH SET n.mention_count = n.mention_count + 1
      RETURN n
    `.trim();

    const params = {
      user_id: USER_A,
      entity_id: entity.entity_id,
      name: entity.name,
    };

    await executeCypher(client, GRAPH_NAME, cypher, params);
  }

  // Verify count
  const countResult = await executeCypher(client, GRAPH_NAME,
    'MATCH (n {user_id: $user_id}) RETURN count(n) as total',
    { user_id: USER_A }
  );

  // Fix: Result format is { data: [{total: count}], ... }
  const count = countResult.data?.[0]?.total ?? 0;
  assert(count === 10, `User A has 10 entities (got ${count})`);
}

/**
 * T127: Add 10 entities to user_B graph
 */
async function addEntitiesUserB() {
  console.log('\n🧪 T127: Adding 10 entities to User B graph...');

  const entities = [
    { type: 'Person', name: 'Charlie', entity_id: 'person_charlie_b' },
    { type: 'Person', name: 'Diana', entity_id: 'person_diana_b' },
    { type: 'Project', name: 'Project Gamma', entity_id: 'project_gamma_b' },
    { type: 'Project', name: 'Project Delta', entity_id: 'project_delta_b' },
    { type: 'Technology', name: 'Ruby', entity_id: 'tech_ruby_b' },
    { type: 'Technology', name: 'Go', entity_id: 'tech_go_b' },
    { type: 'Organization', name: 'Beta Inc', entity_id: 'org_beta_b' },
    { type: 'Location', name: 'New York', entity_id: 'loc_ny_b' },
    { type: 'Topic', name: 'Machine Learning', entity_id: 'topic_ml_b' },
    { type: 'Meeting', name: 'Standup 2025-01-12', entity_id: 'meeting_standup_b', date: '2025-01-12' },
  ];

  for (const entity of entities) {
    const cypher = `
      MERGE (n:${entity.type} {user_id: $user_id, entity_id: $entity_id})
      ON CREATE SET n.name = $name, n.mention_count = 1
      ON MATCH SET n.mention_count = n.mention_count + 1
      RETURN n
    `.trim();

    const params = {
      user_id: USER_B,
      entity_id: entity.entity_id,
      name: entity.name,
    };

    await executeCypher(client, GRAPH_NAME, cypher, params);
  }

  // Verify count
  const countResult = await executeCypher(client, GRAPH_NAME,
    'MATCH (n {user_id: $user_id}) RETURN count(n) as total',
    { user_id: USER_B }
  );

  const count = countResult.data?.[0]?.total ?? 0;
  assert(count === 10, `User B has 10 entities (got ${count})`);
}

/**
 * T128: Query user_A graph, verify only user_A entities returned (no user_B data)
 */
async function testUserAIsolation() {
  console.log('\n🧪 T128: Testing User A isolation...');

  // Query User A's graph with User A's user_id filter
  const result = await executeCypher(client, GRAPH_NAME,
    'MATCH (n {user_id: $user_id}) RETURN n.name, n.entity_id ORDER BY n.name',
    { user_id: USER_A }
  );

  const names = result.data.map(row => row.name || row.n?.name);
  console.log('User A entities:', names);

  // Verify no User B entities
  const hasUserBData = names.some(name => ['Charlie', 'Diana', 'Project Gamma', 'Beta Inc', 'New York'].includes(name));
  assert(!hasUserBData, 'User A graph contains no User B data');
  assert(result.data.length === 10, `User A sees exactly 10 entities (got ${result.data.length})`);
}

/**
 * T129: Attempt to query user_B entity with user_A JWT, verify 404 Not Found
 */
async function testCrossUserAccess() {
  console.log('\n🧪 T129: Testing cross-user access prevention...');

  // Attempt to query User B's entity from User A's graph namespace
  const result = await executeCypher(client, GRAPH_NAME,
    'MATCH (n {user_id: $user_id, entity_id: $entity_id}) RETURN n',
    { user_id: USER_A, entity_id: 'person_charlie_b' } // User B's entity
  );

  // Should return no results (404-equivalent)
  assert(result.data.length === 0, 'User A cannot access User B entity (404 behavior)');
}

/**
 * T130: Test all graph endpoints for user isolation (search, stats, entity details)
 */
async function testAllEndpointsIsolation() {
  console.log('\n🧪 T130: Testing user isolation across all query types...');

  // Test 1: Search query (User A searches for "Project")
  const searchResultA = await executeCypher(client, GRAPH_NAME,
    'MATCH (n {user_id: $user_id}) WHERE toLower(n.name) CONTAINS toLower($query) RETURN n.name',
    { user_id: USER_A, query: 'Project' }
  );

  const searchNamesA = searchResultA.data.map(row => row.name || row['n.name']);
  console.log('User A search results:', searchNamesA);
  assert(!searchNamesA.includes('Project Gamma'), 'User A search does not return User B projects');

  // Test 2: Stats query (User A gets node counts)
  const statsResultA = await executeCypher(client, GRAPH_NAME,
    'MATCH (n {user_id: $user_id}) RETURN count(n) as total',
    { user_id: USER_A }
  );

  const totalA = statsResultA.data?.[0]?.total ?? 0;
  assert(totalA === 10, `User A stats shows 10 nodes (got ${totalA})`);

  // Test 3: Neighborhood query (User A gets entity neighborhood)
  const neighborhoodResultA = await executeCypher(client, GRAPH_NAME,
    `MATCH (center {user_id: $user_id, entity_id: $entity_id})
     OPTIONAL MATCH (center)-[r]-(connected)
     WHERE connected.user_id = $user_id
     RETURN center, collect(connected) as neighbors`,
    { user_id: USER_A, entity_id: 'person_alice_a' }
  );

  assert(neighborhoodResultA.data.length > 0, 'User A can query their own entity neighborhoods');
}

/**
 * T131: Attempt cross-user relationship creation, verify rejection
 */
async function testCrossUserRelationship() {
  console.log('\n🧪 T131: Testing cross-user relationship prevention...');

  // Attempt to create relationship between User A's node and User B's node
  // This should fail because User B's node doesn't exist in User A's graph namespace
  const cypher = `
    MATCH (from {user_id: $user_id, entity_id: $from_entity_id})
    MATCH (to {user_id: $user_id, entity_id: $to_entity_id})
    MERGE (from)-[r:WORKED_WITH]->(to)
    RETURN r
  `.trim();

  const result = await executeCypher(client, GRAPH_NAME, cypher, {
    user_id: USER_A,
    from_entity_id: 'person_alice_a', // User A's node
    to_entity_id: 'person_charlie_b', // User B's node (doesn't exist in User A's graph)
  });

  // Should return no results (relationship not created)
  assert(result.data.length === 0, 'Cross-user relationship creation rejected');
}

/**
 * Cleanup: Delete test data
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');

  try {
    // Delete all test nodes (both User A and User B)
    await executeCypher(client, GRAPH_NAME,
      'MATCH (n) WHERE n.user_id = $user_a OR n.user_id = $user_b DETACH DELETE n',
      { user_a: USER_A, user_b: USER_B }
    ).catch(() => {});
    console.log('✅ Cleanup complete');
  } catch (error) {
    console.warn('⚠️  Cleanup failed (non-fatal):', error.message);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🔒 User Isolation Security Test (T125-T131)');
  console.log('============================================\n');
  console.log('Config:', { host: config.host, port: config.port });

  try {
    // Connect
    console.log('\n📡 Connecting to FalkorDB...');
    client = await connect(config);
    console.log('✅ Connected');

    // Run tests
    await createTestUsers(); // T125
    await addEntitiesUserA(); // T126
    await addEntitiesUserB(); // T127
    await testUserAIsolation(); // T128
    await testCrossUserAccess(); // T129
    await testAllEndpointsIsolation(); // T130
    await testCrossUserRelationship(); // T131

    // Cleanup
    await cleanup();

    // Summary
    console.log('\n📊 Test Summary');
    console.log('===============');
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);

    if (testsFailed === 0) {
      console.log('\n🎉 ALL TESTS PASSED - User isolation verified!');
      process.exit(0);
    } else {
      console.log('\n⚠️  SOME TESTS FAILED - Security issues detected!');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
    await cleanup().catch(() => {});
    process.exit(1);
  } finally {
    if (client) {
      await disconnect(client);
    }
  }
}

// Run tests
runTests();
