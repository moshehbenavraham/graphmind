/**
 * Test: Graph API Functionality (T054 & T055)
 *
 * Tests the core functionality that the API endpoints provide:
 * - T054: GET /api/graph functionality (retrieve full graph)
 * - T055: GET /api/graph/entity/:id functionality (entity neighborhood)
 *
 * This tests the underlying Cypher queries and data formatting,
 * which is what the API endpoints use internally.
 */

const { createRestClient } = require('../src/lib/falkordb/rest-client');

async function testGraphAPIFunctionality() {
  console.log('🧪 TEST: Graph API Functionality (T054 & T055)\n');
  console.log('=' + '='.repeat(60));

  const client = createRestClient({
    host: 'localhost',
    port: 3001,
    username: 'default',
    password: ''
  });

  const testUserId = 'test_user_123';
  const graphName = 'test_user_123';

  const results = {
    t054_passed: false,
    t055_passed: false,
    details: {}
  };

  try {
    // =================================================================
    // T054: Test GET /api/graph functionality
    // =================================================================
    console.log('\n📌 T054: Test GET /api/graph Functionality');
    console.log('-'.repeat(60));

    // This is the core query that get-graph.js uses
    const getGraphQuery = `
      MATCH (n {user_id: $user_id})
      OPTIONAL MATCH (n)-[r]-(connected)
      WHERE connected.user_id = $user_id
      WITH n, collect(DISTINCT r) as relationships, collect(DISTINCT connected) as connected_nodes
      ORDER BY n.mention_count DESC
      LIMIT $limit
      RETURN n, relationships, connected_nodes
    `;

    const getGraphParams = {
      user_id: testUserId,
      limit: 50
    };

    console.log('Executing graph retrieval query...');
    const graphResult = await client.query(graphName, getGraphQuery, getGraphParams);

    // Parse result (Redis format: [headers, data, stats])
    const headers = graphResult[0];
    const dataRows = graphResult[1];
    const stats = graphResult[2];

    console.log(`✅ Query executed successfully`);
    console.log(`   Headers: ${headers.join(', ')}`);
    console.log(`   Rows returned: ${dataRows.length}`);
    console.log(`   Statistics: ${stats[0]}`);

    if (dataRows.length === 0) {
      console.log('❌ No data returned from graph query');
      results.details.t054_error = 'No data returned';
    } else {
      console.log(`\n✅ Retrieved ${dataRows.length} nodes from graph`);

      // Verify data structure
      console.log('\nData structure validation:');
      const firstRow = dataRows[0];
      console.log(`  - Has node data: ${firstRow[0] !== undefined ? '✅' : '❌'}`);
      console.log(`  - Has relationships: ${firstRow[1] !== undefined ? '✅' : '❌'}`);
      console.log(`  - Has connected nodes: ${firstRow[2] !== undefined ? '✅' : '❌'}`);

      // Format data like the API would
      const nodes = dataRows.map(row => {
        const nodeData = row[0];
        // FalkorDB returns nodes in a specific format
        return {
          type: 'node_data_available',
          has_relationships: row[1] && row[1].length > 0,
          has_connections: row[2] && row[2].length > 0
        };
      });

      console.log(`\nFormatted data:`);
      console.log(`  - Total nodes: ${nodes.length}`);
      console.log(`  - Nodes with relationships: ${nodes.filter(n => n.has_relationships).length}`);
      console.log(`  - Nodes with connections: ${nodes.filter(n => n.has_connections).length}`);

      results.t054_passed = true;
      results.details.t054 = {
        nodes_returned: dataRows.length,
        query_time: stats[1] || 'N/A'
      };
    }

    // =================================================================
    // T055: Test GET /api/graph/entity/:id functionality
    // =================================================================
    console.log('\n\n📌 T055: Test GET /api/graph/entity/:id Functionality');
    console.log('-'.repeat(60));

    // This is the core query that get-entity.js uses for neighborhood retrieval
    const getEntityQuery = `
      MATCH (center {user_id: $user_id, entity_id: $entity_id})
      OPTIONAL MATCH (center)-[r]-(neighbor)
      WHERE neighbor.user_id = $user_id
      RETURN
        center,
        labels(center) as center_type,
        collect(DISTINCT {
          relationship: r,
          rel_type: type(r),
          neighbor: neighbor,
          neighbor_type: labels(neighbor)[0]
        }) as neighbors
    `;

    const entityId = 'person-sarah-johnson';
    const getEntityParams = {
      user_id: testUserId,
      entity_id: entityId
    };

    console.log(`Querying entity: ${entityId}`);
    const entityResult = await client.query(graphName, getEntityQuery, getEntityParams);

    const entityHeaders = entityResult[0];
    const entityData = entityResult[1];
    const entityStats = entityResult[2];

    console.log(`✅ Query executed successfully`);
    console.log(`   Headers: ${entityHeaders.join(', ')}`);
    console.log(`   Rows returned: ${entityData.length}`);
    console.log(`   Statistics: ${entityStats[0]}`);

    if (entityData.length === 0) {
      console.log(`❌ Entity not found: ${entityId}`);
      results.details.t055_error = 'Entity not found';
    } else {
      const entityRow = entityData[0];
      const centerNode = entityRow[0];
      const centerType = entityRow[1];
      const neighbors = entityRow[2];

      console.log(`\n✅ Found entity:`);
      console.log(`   Type: ${centerType}`);
      console.log(`   Neighbors: ${neighbors ? neighbors.length : 0}`);

      // Parse neighbor data
      if (neighbors && neighbors.length > 0) {
        console.log(`\n   Neighborhood details:`);
        // The neighbors are returned as a collection, need to parse
        console.log(`   - Connections found: ${neighbors.length > 0 ? 'Yes' : 'No'}`);
        console.log(`   - Has relationship data: ${neighbors.length > 0 ? '✅' : '❌'}`);
      }

      results.t055_passed = true;
      results.details.t055 = {
        entity_found: true,
        entity_type: centerType,
        neighbor_count: neighbors ? neighbors.length : 0,
        query_time: entityStats[1] || 'N/A'
      };
    }

    // =================================================================
    // Additional verification: Test with type filter (T054 variant)
    // =================================================================
    console.log('\n\n📌 Additional: Test type filtering');
    console.log('-'.repeat(60));

    const typeFilterQuery = `
      MATCH (n:Person {user_id: $user_id})
      RETURN n, labels(n) as type
      LIMIT 10
    `;

    console.log('Querying for Person nodes only...');
    const typeFilterResult = await client.query(graphName, typeFilterQuery, { user_id: testUserId });

    const personCount = typeFilterResult[1].length;
    console.log(`✅ Found ${personCount} Person node(s)`);

    if (personCount > 0) {
      const personNode = typeFilterResult[1][0];
      console.log(`   Example: ${JSON.stringify(personNode[1])}`);
    }

    // =================================================================
    // Summary
    // =================================================================
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    console.log(`\nT054 - GET /api/graph functionality:`);
    console.log(`  Status: ${results.t054_passed ? '✅ PASSED' : '❌ FAILED'}`);
    if (results.details.t054) {
      console.log(`  Nodes returned: ${results.details.t054.nodes_returned}`);
      console.log(`  Query time: ${results.details.t054.query_time}`);
    } else if (results.details.t054_error) {
      console.log(`  Error: ${results.details.t054_error}`);
    }

    console.log(`\nT055 - GET /api/graph/entity/:id functionality:`);
    console.log(`  Status: ${results.t055_passed ? '✅ PASSED' : '❌ FAILED'}`);
    if (results.details.t055) {
      console.log(`  Entity found: ${results.details.t055.entity_found}`);
      console.log(`  Entity type: ${results.details.t055.entity_type}`);
      console.log(`  Neighbors: ${results.details.t055.neighbor_count}`);
      console.log(`  Query time: ${results.details.t055.query_time}`);
    } else if (results.details.t055_error) {
      console.log(`  Error: ${results.details.t055_error}`);
    }

    console.log(`\nType filtering:`);
    console.log(`  Person nodes: ${personCount}`);

    // Final verdict
    if (results.t054_passed && results.t055_passed) {
      console.log('\n✅ ALL API FUNCTIONALITY TESTS PASSED');
      console.log('   T054 and T055 validation complete!');
      process.exit(0);
    } else {
      console.log('\n⚠️  SOME TESTS FAILED');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
testGraphAPIFunctionality();
