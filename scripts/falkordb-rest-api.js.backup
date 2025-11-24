/**
 * FalkorDB REST API Wrapper
 *
 * Lightweight Express server that exposes FalkorDB via HTTP/JSON REST API
 * Forwards requests to FalkorDB using Redis protocol
 */

const express = require('express');
const { createClient } = require('redis');

const app = express();
app.use(express.json());

// CORS for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Redis/FalkorDB connection
const redisClient = createClient({
  socket: {
    host: process.env.FALKORDB_HOST || 'localhost',
    port: parseInt(process.env.FALKORDB_PORT || '6380')
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
    // Interpolate parameters into query
    let finalQuery = query;
    for (const [key, value] of Object.entries(params)) {
      const paramPlaceholder = `$${key}`;
      let paramValue;

      if (value === null || value === undefined) {
        paramValue = 'null';
      } else if (typeof value === 'string') {
        paramValue = `"${value.replace(/"/g, '\\"')}"`;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        paramValue = String(value);
      } else if (Array.isArray(value)) {
        paramValue = '[' + value.map(v =>
          typeof v === 'string' ? `"${v.replace(/"/g, '\\"')}"` : String(v)
        ).join(', ') + ']';
      } else {
        paramValue = JSON.stringify(value);
      }

      finalQuery = finalQuery.replaceAll(paramPlaceholder, paramValue);
    }

    const startTime = Date.now();
    const result = await redisClient.sendCommand(['GRAPH.QUERY', graphName, finalQuery]);
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
function parseFalkorDBResult(result) {
  if (!result || !Array.isArray(result)) {
    return { data: [], metadata: {}, statistics: {} };
  }

  const parsed = {
    data: [],
    metadata: {},
    statistics: {},
  };

  // Extract column headers
  if (result.length > 0 && Array.isArray(result[0])) {
    parsed.metadata.columns = result[0];
  }

  // Extract result rows
  if (result.length > 1 && Array.isArray(result[1])) {
    const columns = parsed.metadata.columns || [];
    parsed.data = result[1].map(row => {
      if (!Array.isArray(row)) return row;

      const rowObj = {};
      row.forEach((value, index) => {
        const columnName = columns[index] || `col_${index}`;
        rowObj[columnName] = value;
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
