/**
 * FalkorDB REST API Client
 *
 * Alternative to Redis protocol for Cloudflare Workers compatibility.
 * FalkorDB Cloud provides a REST API that works reliably with HTTP fetch.
 *
 * @module lib/falkordb/rest-client
 */

/**
 * Create a FalkorDB REST API client
 *
 * @param {Object} config - Connection configuration
 * @param {string} config.host - FalkorDB host
 * @param {number} config.port - FalkorDB port
 * @param {string} config.username - FalkorDB username
 * @param {string} config.password - FalkorDB password
 * @returns {Object} REST API client with query methods
 */
export function createRestClient(config) {
  const { host, port, username, password } = config;

  if (!host) {
    throw new Error('FalkorDB host is not configured');
  }

  const hasProtocol = host.startsWith('http://') || host.startsWith('https://');
  const sanitizedHost = hasProtocol ? host.replace(/\/+$/, '') : host;
  const portNumber = Number(port);

  // Default to HTTPS for Cloudflare/hosted domains or explicit port 443
  const protocol = hasProtocol
    ? (sanitizedHost.startsWith('https://') ? 'https' : 'http')
    : (
        sanitizedHost.includes('.cloud') ||
        sanitizedHost.includes('workers.dev') ||
        sanitizedHost.includes('falkordb-tunnel') ||
        portNumber === 443
      )
        ? 'https'
        : 'http';

  const needsPort = portNumber && ![80, 443].includes(portNumber);
  const baseUrl = hasProtocol
    ? sanitizedHost
    : `${protocol}://${sanitizedHost}${needsPort ? `:${portNumber}` : ''}`;

  // Create Basic Auth header
  const authHeader = 'Basic ' + btoa(`${username}:${password}`);

  console.log('[FalkorDB REST] Client created', { host, port, username, protocol });

  return {
    /**
     * Execute a Cypher query via REST API
     *
     * Matches the API format from scripts/falkordb-rest-api.js:
     * POST /api/graph/:graphName/query
     * Body: { query: "...", params: {} }
     * Response: { success: true, data: [], metadata: {}, statistics: {}, latency_ms: 123 }
     *
     * @param {string} graphName - Graph database name
     * @param {string} cypher - Cypher query string (with $param placeholders)
     * @param {Object} params - Query parameters (optional)
     * @returns {Promise<Array>} Query result in FalkorDB Redis format
     */
    async query(graphName, cypher, params = {}) {
      const url = `${baseUrl}/api/graph/${graphName}/query`;

      console.log('[FalkorDB REST] Executing query', {
        url,
        graphName,
        query: cypher.substring(0, 100),
        params: Object.keys(params),
      });

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: cypher,
            params: params
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`FalkorDB query failed (${response.status}): ${errorText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(`Query failed: ${result.error || 'Unknown error'}`);
        }

        console.log('[FalkorDB REST] Query successful', {
          graphName,
          latency_ms: result.latency_ms,
          rows: result.data?.length || 0,
        });

        // REST API already returns in the format we need:
        // { success: true, data: [], metadata: {}, statistics: {} }
        // Convert to Redis protocol format for compatibility with existing code
        return convertRestResultToRedisFormat(result);

      } catch (error) {
        console.error('[FalkorDB REST] Query failed', {
          graphName,
          error: error.message,
        });
        throw error;
      }
    },

    /**
     * Compatibility layer - mimics redis client.send() interface
     *
     * @param {string} command - Redis command
     * @param {...any} args - Command arguments
     * @returns {Promise<any>} Command result
     */
    async send(command, ...args) {
      if (command === 'GRAPH.QUERY') {
        const [graphName, cypher, params] = args;
        return this.query(graphName, cypher, params || {});
      }

      if (command === 'PING') {
        // Health check - matches scripts/falkordb-rest-api.js endpoint
        try {
          const response = await fetch(`${baseUrl}/health`, {
            headers: { 'Content-Type': 'application/json' },
          });

          if (!response.ok) {
            throw new Error(`Health check failed: ${response.statusText}`);
          }

          const data = await response.json();
          if (data.status === 'healthy' && data.redis === 'connected') {
            return 'PONG';
          }

          throw new Error(`FalkorDB not healthy: ${JSON.stringify(data)}`);
        } catch (error) {
          throw new Error(`PING failed: ${error.message}`);
        }
      }

      if (command === 'GRAPH.LIST') {
        // List all graphs - matches GET /api/graphs
        try {
          const response = await fetch(`${baseUrl}/api/graphs`, {
            headers: { 'Content-Type': 'application/json' },
          });

          if (!response.ok) {
            throw new Error(`Failed to list graphs: ${response.statusText}`);
          }

          const data = await response.json();
          return data.graphs || [];
        } catch (error) {
          console.error('[FalkorDB REST] GRAPH.LIST failed:', error);
          return [];
        }
      }

      if (command === 'GRAPH.DELETE') {
        // Delete graph - matches DELETE /api/graph/:graphName
        const [graphName] = args;
        try {
          const response = await fetch(`${baseUrl}/api/graph/${graphName}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!response.ok) {
            throw new Error(`Failed to delete graph: ${response.statusText}`);
          }

          const data = await response.json();
          return data.success ? 'OK' : data.error;
        } catch (error) {
          throw new Error(`GRAPH.DELETE failed: ${error.message}`);
        }
      }

      throw new Error(`Unsupported command: ${command}`);
    },

    /**
     * Close connection (no-op for REST API, included for compatibility)
     */
    async close() {
      console.log('[FalkorDB REST] Close called (no-op for REST)');
      return Promise.resolve();
    },
  };
}

/**
 * Convert FalkorDB REST API result format to Redis protocol format
 *
 * REST API wrapper returns (from scripts/falkordb-rest-api.js):
 * {
 *   success: true,
 *   data: [{col1: val1, col2: val2}, ...],  // Already parsed rows
 *   metadata: {columns: ['col1', 'col2']},
 *   statistics: {nodes_created: 1, ...},
 *   latency_ms: 123
 * }
 *
 * Redis protocol format that our code expects:
 * [
 *   ['col1', 'col2'],              // headers
 *   [[val1, val2], ...],           // data rows as arrays
 *   ['Nodes created: 1', ...]      // statistics as strings
 * ]
 *
 * @param {Object} restResult - Result from REST API wrapper
 * @returns {Array} Result in Redis protocol format
 */
function convertRestResultToRedisFormat(restResult) {
  // Extract data and statistics from REST response
  const data = restResult.data || [];
  const metadata = restResult.metadata || {};
  const statistics = restResult.statistics || {};

  // Get headers (column names)
  const headers = metadata.columns || (data.length > 0 ? Object.keys(data[0]) : []);

  // Convert data rows from objects to arrays
  const dataRows = data.map(row => {
    return headers.map(header => row[header]);
  });

  // Build statistics array (Redis format: ["Key: value", "Key: value"])
  const statsArray = Object.entries(statistics).map(([key, value]) => {
    // Convert snake_case to "Title Case: value"
    const titleKey = key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return `${titleKey}: ${value}`;
  });

  // Return in Redis protocol format: [headers, dataRows, statistics]
  return [headers, dataRows, statsArray];
}

/**
 * Connect to FalkorDB via REST API
 *
 * @param {Object} config - Connection configuration
 * @returns {Promise<Object>} Connected REST client
 */
export async function connectRest(config) {
  const client = createRestClient(config);

  // Test connection with PING
  try {
    const pong = await client.send('PING');
    if (pong !== 'PONG') {
      throw new Error('PING test failed');
    }

    console.log('[FalkorDB REST] Connection verified');
    return client;

  } catch (error) {
    throw new Error(`Failed to connect to FalkorDB REST API: ${error.message}`);
  }
}
