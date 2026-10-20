// @ts-check
/// <reference path="../types/cloudflare.d.ts" />
/// <reference types="@cloudflare/workers-types" />

/**
 * GraphMind API - Cloudflare Workers Entry Point
 * Voice-first personal knowledge assistant with GraphRAG
 *
 * This file serves as the entry point for the Cloudflare Worker.
 * Route handling is delegated to the router module.
 */

import { createRouter } from './router.js';
import { internalServerError } from './utils/errors.js';

// Export Durable Objects
export { FalkorDBConnectionPool } from './durable-objects/FalkorDBConnectionPool.js';
export { VoiceSessionManager } from './durable-objects/VoiceSessionManager.js';
export { QuerySessionManager } from './durable-objects/QuerySessionManager.js';

// Import Queue Consumers
import entityExtractionConsumer from './workers/consumers/entity-extraction-consumer.js';
import graphSyncConsumer from './workers/consumers/graph-sync-consumer.js';

/**
 * Create router instance
 * The router is properly typed via router.js's @returns annotation.
 */
const router = createRouter();

export default {
  /**
   * Fetch handler - processes all incoming HTTP requests
   * @param {Request} request - The incoming request object
   * @param {Env} env - Environment bindings (DB, KV, AI, R2, etc.)
   * @param {ExecutionContext} ctx - Execution context
   * @returns {Promise<Response>} HTTP response
   */
  async fetch(request, env, ctx) {
    try {
      return await router.fetch(request, env, ctx);
    } catch (error) {
      // Global error handling
      console.error('[Worker] Uncaught error:', error);
      return internalServerError('An unexpected error occurred');
    }
  },

  /**
   * Queue handler - processes queue messages
   * @param {MessageBatch} batch - Batch of queue messages
   * @param {Env} env - Environment bindings
   * @param {ExecutionContext} ctx - Execution context
   * @returns {Promise<void>}
   */
  async queue(batch, env, ctx) {
    // Route messages to appropriate consumer based on queue name
    const queueName = batch.queue;

    if (queueName === 'entity-extraction-jobs') {
      return entityExtractionConsumer.queue(batch, env, ctx);
    } else if (queueName === 'graph-sync-jobs') {
      return graphSyncConsumer.queue(batch, env, ctx);
    } else {
      console.error('[QueueRouter] Unknown queue:', queueName);
    }
  }
};
