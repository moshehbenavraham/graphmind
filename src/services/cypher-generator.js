/**
 * Cypher Query Generator Service (Feature 008)
 *
 * Converts natural language questions into Cypher queries using template matching
 * and entity resolution. Falls back to LLM generation for complex queries.
 *
 * @module services/cypher-generator
 */

import {
  selectCypherTemplate,
  extractEntityReferences,
  buildCypherQuery,
  RELATIONSHIP_MAPPINGS,
  TIME_PERIOD_MAPPINGS
} from '../lib/graph/cypher-templates.js';
import { validateAndSanitize } from '../lib/graph/cypher-validator.js';

/**
 * Generate Cypher query from natural language question
 *
 * @param {string} question - Natural language question
 * @param {string} userNamespace - User's FalkorDB namespace
 * @param {Object} env - Environment bindings (for entity resolution)
 * @returns {Promise<Object>} { cypher, parameters, templateUsed, entities }
 */
export async function generateCypherQuery(question, userNamespace, env) {
  // 1. Select template based on question pattern
  const entities = extractEntityReferences(question);
  const template = selectCypherTemplate(question, entities);

  // 2. If LLM fallback needed (complex query), use Llama 3.1-8b
  if (template === 'llm_generate') {
    console.log('[CypherGenerator] Complex query detected, using LLM fallback');
    return await generateCypherWithLLM(question, userNamespace, entities, env);
  }

  // 3. Extract parameters based on template
  let params = { userNamespace };

  switch (template) {
    case 'entity_lookup':
      params = await buildEntityLookupParams(question, entities, env, userNamespace);
      break;

    case 'relationship_query':
      params = await buildRelationshipParams(question, entities, env, userNamespace);
      break;

    case 'temporal_query':
      params = await buildTemporalParams(question, entities, env, userNamespace);
      break;

    case 'list_query':
      params = await buildListParams(question, entities, env, userNamespace);
      break;

    case 'count_query':
      params = await buildCountParams(question, entities, env, userNamespace);
      break;

    default:
      throw new Error(`Unknown template: ${template}`);
  }

  // 4. Build Cypher query from template
  const { cypher, parameters, templateUsed } = buildCypherQuery(template, params);

  // 5. Validate and sanitize
  const validatedCypher = validateAndSanitize(cypher, userNamespace);

  return {
    cypher: validatedCypher,
    parameters,
    templateUsed,
    entities
  };
}

/**
 * Build parameters for entity lookup query
 * Pattern: "Who is Sarah?" → MATCH (n:Person {name: 'Sarah'})
 */
async function buildEntityLookupParams(question, entities, env, userNamespace) {
  if (entities.length === 0) {
    throw new Error('No entities found in question');
  }

  // Use first entity
  const entityRef = entities[0];

  // Resolve entity (try to find canonical name)
  const resolvedEntity = await resolveEntity(entityRef.text, env, userNamespace);

  return {
    userNamespace,
    entityType: resolvedEntity.type || 'Person', // Default to Person
    entityName: resolvedEntity.name,
    entity_name: resolvedEntity.name // For query parameter
  };
}

/**
 * Build parameters for relationship query
 * Pattern: "What projects did Sarah work on?"
 */
async function buildRelationshipParams(question, entities, env, userNamespace) {
  if (entities.length === 0) {
    throw new Error('No entities found in question');
  }

  // Resolve source entity
  const sourceEntity = await resolveEntity(entities[0].text, env, userNamespace);

  // Detect relationship type from question
  const lowerQuestion = question.toLowerCase();
  let relType = 'RELATED_TO';
  let targetType = '*';

  for (const [phrase, mapping] of Object.entries(RELATIONSHIP_MAPPINGS)) {
    if (lowerQuestion.includes(phrase)) {
      relType = mapping.type;
      targetType = mapping.target;
      break;
    }
  }

  return {
    userNamespace,
    sourceType: sourceEntity.type || 'Person',
    sourceName: sourceEntity.name,
    source_name: sourceEntity.name,
    relType,
    targetType
  };
}

/**
 * Build parameters for temporal query
 * Pattern: "What did I do last week?"
 */
async function buildTemporalParams(question, entities, env, userNamespace) {
  const lowerQuestion = question.toLowerCase();

  // Detect time period
  let duration = 'P7D'; // Default to 7 days
  for (const [phrase, dur] of Object.entries(TIME_PERIOD_MAPPINGS)) {
    if (lowerQuestion.includes(phrase)) {
      duration = dur;
      break;
    }
  }

  // Detect entity type
  let entityType = 'Meeting';
  let dateProperty = 'date';

  if (lowerQuestion.includes('project')) {
    entityType = 'Project';
    dateProperty = 'last_updated';
  } else if (lowerQuestion.includes('note')) {
    entityType = 'Note';
    dateProperty = 'created_at';
  }

  return {
    userNamespace,
    entityType,
    dateProperty,
    duration,
    time_period: duration
  };
}

/**
 * Build parameters for list query
 * Pattern: "List all projects"
 */
async function buildListParams(question, entities, env, userNamespace) {
  const lowerQuestion = question.toLowerCase();

  // Detect entity type
  let entityType = 'Person';

  if (lowerQuestion.includes('project')) {
    entityType = 'Project';
  } else if (lowerQuestion.includes('meeting')) {
    entityType = 'Meeting';
  } else if (lowerQuestion.includes('topic')) {
    entityType = 'Topic';
  } else if (lowerQuestion.includes('technolog')) {
    entityType = 'Technology';
  } else if (lowerQuestion.includes('note')) {
    entityType = 'Note';
  }

  return {
    userNamespace,
    entityType,
    filterProperty: null,
    filterValue: null
  };
}

/**
 * Build parameters for count query
 * Pattern: "How many projects?"
 */
async function buildCountParams(question, entities, env, userNamespace) {
  const lowerQuestion = question.toLowerCase();

  // Detect entity type
  let entityType = 'Person';

  if (lowerQuestion.includes('project')) {
    entityType = 'Project';
  } else if (lowerQuestion.includes('meeting')) {
    entityType = 'Meeting';
  } else if (lowerQuestion.includes('topic')) {
    entityType = 'Topic';
  } else if (lowerQuestion.includes('person') || lowerQuestion.includes('people')) {
    entityType = 'Person';
  }

  return {
    userNamespace,
    entityType,
    condition: ''
  };
}

/**
 * Generate Cypher query using LLM fallback chain for complex queries
 * that don't match predefined templates
 *
 * Two-tier fallback strategy:
 * 1. Llama 3.1-8b (fast, ~2-3s)
 * 2. DeepSeek R1 Distill Qwen 32B (more capable, ~4-5s)
 *
 * @param {string} question - Natural language question
 * @param {string} userNamespace - User's FalkorDB namespace
 * @param {Array} entities - Extracted entity references
 * @param {Object} env - Environment bindings (for AI model)
 * @returns {Promise<Object>} { cypher, parameters, templateUsed, entities }
 */
async function generateCypherWithLLM(question, userNamespace, entities, env) {
  const prompt = buildLLMPrompt(question, userNamespace, entities);

  // Tier 1: Try Llama 3.1-8b (fast, good for most queries)
  try {
    console.log('[CypherGenerator] Attempting Tier 1 LLM: Llama 3.1-8b');
    const result = await callLLMModel(
      env,
      '@cf/meta/llama-3.1-8b-instruct',
      prompt,
      3000, // 3 second timeout
      userNamespace,
      entities
    );

    console.log('[CypherGenerator] ✓ Tier 1 LLM succeeded');
    return { ...result, templateUsed: 'llm_generated_llama_8b' };
  } catch (error) {
    console.warn('[CypherGenerator] ✗ Tier 1 LLM failed:', error.message);

    // Log Tier 1 failure for prompt improvement (T217)
    logCypherGenerationFailure(question, 'tier1_llama_8b', error.message, entities);

    // Tier 2: Fallback to DeepSeek R1 Distill Qwen 32B (more capable)
    try {
      console.log('[CypherGenerator] Attempting Tier 2 LLM: DeepSeek R1 Qwen 32B');
      const result = await callLLMModel(
        env,
        '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
        prompt,
        5000, // 5 second timeout (larger model, allow more time)
        userNamespace,
        entities
      );

      console.log('[CypherGenerator] ✓ Tier 2 LLM succeeded (backup)');
      return { ...result, templateUsed: 'llm_generated_qwen_32b' };
    } catch (backupError) {
      console.error('[CypherGenerator] ✗ Tier 2 LLM failed:', backupError.message);

      // Log Tier 2 failure for prompt improvement (T217)
      logCypherGenerationFailure(question, 'tier2_qwen_32b', backupError.message, entities);

      // Log complete failure (both tiers)
      logCypherGenerationFailure(question, 'both_tiers_failed',
        `Tier 1: ${error.message}; Tier 2: ${backupError.message}`, entities);

      // Both tiers failed - return user-friendly error
      throw new Error(
        "I couldn't understand that question. Try asking about specific people, projects, or topics in your knowledge base."
      );
    }
  }
}

/**
 * Call a specific LLM model with timeout and error handling
 *
 * @param {Object} env - Environment bindings
 * @param {string} modelName - Workers AI model identifier
 * @param {string} prompt - Formatted prompt
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} userNamespace - User namespace for validation
 * @param {Array} entities - Extracted entities
 * @returns {Promise<Object>} { cypher, parameters, entities }
 */
async function callLLMModel(env, modelName, prompt, timeoutMs, userNamespace, entities) {
  const response = await Promise.race([
    env.AI.run(modelName, {
      messages: [
        {
          role: 'system',
          content: 'You are a Cypher query expert for FalkorDB. Convert natural language questions to valid Cypher queries. Return ONLY the Cypher query, no explanation.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.1 // Low temperature for deterministic output
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`LLM timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);

  // Extract generated Cypher from response
  let generatedCypher = response.response || response.result || '';

  // Clean up the response (remove markdown code blocks if present)
  generatedCypher = generatedCypher
    .replace(/```cypher\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  if (!generatedCypher) {
    throw new Error('LLM returned empty Cypher query');
  }

  // Validate the generated Cypher
  const validatedCypher = validateAndSanitize(generatedCypher, userNamespace);

  console.log(`[CypherGenerator] Generated Cypher via ${modelName}:`, validatedCypher);

  return {
    cypher: validatedCypher,
    parameters: {},
    entities
  };
}

/**
 * Build prompt for LLM Cypher generation
 *
 * @param {string} question - Natural language question
 * @param {string} userNamespace - User's FalkorDB namespace
 * @param {Array} entities - Extracted entity references
 * @returns {string} Formatted prompt for LLM
 */
function buildLLMPrompt(question, userNamespace, entities) {
  const entityList = entities.length > 0
    ? entities.map(e => `"${e.text}"`).join(', ')
    : 'none detected';

  return `Convert this natural language question to a valid FalkorDB Cypher query.

User's Knowledge Graph Schema:
- Node Types: Person, Project, Meeting, Topic, Technology, Location, Organization, Date, Note
- Relationship Types: WORKS_ON, ATTENDED, DISCUSSED, USES_TECHNOLOGY, WORKED_WITH, KNOWS_ABOUT, MENTIONS, HAPPENED_ON, ABOUT

User Namespace: ${userNamespace}
Question: "${question}"
Detected Entities: ${entityList}

Important Rules:
1. Always start with: USE GRAPH ${userNamespace};
2. Use MATCH for queries, never CREATE, DELETE, DROP, or MERGE
3. Include LIMIT clause (max 100 results)
4. Return node properties with properties(n) as props
5. Use parameterized queries with $param syntax when possible
6. Entity names must match canonical names exactly (case-sensitive)

Example Queries:

Q: "What projects did Sarah work on?"
A: USE GRAPH ${userNamespace};
MATCH (p:Person {name: 'Sarah Johnson'})-[:WORKS_ON]->(proj:Project)
RETURN p, proj, properties(proj) as props
LIMIT 100;

Q: "Who attended meetings last week?"
A: USE GRAPH ${userNamespace};
MATCH (p:Person)-[:ATTENDED]->(m:Meeting)
WHERE m.date >= date() - duration('P7D')
RETURN DISTINCT p, properties(p) as props
LIMIT 100;

Q: "What technologies does the FastAPI project use?"
A: USE GRAPH ${userNamespace};
MATCH (proj:Project {name: 'FastAPI'})-[:USES_TECHNOLOGY]->(tech:Technology)
RETURN proj, tech, properties(tech) as props
LIMIT 100;

Now convert this question:
Question: "${question}"

Return ONLY the Cypher query, no explanation or markdown formatting.`;
}

/**
 * Resolve entity name to canonical form
 * Uses entity_cache table in D1 for resolution
 *
 * @param {string} entityName - Entity name from question
 * @param {Object} env - Environment bindings
 * @param {string} userNamespace - User namespace
 * @returns {Promise<Object>} { name, type, id }
 */
async function resolveEntity(entityName, env, userNamespace) {
  try {
    // Query entity_cache for canonical name
    const query = `
      SELECT canonical_name, entity_type, entity_id
      FROM entity_cache
      WHERE user_namespace = ? AND (
        canonical_name LIKE ? OR
        aliases LIKE ?
      )
      LIMIT 1
    `;

    const likePattern = `%${entityName}%`;
    const result = await env.DB.prepare(query)
      .bind(userNamespace, likePattern, likePattern)
      .first();

    if (result) {
      return {
        name: result.canonical_name,
        type: result.entity_type,
        id: result.entity_id
      };
    }

    // Not found - return as-is (will be used literally in query)
    return {
      name: entityName,
      type: null, // Type will be inferred
      id: null
    };
  } catch (error) {
    console.error('[CypherGenerator] Entity resolution error:', error);
    // Fallback to original name
    return {
      name: entityName,
      type: null,
      id: null
    };
  }
}

/**
 * Log failed Cypher generation for prompt improvement (T217)
 *
 * This structured logging helps us:
 * 1. Identify common failure patterns
 * 2. Improve LLM prompts
 * 3. Add new templates for common questions
 * 4. Monitor LLM performance over time
 *
 * @param {string} question - The natural language question that failed
 * @param {string} failureType - Type of failure (tier1_llama_8b, tier2_qwen_32b, both_tiers_failed)
 * @param {string} errorMessage - Error message from the LLM
 * @param {Array} entities - Extracted entities from the question
 */
function logCypherGenerationFailure(question, failureType, errorMessage, entities) {
  // Create structured log entry
  const logEntry = {
    timestamp: new Date().toISOString(),
    failure_type: failureType,
    question_length: question.length,
    question_hash: hashString(question), // Hash for privacy (no PII)
    question_sample: question.substring(0, 50) + (question.length > 50 ? '...' : ''), // First 50 chars for context
    error_message: errorMessage,
    entities_count: entities.length,
    entity_types: entities.map(e => e.type || 'unknown'),
    // User namespace is intentionally NOT logged (privacy)
  };

  // Log as structured JSON for easy parsing
  console.error('[CypherGenerator] CYPHER_GENERATION_FAILURE:', JSON.stringify(logEntry));

  // Optionally, send to monitoring service (e.g., Sentry, DataDog)
  // if (env.SENTRY_DSN) {
  //   Sentry.captureMessage('Cypher Generation Failure', {
  //     level: 'warning',
  //     extra: logEntry
  //   });
  // }
}

/**
 * Simple string hash function for privacy-preserving logging
 * Uses FNV-1a hash algorithm
 *
 * @param {string} str - String to hash
 * @returns {string} - Hex hash string
 */
function hashString(str) {
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  return (hash >>> 0).toString(16); // Convert to unsigned 32-bit hex
}
