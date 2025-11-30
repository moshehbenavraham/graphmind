// @ts-check
/**
 * KV-Based Rate Limiting Middleware
 *
 * Implements rate limiting using Cloudflare KV for distributed state.
 * Supports both global and per-user rate limits.
 *
 * @module middleware/rateLimit
 */

/**
 * @typedef {Object} RateLimitConfig
 * @property {number} limit - Maximum requests allowed
 * @property {number} window - Time window in seconds
 * @property {'global'|'user'} scope - Rate limit scope
 */

/**
 * @typedef {Object} RateLimitCounterData
 * @property {number} count - Current request count
 * @property {number} resetTime - Unix timestamp when counter resets
 */

/**
 * @typedef {Object} RateLimitResult
 * @property {boolean} limited - Whether rate limit was exceeded
 * @property {number} remaining - Remaining requests
 * @property {number} retryAfter - Seconds until retry allowed
 * @property {number} resetTime - Unix timestamp when limit resets
 */

/**
 * Rate limit configuration
 * @type {Object<string, RateLimitConfig>}
 */
const RATE_LIMITS = {
  // Health check endpoint - global limit
  'health:falkordb': {
    limit: 60,
    window: 60, // 60 requests per 60 seconds (1 minute)
    scope: 'global',
  },
  // Client log ingestion endpoint - global limit to prevent spam
  'logs:ingest': {
    limit: 120,
    window: 60, // 120 requests per minute (sampled client logs)
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
  // Entity extraction endpoints - per-user limits (Feature 005)
  'entities:extract': {
    limit: 10,
    window: 60, // 10 requests per minute (manual extraction)
    scope: 'user',
  },
  'entities:extract-batch': {
    limit: 5,
    window: 3600, // 5 requests per hour (batch extraction)
    scope: 'user',
  },
  'entities:view': {
    limit: 60,
    window: 60, // 60 requests per minute (view extracted entities)
    scope: 'user',
  },
  'entities:cache-lookup': {
    limit: 120,
    window: 60, // 120 requests per minute (entity resolution cache lookup)
    scope: 'user',
  },
  // Voice query endpoints - per-user limits (Feature 008)
  'query:start': {
    limit: 30,
    window: 3600, // 30 queries per hour (prevent abuse)
    scope: 'user',
  },
  'query:history': {
    limit: 60,
    window: 3600, // 60 requests per hour (allow frequent browsing)
    scope: 'user',
  },
  'query:get': {
    limit: 120,
    window: 3600, // 120 requests per hour (support UI refreshes)
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
export async function rateLimitMiddleware(request, env, endpoint, userId = undefined) {
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
    // @ts-ignore - extending request with rate limit headers
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
 * @param {import('@cloudflare/workers-types').KVNamespace} kv - KV namespace binding
 * @param {string} key - Rate limit key
 * @param {RateLimitConfig} config - Rate limit configuration
 * @returns {Promise<RateLimitResult>} Rate limit status
 */
async function checkRateLimit(kv, key, config) {
  const now = Math.floor(Date.now() / 1000); // Current time in seconds

  // Get current counter from KV
  /** @type {RateLimitCounterData|null} */
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
  // @ts-ignore - rateLimitHeaders is extended on request by middleware
  if (!request.rateLimitHeaders) {
    return response;
  }

  // Clone response to add headers
  const newResponse = new Response(response.body, response);

  // Add rate limit headers
  // @ts-ignore - rateLimitHeaders is extended on request by middleware
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
 * @param {import('@cloudflare/workers-types').KVNamespace} kv - KV namespace binding
 * @param {string} endpoint - Endpoint identifier
 * @param {string} [userId] - User ID for user-scoped limits
 * @returns {Promise<void>}
 */
export async function resetRateLimit(kv, endpoint, userId = undefined) {
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

// ============================================================================
// Simple Standalone Rate Limiting Functions
// ============================================================================

/**
 * Check and enforce rate limit for a specific key
 *
 * Simple standalone function for custom rate limiting scenarios.
 *
 * @param {string} key - Rate limit key (e.g., "backfill:{user_id}")
 * @param {number} limit - Maximum requests allowed in window
 * @param {number} windowSeconds - Time window in seconds
 * @param {Object} kv - Cloudflare KV namespace
 * @returns {Promise<Object>} { allowed: boolean, remaining: number, reset: number }
 *
 * @example
 * const result = await checkRateLimitSimple('backfill:user123', 1, 3600, env.KV);
 * if (!result.allowed) {
 *   return rateLimitError(result.reset);
 * }
 */
export async function checkRateLimitSimple(key, limit, windowSeconds, kv) {
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
