/**
 * GraphRAG Service
 *
 * Core service for processing entities and building knowledge graph.
 * Handles entity-to-node mapping, relationship inference, and graph updates.
 *
 * @module services/graph-rag
 */

import { mapEntitiesToNodes, extractEntityContext, filterEntitiesByConfidence } from '../lib/graph/entity-mapper.js';
import { inferRelationships } from '../lib/graph/relationship-inferrer.js';
import { buildMergeNode, buildCreateRelationship } from '../lib/graph/cypher-builder.js';
import { findDuplicateCandidates, mergeEntities } from './entity-merger.js';

/**
 * Process entities from a voice note and create graph nodes/relationships
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {Array<Object>} entities - Extracted entities from Feature 005
 * @param {string} transcript - Voice note transcript
 * @returns {Promise<Object>} Processing results
 */
export async function processEntities(env, userId, entities, transcript) {
  const startTime = Date.now();

  console.log('[GraphRAG] ========== PROCESS ENTITIES START ==========');
  console.log('[GraphRAG] Input entities count:', entities.length);
  console.log('[GraphRAG] Input entities:', JSON.stringify(entities).substring(0, 500));
  console.log('[GraphRAG] User ID:', userId);
  console.log('[GraphRAG] Transcript length:', transcript?.length || 0);

  // Filter by confidence threshold
  const validEntities = filterEntitiesByConfidence(entities, 0.7);
  console.log('[GraphRAG] Valid entities after filtering:', validEntities.length);
  console.log('[GraphRAG] Filtered entities:', JSON.stringify(validEntities).substring(0, 500));

  if (validEntities.length === 0) {
    return {
      nodesCreated: 0,
      nodesUpdated: 0,
      relationshipsCreated: 0,
      entitiesMerged: 0,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Map entities to nodes
  const nodes = mapEntitiesToNodes(validEntities);
  console.log('[GraphRAG] Mapped nodes:', nodes.length);

  // Check for duplicates and auto-merge (US2 - Entity Deduplication)
  const mergedEntities = await checkAndMergeDuplicates(env, userId, validEntities);
  console.log('[GraphRAG] Entities merged:', mergedEntities);

  // Extract entity context for relationship inference
  const entityContext = extractEntityContext(transcript, validEntities);

  // Infer relationships
  const relationships = await inferRelationships(env.AI, validEntities, transcript, entityContext);
  console.log('[GraphRAG] Inferred relationships:', relationships.length);

  // Create nodes in FalkorDB
  console.log('[GraphRAG] About to create nodes in FalkorDB, count:', nodes.length);
  const nodeResults = await createNodes(env, userId, nodes);
  console.log('[GraphRAG] Nodes created successfully:', nodeResults);

  // Create relationships in FalkorDB
  console.log('[GraphRAG] About to create relationships in FalkorDB, count:', relationships.length);
  const relResults = await createRelationships(env, userId, relationships);
  console.log('[GraphRAG] Relationships created successfully:', relResults);

  const processingTimeMs = Date.now() - startTime;

  console.log('[GraphRAG] Processing complete:', {
    nodesCreated: nodeResults.created,
    nodesUpdated: nodeResults.updated,
    relationshipsCreated: relResults.created,
    processingTimeMs,
  });

  return {
    nodesCreated: nodeResults.created,
    nodesUpdated: nodeResults.updated,
    relationshipsCreated: relResults.created,
    entitiesMerged: mergedEntities,
    entityMappings: nodeResults.mappings,
    relationshipsData: relResults.relationships,
    processingTimeMs,
  };
}

/**
 * Check for duplicate entities and automatically merge (US2 feature)
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {Array<Object>} entities - Entities to check
 * @returns {Promise<number>} Number of entities merged
 */
async function checkAndMergeDuplicates(env, userId, entities) {
  let mergedCount = 0;

  for (const entity of entities) {
    try {
      // Find duplicate candidates
      const candidates = await findDuplicateCandidates(env, userId, entity, 0.85);

      if (candidates.length > 0 && candidates[0].confidence >= 0.85) {
        const duplicate = candidates[0];

        console.log('[GraphRAG] Auto-merging duplicate:', {
          source: entity.entity_id,
          target: duplicate.entity_id,
          confidence: duplicate.confidence,
        });

        // Auto-merge with high confidence
        await mergeEntities(env, userId, entity.entity_id, duplicate.entity_id, 'combine');
        mergedCount++;
      }
    } catch (error) {
      console.error('[GraphRAG] Duplicate check failed for entity:', entity.entity_id, error);
      // Continue processing other entities
    }
  }

  return mergedCount;
}

/**
 * Create nodes in FalkorDB
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {Array<Object>} nodes - Nodes to create
 * @returns {Promise<Object>} {created, updated, mappings}
 */
async function createNodes(env, userId, nodes) {
  console.log('[GraphRAG] createNodes() called with', nodes.length, 'nodes');
  let created = 0;
  let updated = 0;
  const mappings = {};

  // Get Durable Object stub
  console.log('[GraphRAG] Getting Durable Object stub...');
  const doId = env.FALKORDB_POOL.idFromName('pool');
  const doStub = env.FALKORDB_POOL.get(doId);
  console.log('[GraphRAG] Durable Object stub obtained');

  // Batch process nodes (10 at a time)
  const batchSize = 10;
  for (let i = 0; i < nodes.length; i += batchSize) {
    const batch = nodes.slice(i, i + batchSize);
    console.log(`[GraphRAG] Processing batch ${i / batchSize + 1}, size:`, batch.length);

    const operations = batch.map(node => {
      const { cypher, params } = buildMergeNode(
        node.nodeType,
        node.entityId,
        node.properties,
        node.properties // Use same properties for update
      );

      console.log('[GraphRAG] Built operation:', {
        nodeType: node.nodeType,
        entityId: node.entityId,
        cypher: cypher.substring(0, 150),
        params: JSON.stringify(params).substring(0, 200)
      });
      return { cypher, params };
    });

    console.log('[GraphRAG] About to call DO execute-batch with operations:', operations.length);

    // Execute batch via Durable Object
    const response = await doStub.fetch('http://do/execute-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        operations,
        config: {
          host: env.FALKORDB_HOST,
          port: parseInt(env.FALKORDB_PORT),
          username: env.FALKORDB_USER,
          password: env.FALKORDB_PASSWORD,
        },
      }),
    });

    console.log('[GraphRAG] DO execute-batch response status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.error('[GraphRAG] Batch node creation failed:', error);
      // THROW error instead of continuing - allows queue consumer to retry
      throw new Error(`Failed to create nodes in batch ${i + 1}: ${error}`);
    }

    console.log('[GraphRAG] About to parse JSON response...');
    const results = await response.json();
    console.log('[GraphRAG] Parsed results count:', results.length);
    console.log('[GraphRAG] First result sample:', JSON.stringify(results[0], null, 2).substring(0, 500));

    // Track mappings and counts
    for (let j = 0; j < batch.length; j++) {
      const node = batch[j];
      const result = results[j];

      // Check if node was created or updated (based on Cypher result)
      // FalkorDB returns statistics in result.statistics (parsed from strings like "Nodes created: 1")
      const wasCreated = result?.statistics?.nodes_created > 0;
      const wasUpdated = !wasCreated && (result?.statistics?.properties_set > 0 || result?.data?.length > 0);

      if (wasCreated) {
        created++;
      } else if (wasUpdated) {
        updated++;
      }

      // Store mapping (entity_id -> node properties)
      mappings[node.entityId] = {
        nodeType: node.nodeType,
        name: node.properties.name,
      };
    }
  }

  console.log('[GraphRAG] createNodes() complete, returning:', { created, updated, mappingsCount: Object.keys(mappings).length });
  return { created, updated, mappings };
}

/**
 * Create relationships in FalkorDB
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {Array<Object>} relationships - Relationships to create
 * @returns {Promise<Object>} {created, relationships}
 */
async function createRelationships(env, userId, relationships) {
  let created = 0;
  const relationshipsData = [];

  if (relationships.length === 0) {
    return { created, relationships: relationshipsData };
  }

  // Get Durable Object stub
  const doId = env.FALKORDB_POOL.idFromName('pool');
  const doStub = env.FALKORDB_POOL.get(doId);

  // Batch process relationships (10 at a time)
  const batchSize = 10;
  for (let i = 0; i < relationships.length; i += batchSize) {
    const batch = relationships.slice(i, i + batchSize);

    const operations = batch.map(rel => {
      const { cypher, params } = buildCreateRelationship(
        rel.fromEntityId,
        rel.toEntityId,
        rel.relType,
        rel.properties
      );

      return { cypher, params };
    });

    // Execute batch via Durable Object
    const response = await doStub.fetch('http://do/execute-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        operations,
        config: {
          host: env.FALKORDB_HOST,
          port: parseInt(env.FALKORDB_PORT),
          username: env.FALKORDB_USER,
          password: env.FALKORDB_PASSWORD,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[GraphRAG] Batch relationship creation failed:', error);
      // THROW error instead of continuing - allows queue consumer to retry
      throw new Error(`Failed to create relationships in batch ${i + 1}: ${error}`);
    }

    const results = await response.json();

    // Track successful creations
    for (let j = 0; j < batch.length; j++) {
      const rel = batch[j];
      const result = results[j];

      // Check statistics for relationship creation (FalkorDB returns "Relationships created: 1")
      if (result?.statistics?.relationships_created > 0) {
        created++;
        relationshipsData.push({
          from_node_id: rel.fromEntityId,
          to_node_id: rel.toEntityId,
          rel_type: rel.relType,
        });
      }
    }
  }

  return { created, relationships: relationshipsData };
}

/**
 * Update an existing node in FalkorDB
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {string} entityId - Entity ID
 * @param {Object} properties - Properties to update
 * @returns {Promise<boolean>} Success
 */
export async function updateNode(env, userId, entityId, properties) {
  const doId = env.FALKORDB_POOL.idFromName('pool');
  const doStub = env.FALKORDB_POOL.get(doId);

  const cypher = `
    MATCH (n {user_id: $user_id, entity_id: $entity_id})
    SET n += $properties
    RETURN n
  `.trim();

  const response = await doStub.fetch('http://do/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      cypher,
      params: { entity_id: entityId, properties },
      config: {
        host: env.FALKORDB_HOST,
        port: parseInt(env.FALKORDB_PORT),
        username: env.FALKORDB_USER,
        password: env.FALKORDB_PASSWORD,
      },
    }),
  });

  return response.ok;
}

/**
 * Create a single relationship in FalkorDB
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {string} fromEntityId - Source entity ID
 * @param {string} toEntityId - Target entity ID
 * @param {string} relType - Relationship type
 * @param {Object} properties - Relationship properties
 * @returns {Promise<boolean>} Success
 */
export async function createRelationship(env, userId, fromEntityId, toEntityId, relType, properties = {}) {
  const doId = env.FALKORDB_POOL.idFromName('pool');
  const doStub = env.FALKORDB_POOL.get(doId);

  const { cypher, params } = buildCreateRelationship(fromEntityId, toEntityId, relType, properties);

  const response = await doStub.fetch('http://do/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      cypher,
      params,
      config: {
        host: env.FALKORDB_HOST,
        port: parseInt(env.FALKORDB_PORT),
        username: env.FALKORDB_USER,
        password: env.FALKORDB_PASSWORD,
      },
    }),
  });

  return response.ok;
}
