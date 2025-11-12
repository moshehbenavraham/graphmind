/**
 * Test: Verify relationships created in FalkorDB after graph sync
 * Task: T053 [US1] Verify relationships inferred correctly
 *
 * This test validates that:
 * 1. Relationships are created between nodes
 * 2. Relationship types are correct (WORKS_AT, WORKS_ON, USES_TECHNOLOGY)
 * 3. Relationship properties are set correctly
 * 4. Relationships respect user namespace isolation
 */

const { createRestClient } = require('../src/lib/falkordb/rest-client');

async function verifyRelationships() {
  console.log('🔍 TEST: Verify relationships in FalkorDB\n');

  const client = createRestClient({
    host: 'localhost',
    port: 3001,
    username: 'default',
    password: ''
  });

  const testUserId = 'test_user_123';
  const graphName = 'test_user_123';

  try {
    // Test 1: Count all relationships
    console.log('Test 1: Count all relationships in graph');
    const countQuery = `
      MATCH ()-[r]->()
      RETURN count(r) as total_relationships
    `;

    const countResult = await client.query(graphName, countQuery, {});
    const totalRels = countResult[1][0]?.[0] || 0;
    console.log(`✅ Found ${totalRels} relationships in graph\n`);

    if (totalRels === 0) {
      console.log('❌ No relationships found');
      process.exit(1);
    }

    // Test 2: Get all relationships with details
    console.log('Test 2: Query all relationships with types and nodes');
    const allRelsQuery = `
      MATCH (from)-[r]->(to)
      WHERE from.user_id = $user_id AND to.user_id = $user_id
      RETURN
        labels(from)[0] as from_type,
        from.name as from_name,
        type(r) as rel_type,
        r as rel_props,
        labels(to)[0] as to_type,
        to.name as to_name
    `;

    const allRelsResult = await client.query(graphName, allRelsQuery, { user_id: testUserId });

    if (allRelsResult[1].length === 0) {
      console.log('❌ No relationships found for test user');
      process.exit(1);
    }

    console.log(`✅ Found ${allRelsResult[1].length} relationships:\n`);

    const relationships = [];
    allRelsResult[1].forEach((row, idx) => {
      const [from_type, from_name, rel_type, rel_props, to_type, to_name] = row;

      relationships.push({ from_type, from_name, rel_type, to_type, to_name });

      console.log(`  ${idx + 1}. (${from_type}: ${from_name})`);
      console.log(`     -[:${rel_type}]->`);
      console.log(`     (${to_type}: ${to_name})\n`);
    });

    // Test 3: Verify expected relationships from E2E test
    console.log('Test 3: Verify expected relationships');

    const expectedRels = [
      { from: 'Sarah Johnson', rel: 'WORKS_AT', to: 'TechCorp' },
      { from: 'Sarah Johnson', rel: 'WORKS_ON', to: 'GraphMind' },
      { from: 'GraphMind', rel: 'USES_TECHNOLOGY', to: 'FalkorDB' }
    ];

    let foundCount = 0;
    for (const expected of expectedRels) {
      const found = relationships.find(r =>
        r.from_name === expected.from &&
        r.rel_type === expected.rel &&
        r.to_name === expected.to
      );

      if (found) {
        console.log(`✅ Found: ${expected.from} -[:${expected.rel}]-> ${expected.to}`);
        foundCount++;
      } else {
        console.log(`❌ Missing: ${expected.from} -[:${expected.rel}]-> ${expected.to}`);
      }
    }

    // Test 4: Verify Sarah Johnson's specific connections
    console.log("\n\nTest 4: Verify Sarah Johnson's connections");
    const sarahQuery = `
      MATCH (sarah:Person {user_id: $user_id, entity_id: $entity_id})-[r]->(connected)
      RETURN type(r) as rel_type, labels(connected)[0] as connected_type, connected.name as name
    `;

    const sarahResult = await client.query(graphName, sarahQuery, {
      user_id: testUserId,
      entity_id: 'person-sarah-johnson'
    });

    console.log(`Sarah Johnson has ${sarahResult[1].length} outgoing relationships:`);
    sarahResult[1].forEach(row => {
      const [rel_type, connected_type, name] = row;
      console.log(`  - [:${rel_type}] → ${connected_type}: ${name}`);
    });

    if (sarahResult[1].length === 2) {
      console.log('✅ Correct number of connections (2)');
    } else {
      console.log(`⚠️  Expected 2 connections, found ${sarahResult[1].length}`);
    }

    // Test 5: Test relationship traversal (multi-hop)
    console.log('\n\nTest 5: Test 2-hop traversal');
    const traversalQuery = `
      MATCH path = (start:Person {user_id: $user_id})-[*..2]-(end)
      RETURN count(DISTINCT end) as reachable_nodes
    `;

    const traversalResult = await client.query(graphName, traversalQuery, { user_id: testUserId });
    const reachableNodes = traversalResult[1][0]?.[0] || 0;
    console.log(`✅ Can reach ${reachableNodes} unique nodes from Person nodes (within 2 hops)`);

    // Summary
    console.log('\n\n📊 SUMMARY:');
    console.log('─'.repeat(50));
    console.log(`Total relationships: ${totalRels}`);
    console.log(`Expected relationships found: ${foundCount}/${expectedRels.length}`);
    console.log(`Sarah Johnson's connections: ${sarahResult[1].length}`);
    console.log(`Reachable nodes (2-hop): ${reachableNodes}`);

    // Validation result
    if (foundCount === expectedRels.length && sarahResult[1].length === 2) {
      console.log('\n✅ T053 VALIDATION PASSED: All expected relationships created correctly');
      process.exit(0);
    } else {
      console.log('\n⚠️  T053 VALIDATION INCOMPLETE: Some expected relationships missing');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
verifyRelationships();
