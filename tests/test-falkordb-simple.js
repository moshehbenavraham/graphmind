/**
 * Simple FalkorDB connection diagnostic
 */

import { createClient } from 'redis';
import { config } from 'dotenv';
config();

const configs = [
  {
    name: 'With TLS + Username from env',
    config: {
      socket: {
        host: process.env.FALKORDB_HOST,
        port: parseInt(process.env.FALKORDB_PORT),
        tls: true,
        rejectUnauthorized: false, // Try with relaxed TLS first
        connectTimeout: 10000,
      },
      username: process.env.FALKORDB_USER,
      password: process.env.FALKORDB_PASSWORD,
    },
  },
  {
    name: 'With TLS + default username',
    config: {
      socket: {
        host: process.env.FALKORDB_HOST,
        port: parseInt(process.env.FALKORDB_PORT),
        tls: true,
        rejectUnauthorized: false,
        connectTimeout: 10000,
      },
      username: 'default',
      password: process.env.FALKORDB_PASSWORD,
    },
  },
  {
    name: 'Without TLS + Username from env',
    config: {
      socket: {
        host: process.env.FALKORDB_HOST,
        port: parseInt(process.env.FALKORDB_PORT),
        tls: false,
        connectTimeout: 10000,
      },
      username: process.env.FALKORDB_USER,
      password: process.env.FALKORDB_PASSWORD,
    },
  },
  {
    name: 'URL format',
    url: `redis://${process.env.FALKORDB_USER}:${process.env.FALKORDB_PASSWORD}@${process.env.FALKORDB_HOST}:${process.env.FALKORDB_PORT}`,
  },
];

async function testConnection(testConfig) {
  console.log(`\n🔍 Testing: ${testConfig.name}`);
  console.log(`   Host: ${process.env.FALKORDB_HOST}`);
  console.log(`   Port: ${process.env.FALKORDB_PORT}`);

  let client;
  try {
    if (testConfig.url) {
      client = createClient({ url: testConfig.url });
    } else {
      client = createClient(testConfig.config);
    }

    console.log('   ⏳ Connecting...');
    await client.connect();

    console.log('   ✅ Connected successfully!');

    // Try PING
    const pong = await client.ping();
    console.log(`   ✅ PING: ${pong}`);

    // Try INFO
    const info = await client.info();
    console.log(`   ✅ INFO: ${info.substring(0, 100)}...`);

    await client.quit();
    return true;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    console.log(`   ❌ Code: ${error.code}`);
    if (client) {
      try { await client.disconnect(); } catch (e) {}
    }
    return false;
  }
}

console.log('=== FalkorDB Connection Diagnostics ===');
console.log('\nTesting multiple connection configurations...\n');

for (const testConfig of configs) {
  const success = await testConnection(testConfig);
  if (success) {
    console.log('\n🎉 SUCCESS! Use this configuration.\n');
    break;
  }
}

console.log('\n=== Diagnostic Complete ===');
console.log('\nIf all tests failed, check:');
console.log('1. FalkorDB dashboard - is instance running?');
console.log('2. IP whitelisting - does your IP need to be added?');
console.log('3. Connection details - copy exact details from dashboard');
console.log('4. Firewall - is port 55878 allowed outbound?');
