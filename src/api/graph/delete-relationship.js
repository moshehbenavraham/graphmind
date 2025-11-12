/**
 * DELETE /api/graph/relationships/:rel_id
 *
 * Delete a specific relationship between two nodes.
 * Alternative: DELETE with from_node_id, to_node_id, type in body.
 *
 * @module api/graph/delete-relationship
 */

import { invalidateAllGraphCaches } from '../../lib/graph/cache-invalidator.js';

/**
 * Handle DELETE /api/graph/relationships
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} user - Authenticated user from JWT middleware
 * @returns {Promise<Response>} HTTP response
 */
export async function handleDeleteRelationship(request, env, user) {
  try {
    // Parse request body (contains from_node_id, to_node_id, type)
    const body = await request.json();
    const { from_node_id, to_node_id, type } = body;

    // Validate required fields
    if (!from_node_id || !to_node_id || !type) {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: from_node_id, to_node_id, type',
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build Cypher query to delete relationship
    const cypher = `
      MATCH (from {user_id: $user_id, entity_id: $from_entity_id})
      MATCH (to {user_id: $user_id, entity_id: $to_entity_id})
      MATCH (from)-[r:${type}]->(to)
      DELETE r
      RETURN count(r) as deleted_count
    `.trim();

    const params = {
      from_entity_id: from_node_id,
      to_entity_id: to_node_id,
    };

    // Get Durable Object stub
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
    const deletedCount = result.data?.[0]?.[0] || 0;

    // Check if relationship was found
    if (deletedCount === 0) {
      return new Response(JSON.stringify({
        error: {
          code: 'RELATIONSHIP_NOT_FOUND',
          message: 'Relationship not found or nodes do not belong to user',
        },
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Invalidate caches
    await invalidateAllGraphCaches(env.KV, user.userId);

    return new Response(JSON.stringify({
      data: {
        from_node_id,
        to_node_id,
        type,
        deleted: true,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[DeleteRelationship] Error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'RELATIONSHIP_DELETION_FAILED',
        message: error.message,
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
