/**
 * GET /api/graph/search
 *
 * Search entities by name with fuzzy matching.
 *
 * @module api/graph/search-entities
 */

import { buildSearchEntities } from '../../lib/graph/cypher-builder.js';
import { getCachedQueryResult, cacheQueryResult } from '../../lib/graph/cache-invalidator.js';

/**
 * Handle GET /api/graph/search request
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} user - Authenticated user from JWT middleware
 * @returns {Promise<Response>} HTTP response
 */
export async function handleSearchEntities(request, env, user) {
  const url = new URL(request.url);

  // Parse query parameters
  const query = url.searchParams.get('q') || '';
  const typeFilter = url.searchParams.get('type'); // Optional
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

  if (!query || query.trim().length === 0) {
    return new Response(JSON.stringify({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Missing required parameter: q (search query)',
      },
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const startTime = Date.now();

    // Build Cypher query
    const { cypher, params } = buildSearchEntities(query, typeFilter, limit);

    // Check cache
    const cached = await getCachedQueryResult(env.KV, user.userId, cypher, { ...params, user_id: user.userId });
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

    // Execute query via FalkorDB connection pool
    const doId = env.FALKORDB_POOL.idFromName('pool');
    const doStub = env.FALKORDB_POOL.get(doId);

    const response = await doStub.fetch('http://do/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.userId,
        cypher,
        params: { ...params, user_id: user.userId },
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
    const entities = (result.data || []).map(row => {
      const [node, types] = row;
      return {
        id: node.entity_id,
        type: types[0] || 'Unknown',
        name: node.name,
        mention_count: node.mention_count || 0,
        properties: node.properties || node,
      };
    });

    const responseData = {
      data: {
        entities,
        total: entities.length,
      },
      meta: {
        query: query,
        type_filter: typeFilter,
        limit,
        query_time_ms: Date.now() - startTime,
        cached: false,
      },
    };

    // Cache result (30 minutes)
    await cacheQueryResult(env.KV, user.userId, cypher, { ...params, user_id: user.userId }, responseData, 1800);

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SearchEntities] Error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'SEARCH_FAILED',
        message: error.message,
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
