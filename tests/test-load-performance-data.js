/**
 * Performance Testing - Load 1,000 Entity Dataset into FalkorDB
 *
 * Loads test dataset via GraphRAG service and measures:
 * - Total load time
 * - Nodes created per second
 * - Relationships created per second
 * - Batch processing efficiency
 *
 * Tests US3 infrastructure readiness
 */

import fs from 'fs/promises';
import { createRestClient } from '../src/lib/falkordb/rest-client.js';

const BATCH_SIZE = 50; // Process 50 entities at a time
const TEST_USER_ID = 'perf_test_user_001';
const GRAPH_NAME = 'graphmind';

/**
 * Load and parse dataset
 */
async function loadDataset() {
  console.log('📂 Loading performance test dataset...\n');

  const data = await fs.readFile('performance-test-dataset.json', 'utf8');
  const dataset = JSON.parse(data);

  console.log('📊 Dataset loaded:');
  console.log(`   Entities: ${dataset.metadata.total_count}`);
  console.log(`   Relationships: ${dataset.metadata.relationship_count}`);
  console.log(`   Generated: ${dataset.metadata.generated_at}\n`);

  return dataset;
}

/**
 * Create a node in FalkorDB
 */
async function createNode(client, entity, userId) {
  const properties = {
    user_id: userId,
    entity_id: entity.entity_id,
    name: entity.name,
    entity_type: entity.entity_type,
    mention_count: entity.mention_count,
    created_at: new Date().toISOString(),
    ...entity.properties
  };

  // Convert properties to Cypher format
  const propsStr = Object.entries(properties)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key}: "${value.replace(/"/g, '\\"')}"`;
      }
      return `${key}: ${value}`;
    })
    .join(', ');

  const cypher = `
    MERGE (n:${entity.entity_type} {entity_id: "${entity.entity_id}", user_id: "${userId}"})
    ON CREATE SET n += {${propsStr}}
    ON MATCH SET n.mention_count = ${entity.mention_count}, n.name = "${entity.name.replace(/"/g, '\\"')}"
    RETURN n.entity_id as entity_id
  `;

  try {
    await client.query(GRAPH_NAME, cypher);
    return true;
  } catch (error) {
    console.error(`❌ Failed to create node ${entity.entity_id}:`, error.message);
    return false;
  }
}

/**
 * Create a relationship in FalkorDB
 */
async function createRelationship(client, rel, userId) {
  const propsStr = Object.entries(rel.properties || {})
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key}: "${value.replace(/"/g, '\\"')}"`;
      }
      return `${key}: ${value}`;
    })
    .join(', ');

  const propsClause = propsStr ? `{${propsStr}}` : '';

  const cypher = `
    MATCH (source {entity_id: "${rel.source_id}", user_id: "${userId}"})
    MATCH (target {entity_id: "${rel.target_id}", user_id: "${userId}"})
    MERGE (source)-[r:${rel.relationship_type}]->(target)
    ON CREATE SET r += ${propsClause || '{}'}
    RETURN r
  `;

  try {
    await client.query(GRAPH_NAME, cypher);
    return true;
  } catch (error) {
    console.error(`❌ Failed to create relationship ${rel.source_id} -> ${rel.target_id}:`, error.message);
    return false;
  }
}

/**
 * Process entities in batches
 */
async function loadEntities(client, entities, userId) {
  console.log(`🔄 Loading ${entities.length} entities in batches of ${BATCH_SIZE}...\n`);

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;

  // Process in batches
  for (let i = 0; i < entities.length; i += BATCH_SIZE) {
    const batch = entities.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(entities.length / BATCH_SIZE);

    const batchStart = Date.now();

    // Process batch in parallel
    const results = await Promise.all(
      batch.map(entity => createNode(client, entity, userId))
    );

    const batchSuccess = results.filter(r => r).length;
    const batchFail = results.filter(r => !r).length;

    successCount += batchSuccess;
    failCount += batchFail;

    const batchTime = Date.now() - batchStart;
    const avgTimePerNode = (batchTime / batch.length).toFixed(2);

    console.log(`   Batch ${batchNum}/${totalBatches}: ${batchSuccess}/${batch.length} entities (${avgTimePerNode}ms/node, ${batchTime}ms total)`);

    // Rate limit - small delay between batches
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  const totalTime = Date.now() - startTime;
  const nodesPerSecond = ((successCount / totalTime) * 1000).toFixed(2);

  console.log('\n✅ Entity loading complete:');
  console.log(`   Success: ${successCount}/${entities.length} entities`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total time: ${totalTime}ms`);
  console.log(`   Throughput: ${nodesPerSecond} nodes/second\n`);

  return { successCount, failCount, totalTime, nodesPerSecond };
}

/**
 * Process relationships in batches
 */
async function loadRelationships(client, relationships, userId) {
  console.log(`🔗 Loading ${relationships.length} relationships in batches of ${BATCH_SIZE}...\n`);

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;

  // Process in batches
  for (let i = 0; i < relationships.length; i += BATCH_SIZE) {
    const batch = relationships.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(relationships.length / BATCH_SIZE);

    const batchStart = Date.now();

    // Process batch in parallel
    const results = await Promise.all(
      batch.map(rel => createRelationship(client, rel, userId))
    );

    const batchSuccess = results.filter(r => r).length;
    const batchFail = results.filter(r => !r).length;

    successCount += batchSuccess;
    failCount += batchFail;

    const batchTime = Date.now() - batchStart;
    const avgTimePerRel = (batchTime / batch.length).toFixed(2);

    console.log(`   Batch ${batchNum}/${totalBatches}: ${batchSuccess}/${batch.length} relationships (${avgTimePerRel}ms/rel, ${batchTime}ms total)`);

    // Rate limit - small delay between batches
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  const totalTime = Date.now() - startTime;
  const relsPerSecond = ((successCount / totalTime) * 1000).toFixed(2);

  console.log('\n✅ Relationship loading complete:');
  console.log(`   Success: ${successCount}/${relationships.length} relationships`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total time: ${totalTime}ms`);
  console.log(`   Throughput: ${relsPerSecond} relationships/second\n`);

  return { successCount, failCount, totalTime, relsPerSecond };
}

/**
 * Verify data loaded correctly
 */
async function verifyData(client, userId) {
  console.log('🔍 Verifying data loaded correctly...\n');

  // Count nodes by type
  const countQuery = `
    MATCH (n)
    WHERE n.user_id = "${userId}"
    RETURN n.entity_type as type, count(n) as count
    ORDER BY type
  `;

  const countResult = await client.query(GRAPH_NAME, countQuery);

  console.log('📊 Nodes by type:');
  const nodeCounts = {};
  if (countResult.result && countResult.result.length > 0) {
    countResult.result.forEach(row => {
      const type = row[0]; // type
      const count = row[1]; // count
      nodeCounts[type] = count;
      console.log(`   ${type}: ${count}`);
    });
  }

  // Count relationships
  const relQuery = `
    MATCH (source)-[r]->(target)
    WHERE source.user_id = "${userId}" AND target.user_id = "${userId}"
    RETURN type(r) as type, count(r) as count
    ORDER BY type
  `;

  const relResult = await client.query(GRAPH_NAME, relQuery);

  console.log('\n🔗 Relationships by type:');
  const relCounts = {};
  let totalRels = 0;
  if (relResult.result && relResult.result.length > 0) {
    relResult.result.forEach(row => {
      const type = row[0]; // type
      const count = row[1]; // count
      relCounts[type] = count;
      totalRels += count;
      console.log(`   ${type}: ${count}`);
    });
  }

  const totalNodes = Object.values(nodeCounts).reduce((sum, count) => sum + count, 0);

  console.log(`\n📈 Total:`)
  console.log(`   Nodes: ${totalNodes}`);
  console.log(`   Relationships: ${totalRels}\n`);

  return { nodeCounts, relCounts, totalNodes, totalRels };
}

/**
 * Main execution
 */
async function main() {
  console.log('⚡ Performance Data Loader\n');
  console.log('=' .repeat(60) + '\n');

  // Create REST client (use REST API wrapper on port 3001)
  const client = createRestClient({
    host: 'localhost',
    port: 3001,
    username: 'default',
    password: ''
  });

  // Test connection
  console.log('🔌 Testing connection to FalkorDB REST API...');
  try {
    await client.query(GRAPH_NAME, 'RETURN 1');
    console.log('✅ Connection successful\n');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('   Make sure REST API wrapper is running: node scripts/falkordb-rest-api.js\n');
    process.exit(1);
  }

  // Load dataset
  const dataset = await loadDataset();

  // Clear existing test data
  console.log('🧹 Clearing existing test data...');
  try {
    await client.query(GRAPH_NAME, `
      MATCH (n {user_id: "${TEST_USER_ID}"})
      DETACH DELETE n
    `);
    console.log('✅ Existing test data cleared\n');
  } catch (error) {
    console.log('⚠️  No existing data to clear\n');
  }

  // Load entities
  const entityStats = await loadEntities(client, dataset.entities, TEST_USER_ID);

  // Load relationships
  const relStats = await loadRelationships(client, dataset.relationships, TEST_USER_ID);

  // Verify data
  const verifyStats = await verifyData(client, TEST_USER_ID);

  // Summary
  console.log('=' .repeat(60));
  console.log('📊 LOADING SUMMARY\n');
  console.log(`✅ Entities loaded: ${entityStats.successCount}/${dataset.metadata.total_count}`);
  console.log(`   Throughput: ${entityStats.nodesPerSecond} nodes/second`);
  console.log(`   Total time: ${entityStats.totalTime}ms\n`);

  console.log(`✅ Relationships loaded: ${relStats.successCount}/${dataset.metadata.relationship_count}`);
  console.log(`   Throughput: ${relStats.relsPerSecond} rels/second`);
  console.log(`   Total time: ${relStats.totalTime}ms\n`);

  console.log(`📈 Verified in database:`);
  console.log(`   Nodes: ${verifyStats.totalNodes}`);
  console.log(`   Relationships: ${verifyStats.totalRels}\n`);

  const overallTime = entityStats.totalTime + relStats.totalTime;
  console.log(`⏱️  Total load time: ${overallTime}ms (${(overallTime / 1000).toFixed(2)}s)\n`);

  console.log('✅ Performance dataset loaded successfully!');
  console.log(`   User ID: ${TEST_USER_ID}`);
  console.log(`   Ready for performance testing (T102-T107)\n`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

export { loadDataset, loadEntities, loadRelationships, verifyData };
