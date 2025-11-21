/**
 * Rate Limiting Utilities
 *
 * Provides KV-based rate limiting for authentication endpoints:
 * - Login attempts: 5 attempts per 15 minutes per email
 * - Registration: 10 attempts per hour per IP
 *
 * Uses Cloudflare KV for distributed rate limiting with automatic TTL cleanup.
 */

/**
 * Check if login attempts are rate limited
 *
 * @param {string} email - Email address to check
 * @param {Object} kv - Cloudflare KV namespace binding
 * @returns {Promise<Object>} Rate limit status
 * @returns {boolean} result.blocked - True if rate limited
 * @returns {number} [result.remainingAttempts] - Attempts remaining before block
 * @returns {number} [result.retryAfter] - Seconds until rate limit expires
 *
 * Rate Limit: 5 attempts per 15 minutes (900 seconds)
 * KV Key: ratelimit:login:{email}
 */
export async function checkLoginRateLimit(email, kv) {
  try {
    const key = `ratelimit:login:${email}`;
    const data = await kv.get(key, { type: 'json' });

    if (!data) {
      // No rate limit active
      return { blocked: false, remainingAttempts: 5 };
    }

    const MAX_ATTEMPTS = 5;
    const TTL_SECONDS = 900; // 15 minutes

    if (data.attempts >= MAX_ATTEMPTS) {
      // Calculate time remaining until TTL expires
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - data.first_attempt;
      const retryAfter = Math.max(0, TTL_SECONDS - elapsed);

      return {
        blocked: true,
        remainingAttempts: 0,
        retryAfter
      };
    }

    // Not blocked yet
    return {
      blocked: false,
      remainingAttempts: MAX_ATTEMPTS - data.attempts
    };

  } catch (error) {
    console.error('[RateLimit] Failed to check login rate limit:', error.message);
    // Fail open - allow request if KV unavailable
    return { blocked: false, remainingAttempts: 5 };
  }
}

/**
 * Increment login attempt counter
 *
 * Called after failed login to track attempts.
 *
 * @param {string} email - Email address
 * @param {Object} kv - Cloudflare KV namespace binding
 * @returns {Promise<void>}
 */
export async function incrementLoginAttempts(email, kv) {
  try {
    const key = `ratelimit:login:${email}`;
    const TTL_SECONDS = 900; // 15 minutes

    // Get current data
    const data = await kv.get(key, { type: 'json' });

    if (!data) {
      // First failed attempt
      await kv.put(
        key,
        JSON.stringify({
          attempts: 1,
          first_attempt: Math.floor(Date.now() / 1000)
        }),
        { expirationTtl: TTL_SECONDS }
      );
    } else {
      // Increment attempts
      await kv.put(
        key,
        JSON.stringify({
          attempts: data.attempts + 1,
          first_attempt: data.first_attempt
        }),
        { expirationTtl: TTL_SECONDS }
      );
    }

  } catch (error) {
    console.error('[RateLimit] Failed to increment login attempts:', error.message);
    // Don't throw - rate limiting is a best-effort security measure
  }
}

/**
 * Reset login attempt counter
 *
 * Called after successful login to clear rate limit.
 *
 * @param {string} email - Email address
 * @param {Object} kv - Cloudflare KV namespace binding
 * @returns {Promise<void>}
 */
export async function resetLoginAttempts(email, kv) {
  try {
    const key = `ratelimit:login:${email}`;
    await kv.delete(key);
  } catch (error) {
    console.error('[RateLimit] Failed to reset login attempts:', error.message);
    // Don't throw - not critical if reset fails
  }
}

/**
 * Check if registration attempts are rate limited
 *
 * @param {string} ip - IP address to check
 * @param {Object} kv - Cloudflare KV namespace binding
 * @returns {Promise<Object>} Rate limit status
 * @returns {boolean} result.blocked - True if rate limited
 * @returns {number} [result.remainingAttempts] - Attempts remaining before block
 * @returns {number} [result.retryAfter] - Seconds until rate limit expires
 *
 * Rate Limit: 10 attempts per 1 hour (3600 seconds)
 * KV Key: ratelimit:register:{ip}
 */
export async function checkRegisterRateLimit(ip, kv) {
  try {
    const key = `ratelimit:register:${ip}`;
    const data = await kv.get(key, { type: 'json' });

    if (!data) {
      // No rate limit active
      return { blocked: false, remainingAttempts: 10 };
    }

    const MAX_ATTEMPTS = 10;
    const TTL_SECONDS = 3600; // 1 hour

    if (data.attempts >= MAX_ATTEMPTS) {
      // Calculate time remaining
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - data.first_attempt;
      const retryAfter = Math.max(0, TTL_SECONDS - elapsed);

      return {
        blocked: true,
        remainingAttempts: 0,
        retryAfter
      };
    }

    return {
      blocked: false,
      remainingAttempts: MAX_ATTEMPTS - data.attempts
    };

  } catch (error) {
    console.error('[RateLimit] Failed to check register rate limit:', error.message);
    // Fail open - allow request if KV unavailable
    return { blocked: false, remainingAttempts: 10 };
  }
}

/**
 * Increment registration attempt counter
 *
 * Called after each registration attempt (successful or failed).
 *
 * @param {string} ip - IP address
 * @param {Object} kv - Cloudflare KV namespace binding
 * @returns {Promise<void>}
 */
export async function incrementRegisterAttempts(ip, kv) {
  try {
    const key = `ratelimit:register:${ip}`;
    const TTL_SECONDS = 3600; // 1 hour

    // Get current data
    const data = await kv.get(key, { type: 'json' });

    if (!data) {
      // First registration attempt
      await kv.put(
        key,
        JSON.stringify({
          attempts: 1,
          first_attempt: Math.floor(Date.now() / 1000)
        }),
        { expirationTtl: TTL_SECONDS }
      );
    } else {
      // Increment attempts
      await kv.put(
        key,
        JSON.stringify({
          attempts: data.attempts + 1,
          first_attempt: data.first_attempt
        }),
        { expirationTtl: TTL_SECONDS }
      );
    }

  } catch (error) {
    console.error('[RateLimit] Failed to increment register attempts:', error.message);
    // Don't throw - rate limiting is best-effort
  }
}

/**
 * Extract IP address from request
 *
 * Uses Cloudflare's CF-Connecting-IP header for accurate client IP.
 *
 * @param {Request} request - Fetch API Request object
 * @returns {string} IP address
 */
export function getClientIP(request) {
  // Cloudflare provides real client IP in CF-Connecting-IP header
  const ip = request.headers.get('CF-Connecting-IP') ||
             request.headers.get('X-Forwarded-For')?.split(',')[0] ||
             'unknown';

  return ip;
}
