/**
 * Success Response Utilities
 *
 * Provides standardized success response formatting for all API endpoints.
 *
 * Success Response Format:
 * {
 *   ...data fields
 * }
 */

/**
 * Create standardized success response
 *
 * @param {Object} data - Response data
 * @param {number} [status] - HTTP status code (default: 200)
 * @param {Object} [headers] - Optional additional headers
 * @returns {Response} JSON response with data
 */
export function successResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Format user object for API responses
 *
 * Strips sensitive fields (password_hash) from user object.
 *
 * @param {Object} user - User object from database
 * @param {string} user.user_id - User UUID
 * @param {string} user.email - User email
 * @param {string} [user.name] - User display name
 * @param {string} user.falkordb_namespace - FalkorDB namespace
 * @param {string} user.created_at - Account creation timestamp
 * @param {string} [user.password_hash] - Password hash (WILL BE STRIPPED)
 * @returns {Object} Sanitized user object
 */
export function userResponse(user) {
  if (!user) {
    return null;
  }

  // Strip sensitive fields
  const { password_hash, is_deleted, updated_at, ...safeUser } = user;

  return {
    user_id: safeUser.user_id,
    email: safeUser.email,
    name: safeUser.name || null,
    namespace: safeUser.falkordb_namespace,
    created_at: safeUser.created_at
  };
}

/**
 * Create authentication response (registration/login)
 *
 * Returns JWT token and user object.
 *
 * @param {string} token - JWT authentication token
 * @param {Object} user - User object from database
 * @param {number} [status] - HTTP status code (default: 200, use 201 for registration)
 * @returns {Response} JSON response with token and user
 */
export function authResponse(token, user, status = 200) {
  return successResponse({
    token,
    user: userResponse(user)
  }, status);
}

/**
 * Add CORS headers to response
 *
 * @param {Response} response - Response object
 * @param {string} [origin] - Allowed origin (default: *)
 * @returns {Response} Response with CORS headers
 */
export function addCorsHeaders(response, origin = '*') {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours

  return response;
}

/**
 * Handle OPTIONS preflight request
 *
 * @param {string} [origin] - Allowed origin (default: *)
 * @returns {Response} 204 No Content with CORS headers
 */
export function corsPreflightResponse(origin = '*') {
  const response = new Response(null, { status: 204 });
  return addCorsHeaders(response, origin);
}

/**
 * Add rate limit headers to response
 *
 * @param {Response} response - Response object
 * @param {number} remaining - Remaining attempts
 * @param {number} [limit] - Total limit (optional)
 * @returns {Response} Response with rate limit headers
 */
export function addRateLimitHeaders(response, remaining, limit = null) {
  response.headers.set('X-RateLimit-Remaining', remaining.toString());

  if (limit !== null) {
    response.headers.set('X-RateLimit-Limit', limit.toString());
  }

  return response;
}
