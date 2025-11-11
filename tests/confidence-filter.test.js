/**
 * Unit Tests: Confidence Filter
 * Feature: 005-entity-extraction
 *
 * Tests for entity confidence filtering and validation.
 */

import {
  filterByConfidence,
  calculateConfidenceStats,
  isValidConfidence,
  normalizeConfidence,
  countByConfidenceTier,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from '../src/lib/entity-utils/confidence-filter.js';

/**
 * Test filterByConfidence function
 */
function testFilterByConfidence() {
  console.log('Testing filterByConfidence...');

  let passed = 0;
  let failed = 0;

  // Test basic filtering with default threshold (0.8)
  const entities = [
    { name: 'Entity 1', confidence: 0.95 },
    { name: 'Entity 2', confidence: 0.85 },
    { name: 'Entity 3', confidence: 0.75 },
    { name: 'Entity 4', confidence: 0.60 },
    { name: 'Entity 5', confidence: 0.80 },
  ];

  const result = filterByConfidence(entities);

  if (result.passed.length === 3) {
    console.log(`  ✓ Correctly passes 3 entities with confidence >= 0.8`);
    passed++;
  } else {
    console.log(`  ✗ Expected 3 passed entities, got ${result.passed.length}`);
    failed++;
  }

  if (result.filtered.length === 2) {
    console.log(`  ✓ Correctly filters 2 entities with confidence < 0.8`);
    passed++;
  } else {
    console.log(`  ✗ Expected 2 filtered entities, got ${result.filtered.length}`);
    failed++;
  }

  // Test exact threshold boundary (0.80 should pass)
  if (result.passed.some(e => e.confidence === 0.80)) {
    console.log(`  ✓ Entity with confidence = 0.80 passes threshold`);
    passed++;
  } else {
    console.log(`  ✗ Entity with confidence = 0.80 should pass`);
    failed++;
  }

  // Test custom threshold
  const customResult = filterByConfidence(entities, 0.90);
  if (customResult.passed.length === 1) {
    console.log(`  ✓ Custom threshold 0.90 correctly passes 1 entity`);
    passed++;
  } else {
    console.log(`  ✗ Custom threshold 0.90: Expected 1 passed, got ${customResult.passed.length}`);
    failed++;
  }

  // Test empty array
  const emptyResult = filterByConfidence([]);
  if (emptyResult.passed.length === 0 && emptyResult.filtered.length === 0) {
    console.log(`  ✓ Handles empty array correctly`);
    passed++;
  } else {
    console.log(`  ✗ Failed to handle empty array`);
    failed++;
  }

  // Test error handling
  try {
    filterByConfidence('not an array');
    console.log('  ✗ Should throw error for non-array');
    failed++;
  } catch (error) {
    console.log('  ✓ Correctly throws error for non-array');
    passed++;
  }

  console.log(`filterByConfidence: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/**
 * Test calculateConfidenceStats function
 */
function testCalculateConfidenceStats() {
  console.log('Testing calculateConfidenceStats...');

  let passed = 0;
  let failed = 0;

  const entities = [
    { confidence: 0.95 },
    { confidence: 0.85 },
    { confidence: 0.75 },
    { confidence: 0.90 },
    { confidence: 0.80 },
  ];

  const stats = calculateConfidenceStats(entities);

  if (stats.count === 5) {
    console.log(`  ✓ Correct count: ${stats.count}`);
    passed++;
  } else {
    console.log(`  ✗ Expected count 5, got ${stats.count}`);
    failed++;
  }

  // Mean should be (0.95 + 0.85 + 0.75 + 0.90 + 0.80) / 5 = 0.85
  if (Math.abs(stats.mean - 0.85) < 0.01) {
    console.log(`  ✓ Correct mean: ${stats.mean}`);
    passed++;
  } else {
    console.log(`  ✗ Expected mean 0.85, got ${stats.mean}`);
    failed++;
  }

  if (stats.min === 0.75) {
    console.log(`  ✓ Correct min: ${stats.min}`);
    passed++;
  } else {
    console.log(`  ✗ Expected min 0.75, got ${stats.min}`);
    failed++;
  }

  if (stats.max === 0.95) {
    console.log(`  ✓ Correct max: ${stats.max}`);
    passed++;
  } else {
    console.log(`  ✗ Expected max 0.95, got ${stats.max}`);
    failed++;
  }

  // Median of [0.75, 0.80, 0.85, 0.90, 0.95] is 0.85
  if (Math.abs(stats.median - 0.85) < 0.01) {
    console.log(`  ✓ Correct median: ${stats.median}`);
    passed++;
  } else {
    console.log(`  ✗ Expected median 0.85, got ${stats.median}`);
    failed++;
  }

  // Test empty array
  const emptyStats = calculateConfidenceStats([]);
  if (emptyStats.count === 0 && emptyStats.mean === 0) {
    console.log(`  ✓ Handles empty array correctly`);
    passed++;
  } else {
    console.log(`  ✗ Failed to handle empty array`);
    failed++;
  }

  console.log(`calculateConfidenceStats: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/**
 * Test isValidConfidence function
 */
function testIsValidConfidence() {
  console.log('Testing isValidConfidence...');

  const tests = [
    { input: 0.0, expected: true, description: 'Lower bound (0.0)' },
    { input: 1.0, expected: true, description: 'Upper bound (1.0)' },
    { input: 0.5, expected: true, description: 'Middle value (0.5)' },
    { input: 0.85, expected: true, description: 'Valid score (0.85)' },
    { input: -0.1, expected: false, description: 'Below range (-0.1)' },
    { input: 1.1, expected: false, description: 'Above range (1.1)' },
    { input: NaN, expected: false, description: 'NaN value' },
    { input: 'string', expected: false, description: 'String type' },
    { input: null, expected: false, description: 'Null value' },
    { input: undefined, expected: false, description: 'Undefined value' },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    const result = isValidConfidence(test.input);
    if (result === test.expected) {
      console.log(`  ✓ ${test.description}: ${test.input} → ${result}`);
      passed++;
    } else {
      console.log(`  ✗ ${test.description}: Expected ${test.expected}, got ${result}`);
      failed++;
    }
  });

  console.log(`isValidConfidence: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/**
 * Test normalizeConfidence function
 */
function testNormalizeConfidence() {
  console.log('Testing normalizeConfidence...');

  const tests = [
    { input: 0.5, expected: 0.5, description: 'Valid value unchanged' },
    { input: 1.5, expected: 1.0, description: 'Above 1.0 clamped to 1.0' },
    { input: -0.5, expected: 0.0, description: 'Below 0.0 clamped to 0.0' },
    { input: 0.0, expected: 0.0, description: 'Lower bound' },
    { input: 1.0, expected: 1.0, description: 'Upper bound' },
    { input: NaN, expected: 0.0, description: 'NaN converts to 0.0' },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    const result = normalizeConfidence(test.input);
    if (Math.abs(result - test.expected) < 0.0001) {
      console.log(`  ✓ ${test.description}: ${test.input} → ${result}`);
      passed++;
    } else {
      console.log(`  ✗ ${test.description}: Expected ${test.expected}, got ${result}`);
      failed++;
    }
  });

  console.log(`normalizeConfidence: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/**
 * Test countByConfidenceTier function
 */
function testCountByConfidenceTier() {
  console.log('Testing countByConfidenceTier...');

  let passed = 0;
  let failed = 0;

  const entities = [
    { confidence: 0.95 },  // high
    { confidence: 0.92 },  // high
    { confidence: 0.85 },  // medium
    { confidence: 0.75 },  // medium
    { confidence: 0.60 },  // low
    { confidence: NaN },   // invalid
  ];

  const tiers = countByConfidenceTier(entities);

  if (tiers.high === 2) {
    console.log(`  ✓ Correct high tier count: ${tiers.high}`);
    passed++;
  } else {
    console.log(`  ✗ Expected 2 high tier, got ${tiers.high}`);
    failed++;
  }

  if (tiers.medium === 2) {
    console.log(`  ✓ Correct medium tier count: ${tiers.medium}`);
    passed++;
  } else {
    console.log(`  ✗ Expected 2 medium tier, got ${tiers.medium}`);
    failed++;
  }

  if (tiers.low === 1) {
    console.log(`  ✓ Correct low tier count: ${tiers.low}`);
    passed++;
  } else {
    console.log(`  ✗ Expected 1 low tier, got ${tiers.low}`);
    failed++;
  }

  if (tiers.invalid === 1) {
    console.log(`  ✓ Correct invalid tier count: ${tiers.invalid}`);
    passed++;
  } else {
    console.log(`  ✗ Expected 1 invalid tier, got ${tiers.invalid}`);
    failed++;
  }

  console.log(`countByConfidenceTier: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/**
 * Run all tests
 */
function runAllTests() {
  console.log('='.repeat(60));
  console.log('Confidence Filter Test Suite');
  console.log('='.repeat(60) + '\n');

  const results = [
    testFilterByConfidence(),
    testCalculateConfidenceStats(),
    testIsValidConfidence(),
    testNormalizeConfidence(),
    testCountByConfidenceTier(),
  ];

  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

  console.log('='.repeat(60));
  console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('='.repeat(60));

  return totalFailed === 0;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runAllTests();
  process.exit(success ? 0 : 1);
}

export { runAllTests };
