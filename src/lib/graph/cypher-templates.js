/**
 * Cypher Query Templates for Feature 008 (Voice Query Input)
 *
 * Provides hardcoded Cypher query templates for common natural language patterns.
 * Template-first approach covers 80% of queries with <50ms generation time.
 *
 * @module lib/graph/cypher-templates
 */

/**
 * Pattern 1: Entity Lookup (Direct Node Match)
 * Use Case: "Who is Sarah?", "Tell me about the FastAPI project"
 *
 * @param {string} userNamespace - User's FalkorDB graph namespace
 * @param {string} entityType - Entity type (Person, Project, Topic, etc.)
 * @param {string} entityName - Canonical entity name
 * @returns {string} Cypher query
 */
export function entityLookupTemplate(userNamespace, entityType, entityName) {
  return `MATCH (n:${entityType} {name: $entity_name})
RETURN n, labels(n) as type, properties(n) as props
LIMIT 1;`;
}

/**
 * Pattern 2: Relationship Query (1-hop traversal)
 * Use Case: "What projects did Sarah work on?", "Who attended the meeting?"
 *
 * @param {string} userNamespace - User's FalkorDB graph namespace
 * @param {string} sourceType - Source entity type (Person, Project, etc.)
 * @param {string} sourceName - Source entity canonical name
 * @param {string} relType - Relationship type (WORKS_ON, ATTENDED, etc.)
 * @param {string} targetType - Target entity type (optional, use '*' for wildcard)
 * @returns {string} Cypher query
 */
export function relationshipQueryTemplate(userNamespace, sourceType, sourceName, relType, targetType = '*', direction = 'outgoing') {
  const targetPattern = targetType === '*' ? '' : `:${targetType}`;

  if (direction === 'incoming') {
    // (Unknown)-[Rel]->(Known)
    // Example: "Who works at GraphMind?" -> MATCH (target:Person)-[:WORKS_ON]->(source:Project {name: 'GraphMind'})
    return `MATCH (target${targetPattern})-[r:${relType}]->(source:${sourceType} {name: $source_name})
RETURN source, r, target, type(r) as relationship_type
ORDER BY target.name
LIMIT 100;`;
  }

  // Default: Outgoing
  // (Known)-[Rel]->(Unknown)
  return `MATCH (source:${sourceType} {name: $source_name})-[r:${relType}]->(target${targetPattern})
RETURN source, r, target, type(r) as relationship_type
ORDER BY target.name
LIMIT 100;`;
}

/**
 * Pattern 3: Temporal Query (Date filtering)
 * Use Case: "What did I do last week?", "Who did I meet this month?"
 *
 * @param {string} userNamespace - User's FalkorDB graph namespace
 * @param {string} entityType - Entity type with date property (Meeting, Project, Note)
 * @param {string} dateProperty - Date property name (date, created_at, last_updated)
 * @param {string} duration - ISO 8601 duration (P7D = 7 days, P30D = 30 days)
 * @returns {string} Cypher query
 */
export function temporalQueryTemplate(userNamespace, entityType, dateProperty, duration) {
  return `MATCH (n:${entityType})
WHERE n.${dateProperty} >= date() - duration($time_period)
RETURN n, properties(n) as props
ORDER BY n.${dateProperty} DESC
LIMIT 50;`;
}

/**
 * Pattern 4: List Query (Aggregated entities)
 * Use Case: "Who have I met?", "What technologies have I used?", "List all projects"
 *
 * @param {string} userNamespace - User's FalkorDB graph namespace
 * @param {string} entityType - Entity type (Person, Project, Technology, etc.)
 * @param {string} filterProperty - Optional filter property name
 * @param {any} filterValue - Optional filter value
 * @returns {string} Cypher query
 */
export function listQueryTemplate(userNamespace, entityType, filterProperty = null, filterValue = null) {
  let whereClause = '';
  if (filterProperty && filterValue) {
    whereClause = `WHERE n.${filterProperty} = $filter_value\n`;
  }

  return `MATCH (n:${entityType})
${whereClause}RETURN n, properties(n) as props
ORDER BY n.name
LIMIT 100;`;
}

/**
 * Pattern 5: Count Query (Aggregations)
 * Use Case: "How many projects involve Python?", "How many meetings did I have last week?"
 *
 * @param {string} userNamespace - User's FalkorDB graph namespace
 * @param {string} entityType - Entity type to count
 * @param {string} condition - WHERE condition (optional)
 * @returns {string} Cypher query
 */
export function countQueryTemplate(userNamespace, entityType, condition = '') {
  const whereClause = condition ? `WHERE ${condition}\n` : '';

  return `MATCH (n:${entityType})
${whereClause}RETURN count(n) as count, '${entityType}' as entity_type;`;
}

/**
 * Relationship inference table for natural language mapping
 * Maps natural language phrases to FalkorDB relationship types
 */
export const RELATIONSHIP_MAPPINGS = {
  // WORKS_ON
  'works on': { type: 'WORKS_ON', direction: 'outgoing', source: 'Person', target: 'Project' },
  'work on': { type: 'WORKS_ON', direction: 'outgoing', source: 'Person', target: 'Project' },
  'working on': { type: 'WORKS_ON', direction: 'outgoing', source: 'Person', target: 'Project' },
  'works at': { type: 'WORKS_ON', direction: 'outgoing', source: 'Person', target: 'Project' },
  'employed by': { type: 'WORKS_ON', direction: 'outgoing', source: 'Person', target: 'Project' },
  'developer for': { type: 'WORKS_ON', direction: 'outgoing', source: 'Person', target: 'Project' },
  'contributes to': { type: 'WORKS_ON', direction: 'outgoing', source: 'Person', target: 'Project' },

  // LEADS
  'leads': { type: 'LEADS', direction: 'outgoing', source: 'Person', target: 'Project' },
  'led by': { type: 'LEADS', direction: 'incoming', source: 'Project', target: 'Person' },
  'managed by': { type: 'LEADS', direction: 'incoming', source: 'Project', target: 'Person' },
  'manager of': { type: 'LEADS', direction: 'outgoing', source: 'Person', target: 'Project' },
  'manages': { type: 'LEADS', direction: 'outgoing', source: 'Person', target: 'Project' },
  'head of': { type: 'LEADS', direction: 'outgoing', source: 'Person', target: 'Project' },
  'director of': { type: 'LEADS', direction: 'outgoing', source: 'Person', target: 'Project' },
  'owner of': { type: 'LEADS', direction: 'outgoing', source: 'Person', target: 'Project' },
  'runs': { type: 'LEADS', direction: 'outgoing', source: 'Person', target: 'Project' },

  // ATTENDED
  'attended': { type: 'ATTENDED', direction: 'outgoing', source: 'Person', target: 'Meeting' },
  'was at': { type: 'ATTENDED', direction: 'outgoing', source: 'Person', target: 'Meeting' },
  'went to': { type: 'ATTENDED', direction: 'outgoing', source: 'Person', target: 'Meeting' },
  'participant in': { type: 'ATTENDED', direction: 'outgoing', source: 'Person', target: 'Meeting' },
  'present at': { type: 'ATTENDED', direction: 'outgoing', source: 'Person', target: 'Meeting' },

  // DISCUSSED
  'discussed': { type: 'DISCUSSED', direction: 'outgoing', source: 'Meeting', target: 'Topic' },
  'talked about': { type: 'DISCUSSED', direction: 'outgoing', source: 'Meeting', target: 'Topic' },
  'covered': { type: 'DISCUSSED', direction: 'outgoing', source: 'Meeting', target: 'Topic' },
  'regarding': { type: 'DISCUSSED', direction: 'outgoing', source: 'Meeting', target: 'Topic' },

  // USES_TECHNOLOGY
  'uses': { type: 'USES_TECHNOLOGY', direction: 'outgoing', source: 'Project', target: 'Technology' },
  'uses technology': { type: 'USES_TECHNOLOGY', direction: 'outgoing', source: 'Project', target: 'Technology' },
  'built with': { type: 'USES_TECHNOLOGY', direction: 'outgoing', source: 'Project', target: 'Technology' },
  'written in': { type: 'USES_TECHNOLOGY', direction: 'outgoing', source: 'Project', target: 'Technology' },
  'powered by': { type: 'USES_TECHNOLOGY', direction: 'outgoing', source: 'Project', target: 'Technology' },
  'stack includes': { type: 'USES_TECHNOLOGY', direction: 'outgoing', source: 'Project', target: 'Technology' },
  'depends on': { type: 'USES_TECHNOLOGY', direction: 'outgoing', source: 'Project', target: 'Technology' },

  // KNOWS_ABOUT (Must be checked before WORKED_WITH/knows to prevent partial match)
  'knows about': { type: 'KNOWS_ABOUT', direction: 'outgoing', source: 'Person', target: 'Topic' },
  'expert in': { type: 'KNOWS_ABOUT', direction: 'outgoing', source: 'Person', target: 'Topic' },
  'familiar with': { type: 'KNOWS_ABOUT', direction: 'outgoing', source: 'Person', target: 'Topic' },
  'skills in': { type: 'KNOWS_ABOUT', direction: 'outgoing', source: 'Person', target: 'Topic' },
  'proficient in': { type: 'KNOWS_ABOUT', direction: 'outgoing', source: 'Person', target: 'Topic' },

  // WORKED_WITH
  'worked with': { type: 'WORKED_WITH', direction: 'bidirectional', source: 'Person', target: 'Person' },
  'collaborated with': { type: 'WORKED_WITH', direction: 'bidirectional', source: 'Person', target: 'Person' },
  'knows': { type: 'WORKED_WITH', direction: 'bidirectional', source: 'Person', target: 'Person' },
  'colleague of': { type: 'WORKED_WITH', direction: 'bidirectional', source: 'Person', target: 'Person' },
  'teammate of': { type: 'WORKED_WITH', direction: 'bidirectional', source: 'Person', target: 'Person' },

  // MENTIONS
  'mentions': { type: 'MENTIONS', direction: 'outgoing', source: 'Note', target: '*' },

  // ABOUT
  'about': { type: 'ABOUT', direction: 'outgoing', source: '*', target: 'Topic' },

  // HAPPENED_ON
  'happened on': { type: 'HAPPENED_ON', direction: 'outgoing', source: 'Meeting', target: 'Date' },

  // HAS_TASK
  'has task': { type: 'HAS_TASK', direction: 'outgoing', source: 'Project', target: 'Task' },
  'todo for': { type: 'HAS_TASK', direction: 'outgoing', source: 'Project', target: 'Task' },
  'action item for': { type: 'HAS_TASK', direction: 'outgoing', source: 'Project', target: 'Task' },
  'tasks for': { type: 'HAS_TASK', direction: 'outgoing', source: 'Project', target: 'Task' },

  // HAS_DECISION
  'decided': { type: 'HAS_DECISION', direction: 'outgoing', source: 'Project', target: 'Decision' },
  'decision for': { type: 'HAS_DECISION', direction: 'outgoing', source: 'Project', target: 'Decision' },
  'rationale for': { type: 'HAS_DECISION', direction: 'outgoing', source: 'Project', target: 'Decision' },
  'decisions made in': { type: 'HAS_DECISION', direction: 'outgoing', source: 'Project', target: 'Decision' }
};

/**
 * Time period mapping for temporal queries
 * Maps natural language time phrases to ISO 8601 durations
 */
export const TIME_PERIOD_MAPPINGS = {
  'today': 'P0D',
  'yesterday': 'P1D',
  'this week': 'P7D',
  'last week': 'P7D',
  'this month': 'P30D',
  'last month': 'P30D',
  'this year': 'P365D',
  'last year': 'P365D'
};

/**
 * Select appropriate Cypher template based on question pattern
 *
 * @param {string} question - Natural language question
 * @param {Array} entities - Extracted entities from question
 * @returns {string} Template identifier ('entity_lookup', 'relationship_query', etc.)
 */
export function selectCypherTemplate(question, entities = []) {
  const lowerQuestion = question.toLowerCase().trim();

  // Entity lookup pattern
  if (lowerQuestion.match(/^(who|what) is /i) || lowerQuestion.match(/^tell me about /i)) {
    return 'entity_lookup';
  }

  // Relationship pattern
  const relationshipRegex = /(works on|work on|working on|works at|employed by|developer for|contributes to|leads|led by|manages|managed by|manager of|head of|director of|owner of|runs|attended|went to|was at|participant in|present at|discussed|talked about|covered|regarding|uses|built with|written in|powered by|stack includes|depends on|worked with|collaborated with|knows about|knows|colleague of|teammate of|expert in|familiar with|skills in|proficient in|has task|todo for|action item for|tasks for|decided|decision for|rationale for|decisions made in|mentions|about|happened on)/i;
  if (lowerQuestion.match(relationshipRegex)) {
    return 'relationship_query';
  }

  // Temporal pattern
  if (lowerQuestion.match(/(today|yesterday|this week|last week|this month|last month|this year|last year)/i)) {
    return 'temporal_query';
  }

  // Count pattern
  if (lowerQuestion.match(/^how many/i) || lowerQuestion.match(/^count/i)) {
    return 'count_query';
  }

  // List pattern
  if (lowerQuestion.match(/(list all|show me all|what .* have i)/i)) {
    return 'list_query';
  }

  // No template match - fall back to LLM generation
  return 'llm_generate';
}

/**
 * Extract entity references from natural language question
 * Uses phrase-based extraction first, falls back to capitalization
 *
 * @param {string} question - Natural language question
 * @returns {Array<{text: string, type: string}>} Extracted entity references
 */
export function extractEntityReferences(question) {
  const entities = [];
  const lowerQuestion = question.toLowerCase();

  // Common question words to ignore (Stoplist)
  const STOP_WORDS = new Set([
    'who', 'what', 'where', 'when', 'why', 'how',
    'is', 'are', 'was', 'were', 'do', 'does', 'did',
    'can', 'could', 'should', 'would',
    'tell', 'me', 'about', 'list', 'show', 'find',
    'the', 'a', 'an', 'my', 'your', 'his', 'her', 'their'
  ]);

  // Helper to clean and add entity
  const addEntity = (text) => {
    if (!text) return;

    // Split by spaces and filter stop words
    const parts = text.split(/\s+/).filter(p => {
      const clean = p.replace(/[^\w]/g, '').toLowerCase();
      return clean.length > 0 && !STOP_WORDS.has(clean);
    });

    if (parts.length === 0) return;

    // Reconstruct the entity name (preserve original casing from input if possible, 
    // but here we might only have the segment. For now, just use the filtered text)
    // Actually, let's just use the raw segment but trim it, and let the resolver handle it.
    // But we must remove leading/trailing stop words.

    // Better approach: Remove known stop words from start/end of the string
    let cleanText = text.trim();

    // Remove leading stop words and punctuation
    let words = cleanText.split(/\s+/);
    while (words.length > 0) {
      const firstWordClean = words[0].replace(/[^\w]/g, '').toLowerCase();
      if (STOP_WORDS.has(firstWordClean) || firstWordClean.length === 0) {
        words.shift();
      } else {
        break;
      }
    }

    // Remove trailing stop words and punctuation
    while (words.length > 0) {
      const lastWordClean = words[words.length - 1].replace(/[^\w]/g, '').toLowerCase();
      if (STOP_WORDS.has(lastWordClean) || lastWordClean.length === 0) {
        words.pop();
      } else {
        break;
      }
    }

    cleanText = words.join(' ');

    // Final cleanup: remove any remaining leading/trailing non-word characters (like ?)
    cleanText = cleanText.replace(/^[^\w]+|[^\w]+$/g, '');

    if (cleanText.length > 1) { // Avoid single chars unless meaningful?
      // Check if we already added this entity
      if (!entities.some(e => e.text.toLowerCase() === cleanText.toLowerCase())) {
        entities.push({
          text: cleanText,
          type: 'unknown'
        });
      }
    }
  };

  // Strategy 1: Phrase-Based Extraction
  // Sort phrases by length (descending) to match longest first
  const phrases = Object.keys(RELATIONSHIP_MAPPINGS).sort((a, b) => b.length - a.length);

  for (const phrase of phrases) {
    const phraseIndex = lowerQuestion.indexOf(phrase);
    if (phraseIndex !== -1) {
      // Found a relationship phrase!
      // Split into Left (Subject) and Right (Object)
      const leftPart = question.substring(0, phraseIndex).trim();
      const rightPart = question.substring(phraseIndex + phrase.length).trim();

      addEntity(leftPart);
      addEntity(rightPart);

      // If we found entities via phrase, we can return early or continue?
      // Usually a simple query has one main relationship.
      // Let's return if we found something, to avoid over-extraction.
      if (entities.length > 0) return entities;
    }
  }

  // Strategy 2: Fallback to Capitalization (Improved)
  // This handles "Who is Sarah?" where "is" might not be in RELATIONSHIP_MAPPINGS 
  // (though "is" is a stop word, so "Sarah" would be found).
  // Or "Tell me about GraphMind".

  const words = question.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const rawWord = words[i];
    const word = rawWord.replace(/[^\w]/g, '');

    // Check if capitalized and NOT a stop word
    if (word.length > 0 &&
      word[0] === word[0].toUpperCase() &&
      word.length > 1 &&
      !STOP_WORDS.has(word.toLowerCase())) {

      addEntity(word);
    }
  }

  return entities;
}

/**
 * Build complete Cypher query from template and parameters
 *
 * @param {string} template - Template identifier
 * @param {Object} params - Query parameters
 * @returns {Object} { cypher, parameters, templateUsed }
 */
export function buildCypherQuery(template, params) {
  const { userNamespace, entityType, entityName, sourceType, sourceName, relType, targetType, dateProperty, duration, filterProperty, filterValue, condition } = params;

  let cypher;
  const parameters = {};

  switch (template) {
    case 'entity_lookup':
      cypher = entityLookupTemplate(userNamespace, entityType, entityName);
      parameters.entity_name = entityName;
      break;

    case 'relationship_query':
      cypher = relationshipQueryTemplate(userNamespace, sourceType, sourceName, relType, targetType, params.direction);
      parameters.source_name = sourceName;
      break;

    case 'temporal_query':
      cypher = temporalQueryTemplate(userNamespace, entityType, dateProperty, duration);
      parameters.time_period = duration;
      break;

    case 'list_query':
      cypher = listQueryTemplate(userNamespace, entityType, filterProperty, filterValue);
      if (filterValue) {
        parameters.filter_value = filterValue;
      }
      break;

    case 'count_query':
      cypher = countQueryTemplate(userNamespace, entityType, condition);
      break;

    default:
      throw new Error(`Unknown template: ${template}`);
  }

  return {
    cypher,
    parameters,
    templateUsed: template
  };
}
