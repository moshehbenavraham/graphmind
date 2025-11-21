/**
 * Entity Cache D1 Query Helpers
 * Feature: 005-entity-extraction
 *
 * CRUD operations for entity_cache table in D1.
 * Handles entity resolution, fuzzy matching, and mention tracking.
 */

/**
 * Get entity from cache by entity key and user ID
 *
 * @param {Object} db - D1 database binding
 * @param {string} entityKey - Normalized entity key
 * @param {string} userId - User ID for isolation
 * @returns {Promise<Object|null>} Entity cache record or null
 */
export async function getEntityByKey(db, entityKey, userId) {
  const query = `
    SELECT
      cache_id,
      entity_key,
      user_id,
      canonical_name,
      entity_type,
      aliases,
      properties,
      confidence,
      first_mentioned_note_id,
      last_mentioned_note_id,
      mention_count,
      created_at,
      updated_at
    FROM entity_cache
    WHERE entity_key = ? AND user_id = ?
    LIMIT 1
  `;

  const result = await db.prepare(query).bind(entityKey, userId).first();

  if (!result) {
    return null;
  }

  // Parse JSON fields
  return {
    ...result,
    aliases: result.aliases ? JSON.parse(result.aliases) : [],
    properties: result.properties ? JSON.parse(result.properties) : {},
  };
}

/**
 * Get entity from cache by canonical name and user ID
 *
 * @param {Object} db - D1 database binding
 * @param {string} canonicalName - Canonical entity name
 * @param {string} userId - User ID for isolation
 * @returns {Promise<Object|null>} Entity cache record or null
 */
export async function getEntityByCanonicalName(db, canonicalName, userId) {
  const query = `
    SELECT
      cache_id,
      entity_key,
      user_id,
      canonical_name,
      entity_type,
      aliases,
      properties,
      confidence,
      first_mentioned_note_id,
      last_mentioned_note_id,
      mention_count,
      created_at,
      updated_at
    FROM entity_cache
    WHERE canonical_name = ? AND user_id = ?
    LIMIT 1
  `;

  const result = await db.prepare(query).bind(canonicalName, userId).first();

  if (!result) {
    return null;
  }

  return {
    ...result,
    aliases: result.aliases ? JSON.parse(result.aliases) : [],
    properties: result.properties ? JSON.parse(result.properties) : {},
  };
}

/**
 * Create new entity in cache
 *
 * @param {Object} db - D1 database binding
 * @param {Object} entity - Entity data
 * @param {string} entity.entityKey - Normalized entity key
 * @param {string} entity.userId - User ID
 * @param {string} entity.canonicalName - Canonical name
 * @param {string} entity.entityType - Entity type
 * @param {Array} entity.aliases - Alias array
 * @param {Object} entity.properties - Entity properties
 * @param {number} entity.confidence - Confidence score
 * @param {string} entity.noteId - Voice note ID
 * @returns {Promise<Object>} Created entity record
 */
export async function createEntity(db, entity) {
  const {
    entityKey,
    userId,
    canonicalName,
    entityType,
    aliases = [],
    properties = {},
    confidence,
    noteId,
  } = entity;

  const query = `
    INSERT INTO entity_cache (
      entity_key,
      user_id,
      canonical_name,
      entity_type,
      aliases,
      properties,
      confidence,
      first_mentioned_note_id,
      last_mentioned_note_id,
      mention_count,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING cache_id
  `;

  const result = await db
    .prepare(query)
    .bind(
      entityKey,
      userId,
      canonicalName,
      entityType,
      JSON.stringify(aliases),
      JSON.stringify(properties),
      confidence,
      noteId,
      noteId
    )
    .first();

  if (!result) {
    throw new Error('Failed to create entity in cache');
  }

  return {
    cache_id: result.cache_id,
    entity_key: entityKey,
    user_id: userId,
    canonical_name: canonicalName,
    entity_type: entityType,
    aliases,
    properties,
    confidence,
    first_mentioned_note_id: noteId,
    last_mentioned_note_id: noteId,
    mention_count: 1,
  };
}

/**
 * Update entity mention (increment count, update last mentioned)
 *
 * @param {Object} db - D1 database binding
 * @param {string} entityKey - Normalized entity key
 * @param {string} userId - User ID
 * @param {string} noteId - Voice note ID
 * @param {number} newConfidence - New confidence score (optional, updates if higher)
 * @returns {Promise<boolean>} True if updated successfully
 */
export async function updateEntityMention(db, entityKey, userId, noteId, newConfidence = null) {
  // If confidence provided, update if higher than current
  const confidenceUpdate = newConfidence !== null
    ? `, confidence = CASE WHEN ? > confidence THEN ? ELSE confidence END`
    : '';

  const query = `
    UPDATE entity_cache
    SET
      last_mentioned_note_id = ?,
      mention_count = mention_count + 1,
      updated_at = CURRENT_TIMESTAMP
      ${confidenceUpdate}
    WHERE entity_key = ? AND user_id = ?
  `;

  const bindings = newConfidence !== null
    ? [noteId, newConfidence, newConfidence, entityKey, userId]
    : [noteId, entityKey, userId];

  const result = await db.prepare(query).bind(...bindings).run();

  return result.success && result.meta.changes > 0;
}

/**
 * Update entity properties (merge new properties with existing)
 *
 * @param {Object} db - D1 database binding
 * @param {string} entityKey - Normalized entity key
 * @param {string} userId - User ID
 * @param {Object} newProperties - New properties to merge
 * @returns {Promise<boolean>} True if updated successfully
 */
export async function updateEntityProperties(db, entityKey, userId, newProperties) {
  // First get existing entity
  const entity = await getEntityByKey(db, entityKey, userId);
  if (!entity) {
    return false;
  }

  // Merge properties
  const mergedProperties = {
    ...entity.properties,
    ...newProperties,
  };

  const query = `
    UPDATE entity_cache
    SET
      properties = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE entity_key = ? AND user_id = ?
  `;

  const result = await db
    .prepare(query)
    .bind(JSON.stringify(mergedProperties), entityKey, userId)
    .run();

  return result.success && result.meta.changes > 0;
}

/**
 * Add alias to entity
 *
 * @param {Object} db - D1 database binding
 * @param {string} entityKey - Normalized entity key
 * @param {string} userId - User ID
 * @param {string} newAlias - New alias to add
 * @returns {Promise<boolean>} True if updated successfully
 */
export async function addEntityAlias(db, entityKey, userId, newAlias) {
  // Get existing entity
  const entity = await getEntityByKey(db, entityKey, userId);
  if (!entity) {
    return false;
  }

  // Add alias if not already present
  const aliases = Array.isArray(entity.aliases) ? entity.aliases : [];
  if (!aliases.includes(newAlias)) {
    aliases.push(newAlias);
  }

  const query = `
    UPDATE entity_cache
    SET
      aliases = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE entity_key = ? AND user_id = ?
  `;

  const result = await db
    .prepare(query)
    .bind(JSON.stringify(aliases), entityKey, userId)
    .run();

  return result.success && result.meta.changes > 0;
}

/**
 * Get all entities for a user by type
 *
 * @param {Object} db - D1 database binding
 * @param {string} userId - User ID
 * @param {string} entityType - Entity type filter (optional)
 * @param {number} limit - Max results (default: 100)
 * @returns {Promise<Array>} Array of entity records
 */
export async function getEntitiesByUser(db, userId, entityType = null, limit = 100) {
  let query = `
    SELECT
      cache_id,
      entity_key,
      user_id,
      canonical_name,
      entity_type,
      aliases,
      properties,
      confidence,
      first_mentioned_note_id,
      last_mentioned_note_id,
      mention_count,
      created_at,
      updated_at
    FROM entity_cache
    WHERE user_id = ?
  `;

  const bindings = [userId];

  if (entityType) {
    query += ` AND entity_type = ?`;
    bindings.push(entityType);
  }

  query += ` ORDER BY mention_count DESC, updated_at DESC LIMIT ?`;
  bindings.push(limit);

  const result = await db.prepare(query).bind(...bindings).all();

  return result.results.map(row => ({
    ...row,
    aliases: row.aliases ? JSON.parse(row.aliases) : [],
    properties: row.properties ? JSON.parse(row.properties) : {},
  }));
}

/**
 * Delete entity from cache (hard delete)
 *
 * @param {Object} db - D1 database binding
 * @param {string} entityKey - Normalized entity key
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteEntity(db, entityKey, userId) {
  const query = `
    DELETE FROM entity_cache
    WHERE entity_key = ? AND user_id = ?
  `;

  const result = await db.prepare(query).bind(entityKey, userId).run();

  return result.success && result.meta.changes > 0;
}

/**
 * Get entity mention statistics
 *
 * @param {Object} db - D1 database binding
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Statistics about entities
 */
export async function getEntityStats(db, userId) {
  const query = `
    SELECT
      COUNT(*) as total_entities,
      COUNT(DISTINCT entity_type) as unique_types,
      SUM(mention_count) as total_mentions,
      AVG(mention_count) as avg_mentions_per_entity,
      MAX(mention_count) as max_mentions
    FROM entity_cache
    WHERE user_id = ?
  `;

  const result = await db.prepare(query).bind(userId).first();

  return result || {
    total_entities: 0,
    unique_types: 0,
    total_mentions: 0,
    avg_mentions_per_entity: 0,
    max_mentions: 0,
  };
}
