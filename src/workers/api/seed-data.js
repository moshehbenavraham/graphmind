/**
 * Seed Data Endpoint
 *
 * Adds test knowledge graph data to a user's namespace for testing/demo purposes.
 * This endpoint is authenticated and can only be called once per user.
 */

import { successResponse } from '../../utils/responses.js';
import { errorResponse, unauthorizedError, internalServerError } from '../../utils/errors.js';
import { verifyToken } from '../../lib/auth/crypto.js';

/**
 * Best-effort trace identifier for correlating client/server logs
 * @param {Request} request
 * @returns {string}
 */
function getTraceId(request) {
  return request.headers.get('cf-ray') || request.headers.get('x-request-id') || crypto.randomUUID();
}

/**
 * Normalize FalkorDB connection config and provide sensible defaults.
 * Falls back to 443 when using https hosts and 6380 for local dev.
 * @param {Object} env
 * @returns {{host: string, port: number, username: string, password: string}}
 */
function buildFalkorConfig(env) {
  const host = env.FALKORDB_HOST;
  const username = env.FALKORDB_USER || 'default';
  const password = env.FALKORDB_PASSWORD || '';
  const rawPort = env.FALKORDB_PORT;
  const portNumber = Number(rawPort);

  const defaultPort = host && host.startsWith('http') ? 443 : 6380;
  const port = Number.isFinite(portNumber) ? portNumber : defaultPort;

  if (!host) {
    throw new Error('FALKORDB_HOST is not configured');
  }

  return { host, port, username, password };
}

/**
 * Extract a usable user ID from JWT claims
 * Supports both current (sub) and legacy (user_id/namespace) formats.
 * @param {Object} claims
 * @returns {string|null}
 */
function getUserIdFromClaims(claims) {
  if (!claims) return null;

  if (claims.sub) {
    return claims.sub;
  }

  if (claims.user_id) {
    return claims.user_id;
  }

  if (claims.namespace) {
    const match = claims.namespace.match(/^user_([a-f0-9-]+)(?:_graph)?$/i);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if user already has data in their graph
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} userId - User's ID (UUID)
 * @param {string} traceId - Trace identifier for logging
 * @returns {Promise<boolean>}
 */
async function hasExistingData(env, userId, traceId) {
  try {
    const config = buildFalkorConfig(env);
    const poolId = env.FALKORDB_POOL.idFromName('pool');
    const poolStub = env.FALKORDB_POOL.get(poolId);

    const response = await poolStub.fetch('http://internal/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config,
        userId,
        cypher: 'MATCH (n) RETURN count(n) as count',
        params: {}
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SeedData] Failed to check existing data:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        traceId,
        config: { host: config.host, port: config.port }
      });
      return false;
    }

    const result = await response.json();
    // Execute endpoint returns {data: [], metadata: {}, statistics: {}}
    const count = result.data?.[0]?.count || result.data?.[0]?.['count(n)'] || 0;
    console.log('[SeedData] Existing data check result:', {
      count,
      resultData: result.data?.length,
      traceId
    });
    return count > 0;

  } catch (error) {
    console.error('[SeedData] Error checking existing data:', {
      error: error?.message,
      traceId
    });
    return false;
  }
}

/**
 * Add seed data to user's graph
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} userId - User's ID (UUID)
 * @returns {Promise<Object>}
 */
async function addSeedData(env, userId) {
  const config = buildFalkorConfig(env);
  const poolId = env.FALKORDB_POOL.idFromName('pool');
  const poolStub = env.FALKORDB_POOL.get(poolId);

  // Step 1: Create people, projects, and technologies
  const query1 = `
    CREATE
      (p1:Person {name: "Alice Johnson", role: "CEO", email: "alice@example.com"}),
      (p2:Person {name: "Bob Smith", role: "CTO", email: "bob@example.com"}),
      (p3:Person {name: "Carol White", role: "Designer", email: "carol@example.com"}),
      (proj1:Project {name: "GraphMind", status: "active", priority: "high"}),
      (proj2:Project {name: "Mobile App", status: "planning", priority: "medium"}),
      (tech1:Technology {name: "Cloudflare Workers", category: "infrastructure"}),
      (tech2:Technology {name: "FalkorDB", category: "database"}),
      (tech3:Technology {name: "React", category: "frontend"}),
      (p1)-[:LEADS]->(proj1),
      (p2)-[:WORKS_ON]->(proj1),
      (p3)-[:WORKS_ON]->(proj1),
      (proj1)-[:USES]->(tech1),
      (proj1)-[:USES]->(tech2),
      (proj1)-[:USES]->(tech3),
      (p1)-[:MANAGES]->(p2),
      (p1)-[:MANAGES]->(p3)
    RETURN count(*) as count
  `;

  // Step 2: Add meetings and topics
  const query2 = `
    MATCH
      (alice:Person {name: "Alice Johnson"}),
      (bob:Person {name: "Bob Smith"}),
      (carol:Person {name: "Carol White"}),
      (gm:Project {name: "GraphMind"})
    CREATE
      (m1:Meeting {title: "GraphMind Kickoff", date: "2025-01-10", duration: 60}),
      (m2:Meeting {title: "Design Review", date: "2025-01-15", duration: 45}),
      (topic1:Topic {name: "Voice AI", category: "feature"}),
      (topic2:Topic {name: "Knowledge Graph", category: "architecture"}),
      (topic3:Topic {name: "User Interface", category: "design"}),
      (alice)-[:ATTENDED]->(m1),
      (bob)-[:ATTENDED]->(m1),
      (carol)-[:ATTENDED]->(m1),
      (alice)-[:ATTENDED]->(m2),
      (carol)-[:ATTENDED]->(m2),
      (m1)-[:DISCUSSED]->(topic1),
      (m1)-[:DISCUSSED]->(topic2),
      (m2)-[:DISCUSSED]->(topic3),
      (gm)-[:RELATES_TO]->(topic1),
      (gm)-[:RELATES_TO]->(topic2),
      (gm)-[:RELATES_TO]->(topic3)
    RETURN count(*) as count
  `;

  // Step 3: Add tasks and decisions
  const query3 = `
    MATCH
      (alice:Person {name: "Alice Johnson"}),
      (bob:Person {name: "Bob Smith"}),
      (carol:Person {name: "Carol White"}),
      (gm:Project {name: "GraphMind"})
    CREATE
      (task1:Task {title: "Implement voice transcription", status: "completed", priority: "high"}),
      (task2:Task {title: "Design dashboard UI", status: "in_progress", priority: "high"}),
      (task3:Task {title: "Setup database", status: "completed", priority: "high"}),
      (dec1:Decision {title: "Use FalkorDB for knowledge graph", date: "2025-01-05", rationale: "Better performance for graph queries"}),
      (dec2:Decision {title: "Deploy on Cloudflare Workers", date: "2025-01-08", rationale: "Global edge network, low latency"}),
      (bob)-[:ASSIGNED_TO]->(task1),
      (carol)-[:ASSIGNED_TO]->(task2),
      (bob)-[:ASSIGNED_TO]->(task3),
      (gm)-[:HAS_TASK]->(task1),
      (gm)-[:HAS_TASK]->(task2),
      (gm)-[:HAS_TASK]->(task3),
      (alice)-[:MADE]->(dec1),
      (alice)-[:MADE]->(dec2),
      (gm)-[:HAS_DECISION]->(dec1),
      (gm)-[:HAS_DECISION]->(dec2)
    RETURN count(*) as count
  `;

  // Execute all operations in a single batch request
  const response = await poolStub.fetch('http://internal/execute-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config,
      userId,
      operations: [
        { cypher: query1, params: {} },
        { cypher: query2, params: {} },
        { cypher: query3, params: {} }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to add seed data: ${response.statusText}`);
  }

  // Get final count
  const countResponse = await poolStub.fetch('http://internal/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config,
      userId,
      cypher: 'MATCH (n) RETURN labels(n) as type, count(n) as count ORDER BY count DESC',
      params: {}
    })
  });

  const countResult = await countResponse.json();

  // Step 4: Populate Entity Cache (D1)
  // This is critical for fuzzy matching (e.g. "GraftMind" -> "GraphMind")
  const entitiesToCache = [
    { name: "Alice Johnson", type: "Person" },
    { name: "Bob Smith", type: "Person" },
    { name: "Carol White", type: "Person" },
    { name: "GraphMind", type: "Project" },
    { name: "Mobile App", type: "Project" },
    { name: "Cloudflare Workers", type: "Technology" },
    { name: "FalkorDB", type: "Technology" },
    { name: "React", type: "Technology" },
    { name: "Voice AI", type: "Topic" },
    { name: "Knowledge Graph", type: "Topic" },
    { name: "User Interface", type: "Topic" }
  ];

  console.log('[SeedData] Populating entity cache...');

  // We need to import createEntity dynamically or assume it's available. 
  // Since this is a module, we should have imported it at the top.
  // But for now, let's just run raw SQL inserts to avoid import issues if the lib isn't fully compatible with this worker context yet.
  // Actually, let's try to use the D1 binding directly for simplicity and reliability in this seed script.

  const stmt = env.DB.prepare(`
    INSERT OR REPLACE INTO entity_cache (
      entity_key, user_id, canonical_name, entity_type, 
      aliases, properties, confidence, mention_count, 
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  const batch = [];
  for (const entity of entitiesToCache) {
    const key = `${entity.type}:${entity.name} `.toLowerCase().replace(/[^a-z0-9]/g, '');
    batch.push(stmt.bind(
      key,
      userId,
      entity.name,
      entity.type,
      '[]', // aliases
      '{}', // properties
      1.0,  // confidence
      1     // mention_count
    ));
  }

  await env.DB.batch(batch);

  return {
    success: true,
    message: 'Test data successfully added to your knowledge graph and entity cache',
    data: countResult.data || []
  };
}

/**
 * Handle POST /api/seed-data
 * Add test knowledge graph data to authenticated user's namespace
 */
export async function handleSeedData(request, env) {
  try {
    const traceId = getTraceId(request);
    // Validate FalkorDB configuration early for clearer errors
    buildFalkorConfig(env);

    // Validate JWT token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    let decoded;
    try {
      decoded = verifyToken(token, env.JWT_SECRET);
    } catch (error) {
      console.error('[SeedData] JWT verification failed:', {
        error: error.message,
        traceId
      });
      return unauthorizedError('Invalid or expired token');
    }

    const userId = getUserIdFromClaims(decoded);
    if (!userId) {
      console.error('[SeedData] Missing user identifier in token claims', { decoded, traceId });
      return unauthorizedError('Invalid authentication token');
    }

    // Check if user already has data
    const hasData = await hasExistingData(env, userId, traceId);
    if (hasData) {
      return successResponse({
        success: false,
        message: 'Your knowledge graph already contains data. Seed data is only added to empty graphs.',
        existing_data: true,
        trace_id: traceId
      }, 200, { 'x-trace-id': traceId });
    }

    // Add seed data
    console.log('[SeedData] Adding seed data for user:', { userId, traceId });
    const result = await addSeedData(env, userId);

    console.log('[SeedData] Seed data added successfully:', {
      userId,
      nodeTypes: result.data.length,
      traceId
    });

    return successResponse(
      { ...result, trace_id: traceId },
      200,
      { 'x-trace-id': traceId }
    );

  } catch (error) {
    const traceId = request ? getTraceId(request) : crypto.randomUUID();
    console.error('[SeedData] Error:', {
      error: error?.message,
      stack: error?.stack,
      traceId
    });

    return errorResponse(
      'Failed to add seed data: ' + (error?.message || 'Unknown error'),
      'SERVER_ERROR',
      500,
      { trace_id: traceId }
    );
  }
}
