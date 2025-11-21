/**
 * Session Management Utility
 *
 * Provides session management for voice recording and query sessions.
 * Sessions are stored in KV with a 1-hour TTL and include metadata
 * for tracking user activity and session state.
 *
 * @module session-manager
 */

/**
 * Session status enum
 * @typedef {'active' | 'completed' | 'failed'} SessionStatus
 */

/**
 * Session metadata structure stored in KV
 * @typedef {Object} SessionMetadata
 * @property {string} user_id - User ID from authenticated JWT
 * @property {number} created_at - Unix timestamp of session creation
 * @property {SessionStatus} status - Current session status
 * @property {number} expires_at - Unix timestamp when session expires
 */

/**
 * Session ID validation regex
 * Format: "sess_" followed by UUID
 */
const SESSION_ID_REGEX = /^sess_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Session TTL in seconds (1 hour)
 */
const SESSION_TTL = 3600;

/**
 * KV key prefix for sessions
 */
const SESSION_KEY_PREFIX = 'session:';

/**
 * Generate a unique session ID with format "sess_" + UUID
 *
 * Uses crypto.randomUUID() for cryptographically secure random IDs.
 *
 * @returns {string} Session ID in format "sess_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *
 * @example
 * const sessionId = generateSessionId();
 * // Returns: "sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 */
export function generateSessionId() {
  return `sess_${crypto.randomUUID()}`;
}

/**
 * Validate session ID format
 *
 * Checks if the session ID matches the expected format:
 * "sess_" followed by a valid UUID v4.
 *
 * @param {string} sessionId - Session ID to validate
 * @returns {boolean} True if valid, false otherwise
 *
 * @example
 * validateSessionId("sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890"); // true
 * validateSessionId("invalid_id"); // false
 * validateSessionId(""); // false
 * validateSessionId(null); // false
 */
export function validateSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }
  return SESSION_ID_REGEX.test(sessionId);
}

/**
 * Create a new session and store metadata in KV
 *
 * Stores session metadata with a 1-hour TTL. The session will automatically
 * expire after the TTL unless explicitly deleted.
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {Object} env.KV - KV namespace binding
 * @param {string} userId - User ID from authenticated JWT token
 * @param {string} sessionId - Pre-generated session ID
 * @returns {Promise<SessionMetadata>} Created session metadata
 * @throws {Error} If userId or sessionId is invalid
 * @throws {Error} If KV storage fails
 *
 * @example
 * const sessionId = generateSessionId();
 * const metadata = await createSession(env, "user_123", sessionId);
 * // Returns: { user_id: "user_123", created_at: 1699700000000, status: "active", expires_at: 1699703600000 }
 */
export async function createSession(env, userId, sessionId) {
  // Validate inputs
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }

  if (!validateSessionId(sessionId)) {
    throw new Error('Invalid sessionId: must match format "sess_" + UUID');
  }

  if (!env?.KV) {
    throw new Error('KV namespace not available in environment');
  }

  // Create session metadata
  const now = Date.now();
  const metadata = {
    user_id: userId,
    created_at: now,
    status: 'active',
    expires_at: now + (SESSION_TTL * 1000)
  };

  // Store in KV with TTL
  const key = `${SESSION_KEY_PREFIX}${sessionId}`;
  try {
    await env.KV.put(key, JSON.stringify(metadata), {
      expirationTtl: SESSION_TTL
    });
  } catch (error) {
    throw new Error(`Failed to create session in KV: ${error.message}`);
  }

  return metadata;
}

/**
 * Retrieve session metadata from KV
 *
 * Fetches the session metadata for a given session ID.
 * Returns null if the session doesn't exist or has expired.
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {Object} env.KV - KV namespace binding
 * @param {string} sessionId - Session ID to retrieve
 * @returns {Promise<SessionMetadata|null>} Session metadata or null if not found
 * @throws {Error} If sessionId is invalid
 * @throws {Error} If KV retrieval fails
 *
 * @example
 * const metadata = await getSession(env, sessionId);
 * if (metadata) {
 *   console.log(`Session for user ${metadata.user_id} is ${metadata.status}`);
 * } else {
 *   console.log("Session not found or expired");
 * }
 */
export async function getSession(env, sessionId) {
  // Validate input
  if (!validateSessionId(sessionId)) {
    throw new Error('Invalid sessionId: must match format "sess_" + UUID');
  }

  if (!env?.KV) {
    throw new Error('KV namespace not available in environment');
  }

  // Retrieve from KV
  const key = `${SESSION_KEY_PREFIX}${sessionId}`;
  let value;

  try {
    value = await env.KV.get(key);
  } catch (error) {
    throw new Error(`Failed to retrieve session from KV: ${error.message}`);
  }

  if (!value) {
    return null;
  }

  // Parse and return metadata
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Failed to parse session metadata: ${error.message}`);
  }
}

/**
 * Update session status in KV
 *
 * Updates only the status field of an existing session.
 * Preserves the original TTL of the session.
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {Object} env.KV - KV namespace binding
 * @param {string} sessionId - Session ID to update
 * @param {SessionStatus} status - New status ('active', 'completed', or 'failed')
 * @returns {Promise<SessionMetadata>} Updated session metadata
 * @throws {Error} If sessionId or status is invalid
 * @throws {Error} If session doesn't exist
 * @throws {Error} If KV update fails
 *
 * @example
 * await updateSessionStatus(env, sessionId, "completed");
 */
export async function updateSessionStatus(env, sessionId, status) {
  // Validate inputs
  if (!validateSessionId(sessionId)) {
    throw new Error('Invalid sessionId: must match format "sess_" + UUID');
  }

  const validStatuses = ['active', 'completed', 'failed'];
  if (!status || !validStatuses.includes(status)) {
    throw new Error(`Invalid status: must be one of ${validStatuses.join(', ')}`);
  }

  if (!env?.KV) {
    throw new Error('KV namespace not available in environment');
  }

  // Get existing session
  const metadata = await getSession(env, sessionId);
  if (!metadata) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Update status
  metadata.status = status;

  // Calculate remaining TTL
  const now = Date.now();
  const remainingTtl = Math.max(0, Math.floor((metadata.expires_at - now) / 1000));

  // Store updated metadata with remaining TTL
  const key = `${SESSION_KEY_PREFIX}${sessionId}`;
  try {
    await env.KV.put(key, JSON.stringify(metadata), {
      expirationTtl: remainingTtl
    });
  } catch (error) {
    throw new Error(`Failed to update session in KV: ${error.message}`);
  }

  return metadata;
}

/**
 * Delete session from KV
 *
 * Immediately removes the session from KV storage.
 * This is useful for cleanup after session completion or on explicit logout.
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {Object} env.KV - KV namespace binding
 * @param {string} sessionId - Session ID to delete
 * @returns {Promise<void>}
 * @throws {Error} If sessionId is invalid
 * @throws {Error} If KV deletion fails
 *
 * @example
 * await deleteSession(env, sessionId);
 * console.log("Session deleted successfully");
 */
export async function deleteSession(env, sessionId) {
  // Validate input
  if (!validateSessionId(sessionId)) {
    throw new Error('Invalid sessionId: must match format "sess_" + UUID');
  }

  if (!env?.KV) {
    throw new Error('KV namespace not available in environment');
  }

  // Delete from KV
  const key = `${SESSION_KEY_PREFIX}${sessionId}`;
  try {
    await env.KV.delete(key);
  } catch (error) {
    throw new Error(`Failed to delete session from KV: ${error.message}`);
  }
}
