/**
 * Graph Stats Cache Utility
 *
 * Caches graph statistics (node counts, relationship counts, most connected entities)
 * with 5-minute TTL for balance between freshness and performance.
 *
 * @module lib/graph/stats-cache
 */

/**
 * Cache configuration for graph stats
 */
const STATS_CACHE_TTL = 300; // 5 minutes in seconds

/**
 * Generate cache key for graph stats
 *
 * @param {string} userId - User ID
 * @returns {string} Cache key
 */
export function generateStatsCacheKey(userId) {
  return `graph:stats:${userId}`;
}

/**
 * Get cached graph stats
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Cached stats or null if cache miss
 */
export async function getCachedStats(kv, userId) {
  try {
    const cacheKey = generateStatsCacheKey(userId);
    const cached = await kv.get(cacheKey, { type: 'json' });

    if (cached) {
      console.log('[StatsCache] Cache HIT for user:', userId);
    } else {
      console.log('[StatsCache] Cache MISS for user:', userId);
    }

    return cached;
  } catch (error) {
    console.error('[StatsCache] Error retrieving cached stats:', error);
    return null;
  }
}

/**
 * Cache graph stats
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {Object} stats - Stats object to cache
 * @param {number} stats.node_count - Total node count
 * @param {number} stats.relationship_count - Total relationship count
 * @param {Object} stats.entity_breakdown - Breakdown by entity type
 * @param {Array} stats.most_connected - Most connected entities
 * @param {string} stats.last_sync - Last sync timestamp
 * @returns {Promise<void>}
 */
export async function setCachedStats(kv, userId, stats) {
  try {
    const cacheKey = generateStatsCacheKey(userId);

    // Add cache metadata
    const cacheData = {
      ...stats,
      cached_at: new Date().toISOString(),
    };

    await kv.put(cacheKey, JSON.stringify(cacheData), {
      expirationTtl: STATS_CACHE_TTL,
    });

    console.log('[StatsCache] Cached stats for user:', userId);
  } catch (error) {
    console.error('[StatsCache] Error caching stats:', error);
  }
}

/**
 * Invalidate stats cache for a user
 *
 * Called after graph mutations to ensure fresh stats.
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function invalidateStatsCache(kv, userId) {
  try {
    const cacheKey = generateStatsCacheKey(userId);
    await kv.delete(cacheKey);
    console.log('[StatsCache] Invalidated stats cache for user:', userId);
  } catch (error) {
    console.error('[StatsCache] Error invalidating stats cache:', error);
  }
}

/**
 * Execute stats calculation with automatic caching
 *
 * Checks cache first, calculates on miss, caches result.
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {Function} calculateFn - Function that calculates stats (returns Promise<stats>)
 * @returns {Promise<Object>} Stats result with metadata
 */
export async function executeStatsWithCache(kv, userId, calculateFn) {
  const startTime = Date.now();

  // Try cache first
  const cached = await getCachedStats(kv, userId);

  if (cached) {
    return {
      data: cached,
      meta: {
        cached: true,
        query_time_ms: Date.now() - startTime,
        cache_age_seconds: Math.floor((Date.now() - new Date(cached.cached_at).getTime()) / 1000),
      },
    };
  }

  // Cache miss - calculate stats
  const stats = await calculateFn();

  // Cache the result (don't await - fire and forget)
  setCachedStats(kv, userId, stats).catch(err => {
    console.error('[StatsCache] Failed to cache stats:', err);
  });

  return {
    data: stats,
    meta: {
      cached: false,
      query_time_ms: Date.now() - startTime,
    },
  };
}

/**
 * Check if stats cache exists for a user
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if cache exists
 */
export async function hasCachedStats(kv, userId) {
  try {
    const cached = await getCachedStats(kv, userId);
    return cached !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Get cache TTL configuration
 *
 * @returns {number} TTL in seconds
 */
export function getCacheTTL() {
  return STATS_CACHE_TTL;
}
