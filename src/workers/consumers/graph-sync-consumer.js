/**
 * Graph Sync Consumer
 *
 * Cloudflare Queue consumer that processes graph sync jobs.
 * Triggered when entity extraction completes, syncs entities to FalkorDB.
 *
 * @module workers/consumers/graph-sync-consumer
 */

import { processEntities } from '../../services/graph-rag.js';
import { invalidateAllGraphCaches } from '../../lib/graph/cache-invalidator.js';

/**
 * Queue consumer handler
 * Called by Cloudflare Workers for each batch of queue messages
 *
 * @param {Array<Object>} batch - Batch of queue messages
 * @param {Object} env - Worker environment bindings
 * @param {Object} ctx - Execution context
 */
export default {
  async queue(batch, env, ctx) {
    console.log('[GraphSyncConsumer] Processing batch:', batch.messages.length);

    for (const message of batch.messages) {
      try {
        await processMessage(message, env);
        message.ack(); // Acknowledge successful processing
      } catch (error) {
        console.error('[GraphSyncConsumer] Message processing failed:', error);

        // Retry with exponential backoff
        if (message.attempts < 3) {
          message.retry({
            delaySeconds: Math.pow(2, message.attempts) * 5, // 5s, 10s, 20s
          });
        } else {
          // Send to dead letter queue after 3 retries
          console.error('[GraphSyncConsumer] Max retries exceeded, sending to DLQ:', message.id);
          message.ack(); // Remove from main queue (will go to DLQ automatically)
        }
      }
    }
  },
};

/**
 * Process a single queue message
 *
 * @param {Object} message - Queue message
 * @param {Object} env - Worker environment bindings
 */
async function processMessage(message, env) {
  const { userId, noteId } = message.body;

  console.log('[GraphSyncConsumer] Processing message:', { userId, noteId, attempt: message.attempts });

  // Update sync status to 'processing'
  await updateSyncStatus(env.DB, userId, noteId, 'processing');

  try {
    // Fetch voice note with extracted entities from D1
    const note = await getVoiceNote(env.DB, userId, noteId);

    if (!note) {
      throw new Error(`Voice note not found: ${noteId}`);
    }

    if (!note.entities_extracted) {
      throw new Error(`No entities extracted for note: ${noteId}`);
    }

    // Parse entities JSON
    const entitiesData = JSON.parse(note.entities_extracted);
    const entities = entitiesData.entities || entitiesData; // Handle both {"entities": [...]} and [...] formats

    if (!Array.isArray(entities) || entities.length === 0) {
      console.log('[GraphSyncConsumer] No entities to sync for note:', noteId);
      await updateSyncStatus(env.DB, userId, noteId, 'completed');
      return;
    }

    // Process entities using GraphRAG service with timeout
    console.log('[GraphSyncConsumer] About to process', entities.length, 'entities with 60s timeout');

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Graph sync timeout after 60 seconds')), 60000)
    );

    const results = await Promise.race([
      processEntities(env, userId, entities, note.transcript),
      timeoutPromise
    ]);

    console.log('[GraphSyncConsumer] processEntities completed successfully:', results);

    // Store sync metadata in D1
    await storeSyncMetadata(env.DB, userId, noteId, results);

    // Update sync status to 'completed'
    await updateSyncStatus(env.DB, userId, noteId, 'completed', null);

    // Invalidate graph caches
    await invalidateAllGraphCaches(env.KV, userId);

    console.log('[GraphSyncConsumer] Successfully processed note:', noteId, results);

  } catch (error) {
    console.error('[GraphSyncConsumer] Error processing note:', noteId, error);

    // Update sync status to 'failed'
    await updateSyncStatus(env.DB, userId, noteId, 'failed', error.message);

    throw error; // Re-throw for retry logic
  }
}

/**
 * Get voice note from D1
 *
 * @param {Object} db - D1 database binding
 * @param {string} userId - User ID
 * @param {string} noteId - Note ID
 * @returns {Promise<Object|null>} Voice note or null
 */
async function getVoiceNote(db, userId, noteId) {
  const result = await db.prepare(`
    SELECT note_id, user_id, transcript, entities_extracted, extraction_status
    FROM voice_notes
    WHERE user_id = ? AND note_id = ?
  `).bind(userId, noteId).first();

  return result;
}

/**
 * Update graph sync status in D1
 *
 * @param {Object} db - D1 database binding
 * @param {string} userId - User ID
 * @param {string} noteId - Note ID
 * @param {string} status - Sync status ('pending', 'processing', 'completed', 'failed')
 * @param {string|null} error - Error message if failed
 */
async function updateSyncStatus(db, userId, noteId, status, error = null) {
  const now = new Date().toISOString();

  if (status === 'completed') {
    await db.prepare(`
      UPDATE voice_notes
      SET graph_sync_status = ?,
          graph_synced_at = ?,
          graph_sync_error = NULL
      WHERE user_id = ? AND note_id = ?
    `).bind(status, now, userId, noteId).run();
  } else if (status === 'failed') {
    await db.prepare(`
      UPDATE voice_notes
      SET graph_sync_status = ?,
          graph_sync_error = ?
      WHERE user_id = ? AND note_id = ?
    `).bind(status, error, userId, noteId).run();
  } else {
    await db.prepare(`
      UPDATE voice_notes
      SET graph_sync_status = ?
      WHERE user_id = ? AND note_id = ?
    `).bind(status, userId, noteId).run();
  }
}

/**
 * Store sync metadata in D1
 *
 * @param {Object} db - D1 database binding
 * @param {string} userId - User ID
 * @param {string} noteId - Note ID
 * @param {Object} results - Processing results from GraphRAG service
 */
async function storeSyncMetadata(db, userId, noteId, results) {
  await db.prepare(`
    INSERT INTO graph_sync_metadata (
      user_id,
      note_id,
      entity_mappings,
      relationships_created,
      nodes_created,
      nodes_updated,
      relationships_count,
      processing_time_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    userId,
    noteId,
    JSON.stringify(results.entityMappings || {}),
    JSON.stringify(results.relationshipsData || []),
    results.nodesCreated || 0,
    results.nodesUpdated || 0,
    results.relationshipsCreated || 0,
    results.processingTimeMs || 0
  ).run();
}
