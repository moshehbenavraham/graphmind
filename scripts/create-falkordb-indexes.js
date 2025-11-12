#!/usr/bin/env node

/**
 * FalkorDB Index Creation Script
 *
 * Creates all required indexes for GraphMind knowledge graph:
 * - User isolation indexes (user_id on all 7 entity types)
 * - Name search indexes (name on searchable entities)
 * - Entity traceability indexes (entity_id on all types)
 *
 * Usage:
 *   node scripts/create-falkordb-indexes.js
 *
 * Prerequisites:
 *   - FalkorDB REST API wrapper running on localhost:3001
 *   - FALKORDB_* environment variables set in .env
 */

import { createRestClient } from '../src/lib/falkordb/rest-client.js';

/**
 * All indexes to create
 */
const INDEXES = {
  // User isolation indexes (CRITICAL for multi-tenancy)
  userIsolation: [
    { type: 'Person', property: 'user_id', purpose: 'User isolation' },
    { type: 'Project', property: 'user_id', purpose: 'User isolation' },
    { type: 'Meeting', property: 'user_id', purpose: 'User isolation' },
    { type: 'Topic', property: 'user_id', purpose: 'User isolation' },
    { type: 'Technology', property: 'user_id', purpose: 'User isolation' },
    { type: 'Location', property: 'user_id', purpose: 'User isolation' },
    { type: 'Organization', property: 'user_id', purpose: 'User isolation' },
  ],

  // Name search indexes (for fuzzy matching)
  nameSearch: [
    { type: 'Person', property: 'name', purpose: 'Name search' },
    { type: 'Project', property: 'name', purpose: 'Name search' },
    { type: 'Topic', property: 'name', purpose: 'Name search' },
    { type: 'Technology', property: 'name', purpose: 'Name search' },
    { type: 'Organization', property: 'name', purpose: 'Name search' },
  ],

  // Entity ID indexes (for traceability to D1)
  entityTraceability: [
    { type: 'Person', property: 'entity_id', purpose: 'Entity traceability' },
    { type: 'Project', property: 'entity_id', purpose: 'Entity traceability' },
    { type: 'Meeting', property: 'entity_id', purpose: 'Entity traceability' },
    { type: 'Topic', property: 'entity_id', purpose: 'Entity traceability' },
    { type: 'Technology', property: 'entity_id', purpose: 'Entity traceability' },
    { type: 'Location', property: 'entity_id', purpose: 'Entity traceability' },
    { type: 'Organization', property: 'entity_id', purpose: 'Entity traceability' },
  ],
};

/**
 * Generate Cypher CREATE INDEX command
 */
function generateIndexCommand(nodeType, property) {
  return `CREATE INDEX FOR (n:${nodeType}) ON (n.${property})`;
}

/**
 * Generate Cypher command to list all indexes
 */
function generateListIndexesCommand() {
  return 'CALL db.indexes()';
}

/**
 * Check if index already exists
 */
function indexExists(indexes, nodeType, property) {
  if (!indexes || !Array.isArray(indexes)) {
    return false;
  }

  return indexes.some(idx => {
    // FalkorDB index format varies, check multiple patterns
    const label = idx.label || idx.type || '';
    const props = idx.properties || idx.property || '';

    return (
      label.includes(nodeType) &&
      (props.includes(property) || String(props) === property)
    );
  });
}

/**
 * Create a single index
 */
async function createIndex(client, graphName, nodeType, property, purpose) {
  try {
    const cypherCommand = generateIndexCommand(nodeType, property);
    console.log(`  Creating index: ${nodeType}.${property} (${purpose})`);

    const result = await client.query(graphName, cypherCommand);

    console.log(`  ✅ Created index: ${nodeType}.${property}`);
    return { success: true, nodeType, property };
  } catch (error) {
    // Check if error is "index already exists"
    if (error.message && error.message.toLowerCase().includes('already exists')) {
      console.log(`  ℹ️  Index already exists: ${nodeType}.${property}`);
      return { success: true, nodeType, property, alreadyExists: true };
    }

    console.error(`  ❌ Failed to create index: ${nodeType}.${property}`, error.message);
    return { success: false, nodeType, property, error: error.message };
  }
}

/**
 * Create all indexes in a category
 */
async function createIndexCategory(client, graphName, categoryName, indexes) {
  console.log(`\n📊 Creating ${categoryName} indexes...`);

  const results = [];

  for (const { type, property, purpose } of indexes) {
    const result = await createIndex(client, graphName, type, property, purpose);
    results.push(result);

    // Small delay to avoid overwhelming FalkorDB
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * List all existing indexes
 */
async function listExistingIndexes(client, graphName) {
  try {
    console.log('\n🔍 Checking existing indexes...');

    const result = await client.query(graphName, generateListIndexesCommand());

    if (result && Array.isArray(result)) {
      console.log(`Found ${result.length} existing indexes`);
      result.forEach(idx => {
        console.log(`  - ${idx.label || idx.type || 'Unknown'}.${idx.properties || idx.property || 'Unknown'}`);
      });
      return result;
    }

    console.log('No indexes found (or unable to list)');
    return [];
  } catch (error) {
    console.log('Unable to list indexes (this is OK, will create anyway)');
    return [];
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 FalkorDB Index Creation Script');
  console.log('=====================================\n');

  // Validate environment
  const graphName = process.env.FALKORDB_GRAPH_NAME || 'graphmind';
  console.log(`Graph name: ${graphName}\n`);

  // Create client (connect to REST API wrapper on port 3001)
  const client = createRestClient({
    host: 'localhost',
    port: '3001', // REST API wrapper port
    user: process.env.FALKORDB_USER || 'default',
    password: process.env.FALKORDB_PASSWORD || '',
  });

  // List existing indexes first
  const existingIndexes = await listExistingIndexes(client, graphName);

  // Create all index categories
  const allResults = [];

  // User isolation indexes (MOST CRITICAL)
  const userIsolationResults = await createIndexCategory(
    client,
    graphName,
    'User Isolation',
    INDEXES.userIsolation
  );
  allResults.push(...userIsolationResults);

  // Name search indexes
  const nameSearchResults = await createIndexCategory(
    client,
    graphName,
    'Name Search',
    INDEXES.nameSearch
  );
  allResults.push(...nameSearchResults);

  // Entity traceability indexes
  const traceabilityResults = await createIndexCategory(
    client,
    graphName,
    'Entity Traceability',
    INDEXES.entityTraceability
  );
  allResults.push(...traceabilityResults);

  // Summary
  console.log('\n📈 Index Creation Summary');
  console.log('=====================================');

  const successful = allResults.filter(r => r.success);
  const failed = allResults.filter(r => !r.success);
  const alreadyExisted = successful.filter(r => r.alreadyExists);
  const newlyCreated = successful.filter(r => !r.alreadyExists);

  console.log(`✅ Successfully created: ${newlyCreated.length}`);
  console.log(`ℹ️  Already existed: ${alreadyExisted.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📊 Total indexes: ${successful.length}/${allResults.length}`);

  if (failed.length > 0) {
    console.log('\n❌ Failed indexes:');
    failed.forEach(f => {
      console.log(`  - ${f.nodeType}.${f.property}: ${f.error}`);
    });
    process.exit(1);
  }

  console.log('\n✅ All indexes created successfully!\n');

  // Verify indexes were created
  console.log('🔍 Verifying indexes...');
  await listExistingIndexes(client, graphName);

  console.log('\n✨ Index creation complete!\n');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
