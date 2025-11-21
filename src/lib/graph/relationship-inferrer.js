/**
 * Relationship Inferrer
 *
 * Uses Workers AI (Llama 3.1) to infer relationships between entities
 * based on transcript context and entity types.
 *
 * @module lib/graph/relationship-inferrer
 */

import { RelationshipTypes, ValidRelationshipCombinations } from '../../models/graph-relationship.model.js';

/**
 * Infer relationships between entities using Workers AI
 *
 * @param {Object} ai - Workers AI binding
 * @param {Array<Object>} entities - Extracted entities with context
 * @param {string} transcript - Voice note transcript
 * @param {Object} entityContext - Context map from entity-mapper
 * @returns {Promise<Array<Object>>} Inferred relationships
 */
export async function inferRelationships(ai, entities, transcript, entityContext) {
  const relationships = [];

  // Build entity pairs that could be related (co-mentioned in same sentence)
  const pairs = buildEntityPairs(entities, entityContext);

  if (pairs.length === 0) {
    console.log('[RelationshipInferrer] No entity pairs found for relationship inference');
    return relationships;
  }

  // Batch inference for efficiency (process 5 pairs at a time)
  const batchSize = 5;
  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize);
    const batchResults = await inferRelationshipBatch(ai, batch, transcript);
    relationships.push(...batchResults);
  }

  return relationships;
}

/**
 * Build entity pairs that could be related
 *
 * @param {Array<Object>} entities - Extracted entities
 * @param {Object} entityContext - Context map
 * @returns {Array<Object>} Entity pairs with context
 */
function buildEntityPairs(entities, entityContext) {
  const pairs = [];

  for (const entity of entities) {
    const context = entityContext[entity.entity_id];
    if (!context || context.coMentions.length === 0) continue;

    // Create pairs with co-mentioned entities
    for (const coMentionedId of context.coMentions) {
      const coEntity = entities.find(e => e.entity_id === coMentionedId);
      if (!coEntity) continue;

      // Check if this node type combination has valid relationships
      const validRelTypes = getValidRelationshipTypes(entity.entity_type, coEntity.entity_type);
      if (validRelTypes.length === 0) continue;

      pairs.push({
        from: entity,
        to: coEntity,
        validRelTypes,
        context: context.firstMentionSentence,
      });
    }
  }

  return pairs;
}

/**
 * Get valid relationship types for a node type pair
 *
 * @param {string} fromType - Source node type
 * @param {string} toType - Target node type
 * @returns {Array<string>} Valid relationship types
 */
function getValidRelationshipTypes(fromType, toType) {
  const validTypes = [];

  for (const [relType, combos] of Object.entries(ValidRelationshipCombinations)) {
    for (const [from, to] of combos) {
      if (from === fromType && to === toType) {
        validTypes.push(relType);
      }
    }
  }

  return validTypes;
}

/**
 * Infer relationships for a batch of entity pairs using Workers AI
 *
 * @param {Object} ai - Workers AI binding
 * @param {Array<Object>} pairs - Entity pairs
 * @param {string} transcript - Voice note transcript
 * @returns {Promise<Array<Object>>} Inferred relationships
 */
async function inferRelationshipBatch(ai, pairs, transcript) {
  const relationships = [];

  // Build prompt for Workers AI
  const prompt = buildInferencePrompt(pairs, transcript);

  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are a knowledge graph relationship inference assistant. Analyze the context and determine relationships between entities. Respond ONLY with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 1000,
    });

    // Parse response
    const result = parseInferenceResponse(response.response, pairs);
    relationships.push(...result);

  } catch (error) {
    console.error('[RelationshipInferrer] Workers AI inference failed:', error);
    // Fall back to rule-based inference
    relationships.push(...ruleBasedInference(pairs));
  }

  return relationships;
}

/**
 * Build prompt for relationship inference
 *
 * @param {Array<Object>} pairs - Entity pairs
 * @param {string} transcript - Voice note transcript
 * @returns {string} Prompt for Workers AI
 */
function buildInferencePrompt(pairs, transcript) {
  const pairDescriptions = pairs.map((pair, i) => {
    const validRels = pair.validRelTypes.join(', ');
    return `Pair ${i + 1}: "${pair.from.name || pair.from.entity_value}" (${pair.from.entity_type}) and "${pair.to.name || pair.to.entity_value}" (${pair.to.entity_type}). Valid relationships: ${validRels}. Context: "${pair.context}"`;
  }).join('\n');

  return `
Analyze the following transcript and determine relationships between entity pairs.

Transcript:
${transcript.substring(0, 500)}...

Entity Pairs:
${pairDescriptions}

For each pair, determine:
1. If a relationship exists (yes/no)
2. The relationship type (must be from the valid relationships list)
3. Confidence (0-1)
4. Optional properties (e.g., role, strength)

Respond with JSON array:
[
  {"pair": 1, "relationship": "WORKED_WITH", "confidence": 0.9, "properties": {"strength": 5}},
  {"pair": 2, "relationship": null, "confidence": 0, "properties": {}}
]
`.trim();
}

/**
 * Parse Workers AI response
 *
 * @param {string} response - AI response
 * @param {Array<Object>} pairs - Original entity pairs
 * @returns {Array<Object>} Parsed relationships
 */
function parseInferenceResponse(response, pairs) {
  const relationships = [];

  try {
    // Extract JSON from response (may have extra text)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }

    const inferences = JSON.parse(jsonMatch[0]);

    for (const inference of inferences) {
      if (!inference.relationship || inference.confidence < 0.7) continue;

      const pair = pairs[inference.pair - 1];
      if (!pair) continue;

      relationships.push({
        fromEntityId: pair.from.entity_id,
        toEntityId: pair.to.entity_id,
        relType: inference.relationship,
        properties: inference.properties || {},
        confidence: inference.confidence,
      });
    }
  } catch (error) {
    console.error('[RelationshipInferrer] Failed to parse AI response:', error);
  }

  return relationships;
}

/**
 * Rule-based relationship inference (fallback)
 *
 * @param {Array<Object>} pairs - Entity pairs
 * @returns {Array<Object>} Inferred relationships
 */
function ruleBasedInference(pairs) {
  const relationships = [];

  for (const pair of pairs) {
    // Simple rule-based inference
    if (pair.from.entity_type === 'Person' && pair.to.entity_type === 'Person') {
      // People mentioned together likely worked together
      relationships.push({
        fromEntityId: pair.from.entity_id,
        toEntityId: pair.to.entity_id,
        relType: RelationshipTypes.WORKED_WITH,
        properties: { strength: 1 },
        confidence: 0.7,
      });
    } else if (pair.from.entity_type === 'Person' && pair.to.entity_type === 'Project') {
      // Person mentioned with project likely works on it
      relationships.push({
        fromEntityId: pair.from.entity_id,
        toEntityId: pair.to.entity_id,
        relType: RelationshipTypes.WORKS_ON,
        properties: { role: 'contributor' },
        confidence: 0.75,
      });
    } else if (pair.from.entity_type === 'Person' && pair.to.entity_type === 'Meeting') {
      // Person mentioned with meeting likely attended
      relationships.push({
        fromEntityId: pair.from.entity_id,
        toEntityId: pair.to.entity_id,
        relType: RelationshipTypes.ATTENDED,
        properties: { role: 'participant' },
        confidence: 0.8,
      });
    } else if (pair.from.entity_type === 'Meeting' && pair.to.entity_type === 'Topic') {
      // Meeting mentioned with topic likely discussed it
      relationships.push({
        fromEntityId: pair.from.entity_id,
        toEntityId: pair.to.entity_id,
        relType: RelationshipTypes.DISCUSSED,
        properties: {},
        confidence: 0.8,
      });
    } else if (pair.from.entity_type === 'Project' && pair.to.entity_type === 'Technology') {
      // Project mentioned with technology likely uses it
      relationships.push({
        fromEntityId: pair.from.entity_id,
        toEntityId: pair.to.entity_id,
        relType: RelationshipTypes.USES_TECHNOLOGY,
        properties: { purpose: 'other' },
        confidence: 0.75,
      });
    }
  }

  return relationships;
}
