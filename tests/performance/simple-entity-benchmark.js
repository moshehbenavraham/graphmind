/**
 * Simple Entity Resolution Performance Test
 * Tests key performance requirements with minimal overhead
 */

const { execSync } = require('child_process');

function runD1Command(sql) {
  try {
    const result = execSync(
      `npx wrangler d1 execute graphmind-db --local --command "${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    return result;
  } catch (error) {
    throw new Error(`D1 command failed: ${error.message}`);
  }
}

async function main() {
  console.log('Entity Resolution Performance Test\n');
  console.log('=' .repeat(60));

  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const normalizedUserId = userId.replace(/-/g, '');

  // Ensure test user exists
  console.log('\n1. Setting up test user...');
  try {
    runD1Command(
      `INSERT OR IGNORE INTO users (user_id, email, password_hash, falkordb_namespace) ` +
      `VALUES ('${userId}', 'test@example.com', 'hash', 'user_${normalizedUserId}')`
    );
  } catch (e) {
    // User might already exist - that's okay
  }
  console.log('   ✓ Test user ready');

  // Clean up test data
  console.log('\n2. Cleaning up existing test data...');
  runD1Command(`DELETE FROM entity_cache WHERE user_id = '${userId}'`);
  console.log('   ✓ Test data cleaned');

  // Create 100 test entities
  console.log('\n3. Creating 100 test entities...');
  for (let i = 0; i < 100; i++) {
    const entityName = `TestPerson${i}`;
    const entityKey = `${normalizedUserId}:person:${entityName.toLowerCase()}`;
    runD1Command(
      `INSERT INTO entity_cache (entity_key, user_id, user_id_normalized, canonical_name, entity_type) ` +
      `VALUES ('${entityKey}', '${userId}', '${normalizedUserId}', '${entityName}', 'Person')`
    );
  }
  console.log('   ✓ Created 100 entities');

  // Test optimized query
  console.log('\n4. Testing optimized query (100 entities)...');
  const prefix = 'testp';
  const query = `SELECT canonical_name, entity_type FROM entity_cache WHERE user_id_normalized = '${normalizedUserId}' AND LOWER(canonical_name) LIKE '${prefix}%' LIMIT 50`;

  const start = Date.now();
  for (let i = 0; i < 10; i++) {
    runD1Command(query);
  }
  const duration = Date.now() - start;
  const avgTime = duration / 10;

  console.log(`   Average query time: ${avgTime.toFixed(2)}ms`);
  console.log(`   Target: <50ms for 100 entities`);
  console.log(`   Status: ${avgTime < 50 ? 'PASS ✓' : 'FAIL ✗'}`);

  // Verify index usage
  console.log('\n5. Verifying index usage...');
  const explainQuery = `EXPLAIN QUERY PLAN SELECT canonical_name, entity_type FROM entity_cache WHERE user_id_normalized = '${normalizedUserId}' AND LOWER(canonical_name) LIKE '${prefix}%' LIMIT 50`;
  const explainResult = runD1Command(explainQuery);
  const usesIndex = explainResult.includes('idx_entity_cache_name_prefix') ||
                     explainResult.includes('idx_entity_cache_user_normalized');

  console.log(`   Index usage: ${usesIndex ? 'CONFIRMED ✓' : 'NOT DETECTED ✗'}`);

  // Test fuzzy matching
  console.log('\n6. Testing fuzzy matching (prefix filtering)...');
  runD1Command(`DELETE FROM entity_cache WHERE user_id = '${userId}'`);

  const testNames = ['Sarah', 'Sara', 'Sarha', 'Alice', 'Alicia'];
  for (const name of testNames) {
    const entityKey = `${normalizedUserId}:person:${name.toLowerCase()}`;
    runD1Command(
      `INSERT INTO entity_cache (entity_key, user_id, user_id_normalized, canonical_name, entity_type) ` +
      `VALUES ('${entityKey}', '${userId}', '${normalizedUserId}', '${name}', 'Person')`
    );
  }

  const sarahQuery = `SELECT canonical_name FROM entity_cache WHERE user_id_normalized = '${normalizedUserId}' AND LOWER(canonical_name) LIKE 's%' LIMIT 50`;
  const sarahResult = runD1Command(sarahQuery);

  const hasSarah = sarahResult.toLowerCase().includes('sarah');
  const hasSara = sarahResult.toLowerCase().includes('sara');
  console.log(`   Prefix matching: ${hasSarah && hasSara ? 'WORKING ✓' : 'BROKEN ✗'}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const allPassed = avgTime < 50 && usesIndex && hasSarah && hasSara;

  console.log(`\n✓ Query Performance: ${avgTime.toFixed(2)}ms (target: <50ms)`);
  console.log(`✓ Index Usage: ${usesIndex ? 'Confirmed' : 'Not detected'}`);
  console.log(`✓ Fuzzy Matching: ${hasSarah && hasSara ? 'Working' : 'Broken'}`);
  console.log(`\nOverall: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);

  // Cleanup
  console.log('\n7. Cleaning up test data...');
  runD1Command(`DELETE FROM entity_cache WHERE user_id = '${userId}'`);
  console.log('   ✓ Cleanup complete\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('\n✗ Test failed:', error.message);
  process.exit(1);
});
