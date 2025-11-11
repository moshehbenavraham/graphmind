/**
 * FalkorDBConnectionPool Durable Object
 *
 * Maintains a pool of persistent FalkorDB connections for optimal performance.
 * Handles user namespace management and connection lifecycle.
 *
 * @module durable-objects/FalkorDBConnectionPool
 */

import { connect, disconnect, executeCypher, isConnectionStale } from '../lib/falkordb/client.js';
import { generateGraphName, createGraphDatabase } from '../lib/falkordb/namespace.js';
import { normalizeError, isRetryableError, getRetryDelay } from '../lib/falkordb/errors.js';

export class FalkorDBConnectionPool {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    // Connection pool
    this.pool = [];
    this.maxConnections = 10;

    // Namespace cache (in-memory)
    this.namespaceCache = new Map();

    // Connection config (will be set from incoming requests)
    this.connectionConfig = null;
  }

  /**
   * Set connection configuration from incoming request
   */
  setConnectionConfig(config) {
    if (!this.connectionConfig) {
      this.connectionConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
      };
      console.log('[ConnectionPool] Connection config set', {
        host: config.host,
        port: config.port,
        username: config.username,
      });
    }
  }

  /**
   * Handle HTTP fetch requests to this Durable Object
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route requests
      if (path === '/execute' && request.method === 'POST') {
        return await this.handleExecuteQuery(request);
      } else if (path === '/namespace' && request.method === 'POST') {
        return await this.handleGetOrCreateNamespace(request);
      } else if (path === '/health' && (request.method === 'GET' || request.method === 'POST')) {
        return await this.handleHealthCheck(request);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('[ConnectionPool] Request error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Execute a Cypher query on a user's graph
   */
  async handleExecuteQuery(request) {
    const { config, userId, cypher, params } = await request.json();

    // Set config if provided
    if (config) {
      this.setConnectionConfig(config);
    }

    if (!userId || !cypher) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or cypher query' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      // Get or create user's namespace
      const graphName = await this.getOrCreateNamespace(userId);

      // Execute query using connection pool
      const result = await this.executeQuery(graphName, cypher, params);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const normalizedError = normalizeError(error, { userId, query: cypher });
      return new Response(
        JSON.stringify({
          error: normalizedError.message,
          code: normalizedError.code,
        }),
        {
          status: normalizedError.httpStatus || 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Get or create namespace for a user
   */
  async handleGetOrCreateNamespace(request) {
    const { userId } = await request.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const graphName = await this.getOrCreateNamespace(userId);

      return new Response(
        JSON.stringify({
          namespace: graphName,
          created: true, // TODO: Track if actually created vs already existed
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      const normalizedError = normalizeError(error, { userId });
      return new Response(
        JSON.stringify({
          error: normalizedError.message,
          code: normalizedError.code,
        }),
        {
          status: normalizedError.httpStatus || 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Health check endpoint
   */
  async handleHealthCheck(request) {
    let parsedConfig = null;
    try {
      // Get config from request body if provided
      if (request.method === 'POST') {
        parsedConfig = await request.json();
        this.setConnectionConfig(parsedConfig);
      }

      const conn = await this.getConnection();

      // Release connection back to pool
      this.releaseConnection(conn);

      return new Response(
        JSON.stringify({
          status: 'healthy',
          poolSize: this.pool.length,
          availableConnections: this.pool.filter(c => !c.inUse).length,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('[ConnectionPool] Health check failed:', error);
      return new Response(
        JSON.stringify({
          status: 'unhealthy',
          error: error.message,
          stack: error.stack,
          receivedConfig: request.method === 'POST' ? 'yes (POST request)' : 'no (GET request)',
          parsedConfig: parsedConfig,
          connectionConfig: this.connectionConfig,
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Get or create a user's namespace
   *
   * @param {string} userId - User ID
   * @returns {Promise<string>} Graph name
   */
  async getOrCreateNamespace(userId) {
    // Check in-memory cache first
    if (this.namespaceCache.has(userId)) {
      return this.namespaceCache.get(userId);
    }

    // Check Durable Object storage
    const storageKey = `namespace:${userId}`;
    const cachedNamespace = await this.state.storage.get(storageKey);

    if (cachedNamespace) {
      // Update in-memory cache
      this.namespaceCache.set(userId, cachedNamespace);
      return cachedNamespace;
    }

    // Generate new namespace
    const graphName = generateGraphName(userId);

    // Create graph database
    const client = await this.getConnection();
    try {
      await createGraphDatabase(client, graphName);

      // Store in Durable Object storage (persists across restarts)
      await this.state.storage.put(storageKey, graphName);

      // Update in-memory cache
      this.namespaceCache.set(userId, graphName);

      console.log('[ConnectionPool] Created namespace:', { userId, graphName });

      return graphName;
    } finally {
      this.releaseConnection(client);
    }
  }

  /**
   * Get a connection from the pool
   *
   * @returns {Promise<Object>} Redis client connection
   */
  async getConnection() {
    // Find available connection
    let conn = this.pool.find(c => !c.inUse && !c.stale);

    if (conn) {
      // Validate connection before reuse
      const stale = await isConnectionStale(conn.client);
      if (stale) {
        // Remove stale connection
        conn.stale = true;
        conn = null;
      } else {
        // Mark as in use
        conn.inUse = true;
        conn.lastUsed = Date.now();
        return conn.client;
      }
    }

    // Create new connection if under limit
    if (this.pool.length < this.maxConnections) {
      return await this.createConnection();
    }

    // Wait for available connection (with timeout)
    return await this.waitForConnection();
  }

  /**
   * Create a new connection
   *
   * @param {number} [retryAttempt=0] - Current retry attempt
   * @returns {Promise<Object>} Redis client connection
   */
  async createConnection(retryAttempt = 0) {
    try {
      const client = await connect(this.connectionConfig);

      // Add to pool
      const conn = {
        client,
        inUse: true,
        stale: false,
        created: Date.now(),
        lastUsed: Date.now(),
      };

      this.pool.push(conn);

      console.log('[ConnectionPool] Created connection', {
        poolSize: this.pool.length,
        maxConnections: this.maxConnections,
      });

      return client;
    } catch (error) {
      // Retry with exponential backoff for retryable errors
      if (isRetryableError(error) && retryAttempt < 3) {
        const delay = getRetryDelay(retryAttempt + 1);
        console.log(`[ConnectionPool] Retrying connection in ${delay}ms (attempt ${retryAttempt + 1})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return await this.createConnection(retryAttempt + 1);
      }

      throw error;
    }
  }

  /**
   * Wait for an available connection
   *
   * @param {number} [timeout=10000] - Timeout in ms
   * @returns {Promise<Object>} Redis client connection
   */
  async waitForConnection(timeout = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Check for available connection
      const conn = this.pool.find(c => !c.inUse && !c.stale);

      if (conn) {
        conn.inUse = true;
        conn.lastUsed = Date.now();
        return conn.client;
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Connection pool exhausted - no available connections');
  }

  /**
   * Release a connection back to the pool
   *
   * @param {Object} client - Redis client connection
   */
  releaseConnection(client) {
    const conn = this.pool.find(c => c.client === client);

    if (conn) {
      conn.inUse = false;
      conn.lastUsed = Date.now();
    }
  }

  /**
   * Execute a query using the connection pool
   *
   * @param {string} graphName - Graph name
   * @param {string} cypher - Cypher query
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async executeQuery(graphName, cypher, params = {}) {
    const client = await this.getConnection();

    try {
      return await executeCypher(client, graphName, cypher, params);
    } finally {
      this.releaseConnection(client);
    }
  }

  /**
   * Clean up stale connections (called periodically)
   */
  async cleanupStaleConnections() {
    const now = Date.now();
    const maxIdleTime = 5 * 60 * 1000; // 5 minutes

    for (let i = this.pool.length - 1; i >= 0; i--) {
      const conn = this.pool[i];

      // Remove if stale or idle too long
      if (conn.stale || (now - conn.lastUsed > maxIdleTime)) {
        console.log('[ConnectionPool] Removing stale/idle connection');

        try {
          await disconnect(conn.client);
        } catch (error) {
          console.error('[ConnectionPool] Error disconnecting:', error);
        }

        this.pool.splice(i, 1);
      }
    }
  }
}
