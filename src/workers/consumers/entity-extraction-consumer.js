/**
 * Entity Extraction Queue Consumer
 * Feature: 005-entity-extraction
 *
 * Processes entity extraction jobs from Cloudflare Queue.
 * Handles extraction, resolution, D1 updates, and retry logic.
 */

import { extractEntities } from '../../services/entity-extraction.service.js';
import { resolveEntitiesBatch } from '../../services/entity-resolution.service.js';
import { validateExtractionJob, hasExceededMaxRetries, incrementRetryCount } from '../../models/extraction-job.model.js';
import { setExtractionJobStatus } from '../../lib/kv/entity-cache-utils.js';

/**
 * Queue consumer handler
 * Called by Cloudflare Workers when messages are available
 *
 * @param {MessageBatch} batch - Batch of queue messages
 * @param {Object} env - Worker environment bindings
 * @param {Object} ctx - Execution context
 */
export async function handleExtractionQueue(batch, env, ctx) {
  console.log(`Processing ${batch.messages.length} extraction jobs`);

  for (const message of batch.messages) {
    try {
      await processExtractionJob(message.body, env, ctx);
      message.ack(); // Acknowledge successful processing
    } catch (error) {
      console.error('Failed to process extraction job:', error);

      // Check if we should retry
      const job = message.body;
      if (hasExceededMaxRetries(job)) {
        console.error(`Job ${job.note_id} exceeded max retries, sending to DLQ`);
        message.ack(); // Ack to send to dead letter queue
      } else {
        // Retry with exponential backoff
        message.retry(); // Will retry automatically with backoff
      }
    }
  }
}

/**
 * Process a single extraction job
 *
 * @param {Object} job - Extraction job message
 * @param {Object} env - Worker environment bindings
 * @param {Object} ctx - Execution context
 */
async function processExtractionJob(job, env, ctx) {
  const { note_id, user_id, transcript } = job;

  // Validate job structure
  const validation = validateExtractionJob(job);
  if (!validation.valid) {
    throw new Error(`Invalid job structure: ${validation.errors.join(', ')}`);
  }

  console.log(`Processing extraction for note ${note_id}, user ${user_id}`);

  // Step 1: Check if already completed (idempotency)
  const currentStatus = await checkExtractionStatus(env.DB, note_id);
  if (currentStatus === 'completed') {
    console.log(`Note ${note_id} already completed, skipping`);
    return;
  }

  // Step 2: Update status to 'processing'
  await updateExtractionStatus(env.DB, note_id, 'processing', null);
  await setExtractionJobStatus(env.KV, note_id, {
    status: 'processing',
    started_at: Date.now(),
  });

  try {
    // Step 3: Extract entities using Workers AI
    const extractionResult = await extractEntities(env, transcript);

    console.log(`Extracted ${extractionResult.entities.length} entities for note ${note_id}`);

    // Step 4: Resolve entities (fuzzy matching + caching)
    const resolvedEntities = await resolveEntitiesBatch(
      env,
      user_id,
      extractionResult.entities,
      note_id
    );

    console.log(`Resolved ${resolvedEntities.length} entities for note ${note_id}`);

    // Step 5: Prepare entities JSON for storage
    const entitiesJson = {
      entities: resolvedEntities.map(e => ({
        type: e.type,
        name: e.name,
        canonical_name: e.canonical_name,
        confidence: e.confidence,
        properties: e.properties || {},
      })),
      extraction_metadata: extractionResult.metadata,
    };

    // Step 6: Update voice_notes with extraction results
    await updateVoiceNoteWithEntities(env.DB, note_id, entitiesJson);

    // Step 7: Mark extraction as completed
    await updateExtractionStatus(env.DB, note_id, 'completed', null);
    await setExtractionJobStatus(env.KV, note_id, {
      status: 'completed',
      completed_at: Date.now(),
      entity_count: resolvedEntities.length,
    });

    console.log(`Successfully completed extraction for note ${note_id}`);
  } catch (error) {
    console.error(`Extraction failed for note ${note_id}:`, error);

    // Update status to 'failed' with error message
    await updateExtractionStatus(env.DB, note_id, 'failed', error.message);
    await setExtractionJobStatus(env.KV, note_id, {
      status: 'failed',
      error: error.message,
      failed_at: Date.now(),
    });

    throw error; // Re-throw to trigger retry logic
  }
}

/**
 * Check current extraction status for a note
 *
 * @param {Object} db - D1 database binding
 * @param {string} noteId - Voice note ID
 * @returns {Promise<string|null>} Current status or null
 */
async function checkExtractionStatus(db, noteId) {
  const query = `
    SELECT extraction_status
    FROM voice_notes
    WHERE note_id = ?
    LIMIT 1
  `;

  const result = await db.prepare(query).bind(noteId).first();
  return result?.extraction_status || null;
}

/**
 * Update extraction status in voice_notes table
 *
 * @param {Object} db - D1 database binding
 * @param {string} noteId - Voice note ID
 * @param {string} status - New status
 * @param {string|null} error - Error message (if failed)
 */
async function updateExtractionStatus(db, noteId, status, error) {
  let query;
  let bindings;

  if (status === 'processing') {
    query = `
      UPDATE voice_notes
      SET extraction_status = ?,
          extraction_attempted_at = CURRENT_TIMESTAMP
      WHERE note_id = ?
    `;
    bindings = [status, noteId];
  } else if (status === 'completed') {
    query = `
      UPDATE voice_notes
      SET extraction_status = ?,
          extraction_completed_at = CURRENT_TIMESTAMP,
          extraction_error = NULL
      WHERE note_id = ?
    `;
    bindings = [status, noteId];
  } else if (status === 'failed') {
    query = `
      UPDATE voice_notes
      SET extraction_status = ?,
          extraction_error = ?
      WHERE note_id = ?
    `;
    bindings = [status, error, noteId];
  } else {
    throw new Error(`Invalid status: ${status}`);
  }

  await db.prepare(query).bind(...bindings).run();
}

/**
 * Update voice_notes with extracted entities
 *
 * @param {Object} db - D1 database binding
 * @param {string} noteId - Voice note ID
 * @param {Object} entitiesJson - Entities JSON object
 */
async function updateVoiceNoteWithEntities(db, noteId, entitiesJson) {
  const query = `
    UPDATE voice_notes
    SET entities_extracted = ?
    WHERE note_id = ?
  `;

  await db.prepare(query).bind(JSON.stringify(entitiesJson), noteId).run();
}

/**
 * Export queue consumer for wrangler
 */
export default {
  async queue(batch, env, ctx) {
    return handleExtractionQueue(batch, env, ctx);
  },
};
