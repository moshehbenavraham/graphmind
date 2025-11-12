/**
 * Graph Init Endpoint
 *
 * Provisions user's isolated FalkorDB namespace on first access.
 * Requires JWT authentication and enforces per-user rate limiting.
 *
 * @module workers/api/graph/init
 */

import { rateLimitMiddleware, addRateLimitHeaders } from '../../../middleware/rateLimit.js';
import { requireAuth } from '../../../middleware/auth.js';

/**
 * Handle graph namespace initialization request
 *
 * POST /api/graph/init
 *
 * Creates or retrieves user's dedicated graph namespace:
 * 1. Validates JWT and extracts user ID
 * 2. Applies per-user rate limiting (10 req/min)
 * 3. Calls Durable Object to provision namespace
 * 4. Returns namespace info
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Worker environment bindings
 * @returns {Promise<Response>} Namespace info response
 */
export async function handleGraphInit(request, env) {
  try {
    // T056: Validate JWT and extract userId
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult; // Return 401 error response
    }

    const user = authResult;
    const userId = user.user_id;

    // T059: Apply rate limiting (10 requests/minute per user)
    const rateLimitResponse = await rateLimitMiddleware(request, env, 'graph:init', userId);
    if (rateLimitResponse) {
      return rateLimitResponse; // 429 Too Many Requests
    }

    // T057: Get Durable Object stub and call getOrCreateNamespace
    const id = env.FALKORDB_POOL.idFromName('pool');
    const stub = env.FALKORDB_POOL.get(id);

    // Call Durable Object with credentials
    const doRequest = new Request('http://do/namespace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          host: env.FALKORDB_HOST,
          port: env.FALKORDB_PORT,
          username: env.FALKORDB_USER || env.FALKORDB_USERNAME,
          password: env.FALKORDB_PASSWORD,
        },
        userId,
      }),
    });

    const doResponse = await stub.fetch(doRequest);
    const result = await doResponse.json();

    // T060: Handle errors (timeout, capacity exceeded → 507)
    if (doResponse.status >= 500) {
      return new Response(
        JSON.stringify({
          error: 'Service Unavailable',
          message: 'Graph database is currently unavailable',
          details: result.error || 'Connection timeout',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (doResponse.status === 507) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient Storage',
          message: 'Graph database capacity exceeded',
          details: 'Please contact support to upgrade your plan',
        }),
        {
          status: 507,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // T058: Return namespace info
    let response = new Response(
      JSON.stringify({
        namespace: result.namespace,
        created: result.created,
        timestamp: new Date().toISOString(),
      }),
      {
        status: result.created ? 201 : 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    // Add rate limit headers
    response = addRateLimitHeaders(response, request);

    return response;
  } catch (error) {
    // T060: Error handling
    console.error('[Graph Init] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to initialize graph namespace',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
