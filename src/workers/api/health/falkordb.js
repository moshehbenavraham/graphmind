/**
 * FalkorDB Health Check Endpoint
 *
 * Provides diagnostic health check for FalkorDB connection status.
 * Public endpoint with global rate limiting.
 *
 * @module workers/api/health/falkordb
 */

import { rateLimitMiddleware, addRateLimitHeaders } from '../../../middleware/rateLimit.js';

/**
 * Handle FalkorDB health check request
 *
 * GET /api/health/falkordb
 *
 * Tests FalkorDB connection by:
 * 1. Getting connection from pool via Durable Object
 * 2. Measuring connection latency
 * 3. Returning health status
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Worker environment bindings
 * @returns {Promise<Response>} Health check response
 */
export async function handleFalkorDBHealth(request, env) {
  // T035: Apply rate limiting (60 requests/minute global)
  const rateLimitResponse = await rateLimitMiddleware(request, env, 'health:falkordb');
  if (rateLimitResponse) {
    return rateLimitResponse; // 429 Too Many Requests
  }

  try {
    // T033: Measure latency
    const startTime = Date.now();

    // T031: Get Durable Object stub for connection pool
    const id = env.FALKORDB_POOL.idFromName('default-pool');
    const stub = env.FALKORDB_POOL.get(id);

    // T032: Execute health query
    // Pass FalkorDB credentials to Durable Object
    const doRequest = new Request('http://do/health', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        host: env.FALKORDB_HOST,
        port: env.FALKORDB_PORT,
        username: env.FALKORDB_USER || env.FALKORDB_USERNAME,
        password: env.FALKORDB_PASSWORD,
      }),
    });

    // Call Durable Object health check
    const doResponse = await stub.fetch(doRequest);
    const health = await doResponse.json();

    // T033: Calculate total latency (includes DO communication + FalkorDB query)
    const latency = Date.now() - startTime;

    // Determine overall health status based on latency and DO response
    let status = 'healthy';
    let httpStatus = 200;

    if (doResponse.status >= 500) {
      // T034: Handle connection failures → 503
      status = 'down';
      httpStatus = 503;
    } else if (latency > 1000) {
      // Degraded if latency exceeds 1 second
      status = 'degraded';
      httpStatus = 200; // Still 200, but with degraded status
    }

    // Build response with health status
    let response = new Response(
      JSON.stringify({
        status: status,
        latency_ms: latency,
        timestamp: new Date().toISOString(),
        details: health.error || (status === 'degraded' ? 'High latency detected' : undefined),
        pool: {
          size: health.poolSize,
          available: health.availableConnections,
        },
      }),
      {
        status: httpStatus,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Add rate limit headers to response
    response = addRateLimitHeaders(response, request);

    return response;
  } catch (error) {
    // T034: Handle errors (timeout, connection failure, etc.)
    console.error('[FalkorDB Health] Health check failed:', error);

    let response = new Response(
      JSON.stringify({
        status: 'down',
        details: error.message || 'Connection timeout',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Add rate limit headers even to error responses
    response = addRateLimitHeaders(response, request);

    return response;
  }
}
