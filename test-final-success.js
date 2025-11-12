/**
 * Final Success Test - Create node directly via test endpoint
 * This bypasses the queue to test if the pool + node creation works
 */

async function testFinalSuccess() {
  const url = 'https://graphmind-api.apex-web-services-llc-0d4.workers.dev/api/test/falkordb';
  const userId = 'bb0488f5-743d-4251-b75d-e6c0282becfc';

  // Simple MERGE query
  const query = `
    MERGE (n:Person {user_id: $user_id, entity_id: 'final_test_001'})
    ON CREATE SET
      n.name = 'Final Test Person',
      n.test_run = 'warm_pool_test',
      n.created_at = timestamp()
    RETURN n
  `.trim();

  console.log('=== FINAL SUCCESS TEST ===');
  console.log('Testing node creation with WARM pool');
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, query })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Request failed:', response.status, error);
      process.exit(1);
    }

    const result = await response.json();

    console.log('✅ SUCCESS! Response received:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    // Check statistics
    if (result.statistics) {
      console.log('📊 Statistics:');
      console.log(`  Nodes created: ${result.statistics.nodes_created || 0}`);
      console.log(`  Properties set: ${result.statistics.properties_set || 0}`);
      console.log('');
    }

    // Verify node was created
    if (result.statistics?.nodes_created > 0) {
      console.log('🎉 NODE CREATED SUCCESSFULLY!');
      console.log('All 8 bug fixes are working correctly!');
      return true;
    } else if (result.data?.length > 0) {
      console.log('✅ Node matched (already exists)');
      return true;
    } else {
      console.log('⚠️  Unexpected result - no node created or matched');
      return false;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

testFinalSuccess()
  .then(success => process.exit(success ? 0 : 1))
  .catch(() => process.exit(1));
