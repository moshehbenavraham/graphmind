/**
 * Test creating a node directly in FalkorDB to see response format
 */

async function testCreateNode() {
  const url = 'https://graphmind-api.apex-web-services-llc-0d4.workers.dev/api/test/falkordb';
  const userId = 'bb0488f5-743d-4251-b75d-e6c0282becfc';

  // Simple MERGE query to create a test node
  const query = `
    MERGE (n:Person {user_id: $user_id, entity_id: 'test_person_001'})
    ON CREATE SET
      n.name = 'Test Person',
      n.first_mentioned = timestamp(),
      n.mention_count = 1
    ON MATCH SET
      n.mention_count = n.mention_count + 1
    RETURN n
  `.trim();

  console.log('=== Creating Test Node ===');
  console.log('Query:', query);
  console.log('User ID:', userId);
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        query
      })
    });

    const result = await response.json();
    console.log('=== Raw Response ===');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    // Check for metadata
    if (result.metadata) {
      console.log('=== Metadata ===');
      console.log(JSON.stringify(result.metadata, null, 2));
    }

    // Check for data
    if (result.data) {
      console.log('=== Data ===');
      console.log(JSON.stringify(result.data, null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

testCreateNode().catch(console.error);
