/**
 * Test Endpoint: Direct Graph Sync Test
 * Tests processEntities directly without queue
 */

import { processEntities } from '../../services/graph-rag.js';

export async function handleTestGraphDirect(request, env) {
  try {
    console.log('[TestGraphDirect] Starting direct graph sync test...');

    const testEntities = [
      {
        entity_id: 'test_person_1',
        entity_type: 'Person',
        name: 'Test Person',
        properties: { role: 'Tester' },
        confidence: 0.95
      }
    ];

    const userId = 'bb0488f5-743d-4251-b75d-e6c0282becfc';
    const transcript = 'Test Person is testing the system.';

    const start = Date.now();
    console.log('[TestGraphDirect] Calling processEntities...');

    const results = await processEntities(env, userId, testEntities, transcript);

    const duration = Date.now() - start;
    console.log('[TestGraphDirect] processEntities completed in', duration, 'ms');

    return new Response(JSON.stringify({
      success: true,
      duration,
      results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[TestGraphDirect] Error:', error);

    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
