/**
 * Graph Neighborhood Cache Utility
 *
 * Caches entity neighborhoods (N-hop subgraphs) with 30-minute TTL.
 * Supports configurable depth (1-3 hops).
 *
 * @module lib/graph/neighborhood-cache
 */

/**
 * Cache configuration for neighborhoods
 */
const NEIGHBORHOOD_CACHE_TTL = 1800; // 30 minutes in seconds
const MAX_DEPTH = 3;

/**
 * Generate cache key for neighborhood
 *
 * @param {string} userId - User ID
 * @param {string} entityId - Entity ID (center node)
 * @param {number} depth - Neighborhood depth (1-3)
 * @returns {string} Cache key
 */
export function generateNeighborhoodCacheKey(userId, entityId, depth = 1) {
  // Validate depth
  const validDepth = Math.max(1, Math.min(depth, MAX_DEPTH));
  return `graph:neighborhood:${userId}:${entityId}:${validDepth}`;
}

/**
 * Get cached neighborhood
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} entityId - Entity ID
 * @param {number} depth - Neighborhood depth (default 1)
 * @returns {Promise<Object|null>} Cached neighborhood or null if cache miss
 */
export async function getCachedNeighborhood(kv, userId, entityId, depth = 1) {
  try {
    const cacheKey = generateNeighborhoodCacheKey(userId, entityId, depth);
    const cached = await kv.get(cacheKey, { type: 'json' });

    if (cached) {
      console.log('[NeighborhoodCache] Cache HIT for entity:', entityId, 'depth:', depth);
    } else {
      console.log('[NeighborhoodCache] Cache MISS for entity:', entityId, 'depth:', depth);
    }

    return cached;
  } catch (error) {
    console.error('[NeighborhoodCache] Error retrieving cached neighborhood:', error);
    return null;
  }
}

/**
 * Cache neighborhood result
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} entityId - Entity ID
 * @param {number} depth - Neighborhood depth
 * @param {Object} neighborhood - Neighborhood data to cache
 * @param {Object} neighborhood.entity - Center entity
 * @param {Array} neighborhood.neighbors - Array of connected entities with relationships
 * @returns {Promise<void>}
 */
export async function setCachedNeighborhood(kv, userId, entityId, depth, neighborhood) {
  try {
    const cacheKey = generateNeighborhoodCacheKey(userId, entityId, depth);

    // Add cache metadata
    const cacheData = {
      ...neighborhood,
      cached_at: new Date().toISOString(),
      depth: depth,
    };

    await kv.put(cacheKey, JSON.stringify(cacheData), {
      expirationTtl: NEIGHBORHOOD_CACHE_TTL,
    });

    console.log('[NeighborhoodCache] Cached neighborhood for entity:', entityId, 'depth:', depth);
  } catch (error) {
    console.error('[NeighborhoodCache] Error caching neighborhood:', error);
  }
}

/**
 * Invalidate neighborhood cache for specific entity
 *
 * Invalidates all depth levels for the entity.
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} entityId - Entity ID
 * @returns {Promise<void>}
 */
export async function invalidateNeighborhoodCache(kv, userId, entityId) {
  try {
    const deletePromises = [];

    // Delete all depth levels
    for (let depth = 1; depth <= MAX_DEPTH; depth++) {
      const cacheKey = generateNeighborhoodCacheKey(userId, entityId, depth);
      deletePromises.push(kv.delete(cacheKey));
    }

    await Promise.all(deletePromises);

    console.log('[NeighborhoodCache] Invalidated neighborhood cache for entity:', entityId);
  } catch (error) {
    console.error('[NeighborhoodCache] Error invalidating neighborhood cache:', error);
  }
}

/**
 * Invalidate all neighborhood caches for a user
 *
 * Called on major graph mutations to ensure consistency.
 * Note: This is expensive and should be used sparingly.
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {Array<string>} entityIds - List of entity IDs to invalidate
 * @returns {Promise<void>}
 */
export async function invalidateAllNeighborhoods(kv, userId, entityIds = []) {
  try {
    const deletePromises = [];

    for (const entityId of entityIds) {
      for (let depth = 1; depth <= MAX_DEPTH; depth++) {
        const cacheKey = generateNeighborhoodCacheKey(userId, entityId, depth);
        deletePromises.push(kv.delete(cacheKey));
      }
    }

    await Promise.all(deletePromises);

    console.log('[NeighborhoodCache] Invalidated all neighborhoods for user:', userId, '(', entityIds.length, 'entities)');
  } catch (error) {
    console.error('[NeighborhoodCache] Error invalidating all neighborhoods:', error);
  }
}

/**
 * Execute neighborhood query with automatic caching
 *
 * Checks cache first, executes query on miss, caches result.
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} entityId - Entity ID
 * @param {number} depth - Neighborhood depth
 * @param {Function} queryFn - Function that queries the neighborhood (returns Promise<neighborhood>)
 * @returns {Promise<Object>} Neighborhood result with metadata
 */
export async function executeNeighborhoodWithCache(kv, userId, entityId, depth, queryFn) {
  const startTime = Date.now();

  // Try cache first
  const cached = await getCachedNeighborhood(kv, userId, entityId, depth);

  if (cached) {
    return {
      data: cached,
      meta: {
        cached: true,
        depth: depth,
        query_time_ms: Date.now() - startTime,
        cache_age_seconds: Math.floor((Date.now() - new Date(cached.cached_at).getTime()) / 1000),
      },
    };
  }

  // Cache miss - execute query
  const neighborhood = await queryFn();

  // Cache the result (don't await - fire and forget)
  setCachedNeighborhood(kv, userId, entityId, depth, neighborhood).catch(err => {
    console.error('[NeighborhoodCache] Failed to cache neighborhood:', err);
  });

  return {
    data: neighborhood,
    meta: {
      cached: false,
      depth: depth,
      query_time_ms: Date.now() - startTime,
    },
  };
}

/**
 * Batch invalidate neighborhoods affected by a relationship change
 *
 * When a relationship is created/deleted, both connected entities' neighborhoods are affected.
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} fromEntityId - Source entity ID
 * @param {string} toEntityId - Target entity ID
 * @returns {Promise<void>}
 */
export async function invalidateRelationshipNeighborhoods(kv, userId, fromEntityId, toEntityId) {
  try {
    await Promise.all([
      invalidateNeighborhoodCache(kv, userId, fromEntityId),
      invalidateNeighborhoodCache(kv, userId, toEntityId),
    ]);

    console.log('[NeighborhoodCache] Invalidated neighborhoods for relationship:', fromEntityId, '->', toEntityId);
  } catch (error) {
    console.error('[NeighborhoodCache] Error invalidating relationship neighborhoods:', error);
  }
}

/**
 * Get cache configuration
 *
 * @returns {Object} Cache configuration
 */
export function getCacheConfig() {
  return {
    ttl_seconds: NEIGHBORHOOD_CACHE_TTL,
    max_depth: MAX_DEPTH,
  };
}
