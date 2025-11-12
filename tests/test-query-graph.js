/**
 * Test script to query FalkorDB graph directly
 */

async function queryGraph() {
  const url = 'https://graphmind-api.apex-web-services-llc-0d4.workers.dev/api/test/falkordb';

  const userId = 'bb0488f5-743d-4251-b75d-e6c0282becfc';

  // Query to count all nodes for this user
  const countQuery = `MATCH (n {user_id: $userId}) RETURN count(n) as node_count`;

  // Query to get all nodes for this user
  const allNodesQuery = `MATCH (n {user_id: $userId}) RETURN n, labels(n) as types LIMIT 20`;

  console.log('Querying FalkorDB for user:', userId);
  console.log('');

  // Count nodes
  console.log('=== Counting Nodes ===');
  const countResponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      query: countQuery
    })
  });

  const countResult = await countResponse.json();
  console.log('Count result:', JSON.stringify(countResult, null, 2));
  console.log('');

  // Get all nodes
  console.log('=== Getting All Nodes ===');
  const nodesResponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      query: allNodesQuery
    })
  });

  const nodesResult = await nodesResponse.json();
  console.log('Nodes result:', JSON.stringify(nodesResult, null, 2));
}

queryGraph().catch(console.error);
