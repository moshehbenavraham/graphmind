/**
 * Unit Tests: Entity Key Generator
 * Feature: 005-entity-extraction
 *
 * Tests for entity name normalization and key generation.
 */

import {
  generateEntityKey,
  generateEntityKeys,
  namesMatch,
  generateAliases,
  isValidEntityKey,
} from '../src/lib/entity-utils/entity-key-generator.js';

/**
 * Test generateEntityKey function
 */
function testGenerateEntityKey() {
  console.log('Testing generateEntityKey...');

  const tests = [
    { input: 'Sarah Johnson', expected: 'sarah-johnson', description: 'Simple name' },
    { input: 'FastAPI Migration', expected: 'fastapi-migration', description: 'Project name' },
    { input: 'JavaScript (ES6)', expected: 'javascript-es6', description: 'Name with parentheses' },
    { input: '  Extra   Spaces  ', expected: 'extra-spaces', description: 'Extra spaces' },
    { input: 'UPPERCASE', expected: 'uppercase', description: 'All caps' },
    { input: 'Mixed-Case_Name', expected: 'mixedcasename', description: 'Mixed case with special chars' },
    { input: 'name@with#symbols!', expected: 'namewithsymbols', description: 'Special characters removed' },
    { input: 'multiple---hyphens', expected: 'multiplehyphens', description: 'Hyphens removed as special chars' },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    try {
      const result = generateEntityKey(test.input);
      if (result === test.expected) {
        console.log(`  ✓ ${test.description}: "${test.input}" → "${result}"`);
        passed++;
      } else {
        console.log(`  ✗ ${test.description}: Expected "${test.expected}", got "${result}"`);
        failed++;
      }
    } catch (error) {
      console.log(`  ✗ ${test.description}: Error - ${error.message}`);
      failed++;
    }
  });

  // Test error cases
  try {
    generateEntityKey('');
    console.log('  ✗ Should throw error for empty string');
    failed++;
  } catch (error) {
    console.log('  ✓ Correctly throws error for empty string');
    passed++;
  }

  try {
    generateEntityKey(null);
    console.log('  ✗ Should throw error for null');
    failed++;
  } catch (error) {
    console.log('  ✓ Correctly throws error for null');
    passed++;
  }

  console.log(`generateEntityKey: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/**
 * Test generateEntityKeys function
 */
function testGenerateEntityKeys() {
  console.log('Testing generateEntityKeys...');

  let passed = 0;
  let failed = 0;

  // Test array of names
  const names = ['Sarah Johnson', 'FastAPI Migration', 'JavaScript'];
  const result = generateEntityKeys(names);

  if (
    result.length === 3 &&
    result[0] === 'sarah-johnson' &&
    result[1] === 'fastapi-migration' &&
    result[2] === 'javascript'
  ) {
    console.log('  ✓ Generates keys for array of names');
    passed++;
  } else {
    console.log('  ✗ Failed to generate keys for array');
    failed++;
  }

  // Test error handling
  try {
    generateEntityKeys('not an array');
    console.log('  ✗ Should throw error for non-array');
    failed++;
  } catch (error) {
    console.log('  ✓ Correctly throws error for non-array');
    passed++;
  }

  console.log(`generateEntityKeys: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/**
 * Test namesMatch function
 */
function testNamesMatch() {
  console.log('Testing namesMatch...');

  const tests = [
    { name1: 'Sarah Johnson', name2: 'sarah johnson', shouldMatch: true },
    { name1: 'JavaScript (ES6)', name2: 'JavaScript ES6', shouldMatch: true },
    { name1: 'FastAPI', name2: 'Flask', shouldMatch: false },
    { name1: '  Extra Spaces  ', name2: 'Extra Spaces', shouldMatch: true },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    const result = namesMatch(test.name1, test.name2);
    if (result === test.shouldMatch) {
      console.log(`  ✓ "${test.name1}" vs "${test.name2}": ${result ? 'match' : 'no match'}`);
      passed++;
    } else {
      console.log(`  ✗ "${test.name1}" vs "${test.name2}": Expected ${test.shouldMatch}, got ${result}`);
      failed++;
    }
  });

  console.log(`namesMatch: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/**
 * Test generateAliases function
 */
function testGenerateAliases() {
  console.log('Testing generateAliases...');

  let passed = 0;
  let failed = 0;

  // Test "Sarah Johnson" -> should include "Sarah"
  const aliases1 = generateAliases('Sarah Johnson');
  if (aliases1.includes('Sarah Johnson') && aliases1.includes('Sarah')) {
    console.log('  ✓ Generates aliases for "Sarah Johnson" including first name');
    passed++;
  } else {
    console.log('  ✗ Failed to generate aliases for "Sarah Johnson"');
    failed++;
  }

  // Test "JavaScript (ES6)" -> should include "JavaScript"
  const aliases2 = generateAliases('JavaScript (ES6)');
  if (aliases2.includes('JavaScript')) {
    console.log('  ✓ Removes parentheses from "JavaScript (ES6)"');
    passed++;
  } else {
    console.log('  ✗ Failed to remove parentheses');
    failed++;
  }

  // Test empty string
  const aliases3 = generateAliases('');
  if (aliases3.length === 0) {
    console.log('  ✓ Returns empty array for empty string');
    passed++;
  } else {
    console.log('  ✗ Should return empty array for empty string');
    failed++;
  }

  console.log(`generateAliases: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/**
 * Test isValidEntityKey function
 */
function testIsValidEntityKey() {
  console.log('Testing isValidEntityKey...');

  const tests = [
    { input: 'sarah-johnson', expected: true, description: 'Valid key' },
    { input: 'fastapi-migration', expected: true, description: 'Valid key with hyphen' },
    { input: 'javascript', expected: true, description: 'Single word' },
    { input: 'Sarah-Johnson', expected: false, description: 'Contains uppercase' },
    { input: 'sarah_johnson', expected: false, description: 'Contains underscore' },
    { input: 'sarah johnson', expected: false, description: 'Contains space' },
    { input: '-sarah-johnson', expected: false, description: 'Starts with hyphen' },
    { input: 'sarah-johnson-', expected: false, description: 'Ends with hyphen' },
    { input: '', expected: false, description: 'Empty string' },
    { input: null, expected: false, description: 'Null value' },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    const result = isValidEntityKey(test.input);
    if (result === test.expected) {
      console.log(`  ✓ ${test.description}: ${test.input === null ? 'null' : `"${test.input}"`} → ${result}`);
      passed++;
    } else {
      console.log(`  ✗ ${test.description}: Expected ${test.expected}, got ${result}`);
      failed++;
    }
  });

  console.log(`isValidEntityKey: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/**
 * Run all tests
 */
function runAllTests() {
  console.log('='.repeat(60));
  console.log('Entity Key Generator Test Suite');
  console.log('='.repeat(60) + '\n');

  const results = [
    testGenerateEntityKey(),
    testGenerateEntityKeys(),
    testNamesMatch(),
    testGenerateAliases(),
    testIsValidEntityKey(),
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
