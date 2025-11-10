/**
 * Authentication Middleware
 *
 * JWT validation middleware for protected routes.
 *
 * Validates JWT tokens from Authorization header and attaches user context to request.
 *
 * Usage:
 *   const user = await authenticateRequest(request, env);
 *   if (!user) {
 *     return unauthorizedError('Invalid token');
 *   }
 *   // user = { user_id, email, namespace }
 */

import { verifyToken } from '../lib/auth/crypto.js';
import { unauthorizedError } from '../utils/errors.js';

/**
 * Extract JWT token from Authorization header
 *
 * Supports format: "Bearer {token}"
 *
 * @param {Request} request - Fetch API Request object
 * @returns {string|null} JWT token or null if not found
 */
function extractToken(request) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return null;
  }

  // Check for "Bearer {token}" format
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Check if token is blacklisted (revoked via logout)
 *
 * Optional feature - requires logout endpoint implementation.
 *
 * @param {string} token - JWT token
 * @param {Object} kv - Cloudflare KV namespace binding
 * @returns {Promise<boolean>} True if token is blacklisted
 */
async function isTokenBlacklisted(token, kv) {
  try {
    // Hash token for KV key (tokens can be very long)
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const key = `token:blacklist:${hashHex}`;
    const blacklisted = await kv.get(key);

    return blacklisted !== null;

  } catch (error) {
    console.error('[Auth] Failed to check token blacklist:', error.message);
    // Fail open - allow request if KV check fails
    return false;
  }
}

/**
 * Authenticate request and extract user context
 *
 * Validates JWT token and returns user information.
 *
 * @param {Request} request - Fetch API Request object
 * @param {Object} env - Worker environment bindings
 * @param {string} env.JWT_SECRET - JWT signing secret
 * @param {Object} [env.KV] - Optional KV binding for token blacklist
 * @returns {Promise<Object|null>} User context or null if authentication fails
 * @returns {string} user.user_id - User UUID
 * @returns {string} user.email - User email
 * @returns {string} user.namespace - FalkorDB namespace
 */
export async function authenticateRequest(request, env) {
  try {
    // Extract token from Authorization header
    const token = extractToken(request);

    if (!token) {
      return null;
    }

    // Verify JWT signature and expiration
    const claims = verifyToken(token, env.JWT_SECRET);

    // Optional: Check token blacklist (if logout feature enabled)
    if (env.KV) {
      const blacklisted = await isTokenBlacklisted(token, env.KV);
      if (blacklisted) {
        return null;
      }
    }

    // Extract user context from claims
    const user = {
      user_id: claims.sub,
      email: claims.email,
      namespace: claims.namespace
    };

    return user;

  } catch (error) {
    console.error('[Auth] Authentication failed:', error.message);
    return null;
  }
}

/**
 * Require authentication middleware
 *
 * Higher-level middleware that returns error response if authentication fails.
 *
 * @param {Request} request - Fetch API Request object
 * @param {Object} env - Worker environment bindings
 * @returns {Promise<Object>} User context or Response with error
 *
 * Usage:
 *   const authResult = await requireAuth(request, env);
 *   if (authResult instanceof Response) {
 *     return authResult;  // Authentication failed, return error response
 *   }
 *   const user = authResult;  // Authentication succeeded
 */
export async function requireAuth(request, env) {
  const user = await authenticateRequest(request, env);

  if (!user) {
    // Return appropriate error based on why authentication failed
    const token = extractToken(request);

    if (!token) {
      return unauthorizedError('Authentication required. Please provide a valid JWT token.');
    }

    try {
      // Try to get more specific error message
      verifyToken(token, env.JWT_SECRET);
      // If we get here, token is valid but blacklisted
      return unauthorizedError('Token revoked. Please log in again.');
    } catch (error) {
      if (error.message.includes('expired')) {
        return unauthorizedError('Session expired. Please log in again.');
      } else if (error.message.includes('signature')) {
        return unauthorizedError('Invalid authentication token.');
      } else {
        return unauthorizedError('Authentication failed.');
      }
    }
  }

  return user;
}

/**
 * Optional authentication middleware
 *
 * Attempts authentication but doesn't require it.
 * Useful for endpoints that have different behavior for authenticated vs anonymous users.
 *
 * @param {Request} request - Fetch API Request object
 * @param {Object} env - Worker environment bindings
 * @returns {Promise<Object|null>} User context or null if not authenticated
 */
export async function optionalAuth(request, env) {
  try {
    return await authenticateRequest(request, env);
  } catch (error) {
    // Ignore authentication errors for optional auth
    return null;
  }
}
