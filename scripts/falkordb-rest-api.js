/**
 * FalkorDB REST API Wrapper
 *
 * Lightweight Express server that exposes FalkorDB via HTTP/JSON REST API
 * Forwards requests to FalkorDB using Redis protocol
 */

require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const { createClient } = require('redis');

const app = express();
app.use(express.json());

// API Key Authentication - REQUIRED
const API_KEY = process.env.FALKORDB_REST_API_KEY;

if (!API_KEY) {
  console.error('FATAL: FALKORDB_REST_API_KEY not set in environment');
  console.error('Generate with: openssl rand -hex 32');
  console.error('Then add to .env: FALKORDB_REST_API_KEY=<generated_key>');
  process.exit(1);
}

// CORS + Authentication Middleware
app.use((req, res, next) => {
  // 1. CORS origin restriction
  const allowedOrigins = [
    'http://localhost:5173',           // Vite dev server
    'http://localhost:8787',           // Wrangler dev server
    'https://graphmind.pages.dev',     // Cloudflare Pages production
    /^https:\/\/.*\.graphmind\.pages\.dev$/  // Preview deployments
  ];

  const origin = req.headers.origin;
  const isAllowed = allowedOrigins.some(pattern => {
    return typeof pattern === 'string' ? pattern === origin : pattern.test(origin);
  });

  if (isAllowed && origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests (no auth required)
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  // 2. Authentication check (all non-OPTIONS requests)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  if (token !== API_KEY) {
    return res.status(403).json({
      success: false,
      error: 'Invalid authentication token'
    });
  }

  next();
});

// Redis/FalkorDB connection
// Note: FALKORDB_REDIS_PORT is for direct Redis connection (default 6380)
// FALKORDB_PORT is used by Workers to connect to this REST API (typically 3001)
const redisClient = createClient({
  socket: {
    host: process.env.FALKORDB_HOST || 'localhost',
    port: parseInt(process.env.FALKORDB_REDIS_PORT || '6380')
  },
  username: process.env.FALKORDB_USER || 'default',
  password: process.env.FALKORDB_PASSWORD || ''
});

redisClient.on('error', err => console.error('[Redis] Error:', err));

// Connect on startup
(async () => {
  await redisClient.connect();
  console.log('[FalkorDB REST API] Connected to FalkorDB:', {
    host: process.env.FALKORDB_HOST || 'localhost',
    port: process.env.FALKORDB_PORT || '6380',
    username: process.env.FALKORDB_USER || 'default'
  });
})();

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  try {
    const pong = await redisClient.ping();
    res.json({
      status: 'healthy',
      redis: pong === 'PONG' ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * List all graphs
 * GET /api/graphs
 */
app.get('/api/graphs', async (req, res) => {
  try {
    const graphs = await redisClient.sendCommand(['GRAPH.LIST']);
    res.json({
      success: true,
      graphs: graphs || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Execute Cypher query on a graph
 * POST /api/graph/:graphName/query
 * Body: { "query": "MATCH (n) RETURN n LIMIT 10", "params": {} }
 */
app.post('/api/graph/:graphName/query', async (req, res) => {
  const { graphName } = req.params;
  const { query, params = {} } = req.body;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: query'
    });
  }

  try {
    // Build CYPHER prefix for parameters
    // FalkorDB requires params in "CYPHER key=value key2=value2" prefix format
    let cypherPrefix = '';
    if (params && Object.keys(params).length > 0) {
      const paramStrings = Object.entries(params).map(([key, value]) => {
        if (value === null || value === undefined) {
          return `${key}=NULL`;
        }
        if (typeof value === 'string') {
          // Escape double quotes in strings
          return `${key}="${value.replace(/"/g, '\\"')}"`;
        }
        if (Array.isArray(value)) {
          // Arrays (like embeddings) need special handling
          // FalkorDB expects list format: [1,2,3]
          return `${key}=${JSON.stringify(value)}`;
        }
        if (typeof value === 'boolean') {
          return `${key}=${value}`;
        }
        // Numbers
        return `${key}=${value}`;
      });
      cypherPrefix = 'CYPHER ' + paramStrings.join(' ') + ' ';
    }

    const fullQuery = cypherPrefix + query;
    const args = [
      'GRAPH.QUERY',
      graphName,
      fullQuery,
      '--compact'  // Compact result format (recommended)
    ];

    const startTime = Date.now();
    const result = await redisClient.sendCommand(args);
    const latency = Date.now() - startTime;

    // Parse FalkorDB result
    const parsed = parseFalkorDBResult(result);

    res.json({
      success: true,
      data: parsed.data || [],
      metadata: parsed.metadata || {},
      statistics: parsed.statistics || {},
      latency_ms: latency
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete a graph
 * DELETE /api/graph/:graphName
 */
app.delete('/api/graph/:graphName', async (req, res) => {
  const { graphName } = req.params;

  try {
    await redisClient.sendCommand(['GRAPH.DELETE', graphName]);
    res.json({
      success: true,
      message: `Graph '${graphName}' deleted`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Parse FalkorDB result from Redis protocol format
 */
/**
 * Extract a value from FalkorDB's raw format
 * FalkorDB returns values as [type, value] arrays:
 * - Type 1: null
 * - Type 2: string
 * - Type 3: integer
 * - Type 4: boolean
 * - Type 5: double
 * - Type 6: array
 * - Type 7: edge
 * - Type 8: node
 * - Type 9: path
 * - Type 10: map
 * - Type 11: point
 */
function extractValue(val) {
  if (val === null || val === undefined) return null;
  // If it's already a plain value (not array), return as-is
  if (!Array.isArray(val)) return val;
  // If it's [type, value] format, extract the value
  if (val.length >= 2) {
    const [type, value] = val;
    // Recursively handle nested arrays/maps
    if (Array.isArray(value)) {
      return value.map(extractValue);
    }
    return value;
  }
  // Fallback
  return val[0] ?? null;
}

/**
 * Extract column name from FalkorDB header format
 * Headers come as [[type, name], ...] where type indicates column type
 */
function extractColumnName(col, index) {
  if (Array.isArray(col) && col.length >= 2) {
    return col[1]; // Return the name part
  }
  if (typeof col === 'string') {
    return col;
  }
  return `col_${index}`;
}

function parseFalkorDBResult(result) {
  if (!result || !Array.isArray(result)) {
    return { data: [], metadata: {}, statistics: {} };
  }

  const parsed = {
    data: [],
    metadata: {},
    statistics: {},
  };

  // Extract column headers - store both raw and extracted names
  if (result.length > 0 && Array.isArray(result[0])) {
    const rawColumns = result[0];
    // Extract clean column names for use as object keys
    parsed.metadata.columns = rawColumns.map((col, idx) => extractColumnName(col, idx));
    parsed.metadata.rawColumns = rawColumns; // Keep raw for debugging
  }

  // Extract result rows
  if (result.length > 1 && Array.isArray(result[1])) {
    const columns = parsed.metadata.columns || [];
    parsed.data = result[1].map(row => {
      if (!Array.isArray(row)) return row;

      const rowObj = {};
      row.forEach((value, index) => {
        const columnName = columns[index] || `col_${index}`;
        // Extract the actual value from [type, value] format
        rowObj[columnName] = extractValue(value);
      });
      return rowObj;
    });
  }

  // Extract statistics
  if (result.length > 0) {
    const statsArray = result[result.length - 1];
    if (Array.isArray(statsArray)) {
      statsArray.forEach(stat => {
        if (typeof stat === 'string') {
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

// Start server
const PORT = process.env.REST_API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`[FalkorDB REST API] Server listening on http://localhost:${PORT}`);
  console.log(`[FalkorDB REST API] Health check: http://localhost:${PORT}/health`);
  console.log(`[FalkorDB REST API] API endpoint: POST http://localhost:${PORT}/api/graph/:graphName/query`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[FalkorDB REST API] Shutting down...');
  await redisClient.quit();
  process.exit(0);
});
