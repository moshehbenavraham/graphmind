/**
 * LLM Prompt Builder
 * Feature: 005-entity-extraction
 *
 * Constructs system and user prompts for entity extraction via Workers AI.
 * Uses Llama 3.1-8b-instruct with structured JSON output.
 */

import { ENTITY_TYPES } from '../../models/entity.model.js';

/**
 * System prompt for entity extraction
 * Defines the task, entity types, output format, and rules
 */
export const ENTITY_EXTRACTION_SYSTEM_PROMPT = `You are an entity extraction assistant. Extract entities from voice transcripts and return structured JSON.

ENTITY TYPES (exactly 7):
1. Person: Individual names (extract: name, email if mentioned, phone if mentioned, role if mentioned)
2. Project: Work initiatives or personal projects (extract: name, description, status, associated technologies)
3. Meeting: Gatherings or events (extract: date, time if mentioned, topic, participants)
4. Topic: Subjects or themes discussed (extract: name, category)
5. Technology: Tools, frameworks, languages (extract: name, version if mentioned, category)
6. Location: Places (extract: name, address if mentioned, city, country if mentioned)
7. Organization: Companies, teams, institutions (extract: name, industry if mentioned)

OUTPUT FORMAT (strict JSON):
{
  "entities": [
    {
      "type": "Person" | "Project" | "Meeting" | "Topic" | "Technology" | "Location" | "Organization",
      "name": "canonical name (most complete form mentioned)",
      "confidence": 0.0 to 1.0 (your certainty about this entity),
      "properties": {
        // type-specific properties
      }
    }
  ]
}

RULES:
- Only extract entities with confidence ≥ 0.8
- Use full names when available (e.g., "Sarah Johnson" not just "Sarah")
- If unsure about entity type, use the most specific type that fits
- Preserve exact names/spellings from transcript
- Include properties only if explicitly mentioned
- Return empty array if no entities found (valid outcome)
- Do not hallucinate properties not in the transcript
- Do not extract pronouns (he, she, it) as entities
- Do not extract common words unless clearly an entity (e.g., "apple" the fruit vs "Apple" the company)

Return ONLY valid JSON, no additional text.`;

/**
 * Build entity extraction prompt messages for Workers AI
 *
 * @param {string} transcript - Voice note transcript
 * @returns {Array} Messages array for Workers AI API
 */
export function buildExtractionPrompt(transcript) {
  if (!transcript || typeof transcript !== 'string') {
    throw new Error('Transcript must be a non-empty string');
  }

  const trimmedTranscript = transcript.trim();
  if (trimmedTranscript.length === 0) {
    throw new Error('Transcript cannot be empty');
  }

  return [
    {
      role: 'system',
      content: ENTITY_EXTRACTION_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: trimmedTranscript,
    },
  ];
}

/**
 * Build entity extraction prompt with examples (for improved accuracy)
 * Includes few-shot examples to guide the LLM
 *
 * @param {string} transcript - Voice note transcript
 * @returns {Array} Messages array with examples
 */
export function buildExtractionPromptWithExamples(transcript) {
  if (!transcript || typeof transcript !== 'string') {
    throw new Error('Transcript must be a non-empty string');
  }

  const trimmedTranscript = transcript.trim();
  if (trimmedTranscript.length === 0) {
    throw new Error('Transcript cannot be empty');
  }

  const exampleTranscript = `I met with Sarah Johnson yesterday to discuss the FastAPI migration project. We're moving from Flask to FastAPI for better performance. Sarah mentioned she'll coordinate with the DevOps team at TechCorp about deployment.`;

  const exampleOutput = {
    entities: [
      {
        type: 'Person',
        name: 'Sarah Johnson',
        confidence: 0.95,
        properties: {
          role: 'coordinator',
        },
      },
      {
        type: 'Project',
        name: 'FastAPI Migration',
        confidence: 0.92,
        properties: {
          description: 'Moving from Flask to FastAPI',
          status: 'in_progress',
          technologies: ['Flask', 'FastAPI'],
        },
      },
      {
        type: 'Technology',
        name: 'Flask',
        confidence: 0.98,
        properties: {},
      },
      {
        type: 'Technology',
        name: 'FastAPI',
        confidence: 0.98,
        properties: {},
      },
      {
        type: 'Organization',
        name: 'TechCorp',
        confidence: 0.88,
        properties: {},
      },
      {
        type: 'Topic',
        name: 'deployment',
        confidence: 0.82,
        properties: {
          category: 'operations',
        },
      },
    ],
  };

  return [
    {
      role: 'system',
      content: ENTITY_EXTRACTION_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: exampleTranscript,
    },
    {
      role: 'assistant',
      content: JSON.stringify(exampleOutput, null, 2),
    },
    {
      role: 'user',
      content: trimmedTranscript,
    },
  ];
}

/**
 * Build prompt for re-extraction with stricter format instructions
 * Used when initial extraction returns invalid JSON
 *
 * @param {string} transcript - Voice note transcript
 * @returns {Array} Messages array with stricter instructions
 */
export function buildStrictExtractionPrompt(transcript) {
  const strictSystemPrompt = `${ENTITY_EXTRACTION_SYSTEM_PROMPT}

CRITICAL: Your response must be ONLY valid JSON. Do not include any explanation, commentary, or markdown formatting. Start your response with { and end with }.`;

  return [
    {
      role: 'system',
      content: strictSystemPrompt,
    },
    {
      role: 'user',
      content: transcript.trim(),
    },
  ];
}

/**
 * Get entity type descriptions for prompt customization
 *
 * @returns {Object} Entity type descriptions
 */
export function getEntityTypeDescriptions() {
  return {
    [ENTITY_TYPES.PERSON]: {
      description: 'Individual names',
      properties: ['name', 'email', 'phone', 'role'],
      examples: ['Sarah Johnson', 'Dr. Robert Chen', 'Emma (Team Lead)'],
    },
    [ENTITY_TYPES.PROJECT]: {
      description: 'Work initiatives or personal projects',
      properties: ['name', 'description', 'status', 'technologies'],
      examples: ['FastAPI Migration', 'Q4 Marketing Campaign', 'Home Renovation'],
    },
    [ENTITY_TYPES.MEETING]: {
      description: 'Gatherings or events',
      properties: ['date', 'time', 'topic', 'participants'],
      examples: ['Weekly standup', 'Client presentation on Friday', 'Birthday party'],
    },
    [ENTITY_TYPES.TOPIC]: {
      description: 'Subjects or themes discussed',
      properties: ['name', 'category'],
      examples: ['Machine learning', 'Budget planning', 'Customer feedback'],
    },
    [ENTITY_TYPES.TECHNOLOGY]: {
      description: 'Tools, frameworks, languages',
      properties: ['name', 'version', 'category'],
      examples: ['Python', 'Docker', 'PostgreSQL', 'React 18'],
    },
    [ENTITY_TYPES.LOCATION]: {
      description: 'Physical or virtual places',
      properties: ['name', 'address', 'city', 'country'],
      examples: ['San Francisco', 'Building B Conference Room', 'New York office'],
    },
    [ENTITY_TYPES.ORGANIZATION]: {
      description: 'Companies, teams, institutions',
      properties: ['name', 'industry'],
      examples: ['TechCorp', 'Stanford University', 'DevOps team'],
    },
  };
}

/**
 * Calculate estimated token count for prompt
 * Rough estimate: ~4 characters per token
 *
 * @param {string} transcript - Voice note transcript
 * @returns {number} Estimated token count
 */
export function estimateTokenCount(transcript) {
  const systemPromptTokens = Math.ceil(ENTITY_EXTRACTION_SYSTEM_PROMPT.length / 4);
  const transcriptTokens = Math.ceil(transcript.length / 4);
  return systemPromptTokens + transcriptTokens;
}

/**
 * Check if transcript is too long for single extraction
 * Max recommended: 5000 words (~6000 tokens)
 *
 * @param {string} transcript - Voice note transcript
 * @returns {boolean} True if transcript should be chunked
 */
export function shouldChunkTranscript(transcript) {
  const wordCount = transcript.trim().split(/\s+/).length;
  return wordCount > 5000;
}
