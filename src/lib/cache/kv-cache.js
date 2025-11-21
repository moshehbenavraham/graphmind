/**
 * KV Cache Utilities for Answer Generation
 * Feature 009: Answer Generation with LLM
 *
 * Provides caching functionality for generated answers to achieve <100ms cached response time.
 */

import crypto from 'crypto';

/**
 * Generate SHA-256 hash of normalized query text
 * @param {string} question - User's question text
 * @returns {string} - Hex-encoded hash
 */
export function hashQuery(question) {
  const normalized = normalizeQuestion(question);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Normalize question text for consistent caching
 * @param {string} question - Raw question text
 * @returns {string} - Normalized question (lowercase, trimmed, punctuation removed)
 */
export function normalizeQuestion(question) {
  return question
    .toLowerCase()
    .trim()
    .replace(/[?.!,;:]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Build cache key for answer caching
 * Format: answer_cache:{user_id}:{query_hash}
 * @param {string} userId - User ID for data isolation
 * @param {string} queryHash - Hash of normalized question
 * @returns {string} - Cache key
 */
export function buildCacheKey(userId, queryHash) {
  return `answer_cache:${userId}:${queryHash}`;
}

/**
 * Cache generated answer in KV
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {string} question - Original question text
 * @param {Object} answer - Generated answer object
 * @param {number} ttl - Cache TTL in seconds (default: 3600)
 * @returns {Promise<void>}
 */
export async function cacheAnswer(env, userId, question, answer, ttl = 3600) {
  const queryHash = hashQuery(question);
  const cacheKey = buildCacheKey(userId, queryHash);

  const cacheValue = {
    answer: answer.answer,
    sources: answer.sources || [],
    cached_at: Date.now(),
    query_text: question,
    latency_ms: answer.latency_ms,
    confidence: answer.confidence
  };

  await env.KV.put(cacheKey, JSON.stringify(cacheValue), {
    expirationTtl: ttl
  });
}

/**
 * Get cached answer from KV
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {string} question - Question text
 * @returns {Promise<Object|null>} - Cached answer or null if cache miss
 */
export async function getCachedAnswer(env, userId, question) {
  const queryHash = hashQuery(question);
  const cacheKey = buildCacheKey(userId, queryHash);

  const cached = await env.KV.get(cacheKey, 'json');

  if (cached) {
    return {
      ...cached,
      cached: true,
      cache_age_ms: Date.now() - cached.cached_at
    };
  }

  return null;
}

/**
 * Invalidate cache key (for entity updates)
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @param {string} queryHash - Specific query hash to invalidate
 * @returns {Promise<void>}
 */
export async function invalidateCacheKey(env, userId, queryHash) {
  const cacheKey = buildCacheKey(userId, queryHash);
  await env.KV.delete(cacheKey);
}

/**
 * Invalidate all answer cache keys for a user (bulk invalidation)
 * Use when entity updates affect multiple potential answers
 * @param {Object} env - Worker environment bindings
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of keys invalidated
 */
export async function invalidateUserCache(env, userId) {
  const prefix = `answer_cache:${userId}:`;
  const keys = await env.KV.list({ prefix });

  let invalidated = 0;
  for (const key of keys.keys) {
    await env.KV.delete(key.name);
    invalidated++;
  }

  return invalidated;
}
