/**
 * QueryOrchestrator Service
 *
 * Coordinates the query pipeline including routing, caching, execution,
 * and result formatting. Supports both template-based and GraphRAG execution paths.
 *
 * Extracted from QuerySessionManager as part of decomposition (Phase 3).
 *
 * @module services/query-orchestrator
 */

import { generateCypherQuery } from './cypher-generator.js';
import { autoFormatResults } from './result-formatter.js';
import { getCachedQuery, setCachedQuery } from '../lib/graph/query-cache.js';
import { QueryRouter } from './query-router.js';
import { EmbeddingService } from './embedding.js';
import { traversalQueryTemplate } from '../lib/graph/cypher-templates.js';

/**
 * QueryOrchestrator Class
 *
 * Orchestrates the complete query pipeline from question to formatted results.
 */
export class QueryOrchestrator {
  /**
   * Create QueryOrchestrator instance
   *
   * @param {Object} env - Cloudflare Worker environment bindings
   * @param {Object} logger - Logger instance
   */
  constructor(env, logger) {
    this.env = env;
    this.logger = logger;
    this.router = new QueryRouter();

    // Performance metrics
    this.metrics = {
      totalQueries: 0,
      cacheHits: 0,
      templateQueries: 0,
      graphragQueries: 0,
      failedQueries: 0,
      totalLatencyMs: 0
    };
  }

  /**
   * Build FalkorDB connection config from environment
   *
   * @returns {{ host: string, port: number, username: string, password: string, apiKey?: string }}
   */
  buildFalkorConfig() {
    const host = this.env.FALKORDB_HOST;
    const username = this.env.FALKORDB_USER || 'default';
    const password = this.env.FALKORDB_PASSWORD || '';
    const rawPort = this.env.FALKORDB_PORT;
    const portNumber = Number(rawPort);

    const defaultPort = host && host.startsWith('http') ? 443 : 3001;
    const port = Number.isFinite(portNumber) ? portNumber : defaultPort;

    if (!host) {
      throw new Error('FALKORDB_HOST is not configured');
    }

    return { host, port, username, password, apiKey: this.env.FALKORDB_REST_API_KEY };
  }

  /**
   * Process a query - main orchestration method
   *
   * @param {string} question - Natural language question
   * @param {string} userId - User ID
   * @param {string} userNamespace - User's graph namespace
   * @param {Object} options - Additional options
   * @param {string} [options.queryId] - Query ID for tracking
   * @param {Function} [options.onProgress] - Progress callback
   * @returns {Promise<QueryResult>} Query result
   */
  async processQuery(question, userId, userNamespace, options = {}) {
    const startTime = Date.now();
    this.metrics.totalQueries++;

    const { queryId, onProgress } = options;

    this.logger.info('Processing query', {
      question: question.substring(0, 100),
      user_id: userId,
      user_namespace: userNamespace
    });

    try {
      // 1. Check cache first
      onProgress?.({ type: 'checking_cache' });
      const cachedResult = await getCachedQuery(this.env.KV, userId, question, {});

      if (cachedResult) {
        this.metrics.cacheHits++;
        this.logger.info('Query cache hit', { question });

        const formattedResults = autoFormatResults(cachedResult.results, {
          execution_time_ms: 0,
          cached: true,
          template_used: cachedResult.template_used,
          query_id: queryId
        });

        return {
          results: formattedResults,
          cypherQuery: cachedResult.cypher_query,
          cached: true,
          executionTimeMs: Date.now() - startTime,
          executionPath: 'cache'
        };
      }

      // 2. Route query to appropriate execution path
      onProgress?.({ type: 'routing_query' });
      const { type: queryType, path: executionPath } = this.router.route(question);

      this.logger.info('Query routing decision', {
        question,
        query_type: queryType,
        execution_path: executionPath,
        user_id: userId
      });

      // 3. Execute based on route
      if (executionPath === 'graphrag') {
        this.metrics.graphragQueries++;
        return await this.executeGraphRAG(question, userId, userNamespace, {
          queryId,
          onProgress,
          startTime
        });
      }

      // Template path
      this.metrics.templateQueries++;
      return await this.executeTemplateQuery(question, userId, userNamespace, {
        queryId,
        onProgress,
        startTime
      });

    } catch (error) {
      this.metrics.failedQueries++;
      this.logger.error('Query orchestration failed', {
        error: error.message,
        question,
        user_id: userId
      });
      throw error;
    }
  }

  /**
   * Execute template-based query path
   *
   * @param {string} question - Natural language question
   * @param {string} userId - User ID
   * @param {string} userNamespace - User's graph namespace
   * @param {Object} options - Execution options
   * @returns {Promise<QueryResult>}
   */
  async executeTemplateQuery(question, userId, userNamespace, options = {}) {
    const { queryId, onProgress, startTime } = options;

    onProgress?.({ type: 'generating_cypher', message: 'Understanding your question...' });

    // Generate Cypher from template
    const { cypher, parameters, templateUsed, entities } = await generateCypherQuery(
      question,
      userNamespace,
      userId,
      this.env
    );

    // If template falls back to LLM, switch to GraphRAG
    if (templateUsed === 'llm_generate') {
      this.logger.info('Template fallback to GraphRAG', { question });
      return await this.executeGraphRAG(question, userId, userNamespace, options);
    }

    this.logger.info('Cypher query generated', {
      template: templateUsed,
      cypher,
      parameters,
      entities_count: entities.length,
      user_namespace: userNamespace
    });

    // Execute query
    onProgress?.({ type: 'executing_query', message: 'Searching your knowledge graph...' });

    const results = await this.executeQuery(cypher, parameters, userId);
    const executionTimeMs = Date.now() - startTime;

    // Format results
    const formattedResults = autoFormatResults(results, {
      execution_time_ms: executionTimeMs,
      cached: false,
      template_used: templateUsed,
      query_id: queryId,
      cypher_query: cypher,
      user_namespace: userNamespace,
      user_id: userId
    });

    // Cache results (fire and forget)
    this.cacheQueryResults(question, userId, cypher, parameters, results, templateUsed).catch(err => {
      this.logger.error('Failed to cache query results', err);
    });

    return {
      results: formattedResults,
      cypherQuery: cypher,
      templateUsed,
      cached: false,
      executionTimeMs,
      executionPath: 'template'
    };
  }

  /**
   * Execute GraphRAG pipeline (Vector Search + Traversal)
   *
   * @param {string} question - Natural language question
   * @param {string} userId - User ID
   * @param {string} userNamespace - User's graph namespace
   * @param {Object} options - Execution options
   * @returns {Promise<QueryResult>}
   */
  async executeGraphRAG(question, userId, userNamespace, options = {}) {
    const { queryId, onProgress, startTime } = options;

    this.logger.info('graphrag.started', {
      question: question.substring(0, 100),
      user_id: userId
    });

    onProgress?.({ type: 'executing_query', message: 'Searching knowledge graph (Vector Scan)...' });

    // 1. Generate Embedding
    const embeddingStart = Date.now();
    const embeddingService = new EmbeddingService(this.env.AI);
    const vector = await embeddingService.generateEmbedding(question);

    this.logger.info('graphrag.embedding.completed', {
      latency_ms: Date.now() - embeddingStart,
      vector_dimension: vector?.length
    });

    // 2. Vector Search (Parallel across types)
    const types = ['Person', 'Project', 'Note', 'Topic'];
    const poolId = this.env.FALKORDB_POOL.idFromName('pool');
    const poolStub = this.env.FALKORDB_POOL.get(poolId);
    const config = this.buildFalkorConfig();

    const searchStart = Date.now();
    const searchPromises = types.map(async (type) => {
      const cypher = `
        CALL db.idx.vector.queryNodes('${type}', 'embedding', 5, vecf32($vector))
        YIELD node, score
        WHERE score >= 0.65
        RETURN ID(node) as nodeId, node, score
      `;

      try {
        const response = await poolStub.fetch('http://internal/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config,
            userId,
            cypher,
            params: { vector }
          })
        });

        if (!response.ok) {
          this.logger.warn('graphrag.vector_search.type_failed', { type, status: response.status });
          return [];
        }

        const result = await response.json();
        const rows = result.data || [];

        this.logger.info('graphrag.vector_search.type_completed', {
          type,
          results_count: rows.length,
          top_score: rows[0]?.score || rows[0]?.[2]
        });

        return rows.map(row => {
          if (Array.isArray(row)) {
            return { nodeId: row[0], node: row[1], score: row[2], type };
          }
          return { nodeId: row.nodeId, node: row.node, score: row.score, type };
        });
      } catch (err) {
        this.logger.warn('graphrag.vector_search.type_error', { type, error: err.message });
        return [];
      }
    });

    const searchResults = (await Promise.all(searchPromises)).flat();

    this.logger.info('graphrag.vector_search.completed', {
      latency_ms: Date.now() - searchStart,
      total_results: searchResults.length
    });

    // Sort by score descending
    searchResults.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Take top 10 entry points
    const topNodes = searchResults.slice(0, 10);

    if (topNodes.length === 0) {
      this.logger.info('graphrag.no_results', { reason: 'vector_search_empty' });

      // Fall back to keyword search
      onProgress?.({ type: 'executing_query', message: 'Trying keyword search...' });

      return await this.executeTemplateQuery(question, userId, userNamespace, options);
    }

    // 3. Graph Traversal (Context Expansion)
    const nodeIds = topNodes.map(row => {
      return row.nodeId || row.node?.id || row.node?.identity || row.node?.entity_id;
    }).filter(id => id !== undefined && id !== null);

    if (nodeIds.length === 0) {
      this.logger.warn('graphrag.node_id_extraction_failed', {
        topNodes_sample: JSON.stringify(topNodes.slice(0, 2))
      });
      throw new Error('Failed to extract node IDs from vector search results');
    }

    this.logger.info('graphrag.traversal.starting', {
      entry_points: nodeIds.length,
      node_ids: nodeIds.slice(0, 5)
    });

    const traversalCypher = traversalQueryTemplate(nodeIds);

    onProgress?.({ type: 'executing_query', message: 'Expanding context (Graph Traversal)...' });

    const traversalStart = Date.now();
    const traversalResponse = await poolStub.fetch('http://internal/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config,
        userId,
        cypher: traversalCypher,
        params: { node_ids: nodeIds }
      })
    });

    if (!traversalResponse.ok) {
      const errorText = await traversalResponse.text();
      this.logger.error('graphrag.traversal.failed', { status: traversalResponse.status, error: errorText });
      throw new Error(`Traversal query failed: ${traversalResponse.status}`);
    }

    const traversalResult = await traversalResponse.json();
    const traversalData = traversalResult.data || [];

    this.logger.info('graphrag.traversal.completed', {
      latency_ms: Date.now() - traversalStart,
      results_count: traversalData.length
    });

    const executionTimeMs = Date.now() - startTime;

    // Format results
    const combinedResults = [...traversalData];
    const formattedResults = autoFormatResults(combinedResults, {
      execution_time_ms: executionTimeMs,
      cached: false,
      template_used: 'vector_graph_rag',
      query_id: queryId,
      cypher_query: 'VECTOR_SEARCH + TRAVERSAL',
      user_namespace: userNamespace,
      user_id: userId,
      vector_search_results: topNodes.length,
      traversal_results: traversalData.length
    });

    this.logger.info('graphrag.completed', {
      total_latency_ms: executionTimeMs,
      vector_results: topNodes.length,
      traversal_results: traversalData.length
    });

    return {
      results: formattedResults,
      cypherQuery: 'GRAPH_RAG_PIPELINE',
      cached: false,
      executionTimeMs,
      executionPath: 'graphrag',
      vectorResults: topNodes.length,
      traversalResults: traversalData.length
    };
  }

  /**
   * Execute Cypher query against FalkorDB via connection pool
   *
   * @param {string} cypher - Cypher query
   * @param {Object} parameters - Query parameters
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Query results
   */
  async executeQuery(cypher, parameters, userId) {
    const config = this.buildFalkorConfig();
    const poolId = this.env.FALKORDB_POOL.idFromName('pool');
    const poolStub = this.env.FALKORDB_POOL.get(poolId);

    this.logger.info('Executing query against FalkorDB', {
      user_id: userId,
      cypher,
      parameters,
      config_host: config.host,
      config_port: config.port
    });

    const response = await poolStub.fetch('http://internal/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config,
        userId,
        cypher,
        params: parameters
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error('Query execution failed', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Query execution failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    const queryResults = result.data || [];

    this.logger.info('Query executed', {
      results_count: queryResults.length,
      statistics: result.statistics
    });

    return queryResults;
  }

  /**
   * Route query to appropriate execution path
   *
   * @param {string} question - Natural language question
   * @returns {{ type: string, path: 'graphrag' | 'template' }}
   */
  routeQuery(question) {
    return this.router.route(question);
  }

  /**
   * Cache query results
   *
   * @param {string} question - Question text
   * @param {string} userId - User ID
   * @param {string} cypher - Cypher query
   * @param {Object} parameters - Query parameters
   * @param {Array} results - Raw results
   * @param {string} templateUsed - Template identifier
   */
  async cacheQueryResults(question, userId, cypher, parameters, results, templateUsed) {
    try {
      await setCachedQuery(
        this.env.KV,
        userId,
        question,
        parameters,
        {
          cypher_query: cypher,
          results,
          template_used: templateUsed
        }
      );

      this.logger.info('Query results cached', { question });
    } catch (error) {
      this.logger.error('Failed to cache query results', error);
    }
  }

  /**
   * Get orchestrator metrics
   *
   * @returns {Object} Metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.totalQueries > 0
        ? (this.metrics.cacheHits / this.metrics.totalQueries) * 100
        : 0
    };
  }
}

/**
 * QueryResult type
 * @typedef {Object} QueryResult
 * @property {Object} results - Formatted query results
 * @property {string} cypherQuery - Cypher query executed
 * @property {string} [templateUsed] - Template identifier (if template path)
 * @property {boolean} cached - Whether result was from cache
 * @property {number} executionTimeMs - Total execution time
 * @property {string} executionPath - Execution path used (cache/template/graphrag)
 * @property {number} [vectorResults] - Number of vector search results (GraphRAG)
 * @property {number} [traversalResults] - Number of traversal results (GraphRAG)
 */

/**
 * Create QueryOrchestrator instance
 *
 * @param {Object} env - Cloudflare Worker environment bindings
 * @param {Object} logger - Logger instance
 * @returns {QueryOrchestrator}
 */
export function createQueryOrchestrator(env, logger) {
  return new QueryOrchestrator(env, logger);
}
