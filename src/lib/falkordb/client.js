/**
 * FalkorDB Client Wrapper
 *
 * Provides connection utilities for FalkorDB using REST API wrapper.
 * Uses HTTP fetch to communicate with scripts/falkordb-rest-api.js
 * which handles the Redis protocol connection to FalkorDB.
 *
 * @module lib/falkordb/client
 */

import { createRestClient } from './rest-client.js';
import { normalizeError } from './errors.js';

/**
 * Create and configure a FalkorDB client connection using REST API
 *
 * @param {Object} config - Connection configuration
 * @param {string} config.host - FalkorDB host
 * @param {number} config.port - FalkorDB port
 * @param {string} config.username - FalkorDB username
 * @param {string} config.password - FalkorDB password
 * @param {number} [config.connectTimeout=5000] - Connection timeout in ms (unused for REST)
 * @param {number} [config.commandTimeout=10000] - Command timeout in ms (unused for REST)
 * @returns {Promise<Object>} Connected REST client
 * @throws {Error} If connection fails or credentials are invalid
 */
export async function connect(config) {
  const { host, port, username, password } = config;

  // Validate required configuration
  if (!host || !port || !username || password === undefined) {
    throw new Error(
      'Missing required FalkorDB credentials. Required: FALKORDB_HOST, FALKORDB_PORT, FALKORDB_USER, FALKORDB_PASSWORD'
    );
  }

  try {
    console.log('[FalkorDB] Connecting with config:', { host, port, username });

    // Create REST API client
    const client = createRestClient(config);

    console.log('[FalkorDB] Client created, testing connection...');

    // Test connection with PING
    const pong = await client.send('PING');

    console.log('[FalkorDB] PING result:', pong);

    if (pong !== 'PONG') {
      throw new Error('Connection test failed: PING did not return PONG');
    }

    console.log('[FalkorDB] Connected successfully via REST API', {
      host,
      port,
      username,
    });

    return client;
  } catch (error) {
    console.error('[FalkorDB] Connection error (raw):', {
      message: error.message,
      stack: error.stack,
      error: error,
    });

    // Normalize and enrich error
    const normalizedError = normalizeError(error, { host, port });
    console.error('[FalkorDB] Connection failed (normalized):', {
      host,
      port,
      error: normalizedError.message,
      code: normalizedError.code,
      httpStatus: normalizedError.httpStatus,
    });
    throw normalizedError;
  }
}

/**
 * Disconnect from FalkorDB gracefully
 *
 * @param {Object} client - Redis client instance (from redis-on-workers)
 * @returns {Promise<void>}
 */
export async function disconnect(client) {
  if (!client) {
    return;
  }

  try {
    await client.close();
    console.log('[FalkorDB] Disconnected gracefully');
  } catch (error) {
    console.error('[FalkorDB] Error during disconnect:', error.message);
  }
}

/**
 * Execute a Cypher query on FalkorDB using GRAPH.QUERY Redis command
 *
 * FalkorDB uses the GRAPH.QUERY command with Cypher syntax.
 *
 * @param {Object} client - Redis client instance (from redis-on-workers)
 * @param {string} graphName - Name of the graph database
 * @param {string} cypher - Cypher query string
 * @param {Object} [params={}] - Query parameters (will be interpolated)
 * @param {number} [timeout=10000] - Query timeout in ms
 * @returns {Promise<Object>} Query result
 * @throws {Error} If query fails or times out
 *
 * @example
 * const result = await executeCypher(client, 'user_123_graph',
 *   'CREATE (n:Person {name: "Alice"}) RETURN n'
 * );
 */
export async function executeCypher(client, graphName, cypher, params = {}, timeout = 10000) {
  if (!client) {
    throw new Error('FalkorDB client is not connected');
  }

  if (!graphName) {
    throw new Error('Graph name is required');
  }

  if (!cypher || typeof cypher !== 'string') {
    throw new Error('Cypher query string is required');
  }

  try {
    const startTime = Date.now();

    // Pass query and params to client - REST API wrapper handles interpolation
    // For direct Redis clients, we need to interpolate here
    // The REST client will handle params correctly, Redis clients get interpolated query
    const result = await client.send('GRAPH.QUERY', graphName, cypher, params);

    const latency = Date.now() - startTime;

    console.log('[FalkorDB] Query executed', {
      graphName,
      latency,
      query: cypher.substring(0, 100), // Log first 100 chars
    });

    // Parse FalkorDB result format
    const parsedResult = parseFalkorDBResult(result);

    return {
      data: parsedResult.data || [],
      metadata: parsedResult.metadata || {},
      statistics: parsedResult.statistics || {},
    };
  } catch (error) {
    const normalizedError = normalizeError(error, { graphName, query: cypher });
    console.error('[FalkorDB] Query failed:', {
      graphName,
      query: cypher.substring(0, 100),
      error: normalizedError.message,
      code: normalizedError.code,
    });
    throw normalizedError;
  }
}

/**
 * Parse FalkorDB query result from Redis protocol format
 *
 * FalkorDB returns results in a specific array format via Redis protocol.
 * This function converts it to a more usable object format.
 *
 * @param {Array} result - Raw result from GRAPH.QUERY command
 * @returns {Object} Parsed result with data, metadata, and statistics
 */
function parseFalkorDBResult(result) {
  if (!result || !Array.isArray(result)) {
    return { data: [], metadata: {}, statistics: {} };
  }

  const parsed = {
    data: [],
    metadata: {},
    statistics: {},
  };

  // FalkorDB returns results as an array:
  // [0] = column headers (if any)
  // [1] = result rows (if any)
  // [2] = statistics (always present)

  // Extract column headers
  if (result.length > 0 && Array.isArray(result[0])) {
    parsed.metadata.columns = result[0];
  }

  // Extract result rows
  if (result.length > 1 && Array.isArray(result[1])) {
    const columns = parsed.metadata.columns || [];
    parsed.data = result[1].map(row => {
      if (!Array.isArray(row)) return row;

      // Convert row array to object using column names
      const rowObj = {};
      row.forEach((value, index) => {
        const columnName = columns[index] || `col_${index}`;
        rowObj[columnName] = value;
      });
      return rowObj;
    });
  }

  // Extract statistics (last element)
  if (result.length > 0) {
    const statsArray = result[result.length - 1];
    if (Array.isArray(statsArray)) {
      statsArray.forEach(stat => {
        if (typeof stat === 'string') {
          // Parse statistics like "Nodes created: 1", "Query internal execution time: 0.123"
          const match = stat.match(/^(.+?):\s*(.+)$/);
          if (match) {
            const [, key, value] = match;
            const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
            parsed.statistics[normalizedKey] = isNaN(value) ? value : parseFloat(value);
          }
        }
      });
    }
  }

  return parsed;
}


/**
 * List all graphs in FalkorDB using GRAPH.LIST Redis command
 *
 * @param {Object} client - Redis client instance (from redis-on-workers)
 * @returns {Promise<Array<string>>} Array of graph names
 */
export async function listGraphs(client) {
  if (!client) {
    throw new Error('FalkorDB client is not connected');
  }

  try {
    const result = await client.send('GRAPH.LIST');
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('[FalkorDB] Failed to list graphs:', error.message);
    return [];
  }
}

/**
 * Check if a graph exists using GRAPH.LIST
 *
 * @param {Object} client - Redis client instance (from redis-on-workers)
 * @param {string} graphName - Name of graph to check
 * @returns {Promise<boolean>} True if graph exists
 */
export async function graphExists(client, graphName) {
  try {
    const graphs = await listGraphs(client);
    return graphs.includes(graphName);
  } catch (error) {
    return false;
  }
}

/**
 * Validate FalkorDB connection health
 *
 * Tests connection by executing a PING command
 * and optionally a test query.
 *
 * @param {Object} client - Redis client instance (from redis-on-workers)
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.testQuery=false] - Execute test query
 * @param {string} [options.graphName] - Graph name for test query
 * @returns {Promise<Object>} Validation result
 *
 * @example
 * const health = await validateConnection(client, {
 *   testQuery: true,
 *   graphName: 'user_123_graph'
 * });
 * // Returns: { valid: true, latency: 45, error: null }
 */
export async function validateConnection(client, options = {}) {
  const { testQuery = false, graphName } = options;

  const result = {
    valid: false,
    latency: null,
    error: null,
  };

  // Check if client exists
  if (!client) {
    result.error = 'FalkorDB client is not connected';
    return result;
  }

  try {
    const startTime = Date.now();

    // Test 1: PING
    await client.send('PING');

    // Test 2: List graphs
    await listGraphs(client);

    // Test 3: Optional graph query
    if (testQuery && graphName) {
      // Execute simple query that works on any graph
      await executeCypher(client, graphName, 'MATCH (n) RETURN count(n) as count LIMIT 1');
    }

    result.latency = Date.now() - startTime;
    result.valid = true;
  } catch (error) {
    result.error = error.message;
    result.valid = false;
  }

  return result;
}

/**
 * Detect if connection is stale or broken
 *
 * A connection is considered stale if:
 * - Client is not connected
 * - PING fails
 * - Connection has been idle for too long
 *
 * @param {Object} client - Redis client instance (from redis-on-workers)
 * @returns {Promise<boolean>} True if connection is stale
 */
export async function isConnectionStale(client) {
  if (!client) {
    return true;
  }

  try {
    // Quick test - PING
    await client.send('PING');
    return false;
  } catch (error) {
    // Any error means connection is stale
    return true;
  }
}
