/**
 * Voice Query API Endpoints (Feature 008)
 *
 * Handles voice query session creation, query history, and query retrieval.
 *
 * Endpoints:
 * - POST /api/query/start - Create query session
 * - GET /api/query/history - List user query history
 * - GET /api/query/:query_id - Get specific query details
 *
 * @module workers/api/query
 */

import { requireAuth } from '../../middleware/auth.js';
import { rateLimitMiddleware } from '../../middleware/rateLimit.js';
import { createLogger } from '../../utils/logger.js';

/**
 * Add CORS headers to response
 * @param {Response} response - Response object
 * @param {string} origin - Request origin
 * @returns {Response} Response with CORS headers
 */
function addCorsHeaders(response, origin) {
  const allowedOrigins = [
    'https://graphmind.pages.dev',
    'https://www.graphmind.pages.dev',
    'http://localhost:3000',
    'http://localhost:8788'
  ];

  // Allow origin if in whitelist or if localhost (development)
  const isAllowed = allowedOrigins.includes(origin) || origin?.startsWith('http://localhost');

  if (isAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  }

  return response;
}

/**
 * Handle CORS preflight requests
 * @param {string} origin - Request origin
 * @returns {Response} Preflight response
 */
function handleCorsPreflightRequest(origin) {
  const response = new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });

  return addCorsHeaders(response, origin);
}

/**
 * Generate a unique session ID
 * @returns {string} Session ID in format "sess_" + UUID
 */
function generateSessionId() {
  return `sess_${crypto.randomUUID()}`;
}

/**
 * POST /api/query/start
 *
 * Create a new voice query session and return WebSocket URL
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Promise<Response>} Session details with WebSocket URL
 */
export async function startQuerySession(request, env) {
  const logger = createLogger('StartQuerySession');
  const origin = request.headers.get('Origin');

  try {
    // 1. Validate JWT token
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      logger.warn('Unauthorized query start attempt');
      return addCorsHeaders(authResult, origin); // Add CORS to error response
    }

    const user_id = authResult.user_id;
    logger.info('Query session start requested', { user_id });

    // 2. Check rate limit (30 queries/hour per user)
    const rateLimitResponse = await rateLimitMiddleware(request, env, 'query:start', user_id);
    if (rateLimitResponse) {
      logger.warn('Rate limit exceeded', { user_id, limit: 30 });
      return addCorsHeaders(rateLimitResponse, origin); // Add CORS to rate limit response
    }

    // 3. Generate unique session ID
    const sessionId = generateSessionId();
    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes

    logger.info('Session created', { session_id: sessionId, user_id });

    // 4. Get Durable Object ID for QuerySessionManager
    const doId = env.QUERY_SESSION_MANAGER.idFromName(sessionId);
    const doStub = env.QUERY_SESSION_MANAGER.get(doId);

    // 5. Build WebSocket URL
    // Note: In production, use the actual domain
    const url = new URL(request.url);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const websocketUrl = `${protocol}//${url.host}/ws/query/${sessionId}?user_id=${user_id}`;

    logger.info('WebSocket URL generated', { websocket_url: websocketUrl });

    // 6. Return session details
    const response = new Response(JSON.stringify({
      success: true,
      session_id: sessionId,
      websocket_url: websocketUrl,
      expires_at: expiresAt
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(response, origin);
  } catch (error) {
    logger.error('Error starting query session', error);
    const errorResponse = new Response(JSON.stringify({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Unable to create query session. Please try again.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(errorResponse, origin);
  }
}

/**
 * GET /api/query/history
 *
 * Retrieve user's query history with pagination
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Promise<Response>} Query history list
 */
export async function getQueryHistory(request, env) {
  const logger = createLogger('GetQueryHistory');
  const origin = request.headers.get('Origin');

  try {
    // 1. Validate JWT token
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      logger.warn('Unauthorized query history access attempt');
      return addCorsHeaders(authResult, origin);
    }

    const user_id = authResult.user_id;

    // 2. Check rate limit (60 requests/hour per design spec)
    const rateLimitResponse = await rateLimitMiddleware(request, env, 'query:history', user_id);
    if (rateLimitResponse) {
      logger.warn('Rate limit exceeded for query history', { user_id, limit: 60 });
      return addCorsHeaders(rateLimitResponse, origin);
    }

    // 3. Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';

    logger.info('Query history requested', { user_id, limit, offset, order });

    // 4. Query D1 voice_queries table
    const query = `
      SELECT
        query_id,
        question,
        json_array_length(graph_results, '$.entities') as entity_count,
        latency_ms,
        created_at
      FROM voice_queries
      WHERE user_id = ?
      ORDER BY created_at ${order}
      LIMIT ? OFFSET ?
    `;

    const results = await env.DB.prepare(query)
      .bind(user_id, limit, offset)
      .all();

    // 5. Get total count
    const countQuery = `SELECT COUNT(*) as total FROM voice_queries WHERE user_id = ?`;
    const countResult = await env.DB.prepare(countQuery).bind(user_id).first();
    const total = countResult?.total || 0;

    // 6. Format response
    const hasMore = offset + limit < total;

    const response = new Response(JSON.stringify({
      success: true,
      queries: results.results || [],
      total,
      has_more: hasMore,
      pagination: {
        limit,
        offset,
        next_offset: hasMore ? offset + limit : null
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(response, origin);
  } catch (error) {
    logger.error('Error retrieving query history', error);
    const errorResponse = new Response(JSON.stringify({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Unable to retrieve query history. Please try again.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(errorResponse, origin);
  }
}

/**
 * GET /api/query/:query_id
 *
 * Retrieve specific query details
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @param {string} queryId - Query ID from URL path
 * @returns {Promise<Response>} Query details
 */
export async function getQueryById(request, env, queryId) {
  const logger = createLogger('GetQueryById');
  const origin = request.headers.get('Origin');

  try {
    // 1. Validate JWT token
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      logger.warn('Unauthorized query access attempt', { query_id: queryId });
      return addCorsHeaders(authResult, origin);
    }

    const user_id = authResult.user_id;

    // 2. Check rate limit (120 requests/hour per design spec)
    const rateLimitResponse = await rateLimitMiddleware(request, env, 'query:get', user_id);
    if (rateLimitResponse) {
      logger.warn('Rate limit exceeded for query get', { user_id, query_id: queryId, limit: 120 });
      return addCorsHeaders(rateLimitResponse, origin);
    }

    logger.info('Query details requested', { query_id: queryId, user_id });

    // 3. Query D1 voice_queries table (with ownership check)
    const query = `
      SELECT *
      FROM voice_queries
      WHERE query_id = ? AND user_id = ?
      LIMIT 1
    `;

    const result = await env.DB.prepare(query)
      .bind(queryId, user_id)
      .first();

    // 4. Check if query exists
    if (!result) {
      logger.warn('Query not found or access denied', { query_id: queryId, user_id });
      const notFoundResponse = new Response(JSON.stringify({
        success: false,
        error: 'QUERY_NOT_FOUND',
        message: 'Query not found or you don\'t have access to it'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(notFoundResponse, origin);
    }

    // 5. Parse graph_results JSON
    let graphResults = {};
    try {
      graphResults = typeof result.graph_results === 'string'
        ? JSON.parse(result.graph_results)
        : result.graph_results;
    } catch (error) {
      logger.error('Error parsing graph_results JSON', error);
      graphResults = { entities: [], relationships: [], metadata: {} };
    }

    // 6. Format response
    const response = new Response(JSON.stringify({
      success: true,
      query: {
        query_id: result.query_id,
        question: result.question,
        cypher_query: result.cypher_query,
        results: graphResults,
        latency_ms: result.latency_ms,
        created_at: result.created_at
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(response, origin);
  } catch (error) {
    logger.error('Error retrieving query', error);
    const errorResponse = new Response(JSON.stringify({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Unable to retrieve query. Please try again.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(errorResponse, origin);
  }
}

/**
 * Route query API requests
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Promise<Response>} HTTP response
 */
export async function handleQueryRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const origin = request.headers.get('Origin');

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return handleCorsPreflightRequest(origin);
  }

  // POST /api/query/start
  if (request.method === 'POST' && path === '/api/query/start') {
    return startQuerySession(request, env);
  }

  // GET /api/query/history
  if (request.method === 'GET' && path === '/api/query/history') {
    return getQueryHistory(request, env);
  }

  // GET /api/query/:query_id
  const queryIdMatch = path.match(/^\/api\/query\/([a-zA-Z0-9_-]+)$/);
  if (request.method === 'GET' && queryIdMatch) {
    const queryId = queryIdMatch[1];
    return getQueryById(request, env, queryId);
  }

  // Unhandled route
  return new Response('Not Found', { status: 404 });
}
