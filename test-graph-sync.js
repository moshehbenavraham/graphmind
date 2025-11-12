/**
 * Test script to trigger graph sync via queue
 */

async function testGraphSync() {
  const url = 'https://graphmind-api.apex-web-services-llc-0d4.workers.dev';

  // We need to use the internal queue binding, so let's use a test endpoint instead
  // For now, let's just call the API to check if we can create a manual sync trigger

  console.log('Testing graph sync for test-note-001...');

  // Try to get note info first
  const response = await fetch(`${url}/api/test/trigger-graph-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: 'bb0488f5-743d-4251-b75d-e6c0282becfc',
      noteId: 'test-note-001'
    })
  });

  const result = await response.json();
  console.log('Response:', result);
}

testGraphSync().catch(console.error);
