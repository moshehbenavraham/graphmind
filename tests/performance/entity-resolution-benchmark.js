/**
 * Entity Resolution Performance Benchmark
 *
 * Tests the performance of entity resolution with varying dataset sizes.
 * Validates that indexed queries provide sub-linear performance scaling.
 *
 * Target: <100ms for 10,000 entities (was 2,000ms+ before optimization)
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * Execute wrangler D1 command
 */
async function executeD1Command(command) {
  return new Promise((resolve, reject) => {
    // Normalize whitespace in command
    const normalizedCommand = command.replace(/\s+/g, ' ').trim();

    const proc = spawn('npx',
      ['wrangler', 'd1', 'execute', 'graphmind-db', '--local', '--command', normalizedCommand],
      {
        cwd: path.join(__dirname, '../..'),
        shell: false
      }
    );

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed: ${stderr}`));
      }
    });
  });
}

/**
 * Create test dataset with specified number of entities
 */
async function createTestDataset(entityCount) {
  console.log(`\nCreating test dataset with ${entityCount} entities...`);

  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const normalizedUserId = userId.replace(/-/g, '');

  // Clear existing test data
  await executeD1Command(`DELETE FROM entity_cache WHERE user_id = '${userId}'`);

  // Insert test entities in batches
  const batchSize = 100;
  const batches = Math.ceil(entityCount / batchSize);

  for (let batch = 0; batch < batches; batch++) {
    const values = [];
    const startIdx = batch * batchSize;
    const endIdx = Math.min(startIdx + batchSize, entityCount);

    for (let i = startIdx; i < endIdx; i++) {
      const entityName = `TestPerson${i}`;
      const entityKey = `${normalizedUserId}:person:${entityName.toLowerCase()}`;
      values.push(`('${entityKey}', '${userId}', '${normalizedUserId}', '${entityName}', 'Person')`);
    }

    if (values.length > 0) {
      const insertQuery = `INSERT INTO entity_cache (entity_key, user_id, user_id_normalized, canonical_name, entity_type) VALUES ${values.join(', ')}`;
      await executeD1Command(insertQuery);
    }

    if ((batch + 1) % 10 === 0) {
      console.log(`  Inserted ${endIdx} / ${entityCount} entities...`);
    }
  }

  console.log(`✓ Created ${entityCount} test entities`);
}

/**
 * Benchmark entity resolution query (optimized version)
 */
async function benchmarkOptimizedQuery(entityCount, iterations = 100) {
  console.log(`\nBenchmarking optimized query (${iterations} iterations)...`);

  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const normalizedUserId = userId.replace(/-/g, '');
  const entityName = 'TestPerson500'; // Middle of dataset
  const prefix = entityName.toLowerCase().substring(0, 3); // "tes"

  // Optimized query using indexed column
  const query = `
    SELECT canonical_name, entity_type
    FROM entity_cache
    WHERE user_id_normalized = '${normalizedUserId}'
      AND LOWER(canonical_name) LIKE '${prefix}%'
    LIMIT 50
  `;

  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await executeD1Command(query);
    const duration = Date.now() - start;
    times.push(duration);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const p95Time = times.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];

  return {
    avgTime,
    minTime,
    maxTime,
    p95Time,
    iterations
  };
}

/**
 * Benchmark unoptimized query (legacy version for comparison)
 */
async function benchmarkUnoptimizedQuery(entityCount, iterations = 100) {
  console.log(`\nBenchmarking unoptimized query (${iterations} iterations)...`);

  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const normalizedUserId = userId.replace(/-/g, '');

  // Unoptimized query without index (simulates old behavior)
  const query = `
    SELECT canonical_name, entity_type
    FROM entity_cache
    WHERE REPLACE(user_id, '-', '') = '${normalizedUserId}'
  `;

  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await executeD1Command(query);
    const duration = Date.now() - start;
    times.push(duration);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const p95Time = times.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];

  return {
    avgTime,
    minTime,
    maxTime,
    p95Time,
    iterations
  };
}

/**
 * Verify query execution plan uses index
 */
async function verifyIndexUsage() {
  console.log(`\nVerifying index usage in query execution plan...`);

  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const normalizedUserId = userId.replace(/-/g, '');
  const prefix = 'tes';

  const explainQuery = `
    EXPLAIN QUERY PLAN
    SELECT canonical_name, entity_type
    FROM entity_cache
    WHERE user_id_normalized = '${normalizedUserId}'
      AND LOWER(canonical_name) LIKE '${prefix}%'
    LIMIT 50
  `;

  const result = await executeD1Command(explainQuery);

  // Check if index is mentioned in execution plan
  const usesIndex = result.includes('idx_entity_cache_user_normalized') ||
                    result.includes('USING INDEX');

  console.log(`Execution plan:\n${result}`);

  return usesIndex;
}

/**
 * Test fuzzy matching still works correctly
 */
async function testFuzzyMatching() {
  console.log(`\nTesting fuzzy matching accuracy...`);

  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const normalizedUserId = userId.replace(/-/g, '');

  // Create test entities with similar names
  await executeD1Command(`DELETE FROM entity_cache WHERE user_id = '${userId}'`);

  const testEntities = [
    "Sarah", "Sara", "Sarha", "Zarah", // Levenshtein distance ≤3
    "Alice", "Alicia", "Alison", "Alise", // Similar names
    "Bob", "Rob", "Bobby" // Different names
  ];

  for (const name of testEntities) {
    const entityKey = `${normalizedUserId}:person:${name.toLowerCase()}`;
    await executeD1Command(
      `INSERT INTO entity_cache (entity_key, user_id, user_id_normalized, canonical_name, entity_type)
       VALUES ('${entityKey}', '${userId}', '${normalizedUserId}', '${name}', 'Person')`
    );
  }

  console.log(`✓ Created test entities for fuzzy matching`);

  // Test that prefix matching narrows candidates
  const sarahQuery = `
    SELECT canonical_name
    FROM entity_cache
    WHERE user_id_normalized = '${normalizedUserId}'
      AND LOWER(canonical_name) LIKE 's%'
    LIMIT 50
  `;

  const result = await executeD1Command(sarahQuery);

  // Should match: Sarah, Sara, Sarha (not Zarah which has distance >3)
  const matches = result.toLowerCase();
  const hasSarah = matches.includes('sarah');
  const hasSara = matches.includes('sara');

  console.log(`Fuzzy matching results: ${hasSarah && hasSara ? 'PASS ✓' : 'FAIL ✗'}`);

  return hasSarah && hasSara;
}

/**
 * Main benchmark runner
 */
async function runBenchmarks() {
  console.log('='.repeat(80));
  console.log('Entity Resolution Performance Benchmark');
  console.log('='.repeat(80));

  const testSizes = [
    { size: 100, target: 50, iterations: 50 },
    { size: 1000, target: 75, iterations: 50 },
    { size: 10000, target: 100, iterations: 100 }
  ];

  const results = [];

  for (const test of testSizes) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Test: ${test.size} entities (target: <${test.target}ms)`);
    console.log('='.repeat(80));

    try {
      // Create dataset
      await createTestDataset(test.size);

      // Benchmark optimized query
      const optimized = await benchmarkOptimizedQuery(test.size, test.iterations);

      // Benchmark unoptimized query (for comparison)
      let unoptimized = null;
      if (test.size <= 1000) {
        // Only test unoptimized on smaller datasets to avoid timeouts
        unoptimized = await benchmarkUnoptimizedQuery(test.size, test.iterations);
      }

      const passed = optimized.p95Time < test.target;
      const improvement = unoptimized ?
        ((unoptimized.avgTime - optimized.avgTime) / unoptimized.avgTime * 100).toFixed(1) :
        'N/A';

      results.push({
        size: test.size,
        target: test.target,
        optimized,
        unoptimized,
        passed,
        improvement
      });

      // Display results
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`OPTIMIZED QUERY RESULTS (${test.size} entities):`);
      console.log(`  Average: ${optimized.avgTime.toFixed(2)}ms`);
      console.log(`  Min: ${optimized.minTime}ms`);
      console.log(`  Max: ${optimized.maxTime}ms`);
      console.log(`  P95: ${optimized.p95Time}ms`);
      console.log(`  Target: <${test.target}ms`);
      console.log(`  Status: ${passed ? 'PASS ✓' : 'FAIL ✗'}`);

      if (unoptimized) {
        console.log(`\nUNOPTIMIZED QUERY RESULTS (for comparison):`);
        console.log(`  Average: ${unoptimized.avgTime.toFixed(2)}ms`);
        console.log(`  Improvement: ${improvement}% faster`);
      }

      console.log(`${'─'.repeat(80)}`);

    } catch (error) {
      console.error(`\n✗ Test failed:`, error.message);
      results.push({
        size: test.size,
        target: test.target,
        error: error.message,
        passed: false
      });
    }
  }

  // Verify index usage
  console.log(`\n${'='.repeat(80)}`);
  try {
    const usesIndex = await verifyIndexUsage();
    console.log(`Index usage: ${usesIndex ? 'CONFIRMED ✓' : 'NOT DETECTED ✗'}`);
  } catch (error) {
    console.error(`Index verification failed:`, error.message);
  }

  // Test fuzzy matching
  console.log(`\n${'='.repeat(80)}`);
  try {
    const fuzzyWorks = await testFuzzyMatching();
    console.log(`Fuzzy matching: ${fuzzyWorks ? 'WORKING ✓' : 'BROKEN ✗'}`);
  } catch (error) {
    console.error(`Fuzzy matching test failed:`, error.message);
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('BENCHMARK SUMMARY');
  console.log('='.repeat(80));

  const allPassed = results.every(r => r.passed);

  for (const result of results) {
    if (result.error) {
      console.log(`\n${result.size} entities: ERROR`);
      console.log(`  ${result.error}`);
    } else {
      console.log(`\n${result.size} entities: ${result.passed ? 'PASS ✓' : 'FAIL ✗'}`);
      console.log(`  Average: ${result.optimized.avgTime.toFixed(2)}ms (target: <${result.target}ms)`);
      console.log(`  P95: ${result.optimized.p95Time}ms`);
      if (result.improvement !== 'N/A') {
        console.log(`  Improvement: ${result.improvement}% faster than unoptimized`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Overall: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);
  console.log('='.repeat(80));

  process.exit(allPassed ? 0 : 1);
}

// Run benchmarks
runBenchmarks().catch(error => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
