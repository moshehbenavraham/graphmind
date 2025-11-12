/**
 * POST /api/graph/merge-entities
 *
 * Manually merge duplicate entities with strategy selection.
 *
 * @module api/graph/merge-entities
 */

import { mergeEntities } from '../../services/entity-merger.js';
import { invalidateAllGraphCaches } from '../../lib/graph/cache-invalidator.js';

/**
 * Handle POST /api/graph/merge-entities request
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} user - Authenticated user from JWT middleware
 * @returns {Promise<Response>} HTTP response
 */
export async function handleMergeEntities(request, env, user) {
  try {
    const body = await request.json();

    // Validate request
    const { source_node_id, target_node_id, merge_strategy } = body;

    if (!source_node_id || !target_node_id) {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: source_node_id, target_node_id',
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (source_node_id === target_node_id) {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Source and target cannot be the same entity',
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate merge strategy
    const validStrategies = ['prefer_source', 'prefer_target', 'combine'];
    const strategy = merge_strategy || 'prefer_target';

    if (!validStrategies.includes(strategy)) {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_REQUEST',
          message: `Invalid merge_strategy. Must be one of: ${validStrategies.join(', ')}`,
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const startTime = Date.now();

    // Execute merge
    const result = await mergeEntities(env, user.userId, source_node_id, target_node_id, strategy);

    // Invalidate all graph caches
    await invalidateAllGraphCaches(env.KV, user.userId);

    return new Response(JSON.stringify({
      data: {
        ...result,
        strategy_used: strategy,
      },
      meta: {
        processing_time_ms: Date.now() - startTime,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[MergeEntities] Error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'MERGE_FAILED',
        message: error.message,
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
