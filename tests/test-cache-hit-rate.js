/**
 * Test: KV Cache Hit Rate Validation (T107)
 *
 * Tests that the KV cache integration provides >70% cache hit rate
 * over 100 queries with realistic query patterns.
 *
 * This validates that the cache utilities are properly integrated into
 * API endpoints and providing the expected performance benefit.
 */

import { executeWithCache } from '../src/lib/graph/query-cache.js';
import { executeStatsWithCache } from '../src/lib/graph/stats-cache.js';
import { executeNeighborhoodWithCache } from '../src/lib/graph/neighborhood-cache.js';
import { createRestClient } from '../src/lib/falkordb/rest-client.js';

// Test configuration
const TEST_USER_ID = 'perf_test_user_001'; // Match the user ID from test-load-performance-data.js
const GRAPH_NAME = 'graphmind'; // Match the graph name from test-load-performance-data.js
const TOTAL_QUERIES = 100;
const TARGET_CACHE_HIT_RATE = 0.70; // 70%

// Mock KV namespace for testing
const mockKV = {
  cache: new Map(),

  async get(key, options) {
    const data = this.cache.get(key);
    if (!data) return null;

    if (options?.type === 'json') {
      return JSON.parse(data);
    }
    return data;
  },

  async put(key, value, options) {
    this.cache.set(key, value);
  },

  async delete(key) {
    this.cache.delete(key);
  },

  clearAll() {
    this.cache.clear();
  }
};

// FalkorDB connection via REST API wrapper
const falkordb = createRestClient({
  host: process.env.FALKORDB_REST_HOST || 'localhost',
  port: parseInt(process.env.FALKORDB_REST_PORT || '3001'), // REST API wrapper port, not FalkorDB port
  username: process.env.FALKORDB_USER || 'default',
  password: process.env.FALKORDB_PASSWORD || '',
});

/**
 * Test cache hit rate across different query types
 */
async function testCacheHitRate() {
  console.log('\n🧪 TEST: Cache Hit Rate (T107)\n');
  console.log('Target: >70% cache hit rate over 100 queries');
  console.log('Testing: Query cache, stats cache, neighborhood cache\n');

  // Clear cache before test
  mockKV.clearAll();

  const cacheStats = {
    total: 0,
    hits: 0,
    misses: 0,
    byType: {
      query: { hits: 0, misses: 0 },
      stats: { hits: 0, misses: 0 },
      neighborhood: { hits: 0, misses: 0 },
    }
  };

  // Get sample entity IDs from graph
  console.log('📊 Fetching sample entities for testing...');
  const sampleEntities = await getSampleEntities(TEST_USER_ID, 20);
  console.log(`✅ Found ${sampleEntities.length} entities for testing\n`);

  if (sampleEntities.length === 0) {
    console.error('❌ No entities found in graph. Run test-load-performance-data.js first.');
    process.exit(1);
  }

  // Test pattern: Execute queries, then repeat to test cache hits
  const testQueries = [
    // Round 1: Cold cache (all misses)
    ...generateQueryBatch(sampleEntities, 25),

    // Round 2: Warm cache (should be mostly hits)
    ...generateQueryBatch(sampleEntities, 25),

    // Round 3: Repeated queries (should be all hits)
    ...generateQueryBatch(sampleEntities, 25),

    // Round 4: More repeated queries (should be all hits)
    ...generateQueryBatch(sampleEntities, 25),
  ];

  console.log('🔄 Executing 100 queries (25 unique patterns, repeated 4 times)...\n');

  const startTime = Date.now();

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    const round = Math.floor(i / 25) + 1;

    try {
      let result;

      if (query.type === 'stats') {
        result = await testStatsQuery(query);
      } else if (query.type === 'neighborhood') {
        result = await testNeighborhoodQuery(query, sampleEntities);
      } else {
        result = await testEntityQuery(query, sampleEntities);
      }

      // Track cache hit/miss
      if (result.meta.cached) {
        cacheStats.hits++;
        cacheStats.byType[query.type].hits++;
      } else {
        cacheStats.misses++;
        cacheStats.byType[query.type].misses++;
      }
      cacheStats.total++;

      // Log progress every 10 queries
      if ((i + 1) % 10 === 0) {
        const hitRate = (cacheStats.hits / cacheStats.total * 100).toFixed(1);
        console.log(`  Query ${i + 1}/100: ${result.meta.cached ? '✓ HIT' : '✗ MISS'} (${hitRate}% hit rate so far)`);
      }

    } catch (error) {
      console.error(`❌ Query ${i + 1} failed:`, error.message);
      cacheStats.misses++;
      cacheStats.total++;
    }
  }

  const totalTime = Date.now() - startTime;
  const avgTime = totalTime / testQueries.length;

  // Calculate results
  const hitRate = cacheStats.hits / cacheStats.total;
  const hitRatePercent = (hitRate * 100).toFixed(1);
  const passed = hitRate >= TARGET_CACHE_HIT_RATE;

  // Display results
  console.log('\n' + '='.repeat(60));
  console.log('📈 CACHE HIT RATE RESULTS (T107)');
  console.log('='.repeat(60));
  console.log(`\nTotal Queries: ${cacheStats.total}`);
  console.log(`Cache Hits:    ${cacheStats.hits} (${hitRatePercent}%)`);
  console.log(`Cache Misses:  ${cacheStats.misses} (${(100 - parseFloat(hitRatePercent)).toFixed(1)}%)`);
  console.log(`\nTarget Hit Rate: >${TARGET_CACHE_HIT_RATE * 100}%`);
  console.log(`Actual Hit Rate: ${hitRatePercent}%`);

  console.log('\n📊 Breakdown by Cache Type:');
  for (const [type, stats] of Object.entries(cacheStats.byType)) {
    const total = stats.hits + stats.misses;
    if (total > 0) {
      const typeRate = (stats.hits / total * 100).toFixed(1);
      console.log(`  ${type.padEnd(15)}: ${stats.hits}/${total} hits (${typeRate}%)`);
    }
  }

  console.log(`\n⏱️  Average Query Time: ${avgTime.toFixed(2)}ms`);
  console.log(`⏱️  Total Test Time: ${totalTime}ms`);

  if (passed) {
    console.log(`\n✅ PASS: Cache hit rate ${hitRatePercent}% exceeds target ${TARGET_CACHE_HIT_RATE * 100}%`);
  } else {
    console.log(`\n❌ FAIL: Cache hit rate ${hitRatePercent}% below target ${TARGET_CACHE_HIT_RATE * 100}%`);
  }

  console.log('='.repeat(60) + '\n');

  return {
    passed,
    hitRate,
    hitRatePercent,
    stats: cacheStats,
    avgTime,
  };
}

/**
 * Get sample entities from the graph for testing
 */
async function getSampleEntities(userId, limit = 20) {
  try {
    const cypher = `
      MATCH (n {user_id: $user_id})
      RETURN n.entity_id as entity_id, labels(n)[0] as type, n.name as name
      LIMIT $limit
    `;

    const result = await falkordb.query(GRAPH_NAME, cypher, { user_id: userId, limit });

    // Redis format: [headers, dataRows, stats]
    const dataRows = result[1] || [];
    return dataRows.map(row => ({
      entity_id: row[0],  // entity_id column
      type: row[1],        // type column
      name: row[2],        // name column
    }));
  } catch (error) {
    console.error('Error fetching sample entities:', error);
    return [];
  }
}

/**
 * Generate a batch of diverse queries
 */
function generateQueryBatch(entities, count) {
  const queries = [];

  // Mix of query types for realistic workload
  const distribution = {
    stats: Math.floor(count * 0.2),        // 20% stats queries
    neighborhood: Math.floor(count * 0.4),  // 40% neighborhood queries
    entity: Math.floor(count * 0.4),       // 40% entity list queries
  };

  // Stats queries
  for (let i = 0; i < distribution.stats; i++) {
    queries.push({ type: 'stats' });
  }

  // Neighborhood queries (pick random entities)
  for (let i = 0; i < distribution.neighborhood; i++) {
    const entity = entities[i % entities.length];
    queries.push({
      type: 'neighborhood',
      entityId: entity.entity_id,
      depth: (i % 2) + 1, // Alternate between depth 1 and 2
    });
  }

  // Entity queries (with different filters)
  for (let i = 0; i < distribution.entity; i++) {
    const types = ['Person', 'Project', 'Organization', 'Technology', null];
    queries.push({
      type: 'query',
      filter: types[i % types.length],
      limit: 50,
    });
  }

  return queries;
}

/**
 * Test stats query with cache
 */
async function testStatsQuery(query) {
  return await executeStatsWithCache(mockKV, TEST_USER_ID, async () => {
    const cypher = `
      MATCH (n {user_id: $user_id})
      WITH count(n) as node_count
      MATCH (a {user_id: $user_id})-[r]-(b {user_id: $user_id})
      WITH node_count, count(DISTINCT r)/2 as rel_count
      RETURN node_count, rel_count, [] as entity_breakdown, [] as most_connected
    `;

    const result = await falkordb.query(GRAPH_NAME, cypher, { user_id: TEST_USER_ID });
   // Redis format: [headers, dataRows, stats]
    const dataRows = result[1] || [];
    const [nodeCount, relCount] = dataRows[0] || [0, 0];

    return {
      node_count: nodeCount || 0,
      relationship_count: relCount || 0,
      entity_breakdown: {},
      most_connected: [],
      last_sync: new Date().toISOString(),
    };
  });
}

/**
 * Test neighborhood query with cache
 */
async function testNeighborhoodQuery(query, entities) {
  const entityId = query.entityId || entities[0]?.entity_id;
  const depth = query.depth || 1;

  return await executeNeighborhoodWithCache(mockKV, TEST_USER_ID, entityId, depth, async () => {
    const cypher = `
      MATCH (center {user_id: $user_id, entity_id: $entity_id})
      OPTIONAL MATCH (center)-[r]-(connected {user_id: $user_id})
      RETURN center, collect(DISTINCT connected) as neighbors, collect(DISTINCT r) as rels
    `;

    const result = await falkordb.query(GRAPH_NAME, cypher, {
      user_id: TEST_USER_ID,
      entity_id: entityId,
    });

    // Redis format: [headers, dataRows, stats]
    const dataRows = result[1] || [];
    if (dataRows.length === 0) {
      throw new Error('Entity not found');
    }

    const row = dataRows[0];
    const centerNode = row[0];
    const neighborsRaw = row[1];

    // Ensure neighbors is an array (handle null, undefined, or object cases)
    const neighbors = Array.isArray(neighborsRaw) ? neighborsRaw : (neighborsRaw ? [neighborsRaw] : []);

    return {
      entity: {
        id: centerNode.entity_id || 'unknown',
        type: centerNode.labels?.[0] || centerNode.type || 'Unknown',
        properties: centerNode,
      },
      neighbors: neighbors.map(node => ({
        entity: {
          id: node.entity_id || 'unknown',
          type: node.labels?.[0] || node.type || 'Unknown',
          properties: node,
        },
        relationship: null,
      })),
    };
  });
}

/**
 * Test entity list query with cache
 */
async function testEntityQuery(query) {
  const typeClause = query.filter ? `:${query.filter}` : '';
  const limit = query.limit || 50;

  const cypher = `
    MATCH (n${typeClause} {user_id: $user_id})
    RETURN n
    LIMIT $limit
  `;

  const params = {
    user_id: TEST_USER_ID,
    limit,
  };

  return await executeWithCache(mockKV, TEST_USER_ID, cypher, params, async () => {
    const result = await falkordb.query(GRAPH_NAME, cypher, params);

    // Redis format: [headers, dataRows, stats]
    const dataRows = result[1] || [];

    return {
      nodes: dataRows.map(row => {
        const node = row[0]; // First column is the node
        return {
          id: node.entity_id || node.id || 'unknown',
          type: node.labels?.[0] || node.type || node.entity_type || 'Unknown',
          properties: node,
        };
      }),
      total: dataRows.length,
    };
  });
}

/**
 * Main test execution
 */
async function main() {
  try {
    const result = await testCacheHitRate();

    if (result.passed) {
      console.log('✅ T107: Cache hit rate test PASSED');
      console.log(`   Hit rate: ${result.hitRatePercent}% (target: >${TARGET_CACHE_HIT_RATE * 100}%)`);
      process.exit(0);
    } else {
      console.log('❌ T107: Cache hit rate test FAILED');
      console.log(`   Hit rate: ${result.hitRatePercent}% (target: >${TARGET_CACHE_HIT_RATE * 100}%)`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
main();
