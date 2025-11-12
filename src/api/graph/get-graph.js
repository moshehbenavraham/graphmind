/**
 * GET /api/graph
 *
 * Retrieve user's complete knowledge graph or filtered subgraph.
 * Supports pagination and entity type filtering.
 *
 * @module api/graph/get-graph
 */

import { executeWithCache } from '../../lib/graph/query-cache.js';
import { handleError, executeWithRetry, executeWithFallback, GraphError, validateParams } from '../../lib/graph/error-handler.js';
import { createAPIRequestLogger } from '../../lib/utils/logger.js';

/**
 * Handle GET /api/graph request
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} user - Authenticated user from JWT middleware
 * @returns {Promise<Response>} HTTP response
 */
export async function handleGetGraph(request, env, user) {
  // T140: Performance timing for API endpoints
  const requestLogger = createAPIRequestLogger(request, user);

  try {
    const url = new URL(request.url);

    // Parse query parameters
    const typeFilter = url.searchParams.get('type'); // Optional: Person, Project, etc.
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const cursor = url.searchParams.get('cursor'); // Pagination cursor (offset)

    // Validate query parameters
    if (typeFilter) {
      const validTypes = ['Person', 'Project', 'Meeting', 'Topic', 'Technology', 'Location', 'Organization'];
      if (!validTypes.includes(typeFilter)) {
        throw new GraphError('INVALID_REQUEST', {
          field: 'type',
          message: `Invalid type filter. Must be one of: ${validTypes.join(', ')}`,
          provided: typeFilter,
        });
      }
    }

    if (isNaN(limit) || limit < 1) {
      throw new GraphError('INVALID_REQUEST', {
        field: 'limit',
        message: 'Limit must be a positive integer',
      });
    }

    const offset = cursor ? parseInt(atob(cursor)) : 0;

    requestLogger.logStart({ typeFilter, limit, offset });

  // Build Cypher query
  const typeClause = typeFilter ? `:${typeFilter}` : '';

  const cypher = `
    MATCH (n${typeClause} {user_id: $user_id})
    OPTIONAL MATCH (n)-[r]-(connected)
    WHERE connected.user_id = $user_id
    WITH n, collect(DISTINCT r) as relationships, collect(DISTINCT connected) as connected_nodes
    ORDER BY n.mention_count DESC
    SKIP $offset
    LIMIT $limit
    RETURN n, relationships, connected_nodes
  `.trim();

  const params = {
    user_id: user.userId,
    offset,
    limit,
  };

  try {
    // Use query cache wrapper for automatic caching with retry and fallback
    const result = await executeWithFallback(
      // Primary operation: Execute query with retry logic
      async () => await executeWithCache(env.KV, user.userId, cypher, params, async () => {
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
              params,
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
            throw new GraphError('GRAPH_QUERY_FAILED', {
              error,
              cypher: cypher.substring(0, 200),
            });
          }

          const queryResult = await response.json();

      // Format response
      const nodes = [];
      const relationships = [];
      const nodeIds = new Set();

      for (const row of queryResult.data || []) {
        const [node, rels, connectedNodes] = row;

        // Add center node
        if (node && !nodeIds.has(node.entity_id)) {
          nodes.push(formatNode(node));
          nodeIds.add(node.entity_id);
        }

        // Add connected nodes
        for (const connectedNode of connectedNodes || []) {
          if (connectedNode && !nodeIds.has(connectedNode.entity_id)) {
            nodes.push(formatNode(connectedNode));
            nodeIds.add(connectedNode.entity_id);
          }
        }

        // Add relationships
        for (const rel of rels || []) {
          if (rel) {
            relationships.push(formatRelationship(rel));
          }
        }
      }

      // Get total count (for pagination)
      const totalCountQuery = `
        MATCH (n${typeClause} {user_id: $user_id})
        RETURN count(n) as total
      `.trim();

      const countResponse = await doStub.fetch('http://do/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          cypher: totalCountQuery,
          params: { user_id: user.userId },
          config: {
            host: env.FALKORDB_HOST,
            port: parseInt(env.FALKORDB_PORT),
            username: env.FALKORDB_USER,
            password: env.FALKORDB_PASSWORD,
          },
        }),
      });

      const countResult = await countResponse.json();
      const totalNodes = countResult.data?.[0]?.[0] || 0;

      return {
        nodes,
        relationships,
        total_nodes: totalNodes,
        total_relationships: relationships.length,
        has_more: offset + nodes.length < totalNodes,
        next_cursor: offset + nodes.length < totalNodes ? btoa(String(offset + limit)) : null,
      };
        }, { maxRetries: 3, initialDelay: 1000 }); // Retry config
      }),
      // Fallback operation: Return cached data if FalkorDB is unavailable
      async () => {
        console.warn('[GetGraph] FalkorDB unavailable, attempting cache fallback...');
        // Try to get from cache directly
        const cacheKey = `graph:query:${user.userId}:${Buffer.from(cypher).toString('base64')}`;
        const cached = await env.KV.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
        // If no cache, return empty graph with warning
        throw new GraphError('FALKORDB_CONNECTION_FAILED', {
          message: 'FalkorDB is unavailable and no cached data exists',
        });
      },
      { fallbackErrors: ['FALKORDB_CONNECTION_FAILED', 'FALKORDB_TIMEOUT'] }
    );

    const metrics = requestLogger.logSuccess(200, {
      nodes_count: result.nodes?.length || 0,
      relationships_count: result.relationships?.length || 0,
      cached: result._fromCache || false,
    });

    return new Response(JSON.stringify({
      data: result,
      meta: {
        ...metrics,
        total_nodes: result.total_nodes,
        total_relationships: result.total_relationships,
        has_more: result.has_more,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    requestLogger.logError(error);
    return handleError(error, 'GetGraph', {
      userId: user.userId,
      typeFilter,
      limit,
      offset,
    });
  }
}

/**
 * Format node for API response
 */
function formatNode(node) {
  return {
    id: node.entity_id,
    type: node.labels?.[0] || 'Unknown',
    properties: node.properties || node,
  };
}

/**
 * Format relationship for API response
 */
function formatRelationship(rel) {
  return {
    id: rel.id,
    type: rel.type,
    from_node_id: rel.src,
    to_node_id: rel.dest,
    properties: rel.properties || {},
  };
}
