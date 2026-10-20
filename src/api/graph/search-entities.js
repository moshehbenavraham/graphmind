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

  // Declare outside try block so they're accessible in catch
  let query = '';
  let typeFilter = null;

  try {
    const url = new URL(request.url);

    // Parse query parameters
    query = url.searchParams.get('q') || '';
    typeFilter = url.searchParams.get('type'); // Optional
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

    if (!query || query.trim().length === 0) {
      throw new GraphError('MISSING_REQUIRED_FIELD', {
        field: 'q',
        message: 'Search query parameter "q" is required',
      });
    }

    // Sanitize search query to prevent injection
    query = sanitizeInput(query, { maxLength: 200 });

    // Build Cypher query (typeFilter is string|null from searchParams, convert to string|undefined)
    const { cypher, params } = buildSearchEntities(query, typeFilter || undefined, limit);

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
            apiKey: env.FALKORDB_REST_API_KEY,
          },
        }),
      });

        if (!response.ok) {
          const error = await response.text();
          throw new GraphError('GRAPH_QUERY_FAILED', { error, operation: 'search' });
        }

        const queryResult = await response.json();

        // Format response
        // Note: queryResult.data rows are objects with column names as keys
        const entities = (queryResult.data || []).map(row => {
          // Handle both array format [node, types] and object format {n: node, types: [...]}
          const node = Array.isArray(row) ? row[0] : (row.n || row);
          const types = Array.isArray(row) ? row[1] : (row.types || []);

          // types might be a string like "[Person]" or an array ["Person"]
          let typeValue = 'Unknown';
          if (Array.isArray(types) && types.length > 0) {
            typeValue = types[0];
          } else if (typeof types === 'string') {
            // Parse string format like "[Person]" or "Person"
            const match = types.match(/\[?([^\]]+)\]?/);
            typeValue = match ? match[1] : types;
          }

          return {
            id: node?.entity_id || node?.id,
            type: typeValue,
            name: node?.name,
            mention_count: node?.mention_count || 0,
            properties: node?.properties || node,
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
      query: query,
      typeFilter: typeFilter,
    });
  }
}
