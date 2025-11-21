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
export async function generateCypherQuery(question, userNamespace, userId, env) {
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
      params = await buildEntityLookupParams(question, entities, env, userNamespace, userId);
      break;

    case 'relationship_query':
      params = await buildRelationshipParams(question, entities, env, userNamespace, userId);
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
async function buildEntityLookupParams(question, entities, env, userNamespace, userId) {
  if (entities.length === 0) {
    throw new Error('No entities found in question');
  }

  // Use first entity
  const entityRef = entities[0];

  // Resolve entity (try to find canonical name)
  const resolvedEntity = await resolveEntity(entityRef.text, userId, env);

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
async function buildRelationshipParams(question, entities, env, userNamespace, userId) {
  if (entities.length === 0) {
    throw new Error('No entities found in question');
  }

  // Resolve source entity
  const sourceEntity = await resolveEntity(entities[0].text, userId, env);

  // Detect relationship type from question
  const lowerQuestion = question.toLowerCase();
  let relType = 'RELATED_TO';
  let targetType = '*';
  let direction = 'outgoing';

  for (const [phrase, mapping] of Object.entries(RELATIONSHIP_MAPPINGS)) {
    if (lowerQuestion.includes(phrase)) {
      relType = mapping.type;

      // Determine direction based on entity type match
      // If the resolved entity matches the mapping's TARGET, we are looking for the SOURCE (Incoming)
      if (sourceEntity.type && mapping.target && sourceEntity.type.toLowerCase() === mapping.target.toLowerCase()) {
        direction = 'incoming';
        targetType = mapping.source || '*'; // We are looking for the source
      } else {
        // Default or if matches Source
        direction = 'outgoing';
        targetType = mapping.target || '*';
      }

      break;
    }
  }

  return {
    userNamespace,
    sourceType: sourceEntity.type || 'Person',
    sourceName: sourceEntity.name,
    source_name: sourceEntity.name,
    relType,
    targetType,
    direction
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
    .replace(/USE GRAPH.*?;/gi, '') // Strip USE GRAPH statements
    .trim();

  // Aggressive sanitization: Take only the first statement
  // This prevents "Multi-statement queries are not allowed" errors if the LLM
  // generates multiple queries or adds explanations after the query.
  // We use the same logic as the validator to safely split by semicolon
  const cleanCypher = generatedCypher
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""')
    .replace(/`[^`]*`/g, '``');

  const statements = cleanCypher.split(';');
  if (statements.length > 1) {
    // If multiple statements detected, find the index of the first semicolon
    // that is NOT inside a string
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    let splitIndex = -1;

    for (let i = 0; i < generatedCypher.length; i++) {
      const char = generatedCypher[i];
      if (char === "'" && !inDoubleQuote && !inBacktick) inSingleQuote = !inSingleQuote;
      else if (char === '"' && !inSingleQuote && !inBacktick) inDoubleQuote = !inDoubleQuote;
      else if (char === '`' && !inSingleQuote && !inDoubleQuote) inBacktick = !inBacktick;
      else if (char === ';' && !inSingleQuote && !inDoubleQuote && !inBacktick) {
        splitIndex = i;
        break;
      }
    }

    if (splitIndex !== -1) {
      generatedCypher = generatedCypher.substring(0, splitIndex).trim();
    }
  }

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
- Node Types: Person, Project, Meeting, Topic, Technology, Location, Organization, Date, Note, Task, Decision
- Relationship Types: WORKS_ON, LEADS, ATTENDED, DISCUSSED, USES_TECHNOLOGY, WORKED_WITH, KNOWS_ABOUT, MENTIONS, HAPPENED_ON, ABOUT, HAS_TASK, HAS_DECISION

User Namespace: ${userNamespace}
Question: "${question}"
Detected Entities: ${entityList}

Important Rules:
1. Do NOT include USE GRAPH statement (it is handled automatically)
2. Use MATCH for queries, never CREATE, DELETE, DROP, or MERGE
3. Include LIMIT clause (max 100 results)
4. Return node properties with properties(n) as props
5. Use parameterized queries with $param syntax when possible
6. Entity names must match canonical names exactly (case-sensitive)

Example Queries:

Q: "What projects did Sarah work on?"
A: MATCH (p:Person {name: 'Sarah Johnson'})-[:WORKS_ON]->(proj:Project)
RETURN p, proj, properties(proj) as props
LIMIT 100;

Q: "Who leads GraphMind?"
A: MATCH (p:Person)-[:LEADS]->(proj:Project {name: 'GraphMind'})
RETURN p, proj, properties(p) as props
LIMIT 100;

Q: "Who attended meetings last week?"
A: MATCH (p:Person)-[:ATTENDED]->(m:Meeting)
WHERE m.date >= date() - duration('P7D')
RETURN DISTINCT p, properties(p) as props
LIMIT 100;

Q: "What technologies does the FastAPI project use?"
A: MATCH (proj:Project {name: 'FastAPI'})-[:USES_TECHNOLOGY]->(tech:Technology)
RETURN proj, tech, properties(tech) as props
LIMIT 100;

Now convert this question:
Question: "${question}"

Return ONLY the Cypher query, no explanation or markdown formatting.`;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Resolve entity name to canonical name using fuzzy matching against cache
 * @param {string} entityName - Extracted entity name
 * @param {string} userId - User ID
 * @param {Object} env - Environment bindings
 * @returns {Promise<string>} Canonical name or original name
 */
export async function resolveEntity(entityName, userId, env) {
  try {
    // 1. Fetch all entities for this user from cache
    // Note: For a personal knowledge graph, this list is small enough to fetch all.
    // For larger graphs, we might need a more sophisticated search (e.g. Vector DB or FTS).
    // Normalize user_id comparison to handle UUIDs with or without dashes
    const cleanUserId = userId.replace(/-/g, '');
    const { results } = await env.DB.prepare(
      "SELECT canonical_name, entity_type, entity_id FROM entity_cache WHERE REPLACE(user_id, '-', '') = ?"
    ).bind(cleanUserId).all();

    if (!results || results.length === 0) {
      return {
        name: entityName,
        type: null,
        id: null
      };
    }

    const candidates = results.map(r => r.canonical_name);

    // 2. Find best match using Levenshtein distance
    let bestMatch = null;
    let minDistance = Infinity;
    const lowerEntityName = entityName.toLowerCase();

    for (const candidate of candidates) {
      const lowerCandidate = candidate.toLowerCase();

      // Exact match check (optimization)
      if (lowerCandidate === lowerEntityName) {
        // Find the full object to get type
        const match = results.find(r => r.canonical_name.toLowerCase() === lowerCandidate);
        return {
          name: candidate,
          type: match ? match.entity_type : null,
          id: match ? match.entity_id : null
        };
      }

      const distance = levenshteinDistance(lowerEntityName, lowerCandidate);

      // Calculate similarity score (0 to 1)
      const maxLength = Math.max(lowerEntityName.length, lowerCandidate.length);
      const similarity = 1 - (distance / maxLength);

      // Threshold: 
      // - Allow small typos (distance <= 2 for words > 4 chars)
      // - High similarity (> 0.7)
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = { candidate, distance, similarity };
      }
    }

    // Decision logic
    if (bestMatch) {
      // If very close match (e.g. "GraftMind" vs "GraphMind" -> distance 2, len 9 -> sim 0.77)
      // Let's be generous for voice inputs.
      if (bestMatch.similarity > 0.6 || bestMatch.distance <= 2) {
        console.log(`[EntityResolution] Fuzzy match: "${entityName}" -> "${bestMatch.candidate}" (dist: ${bestMatch.distance}, sim: ${bestMatch.similarity.toFixed(2)})`);

        const match = results.find(r => r.canonical_name === bestMatch.candidate);
        return {
          name: bestMatch.candidate,
          type: match ? match.entity_type : null,
          id: match ? match.entity_id : null
        };
      }
    }

    return {
      name: entityName,
      type: null,
      id: null
    };

  } catch (error) {
    console.warn('[EntityResolution] Error resolving entity:', error);
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
