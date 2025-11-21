/**
 * Voice Queries D1 Database Operations
 * Feature 008 & 009: Voice Query Input and Answer Generation
 *
 * Handles D1 operations for voice_queries table including answer persistence.
 */

/**
 * Update answer column in voice_queries table
 * @param {Object} env - Worker environment bindings
 * @param {string} queryId - Query ID
 * @param {string} userId - User ID (for data isolation)
 * @param {string} answer - Generated answer text
 * @param {Array<Object>} sources - Source citation objects
 * @param {number} latencyMs - Answer generation latency
 * @returns {Promise<Object>} - Update result
 */
export async function updateQueryAnswer(env, queryId, userId, answer, sources, latencyMs) {
  try {
    const sourcesJson = sources && sources.length > 0 ? JSON.stringify(sources) : null;

    const result = await env.DB.prepare(`
      UPDATE voice_queries
      SET answer = ?,
          sources = ?,
          latency_ms = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE query_id = ? AND user_id = ?
    `).bind(answer, sourcesJson, latencyMs, queryId, userId).run();

    return {
      success: result.success,
      rowsAffected: result.meta.changes
    };
  } catch (error) {
    console.error('Failed to update query answer:', error);
    throw new Error(`Failed to update answer for query ${queryId}: ${error.message}`);
  }
}

/**
 * Fetch query history with answers for conversation context
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @param {number} limit - Number of queries to fetch (default: 5)
 * @returns {Promise<Array<Object>>} - Query history
 */
export async function getQueryHistory(env, userId, sessionId, limit = 5) {
  try {
    const result = await env.DB.prepare(`
      SELECT query_id, question, answer, sources, created_at, latency_ms
      FROM voice_queries
      WHERE user_id = ? AND session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(userId, sessionId, limit).all();

    return result.results.map(row => ({
      query_id: row.query_id,
      question: row.question,
      answer: row.answer,
      sources: row.sources ? JSON.parse(row.sources) : [],
      created_at: row.created_at,
      latency_ms: row.latency_ms
    }));
  } catch (error) {
    console.error('Failed to fetch query history:', error);
    return [];
  }
}

/**
 * Check if answer exists in D1 for cache fallback
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {string} question - Question text
 * @returns {Promise<Object|null>} - Cached answer or null
 */
export async function getAnswerFromD1(env, userId, question) {
  try {
    const result = await env.DB.prepare(`
      SELECT answer, sources, latency_ms, created_at
      FROM voice_queries
      WHERE user_id = ? AND question = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(userId, question).first();

    if (result && result.answer) {
      return {
        answer: result.answer,
        sources: result.sources ? JSON.parse(result.sources) : [],
        latency_ms: result.latency_ms,
        cached_at: new Date(result.created_at).getTime()
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch answer from D1:', error);
    return null;
  }
}

/**
 * Create new voice query record
 * @param {Object} env - Worker environment bindings
 * @param {Object} queryData - Query data
 * @returns {Promise<string>} - Created query ID
 */
export async function createVoiceQuery(env, queryData) {
  const {
    query_id,
    user_id,
    session_id,
    question,
    cypher_query,
    query_results
  } = queryData;

  try {
    await env.DB.prepare(`
      INSERT INTO voice_queries (query_id, user_id, session_id, question, cypher_query, query_results, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      query_id,
      user_id,
      session_id,
      question,
      cypher_query || null,
      query_results ? JSON.stringify(query_results) : null
    ).run();

    return query_id;
  } catch (error) {
    console.error('Failed to create voice query:', error);
    throw new Error(`Failed to create query: ${error.message}`);
  }
}
