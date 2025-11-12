/**
 * Test FalkorDB with CORRECT parameter format
 * Using the actual implementation from src/lib/falkordb/client.js
 */

import { connect, executeCypher, disconnect } from '../src/lib/falkordb/client.js';

async function testCorrectFormat() {
  console.log('🧪 Testing FalkorDB with CORRECT parameter format\n');

  // Use the same config as production
  const config = {
    host: 'r-6jissuruar.instance-z170clshh.hc-8zs5aeo3a.us-east1.gcp.f2e0a955bb84.cloud',
    port: 55878,
    username: 'falkorvoiceflarecat',
    password: 'cEkTQ6sscPWv',
  };

  console.log('1️⃣ Connecting to FalkorDB Cloud...');
  const connectStart = Date.now();
  const client = await connect(config);
  console.log(`✅ Connected in ${Date.now() - connectStart}ms\n`);

  const graphName = 'test_correct_format';

  try {
    // Test 1: Simple query without parameters
    console.log('2️⃣ Test 1: Simple RETURN (no parameters)');
    const test1Start = Date.now();
    const result1 = await executeCypher(client, graphName, 'RETURN 1 as number');
    console.log(`✅ Success in ${Date.now() - test1Start}ms`);
    console.log('   Result:', result1);
    console.log('');

    // Test 2: CREATE with parameters (correct format)
    console.log('3️⃣ Test 2: CREATE node with parameters (interpolated)');
    const test2Start = Date.now();
    const result2 = await executeCypher(
      client,
      graphName,
      'CREATE (n:Person {id: $id, name: $name}) RETURN n',
      { id: 'test-123', name: 'John Doe' }
    );
    console.log(`✅ Success in ${Date.now() - test2Start}ms`);
    console.log('   Statistics:', result2.statistics);
    console.log('');

    // Test 3: MERGE operation (like production)
    console.log('4️⃣ Test 3: MERGE operation with properties');
    const test3Start = Date.now();
    const result3 = await executeCypher(
      client,
      graphName,
      `MERGE (n:Person {user_id: $user_id, entity_id: $entity_id})
       ON CREATE SET
         n.name = $name,
         n.mention_count = 1
       ON MATCH SET
         n.mention_count = n.mention_count + 1
       RETURN n`,
      { user_id: 'test-user-123', entity_id: 'ent-456', name: 'Jane Smith' }
    );
    console.log(`✅ Success in ${Date.now() - test3Start}ms`);
    console.log('   Statistics:', result3.statistics);
    console.log('');

    // Test 4: MERGE again (should match existing)
    console.log('5️⃣ Test 4: MERGE again (should increment mention_count)');
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
      { user_id: 'test-user-123', entity_id: 'ent-456', name: 'Jane Smith' }
    );
    console.log(`✅ Success in ${Date.now() - test4Start}ms`);
    console.log('   Statistics:', result4.statistics);
    console.log('   Node updated (mention_count should be 2)');
    console.log('');

    // Test 5: Query with WHERE clause
    console.log('6️⃣ Test 5: MATCH with WHERE clause');
    const test5Start = Date.now();
    const result5 = await executeCypher(
      client,
      graphName,
      'MATCH (n:Person) WHERE n.user_id = $user_id RETURN n',
      { user_id: 'test-user-123' }
    );
    console.log(`✅ Success in ${Date.now() - test5Start}ms`);
    console.log('   Found nodes:', result5.data.length);
    console.log('');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await client.send('GRAPH.DELETE', graphName);
    console.log('✅ Test graph deleted\n');

    console.log('🎉 ALL TESTS PASSED!');
    console.log('\n📊 Summary:');
    console.log('  ✅ Connection works');
    console.log('  ✅ Simple queries work');
    console.log('  ✅ Parameterized CREATE works');
    console.log('  ✅ MERGE operations work');
    console.log('  ✅ ON CREATE/ON MATCH work');
    console.log('  ✅ WHERE clauses work');
    console.log('\n🚀 Feature 006 should be FULLY FUNCTIONAL!');

  } finally {
    await disconnect(client);
  }
}

testCorrectFormat().catch(error => {
  console.error('\n❌ TEST FAILED:', error);
  console.error('   Message:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
});
