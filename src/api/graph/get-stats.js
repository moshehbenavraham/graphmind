/**
 * GET /api/graph/stats
 *
 * Get knowledge graph statistics.
 *
 * @module api/graph/get-stats
 */

import { buildGetGraphStats } from '../../lib/graph/cypher-builder.js';
import { executeStatsWithCache } from '../../lib/graph/stats-cache.js';

/**
 * Parse FalkorDB string representation of arrays/objects
 * FalkorDB returns complex types as strings like: "[{type: Task, count: 3}, {type: Project, count: 2}]"
 * This format has unquoted keys which isn't valid JSON
 *
 * @param {string|Array} value - The value to parse
 * @returns {Array} Parsed array
 */
function parseFalkorDBArray(value) {
  // If already an array, return it
  if (Array.isArray(value)) {
    return value;
  }

  // If it's null/undefined, return empty array
  if (value == null) {
    return [];
  }

  // If it's not a string, wrap in array
  if (typeof value !== 'string') {
    return [value];
  }

  try {
    // Try to parse as JSON first
    return JSON.parse(value);
  } catch {
    // FalkorDB format: [{key: value, key2: value2}, ...]
    // Values can be numbers, unquoted strings, or NULL
    // Example: [{type: Task, count: 3}, {name: Alice Johnson, connections: 7}]
    let jsonString = value;

    // Step 1: Add quotes around property names
    // Matches: {key: or ,key: and converts to {"key": or ,"key":
    jsonString = jsonString.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // Step 2: Handle NULL values
    jsonString = jsonString.replace(/:\s*NULL\b/gi, ':null');

    // Step 3: Add quotes around unquoted string values
    // This regex matches: : followed by a word that's not a number, null, true, false
    // and not already quoted, followed by , or } or ]
    jsonString = jsonString.replace(/:\s*([a-zA-Z][a-zA-Z0-9\s]*?)([,}\]])/g, (match, val, end) => {
      const trimmed = val.trim();
      // Don't quote if it's a number, null, true, or false
      if (/^-?\d+(\.\d+)?$/.test(trimmed) || /^(null|true|false)$/i.test(trimmed)) {
        return `: ${trimmed}${end}`;
      }
      return `: "${trimmed}"${end}`;
    });

    try {
      return JSON.parse(jsonString);
    } catch (parseError) {
      // If still can't parse, return empty array
      console.warn('[GetGraphStats] Failed to parse FalkorDB array:', value, 'Error:', parseError.message);
      return [];
    }
  }
}

/**
 * Handle GET /api/graph/stats request
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} user - Authenticated user from JWT middleware
 * @returns {Promise<Response>} HTTP response
 */
export async function handleGetGraphStats(request, env, user) {
  try {
    // Use stats cache wrapper for automatic caching
    const result = await executeStatsWithCache(env.KV, user.userId, async () => {
      // Build Cypher query
      const { cypher } = buildGetGraphStats();

      // Execute query via FalkorDB connection pool
      const doId = env.FALKORDB_POOL.idFromName('pool');
      const doStub = env.FALKORDB_POOL.get(doId);

      const response = await doStub.fetch('http://do/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          cypher,
          params: { user_id: user.userId },
          config: {
            host: env.FALKORDB_HOST,
            port: parseInt(env.FALKORDB_PORT),
            username: env.FALKORDB_USER,
            password: env.FALKORDB_PASSWORD,
            apiKey: env.FALKORDB_REST_API_KEY,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`FalkorDB query failed: ${error}`);
      }

      const queryResult = await response.json();

      // Format stats - handle both array format [a, b, c, d] and object format {node_count, rel_count, entity_breakdown, most_connected}
      const firstRow = queryResult.data?.[0];
      let nodeCount, relCount, entityBreakdownRaw, mostConnectedRaw;

      if (Array.isArray(firstRow)) {
        // Array format from older FalkorDB responses
        [nodeCount, relCount, entityBreakdownRaw, mostConnectedRaw] = firstRow;
      } else if (firstRow && typeof firstRow === 'object') {
        // Object format from newer response parser
        nodeCount = firstRow.node_count || firstRow.nodeCount || 0;
        relCount = firstRow.rel_count || firstRow.relCount || 0;
        entityBreakdownRaw = firstRow.entity_breakdown || firstRow.entityBreakdown || [];
        mostConnectedRaw = firstRow.most_connected || firstRow.mostConnected || [];
      } else {
        nodeCount = 0;
        relCount = 0;
        entityBreakdownRaw = [];
        mostConnectedRaw = [];
      }

      // Parse FalkorDB string representations to arrays
      const entityBreakdown = parseFalkorDBArray(entityBreakdownRaw);
      const mostConnected = parseFalkorDBArray(mostConnectedRaw);

      // Handle entity_breakdown - convert array of {type, count} to object
      const breakdown = Array.isArray(entityBreakdown)
        ? entityBreakdown.reduce((acc, item) => {
            if (item && item.type !== undefined && item.count !== undefined) {
              acc[item.type] = item.count;
            }
            return acc;
          }, {})
        : (typeof entityBreakdown === 'object' ? entityBreakdown : {});

      return {
        node_count: nodeCount || 0,
        relationship_count: relCount || 0,
        entity_breakdown: breakdown,
        most_connected: mostConnected || [],
        last_sync: new Date().toISOString(),
      };
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[GetGraphStats] Error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'STATS_QUERY_FAILED',
        message: error.message,
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
