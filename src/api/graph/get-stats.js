/**
 * GET /api/graph/stats
 *
 * Get knowledge graph statistics.
 *
 * @module api/graph/get-stats
 */

import { buildGetGraphStats } from '../../lib/graph/cypher-builder.js';

/**
 * Handle GET /api/graph/stats request
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} user - Authenticated user from JWT middleware
 * @returns {Promise<Response>} HTTP response
 */
export async function handleGetGraphStats(request, env, user) {
  try {
    const startTime = Date.now();

    // Check cache (5 minute TTL)
    const cacheKey = `graph:stats:${user.userId}`;
    const cached = await env.KV.get(cacheKey, { type: 'json' });

    if (cached) {
      return new Response(JSON.stringify({
        ...cached,
        meta: {
          ...cached.meta,
          cached: true,
          query_time_ms: Date.now() - startTime,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build Cypher query
    const { cypher } = buildGetGraphStats();

    // Execute query via FalkorDB connection pool
    const doId = env.FALKORDB_POOL.idFromName('pool');
    const doStub = env.FALKORDB_POOL.get(doId);

    const response = await doStub.fetch('http://do/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.userId,
        cypher,
        params: { user_id: user.userId },
        config: {
          host: env.FALKORDB_HOST,
          port: parseInt(env.FALKORDB_PORT),
          username: env.FALKORDB_USER,
          password: env.FALKORDB_PASSWORD,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`FalkorDB query failed: ${error}`);
    }

    const result = await response.json();

    // Format response
    const [nodeCount, relCount, entityBreakdown, mostConnected] = result.data?.[0] || [0, 0, [], []];

    const responseData = {
      data: {
        node_count: nodeCount || 0,
        relationship_count: relCount || 0,
        entity_breakdown: (entityBreakdown || []).reduce((acc, item) => {
          acc[item.type] = item.count;
          return acc;
        }, {}),
        most_connected: mostConnected || [],
        last_sync: new Date().toISOString(),
      },
      meta: {
        query_time_ms: Date.now() - startTime,
        cached: false,
      },
    };

    // Cache result (5 minutes)
    await env.KV.put(cacheKey, JSON.stringify(responseData), {
      expirationTtl: 300, // 5 minutes
    });

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[GetGraphStats] Error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'STATS_QUERY_FAILED',
        message: error.message,
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
