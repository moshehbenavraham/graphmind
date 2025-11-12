/**
 * Test Endpoint: Benchmark FalkorDB Performance
 *
 * Tests direct FalkorDB calls vs Durable Object approach
 * Measures actual performance with real operations
 */

import { connect, disconnect, executeCypher } from '../../lib/falkordb/client.js';

/**
 * Benchmark FalkorDB performance
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Promise<Response>} JSON response
 */
export async function handleBenchmarkFalkorDB(request, env) {
  const results = {
    direct: {},
    durable_object: {},
    comparison: {}
  };

  try {
    const userId = 'bb0488f5-743d-4251-b75d-e6c0282becfc';
    const graphName = `user_${userId}_graph`;

    // Test 1: Direct FalkorDB connection
    console.log('[Benchmark] Starting direct FalkorDB test');
    const directStart = Date.now();

    const config = {
      host: env.FALKORDB_HOST,
      port: parseInt(env.FALKORDB_PORT),
      username: env.FALKORDB_USER,
      password: env.FALKORDB_PASSWORD,
    };

    // Measure connection time
    const connectStart = Date.now();
    const client = await connect(config);
    const connectTime = Date.now() - connectStart;

    // Measure simple query
    const simpleQueryStart = Date.now();
    const simpleResult = await executeCypher(client, graphName, 'RETURN 1 as test', {});
    const simpleQueryTime = Date.now() - simpleQueryStart;

    // Measure MERGE operation (like our actual use case)
    const mergeStart = Date.now();
    const mergeCypher = `
      MERGE (p:Person {user_id: $user_id, entity_id: $entity_id})
      ON CREATE SET
        p.name = $name,
        p.first_mentioned = timestamp(),
        p.mention_count = 1
      ON MATCH SET
        p.mention_count = p.mention_count + 1
      RETURN p
    `;
    const mergeParams = {
      user_id: userId,
      entity_id: 'test-entity-benchmark',
      name: 'Test Person'
    };
    const mergeResult = await executeCypher(client, graphName, mergeCypher, mergeParams);
    const mergeTime = Date.now() - mergeStart;

    // Measure batch of 5 operations
    const batchStart = Date.now();
    const batchOps = [];
    for (let i = 0; i < 5; i++) {
      const batchCypher = `
        MERGE (p:Person {user_id: $user_id, entity_id: $entity_id})
        ON CREATE SET p.name = $name, p.first_mentioned = timestamp(), p.mention_count = 1
        ON MATCH SET p.mention_count = p.mention_count + 1
        RETURN p
      `;
      const batchParams = {
        user_id: userId,
        entity_id: `test-batch-${i}`,
        name: `Test Person ${i}`
      };
      batchOps.push(executeCypher(client, graphName, batchCypher, batchParams));
    }
    await Promise.all(batchOps);
    const batchTime = Date.now() - batchStart;

    await disconnect(client);
    const directTotal = Date.now() - directStart;

    results.direct = {
      connection_time_ms: connectTime,
      simple_query_ms: simpleQueryTime,
      merge_query_ms: mergeTime,
      batch_5_queries_ms: batchTime,
      total_time_ms: directTotal
    };

    // Test 2: Via Durable Object
    console.log('[Benchmark] Starting Durable Object test');
    const doStart = Date.now();

    const doId = env.FALKORDB_POOL.idFromName('pool');
    const doStub = env.FALKORDB_POOL.get(doId);

    // Single operation via DO
    const doSingleStart = Date.now();
    const doSingleReq = new Request('http://do/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config,
        userId,
        cypher: mergeCypher,
        params: { ...mergeParams, entity_id: 'test-do-single' }
      })
    });
    const doSingleRes = await doStub.fetch(doSingleReq);
    await doSingleRes.json();
    const doSingleTime = Date.now() - doSingleStart;

    // Batch via DO
    const doBatchStart = Date.now();
    const operations = [];
    for (let i = 0; i < 5; i++) {
      operations.push({
        cypher: mergeCypher,
        params: {
          user_id: userId,
          entity_id: `test-do-batch-${i}`,
          name: `Test Person DO ${i}`
        }
      });
    }
    const doBatchReq = new Request('http://do/execute-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, userId, operations })
    });
    const doBatchRes = await doStub.fetch(doBatchReq);
    await doBatchRes.json();
    const doBatchTime = Date.now() - doBatchStart;

    const doTotal = Date.now() - doStart;

    results.durable_object = {
      single_query_ms: doSingleTime,
      batch_5_queries_ms: doBatchTime,
      total_time_ms: doTotal
    };

    // Comparison
    results.comparison = {
      direct_faster_single: doSingleTime > mergeTime,
      single_query_difference_ms: doSingleTime - mergeTime,
      direct_faster_batch: doBatchTime > batchTime,
      batch_difference_ms: doBatchTime - batchTime,
      verdict: doBatchTime > batchTime
        ? `Direct is ${Math.round((doBatchTime - batchTime) / batchTime * 100)}% faster for batch operations`
        : `DO is ${Math.round((batchTime - doBatchTime) / doBatchTime * 100)}% faster for batch operations`
    };

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          direct_batch_time: `${batchTime}ms`,
          do_batch_time: `${doBatchTime}ms`,
          recommendation: doBatchTime > batchTime ? 'Use direct calls' : 'Keep Durable Object'
        }
      }, null, 2),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[Benchmark] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Benchmark failed',
        details: error.message,
        partial_results: results
      }, null, 2),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
