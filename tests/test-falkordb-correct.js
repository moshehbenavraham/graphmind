/**
 * Test FalkorDB connection with correct API
 */

import pkg from 'falkordb';
const { FalkorDB } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function testFalkorDB() {
  console.log('=== FalkorDB Connection Test (Correct API) ===\n');

  const host = process.env.FALKORDB_HOST;
  const port = process.env.FALKORDB_PORT;
  const username = process.env.FALKORDB_USER;
  const password = process.env.FALKORDB_PASSWORD;

  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`Username: ${username}`);
  console.log(`Password: ${password.substring(0, 4)}****\n`);

  // Test 1: Using FalkorDB.connect() with socket config
  console.log('Test 1: FalkorDB.connect() with TLS socket...');

  try {
    const db = await FalkorDB.connect({
      username,
      password,
      socket: {
        host,
        port: parseInt(port),
        tls: true,
        rejectUnauthorized: false,
        connectTimeout: 15000,
      }
    });

    console.log('✅ Connected!');

    // Try to list graphs
    const graphs = await db.list();
    console.log(`✅ Listed graphs:`, graphs);

    await db.close();
    console.log('✅ Closed connection\n');
    return true;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    console.log(`❌ Stack: ${error.stack?.substring(0, 200)}\n`);
  }

  // Test 2: Using URL format with TLS
  console.log('Test 2: FalkorDB.connect() with URL (rediss://)...');

  try {
    const url = `rediss://${username}:${password}@${host}:${port}`;
    const db = await FalkorDB.connect({
      url,
      socket: {
        tls: true,
        rejectUnauthorized: false,
        connectTimeout: 15000,
      }
    });

    console.log('✅ Connected!');

    const graphs = await db.list();
    console.log(`✅ Listed graphs:`, graphs);

    await db.close();
    console.log('✅ Closed connection\n');
    return true;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}\n`);
  }

  // Test 3: Without TLS
  console.log('Test 3: FalkorDB.connect() without TLS...');

  try {
    const db = await FalkorDB.connect({
      username,
      password,
      socket: {
        host,
        port: parseInt(port),
        connectTimeout: 15000,
      }
    });

    console.log('✅ Connected!');

    const graphs = await db.list();
    console.log(`✅ Listed graphs:`, graphs);

    await db.close();
    console.log('✅ Closed connection\n');
    return true;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}\n`);
  }

  return false;
}

testFalkorDB().then(success => {
  if (success) {
    console.log('🎉 Connection successful!');
    process.exit(0);
  } else {
    console.log('❌ All connection attempts failed');
    console.log('\nLikely issues:');
    console.log('1. IP whitelisting required in FalkorDB Cloud dashboard');
    console.log('2. Instance not running or suspended');
    console.log('3. Firewall blocking outbound connections on port', process.env.FALKORDB_PORT);
    process.exit(1);
  }
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
