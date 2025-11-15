/**
 * Answer Generator Service
 * Feature 009: Answer Generation with LLM
 *
 * Generates natural language answers from FalkorDB query results using Workers AI.
 * Includes validation, caching, and citation extraction.
 */

import { formatPrompt, generateEmptyResponse, getLLMConfig } from '../prompts/answer-generation.js';
import { formatGraphContext, formatSourceCitations } from '../lib/graph/context-formatter.js';
import { validateAnswer, ValidationFailedError } from '../lib/validation/answer-validator.js';
import { getCachedAnswer, cacheAnswer } from '../lib/cache/kv-cache.js';

/**
 * Custom error for LLM timeouts
 */
export class LLMTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LLMTimeoutError';
  }
}

/**
 * Custom error for LLM service errors
 */
export class LLMServiceError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'LLMServiceError';
    this.originalError = originalError;
  }
}

/**
 * AnswerGenerator Service Class
 */
export class AnswerGenerator {
  constructor(env, ctx) {
    this.env = env;
    this.ctx = ctx;
    this.maxRegenerationAttempts = 1;
  }

  /**
   * Generate natural language answer from query results
   * @param {Object} options - Generation options
   * @param {string} options.question - User's question
   * @param {Object} options.queryResults - FalkorDB query results
   * @param {string} options.userId - User ID for caching
   * @param {string} options.sessionId - Optional session ID
   * @returns {Promise<Object>} - Generated answer object
   */
  async generate({ question, queryResults, userId, sessionId }) {
    const startTime = Date.now();

    // Check cache first
    const cached = await getCachedAnswer(this.env, userId, question);
    if (cached) {
      return {
        answer: cached.answer,
        sources: cached.sources,
        latency_ms: Date.now() - startTime,
        cached: true,
        cache_age_ms: cached.cache_age_ms,
        validation_passed: true,
        confidence: cached.confidence || 1.0
      };
    }

    // Check for empty results
    if (this.isEmpty(queryResults)) {
      const emptyAnswer = generateEmptyResponse(question);
      return {
        answer: emptyAnswer,
        sources: [],
        latency_ms: Date.now() - startTime,
        cached: false,
        empty_results: true,
        validation_passed: true,
        confidence: 1.0
      };
    }

    // Format context for LLM
    const context = formatGraphContext(queryResults);

    // Generate answer with LLM
    let rawAnswer;
    let validationResult;
    let attempts = 0;

    try {
      // First attempt
      rawAnswer = await this.callLLM(question, context, false);
      validationResult = validateAnswer(rawAnswer, queryResults);

      // Regenerate if validation fails
      if (!validationResult.isValid && attempts < this.maxRegenerationAttempts) {
        attempts++;
        console.log(`Validation failed (attempt ${attempts}), regenerating with strict mode...`, validationResult.issues);
        rawAnswer = await this.callLLM(question, context, true);
        validationResult = validateAnswer(rawAnswer, queryResults);
      }

      // If still failed, throw error
      if (!validationResult.isValid) {
        throw new ValidationFailedError(
          'Answer validation failed after regeneration',
          validationResult.issues
        );
      }
    } catch (error) {
      if (error instanceof ValidationFailedError || error instanceof LLMTimeoutError || error instanceof LLMServiceError) {
        throw error;
      }
      throw new LLMServiceError('Failed to generate answer', error);
    }

    // Extract citations
    const citations = await this.extractCitations(queryResults);

    // Build final answer
    const finalAnswer = {
      answer: rawAnswer,
      sources: citations,
      latency_ms: Date.now() - startTime,
      cached: false,
      validation_passed: validationResult.isValid,
      confidence: validationResult.confidence
    };

    // Cache answer asynchronously (don't await)
    this.ctx.waitUntil(
      cacheAnswer(
        this.env,
        userId,
        question,
        finalAnswer,
        parseInt(this.env.ANSWER_CACHE_TTL || '3600')
      )
    );

    return finalAnswer;
  }

  /**
   * Call Workers AI LLM with timeout
   * @param {string} question - User's question
   * @param {string} context - Formatted context
   * @param {boolean} strictMode - Use strict prompt
   * @returns {Promise<string>} - Generated answer text
   */
  async callLLM(question, context, strictMode = false) {
    const prompt = formatPrompt(question, context, strictMode);
    const llmConfig = getLLMConfig(strictMode);

    // Create timeout promise (5 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new LLMTimeoutError('LLM call exceeded 5 second timeout')), 5000);
    });

    // Create LLM call promise
    const llmPromise = this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      temperature: llmConfig.temperature,
      max_tokens: llmConfig.max_tokens
    });

    // Race timeout vs LLM call
    try {
      const response = await Promise.race([llmPromise, timeoutPromise]);
      return response.response || response.text || '';
    } catch (error) {
      if (error instanceof LLMTimeoutError) {
        throw error;
      }
      throw new LLMServiceError('Workers AI call failed', error);
    }
  }

  /**
   * Check if query results are empty
   * @param {Object} queryResults - Query results
   * @returns {boolean} - Whether results are empty
   */
  isEmpty(queryResults) {
    const hasEntities = queryResults.entities && queryResults.entities.length > 0;
    const hasRelationships = queryResults.relationships && queryResults.relationships.length > 0;
    return !hasEntities && !hasRelationships;
  }

  /**
   * Extract citations from query results metadata
   * @param {Object} queryResults - Query results with metadata
   * @returns {Promise<Array<Object>>} - Citation objects
   */
  async extractCitations(queryResults) {
    const sources = queryResults.metadata?.sources || [];

    if (sources.length === 0) {
      return [];
    }

    // Fetch note metadata from D1 (batch query)
    try {
      const noteIds = sources.map(s => typeof s === 'string' ? s : s.note_id);
      const placeholders = noteIds.map(() => '?').join(',');

      const result = await this.env.DB.prepare(
        `SELECT note_id, created_at, transcript FROM voice_notes WHERE note_id IN (${placeholders}) LIMIT 20`
      ).bind(...noteIds).all();

      // Format citations
      return result.results.map(note => ({
        note_id: note.note_id,
        timestamp: note.created_at,
        snippet: note.transcript ? note.transcript.substring(0, 50) + '...' : null
      }));
    } catch (error) {
      console.error('Failed to fetch note metadata for citations:', error);
      // Return basic citations without metadata
      return sources.map(s => ({
        note_id: typeof s === 'string' ? s : s.note_id,
        timestamp: null,
        snippet: null
      }));
    }
  }

  /**
   * Detect query type from question text
   * @param {string} question - User's question
   * @returns {string} - Query type (entity, relationship, temporal, count, list)
   */
  detectQueryType(question) {
    const q = question.toLowerCase();

    // Count queries
    if (q.includes('how many') || q.includes('count')) {
      return 'count';
    }

    // List queries
    if (q.startsWith('list') || q.startsWith('show all') || q.includes('what are all')) {
      return 'list';
    }

    // Temporal queries
    if (q.includes('when') || q.includes('last week') || q.includes('yesterday') || q.includes('last month')) {
      return 'temporal';
    }

    // Entity description queries
    if (q.startsWith('who is') || q.startsWith('what is')) {
      return 'entity';
    }

    // Relationship queries
    if (q.includes('works on') || q.includes('related to') || q.includes('connected to')) {
      return 'relationship';
    }

    // Default to entity
    return 'entity';
  }
}
