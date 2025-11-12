/**
 * POST /api/graph/relationships
 *
 * Create a relationship between two graph nodes.
 * Verifies both nodes belong to authenticated user before creating relationship.
 *
 * @module api/graph/create-relationship
 */

import { buildCreateRelationship, buildMatchNode } from '../../lib/graph/cypher-builder.js';
import { invalidateAllGraphCaches } from '../../lib/graph/cache-invalidator.js';

// Valid relationship types
const VALID_REL_TYPES = [
  'WORKED_WITH',
  'WORKS_ON',
  'ATTENDED',
  'DISCUSSED',
  'USES_TECHNOLOGY',
  'LOCATED_AT',
  'OWNS',
  'KNOWS',
];

/**
 * Handle POST /api/graph/relationships
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} user - Authenticated user from JWT middleware
 * @returns {Promise<Response>} HTTP response
 */
export async function handleCreateRelationship(request, env, user) {
  try {
    // Parse request body
    const body = await request.json();
    const { from_node_id, to_node_id, type, properties = {} } = body;

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

    // Validate relationship type
    if (!VALID_REL_TYPES.includes(type)) {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_RELATIONSHIP_TYPE',
          message: `Invalid relationship type: ${type}. Must be one of: ${VALID_REL_TYPES.join(', ')}`,
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Durable Object stub
    const doId = env.FALKORDB_POOL.idFromName('pool');
    const doStub = env.FALKORDB_POOL.get(doId);

    // Verify both nodes exist and belong to user
    const { cypher: matchFromCypher, params: matchFromParams } = buildMatchNode('*', from_node_id);
    const { cypher: matchToCypher, params: matchToParams } = buildMatchNode('*', to_node_id);

    const [fromResponse, toResponse] = await Promise.all([
      doStub.fetch('http://do/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          cypher: matchFromCypher,
          params: matchFromParams,
          config: {
            host: env.FALKORDB_HOST,
            port: parseInt(env.FALKORDB_PORT),
            username: env.FALKORDB_USER,
            password: env.FALKORDB_PASSWORD,
          },
        }),
      }),
      doStub.fetch('http://do/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          cypher: matchToCypher,
          params: matchToParams,
          config: {
            host: env.FALKORDB_HOST,
            port: parseInt(env.FALKORDB_PORT),
            username: env.FALKORDB_USER,
            password: env.FALKORDB_PASSWORD,
          },
        }),
      }),
    ]);

    const fromResult = await fromResponse.json();
    const toResult = await toResponse.json();

    // Check if both nodes exist
    if (!fromResult.data || fromResult.data.length === 0) {
      return new Response(JSON.stringify({
        error: {
          code: 'NODE_NOT_FOUND',
          message: `Source node (${from_node_id}) not found or does not belong to user`,
        },
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!toResult.data || toResult.data.length === 0) {
      return new Response(JSON.stringify({
        error: {
          code: 'NODE_NOT_FOUND',
          message: `Target node (${to_node_id}) not found or does not belong to user`,
        },
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create relationship
    const { cypher: createCypher, params: createParams } = buildCreateRelationship(
      from_node_id,
      to_node_id,
      type,
      properties
    );

    const createResponse = await doStub.fetch('http://do/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.userId,
        cypher: createCypher,
        params: createParams,
        config: {
          host: env.FALKORDB_HOST,
          port: parseInt(env.FALKORDB_PORT),
          username: env.FALKORDB_USER,
          password: env.FALKORDB_PASSWORD,
        },
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`FalkorDB relationship creation failed: ${error}`);
    }

    const createResult = await createResponse.json();

    // Invalidate caches
    await invalidateAllGraphCaches(env.KV, user.userId);

    return new Response(JSON.stringify({
      data: {
        from_node_id,
        to_node_id,
        type,
        properties,
        created: true,
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[CreateRelationship] Error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'RELATIONSHIP_CREATION_FAILED',
        message: error.message,
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
