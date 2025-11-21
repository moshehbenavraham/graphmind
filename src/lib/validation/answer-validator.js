/**
 * Answer Validation Utilities
 * Feature 009: Answer Generation with LLM
 *
 * Validates generated answers against query results to prevent hallucinations
 * and ensure factual accuracy.
 */

/**
 * Custom error for validation failures
 */
export class ValidationFailedError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'ValidationFailedError';
    this.issues = issues;
  }
}

/**
 * Validate generated answer against query results
 * @param {string} answer - Generated answer text
 * @param {Object} queryResults - Query results from FalkorDB
 * @returns {Object} - Validation result {isValid, confidence, issues}
 */
export function validateAnswer(answer, queryResults) {
  const issues = [];
  let confidence = 1.0;

  // Extract facts from answer
  const answerFacts = extractFacts(answer);

  // Extract facts from query results
  const resultFacts = extractFactsFromResults(queryResults);

  // Check entity names
  const entityIssues = validateEntityNames(answerFacts.entities, resultFacts.entities);
  if (entityIssues.length > 0) {
    issues.push(...entityIssues);
    confidence -= 0.3;
  }

  // Check counts
  const countIssues = validateCounts(answerFacts.counts, resultFacts.counts);
  if (countIssues.length > 0) {
    issues.push(...countIssues);
    confidence -= 0.4;
  }

  // Check dates
  const dateIssues = validateDates(answerFacts.dates, resultFacts.dates);
  if (dateIssues.length > 0) {
    issues.push(...dateIssues);
    confidence -= 0.2;
  }

  // Check properties
  const propertyIssues = validateProperties(answerFacts.properties, resultFacts.properties);
  if (propertyIssues.length > 0) {
    issues.push(...propertyIssues);
    confidence -= 0.1;
  }

  const isValid = issues.length === 0 || confidence > 0.5;

  return {
    isValid,
    confidence: Math.max(0, confidence),
    issues,
    answerFacts,
    resultFacts
  };
}

/**
 * Extract facts from generated answer text
 * @param {string} answer - Answer text
 * @returns {Object} - Extracted facts {entities, counts, dates, properties}
 */
export function extractFacts(answer) {
  return {
    entities: extractEntityNames(answer),
    counts: extractCounts(answer),
    dates: extractDates(answer),
    properties: extractProperties(answer)
  };
}

/**
 * Extract facts from query results
 * @param {Object} queryResults - Query results object
 * @returns {Object} - Extracted facts {entities, counts, dates, properties}
 */
export function extractFactsFromResults(queryResults) {
  const entities = [];
  const properties = [];
  const dates = [];

  // Extract entity names
  if (queryResults.entities) {
    for (const entity of queryResults.entities) {
      if (entity.name) {
        entities.push(entity.name.toLowerCase());
      }
      // Extract properties
      if (entity.properties) {
        for (const [key, value] of Object.entries(entity.properties)) {
          properties.push({
            entity: entity.name,
            key,
            value: String(value).toLowerCase()
          });

          // Extract dates from properties
          if (isDateString(value)) {
            dates.push(value);
          }
        }
      }
    }
  }

  // Count entities by type
  const counts = {};
  if (queryResults.entities) {
    for (const entity of queryResults.entities) {
      const type = entity.type || 'entity';
      counts[type.toLowerCase()] = (counts[type.toLowerCase()] || 0) + 1;
    }
  }

  // Count relationships
  if (queryResults.relationships) {
    counts.relationships = queryResults.relationships.length;
  }

  return { entities, counts, dates, properties };
}

/**
 * Extract entity names from answer text
 * @param {string} answer - Answer text
 * @returns {Array<string>} - Entity names (lowercase)
 */
function extractEntityNames(answer) {
  const entities = [];

  // Extract capitalized phrases (likely entity names)
  const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  let match;
  while ((match = capitalizedPattern.exec(answer)) !== null) {
    entities.push(match[1].toLowerCase());
  }

  return entities;
}

/**
 * Extract counts from answer text
 * @param {string} answer - Answer text
 * @returns {Object} - Extracted counts {type: count}
 */
function extractCounts(answer) {
  const counts = {};

  // Extract numeric counts (e.g., "3 projects", "5 meetings")
  const numericPattern = /(\d+)\s+(\w+)/g;
  let match;
  while ((match = numericPattern.exec(answer)) !== null) {
    const count = parseInt(match[1]);
    const type = match[2].toLowerCase();
    counts[type] = count;
  }

  // Extract word counts (e.g., "three projects")
  const wordCounts = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
  };
  const wordPattern = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(\w+)/gi;
  while ((match = wordPattern.exec(answer)) !== null) {
    const count = wordCounts[match[1].toLowerCase()];
    const type = match[2].toLowerCase();
    counts[type] = count;
  }

  return counts;
}

/**
 * Extract dates from answer text
 * @param {string} answer - Answer text
 * @returns {Array<string>} - Extracted date strings
 */
function extractDates(answer) {
  const dates = [];

  // Match various date formats
  const datePatterns = [
    /\b\d{4}-\d{2}-\d{2}\b/g, // YYYY-MM-DD
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi, // Month DD, YYYY
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g // MM/DD/YYYY
  ];

  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(answer)) !== null) {
      dates.push(match[0]);
    }
  }

  return dates;
}

/**
 * Extract properties from answer text (key-value pairs)
 * @param {string} answer - Answer text
 * @returns {Array<Object>} - Extracted properties
 */
function extractProperties(answer) {
  // Simple heuristic: extract phrases like "status is in_progress"
  const properties = [];
  const propertyPattern = /(\w+)\s+is\s+([^,.\n]+)/gi;
  let match;
  while ((match = propertyPattern.exec(answer)) !== null) {
    properties.push({
      key: match[1].toLowerCase(),
      value: match[2].trim().toLowerCase()
    });
  }

  return properties;
}

/**
 * Validate entity names mentioned in answer
 * @param {Array<string>} answerEntities - Entities from answer
 * @param {Array<string>} resultEntities - Entities from results
 * @returns {Array<string>} - Issues found
 */
function validateEntityNames(answerEntities, resultEntities) {
  const issues = [];

  for (const entity of answerEntities) {
    // Check if entity exists in results (fuzzy match)
    const found = resultEntities.some(resultEntity =>
      fuzzyMatch(entity, resultEntity)
    );

    if (!found) {
      issues.push(`Entity "${entity}" not found in query results`);
    }
  }

  return issues;
}

/**
 * Validate counts mentioned in answer
 * @param {Object} answerCounts - Counts from answer
 * @param {Object} resultCounts - Counts from results
 * @returns {Array<string>} - Issues found
 */
function validateCounts(answerCounts, resultCounts) {
  const issues = [];

  for (const [type, count] of Object.entries(answerCounts)) {
    // Normalize type (projects → project)
    const normalizedType = type.replace(/s$/, '');

    // Check if count matches
    let resultCount = resultCounts[type] || resultCounts[normalizedType] || 0;

    if (count !== resultCount) {
      issues.push(`Count mismatch for "${type}": answer says ${count}, results show ${resultCount}`);
    }
  }

  return issues;
}

/**
 * Validate dates mentioned in answer
 * @param {Array<string>} answerDates - Dates from answer
 * @param {Array<string>} resultDates - Dates from results
 * @returns {Array<string>} - Issues found
 */
function validateDates(answerDates, resultDates) {
  const issues = [];

  // For now, just check if dates are plausible
  // More sophisticated validation can be added later
  for (const date of answerDates) {
    // Accept dates if they're in reasonable range
    const year = parseInt(date.match(/\d{4}/)?.[0]);
    if (year && (year < 2020 || year > 2030)) {
      issues.push(`Suspicious date: ${date}`);
    }
  }

  return issues;
}

/**
 * Validate properties mentioned in answer
 * @param {Array<Object>} answerProperties - Properties from answer
 * @param {Array<Object>} resultProperties - Properties from results
 * @returns {Array<string>} - Issues found
 */
function validateProperties(answerProperties, resultProperties) {
  const issues = [];

  for (const prop of answerProperties) {
    // Check if property value exists in results
    const found = resultProperties.some(resultProp =>
      resultProp.key === prop.key &&
      fuzzyMatch(resultProp.value, prop.value)
    );

    if (!found) {
      issues.push(`Property "${prop.key}: ${prop.value}" not found in results`);
    }
  }

  return issues;
}

/**
 * Fuzzy string matching (allows synonyms and paraphrases)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {boolean} - Whether strings match fuzzily
 */
function fuzzyMatch(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return true;

  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) return true;

  // Levenshtein distance threshold (allow 1-2 character differences)
  if (levenshteinDistance(s1, s2) <= 2) return true;

  return false;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Check if string is a date
 * @param {string} str - String to check
 * @returns {boolean} - Whether string is a date
 */
function isDateString(str) {
  if (typeof str !== 'string') return false;

  // Check ISO date format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return true;

  // Check if parseable as date
  const date = new Date(str);
  return !isNaN(date.getTime());
}
