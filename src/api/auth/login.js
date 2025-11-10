/**
 * User Login Endpoint
 *
 * POST /api/auth/login
 *
 * Handles user authentication with:
 * - Input validation (basic email/password check)
 * - Rate limiting (5 attempts per 15 minutes per email)
 * - Password verification with timing attack prevention
 * - JWT token generation
 * - Rate limit reset on successful login
 */

import { verifyPassword, verifyDummyPassword, generateToken } from '../../lib/auth/crypto.js';
import { validateLoginInput } from '../../lib/auth/validation.js';
import {
  checkLoginRateLimit,
  incrementLoginAttempts,
  resetLoginAttempts,
  getClientIP
} from '../../lib/auth/rate-limit.js';
import { authResponse } from '../../utils/responses.js';
import {
  validationError,
  unauthorizedError,
  rateLimitError,
  serviceUnavailableError,
  internalServerError
} from '../../utils/errors.js';

/**
 * Generate UUID v4 for session
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Handle user login
 *
 * @param {Request} request - Fetch API Request object
 * @param {Object} env - Worker environment bindings
 * @param {Object} env.DB - D1 database binding
 * @param {Object} env.KV - KV namespace binding
 * @param {string} env.JWT_SECRET - JWT signing secret
 * @returns {Promise<Response>} JSON response with JWT token and user data
 */
export async function handleLogin(request, env) {
  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return validationError(['Invalid JSON in request body']);
    }

    // T051: Validate input
    const validation = validateLoginInput(body);
    if (!validation.valid) {
      return validationError(validation.errors);
    }

    const { email, password } = validation.sanitized;

    // T052: Check login rate limit
    const rateLimit = await checkLoginRateLimit(email, env.KV);

    if (rateLimit.blocked) {
      const minutes = Math.ceil(rateLimit.retryAfter / 60);
      return rateLimitError(
        `Too many failed login attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`,
        rateLimit.retryAfter
      );
    }

    // T053: Look up user by email
    let user;
    try {
      user = await env.DB.prepare(
        `SELECT user_id, email, password_hash, name, falkordb_namespace, created_at, is_deleted
         FROM users
         WHERE email = ? AND is_deleted = FALSE
         LIMIT 1`
      ).bind(email).first();
    } catch (error) {
      console.error('[Login] Database query failed:', error.message);
      return serviceUnavailableError('Login temporarily unavailable');
    }

    // T054: Verify password
    let isValidPassword = false;

    if (!user) {
      // User not found - run dummy verification to prevent timing attacks
      await verifyDummyPassword();
      // Increment rate limit to prevent email enumeration
      await incrementLoginAttempts(email, env.KV);
      return unauthorizedError('Invalid email or password');
    } else {
      // User found - verify password
      try {
        isValidPassword = await verifyPassword(password, user.password_hash);
      } catch (error) {
        console.error('[Login] Password verification failed:', error.message);
        await incrementLoginAttempts(email, env.KV);
        return unauthorizedError('Invalid email or password');
      }
    }

    // Check password match
    if (!isValidPassword) {
      // Increment rate limit on failed attempt
      await incrementLoginAttempts(email, env.KV);
      return unauthorizedError('Invalid email or password');
    }

    // T055: Reset rate limit on successful login
    await resetLoginAttempts(email, env.KV);

    // T056: Generate JWT token
    let token;
    try {
      token = generateToken(
        {
          user_id: user.user_id,
          email: user.email,
          namespace: user.falkordb_namespace
        },
        env.JWT_SECRET
      );
    } catch (error) {
      console.error('[Login] Token generation failed:', error.message);
      return internalServerError('Login failed');
    }

    // T057: Create audit session record in D1
    try {
      const sessionId = generateUUID();
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
      const clientIP = getClientIP(request);

      await env.DB.prepare(
        `INSERT INTO sessions (session_id, user_id, session_type, metadata, created_at, expires_at)
         VALUES (?, ?, 'jwt', ?, ?, ?)`
      ).bind(
        sessionId,
        user.user_id,
        JSON.stringify({
          ip: clientIP,
          user_agent: request.headers.get('User-Agent') || 'unknown',
          action: 'login'
        }),
        now,
        expiresAt
      ).run();

    } catch (error) {
      console.error('[Login] Session audit failed:', error.message);
      // Don't fail login if audit fails - continue
    }

    // T058: Return success response
    console.log(`[Login] User logged in successfully: ${email}`);

    return authResponse(token, user, 200);

  } catch (error) {
    console.error('[Login] Unexpected error:', error);
    return internalServerError('Login failed');
  }
}
