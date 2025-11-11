/**
 * Entity Extraction Service
 * Feature: 005-entity-extraction
 *
 * Integrates with Workers AI (@cf/meta/llama-3.1-8b-instruct) to extract entities from transcripts.
 * Handles LLM invocation, response parsing, validation, and confidence filtering.
 */

import { buildExtractionPrompt, buildStrictExtractionPrompt } from '../lib/entity-utils/llm-prompt-builder.js';
import { filterByConfidence, DEFAULT_CONFIDENCE_THRESHOLD } from '../lib/entity-utils/confidence-filter.js';
import { validateEntities } from '../models/entity.model.js';

/**
 * Extract entities from transcript using Workers AI
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} transcript - Voice note transcript
 * @param {Object} options - Extraction options
 * @param {number} options.confidenceThreshold - Minimum confidence (default: 0.8)
 * @param {boolean} options.strictMode - Use strict JSON formatting (default: false)
 * @param {number} options.maxTokens - Max tokens for LLM (default: 2000)
 * @param {number} options.temperature - LLM temperature (default: 0.3)
 * @returns {Promise<Object>} Extraction result with entities and metadata
 */
export async function extractEntities(env, transcript, options = {}) {
  const {
    confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
    strictMode = false,
    maxTokens = 2000,
    temperature = 0.3,
  } = options;

  // Validate inputs
  if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
    throw new Error('Transcript is required and must be a non-empty string');
  }

  if (!env.AI) {
    throw new Error('Workers AI binding not available');
  }

  const startTime = Date.now();

  try {
    // Step 1: Build prompt
    const messages = strictMode
      ? buildStrictExtractionPrompt(transcript)
      : buildExtractionPrompt(transcript);

    // Step 2: Call Workers AI
    const llmResponse = await callWorkersAI(env, messages, {
      maxTokens,
      temperature,
    });

    // Step 3: Parse JSON response
    const parsedEntities = parseExtractionResponse(llmResponse);

    // Step 4: Validate entities
    const validation = validateEntities(parsedEntities);
    if (!validation.valid) {
      console.warn('Entity validation failed:', validation.invalidEntities);
    }

    // Step 5: Filter by confidence
    const { passed: highConfidenceEntities, filtered: lowConfidenceEntities } = filterByConfidence(
      validation.validEntities,
      confidenceThreshold
    );

    const processingTime = Date.now() - startTime;

    return {
      entities: highConfidenceEntities,
      metadata: {
        total_extracted: parsedEntities.length,
        validation_passed: validation.validEntities.length,
        validation_failed: validation.invalidEntities.length,
        confidence_filtered: lowConfidenceEntities.length,
        final_count: highConfidenceEntities.length,
        processing_time_ms: processingTime,
        model: '@cf/meta/llama-3.1-8b-instruct',
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Check if this was a JSON parsing error and retry might help
    if (error.message.includes('JSON') && !strictMode) {
      console.warn('JSON parsing failed, retrying with strict mode');
      return extractEntities(env, transcript, {
        ...options,
        strictMode: true,
      });
    }

    throw new Error(`Entity extraction failed: ${error.message}`, {
      cause: {
        originalError: error,
        processingTime,
      },
    });
  }
}

/**
 * Call Workers AI with retry logic
 *
 * @param {Object} env - Worker environment bindings
 * @param {Array} messages - Messages array for LLM
 * @param {Object} options - LLM options
 * @returns {Promise<Object>} LLM response
 */
async function callWorkersAI(env, messages, options) {
  const { maxTokens, temperature } = options;

  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    });

    if (!response) {
      throw new Error('Workers AI returned empty response');
    }

    return response;
  } catch (error) {
    // Check for specific error types
    if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
      throw new Error('LLM request timed out (>10s)');
    }

    if (error.message?.includes('503') || error.message?.includes('unavailable')) {
      throw new Error('Workers AI service unavailable');
    }

    throw new Error(`Workers AI invocation failed: ${error.message}`);
  }
}

/**
 * Parse LLM response and extract entities array
 *
 * @param {Object} llmResponse - Raw LLM response
 * @returns {Array} Array of extracted entities
 */
function parseExtractionResponse(llmResponse) {
  try {
    // Workers AI response format: { response: "JSON string" } or { response: { ... } }
    let content;

    if (typeof llmResponse.response === 'string') {
      content = llmResponse.response;
    } else if (llmResponse.response && typeof llmResponse.response === 'object') {
      // Already parsed JSON
      if (Array.isArray(llmResponse.response.entities)) {
        return llmResponse.response.entities;
      }
      throw new Error('Invalid response structure: missing entities array');
    } else {
      throw new Error('Invalid LLM response format');
    }

    // Try to parse JSON from string content
    // Handle cases where LLM may include markdown formatting
    let jsonContent = content.trim();

    // Remove markdown code blocks if present
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Parse JSON
    const parsed = JSON.parse(jsonContent);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Parsed response is not an object');
    }

    if (!Array.isArray(parsed.entities)) {
      throw new Error('Response missing entities array');
    }

    return parsed.entities;
  } catch (error) {
    throw new Error(`Failed to parse LLM response as JSON: ${error.message}`);
  }
}

/**
 * Extract entities from batch of transcripts
 *
 * @param {Object} env - Worker environment bindings
 * @param {Array} transcripts - Array of transcript strings
 * @param {Object} options - Extraction options
 * @returns {Promise<Array>} Array of extraction results
 */
export async function extractEntitiesBatch(env, transcripts, options = {}) {
  if (!Array.isArray(transcripts)) {
    throw new Error('Transcripts must be an array');
  }

  const results = [];

  for (const transcript of transcripts) {
    try {
      const result = await extractEntities(env, transcript, options);
      results.push({
        success: true,
        ...result,
      });
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
        transcript: transcript.substring(0, 100) + '...',
      });
    }
  }

  return results;
}

/**
 * Check if transcript should be chunked before extraction
 * Splits long transcripts (>5000 words) into smaller segments
 *
 * @param {string} transcript - Voice note transcript
 * @param {number} maxWords - Max words per chunk (default: 5000)
 * @returns {Array<string>} Array of transcript chunks
 */
export function chunkTranscript(transcript, maxWords = 5000) {
  const words = transcript.trim().split(/\s+/);

  if (words.length <= maxWords) {
    return [transcript];
  }

  const chunks = [];
  let currentChunk = [];

  for (let i = 0; i < words.length; i++) {
    currentChunk.push(words[i]);

    if (currentChunk.length >= maxWords || i === words.length - 1) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
    }
  }

  return chunks;
}

/**
 * Merge entities from multiple chunks (deduplicates by name)
 *
 * @param {Array<Array>} entityChunks - Array of entity arrays from chunks
 * @returns {Array} Merged and deduplicated entities
 */
export function mergeChunkedEntities(entityChunks) {
  const entityMap = new Map();

  entityChunks.forEach(entities => {
    entities.forEach(entity => {
      const key = `${entity.type}:${entity.name.toLowerCase()}`;

      if (!entityMap.has(key)) {
        entityMap.set(key, entity);
      } else {
        // Keep entity with higher confidence
        const existing = entityMap.get(key);
        if (entity.confidence > existing.confidence) {
          entityMap.set(key, entity);
        }
      }
    });
  });

  return Array.from(entityMap.values());
}
