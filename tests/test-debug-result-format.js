/**
 * Debug: Check the actual result format from REST API
 */

const { createRestClient } = require('../src/lib/falkordb/rest-client');

async function debugResultFormat() {
  console.log('🔍 DEBUG: Check REST API result format\n');

  const client = createRestClient({
    host: 'localhost',
    port: 3001,
    username: 'default',
    password: ''
  });

  const testUserId = 'test-user-123';
  const graphName = `graphmind_${testUserId}`;

  try {
    const query = `
      MATCH (n {user_id: $user_id})
      RETURN n, labels(n) as types
    `;

    console.log('Executing query...');
    const result = await client.query(graphName, query, { user_id: testUserId });

    console.log('\n📦 Raw result structure:');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n🔍 Result analysis:');
    console.log(`- Type: ${typeof result}`);
    console.log(`- Is Array: ${Array.isArray(result)}`);
    console.log(`- Length: ${result?.length}`);

    if (Array.isArray(result) && result.length > 0) {
      console.log('\n🔍 First element:');
      console.log(`- Type: ${typeof result[0]}`);
      console.log(`- Is Array: ${Array.isArray(result[0])}`);
      console.log(`- Content:`, JSON.stringify(result[0], null, 2));

      if (result.length > 1) {
        console.log('\n🔍 Second element:');
        console.log(`- Type: ${typeof result[1]}`);
        console.log(`- Is Array: ${Array.isArray(result[1])}`);
        console.log(`- Length: ${result[1]?.length}`);

        if (Array.isArray(result[1]) && result[1].length > 0) {
          console.log('\n🔍 First row:');
          console.log(JSON.stringify(result[1][0], null, 2));
        }
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
    throw error;
  }
}

debugResultFormat()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
