/**
 * Test Endpoint: Check Connection Pool Warmup Status
 *
 * Diagnostic endpoint to verify Feature 007 alarm-based warmup is working
 */

/**
 * Check warmup status of connection pool
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Promise<Response>} JSON response
 */
export async function handleCheckPoolWarmup(request, env) {
  try {
    // Get Durable Object stub
    const doId = env.FALKORDB_POOL.idFromName('pool');
    const doStub = env.FALKORDB_POOL.get(doId);

    // Call health check endpoint
    const healthUrl = new URL('http://do/health');
    const healthReq = new Request(healthUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const startTime = Date.now();
    const response = await doStub.fetch(healthReq);
    const latency = Date.now() - startTime;

    const data = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...data,
          healthCheckLatency: latency
        },
        diagnostics: {
          message: data.warmupState === 'ready'
            ? '✅ Pool is warm and ready'
            : data.warmupState === 'in_progress'
            ? '⏳ Warmup in progress...'
            : '❌ Pool is cold',
          recommendation: data.poolSize > 0
            ? 'Pool has connections, should be fast'
            : 'No connections yet - alarm may not have fired'
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[CheckPoolWarmup] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to check pool warmup',
        details: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
