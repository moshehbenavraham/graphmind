/**
 * KV Cache Invalidation Utility
 *
 * Handles cache invalidation for graph-related KV keys
 * when graph mutations occur.
 *
 * @module lib/graph/cache-invalidator
 */

/**
 * Invalidate all graph-related caches for a user
 *
 * Deletes:
 * - Query cache (graph:query:{user_id}:*)
 * - Stats cache (graph:stats:{user_id})
 * - All neighborhood caches (graph:neighborhood:{user_id}:*)
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 */
export async function invalidateAllGraphCaches(kv, userId) {
  const keysToDelete = [
    `graph:stats:${userId}`,
  ];

  // Delete all keys
  await Promise.all(
    keysToDelete.map(key => kv.delete(key))
  );

  console.log('[CacheInvalidator] Invalidated all graph caches for user:', userId);
}

/**
 * Invalidate query cache for a user
 *
 * Note: KV doesn't support wildcard deletes, so we maintain a list
 * of query hashes for each user and delete them individually.
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 */
export async function invalidateQueryCache(kv, userId) {
  // Get list of query hashes for this user
  const queryListKey = `graph:query_list:${userId}`;
  const queryHashes = await kv.get(queryListKey, { type: 'json' }) || [];

  // Delete all cached queries
  const deletePromises = queryHashes.map(hash =>
    kv.delete(`graph:query:${userId}:${hash}`)
  );

  // Delete the query list itself
  deletePromises.push(kv.delete(queryListKey));

  await Promise.all(deletePromises);

  console.log('[CacheInvalidator] Invalidated query cache for user:', userId, '(', queryHashes.length, 'queries)');
}

/**
 * Invalidate stats cache for a user
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 */
export async function invalidateStatsCache(kv, userId) {
  await kv.delete(`graph:stats:${userId}`);
  console.log('[CacheInvalidator] Invalidated stats cache for user:', userId);
}

/**
 * Invalidate neighborhood cache for specific entity
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} entityId - Entity ID whose neighborhood changed
 */
export async function invalidateNeighborhoodCache(kv, userId, entityId) {
  // Delete all depth levels for this entity
  const deletePromises = [];
  for (let depth = 1; depth <= 3; depth++) {
    deletePromises.push(kv.delete(`graph:neighborhood:${userId}:${entityId}:${depth}`));
  }

  await Promise.all(deletePromises);

  console.log('[CacheInvalidator] Invalidated neighborhood cache for entity:', entityId);
}

/**
 * Invalidate entity resolution cache
 * (Reuses entity cache from Feature 005)
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} entityKey - Normalized entity key (lowercase name)
 */
export async function invalidateEntityResolutionCache(kv, userId, entityKey) {
  await kv.delete(`entity:resolve:${userId}:${entityKey}`);
  console.log('[CacheInvalidator] Invalidated entity resolution cache for:', entityKey);
}

/**
 * Track query hash for later invalidation
 *
 * Maintains a list of query hashes for each user so we can
 * invalidate them later (KV doesn't support wildcard deletes).
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} queryHash - Hash of the query
 */
export async function trackQueryHash(kv, userId, queryHash) {
  const queryListKey = `graph:query_list:${userId}`;

  // Get existing list
  const queryHashes = await kv.get(queryListKey, { type: 'json' }) || [];

  // Add new hash if not already present
  if (!queryHashes.includes(queryHash)) {
    queryHashes.push(queryHash);

    // Store updated list (24 hour TTL, same as query cache)
    await kv.put(queryListKey, JSON.stringify(queryHashes), {
      expirationTtl: 86400, // 24 hours
    });
  }
}

/**
 * Hash a Cypher query for cache key generation
 *
 * @param {string} cypher - Cypher query string
 * @param {Object} params - Query parameters
 * @returns {Promise<string>} SHA-256 hash of query
 */
export async function hashQuery(cypher, params) {
  const queryString = cypher + JSON.stringify(params);

  // Use Web Crypto API for hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(queryString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex.substring(0, 16); // Use first 16 chars for brevity
}

/**
 * Cache a graph query result
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} cypher - Cypher query
 * @param {Object} params - Query parameters
 * @param {Object} result - Query result to cache
 * @param {number} ttl - TTL in seconds (default 3600 = 1 hour)
 */
export async function cacheQueryResult(kv, userId, cypher, params, result, ttl = 3600) {
  const queryHash = await hashQuery(cypher, params);
  const cacheKey = `graph:query:${userId}:${queryHash}`;

  // Store result
  await kv.put(cacheKey, JSON.stringify(result), {
    expirationTtl: ttl,
  });

  // Track hash for invalidation
  await trackQueryHash(kv, userId, queryHash);

  console.log('[CacheInvalidator] Cached query result:', cacheKey.substring(0, 50) + '...');
}

/**
 * Get cached query result
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} cypher - Cypher query
 * @param {Object} params - Query parameters
 * @returns {Promise<Object|null>} Cached result or null if not found
 */
export async function getCachedQueryResult(kv, userId, cypher, params) {
  const queryHash = await hashQuery(cypher, params);
  const cacheKey = `graph:query:${userId}:${queryHash}`;

  const cached = await kv.get(cacheKey, { type: 'json' });

  if (cached) {
    console.log('[CacheInvalidator] Cache HIT:', cacheKey.substring(0, 50) + '...');
  } else {
    console.log('[CacheInvalidator] Cache MISS:', cacheKey.substring(0, 50) + '...');
  }

  return cached;
}
