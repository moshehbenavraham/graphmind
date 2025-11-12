/**
 * Test simple Cypher query
 */

export async function handleTestSimpleCypher(request, env) {
  try {
    console.log('[TestSimpleCypher] Starting test...');
    const doId = env.FALKORDB_POOL.idFromName('pool');
    const doStub = env.FALKORDB_POOL.get(doId);
    console.log('[TestSimpleCypher] Got DO stub');

    const userId = 'test-user';

    // Test 1: Absolute simplest query - no parameters
    const operations = [{
      cypher: 'RETURN 1 as num',
      params: {}
    }];

    console.log('[TestSimpleCypher] Calling DO execute-batch...');
    const response = await doStub.fetch('http://do/execute-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        operations,
        config: {
          host: env.FALKORDB_HOST,
          port: parseInt(env.FALKORDB_PORT),
          username: env.FALKORDB_USER,
          password: env.FALKORDB_PASSWORD,
        },
      }),
    });

    console.log('[TestSimpleCypher] DO response status:', response.status);
    const text = await response.text();
    console.log('[TestSimpleCypher] DO response body:', text.substring(0, 200));

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      body: text
    }), {
      status: response.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
