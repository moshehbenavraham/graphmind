/**
 * Check what nodes actually exist in the graph
 */

const { createRestClient } = require('../src/lib/falkordb/rest-client');

async function checkAllNodes() {
  console.log('🔍 CHECK: What nodes exist in the graph?\n');

  const client = createRestClient({
    host: 'localhost',
    port: 3001,
    username: 'default',
    password: ''
  });

  const testUserId = 'test-user-123';
  // Use the graph name from E2E test
  const graphName = `test_user_123`;

  try {
    // Query 1: All nodes (no filter)
    console.log('Query 1: All nodes in graph (no user_id filter)');
    const allQuery = `MATCH (n) RETURN n, labels(n) as types LIMIT 10`;
    const allResult = await client.query(graphName, allQuery, {});

    console.log('Result format:', {
      headers: allResult[0],
      rowCount: allResult[1].length,
      statistics: allResult[2]
    });

    if (allResult[1].length > 0) {
      console.log('\n✅ Found nodes:');
      allResult[1].forEach((row, idx) => {
        console.log(`\n  Node ${idx + 1}:`);
        console.log(`    Raw row:`, JSON.stringify(row, null, 2));
      });
    } else {
      console.log('❌ No nodes found in graph at all');
    }

    // Query 2: Check if graph exists
    console.log('\n\nQuery 2: Check graph list');
    const graphs = await client.send('GRAPH.LIST');
    console.log('Available graphs:', graphs);

  } catch (error) {
    console.error('❌ Check failed:', error);
    throw error;
  }
}

checkAllNodes()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
