/**
 * User Registration Endpoint
 *
 * POST /api/auth/register
 *
 * Handles new user account creation with:
 * - Input validation (email format, password strength)
 * - Rate limiting (10 registrations per hour per IP)
 * - Duplicate email detection
 * - Secure password hashing (bcrypt cost 12)
 * - JWT token generation
 * - FalkorDB namespace assignment
 */

import { hashPassword, generateToken } from '../../lib/auth/crypto.js';
import { validateRegistrationInput } from '../../lib/auth/validation.js';
import {
  checkRegisterRateLimit,
  incrementRegisterAttempts,
  getClientIP
} from '../../lib/auth/rate-limit.js';
import { authResponse } from '../../utils/responses.js';
import {
  validationError,
  conflictError,
  rateLimitError,
  internalServerError,
  serviceUnavailableError
} from '../../utils/errors.js';

/**
 * Generate UUID v4
 * Uses crypto.randomUUID() which is available in Workers runtime
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Handle user registration
 *
 * @param {Request} request - Fetch API Request object
 * @param {Object} env - Worker environment bindings
 * @param {Object} env.DB - D1 database binding
 * @param {Object} env.KV - KV namespace binding
 * @param {string} env.JWT_SECRET - JWT signing secret
 * @returns {Promise<Response>} JSON response with JWT token and user data
 */
export async function handleRegister(request, env) {
  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return validationError(['Invalid JSON in request body']);
    }

    // T031: Validate input
    const validation = validateRegistrationInput(body);
    if (!validation.valid) {
      return validationError(validation.errors);
    }

    const { email, password, name } = validation.sanitized;

    // T032: Check registration rate limit
    const clientIP = getClientIP(request);
    const rateLimit = await checkRegisterRateLimit(clientIP, env.KV);

    if (rateLimit.blocked) {
      const minutes = Math.ceil(rateLimit.retryAfter / 60);
      return rateLimitError(
        `Registration limit exceeded. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`,
        rateLimit.retryAfter
      );
    }

    // Increment rate limit counter (track all registration attempts)
    await incrementRegisterAttempts(clientIP, env.KV);

    // T033: Check for duplicate email
    let existingUser;
    try {
      existingUser = await env.DB.prepare(
        'SELECT user_id FROM users WHERE email = ? LIMIT 1'
      ).bind(email).first();
    } catch (error) {
      console.error('[Register] Database query failed:', error.message);
      return serviceUnavailableError('Registration temporarily unavailable');
    }

    if (existingUser) {
      return conflictError('An account with this email already exists. Please log in or use a different email.');
    }

    // T034: Hash password
    let passwordHash;
    try {
      const hashStart = Date.now();
      passwordHash = await hashPassword(password);
      const hashDuration = Date.now() - hashStart;
      console.log(`[Register] Password hashed in ${hashDuration}ms`);
    } catch (error) {
      console.error('[Register] Password hashing failed:', error.message);
      return internalServerError('Registration failed');
    }

    // T035: Generate user identifiers
    const userId = generateUUID();
    const namespace = `user_${userId}`;
    const sessionId = generateUUID();

    // T036: Insert user into D1 database
    try {
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      // Use transaction for atomicity
      await env.DB.batch([
        // Insert user
        env.DB.prepare(
          `INSERT INTO users (user_id, email, password_hash, name, falkordb_namespace, created_at, updated_at, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)`
        ).bind(userId, email, passwordHash, name, namespace, now, now),

        // Insert session audit record
        env.DB.prepare(
          `INSERT INTO sessions (session_id, user_id, session_type, metadata, created_at, expires_at)
           VALUES (?, ?, 'jwt', ?, ?, ?)`
        ).bind(
          sessionId,
          userId,
          JSON.stringify({
            ip: clientIP,
            user_agent: request.headers.get('User-Agent') || 'unknown',
            action: 'registration'
          }),
          now,
          expiresAt
        )
      ]);

    } catch (error) {
      console.error('[Register] Database insert failed:', error.message);

      // Check if it's a unique constraint violation (race condition)
      if (error.message && error.message.includes('UNIQUE')) {
        return conflictError('An account with this email already exists.');
      }

      return internalServerError('Registration failed');
    }

    // T037: Generate JWT token
    let token;
    try {
      token = generateToken(
        {
          user_id: userId,
          email,
          namespace
        },
        env.JWT_SECRET
      );
    } catch (error) {
      console.error('[Register] Token generation failed:', error.message);
      // User created but token failed - user can still login
      return internalServerError('Registration completed but token generation failed. Please log in.');
    }

    // T038: Return success response
    const user = {
      user_id: userId,
      email,
      name,
      falkordb_namespace: namespace,
      created_at: new Date().toISOString()
    };

    console.log(`[Register] User registered successfully: ${email}`);

    return authResponse(token, user, 201);

  } catch (error) {
    console.error('[Register] Unexpected error:', error);
    return internalServerError('Registration failed');
  }
}
