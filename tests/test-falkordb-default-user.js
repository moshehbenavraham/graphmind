/**
 * Test FalkorDB with default username
 */

import pkg from 'falkordb';
const { FalkorDB } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function testFalkorDB() {
  console.log('=== Testing with "default" username ===\n');

  const host = process.env.FALKORDB_HOST;
  const port = process.env.FALKORDB_PORT;
  const password = process.env.FALKORDB_PASSWORD;

  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`Username: default`);
  console.log(`Password: ${password.substring(0, 4)}****\n`);

  const configs = [
    {
      name: 'Socket with TLS',
      config: {
        username: 'default',
        password,
        socket: {
          host,
          port: parseInt(port),
          tls: true,
          rejectUnauthorized: false,
          connectTimeout: 15000,
        }
      }
    },
    {
      name: 'Socket without TLS',
      config: {
        username: 'default',
        password,
        socket: {
          host,
          port: parseInt(port),
          connectTimeout: 15000,
        }
      }
    },
    {
      name: 'URL with TLS (rediss://)',
      config: {
        url: `rediss://default:${password}@${host}:${port}`,
        socket: {
          tls: true,
          rejectUnauthorized: false,
          connectTimeout: 15000,
        }
      }
    },
    {
      name: 'URL without TLS (redis://)',
      config: {
        url: `redis://default:${password}@${host}:${port}`,
        socket: {
          connectTimeout: 15000,
        }
      }
    },
  ];

  for (const testConfig of configs) {
    console.log(`\nTrying: ${testConfig.name}...`);
    try {
      const db = await FalkorDB.connect(testConfig.config);
      console.log('✅ CONNECTED!');

      const graphs = await db.list();
      console.log(`✅ Listed graphs:`, graphs);

      await db.close();
      console.log('✅ Success!\n');
      return true;
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }

  return false;
}

testFalkorDB().then(success => {
  if (success) {
    console.log('\n🎉 Connection successful!');
    process.exit(0);
  } else {
    console.log('\n❌ All attempts failed');
    console.log('\nNext steps:');
    console.log('1. Check dashboard for "Redis Endpoint" (might be different from web endpoint)');
    console.log('2. Look for "Connection String" button that shows exact Redis URL');
    console.log('3. Check if there\'s a separate "Redis Port" or "Protocol Port" setting');
    console.log('4. Verify the credentials are for Redis protocol, not HTTP auth');
    process.exit(1);
  }
});
