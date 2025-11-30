// @ts-check
/// <reference path="../types/cloudflare.d.ts" />
/// <reference types="@cloudflare/workers-types" />

/**
 * GraphMind API Router
 *
 * Declarative routing using itty-router with middleware composition.
 * Replaces the if/else routing block in index.js.
 *
 * @module router
 */

import { Router } from 'itty-router';
import { corsPreflightResponse, addCorsHeaders } from './utils/responses.js';
import { internalServerError, unauthorizedError, badRequestError, notFoundError } from './utils/errors.js';
import { verifyToken } from './lib/auth/crypto.js';
import { getSession } from './lib/session/session-manager.js';
import {
  withEnv,
  withAuth,
  withRateLimit,
  withCors,
  protectedRoute,
  addRateLimitHeaders
} from './middleware/index.js';

// Import handlers
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
import { handleGetGraph } from './api/graph/get-graph.js';
import { handleGetEntity } from './api/graph/get-entity.js';
import { handleSearchEntities } from './api/graph/search-entities.js';
import { handleGetGraphStats } from './api/graph/get-stats.js';
import { handleMergeEntities } from './api/graph/merge-entities.js';
import { handleTriggerGraphSync } from './api/test/trigger-graph-sync.js';
import { handleClientLogs } from './api/logs/ingest-client-logs.js';
import { handleTestGraphDirect } from './api/test/test-graph-direct.js';
import { handleTestSimpleCypher } from './api/test/test-simple-cypher.js';
import { handleTestRedisDirect } from './api/test/test-redis-direct.js';
import { handleCheckPoolWarmup } from './api/test/check-pool-warmup.js';
import { handleInitPool } from './api/test/init-pool.js';
import { handleBenchmarkFalkorDB } from './api/test/benchmark-falkordb.js';
import { handleQueryRequest } from './workers/api/query.js';
import { handleSeedDataV2 } from './workers/api/seed-data.js';
import { handleBackfillEmbeddings } from './workers/api/admin/backfill-embeddings.js';

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * Health check response
 */
const handleHealthRoot = (request, env) => {
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
    headers: { 'Content-Type': 'application/json' }
  });
};

/**
 * Detailed health check
 */
const handleHealthApi = async (request, env) => {
  try {
    const startTime = Date.now();
    const dbTest = await env.DB.prepare('SELECT 1 as test').first();
    const dbLatency = Date.now() - startTime;

    return new Response(JSON.stringify({
      status: 'ok',
      checks: {
        database: { connected: !!dbTest, latency_ms: dbLatency },
        kv: { connected: !!env.KV },
        ai: { available: !!env.AI },
        r2: { available: !!env.AUDIO_BUCKET }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      checks: {
        database: { connected: false, error: error.message }
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * WebSocket upgrade for voice note recording
 */
const handleNotesWebSocket = async (request, env) => {
  try {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return badRequestError('Expected Upgrade: websocket header');
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[pathParts.length - 1];

    if (!sessionId || sessionId.length === 0) {
      return badRequestError('Missing session_id in URL path');
    }

    const token = url.searchParams.get('token');
    if (!token) {
      return unauthorizedError('Missing JWT token in query parameter');
    }

    let claims;
    try {
      claims = verifyToken(token, env.JWT_SECRET);
    } catch (error) {
      console.error('[WebSocket] JWT verification failed:', error.message);
      return unauthorizedError('Invalid or expired JWT token');
    }

    const userId = claims.sub;
    if (!userId) {
      return unauthorizedError('Invalid JWT token: missing user_id');
    }

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

    if (sessionMetadata.user_id !== userId) {
      console.warn(`[WebSocket] User ID mismatch: JWT=${userId}, Session=${sessionMetadata.user_id}`);
      return unauthorizedError('Session does not belong to authenticated user');
    }

    if (sessionMetadata.status !== 'active') {
      return badRequestError(`Session is not active (status: ${sessionMetadata.status})`);
    }

    const doId = env.VOICE_SESSION.idFromName(sessionId);
    const doStub = env.VOICE_SESSION.get(doId);

    return await doStub.fetch(request);
  } catch (error) {
    console.error('[WebSocket] Upgrade error:', error);
    return internalServerError('WebSocket upgrade failed');
  }
};

/**
 * WebSocket upgrade for voice query sessions
 */
const handleQueryWebSocket = async (request, env) => {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return badRequestError('Expected Upgrade: websocket header');
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const sessionId = pathParts[pathParts.length - 1];

  if (!sessionId || sessionId.length === 0) {
    return badRequestError('Missing session_id in URL path');
  }

  const token = url.searchParams.get('token');
  if (!token) {
    return unauthorizedError('Missing JWT token in query parameter');
  }

  let claims;
  try {
    claims = verifyToken(token, env.JWT_SECRET);
  } catch (error) {
    console.error('[WebSocket Query] JWT verification failed:', error.message);
    return unauthorizedError('Invalid or expired JWT token');
  }

  const userId = claims.sub;
  if (!userId) {
    return unauthorizedError('Invalid JWT token: missing user_id');
  }

  const doId = env.QUERY_SESSION_MANAGER.idFromName(sessionId);
  const doStub = env.QUERY_SESSION_MANAGER.get(doId);

  const doUrl = new URL(request.url);
  doUrl.searchParams.set('session_id', sessionId);
  doUrl.searchParams.set('user_id', userId);

  const doRequest = new Request(doUrl.toString(), request);

  return await doStub.fetch(doRequest);
};

/**
 * FalkorDB test endpoint handler
 */
const handleFalkorDBTest = async (request, env) => {
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

    const id = env.FALKORDB_POOL.idFromName('pool');
    const stub = env.FALKORDB_POOL.get(id);

    const doRequest = new Request('http://do/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          host: env.FALKORDB_HOST || 'localhost',
          port: '3001',
          username: env.FALKORDB_USER || 'default',
          password: env.FALKORDB_PASSWORD,
          apiKey: env.FALKORDB_REST_API_KEY,
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
};

// ============================================================================
// Entity Route Handlers (with auth and rate limiting)
// ============================================================================

const handleExtractEntities = async (request, env) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const noteId = pathParts[3];

  let response = await extractEntitiesForNote(request, env, {
    userId: request.userId,
    noteId
  });
  return response;
};

const handleGetEntities = async (request, env) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const noteId = pathParts[3];

  let response = await getEntitiesForNote(request, env, {
    userId: request.userId,
    noteId
  });
  return response;
};

const handleExtractBatch = async (request, env) => {
  let response = await extractEntitiesBatch(request, env, {
    userId: request.userId
  });
  return response;
};

const handleEntityCacheLookup = async (request, env) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const entityKey = pathParts[pathParts.length - 1];

  let response = await lookupEntityCache(request, env, {
    userId: request.userId,
    entityKey
  });
  return response;
};

// Graph handlers
const handleGraph = (request, env) => handleGetGraph(request, env, { userId: request.userId });
const handleEntity = (request, env) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const entityId = pathParts[pathParts.length - 1];
  return handleGetEntity(request, env, { userId: request.userId }, entityId);
};
const handleGraphSearch = (request, env) => handleSearchEntities(request, env, { userId: request.userId });
const handleGraphStats = (request, env) => handleGetGraphStats(request, env, { userId: request.userId });
const handleGraphMerge = (request, env) => handleMergeEntities(request, env, { userId: request.userId });

// Seed data handler with version header
const handleSeedData = async (request, env) => {
  console.log('[SeedData] V2 Route Handler Triggered');
  const response = await handleSeedDataV2(request, env);
  response.headers.set('X-Code-Version', 'v3');
  return response;
};

// ============================================================================
// Router Setup
// ============================================================================

/**
 * @typedef {import('itty-router').RouterType} RouterType
 */

/**
 * Create and configure the router
 * @returns {RouterType} Configured itty-router instance
 */
export function createRouter() {
  const router = Router();

  // --------------------------------
  // CORS Preflight
  // --------------------------------
  router.options('*', () => corsPreflightResponse());

  // --------------------------------
  // Health & Root
  // --------------------------------
  router.get('/', withCors(handleHealthRoot));
  router.get('/api/health', withCors(handleHealthApi));
  router.get('/api/health/falkordb', withCors((req, env) => handleFalkorDBHealth(req, env)));

  // --------------------------------
  // Authentication (Public)
  // --------------------------------
  router.post('/api/auth/register', withCors((req, env) => handleRegister(req, env)));
  router.post('/api/auth/login', withCors((req, env) => handleLogin(req, env)));
  router.get('/api/auth/me', withCors((req, env) => handleGetMe(req, env)));

  // --------------------------------
  // Client Logs (Public)
  // --------------------------------
  router.post('/api/logs', withCors((req, env) => handleClientLogs(req, env)));

  // --------------------------------
  // WebSocket Upgrades (Auth handled internally)
  // --------------------------------
  router.get('/ws/notes/:session_id', handleNotesWebSocket);
  router.get('/ws/query/:session_id', handleQueryWebSocket);

  // --------------------------------
  // Notes (Auth required)
  // --------------------------------
  router.post('/api/notes/start-recording', withCors((req, env) => handleStartRecording(req, env)));
  router.get('/api/notes', withCors((req, env) => handleListNotes(req, env)));

  // Notes with ID - need to handle specific patterns to avoid conflicts
  router.get('/api/notes/:note_id/entities',
    withEnv,
    withAuth,
    withRateLimit('entities:view'),
    withCors(handleGetEntities)
  );
  router.post('/api/notes/:note_id/extract-entities',
    withEnv,
    withAuth,
    withRateLimit('entities:extract'),
    withCors(handleExtractEntities)
  );
  router.get('/api/notes/:note_id', withCors((req, env) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const noteId = pathParts[pathParts.length - 1];
    return handleGetNote(req, env, noteId);
  }));
  router.delete('/api/notes/:note_id', withCors((req, env) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const noteId = pathParts[pathParts.length - 1];
    return handleDeleteNote(req, env, noteId);
  }));

  // --------------------------------
  // Voice Query (handleQueryRequest handles its own routing)
  // --------------------------------
  router.all('/api/query/*', withCors((req, env) => handleQueryRequest(req, env)));

  // --------------------------------
  // Seed Data
  // --------------------------------
  router.post('/api/seed-data', withCors(handleSeedData));

  // --------------------------------
  // Entity Extraction
  // --------------------------------
  router.post('/api/entities/extract-batch',
    withEnv,
    withAuth,
    withRateLimit('entities:extract-batch'),
    withCors(handleExtractBatch)
  );
  router.get('/api/entities/cache/:entity_key',
    withEnv,
    withAuth,
    withRateLimit('entities:cache-lookup'),
    withCors(handleEntityCacheLookup)
  );

  // --------------------------------
  // Graph API (Auth + Rate Limited)
  // --------------------------------
  router.get('/api/graph/search',
    withEnv,
    withAuth,
    withRateLimit('graph:search'),
    withCors(handleGraphSearch)
  );
  router.get('/api/graph/stats',
    withEnv,
    withAuth,
    withRateLimit('graph:stats'),
    withCors(handleGraphStats)
  );
  router.post('/api/graph/merge-entities',
    withEnv,
    withAuth,
    withRateLimit('graph:merge'),
    withCors(handleGraphMerge)
  );
  router.get('/api/graph/entity/:entity_id',
    withEnv,
    withAuth,
    withRateLimit('graph:read'),
    withCors(handleEntity)
  );
  router.post('/api/graph/init', withCors((req, env) => handleGraphInit(req, env)));
  router.get('/api/graph',
    withEnv,
    withAuth,
    withRateLimit('graph:read'),
    withCors(handleGraph)
  );

  // --------------------------------
  // Test Endpoints
  // --------------------------------
  router.post('/api/test/trigger-graph-sync', withCors((req, env) => handleTriggerGraphSync(req, env)));
  router.post('/api/test/graph-direct', withCors((req, env) => handleTestGraphDirect(req, env)));
  router.post('/api/test/simple-cypher', withCors((req, env) => handleTestSimpleCypher(req, env)));
  router.post('/api/test/redis-direct', withCors((req, env) => handleTestRedisDirect(req, env)));
  router.get('/api/test/check-pool-warmup', withCors((req, env) => handleCheckPoolWarmup(req, env)));
  router.post('/api/test/init-pool', withCors((req, env) => handleInitPool(req, env)));
  router.get('/api/test/benchmark-falkordb', withCors((req, env) => handleBenchmarkFalkorDB(req, env)));
  router.post('/api/test/falkordb', withCors(handleFalkorDBTest));

  // --------------------------------
  // Admin Endpoints
  // --------------------------------
  router.post('/api/admin/backfill-embeddings', withCors((req, env) => handleBackfillEmbeddings(req, env)));

  // --------------------------------
  // 404 Handler
  // --------------------------------
  router.all('*', (request) => {
    const url = new URL(request.url);
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
      path: url.pathname
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  });

  return router;
}
