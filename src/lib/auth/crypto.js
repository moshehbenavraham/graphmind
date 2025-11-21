/**
 * Authentication Cryptography Utilities
 *
 * Provides secure password hashing (bcrypt) and JWT token generation/verification.
 *
 * Security Features:
 * - bcrypt cost factor 12 (OWASP recommended, ~200ms hashing time)
 * - Timing attack prevention (always run verification even on failure)
 * - JWT with HS256 algorithm (HMAC-SHA256)
 * - 24-hour token expiration
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/**
 * Hash a password using bcrypt with cost factor 12
 *
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} bcrypt hash
 * @throws {Error} If hashing fails
 *
 * Performance: ~150-300ms on edge (cost factor 12)
 * Security: One-way hash, computationally expensive to reverse
 */
export async function hashPassword(password) {
  try {
    const BCRYPT_COST = 12;
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    return hash;
  } catch (error) {
    console.error('[Auth] Password hashing failed:', error.message);
    throw new Error('Password hashing failed');
  }
}

/**
 * Verify a password against a bcrypt hash
 *
 * @param {string} password - Plain text password to verify
 * @param {string} hash - bcrypt hash to compare against
 * @returns {Promise<boolean>} True if password matches, false otherwise
 *
 * Performance: ~150-300ms (intentionally slow to prevent brute force)
 * Security: Timing attack prevention - always runs verification
 */
export async function verifyPassword(password, hash) {
  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    console.error('[Auth] Password verification failed:', error.message);
    // Return false on error (fail closed)
    return false;
  }
}

/**
 * Generate a JWT token with user claims
 *
 * @param {Object} payload - Token payload
 * @param {string} payload.user_id - User UUID
 * @param {string} payload.email - User email
 * @param {string} payload.namespace - FalkorDB namespace (user_{uuid})
 * @param {string} secret - JWT signing secret
 * @returns {string} Signed JWT token
 * @throws {Error} If token generation fails
 *
 * Token Structure:
 * {
 *   sub: user_id,
 *   email: user@example.com,
 *   namespace: user_{uuid},
 *   iat: issued_at_timestamp,
 *   exp: expiration_timestamp
 * }
 */
export function generateToken(payload, secret) {
  try {
    const { user_id, email, namespace } = payload;

    if (!user_id || !email || !namespace) {
      throw new Error('Missing required payload fields: user_id, email, namespace');
    }

    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    // Create JWT claims
    const claims = {
      sub: user_id,      // Subject (user ID)
      email,             // User email
      namespace,         // FalkorDB namespace
      iat: Math.floor(Date.now() / 1000),  // Issued at
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)  // Expires in 24 hours
    };

    // Sign with HS256 (HMAC-SHA256)
    const token = jwt.sign(claims, secret, { algorithm: 'HS256' });
    return token;

  } catch (error) {
    console.error('[Auth] Token generation failed:', error.message);
    throw new Error('Token generation failed');
  }
}

/**
 * Verify and decode a JWT token
 *
 * @param {string} token - JWT token to verify
 * @param {string} secret - JWT signing secret
 * @returns {Object} Decoded token claims
 * @returns {string} claims.sub - User ID
 * @returns {string} claims.email - User email
 * @returns {string} claims.namespace - FalkorDB namespace
 * @returns {number} claims.iat - Issued at timestamp
 * @returns {number} claims.exp - Expiration timestamp
 * @throws {Error} If token is invalid, expired, or signature doesn't match
 *
 * Error Codes:
 * - TokenExpiredError: Token has expired (>24 hours old)
 * - JsonWebTokenError: Invalid signature or malformed token
 */
export function verifyToken(token, secret) {
  try {
    if (!token) {
      throw new Error('Token is required');
    }

    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    // Verify signature and expiration
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    return decoded;

  } catch (error) {
    // Re-throw JWT library errors with context
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token signature');
    } else {
      console.error('[Auth] Token verification failed:', error.message);
      throw new Error('Token verification failed');
    }
  }
}

/**
 * Timing-safe password verification for non-existent users
 *
 * This function runs bcrypt verification against a dummy hash to prevent
 * timing attacks that could be used to enumerate valid email addresses.
 *
 * Always takes ~200ms regardless of whether user exists.
 *
 * @returns {Promise<boolean>} Always returns false
 */
export async function verifyDummyPassword() {
  // Pre-computed bcrypt hash of "dummy" for timing attack prevention
  const DUMMY_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYmJ/eZaa8K';
  await bcrypt.compare('dummy', DUMMY_HASH);
  return false;
}
