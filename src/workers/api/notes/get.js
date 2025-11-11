/**
 * GET /api/notes/:note_id
 *
 * Get full details of a specific voice note.
 *
 * Tasks: T075-T078
 * - T075: Validate JWT (handled by requireAuth middleware)
 * - T076: Extract note_id from URL path
 * - T077: Call getNoteById() with user_id validation
 * - T078: Return 403 if user_id mismatch, 404 if not found
 *
 * @module workers/api/notes/get
 */

import { getNoteById } from '../../../lib/db/voice-notes-queries.js';
import { requireAuth } from '../../../middleware/auth.js';
import { rateLimitMiddleware } from '../../../middleware/rateLimit.js';
import { notFoundError, internalServerError } from '../../../utils/errors.js';
import { createLogger } from '../../../utils/logger.js';

/**
 * Handle GET /api/notes/:note_id
 *
 * Returns full note details including transcript, metadata, and timestamps.
 * Enforces user data isolation - users can only access their own notes.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Worker environment bindings
 * @param {Object} env.DB - D1 database binding
 * @param {Object} env.RATE_LIMIT - KV namespace for rate limiting
 * @param {string} noteId - Note identifier from URL path
 * @returns {Promise<Response>} JSON response with note details or error
 *
 * Response format:
 * {
 *   "note_id": "note_...",
 *   "user_id": "user_...",
 *   "transcript": "Full transcript text...",
 *   "duration_seconds": 120,
 *   "word_count": 245,
 *   "processing_status": "completed",
 *   "created_at": "ISO timestamp"
 * }
 */
export async function handleGetNote(request, env, noteId) {
  const logger = createLogger('API:GetNote', { note_id: noteId });

  try {
    // T075: Validate JWT and get user context (via requireAuth middleware)
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      logger.warn('Authentication failed');
      return authResult;
    }
    const user = authResult;

    logger.baseContext.user_id = user.user_id;

    // T078: Check rate limit (60 requests per minute per user)
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      env,
      'notes:get',
      user.user_id
    );
    if (rateLimitResponse) {
      // Rate limit exceeded, return 429 response
      return rateLimitResponse;
    }

    // T076: Extract note_id from URL path (passed as parameter)
    if (!noteId || noteId.trim().length === 0) {
      return notFoundError('Note ID is required');
    }

    // T077: Query database for note with user_id validation
    let note;
    try {
      const timer = logger.startTimer('db_query');
      note = await getNoteById(env, noteId, user.user_id);
      logger.endTimer(timer);
    } catch (error) {
      logger.error('Database query failed', error);
      return internalServerError('Failed to retrieve note');
    }

    // T078: Check if note exists
    if (!note) {
      logger.warn('Note not found or access denied');
      return notFoundError('Note not found');
    }

    logger.info('Note retrieved successfully', {
      transcript_length: note.transcript?.length || 0,
      word_count: note.word_count
    });

    // Return note details
    return new Response(JSON.stringify(note), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    // Handle unexpected errors
    logger.error('Unexpected error', error);
    return internalServerError('Failed to retrieve note');
  }
}
