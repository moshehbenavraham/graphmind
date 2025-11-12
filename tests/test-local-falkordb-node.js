// Test local FalkorDB with Node.js
import { createClient } from 'redis';

async function test() {
  const client = createClient({
    socket: {
      host: 'localhost',
      port: 6380
    }
  });

  client.on('error', err => console.log('Redis Client Error', err));

  await client.connect();
  console.log('✅ Connected to local FalkorDB');

  const pong = await client.ping();
  console.log('PING response:', pong);

  // Test graph command
  const result = await client.sendCommand([
    'GRAPH.QUERY',
    'test-connection',
    'CREATE (n:ConnectionTest {timestamp: timestamp()}) RETURN n'
  ]);
  console.log('Graph command result:', result);

  await client.sendCommand(['GRAPH.DELETE', 'test-connection']);
  console.log('✅ Test graph deleted');

  await client.quit();
  console.log('✅ All tests passed! Local FalkorDB is ready.');
}

test().catch(console.error);
