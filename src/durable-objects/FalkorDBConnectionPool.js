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

    // Warmup state (in-memory, not persisted)
    this.warmupState = 'cold'; // 'cold', 'warming', 'warm'
    this.lastWarmupTime = null;
    this.warmupInProgress = false;
    this.minPoolSize = 5; // Minimum warm connections to maintain (INCREASED from 2)

    // Connection keep-alive tracking (T180)
    this.lastKeepAliveTime = null; // When we last sent PING to all connections
    this.keepAliveInterval = 30 * 1000; // PING every 30 seconds
    this.connectionStates = new Map(); // Track state transitions per connection

    // Adaptive alarm intervals
    this.alarmIntervalCold = 30 * 1000; // 30 seconds when pool cold/unhealthy
    this.alarmIntervalWarm = 2 * 60 * 1000; // 2 minutes when pool healthy
  }

  /**
   * Log connection state transition (T183)
   * @param {Object} conn - Connection object
   * @param {string} state - State name: 'created', 'validated', 'failed', 'closed', 'ping_success', 'ping_failed'
   * @param {Object} [details] - Additional details
   */
  logConnectionState(conn, state, details = {}) {
    const connId = this.pool.indexOf(conn);
    const timestamp = new Date().toISOString();

    const logEntry = {
      state,
      timestamp,
      connId,
      poolSize: this.pool.length,
      ...details,
    };

    // Track state history for debugging
    if (!this.connectionStates.has(connId)) {
      this.connectionStates.set(connId, []);
    }
    this.connectionStates.get(connId).push(logEntry);

    // Keep only last 10 states per connection to prevent memory growth
    const history = this.connectionStates.get(connId);
    if (history.length > 10) {
      history.shift();
    }

    console.log('[ConnectionPool] Connection state:', JSON.stringify(logEntry));
  }

  /**
   * Set connection configuration from incoming request
   * Persists to Durable Object storage for alarm handler access
   * ALWAYS overwrites existing config to allow switching between local/cloud
   */
  async setConnectionConfig(config) {
    this.connectionConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    };

    // Persist to storage for alarm handler
    await this.state.storage.put('connectionConfig', this.connectionConfig);

    console.log('[ConnectionPool] Connection config set and persisted', {
      host: config.host,
      port: config.port,
      username: config.username,
    });
  }

  /**
   * Load connection configuration from storage
   * Called by alarm handler when config not in memory
   */
  async loadConnectionConfig() {
    if (!this.connectionConfig) {
      this.connectionConfig = await this.state.storage.get('connectionConfig');

      if (this.connectionConfig) {
        console.log('[ConnectionPool] Loaded connection config from storage', {
          host: this.connectionConfig.host,
          port: this.connectionConfig.port,
        });
      } else {
        console.warn('[ConnectionPool] No connection config in storage');
      }
    }

    return this.connectionConfig;
  }

  /**
   * Handle HTTP fetch requests to this Durable Object
   */
  async fetch(request) {
    // Load config from storage if not in memory (handles DO wake from hibernation)
    await this.loadConnectionConfig();

    // Ensure alarm scheduled for warmup
    await this.ensureAlarmScheduled();

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route requests
      if (path === '/execute' && request.method === 'POST') {
        return await this.handleExecuteQuery(request);
      } else if (path === '/execute-batch' && request.method === 'POST') {
        return await this.handleExecuteBatch(request);
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
      await this.setConnectionConfig(config);
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
          originalMessage: normalizedError.originalMessage,
        }),
        {
          status: normalizedError.httpStatus || 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Execute a batch of graph operations
   */
  async handleExecuteBatch(request) {
    console.log('[ConnectionPool] handleExecuteBatch called');
    const { config, userId, operations } = await request.json();
    console.log('[ConnectionPool] Parsed request:', { userId, operationCount: operations?.length });

    // Set config if provided
    if (config) {
      await this.setConnectionConfig(config);
      console.log('[ConnectionPool] Config set');
    }

    if (!userId || !operations || operations.length === 0) {
      console.log('[ConnectionPool] Invalid request - missing userId or operations');
      return new Response(
        JSON.stringify({ error: 'Missing userId or operations' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      console.log('[ConnectionPool] About to call executeBatchGraphUpdate');
      // Execute batch operations
      const results = await this.executeBatchGraphUpdate(userId, operations);
      console.log('[ConnectionPool] executeBatchGraphUpdate completed, results count:', results?.length);

      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[ConnectionPool] executeBatchGraphUpdate failed:', error);
      console.error('[ConnectionPool] Error details:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });
      const normalizedError = normalizeError(error, { userId, operationCount: operations.length });
      return new Response(
        JSON.stringify({
          error: normalizedError.message,
          code: normalizedError.code,
          originalMessage: normalizedError.originalMessage,
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
        await this.setConnectionConfig(parsedConfig);
      }

      // DON'T call getConnection() - it will block if alarm is running
      // Just return pool status immediately
      const availableConnections = this.pool.filter(c => !c.inUse && !c.stale).length;
      const isHealthy = availableConnections >= this.minPoolSize;

      return new Response(
        JSON.stringify({
          status: isHealthy ? 'healthy' : 'warming',
          warmupState: this.warmupState,
          warmupInProgress: this.warmupInProgress,
          lastWarmupTime: this.lastWarmupTime
            ? new Date(this.lastWarmupTime).toISOString()
            : null,
          lastKeepAliveTime: this.lastKeepAliveTime
            ? new Date(this.lastKeepAliveTime).toISOString()
            : null,
          poolSize: this.pool.length,
          availableConnections: availableConnections,
          alarmScheduled: (await this.state.storage.getAlarm()) != null,
          connectionDetails: this.pool.map(c => ({
            inUse: c.inUse,
            stale: c.stale,
            ageMs: Date.now() - c.created,
            timeSinceLastPingMs: Date.now() - (c.lastPing || c.created),
            timeSinceLastUseMs: Date.now() - c.lastUsed,
          })),
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
          warmupState: this.warmupState,
          poolSize: this.pool.length,
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
    // FAIL-FAST: Don't wait for warmup, fail immediately and trigger background warmup
    // This prevents request timeouts and allows consumers to retry

    // Find available connection
    let conn = this.pool.find(c => !c.inUse && !c.stale);

    if (conn) {
      // Validate connection before reuse (T182)
      const stale = await isConnectionStale(conn.client);
      if (stale) {
        // Remove stale connection
        conn.stale = true;
        this.logConnectionState(conn, 'failed', { reason: 'stale_connection', timeSinceLastPing: Date.now() - conn.lastPing });
        conn = null;
      } else {
        // Mark as in use and update PING time
        conn.inUse = true;
        conn.lastUsed = Date.now();
        conn.lastPing = Date.now(); // Connection validated successfully
        this.logConnectionState(conn, 'validated', { timeSinceLastUse: Date.now() - conn.lastUsed });
        console.log('[ConnectionPool] Returning warm connection from pool');
        return conn.client;
      }
    }

    // No warm connections available - create one on-demand if we have config
    if (this.connectionConfig) {
      console.log('[ConnectionPool] No connections in pool - creating on-demand');
      const client = await this.createConnection();
      const conn = {
        client,
        inUse: true,
        stale: false,
        created: Date.now(),
        lastUsed: Date.now(),
        lastPing: Date.now()
      };
      this.pool.push(conn);
      this.logConnectionState(conn, 'created', { source: 'on_demand' });

      // Schedule alarm to maintain minimum pool size in background
      await this.state.storage.setAlarm(Date.now() + 100);

      return client;
    }

    // No config available - fail and schedule alarm
    console.error('[ConnectionPool] No connections and no config - triggering alarm');
    await this.state.storage.setAlarm(Date.now() + 100);
    throw new Error('Connection pool not ready - no configuration available.');
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
        lastPing: Date.now(), // Track last successful PING (T180)
      };

      this.pool.push(conn);

      console.log('[ConnectionPool] Created connection', {
        poolSize: this.pool.length,
        maxConnections: this.maxConnections,
      });

      // Log connection state (T183)
      this.logConnectionState(conn, 'created', { retryAttempt });

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
   * Execute a graph query with automatic user namespace injection
   * (Feature 006 - Knowledge Graph Building)
   *
   * @param {string} userId - User ID for namespace isolation
   * @param {string} cypher - Cypher query
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async executeGraphQuery(userId, cypher, params = {}) {
    if (!userId) {
      throw new Error('userId is required for graph queries');
    }

    // Get or create user's namespace
    const graphName = await this.getOrCreateNamespace(userId);

    // Inject user_id into params for filtering
    const enhancedParams = {
      ...params,
      user_id: userId,
    };

    // Execute query
    return await this.executeQuery(graphName, cypher, enhancedParams);
  }

  /**
   * Execute a batch of graph updates in a single transaction
   * (Feature 006 - Knowledge Graph Building)
   *
   * @param {string} userId - User ID for namespace isolation
   * @param {Array<{cypher: string, params: Object}>} operations - Array of operations to execute
   * @returns {Promise<Array<Object>>} Array of results for each operation
   */
  async executeBatchGraphUpdate(userId, operations) {
    console.log('[ConnectionPool] executeBatchGraphUpdate started', { userId, operationCount: operations?.length });

    if (!userId) {
      throw new Error('userId is required for batch graph updates');
    }

    if (!Array.isArray(operations) || operations.length === 0) {
      throw new Error('operations must be a non-empty array');
    }

    console.log('[ConnectionPool] Getting user namespace...');
    // Get or create user's namespace
    const graphName = await this.getOrCreateNamespace(userId);
    console.log('[ConnectionPool] Got graph name:', graphName);

    console.log('[ConnectionPool] Getting connection from pool...');
    // Get connection for transaction
    const client = await this.getConnection();
    console.log('[ConnectionPool] Got connection');

    try {
      const results = [];

      console.log('[ConnectionPool] Executing', operations.length, 'operations sequentially');
      // Execute all operations sequentially within same connection
      // (FalkorDB doesn't have native transactions, but connection ensures consistency)
      for (let i = 0; i < operations.length; i++) {
        const { cypher, params = {} } = operations[i];
        console.log(`[ConnectionPool] Executing operation ${i + 1}/${operations.length}`);

        // Inject user_id into params
        const enhancedParams = {
          ...params,
          user_id: userId,
        };

        console.log(`[ConnectionPool] About to execute Cypher ${i + 1}:`, cypher.substring(0, 100));
        const result = await executeCypher(client, graphName, cypher, enhancedParams);
        console.log(`[ConnectionPool] Operation ${i + 1} complete`);
        results.push(result);
      }

      console.log('[ConnectionPool] All operations complete, returning', results.length, 'results');
      return results;
    } catch (error) {
      console.error('[ConnectionPool] Batch update failed:', error);
      throw error;
    } finally {
      console.log('[ConnectionPool] Releasing connection back to pool');
      this.releaseConnection(client);
    }
  }

  /**
   * Create connection directly (used by alarm handler)
   * Does NOT mark connection as in-use
   */
  async createConnectionDirect() {
    const client = await connect(this.connectionConfig);

    const conn = {
      client,
      inUse: false,  // Available for use immediately
      stale: false,
      created: Date.now(),
      lastUsed: Date.now(),
      lastPing: Date.now(), // Track last successful PING (T180)
    };

    this.pool.push(conn);

    // Log connection state (T183)
    this.logConnectionState(conn, 'created', { source: 'alarm_warmup' });

    return client;
  }

  /**
   * Ensure alarm is scheduled for warmup
   * Call this on first fetch request to trigger immediate warmup
   */
  async ensureAlarmScheduled() {
    const currentAlarm = await this.state.storage.getAlarm();

    if (currentAlarm == null) {
      console.log('[ConnectionPool] No alarm scheduled - scheduling immediate warmup');
      this.warmupState = 'warming';

      // Schedule alarm for immediate execution (100ms from now)
      await this.state.storage.setAlarm(Date.now() + 100);
    }
  }

  /**
   * Wait for warmup to complete
   * @param {number} timeout - Max time to wait (ms)
   * @returns {Promise<boolean>} True if warmup completed, false if timeout
   */
  async waitForWarmup(timeout) {
    const startTime = Date.now();

    while (this.warmupInProgress && (Date.now() - startTime < timeout)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return !this.warmupInProgress;
  }

  /**
   * Validate existing connections by sending PING
   * Remove stale connections
   * NOW WITH KEEP-ALIVE: Updates lastPing on successful PING (T181)
   */
  async validateExistingConnections() {
    console.log('[ConnectionPool] Validating existing connections (with keep-alive PING)...');
    const now = Date.now();
    const maxIdleTime = 30 * 60 * 1000; // 30 minutes
    let removedCount = 0;
    let pingSuccessCount = 0;
    let pingFailCount = 0;

    for (let i = this.pool.length - 1; i >= 0; i--) {
      const conn = this.pool[i];

      // Check if idle too long
      if (now - conn.lastUsed > maxIdleTime) {
        console.log(`[ConnectionPool] Removing idle connection (last used ${Math.floor((now - conn.lastUsed) / 60000)}min ago)`);
        conn.stale = true;
        this.logConnectionState(conn, 'closed', { reason: 'max_idle_time_exceeded' });
      }

      // Validate with PING - This is our keep-alive mechanism (T181)
      if (!conn.stale) {
        try {
          const stale = await isConnectionStale(conn.client);
          if (stale) {
            console.log('[ConnectionPool] Connection failed PING validation');
            conn.stale = true;
            this.logConnectionState(conn, 'ping_failed', {
              timeSinceLastPing: now - conn.lastPing,
              timeSinceLastUse: now - conn.lastUsed
            });
            pingFailCount++;
          } else {
            // SUCCESS: Update lastPing to keep connection alive (T181)
            conn.lastPing = now;
            this.logConnectionState(conn, 'ping_success', {
              timeSinceLastPing: now - (conn.lastPing || conn.created),
              inUse: conn.inUse
            });
            pingSuccessCount++;
          }
        } catch (error) {
          console.error('[ConnectionPool] PING validation failed:', error);
          conn.stale = true;
          this.logConnectionState(conn, 'ping_failed', { error: error.message });
          pingFailCount++;
        }
      }

      // Remove stale connections
      if (conn.stale) {
        try {
          await disconnect(conn.client);
        } catch (error) {
          console.error('[ConnectionPool] Error disconnecting stale connection:', error);
        }
        this.pool.splice(i, 1);
        removedCount++;
      }
    }

    // Update last keep-alive time (T181)
    this.lastKeepAliveTime = now;

    console.log(`[ConnectionPool] Keep-alive complete: ${pingSuccessCount} kept alive, ${pingFailCount} failed, ${removedCount} removed`);
  }

  /**
   * Alarm handler - invoked automatically by Cloudflare when alarm fires
   * Proactively warms connection pool
   */
  async alarm() {
    console.log('[ConnectionPool] Alarm fired - starting warmup');
    const startTime = Date.now();
    this.warmupInProgress = true;

    try {
      // 0. Load connection config from storage if not in memory
      await this.loadConnectionConfig();

      if (!this.connectionConfig) {
        console.warn('[ConnectionPool] No connection config available - skipping warmup');
        this.warmupInProgress = false;

        // Reschedule alarm aggressively (10 seconds)
        const nextAlarmTime = Date.now() + 10000;
        await this.state.storage.setAlarm(nextAlarmTime);
        console.log('[ConnectionPool] Alarm rescheduled for 10s (waiting for config)');
        return;
      }

      // 1. Validate existing connections
      await this.validateExistingConnections();

      // 2. Create new connections up to minimum pool size
      const availableConnections = this.pool.filter(c => !c.inUse && !c.stale).length;
      const neededConnections = this.minPoolSize - availableConnections;

      if (neededConnections > 0) {
        console.log(`[ConnectionPool] Creating ${neededConnections} connections IN PARALLEL to reach minimum pool size`);

        // Create connections in PARALLEL (don't await each one)
        const createPromises = [];
        for (let i = 0; i < neededConnections; i++) {
          // Check time budget (max 25s out of 30s alarm timeout)
          if (Date.now() - startTime > 25000) {
            console.warn('[ConnectionPool] Alarm time budget exceeded, stopping warmup early');
            break;
          }

          createPromises.push(
            this.createConnectionDirect()
              .then(() => console.log(`[ConnectionPool] Created connection ${i + 1}/${neededConnections}`))
              .catch(error => console.error(`[ConnectionPool] Failed to create connection ${i + 1}:`, error))
          );
        }

        // Wait for all parallel connections with timeout
        await Promise.race([
          Promise.all(createPromises),
          new Promise(resolve => setTimeout(resolve, 25000 - (Date.now() - startTime)))
        ]);

        console.log(`[ConnectionPool] Parallel connection creation complete, created ${this.pool.length} connections`);
      }

      // 3. Update warmup state and reschedule next alarm
      const finalAvailable = this.pool.filter(c => !c.inUse && !c.stale).length;
      const isHealthy = finalAvailable >= this.minPoolSize;

      this.warmupState = isHealthy ? 'warm' : 'cold';
      this.lastWarmupTime = Date.now();
      this.warmupInProgress = false;

      const duration = Date.now() - startTime;
      console.log(`[ConnectionPool] Warmup complete in ${duration}ms`, {
        poolSize: this.pool.length,
        availableConnections: finalAvailable,
        healthy: isHealthy,
        lastKeepAliveTime: this.lastKeepAliveTime ? new Date(this.lastKeepAliveTime).toISOString() : 'never',
        keepAliveInterval: `${this.keepAliveInterval / 1000}s`,
      });

      // 4. Schedule next alarm - ADAPTIVE INTERVAL
      const nextInterval = isHealthy ? this.alarmIntervalWarm : this.alarmIntervalCold;
      const nextAlarmTime = Date.now() + nextInterval;
      await this.state.storage.setAlarm(nextAlarmTime);
      console.log(`[ConnectionPool] Next alarm scheduled for ${new Date(nextAlarmTime).toISOString()} (${nextInterval / 1000}s interval, pool ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'})`);

    } catch (error) {
      console.error('[ConnectionPool] Alarm warmup failed:', error);
      this.warmupInProgress = false;

      // Don't reschedule alarm on failure - Cloudflare will retry automatically
      // (exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s - up to 6 retries)
      throw error;
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
