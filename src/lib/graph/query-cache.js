/**
 * Graph Query Cache Utility
 *
 * High-level interface for caching graph query results in KV.
 * Provides 1-hour TTL caching for Cypher query results.
 *
 * @module lib/graph/query-cache
 */

import {
  hashQuery,
  cacheQueryResult,
  getCachedQueryResult,
  invalidateQueryCache,
  trackQueryHash,
} from './cache-invalidator.js';
import { getGlobalCacheMetrics, createLogger } from '../utils/logger.js';

/**
 * Cache configuration for graph queries
 */
const QUERY_CACHE_TTL = 3600; // 1 hour in seconds

/**
 * Generate cache key for a graph query
 *
 * @param {string} userId - User ID
 * @param {string} cypherQuery - Cypher query string
 * @param {Object} params - Query parameters
 * @returns {Promise<string>} Cache key
 */
export async function generateCacheKey(userId, cypherQuery, params = {}) {
  const queryHash = await hashQuery(cypherQuery, params);
  return `graph:query:${userId}:${queryHash}`;
}

/**
 * Get cached query result
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} cypherQuery - Cypher query string
 * @param {Object} params - Query parameters
 * @returns {Promise<Object|null>} Cached result or null if cache miss
 */
export async function getCachedQuery(kv, userId, cypherQuery, params = {}) {
  // T141: Cache hit/miss logging
  const cacheMetrics = getGlobalCacheMetrics();
  const logger = createLogger('QueryCache', { userId });
  const cacheKey = await generateCacheKey(userId, cypherQuery, params);

  try {
    const result = await getCachedQueryResult(kv, userId, cypherQuery, params);
    if (result) {
      cacheMetrics.recordHit(cacheKey, logger);
    } else {
      cacheMetrics.recordMiss(cacheKey, logger);
    }
    return result;
  } catch (error) {
    cacheMetrics.recordError(cacheKey, error, logger);
    logger.error('Error retrieving cached query', error);
    return null; // Fail gracefully on cache errors
  }
}

/**
 * Cache a query result
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} cypherQuery - Cypher query string
 * @param {Object} params - Query parameters
 * @param {Object} result - Query result to cache
 * @param {number} ttl - TTL in seconds (default 1 hour)
 * @returns {Promise<void>}
 */
export async function setCachedQuery(kv, userId, cypherQuery, params = {}, result, ttl = QUERY_CACHE_TTL) {
  try {
    await cacheQueryResult(kv, userId, cypherQuery, params, result, ttl);
  } catch (error) {
    console.error('[QueryCache] Error caching query result:', error);
    // Fail gracefully - don't throw, just log
  }
}

/**
 * Invalidate all cached queries for a user
 *
 * Called when graph mutations occur to ensure fresh data.
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function invalidateUserQueries(kv, userId) {
  try {
    await invalidateQueryCache(kv, userId);
  } catch (error) {
    console.error('[QueryCache] Error invalidating user queries:', error);
  }
}

/**
 * Execute a query with automatic caching
 *
 * Checks cache first, executes query on miss, caches result.
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} cypherQuery - Cypher query string
 * @param {Object} params - Query parameters
 * @param {Function} executeFn - Function that executes the query (returns Promise<result>)
 * @returns {Promise<Object>} Query result with metadata
 */
export async function executeWithCache(kv, userId, cypherQuery, params, executeFn) {
  const startTime = Date.now();

  // Try cache first
  const cached = await getCachedQuery(kv, userId, cypherQuery, params);

  if (cached) {
    return {
      data: cached,
      meta: {
        cached: true,
        query_time_ms: Date.now() - startTime,
      },
    };
  }

  // Cache miss - execute query
  const result = await executeFn();

  // Cache the result (don't await - fire and forget)
  setCachedQuery(kv, userId, cypherQuery, params, result).catch(err => {
    console.error('[QueryCache] Failed to cache result:', err);
  });

  return {
    data: result,
    meta: {
      cached: false,
      query_time_ms: Date.now() - startTime,
    },
  };
}

/**
 * Get cache statistics for monitoring
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Cache statistics
 */
export async function getCacheStats(kv, userId) {
  try {
    const queryListKey = `graph:query_list:${userId}`;
    const queryHashes = await kv.get(queryListKey, { type: 'json' }) || [];

    return {
      cached_queries: queryHashes.length,
      cache_ttl_seconds: QUERY_CACHE_TTL,
    };
  } catch (error) {
    console.error('[QueryCache] Error getting cache stats:', error);
    return {
      cached_queries: 0,
      cache_ttl_seconds: QUERY_CACHE_TTL,
    };
  }
}
