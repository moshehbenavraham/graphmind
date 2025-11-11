/**
 * DELETE /api/notes/:note_id
 *
 * Soft delete a voice note.
 *
 * Tasks: T079-T082
 * - T079: Validate JWT (handled by requireAuth middleware)
 * - T080: Extract note_id from URL path
 * - T081: Call deleteNote() from voice-notes-queries (soft delete)
 * - T082: Return 204 No Content on success, 404 if not found
 *
 * @module workers/api/notes/delete
 */

import { deleteNote } from '../../../lib/db/voice-notes-queries.js';
import { requireAuth } from '../../../middleware/auth.js';
import { rateLimitMiddleware } from '../../../middleware/rateLimit.js';
import { notFoundError, internalServerError } from '../../../utils/errors.js';
import { createLogger } from '../../../utils/logger.js';

/**
 * Handle DELETE /api/notes/:note_id
 *
 * Performs soft delete by setting is_deleted=1 flag.
 * Enforces user data isolation - users can only delete their own notes.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Worker environment bindings
 * @param {Object} env.DB - D1 database binding
 * @param {Object} env.RATE_LIMIT - KV namespace for rate limiting
 * @param {string} noteId - Note identifier from URL path
 * @returns {Promise<Response>} 204 No Content on success, error otherwise
 *
 * Success response: 204 No Content (empty body)
 * Error responses:
 * - 401: Invalid or missing JWT
 * - 404: Note not found or already deleted
 * - 429: Rate limit exceeded (10/min per user)
 * - 500: Server error
 */
export async function handleDeleteNote(request, env, noteId) {
  const logger = createLogger('API:DeleteNote', { note_id: noteId });

  try {
    // T079: Validate JWT and get user context (via requireAuth middleware)
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      logger.warn('Authentication failed');
      return authResult;
    }
    const user = authResult;

    logger.baseContext.user_id = user.user_id;

    // T082: Check rate limit (10 requests per minute per user)
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      env,
      'notes:delete',
      user.user_id
    );
    if (rateLimitResponse) {
      // Rate limit exceeded, return 429 response
      return rateLimitResponse;
    }

    // T080: Extract note_id from URL path (passed as parameter)
    if (!noteId || noteId.trim().length === 0) {
      return notFoundError('Note ID is required');
    }

    // T081: Soft delete note in database with user_id validation
    let deleted;
    try {
      const timer = logger.startTimer('db_query');
      deleted = await deleteNote(env, noteId, user.user_id);
      logger.endTimer(timer);
    } catch (error) {
      logger.error('Database operation failed', error);
      return internalServerError('Failed to delete note');
    }

    // T082: Check if note was deleted
    if (!deleted) {
      logger.warn('Note not found or already deleted');
      return notFoundError('Note not found');
    }

    logger.info('Note deleted successfully');

    // Return 204 No Content on success
    return new Response(null, {
      status: 204
    });

  } catch (error) {
    // Handle unexpected errors
    logger.error('Unexpected error', error);
    return internalServerError('Failed to delete note');
  }
}
