/**
 * GET /api/graph
 *
 * Retrieve user's complete knowledge graph or filtered subgraph.
 * Supports pagination and entity type filtering.
 *
 * @module api/graph/get-graph
 */

import { getCachedQueryResult, cacheQueryResult } from '../../lib/graph/cache-invalidator.js';

/**
 * Handle GET /api/graph request
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} user - Authenticated user from JWT middleware
 * @returns {Promise<Response>} HTTP response
 */
export async function handleGetGraph(request, env, user) {
  const url = new URL(request.url);

  // Parse query parameters
  const typeFilter = url.searchParams.get('type'); // Optional: Person, Project, etc.
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const cursor = url.searchParams.get('cursor'); // Pagination cursor (offset)

  const offset = cursor ? parseInt(atob(cursor)) : 0;

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
    const startTime = Date.now();

    // Check cache
    const cached = await getCachedQueryResult(env.KV, user.userId, cypher, params);
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
      throw new Error(`FalkorDB query failed: ${error}`);
    }

    const result = await response.json();

    // Format response
    const nodes = [];
    const relationships = [];
    const nodeIds = new Set();

    for (const row of result.data || []) {
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

    const responseData = {
      data: {
        nodes,
        relationships,
      },
      meta: {
        total_nodes: totalNodes,
        total_relationships: relationships.length,
        has_more: offset + nodes.length < totalNodes,
        next_cursor: offset + nodes.length < totalNodes ? btoa(String(offset + limit)) : null,
        query_time_ms: Date.now() - startTime,
        cached: false,
      },
    };

    // Cache result
    await cacheQueryResult(env.KV, user.userId, cypher, params, responseData);

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[GetGraph] Error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'GRAPH_QUERY_FAILED',
        message: error.message,
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
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
