/**
 * Extraction Job Service
 * Feature: 005-entity-extraction
 *
 * Enqueues entity extraction jobs to Cloudflare Queue.
 * Used by VoiceSessionManager after note completion.
 */

import { createExtractionJob } from '../models/extraction-job.model.js';
import { setExtractionJobStatus } from '../lib/kv/entity-cache-utils.js';

/**
 * Enqueue entity extraction job for a voice note
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} noteId - Voice note ID
 * @param {string} userId - User ID
 * @param {string} transcript - Voice note transcript
 * @returns {Promise<Object>} Job status
 */
export async function enqueueExtractionJob(env, noteId, userId, transcript) {
  if (!env.ENTITY_EXTRACTION_QUEUE) {
    throw new Error('Entity extraction queue not configured');
  }

  // Create job message
  const job = createExtractionJob(noteId, userId, transcript);

  try {
    // Send to queue
    await env.ENTITY_EXTRACTION_QUEUE.send(job);

    // Track job status in KV
    await setExtractionJobStatus(env.KV, noteId, {
      status: 'pending',
      enqueued_at: job.enqueued_at,
    });

    console.log(`Enqueued extraction job for note ${noteId}`);

    return {
      success: true,
      note_id: noteId,
      enqueued_at: job.enqueued_at,
    };
  } catch (error) {
    console.error(`Failed to enqueue extraction job for note ${noteId}:`, error);
    throw new Error(`Failed to enqueue extraction job: ${error.message}`);
  }
}

/**
 * Enqueue extraction jobs for multiple notes (batch)
 *
 * @param {Object} env - Worker environment bindings
 * @param {Array} notes - Array of {noteId, userId, transcript}
 * @returns {Promise<Array>} Array of job statuses
 */
export async function enqueueExtractionJobsBatch(env, notes) {
  if (!Array.isArray(notes)) {
    throw new Error('Notes must be an array');
  }

  const results = [];

  for (const note of notes) {
    try {
      const result = await enqueueExtractionJob(
        env,
        note.noteId || note.note_id,
        note.userId || note.user_id,
        note.transcript
      );
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        note_id: note.noteId || note.note_id,
        error: error.message,
      });
    }
  }

  return results;
}
