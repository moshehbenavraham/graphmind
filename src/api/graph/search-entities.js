/**
 * GET /api/graph/search
 *
 * Search entities by name with fuzzy matching.
 *
 * @module api/graph/search-entities
 */

import { buildSearchEntities } from '../../lib/graph/cypher-builder.js';
import { executeWithCache } from '../../lib/graph/query-cache.js';
import { handleError, executeWithRetry, sanitizeInput, GraphError } from '../../lib/graph/error-handler.js';

/**
 * Handle GET /api/graph/search request
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} user - Authenticated user from JWT middleware
 * @returns {Promise<Response>} HTTP response
 */
export async function handleSearchEntities(request, env, user) {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);

    // Parse query parameters
    let query = url.searchParams.get('q') || '';
    const typeFilter = url.searchParams.get('type'); // Optional
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

    if (!query || query.trim().length === 0) {
      throw new GraphError('MISSING_REQUIRED_FIELD', {
        field: 'q',
        message: 'Search query parameter "q" is required',
      });
    }

    // Sanitize search query to prevent injection
    query = sanitizeInput(query, { maxLength: 200 });

    // Build Cypher query
    const { cypher, params } = buildSearchEntities(query, typeFilter, limit);

    // Use query cache wrapper with retry logic
    const result = await executeWithCache(env.KV, user.userId, cypher, { ...params, user_id: user.userId }, async () => {
      return await executeWithRetry(async () => {
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
          throw new GraphError('GRAPH_QUERY_FAILED', { error, operation: 'search' });
        }

        const queryResult = await response.json();

        // Format response
        const entities = (queryResult.data || []).map(row => {
          const [node, types] = row;
          return {
            id: node.entity_id,
            type: types[0] || 'Unknown',
            name: node.name,
            mention_count: node.mention_count || 0,
            properties: node.properties || node,
          };
        });

        return {
          entities,
          total: entities.length,
          query: query,
          type_filter: typeFilter,
          limit,
        };
      }, { maxRetries: 3 }); // Retry config
    });

    return new Response(JSON.stringify({
      data: result,
      meta: {
        query_time_ms: Date.now() - startTime,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return handleError(error, 'SearchEntities', {
      userId: user.userId,
      query,
      typeFilter,
    });
  }
}
