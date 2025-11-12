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
import { createLogger, createPerformanceTracker } from '../../lib/utils/logger.js';

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
    // T139: Structured logging for queue consumer
    const logger = createLogger('GraphSyncConsumer', {
      batch_size: batch.messages.length,
      queue: 'graph-sync-jobs',
    });

    logger.info('Processing batch started', {
      messages_count: batch.messages.length,
    });

    let successCount = 0;
    let failureCount = 0;

    for (const message of batch.messages) {
      try {
        await processMessage(message, env, logger);
        message.ack(); // Acknowledge successful processing
        successCount++;
      } catch (error) {
        failureCount++;
        logger.error('Message processing failed', error, {
          message_id: message.id,
          attempt: message.attempts,
        });

        // Retry with exponential backoff (T137 - Queue retry logic)
        if (message.attempts < 3) {
          const delaySeconds = Math.pow(2, message.attempts) * 5; // 5s, 10s, 20s
          logger.warn('Retrying message', {
            message_id: message.id,
            delay_seconds: delaySeconds,
            attempt: message.attempts + 1,
            max_attempts: 3,
          });
          message.retry({ delaySeconds });
        } else {
          // Send to dead letter queue after 3 retries (T136 - DLQ handling)
          logger.error('Max retries exceeded, sending to DLQ', null, {
            message_id: message.id,
            user_id: message.body.userId,
            note_id: message.body.noteId,
            error_message: error.message,
            attempts: message.attempts,
          });

          // Store DLQ record for manual review
          try {
            await storeDLQRecord(env.DB, message, error);
            logger.info('DLQ record stored', { message_id: message.id });
          } catch (dlqError) {
            logger.error('Failed to store DLQ record', dlqError);
          }

          message.ack(); // Remove from main queue (will go to DLQ automatically if configured)
        }
      }
    }

    logger.info('Batch processing complete', {
      success_count: successCount,
      failure_count: failureCount,
      total: batch.messages.length,
    });
  },
};

/**
 * Process a single queue message
 *
 * @param {Object} message - Queue message
 * @param {Object} env - Worker environment bindings
 * @param {Object} logger - Logger instance
 */
async function processMessage(message, env, logger) {
  const { userId, noteId } = message.body;

  const msgLogger = logger.withContext({
    user_id: userId,
    note_id: noteId,
    message_id: message.id,
    attempt: message.attempts,
  });

  const perfTracker = createPerformanceTracker('processMessage', msgLogger);
  msgLogger.info('Processing message started');

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
      msgLogger.info('No entities to sync, marking as completed');
      await updateSyncStatus(env.DB, userId, noteId, 'completed');
      perfTracker.complete(true, { entities_count: 0 });
      return;
    }

    perfTracker.checkpoint('entities_loaded', { count: entities.length });

    // Process entities using GraphRAG service with timeout
    msgLogger.info('Processing entities', {
      entities_count: entities.length,
      timeout_seconds: 60,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Graph sync timeout after 60 seconds')), 60000)
    );

    const results = await Promise.race([
      processEntities(env, userId, entities, note.transcript),
      timeoutPromise
    ]);

    perfTracker.checkpoint('entities_processed', results);
    msgLogger.info('Entities processed successfully', results);

    // Store sync metadata in D1
    await storeSyncMetadata(env.DB, userId, noteId, results);
    perfTracker.checkpoint('metadata_stored');

    // Update sync status to 'completed'
    await updateSyncStatus(env.DB, userId, noteId, 'completed', null);

    // Invalidate graph caches
    await invalidateAllGraphCaches(env.KV, userId);
    perfTracker.checkpoint('caches_invalidated');

    const finalMetrics = perfTracker.complete(true, results);
    msgLogger.info('Message processing complete', finalMetrics);

  } catch (error) {
    perfTracker.complete(false, { error: error.message });
    msgLogger.error('Error processing note', error);

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

/**
 * Store dead letter queue record for failed messages
 * (T136 - Dead Letter Queue handling)
 *
 * @param {Object} db - D1 database binding
 * @param {Object} message - Failed queue message
 * @param {Error} error - Error that caused failure
 */
async function storeDLQRecord(db, message, error) {
  const { userId, noteId } = message.body;

  await db.prepare(`
    INSERT INTO graph_sync_dlq (
      user_id,
      note_id,
      message_id,
      message_body,
      error_message,
      error_stack,
      attempts,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    userId,
    noteId,
    message.id,
    JSON.stringify(message.body),
    error.message,
    error.stack || null,
    message.attempts
  ).run();

  console.log('[GraphSyncConsumer] DLQ record stored for manual review:', {
    userId,
    noteId,
    messageId: message.id,
  });
}
