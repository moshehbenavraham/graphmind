/**
 * Test Endpoint: Initialize Connection Pool
 *
 * Triggers initial config persistence in the Durable Object
 */

/**
 * Initialize connection pool with config
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Promise<Response>} JSON response
 */
export async function handleInitPool(request, env) {
  try {
    // Get Durable Object stub
    const doId = env.FALKORDB_POOL.idFromName('pool');
    const doStub = env.FALKORDB_POOL.get(doId);

    // Send POST health check with config to persist it
    const healthUrl = new URL('http://do/health');
    const healthReq = new Request(healthUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: env.FALKORDB_HOST,
        port: parseInt(env.FALKORDB_PORT),
        username: env.FALKORDB_USER,
        password: env.FALKORDB_PASSWORD,
      })
    });

    console.log('[InitPool] Sending config to DO');
    const response = await doStub.fetch(healthReq);
    const data = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pool initialized with config',
        data
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[InitPool] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to initialize pool',
        details: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
