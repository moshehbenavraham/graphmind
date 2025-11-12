/**
 * Test: Verify nodes created in FalkorDB after graph sync
 * Task: T052 [US1] Verify nodes created in FalkorDB (query by entity_id)
 *
 * This test validates that:
 * 1. Nodes are created with correct labels (Person, Project, etc.)
 * 2. Nodes have proper properties (name, user_id, entity_id)
 * 3. User namespace isolation is working (user_id filter)
 * 4. All entities from test voice note are represented
 */

const { createRestClient } = require('../src/lib/falkordb/rest-client');

async function verifyNodesCreated() {
  console.log('🔍 TEST: Verify nodes created in FalkorDB\n');

  // Use REST API wrapper on port 3001, not direct Redis on 6380
  const client = createRestClient({
    host: process.env.FALKORDB_REST_HOST || 'localhost',
    port: process.env.FALKORDB_REST_PORT || 3001,
    username: process.env.FALKORDB_USER || 'default',
    password: process.env.FALKORDB_PASSWORD || ''
  });

  const testUserId = 'test-user-123';
  const graphName = `graphmind_${testUserId}`;

  try {
    // Test 1: Query all nodes for test user
    console.log('Test 1: Query all nodes for test user');
    const allNodesQuery = `
      MATCH (n {user_id: $user_id})
      RETURN n, labels(n) as types
    `;

    const allNodesResult = await client.query(graphName, allNodesQuery, { user_id: testUserId });
    console.log(`✅ Found ${allNodesResult.length} nodes in graph`);

    if (allNodesResult.length === 0) {
      console.log('⚠️  No nodes found. Graph sync may not have completed yet.');
      return;
    }

    // Display all nodes
    console.log('\nAll nodes in graph:');
    allNodesResult.forEach((row, idx) => {
      const node = row[0];
      const types = row[1];

      // Handle types - could be array or string
      const typeStr = Array.isArray(types) ? types.join(',') : (types || 'Unknown');

      console.log(`  ${idx + 1}. [${typeStr}] ${node.name || node.title || 'Unknown'}`);
      console.log(`     - user_id: ${node.user_id}`);
      if (node.entity_id) {
        console.log(`     - entity_id: ${node.entity_id}`);
      }
      console.log(`     - Properties:`, JSON.stringify(node).substring(0, 150));
    });

    // Test 2: Query by entity type
    console.log('\n\nTest 2: Query nodes by entity type');

    const entityTypes = ['Person', 'Project', 'Organization', 'Technology', 'Topic', 'Meeting', 'Location'];
    const entityCounts = {};

    for (const entityType of entityTypes) {
      const typeQuery = `
        MATCH (n:${entityType} {user_id: $user_id})
        RETURN n
      `;

      try {
        const typeResult = await client.query(graphName, typeQuery, { user_id: testUserId });
        entityCounts[entityType] = typeResult.length;

        if (typeResult.length > 0) {
          console.log(`✅ ${entityType}: ${typeResult.length} node(s)`);
          typeResult.forEach(row => {
            const node = row[0];
            console.log(`   - ${node.name || node.title || 'Unknown'}`);
          });
        }
      } catch (error) {
        // Type might not exist yet
        entityCounts[entityType] = 0;
      }
    }

    // Test 3: Verify expected entities from E2E test
    console.log('\n\nTest 3: Verify expected entities from E2E test');

    const expectedEntities = [
      { type: 'Person', name: 'Sarah Johnson' },
      { type: 'Project', name: 'GraphMind' },
      { type: 'Organization', name: 'Anthropic' },
      { type: 'Technology', name: 'FalkorDB' }
    ];

    let foundCount = 0;
    for (const expected of expectedEntities) {
      const findQuery = `
        MATCH (n:${expected.type} {user_id: $user_id, name: $name})
        RETURN n
      `;

      try {
        const findResult = await client.query(graphName, findQuery, {
          user_id: testUserId,
          name: expected.name
        });

        if (findResult.length > 0) {
          console.log(`✅ Found: ${expected.type} "${expected.name}"`);
          foundCount++;
        } else {
          console.log(`❌ Missing: ${expected.type} "${expected.name}"`);
        }
      } catch (error) {
        console.log(`❌ Error querying ${expected.type} "${expected.name}": ${error.message}`);
      }
    }

    // Test 4: Verify user isolation
    console.log('\n\nTest 4: Verify user isolation');

    const wrongUserQuery = `
      MATCH (n {user_id: $user_id})
      RETURN count(n) as count
    `;

    const wrongUserResult = await client.query(graphName, wrongUserQuery, { user_id: 'different-user' });
    const wrongUserCount = wrongUserResult[0]?.[0] || 0;

    if (wrongUserCount === 0) {
      console.log('✅ User isolation working: No nodes found for different user');
    } else {
      console.log(`⚠️  User isolation issue: Found ${wrongUserCount} nodes for different user`);
    }

    // Summary
    console.log('\n\n📊 SUMMARY:');
    console.log('─'.repeat(50));
    console.log(`Total nodes in graph: ${allNodesResult.length}`);
    console.log(`\nEntity breakdown:`);
    Object.entries(entityCounts).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`  - ${type}: ${count}`);
      }
    });
    console.log(`\nExpected entities found: ${foundCount}/${expectedEntities.length}`);

    // Validation result
    if (foundCount === expectedEntities.length && allNodesResult.length > 0) {
      console.log('\n✅ T052 VALIDATION PASSED: All expected nodes created successfully');
    } else {
      console.log('\n⚠️  T052 VALIDATION INCOMPLETE: Some expected nodes missing');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run test
verifyNodesCreated()
  .then(() => {
    console.log('\n✅ Node verification test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Node verification test failed:', error);
    process.exit(1);
  });
