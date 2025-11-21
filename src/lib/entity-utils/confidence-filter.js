/**
 * Confidence Filter
 * Feature: 005-entity-extraction
 *
 * Filters extracted entities based on confidence threshold.
 * Default threshold: 0.8 (80%)
 */

/**
 * Default confidence threshold for entity extraction
 */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;

/**
 * Filter entities by confidence threshold
 *
 * @param {Array} entities - Array of entity objects with confidence scores
 * @param {number} threshold - Minimum confidence threshold (default: 0.8)
 * @returns {{ passed: Array, filtered: Array }} Entities that passed and were filtered
 */
export function filterByConfidence(entities, threshold = DEFAULT_CONFIDENCE_THRESHOLD) {
  if (!Array.isArray(entities)) {
    throw new Error('Entities must be an array');
  }

  if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
    throw new Error('Threshold must be a number between 0 and 1');
  }

  const passed = [];
  const filtered = [];

  entities.forEach(entity => {
    if (typeof entity.confidence !== 'number') {
      console.warn(`Entity missing valid confidence score:`, entity);
      filtered.push({
        entity,
        reason: 'Missing or invalid confidence score',
      });
      return;
    }

    if (entity.confidence >= threshold) {
      passed.push(entity);
    } else {
      filtered.push({
        entity,
        reason: `Confidence ${entity.confidence.toFixed(2)} below threshold ${threshold.toFixed(2)}`,
      });
    }
  });

  return { passed, filtered };
}

/**
 * Calculate statistics about entity confidence scores
 *
 * @param {Array} entities - Array of entity objects with confidence scores
 * @returns {Object} Confidence statistics
 */
export function calculateConfidenceStats(entities) {
  if (!Array.isArray(entities) || entities.length === 0) {
    return {
      count: 0,
      mean: 0,
      min: 0,
      max: 0,
      median: 0,
    };
  }

  const confidenceScores = entities
    .map(e => e.confidence)
    .filter(c => typeof c === 'number' && !isNaN(c))
    .sort((a, b) => a - b);

  if (confidenceScores.length === 0) {
    return {
      count: 0,
      mean: 0,
      min: 0,
      max: 0,
      median: 0,
    };
  }

  const sum = confidenceScores.reduce((acc, score) => acc + score, 0);
  const mean = sum / confidenceScores.length;
  const min = confidenceScores[0];
  const max = confidenceScores[confidenceScores.length - 1];

  // Calculate median
  const mid = Math.floor(confidenceScores.length / 2);
  const median = confidenceScores.length % 2 === 0
    ? (confidenceScores[mid - 1] + confidenceScores[mid]) / 2
    : confidenceScores[mid];

  return {
    count: confidenceScores.length,
    mean: parseFloat(mean.toFixed(3)),
    min: parseFloat(min.toFixed(3)),
    max: parseFloat(max.toFixed(3)),
    median: parseFloat(median.toFixed(3)),
  };
}

/**
 * Validate that confidence score is within valid range
 *
 * @param {number} confidence - Confidence score to validate
 * @returns {boolean} True if valid (0.0 - 1.0)
 */
export function isValidConfidence(confidence) {
  return typeof confidence === 'number' && confidence >= 0.0 && confidence <= 1.0 && !isNaN(confidence);
}

/**
 * Normalize confidence score to valid range (0.0 - 1.0)
 * Clamps values outside range
 *
 * @param {number} confidence - Confidence score to normalize
 * @returns {number} Normalized confidence score
 */
export function normalizeConfidence(confidence) {
  if (typeof confidence !== 'number' || isNaN(confidence)) {
    return 0.0;
  }

  return Math.max(0.0, Math.min(1.0, confidence));
}

/**
 * Count entities by confidence tier
 *
 * @param {Array} entities - Array of entity objects with confidence scores
 * @returns {Object} Count of entities in each tier
 */
export function countByConfidenceTier(entities) {
  if (!Array.isArray(entities)) {
    throw new Error('Entities must be an array');
  }

  const tiers = {
    high: 0,    // >= 0.9
    medium: 0,  // 0.7 - 0.89
    low: 0,     // < 0.7
    invalid: 0, // Missing or invalid confidence
  };

  entities.forEach(entity => {
    if (!isValidConfidence(entity.confidence)) {
      tiers.invalid++;
    } else if (entity.confidence >= 0.9) {
      tiers.high++;
    } else if (entity.confidence >= 0.7) {
      tiers.medium++;
    } else {
      tiers.low++;
    }
  });

  return tiers;
}
