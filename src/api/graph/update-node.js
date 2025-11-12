/**
 * PATCH /api/graph/nodes/:node_id
 *
 * Update properties of an existing graph node.
 * Verifies node belongs to authenticated user before updating.
 *
 * @module api/graph/update-node
 */

import { buildUpdateNode, buildMatchNode } from '../../lib/graph/cypher-builder.js';
import { invalidateAllGraphCaches } from '../../lib/graph/cache-invalidator.js';

/**
 * Handle PATCH /api/graph/nodes/:node_id
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} user - Authenticated user from JWT middleware
 * @param {string} nodeId - Node entity_id from URL parameter
 * @returns {Promise<Response>} HTTP response
 */
export async function handleUpdateNode(request, env, user, nodeId) {
  try {
    // Parse request body
    const body = await request.json();
    const { properties } = body;

    // Validate required fields
    if (!properties || Object.keys(properties).length === 0) {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required field: properties',
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    // Update node
    const { cypher: updateCypher, params: updateParams } = buildUpdateNode(nodeId, properties);

    const updateResponse = await doStub.fetch('http://do/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.userId,
        cypher: updateCypher,
        params: updateParams,
        config: {
          host: env.FALKORDB_HOST,
          port: parseInt(env.FALKORDB_PORT),
          username: env.FALKORDB_USER,
          password: env.FALKORDB_PASSWORD,
        },
      }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`FalkorDB update failed: ${error}`);
    }

    const updateResult = await updateResponse.json();

    // Invalidate caches
    await invalidateAllGraphCaches(env.KV, user.userId);

    // Format response
    const updatedNode = updateResult.data?.[0]?.[0];

    return new Response(JSON.stringify({
      data: {
        id: nodeId,
        properties: updatedNode?.properties || properties,
        updated: true,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[UpdateNode] Error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'NODE_UPDATE_FAILED',
        message: error.message,
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
