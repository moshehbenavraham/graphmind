/**
 * Test FalkorDB connection using URL format
 */

import pkg from 'falkordb';
const { createClient } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function testFalkorDB() {
  console.log('=== FalkorDB Connection Test (URL Format) ===\n');

  const host = process.env.FALKORDB_HOST;
  const port = process.env.FALKORDB_PORT;
  const username = process.env.FALKORDB_USER;
  const password = process.env.FALKORDB_PASSWORD;

  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`Username: ${username}`);
  console.log(`Password: ${password.substring(0, 4)}****\n`);

  // Test 1: URL with rediss:// (TLS)
  console.log('Test 1: Trying with TLS (rediss://)...');
  const urlTLS = `rediss://${username}:${password}@${host}:${port}`;

  try {
    const client = createClient({
      url: urlTLS,
      socket: {
        connectTimeout: 10000,
        tls: true,
        rejectUnauthorized: false,
      }
    });

    client.on('error', err => console.log('Client Error:', err.message));

    await client.connect();
    console.log('✅ Connected with TLS!');

    const pong = await client.ping();
    console.log(`✅ PING: ${pong}`);

    // Try GRAPH.LIST to see graphs
    const graphs = await client.sendCommand(['GRAPH.LIST']);
    console.log(`✅ GRAPH.LIST:`, graphs);

    await client.disconnect();
    console.log('✅ Disconnected\n');
    return true;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    console.log(`❌ Code: ${error.code}\n`);
  }

  // Test 2: URL without TLS (redis://)
  console.log('Test 2: Trying without TLS (redis://)...');
  const urlNoTLS = `redis://${username}:${password}@${host}:${port}`;

  try {
    const client = createClient({
      url: urlNoTLS,
      socket: {
        connectTimeout: 10000,
      }
    });

    client.on('error', err => console.log('Client Error:', err.message));

    await client.connect();
    console.log('✅ Connected without TLS!');

    const pong = await client.ping();
    console.log(`✅ PING: ${pong}`);

    // Try GRAPH.LIST
    const graphs = await client.sendCommand(['GRAPH.LIST']);
    console.log(`✅ GRAPH.LIST:`, graphs);

    await client.disconnect();
    console.log('✅ Disconnected\n');
    return true;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    console.log(`❌ Code: ${error.code}\n`);
  }

  // Test 3: Manual socket config with TLS
  console.log('Test 3: Trying manual socket config with TLS...');

  try {
    const client = createClient({
      socket: {
        host,
        port: parseInt(port),
        tls: true,
        rejectUnauthorized: false,
        connectTimeout: 10000,
      },
      username,
      password,
    });

    client.on('error', err => console.log('Client Error:', err.message));

    await client.connect();
    console.log('✅ Connected with manual TLS config!');

    const pong = await client.ping();
    console.log(`✅ PING: ${pong}`);

    // Try GRAPH.LIST
    const graphs = await client.sendCommand(['GRAPH.LIST']);
    console.log(`✅ GRAPH.LIST:`, graphs);

    await client.disconnect();
    console.log('✅ Disconnected\n');
    return true;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    console.log(`❌ Code: ${error.code}\n`);
  }

  return false;
}

testFalkorDB().then(success => {
  if (success) {
    console.log('🎉 Connection successful!');
    process.exit(0);
  } else {
    console.log('❌ All connection attempts failed');
    console.log('\nCheck:');
    console.log('1. FalkorDB Cloud dashboard - instance status');
    console.log('2. IP whitelisting in dashboard security settings');
    console.log('3. Correct credentials in .env file');
    process.exit(1);
  }
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
