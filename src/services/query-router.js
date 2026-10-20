/**
 * Query Router - Decides between GraphRAG and Template execution paths
 *
 * GraphRAG path: relationship, temporal, complex queries (semantic understanding)
 * Template path: simple lookups, counts, lists (deterministic, fast)
 *
 * The GraphRAG pipeline uses vector search + graph traversal which:
 * - Handles case-insensitivity via semantic similarity
 * - Finds entities by meaning, not exact spelling
 * - Expands context through graph relationships
 *
 * @module services/query-router
 */

export class QueryRouter {
  /**
   * Classify question type and determine execution path
   *
   * @param {string} question - Natural language question
   * @returns {Object} { type: string, path: 'graphrag' | 'template' }
   */
  classifyQuestion(question) {
    const q = question.toLowerCase();

    // Relationship patterns -> Template with semantic inference
    // "who works on X", "what does X use", "which projects mention Y"
    // Using template path because GraphRAG vector search has issues
    // Template system now has semantic inference for direction detection
    if (q.match(/(who|what|which).*(work|lead|use|attend|know|discuss|mention|involve|manage|create)/)) {
      return { type: 'relationship', path: 'template' };
    }

    // Reverse relationship patterns -> Template
    // "X works on what", "tell me what X does"
    if (q.match(/(work|lead|use|attend|know|discuss|mention).*(on|with|at|about)/)) {
      return { type: 'relationship', path: 'template' };
    }

    // Temporal patterns -> Template (date-based queries work fine with templates)
    // "what did I do last week", "meetings yesterday"
    if (q.match(/(last week|yesterday|this month|recently|today|this week|last month)/)) {
      return { type: 'temporal', path: 'template' };
    }

    // Simple entity lookup -> Template (fast, deterministic)
    // "who is Sarah", "what is GraphMind", "tell me about the project"
    if (q.match(/^(who is|what is|tell me about)\s+/)) {
      return { type: 'entity_lookup', path: 'template' };
    }

    // Count queries -> Template
    // "how many projects", "how many people"
    if (q.match(/^how many/)) {
      return { type: 'count', path: 'template' };
    }

    // List queries -> Template
    // "list all projects", "show me all people"
    if (q.match(/(list all|show me all|show all|what .* have i)/)) {
      return { type: 'list', path: 'template' };
    }

    // Connection/path queries -> Template (uses generic search)
    // "how is X connected to Y", "what's the relationship between"
    if (q.match(/(connect|relationship|related|link|between)/)) {
      return { type: 'connection', path: 'template' };
    }

    // Default: use templates first, they fallback to GraphRAG if needed
    // GraphRAG vector search has issues, so prefer template path
    return { type: 'general', path: 'template' };
  }

  /**
   * Route query to appropriate execution path
   *
   * @param {string} question - Natural language question
   * @returns {Object} { type: string, path: 'graphrag' | 'template' }
   */
  route(question) {
    if (!question || typeof question !== 'string') {
      console.warn('[QueryRouter] Invalid question, defaulting to GraphRAG');
      return { type: 'invalid', path: 'graphrag' };
    }

    const classification = this.classifyQuestion(question);

    console.log('[QueryRouter] Classification:', JSON.stringify(classification), 'Question:', question.substring(0, 50));

    return classification;
  }
}

export default QueryRouter;
