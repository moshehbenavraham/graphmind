/**
 * Voice Notes D1 Query Utilities
 *
 * This module provides database query functions for voice notes operations.
 * All queries enforce user data isolation by requiring user_id filtering.
 *
 * Security considerations:
 * - All queries use parameterized statements to prevent SQL injection
 * - User data isolation: every query filters by user_id
 * - Soft deletes: deleted notes are never returned to users
 *
 * @module lib/db/voice-notes-queries
 */

/**
 * Insert a new voice note into the database
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {Object} noteData - Note data to insert
 * @param {string} noteData.note_id - Unique note identifier
 * @param {string} noteData.user_id - User identifier (for data isolation)
 * @param {string} noteData.transcript - Voice note transcript text
 * @param {number} noteData.duration_seconds - Recording duration in seconds
 * @param {number} noteData.word_count - Number of words in transcript
 * @returns {Promise<string>} The note_id of the created note
 * @throws {Error} If database operation fails
 *
 * @example
 * const noteId = await insertVoiceNote(env, {
 *   note_id: 'note_abc123',
 *   user_id: 'user_xyz789',
 *   transcript: 'Today I discussed the project...',
 *   duration_seconds: 120,
 *   word_count: 245
 * });
 */
export async function insertVoiceNote(env, noteData) {
  try {
    const { note_id, user_id, transcript, duration_seconds, word_count } = noteData;

    // Validate required fields
    if (!note_id || !user_id || !transcript) {
      throw new Error('Missing required fields: note_id, user_id, and transcript are required');
    }

    // Insert note with processing_status set to 'completed'
    const result = await env.DB.prepare(`
      INSERT INTO voice_notes (
        note_id,
        user_id,
        transcript,
        duration_seconds,
        word_count,
        processing_status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)
    `).bind(
      note_id,
      user_id,
      transcript,
      duration_seconds || null,
      word_count || null
    ).run();

    if (!result.success) {
      throw new Error('Failed to insert voice note');
    }

    return note_id;
  } catch (error) {
    console.error('Error inserting voice note:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get paginated list of user's voice notes
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} userId - User identifier for data isolation
 * @param {number} [limit=20] - Maximum number of notes to return
 * @param {number} [offset=0] - Number of notes to skip for pagination
 * @returns {Promise<Object>} Object containing notes array and total count
 * @returns {Array<Object>} returns.notes - Array of note objects
 * @returns {number} returns.total - Total number of notes for user
 * @throws {Error} If database operation fails
 *
 * @example
 * const result = await getUserNotes(env, 'user_xyz789', 20, 0);
 * console.log(result.notes);    // Array of 20 notes
 * console.log(result.total);    // Total notes count (e.g., 45)
 */
export async function getUserNotes(env, userId, limit = 20, offset = 0) {
  try {
    // Validate inputs
    if (!userId) {
      throw new Error('userId is required');
    }

    // Enforce reasonable limits
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safeOffset = Math.max(0, offset);

    // Get paginated notes
    const notesResult = await env.DB.prepare(`
      SELECT
        note_id,
        transcript,
        duration_seconds,
        word_count,
        created_at
      FROM voice_notes
      WHERE user_id = ? AND is_deleted = 0
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, safeLimit, safeOffset).all();

    // Get total count for pagination
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM voice_notes
      WHERE user_id = ? AND is_deleted = 0
    `).bind(userId).first();

    return {
      notes: notesResult.results || [],
      total: countResult?.total || 0
    };
  } catch (error) {
    console.error('Error fetching user notes:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get a specific voice note by ID
 *
 * This function enforces user data isolation by requiring both note_id and user_id.
 * Returns null if note doesn't exist, is deleted, or belongs to a different user.
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} noteId - Note identifier
 * @param {string} userId - User identifier (for data isolation)
 * @returns {Promise<Object|null>} Note object or null if not found
 * @throws {Error} If database operation fails
 *
 * @example
 * const note = await getNoteById(env, 'note_abc123', 'user_xyz789');
 * if (note) {
 *   console.log(note.transcript);
 * } else {
 *   console.log('Note not found or access denied');
 * }
 */
export async function getNoteById(env, noteId, userId) {
  try {
    // Validate inputs
    if (!noteId || !userId) {
      throw new Error('noteId and userId are required');
    }

    // Query note with user_id validation for data isolation
    const note = await env.DB.prepare(`
      SELECT
        note_id,
        user_id,
        transcript,
        duration_seconds,
        word_count,
        processing_status,
        created_at
      FROM voice_notes
      WHERE note_id = ? AND user_id = ? AND is_deleted = 0
    `).bind(noteId, userId).first();

    return note || null;
  } catch (error) {
    console.error('Error fetching note by ID:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Soft delete a voice note
 *
 * This function marks a note as deleted (sets is_deleted=1) rather than
 * physically removing it from the database. This allows for recovery and
 * maintains referential integrity.
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} noteId - Note identifier
 * @param {string} userId - User identifier (for data isolation)
 * @returns {Promise<boolean>} True if note was deleted, false if not found or already deleted
 * @throws {Error} If database operation fails
 *
 * @example
 * const success = await deleteNote(env, 'note_abc123', 'user_xyz789');
 * if (success) {
 *   console.log('Note deleted successfully');
 * } else {
 *   console.log('Note not found or already deleted');
 * }
 */
export async function deleteNote(env, noteId, userId) {
  try {
    // Validate inputs
    if (!noteId || !userId) {
      throw new Error('noteId and userId are required');
    }

    // Soft delete: set is_deleted flag to 1
    // User data isolation: only delete if user_id matches
    const result = await env.DB.prepare(`
      UPDATE voice_notes
      SET is_deleted = 1
      WHERE note_id = ? AND user_id = ? AND is_deleted = 0
    `).bind(noteId, userId).run();

    // Check if any rows were affected
    // meta.changes will be 1 if note was found and deleted, 0 otherwise
    return result.success && result.meta.changes > 0;
  } catch (error) {
    console.error('Error deleting note:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Count total number of voice notes for a user
 *
 * This function is useful for pagination calculations. Only counts
 * non-deleted notes.
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} userId - User identifier
 * @returns {Promise<number>} Total count of user's notes
 * @throws {Error} If database operation fails
 *
 * @example
 * const total = await countUserNotes(env, 'user_xyz789');
 * const pages = Math.ceil(total / 20);
 * console.log(`User has ${total} notes across ${pages} pages`);
 */
export async function countUserNotes(env, userId) {
  try {
    // Validate input
    if (!userId) {
      throw new Error('userId is required');
    }

    // Count non-deleted notes for user
    const result = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM voice_notes
      WHERE user_id = ? AND is_deleted = 0
    `).bind(userId).first();

    return result?.count || 0;
  } catch (error) {
    console.error('Error counting user notes:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}
