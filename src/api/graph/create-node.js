/**
 * POST /api/graph/nodes
 *
 * Create a new graph node manually.
 * Supports all 7 entity types with property validation.
 *
 * @module api/graph/create-node
 */

import { buildMergeNode } from '../../lib/graph/cypher-builder.js';
import { invalidateAllGraphCaches } from '../../lib/graph/cache-invalidator.js';

// Valid node types
const VALID_NODE_TYPES = ['Person', 'Project', 'Meeting', 'Topic', 'Technology', 'Location', 'Organization'];

/**
 * Handle POST /api/graph/nodes
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} user - Authenticated user from JWT middleware
 * @returns {Promise<Response>} HTTP response
 */
export async function handleCreateNode(request, env, user) {
  try {
    // Parse request body
    const body = await request.json();
    const { type, properties } = body;

    // Validate required fields
    if (!type || !properties) {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: type, properties',
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate node type
    if (!VALID_NODE_TYPES.includes(type)) {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_NODE_TYPE',
          message: `Invalid node type: ${type}. Must be one of: ${VALID_NODE_TYPES.join(', ')}`,
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate required property: name
    if (!properties.name || properties.name.trim() === '') {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_PROPERTIES',
          message: 'Property "name" is required and cannot be empty',
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate entity_id for new node
    const entityId = `manual_${user.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build Cypher query
    const { cypher, params } = buildMergeNode(
      type,
      entityId,
      properties,
      properties
    );

    // Execute via Durable Object
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

    // Invalidate caches
    await invalidateAllGraphCaches(env.KV, user.userId);

    // Format response
    const node = result.data?.[0]?.[0];

    return new Response(JSON.stringify({
      data: {
        id: entityId,
        type,
        properties: properties,
        created: true,
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[CreateNode] Error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'NODE_CREATION_FAILED',
        message: error.message,
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
