/**
 * Test script to trigger graph sync in production
 * Sends a message to the graph-sync-jobs queue
 */

async function testGraphSync() {
  const url = 'https://graphmind-api.apex-web-services-llc-0d4.workers.dev';

  // Test data
  const testData = {
    userId: 'bb0488f5-743d-4251-b75d-e6c0282becfc',
    noteId: 'prod-test-001'
  };

  console.log('🧪 Testing Graph Sync in Production');
  console.log('=' .repeat(60));
  console.log('User ID:', testData.userId);
  console.log('Note ID:', testData.noteId);
  console.log('');

  try {
    // Step 1: Trigger sync via internal API (if exists)
    console.log('Step 1: Checking if we need to create a trigger endpoint...');

    // For now, we'll need to use wrangler tail to watch the logs
    // and manually trigger via queue or create an admin endpoint

    console.log('\n⚠️  No direct queue trigger available via HTTP');
    console.log('Options:');
    console.log('  1. Create an admin endpoint: POST /api/admin/sync');
    console.log('  2. Use entity extraction to trigger naturally');
    console.log('  3. Monitor logs: npx wrangler tail --env production');
    console.log('');
    console.log('For now, let\'s use option 2: Create a new voice note');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run the test
testGraphSync().catch(console.error);
