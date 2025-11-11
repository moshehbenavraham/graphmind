/**
 * GraphMind API - Cloudflare Workers Entry Point
 * Voice-first personal knowledge assistant with GraphRAG
 */

import { handleRegister } from './api/auth/register.js';
import { handleLogin } from './api/auth/login.js';
import { handleGetMe } from './api/auth/me.js';
import { handleFalkorDBHealth } from './workers/api/health/falkordb.js';
import { handleGraphInit } from './workers/api/graph/init.js';
import { handleStartRecording } from './workers/api/notes/start-recording.js';
import { handleListNotes } from './workers/api/notes/list.js';
import { handleGetNote } from './workers/api/notes/get.js';
import { handleDeleteNote } from './workers/api/notes/delete.js';
import { extractEntitiesForNote, extractEntitiesBatch } from './workers/api/entity-extraction.js';
import { getEntitiesForNote, lookupEntityCache } from './workers/api/entity-lookup.js';
import { corsPreflightResponse, addCorsHeaders } from './utils/responses.js';
import { internalServerError, unauthorizedError, badRequestError, notFoundError } from './utils/errors.js';
import { verifyToken } from './lib/auth/crypto.js';
import { getSession } from './lib/session/session-manager.js';

// Export Durable Objects
export { FalkorDBConnectionPool } from './durable-objects/FalkorDBConnectionPool.js';
export { VoiceSessionManager } from './durable-objects/VoiceSessionManager.js';

// Export Queue Consumer
export { default as queue } from './workers/consumers/entity-extraction-consumer.js';

/**
 * Handle WebSocket upgrade for voice note recording
 *
 * Validates the session_id, JWT token, and user authorization before
 * upgrading to WebSocket and forwarding to VoiceSessionManager Durable Object.
 *
 * @param {Request} request - The incoming HTTP request
 * @param {Object} env - Environment bindings
 * @param {URL} url - Parsed URL object
 * @returns {Promise<Response>} WebSocket response or error
 */
async function handleWebSocketUpgrade(request, env, url) {
  try {
    // T043: Check for WebSocket upgrade header
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return badRequestError('Expected Upgrade: websocket header');
    }

    // T044: Extract session_id from URL path
    // URL format: /ws/notes/:session_id
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[pathParts.length - 1];

    if (!sessionId || sessionId.length === 0) {
      return badRequestError('Missing session_id in URL path');
    }

    // T045: Extract JWT token from query parameter
    const token = url.searchParams.get('token');
    if (!token) {
      return unauthorizedError('Missing JWT token in query parameter');
    }

    // T046: Verify JWT token is valid
    let claims;
    try {
      claims = verifyToken(token, env.JWT_SECRET);
    } catch (error) {
      console.error('[WebSocket] JWT verification failed:', error.message);
      return unauthorizedError('Invalid or expired JWT token');
    }

    // Extract user_id from JWT claims
    const userId = claims.sub;
    if (!userId) {
      return unauthorizedError('Invalid JWT token: missing user_id');
    }

    // T047: Verify session exists in KV
    let sessionMetadata;
    try {
      sessionMetadata = await getSession(env, sessionId);
    } catch (error) {
      console.error('[WebSocket] Session retrieval failed:', error.message);
      return internalServerError('Failed to validate session');
    }

    if (!sessionMetadata) {
      return notFoundError('Session not found or expired');
    }

    // T048: Verify user_id from JWT matches session
    if (sessionMetadata.user_id !== userId) {
      console.warn(`[WebSocket] User ID mismatch: JWT=${userId}, Session=${sessionMetadata.user_id}`);
      return unauthorizedError('Session does not belong to authenticated user');
    }

    // T049: Check session status is active
    if (sessionMetadata.status !== 'active') {
      return badRequestError(`Session is not active (status: ${sessionMetadata.status})`);
    }

    // T050: Get VoiceSessionManager Durable Object stub
    // Use session_id as the DO name for deterministic routing
    const doId = env.VOICE_SESSION.idFromName(sessionId);
    const doStub = env.VOICE_SESSION.get(doId);

    // T051: Forward WebSocket upgrade request to Durable Object
    // The DO will handle the actual WebSocket upgrade and connection management
    const doResponse = await doStub.fetch(request);

    // T052: Return the DO response (should be 101 Switching Protocols with WebSocket)
    return doResponse;

  } catch (error) {
    // T053: Handle unexpected errors during upgrade
    console.error('[WebSocket] Upgrade error:', error);
    return internalServerError('WebSocket upgrade failed');
  }
}

export default {
  /**
   * Fetch handler - processes all incoming HTTP requests
   * @param {Request} request - The incoming request object
   * @param {Object} env - Environment bindings (DB, KV, AI, R2, etc.)
   * @param {Object} ctx - Execution context
   * @returns {Response} HTTP response
   */
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const method = request.method;

      // T101: Handle CORS preflight requests
      if (method === 'OPTIONS') {
        return corsPreflightResponse();
      }

      // T100: Authentication Routes
      if (url.pathname === '/api/auth/register' && method === 'POST') {
        const response = await handleRegister(request, env);
        return addCorsHeaders(response);
      }

      if (url.pathname === '/api/auth/login' && method === 'POST') {
        const response = await handleLogin(request, env);
        return addCorsHeaders(response);
      }

      if (url.pathname === '/api/auth/me' && method === 'GET') {
        const response = await handleGetMe(request, env);
        return addCorsHeaders(response);
      }

      // T026-T032: Start recording endpoint
      // Route: POST /api/notes/start-recording
      if (url.pathname === '/api/notes/start-recording' && method === 'POST') {
        const response = await handleStartRecording(request, env);
        return addCorsHeaders(response);
      }

      // T043-T053: WebSocket upgrade handler for voice note recording
      // Route: GET /ws/notes/:session_id?token=<jwt>
      if (url.pathname.startsWith('/ws/notes/') && method === 'GET') {
        return await handleWebSocketUpgrade(request, env, url);
      }

      // T070-T074: List notes endpoint
      // Route: GET /api/notes?limit=20&offset=0
      if (url.pathname === '/api/notes' && method === 'GET') {
        const response = await handleListNotes(request, env);
        return addCorsHeaders(response);
      }

      // T075-T078: Get note endpoint
      // Route: GET /api/notes/:note_id
      if (url.pathname.startsWith('/api/notes/') && method === 'GET') {
        // Extract note_id from path
        const pathParts = url.pathname.split('/');
        const noteId = pathParts[pathParts.length - 1];
        const response = await handleGetNote(request, env, noteId);
        return addCorsHeaders(response);
      }

      // T079-T082: Delete note endpoint
      // Route: DELETE /api/notes/:note_id
      if (url.pathname.startsWith('/api/notes/') && method === 'DELETE') {
        // Extract note_id from path
        const pathParts = url.pathname.split('/');
        const noteId = pathParts[pathParts.length - 1];
        const response = await handleDeleteNote(request, env, noteId);
        return addCorsHeaders(response);
      }

      // Entity Extraction Routes (Feature 005)

      // POST /api/notes/:note_id/extract-entities - Manual extraction trigger
      if (url.pathname.match(/^\/api\/notes\/[^\/]+\/extract-entities$/) && method === 'POST') {
        const pathParts = url.pathname.split('/');
        const noteId = pathParts[3];

        // Extract userId from JWT
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) {
          return addCorsHeaders(unauthorizedError('Missing JWT token'));
        }

        let claims;
        try {
          claims = verifyToken(token, env.JWT_SECRET);
        } catch (error) {
          return addCorsHeaders(unauthorizedError('Invalid or expired JWT token'));
        }

        const response = await extractEntitiesForNote(request, env, {
          userId: claims.sub,
          noteId
        });
        return addCorsHeaders(response);
      }

      // GET /api/notes/:note_id/entities - View extracted entities
      if (url.pathname.match(/^\/api\/notes\/[^\/]+\/entities$/) && method === 'GET') {
        const pathParts = url.pathname.split('/');
        const noteId = pathParts[3];

        // Extract userId from JWT
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) {
          return addCorsHeaders(unauthorizedError('Missing JWT token'));
        }

        let claims;
        try {
          claims = verifyToken(token, env.JWT_SECRET);
        } catch (error) {
          return addCorsHeaders(unauthorizedError('Invalid or expired JWT token'));
        }

        const response = await getEntitiesForNote(request, env, {
          userId: claims.sub,
          noteId
        });
        return addCorsHeaders(response);
      }

      // POST /api/entities/extract-batch - Batch extraction
      if (url.pathname === '/api/entities/extract-batch' && method === 'POST') {
        // Extract userId from JWT
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) {
          return addCorsHeaders(unauthorizedError('Missing JWT token'));
        }

        let claims;
        try {
          claims = verifyToken(token, env.JWT_SECRET);
        } catch (error) {
          return addCorsHeaders(unauthorizedError('Invalid or expired JWT token'));
        }

        const response = await extractEntitiesBatch(request, env, {
          userId: claims.sub
        });
        return addCorsHeaders(response);
      }

      // GET /api/entities/cache/:entity_key - Entity resolution lookup
      if (url.pathname.startsWith('/api/entities/cache/') && method === 'GET') {
        const pathParts = url.pathname.split('/');
        const entityKey = pathParts[pathParts.length - 1];

        // Extract userId from JWT
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) {
          return addCorsHeaders(unauthorizedError('Missing JWT token'));
        }

        let claims;
        try {
          claims = verifyToken(token, env.JWT_SECRET);
        } catch (error) {
          return addCorsHeaders(unauthorizedError('Invalid or expired JWT token'));
        }

        const response = await lookupEntityCache(request, env, {
          userId: claims.sub,
          entityKey
        });
        return addCorsHeaders(response);
      }

      // Basic health check endpoint
      if (url.pathname === '/') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'graphmind-api',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        bindings: {
          database: !!env.DB,
          kv: !!env.KV,
          ai: !!env.AI,
          r2: !!env.AUDIO_BUCKET
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Detailed health check endpoint
    if (url.pathname === '/api/health') {
      try {
        // Test D1 database connectivity
        const startTime = Date.now();
        const dbTest = await env.DB.prepare('SELECT 1 as test').first();
        const dbLatency = Date.now() - startTime;

        return new Response(JSON.stringify({
          status: 'ok',
          checks: {
            database: {
              connected: !!dbTest,
              latency_ms: dbLatency
            },
            kv: {
              connected: !!env.KV
            },
            ai: {
              available: !!env.AI
            },
            r2: {
              available: !!env.AUDIO_BUCKET
            }
          }
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          status: 'error',
          message: 'Health check failed',
          error: error.message,
          checks: {
            database: {
              connected: false,
              error: error.message
            }
          }
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }

    // T030: FalkorDB health check endpoint
    if (url.pathname === '/api/health/falkordb' && method === 'GET') {
      return await handleFalkorDBHealth(request, env);
    }

    // T055: Graph namespace init endpoint
    if (url.pathname === '/api/graph/init' && method === 'POST') {
      return await handleGraphInit(request, env);
    }

    // FalkorDB test endpoint
    if (url.pathname === '/api/test/falkordb' && method === 'POST') {
      try {
        const body = await request.json();
        const { userId, query } = body;

        if (!userId || !query) {
          return new Response(JSON.stringify({
            error: 'Missing userId or query'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Get Durable Object stub
        const id = env.FALKORDB_POOL.idFromName('default-pool');
        const stub = env.FALKORDB_POOL.get(id);

        // Execute query with credentials
        const doRequest = new Request('http://do/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              host: env.FALKORDB_HOST,
              port: env.FALKORDB_PORT,
              username: env.FALKORDB_USER || env.FALKORDB_USERNAME,
              password: env.FALKORDB_PASSWORD
            },
            userId,
            cypher: query,
            params: body.params || {}
          })
        });

        const doResponse = await stub.fetch(doRequest);
        const result = await doResponse.json();

        return new Response(JSON.stringify(result), {
          status: doResponse.status,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

      // 404 handler for unknown routes
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
        path: url.pathname
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });

    } catch (error) {
      // T102: Global error handling
      console.error('[Worker] Uncaught error:', error);

      // Never expose internal errors or sensitive data
      return internalServerError('An unexpected error occurred');
    }
  }
};
