/**
 * Create test nodes for verification (T052)
 * This is the setup for testing node creation - it creates nodes that will be verified
 */

import { connect, executeCypher } from '../src/lib/falkordb/client.js';
import { buildMergeNode } from '../src/lib/graph/cypher-builder.js';

async function createTestNodes() {
  console.log('🔧 Creating test nodes for T052 verification\n');

  const config = {
    host: 'localhost',
    port: 3001,
    username: 'default',
    password: '',
  };

  const testUserId = 'test-user-123';
  const graphName = `graphmind_${testUserId}`;

  try {
    console.log(`Connecting to FalkorDB...`);
    const client = await connect(config);
    console.log('✅ Connected\n');

    // Test entities (matching E2E test format)
    const testNodes = [
      {
        user_id: testUserId,
        entity_id: 'person-sarah-johnson',
        label: 'Person',
        properties: {
          name: 'Sarah Johnson',
          role: 'lead engineer',
          entity_id: 'person-sarah-johnson'
        }
      },
      {
        user_id: testUserId,
        entity_id: 'project-graphmind',
        label: 'Project',
        properties: {
          name: 'GraphMind',
          status: 'active',
          entity_id: 'project-graphmind'
        }
      },
      {
        user_id: testUserId,
        entity_id: 'org-anthropic',
        label: 'Organization',
        properties: {
          name: 'Anthropic',
          entity_id: 'org-anthropic'
        }
      },
      {
        user_id: testUserId,
        entity_id: 'tech-falkordb',
        label: 'Technology',
        properties: {
          name: 'FalkorDB',
          category: 'database',
          entity_id: 'tech-falkordb'
        }
      }
    ];

    console.log(`Creating ${testNodes.length} test nodes:\n`);

    for (const node of testNodes) {
      const query = buildMergeNode(
        node.label,           // nodeType
        node.entity_id,       // entityId
        {
          ...node.properties,
          user_id: testUserId
        },                     // createProps
        node.properties       // updateProps
      );
      console.log(`Creating ${node.label}: ${node.properties.name}...`);

      const result = await executeCypher(graphName, query.cypher, query.params);

      // Parse result
      const stats = result[2]; // Statistics array
      const statsObj = {};
      stats.forEach(stat => {
        const [key, value] = stat.split(':').map(s => s.trim());
        statsObj[key] = parseInt(value) || value;
      });

      console.log(`  ✅ ${statsObj['Nodes created'] ? 'Created' : 'Updated'}`);
    }

    console.log('\n✅ All test nodes created successfully');
    console.log(`\nGraph: ${graphName}`);
    console.log(`User ID: ${testUserId}`);
    console.log('\nYou can now run test-verify-nodes.js to verify these nodes');

    await client.close();

  } catch (error) {
    console.error('❌ Failed to create test nodes:', error);
    throw error;
  }
}

createTestNodes()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
