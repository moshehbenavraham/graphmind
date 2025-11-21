/**
 * Entity Cache KV Utilities
 * Feature: 005-entity-extraction
 *
 * KV cache operations for entity resolution.
 * Provides fast lookups to avoid redundant D1 queries.
 */

/**
 * KV Key Patterns
 */
export const KV_KEY_PATTERNS = {
  ENTITY_RESOLVE: (userId, entityKey) => `entity:resolve:${userId}:${entityKey}`,
  EXTRACTION_JOB: (noteId) => `entity:extraction:${noteId}`,
  CACHE_STATS: (userId) => `entity:cache-stats:${userId}`,
};

/**
 * Default TTL values (in seconds)
 */
export const DEFAULT_TTL = {
  ENTITY_RESOLVE: 3600,      // 1 hour
  EXTRACTION_JOB: 300,       // 5 minutes
  CACHE_STATS: 86400,        // 24 hours
};

/**
 * Get entity from KV cache
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} entityKey - Normalized entity key
 * @returns {Promise<Object|null>} Cached entity or null
 */
export async function getEntityFromCache(kv, userId, entityKey) {
  const key = KV_KEY_PATTERNS.ENTITY_RESOLVE(userId, entityKey);

  try {
    const cached = await kv.get(key, 'json');
    if (cached) {
      // Update cache hit stats
      await incrementCacheHit(kv, userId);
    } else {
      // Update cache miss stats
      await incrementCacheMiss(kv, userId);
    }
    return cached;
  } catch (error) {
    console.error('Error getting entity from KV cache:', error);
    return null;
  }
}

/**
 * Store entity in KV cache
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} entityKey - Normalized entity key
 * @param {Object} entityData - Entity data to cache
 * @param {number} ttl - TTL in seconds (optional)
 * @returns {Promise<boolean>} True if stored successfully
 */
export async function setEntityInCache(kv, userId, entityKey, entityData, ttl = DEFAULT_TTL.ENTITY_RESOLVE) {
  const key = KV_KEY_PATTERNS.ENTITY_RESOLVE(userId, entityKey);

  try {
    await kv.put(key, JSON.stringify(entityData), {
      expirationTtl: ttl,
    });
    return true;
  } catch (error) {
    console.error('Error setting entity in KV cache:', error);
    return false;
  }
}

/**
 * Invalidate entity cache entry
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {string} entityKey - Normalized entity key
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function invalidateEntityCache(kv, userId, entityKey) {
  const key = KV_KEY_PATTERNS.ENTITY_RESOLVE(userId, entityKey);

  try {
    await kv.delete(key);
    return true;
  } catch (error) {
    console.error('Error invalidating entity cache:', error);
    return false;
  }
}

/**
 * Get extraction job status from KV
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} noteId - Voice note ID
 * @returns {Promise<Object|null>} Job status or null
 */
export async function getExtractionJobStatus(kv, noteId) {
  const key = KV_KEY_PATTERNS.EXTRACTION_JOB(noteId);

  try {
    return await kv.get(key, 'json');
  } catch (error) {
    console.error('Error getting extraction job status:', error);
    return null;
  }
}

/**
 * Set extraction job status in KV
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} noteId - Voice note ID
 * @param {Object} status - Job status data
 * @param {number} ttl - TTL in seconds (optional)
 * @returns {Promise<boolean>} True if stored successfully
 */
export async function setExtractionJobStatus(kv, noteId, status, ttl = DEFAULT_TTL.EXTRACTION_JOB) {
  const key = KV_KEY_PATTERNS.EXTRACTION_JOB(noteId);

  try {
    await kv.put(key, JSON.stringify({
      ...status,
      note_id: noteId,
      updated_at: Date.now(),
    }), {
      expirationTtl: ttl,
    });
    return true;
  } catch (error) {
    console.error('Error setting extraction job status:', error);
    return false;
  }
}

/**
 * Get cache statistics for user
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Cache statistics
 */
export async function getCacheStats(kv, userId) {
  const key = KV_KEY_PATTERNS.CACHE_STATS(userId);

  try {
    const stats = await kv.get(key, 'json');
    return stats || {
      hits: 0,
      misses: 0,
      hit_rate: 0,
      last_updated: Date.now(),
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      hits: 0,
      misses: 0,
      hit_rate: 0,
      last_updated: Date.now(),
    };
  }
}

/**
 * Increment cache hit counter
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function incrementCacheHit(kv, userId) {
  try {
    const stats = await getCacheStats(kv, userId);
    stats.hits = (stats.hits || 0) + 1;
    stats.hit_rate = calculateHitRate(stats.hits, stats.misses);
    stats.last_updated = Date.now();

    const key = KV_KEY_PATTERNS.CACHE_STATS(userId);
    await kv.put(key, JSON.stringify(stats), {
      expirationTtl: DEFAULT_TTL.CACHE_STATS,
    });
  } catch (error) {
    console.error('Error incrementing cache hit:', error);
  }
}

/**
 * Increment cache miss counter
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function incrementCacheMiss(kv, userId) {
  try {
    const stats = await getCacheStats(kv, userId);
    stats.misses = (stats.misses || 0) + 1;
    stats.hit_rate = calculateHitRate(stats.hits, stats.misses);
    stats.last_updated = Date.now();

    const key = KV_KEY_PATTERNS.CACHE_STATS(userId);
    await kv.put(key, JSON.stringify(stats), {
      expirationTtl: DEFAULT_TTL.CACHE_STATS,
    });
  } catch (error) {
    console.error('Error incrementing cache miss:', error);
  }
}

/**
 * Calculate cache hit rate
 *
 * @param {number} hits - Number of cache hits
 * @param {number} misses - Number of cache misses
 * @returns {number} Hit rate (0.0 - 1.0)
 */
function calculateHitRate(hits, misses) {
  const total = hits + misses;
  if (total === 0) return 0;
  return parseFloat((hits / total).toFixed(3));
}

/**
 * Reset cache statistics for user
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if reset successfully
 */
export async function resetCacheStats(kv, userId) {
  const key = KV_KEY_PATTERNS.CACHE_STATS(userId);

  try {
    await kv.put(key, JSON.stringify({
      hits: 0,
      misses: 0,
      hit_rate: 0,
      last_updated: Date.now(),
    }), {
      expirationTtl: DEFAULT_TTL.CACHE_STATS,
    });
    return true;
  } catch (error) {
    console.error('Error resetting cache stats:', error);
    return false;
  }
}

/**
 * Bulk invalidate all entity cache entries for a user
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of keys deleted (note: KV doesn't support prefix delete, returns 0)
 */
export async function invalidateAllUserEntities(kv, userId) {
  // Note: KV doesn't support prefix-based bulk delete
  // This is a placeholder - in production, would need to track keys separately
  console.warn('KV bulk delete not supported - invalidateAllUserEntities is a no-op');
  return 0;
}

/**
 * Warm cache with entity data (pre-populate after D1 query)
 *
 * @param {Object} kv - KV namespace binding
 * @param {string} userId - User ID
 * @param {Array} entities - Array of entities to cache
 * @returns {Promise<number>} Number of entities cached
 */
export async function warmCache(kv, userId, entities) {
  if (!Array.isArray(entities)) {
    return 0;
  }

  let cached = 0;

  for (const entity of entities) {
    if (entity.entity_key && entity.canonical_name) {
      const success = await setEntityInCache(kv, userId, entity.entity_key, {
        canonical_name: entity.canonical_name,
        entity_type: entity.entity_type,
        properties: entity.properties || {},
        aliases: entity.aliases || [],
      });
      if (success) cached++;
    }
  }

  return cached;
}
