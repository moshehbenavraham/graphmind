#!/usr/bin/env node

/**
 * FalkorDB Vector Index Creation Script
 *
 * Creates vector indexes for GraphRAG:
 * - Person.embedding
 * - Project.embedding
 * - Note.embedding
 * - Topic.embedding
 *
 * Usage:
 *   node scripts/vector-index.js
 *
 * Prerequisites:
 *   - FalkorDB REST API wrapper running on localhost:3001
 *   - FALKORDB_* environment variables set in .env
 */

import 'dotenv/config';
import { createRestClient } from '../src/lib/falkordb/rest-client.js';

const VECTOR_DIMENSION = 768;
const SIMILARITY_FUNCTION = 'cosine';

const VECTOR_INDEXES = [
    { type: 'Person', property: 'embedding' },
    { type: 'Project', property: 'embedding' },
    { type: 'Note', property: 'embedding' },
    { type: 'Topic', property: 'embedding' },
];

/**
 * Generate Cypher CREATE VECTOR INDEX command
 */
function generateVectorIndexCommand(nodeType, property) {
    return `CREATE VECTOR INDEX FOR (n:${nodeType}) ON (n.${property}) OPTIONS {dimension: ${VECTOR_DIMENSION}, similarityFunction: '${SIMILARITY_FUNCTION}'}`;
}

/**
 * Create a single vector index
 */
async function createVectorIndex(client, graphName, nodeType, property) {
    try {
        const cypherCommand = generateVectorIndexCommand(nodeType, property);
        console.log(`  Creating vector index: ${nodeType}.${property}`);

        await client.query(graphName, cypherCommand);

        console.log(`  ✅ Created vector index: ${nodeType}.${property}`);
        return { success: true, nodeType, property };
    } catch (error) {
        // Check if error is "index already exists" or "already indexed"
        const errorMsg = error.message ? error.message.toLowerCase() : '';
        if (errorMsg.includes('already exists') || errorMsg.includes('already indexed')) {
            console.log(`  ℹ️  Vector index already exists: ${nodeType}.${property}`);
            return { success: true, nodeType, property, alreadyExists: true };
        }

        console.error(`  ❌ Failed to create vector index: ${nodeType}.${property}`, error.message);
        return { success: false, nodeType, property, error: error.message };
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('🚀 FalkorDB Vector Index Creation Script');
    console.log('=========================================\n');

    // Validate environment
    const graphName = process.env.FALKORDB_GRAPH_NAME || 'graphmind';
    console.log(`Graph name: ${graphName}\n`);

    // Create client (connect to REST API wrapper on port 3001)
    const client = createRestClient({
        host: 'localhost',
        port: '3001', // REST API wrapper port
        user: process.env.FALKORDB_USER || 'default',
        password: process.env.FALKORDB_PASSWORD || '',
        apiKey: process.env.FALKORDB_REST_API_KEY,
    });

    const results = [];

    for (const { type, property } of VECTOR_INDEXES) {
        const result = await createVectorIndex(client, graphName, type, property);
        results.push(result);
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Summary
    console.log('\n📈 Vector Index Creation Summary');
    console.log('=====================================');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const alreadyExisted = successful.filter(r => r.alreadyExists);
    const newlyCreated = successful.filter(r => !r.alreadyExists);

    console.log(`✅ Successfully created: ${newlyCreated.length}`);
    console.log(`ℹ️  Already existed: ${alreadyExisted.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📊 Total indexes: ${successful.length}/${results.length}`);

    if (failed.length > 0) {
        console.log('\n❌ Failed indexes:');
        failed.forEach(f => {
            console.log(`  - ${f.nodeType}.${f.property}: ${f.error}`);
        });
        process.exit(1);
    }

    console.log('\n✅ All vector indexes created successfully!\n');
}

// Run the script
main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
