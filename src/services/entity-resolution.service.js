/**
 * Entity Resolution Service
 * Feature: 005-entity-extraction
 *
 * Resolves entities to canonical names using fuzzy matching, KV cache, and D1 entity_cache.
 * Handles entity creation, updating, and alias matching.
 */

import { generateEntityKey, generateAliases } from '../lib/entity-utils/entity-key-generator.js';
import { getEntityFromCache, setEntityInCache } from '../lib/kv/entity-cache-utils.js';
import {
  getEntityByKey,
  createEntity,
  updateEntityMention,
  addEntityAlias,
} from '../lib/db/entity-cache-queries.js';

/**
 * Resolve entity to canonical name (with caching)
 *
 * @param {Object} env - Worker environment bindings (DB, KV)
 * @param {string} userId - User ID for data isolation
 * @param {Object} entity - Entity to resolve
 * @param {string} noteId - Current note ID
 * @returns {Promise<Object>} Resolved entity with canonical name
 */
export async function resolveEntity(env, userId, entity, noteId) {
  if (!entity.name || !entity.type) {
    throw new Error('Entity must have name and type');
  }

  // Step 1: Generate entity key for fuzzy matching
  const entityKey = generateEntityKey(entity.name);

  // Step 2: Check KV cache
  const cached = await getEntityFromCache(env.KV, userId, entityKey);
  if (cached) {
    // Cache hit! Update mention in D1 and return canonical name
    await updateEntityMention(env.DB, entityKey, userId, noteId, entity.confidence);

    return {
      ...entity,
      canonical_name: cached.canonical_name,
      entity_key: entityKey,
      cache_hit: true,
    };
  }

  // Step 3: Check D1 entity_cache
  const dbEntity = await getEntityByKey(env.DB, entityKey, userId);

  if (dbEntity) {
    // Cache miss, but entity exists in D1
    // Update mention count and last mentioned
    await updateEntityMention(env.DB, entityKey, userId, noteId, entity.confidence);

    // Update KV cache for future lookups (cache warming)
    await setEntityInCache(env.KV, userId, entityKey, {
      canonical_name: dbEntity.canonical_name,
      entity_type: dbEntity.entity_type,
      properties: dbEntity.properties,
      aliases: dbEntity.aliases,
    });

    return {
      ...entity,
      canonical_name: dbEntity.canonical_name,
      entity_key: entityKey,
      cache_hit: false,
      db_hit: true,
    };
  }

  // Step 4: Entity not found - create new entity
  const aliases = generateAliases(entity.name);

  const newEntity = await createEntity(env.DB, {
    entityKey,
    userId,
    canonicalName: entity.name, // Use extracted name as canonical
    entityType: entity.type,
    aliases,
    properties: entity.properties || {},
    confidence: entity.confidence,
    noteId,
  });

  // Add to KV cache
  await setEntityInCache(env.KV, userId, entityKey, {
    canonical_name: newEntity.canonical_name,
    entity_type: newEntity.entity_type,
    properties: newEntity.properties,
    aliases: newEntity.aliases,
  });

  return {
    ...entity,
    canonical_name: newEntity.canonical_name,
    entity_key: entityKey,
    cache_hit: false,
    db_hit: false,
    new_entity: true,
  };
}

/**
 * Resolve multiple entities in batch
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {Array} entities - Array of entities to resolve
 * @param {string} noteId - Current note ID
 * @returns {Promise<Array>} Array of resolved entities
 */
export async function resolveEntitiesBatch(env, userId, entities, noteId) {
  if (!Array.isArray(entities)) {
    throw new Error('Entities must be an array');
  }

  const resolved = [];

  for (const entity of entities) {
    try {
      const resolvedEntity = await resolveEntity(env, userId, entity, noteId);
      resolved.push(resolvedEntity);
    } catch (error) {
      console.error(`Failed to resolve entity "${entity.name}":`, error);
      // Include entity with error flag rather than failing entire batch
      resolved.push({
        ...entity,
        resolution_error: error.message,
      });
    }
  }

  return resolved;
}

/**
 * Find entity by alias (fuzzy matching)
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {string} aliasName - Alias to match
 * @returns {Promise<Object|null>} Matched entity or null
 */
export async function findEntityByAlias(env, userId, aliasName) {
  const entityKey = generateEntityKey(aliasName);

  // Check KV cache first
  const cached = await getEntityFromCache(env.KV, userId, entityKey);
  if (cached) {
    return cached;
  }

  // Check D1 entity_cache
  const dbEntity = await getEntityByKey(env.DB, entityKey, userId);
  if (dbEntity) {
    // Warm cache
    await setEntityInCache(env.KV, userId, entityKey, {
      canonical_name: dbEntity.canonical_name,
      entity_type: dbEntity.entity_type,
      properties: dbEntity.properties,
      aliases: dbEntity.aliases,
    });
    return dbEntity;
  }

  // TODO: Future enhancement - fuzzy search across all aliases in D1
  // For now, exact key match only
  return null;
}

/**
 * Add alias to existing entity
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {string} entityKey - Entity key
 * @param {string} newAlias - New alias to add
 * @returns {Promise<boolean>} True if alias added successfully
 */
export async function addAlias(env, userId, entityKey, newAlias) {
  if (!newAlias || typeof newAlias !== 'string') {
    throw new Error('Alias must be a non-empty string');
  }

  // Add alias to D1
  const success = await addEntityAlias(env.DB, entityKey, userId, newAlias);

  if (success) {
    // Invalidate KV cache to force refresh
    const cached = await getEntityFromCache(env.KV, userId, entityKey);
    if (cached) {
      // Re-fetch from D1 and update cache
      const dbEntity = await getEntityByKey(env.DB, entityKey, userId);
      if (dbEntity) {
        await setEntityInCache(env.KV, userId, entityKey, {
          canonical_name: dbEntity.canonical_name,
          entity_type: dbEntity.entity_type,
          properties: dbEntity.properties,
          aliases: dbEntity.aliases,
        });
      }
    }
  }

  return success;
}

/**
 * Get resolution statistics
 *
 * @param {Array} resolvedEntities - Array of resolved entities
 * @returns {Object} Resolution statistics
 */
export function getResolutionStats(resolvedEntities) {
  if (!Array.isArray(resolvedEntities)) {
    return {
      total: 0,
      cache_hits: 0,
      db_hits: 0,
      new_entities: 0,
      errors: 0,
      cache_hit_rate: 0,
    };
  }

  const stats = {
    total: resolvedEntities.length,
    cache_hits: resolvedEntities.filter(e => e.cache_hit).length,
    db_hits: resolvedEntities.filter(e => e.db_hit).length,
    new_entities: resolvedEntities.filter(e => e.new_entity).length,
    errors: resolvedEntities.filter(e => e.resolution_error).length,
  };

  stats.cache_hit_rate = stats.total > 0
    ? parseFloat((stats.cache_hits / stats.total).toFixed(3))
    : 0;

  return stats;
}

/**
 * Merge entity properties (combine existing and new properties)
 *
 * @param {Object} existing - Existing entity properties
 * @param {Object} newProps - New properties to merge
 * @returns {Object} Merged properties
 */
export function mergeEntityProperties(existing, newProps) {
  if (!existing || typeof existing !== 'object') {
    return newProps || {};
  }

  if (!newProps || typeof newProps !== 'object') {
    return existing;
  }

  // Deep merge (simple version - shallow merge for nested objects)
  return {
    ...existing,
    ...newProps,
  };
}
