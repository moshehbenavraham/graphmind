// @ts-check
/// <reference path="../../types/cloudflare.d.ts" />
/// <reference types="@cloudflare/workers-types" />

/**
 * Middleware Module
 *
 * Composable middleware functions for GraphMind API.
 * Provides authentication, rate limiting, CORS, and response handling.
 *
 * @module middleware
 */

// Note: Env type is imported from types/cloudflare.d.ts via reference directive

/**
 * @typedef {Object} ExtendedRequest
 * @property {Env} [env] - Worker environment bindings
 * @property {string} [userId] - Authenticated user ID
 * @property {Object} [claims] - JWT claims
 * @property {Object} [rateLimitHeaders] - Rate limit header values
 */

/**
 * @typedef {Request & ExtendedRequest} AppRequest
 */

/**
 * @typedef {(request: AppRequest, env: Env, ctx?: any) => Promise<Response|void>|Response|void} MiddlewareFn
 */

/**
 * @typedef {(request: AppRequest, env: Env, ctx?: any) => Promise<Response>|Response} HandlerFn
 */

import { corsPreflightResponse, addCorsHeaders } from '../utils/responses.js';
import { unauthorizedError } from '../utils/errors.js';
import { verifyToken } from '../lib/auth/crypto.js';
import { rateLimitMiddleware, addRateLimitHeaders, getRateLimitConfig } from './rateLimit.js';

// Re-export rate limit utilities
export {
  rateLimitMiddleware,
  addRateLimitHeaders,
  getRateLimitConfig,
  checkRateLimitSimple,
  rateLimitError,
  resetRateLimit
} from './rateLimit.js';

// ============================================================================
// Middleware Composers
// ============================================================================

/**
 * Compose multiple middleware functions into a single middleware
 *
 * Middleware functions can return a Response to short-circuit (e.g., errors),
 * or return nothing/void to continue to the next middleware.
 *
 * @param {...MiddlewareFn} middlewares - Middleware functions to compose
 * @returns {MiddlewareFn} Composed middleware function
 *
 * @example
 * const authAndRateLimit = compose(withAuth, withRateLimit('graph:read'));
 * router.get('/api/graph', authAndRateLimit, withCors(handleGraph));
 */
export function compose(...middlewares) {
  return async (request, env, ctx) => {
    for (const middleware of middlewares) {
      const result = await middleware(request, env, ctx);
      if (result instanceof Response) {
        return result;
      }
    }
  };
}

/**
 * Create a protected route handler with auth, rate limiting, and CORS
 *
 * @param {string} rateLimitEndpoint - Rate limit endpoint identifier
 * @param {HandlerFn} handler - Route handler function
 * @returns {HandlerFn} Protected handler with all middleware applied
 *
 * @example
 * router.get('/api/graph', protected('graph:read', handleGraph));
 */
export function protectedRoute(rateLimitEndpoint, handler) {
  return async (request, env, ctx) => {
    // Add env to request
    request.env = env;

    // Auth check
    const authResult = await withAuth(request, env);
    if (authResult) return addCorsHeaders(authResult);

    // Rate limit check
    const rateLimitResult = await withRateLimit(rateLimitEndpoint)(request, env);
    if (rateLimitResult) return rateLimitResult;

    // Execute handler
    const response = await handler(request, env, ctx);

    // Add CORS and rate limit headers
    let finalResponse = addCorsHeaders(response);
    if (request.rateLimitHeaders) {
      finalResponse = addRateLimitHeaders(finalResponse, request);
    }

    return finalResponse;
  };
}

// ============================================================================
// Individual Middleware Functions
// ============================================================================

/**
 * Add environment bindings to request
 *
 * @type {MiddlewareFn}
 */
export const withEnv = (request, env) => {
  // @ts-ignore - extending request with env property
  request.env = env;
};

/**
 * JWT Authentication middleware
 *
 * Extracts and verifies JWT token from Authorization header.
 * Adds userId and claims to request object.
 *
 * @param {AppRequest} request - Request object
 * @param {Env} env - Worker environment
 * @returns {Promise<Response|void>} Returns error Response if auth fails, undefined if successful
 *
 * @example
 * const authResult = await withAuth(request, env);
 * if (authResult) return authResult; // Auth failed
 */
export const withAuth = async (request, env) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return unauthorizedError('Missing JWT token');
  }

  try {
    const claims = verifyToken(token, env.JWT_SECRET);
    // @ts-ignore - extending request with user properties
    request.userId = claims.sub;
    // @ts-ignore - extending request with claims
    request.claims = claims;
  } catch (error) {
    return unauthorizedError('Invalid or expired JWT token');
  }
};

/**
 * Rate limiting middleware factory
 *
 * Creates a rate limiting middleware for a specific endpoint.
 * Requires withAuth to be called first to populate request.userId.
 *
 * @param {string} endpoint - Rate limit endpoint identifier
 * @returns {MiddlewareFn} Rate limiting middleware
 *
 * @example
 * const result = await withRateLimit('graph:read')(request, env);
 * if (result) return result; // Rate limited
 */
export const withRateLimit = (endpoint) => async (request, env) => {
  // @ts-ignore - userId is added by withAuth middleware
  const response = await rateLimitMiddleware(request, env, endpoint, request.userId);
  if (response) {
    return addCorsHeaders(response);
  }
};

/**
 * CORS response wrapper
 *
 * Wraps a handler to automatically add CORS and rate limit headers.
 *
 * @param {HandlerFn} handler - Handler function to wrap
 * @returns {HandlerFn} Handler with CORS headers
 *
 * @example
 * router.get('/api/graph', withCors(handleGraph));
 */
export const withCors = (handler) => async (request, env, ctx) => {
  const response = await handler(request, env, ctx);
  let corsResponse = addCorsHeaders(response);

  // Add rate limit headers if present
  // @ts-ignore - rateLimitHeaders is added by rate limit middleware
  if (request.rateLimitHeaders) {
    corsResponse = addRateLimitHeaders(corsResponse, request);
  }

  return corsResponse;
};

/**
 * Optional authentication middleware
 *
 * Like withAuth, but doesn't return an error if auth is missing.
 * Useful for endpoints that have different behavior for authenticated vs anonymous users.
 *
 * @param {AppRequest} request - Request object
 * @param {Env} env - Worker environment
 * @returns {Promise<void>} Always resolves (never returns error response)
 */
export const withOptionalAuth = async (request, env) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    // @ts-ignore - extending request with user properties
    request.userId = null;
    // @ts-ignore - extending request with claims
    request.claims = null;
    return;
  }

  try {
    const claims = verifyToken(token, env.JWT_SECRET);
    // @ts-ignore - extending request with user properties
    request.userId = claims.sub;
    // @ts-ignore - extending request with claims
    request.claims = claims;
  } catch (error) {
    // @ts-ignore - extending request with user properties
    request.userId = null;
    // @ts-ignore - extending request with claims
    request.claims = null;
  }
};

/**
 * Logging middleware
 *
 * Logs request information for debugging.
 *
 * @type {MiddlewareFn}
 */
export const withLogging = (request, env) => {
  const url = new URL(request.url);
  console.log(`[${request.method}] ${url.pathname}`);
};

/**
 * Request timing middleware
 *
 * Adds timing information to response headers.
 *
 * @param {HandlerFn} handler - Handler function to wrap
 * @returns {HandlerFn} Handler with timing
 */
export const withTiming = (handler) => async (request, env, ctx) => {
  const startTime = Date.now();
  const response = await handler(request, env, ctx);
  const duration = Date.now() - startTime;

  // Clone response to add header
  const timedResponse = new Response(response.body, response);
  timedResponse.headers.set('X-Response-Time', `${duration}ms`);

  return timedResponse;
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract path parameter from URL
 *
 * @param {string} pathname - URL pathname
 * @param {number} index - Index of path segment (from end, negative) or from start
 * @returns {string} Path parameter value
 *
 * @example
 * // For pathname '/api/notes/abc123/entities'
 * extractPathParam(pathname, -2); // 'abc123'
 * extractPathParam(pathname, 3);  // 'abc123'
 */
export function extractPathParam(pathname, index) {
  const parts = pathname.split('/').filter(Boolean);
  if (index < 0) {
    return parts[parts.length + index];
  }
  return parts[index];
}

/**
 * Parse query parameters from URL
 *
 * @param {URL} url - URL object
 * @param {Object} defaults - Default values for parameters
 * @returns {Object} Parsed parameters
 *
 * @example
 * const params = parseQueryParams(url, { limit: 20, offset: 0 });
 */
export function parseQueryParams(url, defaults = {}) {
  const params = { ...defaults };

  for (const [key, value] of url.searchParams.entries()) {
    if (key in defaults) {
      // Try to parse as number if default is a number
      if (typeof defaults[key] === 'number') {
        const parsed = parseInt(value, 10);
        params[key] = isNaN(parsed) ? defaults[key] : parsed;
      } else {
        params[key] = value;
      }
    }
  }

  return params;
}
