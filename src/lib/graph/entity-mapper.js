/**
 * Entity Mapper
 *
 * Maps D1 entity JSON to FalkorDB node properties.
 * Handles property extraction, type conversion, and normalization.
 *
 * @module lib/graph/entity-mapper
 */

import { entityToNode } from '../../models/graph-node.model.js';

/**
 * Map extracted entities to graph nodes
 *
 * @param {Array<Object>} entities - Entities from Feature 005 extraction
 * @returns {Array<Object>} Array of {nodeType, properties, entityId}
 */
export function mapEntitiesToNodes(entities) {
  const nodes = [];

  for (const entity of entities) {
    try {
      const { nodeType, properties } = entityToNode(entity);

      nodes.push({
        nodeType,
        properties,
        entityId: entity.entity_id,
        confidence: entity.confidence,
      });
    } catch (error) {
      console.error('[EntityMapper] Failed to map entity:', entity.entity_id, error.message);
      // Skip invalid entities
    }
  }

  return nodes;
}

/**
 * Extract entity mentions from transcript context
 * Used for relationship inference
 *
 * @param {string} transcript - Voice note transcript
 * @param {Array<Object>} entities - Extracted entities
 * @returns {Object} Context map {entity_id: {mentions, coMentions}}
 */
export function extractEntityContext(transcript, entities) {
  const contextMap = {};

  // Simple co-mention detection (entities mentioned in same sentence)
  const sentences = transcript.split(/[.!?]+/);

  for (const entity of entities) {
    const mentions = [];
    const coMentions = new Set();

    // Find sentences mentioning this entity
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].toLowerCase();
      const entityName = (entity.name || entity.entity_value).toLowerCase();

      if (sentence.includes(entityName)) {
        mentions.push({
          sentenceIndex: i,
          sentence: sentences[i].trim(),
        });

        // Find co-mentioned entities in same sentence
        for (const other of entities) {
          if (other.entity_id === entity.entity_id) continue;

          const otherName = (other.name || other.entity_value).toLowerCase();
          if (sentence.includes(otherName)) {
            coMentions.add(other.entity_id);
          }
        }
      }
    }

    contextMap[entity.entity_id] = {
      mentions: mentions.length,
      coMentions: Array.from(coMentions),
      firstMentionSentence: mentions[0]?.sentence || '',
    };
  }

  return contextMap;
}

/**
 * Merge duplicate entity properties
 * Used when deduplicating entities
 *
 * @param {Object} sourceProps - Properties from entity being merged away
 * @param {Object} targetProps - Properties from entity being kept
 * @param {string} strategy - Merge strategy ('prefer_source', 'prefer_target', 'combine')
 * @returns {Object} Merged properties
 */
export function mergeEntityProperties(sourceProps, targetProps, strategy = 'prefer_target') {
  const merged = { ...targetProps };

  switch (strategy) {
    case 'prefer_source':
      // Use source properties, fall back to target
      for (const key of Object.keys(sourceProps)) {
        if (sourceProps[key] && !merged[key]) {
          merged[key] = sourceProps[key];
        }
      }
      break;

    case 'prefer_target':
      // Use target properties, fill gaps with source
      for (const key of Object.keys(sourceProps)) {
        if (!merged[key] && sourceProps[key]) {
          merged[key] = sourceProps[key];
        }
      }
      break;

    case 'combine':
      // Combine arrays, prefer target for scalars
      for (const key of Object.keys(sourceProps)) {
        if (Array.isArray(sourceProps[key]) && Array.isArray(merged[key])) {
          // Combine arrays, deduplicate
          merged[key] = [...new Set([...merged[key], ...sourceProps[key]])];
        } else if (!merged[key] && sourceProps[key]) {
          merged[key] = sourceProps[key];
        }
      }
      break;
  }

  // Combine mention counts
  if (sourceProps.mention_count) {
    merged.mention_count = (merged.mention_count || 0) + sourceProps.mention_count;
  }

  // Keep earliest first_mentioned
  if (sourceProps.first_mentioned && targetProps.first_mentioned) {
    merged.first_mentioned = Math.min(sourceProps.first_mentioned, targetProps.first_mentioned);
  } else if (sourceProps.first_mentioned) {
    merged.first_mentioned = sourceProps.first_mentioned;
  }

  return merged;
}

/**
 * Filter entities by confidence threshold
 *
 * @param {Array<Object>} entities - Extracted entities
 * @param {number} minConfidence - Minimum confidence (0-1)
 * @returns {Array<Object>} Filtered entities
 */
export function filterEntitiesByConfidence(entities, minConfidence = 0.7) {
  return entities.filter(entity => entity.confidence >= minConfidence);
}

/**
 * Group entities by type
 *
 * @param {Array<Object>} entities - Extracted entities
 * @returns {Object} Entities grouped by type
 */
export function groupEntitiesByType(entities) {
  const grouped = {};

  for (const entity of entities) {
    const type = entity.entity_type;
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(entity);
  }

  return grouped;
}
