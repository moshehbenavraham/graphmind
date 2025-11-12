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

/**
 * Calculate similarity between two entity names (exported for testing)
 * Uses hybrid approach: token matching + Levenshtein
 *
 * @param {string} name1 - First entity name
 * @param {string} name2 - Second entity name
 * @returns {number} Similarity score (0-1)
 */
export function calculateSimilarity(name1, name2) {
  const normalized1 = (name1 || '').toLowerCase().trim();
  const normalized2 = (name2 || '').toLowerCase().trim();

  // Exact match
  if (normalized1 === normalized2) return 1.0;

  // Remove common prefixes/suffixes
  const cleanedName1 = removeCommonPrefixes(normalized1);
  const cleanedName2 = removeCommonPrefixes(normalized2);

  // Token-based matching (better for names)
  const tokenSim = calculateTokenSimilarity(cleanedName1, cleanedName2);

  // Levenshtein distance (character-level)
  const levSim = calculateLevenshteinSimilarity(cleanedName1, cleanedName2);

  // Hybrid: weight token matching more heavily (70/30)
  const hybrid = tokenSim * 0.7 + levSim * 0.3;

  return hybrid;
}

/**
 * Remove common prefixes and suffixes
 */
function removeCommonPrefixes(name) {
  const prefixes = ['dr.', 'mr.', 'mrs.', 'ms.', 'prof.', 'dr', 'mr', 'mrs', 'ms', 'prof'];
  const suffixes = ['corporation', 'corp', 'corp.', 'inc', 'inc.', 'ltd', 'ltd.', 'llc', 'llc.', 'company', 'co', 'co.', 'project', 'city'];

  let cleaned = name;

  // Remove prefixes
  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix + ' ')) {
      cleaned = cleaned.substring(prefix.length + 1).trim();
    }
  }

  // Remove suffixes
  for (const suffix of suffixes) {
    if (cleaned.endsWith(' ' + suffix)) {
      cleaned = cleaned.substring(0, cleaned.length - suffix.length - 1).trim();
    }
  }

  return cleaned;
}

/**
 * Calculate token-based similarity (better for names with abbreviations)
 */
function calculateTokenSimilarity(name1, name2) {
  const tokens1 = name1.split(/\s+/).filter(t => t.length > 0);
  const tokens2 = name2.split(/\s+/).filter(t => t.length > 0);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  let matchCount = 0;
  let totalTokens = Math.max(tokens1.length, tokens2.length);

  // Track which tokens in tokens2 have been matched
  const matched2 = new Set();

  // Check for token matches (including abbreviations)
  for (const token1 of tokens1) {
    for (let i = 0; i < tokens2.length; i++) {
      if (!matched2.has(i) && tokensMatch(token1, tokens2[i])) {
        matchCount++;
        matched2.add(i);
        break;
      }
    }
  }

  // Bonus: if one has more tokens but all of the shorter match, score higher
  const minTokens = Math.min(tokens1.length, tokens2.length);
  if (matchCount >= minTokens) {
    // All tokens from shorter name matched
    return 0.9 + (0.1 * (matchCount / totalTokens));
  }

  return matchCount / totalTokens;
}

/**
 * Check if two tokens match (handles abbreviations)
 */
function tokensMatch(token1, token2) {
  // Exact match
  if (token1 === token2) return true;

  // Abbreviation match (e.g., "j." matches "john")
  if (token1.endsWith('.') && token2.startsWith(token1.charAt(0))) return true;
  if (token2.endsWith('.') && token1.startsWith(token2.charAt(0))) return true;

  // Initial match (e.g., "j" matches "john")
  if (token1.length === 1 && token2.startsWith(token1)) return true;
  if (token2.length === 1 && token1.startsWith(token2)) return true;

  // Substring match for longer tokens
  if (token1.length >= 3 && token2.length >= 3) {
    if (token1.includes(token2) || token2.includes(token1)) return true;
  }

  // Levenshtein similarity for close matches
  const levSim = calculateLevenshteinSimilarity(token1, token2);
  return levSim >= 0.85;
}

/**
 * Check if two entity names match using fuzzy matching
 *
 * @param {string} name1 - First entity name
 * @param {string} name2 - Second entity name
 * @param {number} threshold - Similarity threshold (default 0.85)
 * @returns {boolean} True if entities match
 */
export function fuzzyMatch(name1, name2, threshold = 0.85) {
  return calculateSimilarity(name1, name2) >= threshold;
}
