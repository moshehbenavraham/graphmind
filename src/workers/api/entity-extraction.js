/**
 * Entity Extraction API Endpoints
 * Feature: 005-entity-extraction
 *
 * POST /api/notes/:note_id/extract-entities - Manual extraction trigger
 * POST /api/entities/extract-batch - Batch extraction trigger
 */

import { enqueueExtractionJob, enqueueExtractionJobsBatch } from '../../services/extraction-job.service.js';
import { getExtractionJobStatus } from '../../lib/kv/entity-cache-utils.js';

/**
 * POST /api/notes/:note_id/extract-entities
 * Manually trigger entity extraction for a specific note
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} params - URL parameters
 * @param {string} params.userId - User ID from JWT
 * @param {string} params.noteId - Note ID from URL
 * @returns {Response} HTTP response
 */
export async function extractEntitiesForNote(request, env, params) {
  const { userId, noteId } = params;

  try {
    // Step 1: Verify note exists and belongs to user
    const note = await getNoteForUser(env.DB, noteId, userId);
    if (!note) {
      return jsonResponse({ success: false, error: 'Note not found' }, 404);
    }

    // Step 2: Check current extraction status
    if (note.extraction_status === 'processing') {
      return jsonResponse({ success: false, error: 'Extraction already in progress' }, 409);
    }

    if (note.extraction_status === 'completed' && note.entities_extracted) {
      // Already completed - return existing entities
      return jsonResponse({
        success: true,
        message: 'Entities already extracted',
        extraction_status: 'completed',
        entities: JSON.parse(note.entities_extracted),
      });
    }

    // Step 3: Enqueue extraction job
    const jobResult = await enqueueExtractionJob(env, noteId, userId, note.transcript);

    // Step 4: Return response
    return jsonResponse({
      success: true,
      data: {
        note_id: noteId,
        extraction_status: 'pending',
        job_enqueued_at: new Date(jobResult.enqueued_at).toISOString(),
        estimated_completion: estimateCompletionTime(jobResult.enqueued_at),
      },
    });
  } catch (error) {
    console.error('Extract entities error:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * POST /api/entities/extract-batch
 * Trigger extraction for multiple notes
 *
 * Request body: { note_ids: string[] }
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} params - Parameters
 * @param {string} params.userId - User ID from JWT
 * @returns {Response} HTTP response
 */
export async function extractEntitiesBatch(request, env, params) {
  const { userId } = params;

  try {
    // Parse request body
    const body = await request.json();
    const { note_ids } = body;

    if (!Array.isArray(note_ids) || note_ids.length === 0) {
      return jsonResponse({ success: false, error: 'note_ids must be a non-empty array' }, 400);
    }

    if (note_ids.length > 10) {
      return jsonResponse({ success: false, error: 'Maximum 10 notes per batch' }, 400);
    }

    // Step 1: Fetch all notes for user
    const notes = await getNotesForUser(env.DB, note_ids, userId);

    if (notes.length === 0) {
      return jsonResponse({ success: false, error: 'No valid notes found' }, 404);
    }

    // Step 2: Enqueue extraction jobs
    const results = await enqueueExtractionJobsBatch(env, notes);

    // Step 3: Return results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return jsonResponse({
      success: true,
      data: {
        total_requested: note_ids.length,
        enqueued: successful,
        failed: failed,
        results,
      },
    });
  } catch (error) {
    console.error('Batch extract error:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * Helper: Get note for user from D1
 */
async function getNoteForUser(db, noteId, userId) {
  const query = `
    SELECT note_id, user_id, transcript, extraction_status, entities_extracted
    FROM voice_notes
    WHERE note_id = ? AND user_id = ? AND is_deleted = 0
    LIMIT 1
  `;

  return await db.prepare(query).bind(noteId, userId).first();
}

/**
 * Helper: Get multiple notes for user
 */
async function getNotesForUser(db, noteIds, userId) {
  const placeholders = noteIds.map(() => '?').join(',');
  const query = `
    SELECT note_id, user_id, transcript
    FROM voice_notes
    WHERE note_id IN (${placeholders}) AND user_id = ? AND is_deleted = 0
  `;

  const result = await db.prepare(query).bind(...noteIds, userId).all();
  return result.results;
}

/**
 * Helper: Estimate completion time
 */
function estimateCompletionTime(enqueuedAt) {
  const estimatedDuration = 3000; // 3 seconds
  const completionTime = new Date(enqueuedAt + estimatedDuration);
  return completionTime.toISOString();
}

/**
 * Helper: JSON response
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
