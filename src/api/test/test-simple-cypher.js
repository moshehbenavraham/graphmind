/**
 * Test simple Cypher query
 */

import { badRequestError, internalServerError } from '../../utils/errors.js';

export async function handleTestSimpleCypher(request, env) {
  try {
    console.log('[TestSimpleCypher] Starting test...');
    const body = await request.json();
    const { userId, cypher } = body;

    if (!userId) {
      return badRequestError('Missing userId in request body');
    }

    const doId = env.FALKORDB_POOL.idFromName('pool');
    const doStub = env.FALKORDB_POOL.get(doId);
    console.log('[TestSimpleCypher] Got DO stub');

    // Use provided cypher or default test query
    const operations = [{
      cypher: cypher || 'RETURN 1 as num',
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
          apiKey: env.FALKORDB_REST_API_KEY,
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
    console.error('[TestSimpleCypher] Error:', error);
    return internalServerError(error.message);
  }
}
