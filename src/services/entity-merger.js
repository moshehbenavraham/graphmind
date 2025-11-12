/**
 * Entity Merger Service
 *
 * Handles entity deduplication through fuzzy matching and entity merging.
 * Preserves all relationships during merge operations.
 *
 * @module services/entity-merger
 */

import { buildMergeEntities } from '../lib/graph/cypher-builder.js';
import { mergeEntityProperties } from '../lib/graph/entity-mapper.js';

/**
 * Find duplicate entity candidates using fuzzy matching
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {Object} entity - Entity to check for duplicates
 * @param {number} threshold - Similarity threshold (0-1, default 0.85)
 * @returns {Promise<Array<Object>>} Duplicate candidates with confidence scores
 */
export async function findDuplicateCandidates(env, userId, entity, threshold = 0.85) {
  const candidates = [];

  // Get similar entities from D1 entity_cache
  const entityName = (entity.name || entity.entity_value).toLowerCase();
  const entityType = entity.entity_type;

  // Query entity_cache for same type
  const result = await env.DB.prepare(`
    SELECT cache_id, canonical_name, entity_type, entity_key
    FROM entity_cache
    WHERE user_id = ?
      AND entity_type = ?
      AND entity_key != ?
    ORDER BY updated_at DESC
    LIMIT 20
  `).bind(userId, entityType, (entity.name || entity.entity_value).toLowerCase()).all();

  for (const cached of result.results || []) {
    const cachedName = cached.canonical_name.toLowerCase();

    // Calculate similarity
    const similarity = calculateLevenshteinSimilarity(entityName, cachedName);

    if (similarity >= threshold) {
      candidates.push({
        entity_id: cached.cache_id,
        name: cached.canonical_name,
        type: cached.entity_type,
        similarity,
        confidence: similarity,
      });
    }
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  return candidates;
}

/**
 * Merge two entities in FalkorDB
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {string} sourceEntityId - Entity to merge from (will be deleted)
 * @param {string} targetEntityId - Entity to merge into (will be kept)
 * @param {string} strategy - Merge strategy ('prefer_source', 'prefer_target', 'combine')
 * @returns {Promise<Object>} Merge result
 */
export async function mergeEntities(env, userId, sourceEntityId, targetEntityId, strategy = 'prefer_target') {
  // Get both entities from FalkorDB
  const doId = env.FALKORDB_POOL.idFromName('pool');
  const doStub = env.FALKORDB_POOL.get(doId);

  // Fetch source and target entities
  const getEntityCypher = `
    MATCH (n {user_id: $user_id, entity_id: $entity_id})
    RETURN n
  `.trim();

  const [sourceResponse, targetResponse] = await Promise.all([
    doStub.fetch('http://do/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        cypher: getEntityCypher,
        params: { user_id: userId, entity_id: sourceEntityId },
        config: {
          host: env.FALKORDB_HOST,
          port: parseInt(env.FALKORDB_PORT),
          username: env.FALKORDB_USER,
          password: env.FALKORDB_PASSWORD,
        },
      }),
    }),
    doStub.fetch('http://do/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        cypher: getEntityCypher,
        params: { user_id: userId, entity_id: targetEntityId },
        config: {
          host: env.FALKORDB_HOST,
          port: parseInt(env.FALKORDB_PORT),
          username: env.FALKORDB_USER,
          password: env.FALKORDB_PASSWORD,
        },
      }),
    }),
  ]);

  if (!sourceResponse.ok || !targetResponse.ok) {
    throw new Error('Failed to fetch entities for merge');
  }

  const sourceResult = await sourceResponse.json();
  const targetResult = await targetResponse.json();

  if (!sourceResult.data || sourceResult.data.length === 0) {
    throw new Error(`Source entity not found: ${sourceEntityId}`);
  }

  if (!targetResult.data || targetResult.data.length === 0) {
    throw new Error(`Target entity not found: ${targetEntityId}`);
  }

  const sourceEntity = sourceResult.data[0][0];
  const targetEntity = targetResult.data[0][0];

  // Merge properties based on strategy
  const mergedProps = mergeEntityProperties(
    sourceEntity.properties || sourceEntity,
    targetEntity.properties || targetEntity,
    strategy
  );

  // Execute merge in FalkorDB (simplified - transfer relationships manually)
  // Note: FalkorDB doesn't support FOREACH with relationship types, so we use simpler approach
  const mergeSteps = [];

  // Step 1: Get all relationships from source
  const getRelsCypher = `
    MATCH (source {user_id: $user_id, entity_id: $source_entity_id})
    OPTIONAL MATCH (source)-[r]-(other)
    WHERE other.user_id = $user_id AND other.entity_id != $target_entity_id
    RETURN collect(DISTINCT {
      type: type(r),
      direction: CASE WHEN startNode(r) = source THEN 'OUT' ELSE 'IN' END,
      other_id: other.entity_id,
      props: properties(r)
    }) as relationships
  `.trim();

  const relsResponse = await doStub.fetch('http://do/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      cypher: getRelsCypher,
      params: {
        user_id: userId,
        source_entity_id: sourceEntityId,
        target_entity_id: targetEntityId,
      },
      config: {
        host: env.FALKORDB_HOST,
        port: parseInt(env.FALKORDB_PORT),
        username: env.FALKORDB_USER,
        password: env.FALKORDB_PASSWORD,
      },
    }),
  });

  const relsResult = await relsResponse.json();
  const relationships = relsResult.data?.[0]?.[0] || [];

  // Step 2: Create same relationships for target
  for (const rel of relationships) {
    let createRelCypher;
    if (rel.direction === 'OUT') {
      createRelCypher = `
        MATCH (target {user_id: $user_id, entity_id: $target_entity_id})
        MATCH (other {user_id: $user_id, entity_id: $other_id})
        MERGE (target)-[r:${rel.type}]->(other)
        SET r = $props
      `.trim();
    } else {
      createRelCypher = `
        MATCH (target {user_id: $user_id, entity_id: $target_entity_id})
        MATCH (other {user_id: $user_id, entity_id: $other_id})
        MERGE (other)-[r:${rel.type}]->(target)
        SET r = $props
      `.trim();
    }

    mergeSteps.push({
      cypher: createRelCypher,
      params: {
        user_id: userId,
        target_entity_id: targetEntityId,
        other_id: rel.other_id,
        props: rel.props,
      },
    });
  }

  // Step 3: Update target properties
  const updateTargetCypher = `
    MATCH (target {user_id: $user_id, entity_id: $target_entity_id})
    SET target += $merged_props
    RETURN target
  `.trim();

  mergeSteps.push({
    cypher: updateTargetCypher,
    params: {
      user_id: userId,
      target_entity_id: targetEntityId,
      merged_props: mergedProps,
    },
  });

  // Step 4: Delete source
  const deleteSourceCypher = `
    MATCH (source {user_id: $user_id, entity_id: $source_entity_id})
    DETACH DELETE source
  `.trim();

  mergeSteps.push({
    cypher: deleteSourceCypher,
    params: {
      user_id: userId,
      source_entity_id: sourceEntityId,
    },
  });

  // Execute all steps as batch
  const batchResponse = await doStub.fetch('http://do/execute-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      operations: mergeSteps,
      config: {
        host: env.FALKORDB_HOST,
        port: parseInt(env.FALKORDB_PORT),
        username: env.FALKORDB_USER,
        password: env.FALKORDB_PASSWORD,
      },
    }),
  });

  if (!batchResponse.ok) {
    const error = await batchResponse.text();
    throw new Error(`Merge failed: ${error}`);
  }

  // Update entity_cache in D1
  await env.DB.prepare(`
    DELETE FROM entity_cache
    WHERE user_id = ? AND entity_id = ?
  `).bind(userId, sourceEntityId).run();

  return {
    success: true,
    targetEntityId,
    sourceEntityId,
    relationshipsTransferred: relationships.length,
    mergedProperties: Object.keys(mergedProps).length,
  };
}

/**
 * Calculate Levenshtein similarity between two strings
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function calculateLevenshteinSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;

  // Handle empty strings
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  // Exact match
  if (str1 === str2) return 1;

  // Calculate Levenshtein distance
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  const similarity = 1 - distance / maxLen;

  return similarity;
}
