/**
 * Direct FalkorDB connection test
 * Get actual performance data from our instance
 */

import { createClient } from 'redis';

async function testFalkorDB() {
  const config = {
    socket: {
      host: 'r-6jissuruar.instance-z170clshh.hc-8zs5aeo3a.us-east1.gcp.f2e0a955bb84.cloud',
      port: 55878,
    },
    username: 'falkorvoiceflarecat',
    password: 'cEkTQ6sscPWv',
  };

  console.log('🔌 Connecting to FalkorDB Cloud...');
  const connectStart = Date.now();

  const client = createClient(config);

  client.on('error', (err) => console.error('Redis Client Error', err));

  await client.connect();
  const connectTime = Date.now() - connectStart;
  console.log(`✅ Connected in ${connectTime}ms\n`);

  // Get server info
  console.log('📊 Getting server info...');
  const info = await client.info();

  // Parse relevant info
  const lines = info.split('\n');
  const serverInfo = {};
  for (const line of lines) {
    if (line.includes(':')) {
      const [key, value] = line.split(':');
      serverInfo[key.trim()] = value.trim();
    }
  }

  console.log('Server Information:');
  console.log('  Redis Version:', serverInfo.redis_version || 'N/A');
  console.log('  OS:', serverInfo.os || 'N/A');
  console.log('  Uptime (days):', Math.floor((serverInfo.uptime_in_seconds || 0) / 86400));
  console.log('  Connected Clients:', serverInfo.connected_clients || 'N/A');
  console.log('  Used Memory:', serverInfo.used_memory_human || 'N/A');
  console.log('  Max Memory:', serverInfo.maxmemory_human || 'N/A');
  console.log('');

  // Test simple query performance
  const graphName = 'test_graph';

  console.log('🧪 Testing query performance...\n');

  // Test 1: Simple RETURN query
  const test1Start = Date.now();
  await client.sendCommand(['GRAPH.QUERY', graphName, 'RETURN 1']);
  const test1Time = Date.now() - test1Start;
  console.log(`Test 1 - Simple RETURN: ${test1Time}ms`);

  // Test 2: Create a node
  const test2Start = Date.now();
  await client.sendCommand(['GRAPH.QUERY', graphName,
    'CREATE (n:TestNode {id: $id, name: $name}) RETURN n',
    'CYPHER', 'id', '1', 'name', 'Test'
  ]);
  const test2Time = Date.now() - test2Start;
  console.log(`Test 2 - CREATE node: ${test2Time}ms`);

  // Test 3: MERGE operation (like we use)
  const test3Start = Date.now();
  await client.sendCommand(['GRAPH.QUERY', graphName,
    'MERGE (n:Person {entity_id: $entity_id}) ON CREATE SET n.name = $name RETURN n',
    'CYPHER', 'entity_id', 'test-123', 'name', 'John Doe'
  ]);
  const test3Time = Date.now() - test3Start;
  console.log(`Test 3 - MERGE operation: ${test3Time}ms`);

  // Test 4: MERGE again (should be faster, already exists)
  const test4Start = Date.now();
  await client.sendCommand(['GRAPH.QUERY', graphName,
    'MERGE (n:Person {entity_id: $entity_id}) ON CREATE SET n.name = $name RETURN n',
    'CYPHER', 'entity_id', 'test-123', 'name', 'John Doe'
  ]);
  const test4Time = Date.now() - test4Start;
  console.log(`Test 4 - MERGE (existing): ${test4Time}ms`);

  // Test 5: Complex MERGE with multiple properties (like production)
  const test5Start = Date.now();
  await client.sendCommand(['GRAPH.QUERY', graphName,
    `MERGE (n:Person {user_id: $user_id, entity_id: $entity_id})
     ON CREATE SET
       n.name = $name,
       n.first_mentioned = timestamp(),
       n.mention_count = 1,
       n.last_updated = timestamp()
     ON MATCH SET
       n.mention_count = n.mention_count + 1,
       n.last_updated = timestamp()
     RETURN n`,
    'CYPHER',
    'user_id', 'test-user-123',
    'entity_id', 'test-456',
    'name', 'Jane Smith'
  ]);
  const test5Time = Date.now() - test5Start;
  console.log(`Test 5 - Complex MERGE (production-like): ${test5Time}ms`);

  // Test 6: Batch of 5 MERGE operations
  console.log('\n🔄 Testing batch operations...');
  const batchStart = Date.now();
  for (let i = 0; i < 5; i++) {
    await client.sendCommand(['GRAPH.QUERY', graphName,
      'MERGE (n:Person {entity_id: $entity_id}) ON CREATE SET n.name = $name RETURN n',
      'CYPHER', 'entity_id', `batch-${i}`, 'name', `Person ${i}`
    ]);
  }
  const batchTime = Date.now() - batchStart;
  console.log(`Batch of 5 MERGE operations: ${batchTime}ms (avg: ${Math.round(batchTime/5)}ms per op)`);

  // Cleanup
  console.log('\n🧹 Cleaning up test data...');
  await client.sendCommand(['GRAPH.DELETE', graphName]);

  await client.disconnect();

  console.log('\n📈 Summary:');
  console.log('  Connection Time:', `${connectTime}ms`);
  console.log('  Simple Query:', `${test1Time}ms`);
  console.log('  CREATE:', `${test2Time}ms`);
  console.log('  MERGE (new):', `${test3Time}ms`);
  console.log('  MERGE (existing):', `${test4Time}ms`);
  console.log('  Complex MERGE:', `${test5Time}ms`);
  console.log('  Batch (5 ops):', `${batchTime}ms`);
  console.log('  Estimated time for 5 nodes + 4 relationships:', `~${Math.round((test5Time * 9) / 1000)}s`);
}

testFalkorDB().catch(console.error);
