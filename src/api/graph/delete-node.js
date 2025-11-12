/**
 * DELETE /api/graph/nodes/:node_id
 *
 * Delete a graph node and all its relationships (DETACH DELETE).
 * Verifies node belongs to authenticated user before deletion.
 *
 * @module api/graph/delete-node
 */

import { buildDeleteNode, buildMatchNode } from '../../lib/graph/cypher-builder.js';
import { invalidateAllGraphCaches } from '../../lib/graph/cache-invalidator.js';

/**
 * Handle DELETE /api/graph/nodes/:node_id
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} user - Authenticated user from JWT middleware
 * @param {string} nodeId - Node entity_id from URL parameter
 * @returns {Promise<Response>} HTTP response
 */
export async function handleDeleteNode(request, env, user, nodeId) {
  try {
    // Get Durable Object stub
    const doId = env.FALKORDB_POOL.idFromName('pool');
    const doStub = env.FALKORDB_POOL.get(doId);

    // First, verify node exists and belongs to user
    const { cypher: matchCypher, params: matchParams } = buildMatchNode('*', nodeId);

    const matchResponse = await doStub.fetch('http://do/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.userId,
        cypher: matchCypher,
        params: matchParams,
        config: {
          host: env.FALKORDB_HOST,
          port: parseInt(env.FALKORDB_PORT),
          username: env.FALKORDB_USER,
          password: env.FALKORDB_PASSWORD,
        },
      }),
    });

    if (!matchResponse.ok) {
      const error = await matchResponse.text();
      throw new Error(`FalkorDB query failed: ${error}`);
    }

    const matchResult = await matchResponse.json();

    // Check if node exists
    if (!matchResult.data || matchResult.data.length === 0) {
      return new Response(JSON.stringify({
        error: {
          code: 'NODE_NOT_FOUND',
          message: 'Node not found or does not belong to user',
        },
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete node (DETACH DELETE removes all relationships)
    const { cypher: deleteCypher, params: deleteParams } = buildDeleteNode(nodeId);

    const deleteResponse = await doStub.fetch('http://do/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.userId,
        cypher: deleteCypher,
        params: deleteParams,
        config: {
          host: env.FALKORDB_HOST,
          port: parseInt(env.FALKORDB_PORT),
          username: env.FALKORDB_USER,
          password: env.FALKORDB_PASSWORD,
        },
      }),
    });

    if (!deleteResponse.ok) {
      const error = await deleteResponse.text();
      throw new Error(`FalkorDB delete failed: ${error}`);
    }

    // Invalidate caches
    await invalidateAllGraphCaches(env.KV, user.userId);

    return new Response(JSON.stringify({
      data: {
        id: nodeId,
        deleted: true,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[DeleteNode] Error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'NODE_DELETION_FAILED',
        message: error.message,
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
