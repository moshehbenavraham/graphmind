/**
 * LLM Prompt Templates for Answer Generation
 * Feature 009: Answer Generation with LLM
 *
 * Defines prompt templates, constants, and formatting utilities for generating
 * natural language answers from knowledge graph query results.
 */

/**
 * Prompt Configuration Constants
 * Optimized after performance testing (Feature 009 - Final Phase)
 */
export const PROMPT_CONFIG = {
  // LLM temperature (0.0-1.0)
  // 0.6 = optimal balance of conversational naturalness + factual accuracy
  // Lower than 0.7 reduces hallucination risk while maintaining readability
  temperature: 0.6,

  // Maximum tokens for answer generation
  // ~200 tokens = 2-3 sentences (50-75 words)
  // Reduced from initial testing to optimize latency
  max_tokens: 200,

  // System instruction emphasis
  strict_mode: false // Set to true for regeneration after validation failure
};

/**
 * Main answer generation prompt template
 * Optimized for token efficiency while maintaining quality
 * Emphasizes factual accuracy and prevents hallucinations
 */
export const ANSWER_GENERATION_PROMPT = `Answer this question using ONLY the provided data.

Question: "{user_question}"

Data:
{formatted_graph_context}

Rules:
- Use ONLY facts from data above
- If no data: "I don't have any notes about that. Would you like to add a note?"
- Be concise (2-3 sentences)
- Include specific details (dates, names, numbers)
- Cite sources naturally (e.g., "from your meeting on Nov 3rd")
- Use conversational language (avoid "nodes", "entities", "relationships")
- Do NOT add, speculate, or assume anything

Answer:`;

/**
 * Strict regeneration prompt (used after validation failure)
 * Optimized for token efficiency with stronger hallucination prevention
 */
export const STRICT_ANSWER_PROMPT = `Answer using ONLY the exact data provided. Count carefully.

Question: "{user_question}"

Data:
{formatted_graph_context}

CRITICAL:
- State ONLY facts explicitly in data above
- Count accurately: 3 items = say "3" (not 5, not "several")
- Missing entities/properties = do NOT mention
- Cite sources naturally
- 2-3 sentences, conversational

Verify every fact is in the data. Count carefully.

Answer:`;

/**
 * "I don't know" response template for empty results
 */
export const EMPTY_RESULT_TEMPLATE = `I don't have any notes about "{entity_name}". Would you like to add a note about {pronoun}?`;

/**
 * Format prompt by inserting question and context
 * @param {string} question - User's question
 * @param {string} context - Formatted graph context
 * @param {boolean} strictMode - Use strict prompt for regeneration
 * @returns {string} - Formatted prompt ready for LLM
 */
export function formatPrompt(question, context, strictMode = false) {
  const template = strictMode ? STRICT_ANSWER_PROMPT : ANSWER_GENERATION_PROMPT;

  return template
    .replace('{user_question}', question)
    .replace('{formatted_graph_context}', context);
}

/**
 * Generate "I don't know" response when results are empty
 * @param {string} question - User's question
 * @returns {string} - Formatted "I don't know" response
 */
export function generateEmptyResponse(question) {
  const entityName = extractEntityName(question);
  const pronoun = determinePronoun(question);

  return EMPTY_RESULT_TEMPLATE
    .replace('{entity_name}', entityName)
    .replace('{pronoun}', pronoun);
}

/**
 * Extract entity name from question for personalized "I don't know" response
 * @param {string} question - User's question
 * @returns {string} - Entity name or "that"
 */
function extractEntityName(question) {
  // Common question words to ignore
  const STOP_WORDS = new Set([
    'who', 'what', 'where', 'when', 'why', 'how',
    'is', 'are', 'was', 'were', 'do', 'does', 'did',
    'can', 'could', 'should', 'would',
    'tell', 'me', 'about', 'list', 'show', 'find',
    'the', 'a', 'an', 'it'
  ]);

  // Simple heuristic: extract capitalized words or quoted phrases
  const quoted = question.match(/"([^"]+)"/);
  if (quoted) return quoted[1];

  // Find all capitalized words
  const words = question.split(/\s+/);
  for (const rawWord of words) {
    const word = rawWord.replace(/[^\w]/g, ''); // Remove punctuation
    if (word.length > 1 &&
      word[0] === word[0].toUpperCase() &&
      !STOP_WORDS.has(word.toLowerCase())) {
      return word;
    }
  }

  // Extract after "about", "who is", "what is" if no capitalized word found
  const aboutMatch = question.match(/(?:about|who is|what is)\s+([^?.!,]+)/i);
  if (aboutMatch) {
    const potentialEntity = aboutMatch[1].trim();
    // Check if the extracted part is just a stop word
    if (!STOP_WORDS.has(potentialEntity.toLowerCase())) {
      return potentialEntity;
    }
  }

  return 'that';
}

/**
 * Determine pronoun (them/it) based on question
 * @param {string} question - User's question
 * @returns {string} - "them" or "it"
 */
function determinePronoun(question) {
  // If question contains "who", likely a person → "them"
  if (/\bwho\b/i.test(question)) return 'them';

  // Otherwise → "it"
  return 'it';
}

/**
 * Get LLM configuration based on mode
 * Optimized temperatures after performance testing
 * @param {boolean} strictMode - Whether to use strict validation mode
 * @returns {Object} - LLM configuration object
 */
export function getLLMConfig(strictMode = false) {
  return {
    // Normal: 0.6 (balanced), Strict: 0.4 (maximum accuracy for regeneration)
    temperature: strictMode ? 0.4 : PROMPT_CONFIG.temperature,
    max_tokens: PROMPT_CONFIG.max_tokens
  };
}
