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
import { createLogger, createPerformanceTracker } from '../lib/utils/logger.js';

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
  // T138: Structured logging for GraphRAG service
  const logger = createLogger('GraphRAG', { userId, operation: 'processEntities' });
  const perfTracker = createPerformanceTracker('processEntities', logger);

  logger.info('Process entities started', {
    input_entities_count: entities.length,
    transcript_length: transcript?.length || 0,
    entities_sample: JSON.stringify(entities.slice(0, 3)),
  });

  perfTracker.checkpoint('start');

  // Filter by confidence threshold
  const validEntities = filterEntitiesByConfidence(entities, 0.7);
  perfTracker.checkpoint('filter_entities', {
    valid_count: validEntities.length,
    filtered_out: entities.length - validEntities.length,
  });

  logger.info('Entities filtered by confidence', {
    input_count: entities.length,
    valid_count: validEntities.length,
    threshold: 0.7,
  });

  if (validEntities.length === 0) {
    logger.info('No valid entities to process, skipping graph update');
    perfTracker.complete(true, { reason: 'no_valid_entities' });
    return {
      nodesCreated: 0,
      nodesUpdated: 0,
      relationshipsCreated: 0,
      entitiesMerged: 0,
      processingTimeMs: perfTracker.complete(true).total_time_ms,
    };
  }

  // Map entities to nodes
  const nodes = mapEntitiesToNodes(validEntities);
  perfTracker.checkpoint('map_entities_to_nodes', { nodes_count: nodes.length });
  logger.info('Entities mapped to nodes', { nodes_count: nodes.length });

  // Check for duplicates and auto-merge (US2 - Entity Deduplication)
  const mergedEntities = await checkAndMergeDuplicates(env, userId, validEntities);
  perfTracker.checkpoint('check_duplicates', { merged_count: mergedEntities });
  logger.info('Duplicate check complete', { entities_merged: mergedEntities });

  // Extract entity context for relationship inference
  const entityContext = extractEntityContext(transcript, validEntities);
  perfTracker.checkpoint('extract_context');

  // Infer relationships
  const relationships = await inferRelationships(env.AI, validEntities, transcript, entityContext);
  perfTracker.checkpoint('infer_relationships', { relationships_count: relationships.length });
  logger.info('Relationships inferred', { count: relationships.length });

  // Transaction-like processing with rollback support (T135)
  let nodeResults = null;
  let relResults = null;
  const createdNodeIds = [];

  try {
    // Create nodes in FalkorDB
    logger.info('Creating nodes in FalkorDB', { count: nodes.length });
    nodeResults = await createNodes(env, userId, nodes);
    perfTracker.checkpoint('create_nodes', {
      created: nodeResults.created,
      updated: nodeResults.updated,
    });
    logger.info('Nodes created successfully', nodeResults);

    // Track created node IDs for potential rollback
    Object.keys(nodeResults.mappings || {}).forEach(id => createdNodeIds.push(id));

    // Create relationships in FalkorDB
    logger.info('Creating relationships in FalkorDB', { count: relationships.length });
    relResults = await createRelationships(env, userId, relationships);
    perfTracker.checkpoint('create_relationships', { created: relResults.created });
    logger.info('Relationships created successfully', relResults);

  } catch (error) {
    logger.error('Transaction failed, attempting rollback', error, {
      nodes_to_rollback: createdNodeIds.length,
    });

    // Attempt rollback: Delete any created nodes (relationships will cascade delete)
    if (createdNodeIds.length > 0) {
      try {
        await rollbackNodes(env, userId, createdNodeIds);
        logger.warn('Rollback successful', {
          nodes_deleted: createdNodeIds.length,
        });
      } catch (rollbackError) {
        logger.error('Rollback failed', rollbackError);
        // Log but don't throw - original error is more important
      }
    }

    perfTracker.complete(false, { error: error.message });
    // Re-throw original error for queue retry logic
    throw error;
  }

  const metrics = perfTracker.complete(true, {
    nodes_created: nodeResults.created,
    nodes_updated: nodeResults.updated,
    relationships_created: relResults.created,
    entities_merged: mergedEntities,
  });

  logger.info('Processing complete', {
    nodes_created: nodeResults.created,
    nodes_updated: nodeResults.updated,
    relationships_created: relResults.created,
    entities_merged: mergedEntities,
    total_time_ms: metrics.total_time_ms,
  });

  return {
    nodesCreated: nodeResults.created,
    nodesUpdated: nodeResults.updated,
    relationshipsCreated: relResults.created,
    entitiesMerged: mergedEntities,
    entityMappings: nodeResults.mappings,
    relationshipsData: relResults.relationships,
    processingTimeMs: metrics.total_time_ms,
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

/**
 * Rollback transaction by deleting created nodes (T135 - Transaction rollback)
 *
 * Used when graph update fails partway through to maintain consistency.
 * Deletes nodes created during failed transaction (relationships cascade delete).
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {Array<string>} nodeIds - Entity IDs of nodes to delete
 * @returns {Promise<number>} Number of nodes deleted
 */
async function rollbackNodes(env, userId, nodeIds) {
  if (!nodeIds || nodeIds.length === 0) {
    return 0;
  }

  console.log('[GraphRAG:Rollback] Starting rollback for', nodeIds.length, 'nodes');

  const doId = env.FALKORDB_POOL.idFromName('pool');
  const doStub = env.FALKORDB_POOL.get(doId);

  let deleted = 0;

  // Delete in batches of 10
  const batchSize = 10;
  for (let i = 0; i < nodeIds.length; i += batchSize) {
    const batch = nodeIds.slice(i, i + batchSize);

    const cypher = `
      MATCH (n {user_id: $user_id})
      WHERE n.entity_id IN $entity_ids
      DETACH DELETE n
      RETURN count(n) as deleted
    `.trim();

    try {
      const response = await doStub.fetch('http://do/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          cypher,
          params: {
            user_id: userId,
            entity_ids: batch,
          },
          config: {
            host: env.FALKORDB_HOST,
            port: parseInt(env.FALKORDB_PORT),
            username: env.FALKORDB_USER,
            password: env.FALKORDB_PASSWORD,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const batchDeleted = result.data?.[0]?.[0] || 0;
        deleted += batchDeleted;
        console.log(`[GraphRAG:Rollback] Deleted ${batchDeleted} nodes in batch`);
      } else {
        console.error('[GraphRAG:Rollback] Failed to delete batch:', await response.text());
      }
    } catch (error) {
      console.error('[GraphRAG:Rollback] Error deleting batch:', error);
      // Continue with next batch despite errors
    }
  }

  console.log('[GraphRAG:Rollback] Rollback complete, deleted', deleted, 'nodes');
  return deleted;
}
