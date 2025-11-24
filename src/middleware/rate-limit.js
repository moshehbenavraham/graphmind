/**
 * Rate Limiting Middleware
 *
 * KV-based rate limiting for API endpoints.
 * Supports per-user and per-endpoint limits with configurable time windows.
 */

/**
 * Check and enforce rate limit for a user on an endpoint
 *
 * @param {string} key - Rate limit key (e.g., "backfill:{user_id}")
 * @param {number} limit - Maximum requests allowed in window
 * @param {number} windowSeconds - Time window in seconds
 * @param {Object} kv - Cloudflare KV namespace
 * @returns {Promise<Object>} { allowed: boolean, remaining: number, reset: number }
 */
export async function checkRateLimit(key, limit, windowSeconds, kv) {
  try {
    const rateLimitKey = `rate_limit:${key}`;

    // Get current count
    const currentData = await kv.get(rateLimitKey, { type: 'json' });

    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    if (!currentData) {
      // First request in window
      await kv.put(rateLimitKey, JSON.stringify({
        count: 1,
        resetAt: now + windowMs
      }), {
        expirationTtl: windowSeconds
      });

      return {
        allowed: true,
        remaining: limit - 1,
        reset: Math.floor((now + windowMs) / 1000)
      };
    }

    const { count, resetAt } = currentData;

    // Check if window has expired
    if (now >= resetAt) {
      // Reset window
      await kv.put(rateLimitKey, JSON.stringify({
        count: 1,
        resetAt: now + windowMs
      }), {
        expirationTtl: windowSeconds
      });

      return {
        allowed: true,
        remaining: limit - 1,
        reset: Math.floor((now + windowMs) / 1000)
      };
    }

    // Check if limit exceeded
    if (count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        reset: Math.floor(resetAt / 1000)
      };
    }

    // Increment count
    await kv.put(rateLimitKey, JSON.stringify({
      count: count + 1,
      resetAt
    }), {
      expirationTtl: Math.ceil((resetAt - now) / 1000)
    });

    return {
      allowed: true,
      remaining: limit - (count + 1),
      reset: Math.floor(resetAt / 1000)
    };

  } catch (error) {
    console.error('[RateLimit] Check failed:', error.message);
    // Fail open - allow request if rate limit check fails
    return {
      allowed: true,
      remaining: limit,
      reset: Math.floor((Date.now() + (windowSeconds * 1000)) / 1000)
    };
  }
}

/**
 * Create rate limit error response
 *
 * @param {number} resetTimestamp - Unix timestamp when rate limit resets
 * @returns {Response} 429 Too Many Requests response
 */
export function rateLimitError(resetTimestamp) {
  const retryAfter = Math.max(0, resetTimestamp - Math.floor(Date.now() / 1000));

  return new Response(JSON.stringify({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retry_after: retryAfter
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
      'X-RateLimit-Limit': '1',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(resetTimestamp)
    }
  });
}
