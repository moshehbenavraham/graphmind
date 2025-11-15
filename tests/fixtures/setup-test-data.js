/**
 * Test Data Fixture Setup for E2E Tests
 * Creates test users and populates FalkorDB with sample graph data
 */

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const FALKORDB_GRAPH = process.env.TEST_GRAPH_NAME || 'test_e2e_graph';

/**
 * Test users for E2E tests
 */
export const TEST_USERS = {
  userA: {
    id: 'test_user_a_e2e',
    email: 'test_user_a@example.com',
    namespace: 'test_user_a_e2e_graph',
    name: 'Test User A'
  },
  userB: {
    id: 'test_user_b_e2e',
    email: 'test_user_b@example.com',
    namespace: 'test_user_b_e2e_graph',
    name: 'Test User B'
  }
};

/**
 * Sample entities for User A's graph
 */
export const USER_A_ENTITIES = {
  people: [
    {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@example.com',
      role: 'Engineering Manager',
      department: 'Engineering',
      location: 'San Francisco'
    },
    {
      name: 'Mike Chen',
      email: 'mike.chen@example.com',
      role: 'Senior Engineer',
      department: 'Engineering',
      location: 'Seattle'
    },
    {
      name: 'Emily Rodriguez',
      email: 'emily.rodriguez@example.com',
      role: 'Product Manager',
      department: 'Product',
      location: 'New York'
    }
  ],
  projects: [
    {
      name: 'FastAPI Migration',
      status: 'in_progress',
      priority: 'high',
      start_date: '2025-10-01',
      end_date: '2025-12-31'
    },
    {
      name: 'GraphRAG Integration',
      status: 'completed',
      priority: 'high',
      start_date: '2025-09-01',
      end_date: '2025-11-01'
    },
    {
      name: 'Voice UI Redesign',
      status: 'planning',
      priority: 'medium',
      start_date: '2025-11-15',
      end_date: '2026-02-28'
    }
  ],
  meetings: [
    {
      title: 'Sprint Planning',
      date: '2025-11-10',
      duration: 60,
      location: 'Conference Room A'
    },
    {
      title: 'Architecture Review',
      date: '2025-11-12',
      duration: 90,
      location: 'Virtual'
    }
  ],
  topics: [
    { name: 'Machine Learning', category: 'technology' },
    { name: 'Cloud Architecture', category: 'technology' },
    { name: 'Team Building', category: 'management' }
  ]
};

/**
 * Relationships for User A's graph
 */
export const USER_A_RELATIONSHIPS = [
  // People → Projects
  { from: 'Sarah Johnson', to: 'FastAPI Migration', type: 'WORKS_ON', since: '2025-10-01' },
  { from: 'Sarah Johnson', to: 'GraphRAG Integration', type: 'MANAGED', since: '2025-09-01' },
  { from: 'Mike Chen', to: 'FastAPI Migration', type: 'WORKS_ON', since: '2025-10-15' },
  { from: 'Emily Rodriguez', to: 'Voice UI Redesign', type: 'LEADS', since: '2025-11-01' },

  // People → Meetings
  { from: 'Sarah Johnson', to: 'Sprint Planning', type: 'ATTENDED', role: 'organizer' },
  { from: 'Mike Chen', to: 'Sprint Planning', type: 'ATTENDED', role: 'participant' },
  { from: 'Sarah Johnson', to: 'Architecture Review', type: 'ATTENDED', role: 'presenter' },

  // People → Topics
  { from: 'Sarah Johnson', to: 'Machine Learning', type: 'INTERESTED_IN' },
  { from: 'Sarah Johnson', to: 'Team Building', type: 'INTERESTED_IN' },
  { from: 'Mike Chen', to: 'Cloud Architecture', type: 'EXPERT_IN' },

  // People → People
  { from: 'Mike Chen', to: 'Sarah Johnson', type: 'REPORTS_TO', since: '2024-01-01' }
];

/**
 * Sample entities for User B's graph (different data for isolation testing)
 */
export const USER_B_ENTITIES = {
  people: [
    {
      name: 'Sarah Lee',  // Same first name, different person
      email: 'sarah.lee@example.com',
      role: 'Designer',
      department: 'Design',
      location: 'Austin'
    }
  ],
  projects: [
    {
      name: 'UI Components Library',
      status: 'in_progress',
      priority: 'high',
      start_date: '2025-10-15',
      end_date: '2025-12-15'
    }
  ]
};

/**
 * Relationships for User B's graph
 */
export const USER_B_RELATIONSHIPS = [
  { from: 'Sarah Lee', to: 'UI Components Library', type: 'LEADS', since: '2025-10-15' }
];

/**
 * Execute Cypher query via REST API
 */
async function executeCypher(query, graph = FALKORDB_GRAPH) {
  try {
    const response = await fetch(`${API_BASE_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph, query })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cypher execution failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error executing Cypher:', error);
    throw error;
  }
}

/**
 * Create nodes for a given entity type
 */
async function createNodes(namespace, entityType, entities) {
  const label = entityType.charAt(0).toUpperCase() + entityType.slice(1, -1); // 'people' -> 'Person'

  for (const entity of entities) {
    const props = Object.entries(entity)
      .map(([key, value]) => `${key}: "${value}"`)
      .join(', ');

    const query = `
      USE GRAPH ${namespace}
      CREATE (n:${label} {${props}})
      RETURN n
    `;

    await executeCypher(query);
    console.log(`  ✓ Created ${label}: ${entity.name || entity.title}`);
  }
}

/**
 * Create relationships between nodes
 */
async function createRelationships(namespace, relationships) {
  for (const rel of relationships) {
    const props = Object.entries(rel)
      .filter(([key]) => !['from', 'to', 'type'].includes(key))
      .map(([key, value]) => `${key}: "${value}"`)
      .join(', ');

    const propsStr = props ? `{${props}}` : '';

    const query = `
      USE GRAPH ${namespace}
      MATCH (a), (b)
      WHERE a.name = "${rel.from}" OR a.title = "${rel.from}"
      AND (b.name = "${rel.to}" OR b.title = "${rel.to}")
      CREATE (a)-[r:${rel.type} ${propsStr}]->(b)
      RETURN r
    `;

    await executeCypher(query);
    console.log(`  ✓ Created relationship: ${rel.from} -[${rel.type}]-> ${rel.to}`);
  }
}

/**
 * Clean up test graph data
 */
export async function cleanupTestData(namespace) {
  console.log(`\n🧹 Cleaning up test data for ${namespace}...`);

  try {
    // Delete all nodes and relationships in the graph
    const query = `
      USE GRAPH ${namespace}
      MATCH (n)
      DETACH DELETE n
    `;

    await executeCypher(query);
    console.log(`  ✓ Cleaned up ${namespace}`);
  } catch (error) {
    console.error(`  ✗ Error cleaning up ${namespace}:`, error.message);
  }
}

/**
 * Setup test data for User A
 */
async function setupUserAData() {
  const { namespace } = TEST_USERS.userA;
  console.log(`\n📦 Setting up test data for User A (${namespace})...`);

  try {
    // Create entities
    for (const [entityType, entities] of Object.entries(USER_A_ENTITIES)) {
      await createNodes(namespace, entityType, entities);
    }

    // Create relationships
    await createRelationships(namespace, USER_A_RELATIONSHIPS);

    console.log(`  ✅ User A data setup complete`);
  } catch (error) {
    console.error(`  ✗ Error setting up User A data:`, error.message);
    throw error;
  }
}

/**
 * Setup test data for User B
 */
async function setupUserBData() {
  const { namespace } = TEST_USERS.userB;
  console.log(`\n📦 Setting up test data for User B (${namespace})...`);

  try {
    // Create entities
    for (const [entityType, entities] of Object.entries(USER_B_ENTITIES)) {
      await createNodes(namespace, entityType, entities);
    }

    // Create relationships
    await createRelationships(namespace, USER_B_RELATIONSHIPS);

    console.log(`  ✅ User B data setup complete`);
  } catch (error) {
    console.error(`  ✗ Error setting up User B data:`, error.message);
    throw error;
  }
}

/**
 * Main setup function
 */
export async function setupAllTestData() {
  console.log('🚀 Setting up E2E test data...');
  console.log(`   API: ${API_BASE_URL}`);

  try {
    // Clean up existing test data
    await cleanupTestData(TEST_USERS.userA.namespace);
    await cleanupTestData(TEST_USERS.userB.namespace);

    // Setup new test data
    await setupUserAData();
    await setupUserBData();

    console.log('\n✅ All test data setup complete!');
    console.log('\nTest users created:');
    console.log(`  - User A: ${TEST_USERS.userA.email} (${TEST_USERS.userA.namespace})`);
    console.log(`  - User B: ${TEST_USERS.userB.email} (${TEST_USERS.userB.namespace})`);

    return true;
  } catch (error) {
    console.error('\n❌ Test data setup failed:', error);
    return false;
  }
}

/**
 * Cleanup all test data
 */
export async function cleanupAllTestData() {
  console.log('🧹 Cleaning up all E2E test data...');

  try {
    await cleanupTestData(TEST_USERS.userA.namespace);
    await cleanupTestData(TEST_USERS.userB.namespace);

    console.log('\n✅ All test data cleaned up!');
    return true;
  } catch (error) {
    console.error('\n❌ Test data cleanup failed:', error);
    return false;
  }
}

// If running directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'cleanup') {
    cleanupAllTestData().then(success => process.exit(success ? 0 : 1));
  } else {
    setupAllTestData().then(success => process.exit(success ? 0 : 1));
  }
}
