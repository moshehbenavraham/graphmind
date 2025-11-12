/**
 * GET /api/graph/entity/:entity_id
 *
 * Get single entity with N-hop neighborhood.
 *
 * @module api/graph/get-entity
 */

import { buildGetNeighborhood } from '../../lib/graph/cypher-builder.js';
import { getCachedQueryResult, cacheQueryResult } from '../../lib/graph/cache-invalidator.js';

/**
 * Handle GET /api/graph/entity/:entity_id request
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} user - Authenticated user from JWT middleware
 * @param {string} entityId - Entity ID from URL parameter
 * @returns {Promise<Response>} HTTP response
 */
export async function handleGetEntity(request, env, user, entityId) {
  const url = new URL(request.url);

  // Parse query parameters
  const depth = Math.min(Math.max(parseInt(url.searchParams.get('depth') || '1'), 1), 3);

  try {
    const startTime = Date.now();

    // Check neighborhood cache
    const cacheKey = `graph:neighborhood:${user.userId}:${entityId}:${depth}`;
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
    const { cypher, params } = buildGetNeighborhood(entityId, depth);

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

    // Check if entity exists
    if (!result.data || result.data.length === 0) {
      return new Response(JSON.stringify({
        error: {
          code: 'ENTITY_NOT_FOUND',
          message: `Entity not found: ${entityId}`,
        },
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Format response
    const [centerNode, neighbors, rels] = result.data[0];

    const responseData = {
      data: {
        entity: {
          id: centerNode.entity_id,
          type: centerNode.labels?.[0] || 'Unknown',
          properties: centerNode.properties || centerNode,
        },
        neighbors: (neighbors || []).map(node => ({
          entity: {
            id: node.entity_id,
            type: node.labels?.[0] || 'Unknown',
            properties: node.properties || node,
          },
          relationship: null, // TODO: Extract from rels array
        })),
      },
      meta: {
        depth,
        neighbor_count: neighbors?.length || 0,
        query_time_ms: Date.now() - startTime,
        cached: false,
      },
    };

    // Cache result (30 minute TTL)
    await env.KV.put(cacheKey, JSON.stringify(responseData), {
      expirationTtl: 1800, // 30 minutes
    });

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[GetEntity] Error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'ENTITY_QUERY_FAILED',
        message: error.message,
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
