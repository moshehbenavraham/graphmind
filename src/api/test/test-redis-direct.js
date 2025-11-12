/**
 * Test Direct Redis Connection
 * Bypasses DO to test redis-on-workers directly
 */

import { createRedis } from 'redis-on-workers';

export async function handleTestRedisDirect(request, env) {
  try {
    console.log('[TestRedisDirect] Starting direct Redis test...');

    // Build Redis URL
    const host = env.FALKORDB_HOST;
    const port = env.FALKORDB_PORT;
    const username = env.FALKORDB_USER;
    const password = env.FALKORDB_PASSWORD;
    const useTLS = host.includes('.cloud');
    const protocol = useTLS ? 'rediss' : 'redis';
    const url = `${protocol}://${username}:${password}@${host}:${port}`;

    console.log('[TestRedisDirect] Connecting to', { host, port, useTLS });

    // Create Redis client
    const client = createRedis(url, { tls: useTLS });

    // Test 1: PING
    console.log('[TestRedisDirect] Testing PING...');
    const pingResult = await client.send('PING');
    console.log('[TestRedisDirect] PING result:', pingResult);

    // Test 2: GRAPH.LIST
    console.log('[TestRedisDirect] Testing GRAPH.LIST...');
    const listResult = await client.send('GRAPH.LIST');
    console.log('[TestRedisDirect] GRAPH.LIST result:', listResult);

    // Test 3: Simple GRAPH.QUERY
    console.log('[TestRedisDirect] Testing GRAPH.QUERY...');
    const graphName = 'test_graph';
    const query = 'RETURN 1 as num';
    console.log('[TestRedisDirect] Executing:', { graphName, query });

    const queryResult = await client.send('GRAPH.QUERY', graphName, query);
    console.log('[TestRedisDirect] GRAPH.QUERY result:', JSON.stringify(queryResult));

    // Close connection
    await client.close();

    return new Response(JSON.stringify({
      success: true,
      ping: pingResult,
      graphs: listResult,
      queryResult: queryResult
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[TestRedisDirect] Error:', error);

    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
