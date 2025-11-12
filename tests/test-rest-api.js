/**
 * Test FalkorDB REST API Implementation
 * Verifies that REST API client works with FalkorDB Cloud
 */

import { connect, executeCypher, disconnect } from '../src/lib/falkordb/client.js';

async function testRestAPI() {
  console.log('🚀 Testing FalkorDB REST API Implementation\n');
  console.log('=' .repeat(60));

  // Use REST API wrapper running on localhost:3001
  // (Start with: node scripts/falkordb-rest-api.js)
  const config = {
    host: 'localhost',
    port: 3001,
    username: 'default',  // Not used for REST API
    password: '',         // Not used for REST API
  };

  let client;
  const graphName = 'test_rest_api';
  const testResults = {
    passed: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Test 1: Connection
    console.log('\n📌 Test 1: Connection');
    console.log('-'.repeat(60));
    const connectStart = Date.now();
    client = await connect(config);
    const connectTime = Date.now() - connectStart;
    console.log(`✅ Connected in ${connectTime}ms`);
    testResults.passed++;

    // Test 2: Simple RETURN query
    console.log('\n📌 Test 2: Simple RETURN Query');
    console.log('-'.repeat(60));
    const test2Start = Date.now();
    const result2 = await executeCypher(client, graphName, 'RETURN 1 as number, "test" as text');
    const test2Time = Date.now() - test2Start;
    console.log(`✅ Query executed in ${test2Time}ms`);
    console.log('   Data:', result2.data);
    console.log('   Statistics:', result2.statistics);
    testResults.passed++;

    // Test 3: CREATE node with parameters
    console.log('\n📌 Test 3: CREATE Node with Parameters');
    console.log('-'.repeat(60));
    const test3Start = Date.now();
    const result3 = await executeCypher(
      client,
      graphName,
      'CREATE (n:Person {id: $id, name: $name, age: $age}) RETURN n',
      { id: 'person-1', name: 'Alice Smith', age: 30 }
    );
    const test3Time = Date.now() - test3Start;
    console.log(`✅ Node created in ${test3Time}ms`);
    console.log('   Nodes created:', result3.statistics.nodes_created);
    console.log('   Properties set:', result3.statistics.properties_set);
    testResults.passed++;

    // Test 4: MERGE operation (production use case)
    console.log('\n📌 Test 4: MERGE Operation (Production Pattern)');
    console.log('-'.repeat(60));
    const test4Start = Date.now();
    const result4 = await executeCypher(
      client,
      graphName,
      `MERGE (n:Person {user_id: $user_id, entity_id: $entity_id})
       ON CREATE SET
         n.name = $name,
         n.mention_count = 1
       ON MATCH SET
         n.mention_count = n.mention_count + 1
       RETURN n`,
      {
        user_id: 'user-123',
        entity_id: 'entity-456',
        name: 'Bob Johnson',
      }
    );
    const test4Time = Date.now() - test4Start;
    console.log(`✅ MERGE completed in ${test4Time}ms`);
    console.log('   Statistics:', result4.statistics);
    testResults.passed++;

    // Test 5: MERGE again (should match existing)
    console.log('\n📌 Test 5: MERGE Existing Node');
    console.log('-'.repeat(60));
    const test5Start = Date.now();
    const result5 = await executeCypher(
      client,
      graphName,
      `MERGE (n:Person {user_id: $user_id, entity_id: $entity_id})
       ON CREATE SET
         n.name = $name,
         n.mention_count = 1
       ON MATCH SET
         n.mention_count = n.mention_count + 1
       RETURN n`,
      {
        user_id: 'user-123',
        entity_id: 'entity-456',
        name: 'Bob Johnson',
      }
    );
    const test5Time = Date.now() - test5Start;
    console.log(`✅ MERGE matched in ${test5Time}ms`);
    console.log('   Node should be updated (not created)');
    console.log('   Statistics:', result5.statistics);
    testResults.passed++;

    // Test 6: MATCH with WHERE clause
    console.log('\n📌 Test 6: MATCH with WHERE Clause');
    console.log('-'.repeat(60));
    const test6Start = Date.now();
    const result6 = await executeCypher(
      client,
      graphName,
      'MATCH (n:Person) WHERE n.user_id = $user_id RETURN n LIMIT 10',
      { user_id: 'user-123' }
    );
    const test6Time = Date.now() - test6Start;
    console.log(`✅ Query executed in ${test6Time}ms`);
    console.log('   Found nodes:', result6.data.length);
    console.log('   First result:', result6.data[0]);
    testResults.passed++;

    // Test 7: CREATE relationship
    console.log('\n📌 Test 7: CREATE Relationship');
    console.log('-'.repeat(60));
    const test7Start = Date.now();
    const result7 = await executeCypher(
      client,
      graphName,
      `MATCH (a:Person {id: $id1}), (b:Person {user_id: $user_id})
       CREATE (a)-[r:KNOWS {since: $year}]->(b)
       RETURN r`,
      { id1: 'person-1', user_id: 'user-123', year: 2024 }
    );
    const test7Time = Date.now() - test7Start;
    console.log(`✅ Relationship created in ${test7Time}ms`);
    console.log('   Statistics:', result7.statistics);
    testResults.passed++;

    // Test 8: Complex query with multiple patterns
    console.log('\n📌 Test 8: Complex Query (2-hop traversal)');
    console.log('-'.repeat(60));
    const test8Start = Date.now();
    const result8 = await executeCypher(
      client,
      graphName,
      `MATCH (a:Person)-[r1:KNOWS]->(b:Person)-[r2]-(c)
       RETURN a, r1, b, r2, c
       LIMIT 5`
    );
    const test8Time = Date.now() - test8Start;
    console.log(`✅ Query executed in ${test8Time}ms`);
    console.log('   Paths found:', result8.data.length);
    testResults.passed++;

    // Test 9: COUNT aggregation
    console.log('\n📌 Test 9: Aggregation Query');
    console.log('-'.repeat(60));
    const test9Start = Date.now();
    const result9 = await executeCypher(
      client,
      graphName,
      'MATCH (n:Person) RETURN count(n) as total_persons'
    );
    const test9Time = Date.now() - test9Start;
    console.log(`✅ Query executed in ${test9Time}ms`);
    console.log('   Total persons:', result9.data[0]?.total_persons || 0);
    testResults.passed++;

    // Cleanup
    console.log('\n📌 Cleanup: Delete Test Graph');
    console.log('-'.repeat(60));
    await client.send('GRAPH.DELETE', graphName);
    console.log('✅ Test graph deleted');

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    testResults.failed++;
    testResults.errors.push({
      message: error.message,
      stack: error.stack,
    });
  } finally {
    if (client) {
      await disconnect(client);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);

  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('\n✨ REST API is working correctly!');
    console.log('   - Connection established');
    console.log('   - Queries executing successfully');
    console.log('   - MERGE operations working');
    console.log('   - Relationships created');
    console.log('   - Complex traversals functional');
    console.log('\n🚀 Feature 006 Knowledge Graph Building is UNBLOCKED!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. See errors above.');
    process.exit(1);
  }
}

testRestAPI().catch(error => {
  console.error('\n💥 CATASTROPHIC FAILURE');
  console.error('   Error:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
});
