/**
 * GET /api/graph/stats
 *
 * Get knowledge graph statistics.
 *
 * @module api/graph/get-stats
 */

import { buildGetGraphStats } from '../../lib/graph/cypher-builder.js';
import { executeStatsWithCache } from '../../lib/graph/stats-cache.js';

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
    // Use stats cache wrapper for automatic caching
    const result = await executeStatsWithCache(env.KV, user.userId, async () => {
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

      const queryResult = await response.json();

      // Format stats
      const [nodeCount, relCount, entityBreakdown, mostConnected] = queryResult.data?.[0] || [0, 0, [], []];

      return {
        node_count: nodeCount || 0,
        relationship_count: relCount || 0,
        entity_breakdown: (entityBreakdown || []).reduce((acc, item) => {
          acc[item.type] = item.count;
          return acc;
        }, {}),
        most_connected: mostConnected || [],
        last_sync: new Date().toISOString(),
      };
    });

    return new Response(JSON.stringify(result), {
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
