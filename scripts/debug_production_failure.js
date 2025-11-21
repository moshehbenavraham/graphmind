
import { generateCypherQuery } from './src/services/cypher-generator.js';
import { extractEntityReferences } from './src/lib/graph/cypher-templates.js';
import { createClient } from 'redis';

// Mock environment for generateCypherQuery
// We need to mock DB.prepare for resolveEntity to work against a "cache"
// We will mock the cache to contain 'GraphMind'
const mockEnv = {
    DB: {
        prepare: (query) => ({
            bind: (userId) => ({
                all: async () => {
                    console.log('[MockDB] Fetching entity cache...');
                    return {
                        results: [
                            { canonical_name: 'GraphMind', entity_type: 'Project', entity_id: 'proj_1' },
                            { canonical_name: 'Sarah Johnson', entity_type: 'Person', entity_id: 'person_1' }
                        ]
                    };
                }
            })
        })
    },
    AI: {
        run: async (model, params) => {
            console.log(`[MockAI] Running ${model}`);
            return { response: "Mock LLM Response" };
        }
    }
};

async function runDebug() {
    const question = "Who works at GraphMind?";
    const userId = "user_test_debug";

    console.log(`\n=== Debugging: "${question}" ===`);

    // 1. Test Entity Extraction
    console.log('\n1. Testing Entity Extraction...');
    const entities = await extractEntityReferences(question);
    console.log('Extracted Entities:', entities);

    if (entities.length === 0 || entities[0].text !== 'GraphMind') {
        console.error('❌ Entity extraction failed!');
    } else {
        console.log('✅ Entity extraction correct.');
    }

    // 2. Test Cypher Generation
    console.log('\n2. Testing Cypher Generation...');
    try {
        const result = await generateCypherQuery(question, userId, mockEnv);
        console.log('Generated Cypher:');
        console.log(result.cypher);

        if (!result.cypher.includes('(target:Person)-[r:WORKS_ON]->(source:Project')) {
            console.error('❌ Cypher directionality incorrect!');
        } else {
            console.log('✅ Cypher directionality correct.');
        }

        // 3. Test Execution against Local FalkorDB
        console.log('\n3. Testing Execution against Local FalkorDB...');
        const client = createClient({
            url: 'redis://localhost:6380'
        });
        await client.connect();

        // Setup Data
        const graphName = userId;
        await client.sendCommand(['GRAPH.QUERY', graphName, "CREATE (:Project {name: 'GraphMind'})<-[:WORKS_ON]-(:Person {name: 'Sarah Johnson'})"]);

        // Run Generated Query
        // We need to replace $source_name with 'GraphMind' manually for this test
        const executableCypher = result.cypher.replace('$source_name', "'GraphMind'");
        console.log('Executing:', executableCypher);

        const dbResult = await client.sendCommand(['GRAPH.QUERY', graphName, executableCypher]);
        console.log('DB Result:', JSON.stringify(dbResult, null, 2));

        // Parse result (RedisGraph returns array of arrays)
        // [header, [results], stats]
        const rows = dbResult[1];
        if (rows && rows.length > 0) {
            console.log(`✅ Query returned ${rows.length} rows.`);
        } else {
            console.error('❌ Query returned 0 rows.');
        }

        // Cleanup
        await client.sendCommand(['GRAPH.DELETE', graphName]);
        await client.disconnect();

    } catch (err) {
        console.error('❌ Error during generation/execution:', err);
    }
}

runDebug();
