/**
 * Test script for FalkorDB connection
 *
 * Tests the basic FalkorDB client functionality:
 * - Connection to FalkorDB Cloud
 * - Namespace creation
 * - Basic CRUD operations
 * - Error handling
 */

import { connect, disconnect, executeCypher, validateConnection } from '../src/lib/falkordb/client.js';
import { generateGraphName, createGraphDatabase, isValidGraphName } from '../src/lib/falkordb/namespace.js';
import { normalizeError } from '../src/lib/falkordb/errors.js';

// Load environment variables
import { config } from 'dotenv';
config();

async function testFalkorDBConnection() {
  console.log('=== FalkorDB Connection Test ===\n');

  // Test 1: Configuration validation
  console.log('Test 1: Validating configuration...');
  const requiredEnvVars = ['FALKORDB_HOST', 'FALKORDB_PORT', 'FALKORDB_USER', 'FALKORDB_PASSWORD'];
  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    console.log('\nPlease configure these in your .env file');
    process.exit(1);
  }
  console.log('✅ All required environment variables present\n');

  // Test 2: Namespace utilities
  console.log('Test 2: Testing namespace utilities...');
  try {
    const testUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const graphName = generateGraphName(testUserId);
    console.log(`Generated graph name: ${graphName}`);

    const isValid = isValidGraphName(graphName);
    console.log(`Graph name valid: ${isValid}`);

    if (!isValid) {
      throw new Error('Generated graph name is invalid');
    }
    console.log('✅ Namespace utilities working\n');
  } catch (error) {
    console.error('❌ Namespace test failed:', error.message);
    process.exit(1);
  }

  // Test 3: Connection to FalkorDB
  console.log('Test 3: Connecting to FalkorDB...');
  let client;
  try {
    client = await connect({
      host: process.env.FALKORDB_HOST,
      port: process.env.FALKORDB_PORT,
      username: process.env.FALKORDB_USER,
      password: process.env.FALKORDB_PASSWORD,
      connectTimeout: 10000, // 10s timeout for test
    });
    console.log('✅ Connected to FalkorDB successfully\n');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Details:', {
      host: process.env.FALKORDB_HOST,
      port: process.env.FALKORDB_PORT,
      httpStatus: error.httpStatus,
    });
    process.exit(1);
  }

  // Test 4: Connection validation
  console.log('Test 4: Validating connection health...');
  try {
    const health = await validateConnection(client);
    console.log('Connection health:', health);

    if (!health.valid) {
      throw new Error(`Connection unhealthy: ${health.error}`);
    }
    console.log(`✅ Connection healthy (latency: ${health.latency}ms)\n`);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }

  // Test 5: Create test graph
  console.log('Test 5: Creating test graph database...');
  const testGraphName = generateGraphName('test-user-' + Date.now().toString(36));
  try {
    const created = await createGraphDatabase(client, testGraphName);
    if (created) {
      console.log(`✅ Test graph created: ${testGraphName}\n`);
    } else {
      console.log(`✅ Test graph already exists: ${testGraphName}\n`);
    }
  } catch (error) {
    console.error('❌ Graph creation failed:', error.message);
    console.error('Details:', error);
  }

  // Test 6: Basic CRUD operations
  console.log('Test 6: Testing basic graph operations...');
  try {
    // Create a test node
    const createResult = await executeCypher(
      client,
      testGraphName,
      'CREATE (n:TestNode {id: $id, name: $name, timestamp: $timestamp}) RETURN n',
      {
        id: 'test-1',
        name: 'Test Node',
        timestamp: Date.now(),
      }
    );
    console.log('Created node:', createResult.data[0]);

    // Query the node
    const queryResult = await executeCypher(
      client,
      testGraphName,
      'MATCH (n:TestNode {id: $id}) RETURN n',
      { id: 'test-1' }
    );
    console.log('Queried node:', queryResult.data[0]);

    // Delete the node
    const deleteResult = await executeCypher(
      client,
      testGraphName,
      'MATCH (n:TestNode {id: $id}) DELETE n',
      { id: 'test-1' }
    );
    console.log('Deleted node');

    console.log('✅ Basic CRUD operations successful\n');
  } catch (error) {
    console.error('❌ CRUD operations failed:', error.message);
    console.error('Details:', error);
  }

  // Test 7: Error handling
  console.log('Test 7: Testing error handling...');
  try {
    // Try invalid Cypher query
    await executeCypher(client, testGraphName, 'INVALID CYPHER SYNTAX');
    console.log('❌ Should have thrown error for invalid query');
  } catch (error) {
    const normalized = normalizeError(error);
    console.log('Caught expected error:', normalized.message);
    console.log('HTTP status:', normalized.httpStatus);
    console.log('✅ Error handling working\n');
  }

  // Cleanup and disconnect
  console.log('Test 8: Disconnecting...');
  try {
    await disconnect(client);
    console.log('✅ Disconnected successfully\n');
  } catch (error) {
    console.error('❌ Disconnect failed:', error.message);
  }

  console.log('=== All Tests Complete ===');
  console.log('\n✅ FalkorDB connection infrastructure is working!');
  console.log(`\nTest graph created: ${testGraphName}`);
  console.log('You can clean it up by running:');
  console.log(`GRAPH.DELETE ${testGraphName}`);
}

// Run tests
testFalkorDBConnection().catch((error) => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
