/**
 * Current User Endpoint
 *
 * GET /api/auth/me
 *
 * Returns current user information from JWT token.
 * No database lookup required - all info extracted from token claims.
 *
 * Requires authentication (valid JWT token in Authorization header).
 */

import { requireAuth } from '../../middleware/auth.js';
import { successResponse } from '../../utils/responses.js';

/**
 * Handle get current user request
 *
 * @param {Request} request - Fetch API Request object
 * @param {Object} env - Worker environment bindings
 * @returns {Promise<Response>} JSON response with user info and token expiration
 */
export async function handleGetMe(request, env) {
  // T070: Apply authentication middleware
  const authResult = await requireAuth(request, env);

  // T071: Check if authentication failed
  if (authResult instanceof Response) {
    return authResult;  // Return 401 error response
  }

  const user = authResult;

  // T072: Calculate token expiration info
  // Extract token to get exp claim
  const authHeader = request.headers.get('Authorization');
  const token = authHeader.split(' ')[1];

  // Decode token to get expiration (already verified by middleware)
  const parts = token.split('.');
  const payload = JSON.parse(atob(parts[1]));

  const issuedAt = new Date(payload.iat * 1000).toISOString();
  const expiresAt = new Date(payload.exp * 1000).toISOString();
  const expiresInSeconds = payload.exp - Math.floor(Date.now() / 1000);

  // T073: Return user info response
  return successResponse({
    user: {
      user_id: user.user_id,
      email: user.email,
      namespace: user.namespace
    },
    token_info: {
      issued_at: issuedAt,
      expires_at: expiresAt,
      expires_in_seconds: Math.max(0, expiresInSeconds)
    }
  }, 200);
}
