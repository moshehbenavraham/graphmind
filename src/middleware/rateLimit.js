/**
 * KV-Based Rate Limiting Middleware
 *
 * Implements rate limiting using Cloudflare KV for distributed state.
 * Supports both global and per-user rate limits.
 *
 * @module middleware/rateLimit
 */

/**
 * Rate limit configuration
 */
const RATE_LIMITS = {
  // Health check endpoint - global limit
  'health:falkordb': {
    limit: 60,
    window: 60, // 60 requests per 60 seconds (1 minute)
    scope: 'global',
  },
  // Graph init endpoint - per-user limit
  'graph:init': {
    limit: 10,
    window: 60, // 10 requests per 60 seconds (1 minute)
    scope: 'user',
  },
  // Voice notes endpoints - per-user limits (Feature 004)
  'notes:start-recording': {
    limit: 10,
    window: 3600, // 10 requests per hour (3600 seconds)
    scope: 'user',
  },
  'notes:list': {
    limit: 60,
    window: 60, // 60 requests per minute
    scope: 'user',
  },
  'notes:get': {
    limit: 60,
    window: 60, // 60 requests per minute
    scope: 'user',
  },
  'notes:delete': {
    limit: 10,
    window: 60, // 10 requests per minute
    scope: 'user',
  },
  // Default limit for unlisted endpoints
  default: {
    limit: 100,
    window: 60,
    scope: 'global',
  },
};

/**
 * Rate limit middleware
 *
 * Checks if request is within rate limit and updates counter.
 * Returns 429 Too Many Requests if limit exceeded.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Worker environment bindings
 * @param {string} endpoint - Endpoint identifier (e.g., 'health:falkordb', 'graph:init')
 * @param {string} [userId] - User ID for per-user limits
 * @returns {Promise<Response|null>} Response if rate limited, null if allowed
 *
 * @example
 * // In a Worker handler
 * const rateLimitResponse = await rateLimitMiddleware(request, env, 'health:falkordb');
 * if (rateLimitResponse) {
 *   return rateLimitResponse; // 429 response
 * }
 * // Continue with normal request handling
 */
export async function rateLimitMiddleware(request, env, endpoint, userId = null) {
  // Get rate limit config for endpoint
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;

  // Build KV key based on scope
  let kvKey;
  if (config.scope === 'user') {
    if (!userId) {
      // User-scoped limit requires userId
      console.error('[RateLimit] User ID required for user-scoped endpoint:', endpoint);
      // Fail open - allow request if userId missing
      return null;
    }
    kvKey = `ratelimit:${endpoint}:${userId}`;
  } else {
    // Global scope
    kvKey = `ratelimit:${endpoint}:global`;
  }

  // Check KV for rate limit status
  try {
    const result = await checkRateLimit(env.RATE_LIMIT, kvKey, config);

    if (result.limited) {
      // Rate limit exceeded
      return new Response(
        JSON.stringify({
          error: 'Rate Limit Exceeded',
          message: `Maximum ${config.limit} requests per ${config.window} seconds`,
          retry_after: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': result.retryAfter.toString(),
            'X-RateLimit-Limit': config.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetTime.toString(),
          },
        }
      );
    }

    // Add rate limit headers to request context (to be added to response later)
    request.rateLimitHeaders = {
      'X-RateLimit-Limit': config.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetTime.toString(),
    };

    return null; // Not rate limited, allow request
  } catch (error) {
    console.error('[RateLimit] KV error - failing open:', error.message);
    // Fail open - allow request if KV is unavailable
    return null;
  }
}

/**
 * Check rate limit in KV and update counter
 *
 * Uses KV atomic operations to track request counts with expiry.
 *
 * @param {KVNamespace} kv - KV namespace binding
 * @param {string} key - Rate limit key
 * @param {Object} config - Rate limit configuration
 * @returns {Promise<Object>} Rate limit status
 */
async function checkRateLimit(kv, key, config) {
  const now = Math.floor(Date.now() / 1000); // Current time in seconds

  // Get current counter from KV
  const counterData = await kv.get(key, { type: 'json' });

  let count = 0;
  let resetTime = now + config.window;

  if (counterData) {
    // Counter exists - check if it's expired
    if (counterData.resetTime > now) {
      // Counter is still valid
      count = counterData.count;
      resetTime = counterData.resetTime;
    }
    // If counter expired, start fresh (count = 0)
  }

  // Check if limit exceeded
  if (count >= config.limit) {
    const retryAfter = resetTime - now;
    return {
      limited: true,
      remaining: 0,
      retryAfter: Math.max(retryAfter, 1),
      resetTime,
    };
  }

  // Increment counter
  count += 1;

  // Update counter in KV with expiry
  await kv.put(
    key,
    JSON.stringify({
      count,
      resetTime,
    }),
    {
      expirationTtl: config.window,
    }
  );

  return {
    limited: false,
    remaining: config.limit - count,
    retryAfter: 0,
    resetTime,
  };
}

/**
 * Add rate limit headers to response
 *
 * Adds X-RateLimit-* headers to response if they exist in request context.
 *
 * @param {Response} response - Original response
 * @param {Request} request - Request with rate limit headers
 * @returns {Response} Response with rate limit headers
 *
 * @example
 * let response = new Response('OK', { status: 200 });
 * response = addRateLimitHeaders(response, request);
 * return response;
 */
export function addRateLimitHeaders(response, request) {
  if (!request.rateLimitHeaders) {
    return response;
  }

  // Clone response to add headers
  const newResponse = new Response(response.body, response);

  // Add rate limit headers
  Object.entries(request.rateLimitHeaders).forEach(([header, value]) => {
    newResponse.headers.set(header, value);
  });

  return newResponse;
}

/**
 * Get rate limit configuration for an endpoint
 *
 * @param {string} endpoint - Endpoint identifier
 * @returns {Object} Rate limit configuration
 */
export function getRateLimitConfig(endpoint) {
  return RATE_LIMITS[endpoint] || RATE_LIMITS.default;
}

/**
 * Reset rate limit for a specific key (admin/testing only)
 *
 * @param {KVNamespace} kv - KV namespace binding
 * @param {string} endpoint - Endpoint identifier
 * @param {string} [userId] - User ID for user-scoped limits
 * @returns {Promise<void>}
 */
export async function resetRateLimit(kv, endpoint, userId = null) {
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;

  let kvKey;
  if (config.scope === 'user' && userId) {
    kvKey = `ratelimit:${endpoint}:${userId}`;
  } else {
    kvKey = `ratelimit:${endpoint}:global`;
  }

  await kv.delete(kvKey);
  console.log('[RateLimit] Reset rate limit:', kvKey);
}
