/**
 * Entity Key Generator
 * Feature: 005-entity-extraction
 *
 * Normalizes entity names for fuzzy matching and cache lookups.
 * Converts names to lowercase, removes special characters, and replaces spaces with hyphens.
 *
 * Examples:
 * - "Sarah Johnson" → "sarah-johnson"
 * - "FastAPI Migration" → "fastapi-migration"
 * - "JavaScript (ES6)" → "javascript-es6"
 */

/**
 * Generate a normalized entity key from a name
 *
 * @param {string} name - Entity name to normalize
 * @returns {string} Normalized entity key
 */
export function generateEntityKey(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Entity name must be a non-empty string');
  }

  return name
    .toLowerCase()                    // Convert to lowercase
    .trim()                            // Remove leading/trailing whitespace
    .replace(/[^a-z0-9\s]/g, '')      // Remove special characters (keep alphanumeric and spaces)
    .replace(/\s+/g, '-')              // Replace spaces with hyphens
    .replace(/-+/g, '-')               // Collapse multiple hyphens to single hyphen
    .replace(/^-|-$/g, '');            // Remove leading/trailing hyphens
}

/**
 * Generate entity keys for an array of names
 *
 * @param {string[]} names - Array of entity names
 * @returns {string[]} Array of normalized entity keys
 */
export function generateEntityKeys(names) {
  if (!Array.isArray(names)) {
    throw new Error('Names must be an array');
  }

  return names.map(name => {
    try {
      return generateEntityKey(name);
    } catch (error) {
      console.warn(`Failed to generate key for name "${name}":`, error.message);
      return null;
    }
  }).filter(key => key !== null);
}

/**
 * Check if two entity names match after normalization
 *
 * @param {string} name1 - First entity name
 * @param {string} name2 - Second entity name
 * @returns {boolean} True if normalized keys match
 */
export function namesMatch(name1, name2) {
  try {
    const key1 = generateEntityKey(name1);
    const key2 = generateEntityKey(name2);
    return key1 === key2;
  } catch (error) {
    return false;
  }
}

/**
 * Generate aliases for an entity name
 * Creates common variations that should resolve to the same entity
 *
 * @param {string} name - Entity name
 * @returns {string[]} Array of alias variations
 */
export function generateAliases(name) {
  if (!name || typeof name !== 'string') {
    return [];
  }

  const aliases = new Set();
  const trimmedName = name.trim();

  // Add the original name
  aliases.add(trimmedName);

  // Add lowercase version
  aliases.add(trimmedName.toLowerCase());

  // For multi-word names, add first word only (e.g., "Sarah Johnson" → "Sarah")
  const words = trimmedName.split(/\s+/);
  if (words.length > 1) {
    aliases.add(words[0]);
  }

  // For names with parentheses, add version without parentheses
  // e.g., "JavaScript (ES6)" → "JavaScript"
  if (trimmedName.includes('(')) {
    const withoutParens = trimmedName.replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (withoutParens) {
      aliases.add(withoutParens);
    }
  }

  // For acronym detection (all caps words)
  const acronymWords = words.filter(word => word.length > 1 && word === word.toUpperCase());
  if (acronymWords.length > 0) {
    // Add acronym formed from first letters of all words
    const acronym = words.map(w => w[0]).join('').toUpperCase();
    if (acronym.length >= 2 && acronym.length <= 6) {
      aliases.add(acronym);
    }
  }

  return Array.from(aliases);
}

/**
 * Validate that an entity key is properly formatted
 *
 * @param {string} key - Entity key to validate
 * @returns {boolean} True if key is valid format
 */
export function isValidEntityKey(key) {
  if (!key || typeof key !== 'string') {
    return false;
  }

  // Key must be lowercase, alphanumeric with hyphens only
  const validPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return validPattern.test(key);
}
