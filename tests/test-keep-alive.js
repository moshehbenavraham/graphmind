/**
 * Test script to verify connection keep-alive is working
 * Tests that connections stay alive between operations
 */

const TEST_USER_ID = 'bb0488f5-743d-4251-b75d-e6c0282becfc';
const NOTE_ID = 'prod-test-001';
const API_BASE = 'https://graphmind-api.apex-web-services-llc-0d4.workers.dev';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkPoolHealth() {
  const response = await fetch(`${API_BASE}/api/test/check-pool-warmup`);
  const data = await response.json();

  console.log('\n=== Pool Health Check ===');
  console.log('Status:', data.data.status);
  console.log('Warmup State:', data.data.warmupState);
  console.log('Pool Size:', data.data.poolSize);
  console.log('Available:', data.data.availableConnections);
  console.log('Last Warmup:', data.data.lastWarmupTime || 'never');
  console.log('Last Keep-Alive:', data.data.lastKeepAliveTime || 'never');
  console.log('Connection Details:', JSON.stringify(data.data.connectionDetails, null, 2));

  return data.data;
}

async function triggerGraphSync() {
  const response = await fetch(`${API_BASE}/api/test/trigger-graph-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: TEST_USER_ID,
      noteId: NOTE_ID
    })
  });

  const data = await response.json();
  console.log('\n=== Graph Sync Triggered ===');
  console.log('Success:', data.success);
  console.log('Message:', data.message);

  return data;
}

async function runKeepAliveTest() {
  console.log('🔬 Testing Connection Keep-Alive Mechanism\n');
  console.log('This test will:');
  console.log('1. Check initial pool state');
  console.log('2. Trigger a graph sync operation');
  console.log('3. Wait for warmup alarm to fire (5 min intervals)');
  console.log('4. Check pool state again to verify connections stayed alive\n');

  // Step 1: Initial state
  console.log('STEP 1: Checking initial pool state...');
  const initial = await checkPoolHealth();

  // Step 2: Trigger operation
  console.log('\nSTEP 2: Triggering graph sync...');
  await triggerGraphSync();

  // Step 3: Wait for processing
  console.log('\nSTEP 3: Waiting 20 seconds for queue processing...');
  await sleep(20000);

  // Step 4: Check after operation
  console.log('\nSTEP 4: Checking pool after operation...');
  const after = await checkPoolHealth();

  // Step 5: Wait for keep-alive alarm (would be 5 min in production, but let's check sooner)
  console.log('\nSTEP 5: Checking for alarm-triggered keep-alive...');
  console.log('NOTE: Alarm fires every 5 minutes. Checking current state...');

  // Analysis
  console.log('\n' + '='.repeat(60));
  console.log('📊 ANALYSIS:');
  console.log('='.repeat(60));

  if (after.lastKeepAliveTime) {
    console.log('✅ Keep-alive mechanism is ACTIVE');
    console.log(`   Last keep-alive: ${after.lastKeepAliveTime}`);
  } else {
    console.log('⏳ Keep-alive not yet triggered (alarm fires every 5 min)');
  }

  if (after.poolSize > 0) {
    console.log(`✅ Pool has ${after.poolSize} connection(s)`);

    const connections = after.connectionDetails || [];
    connections.forEach((conn, i) => {
      console.log(`\n   Connection ${i + 1}:`);
      console.log(`   - Age: ${Math.floor(conn.ageMs / 1000)}s`);
      console.log(`   - Last PING: ${Math.floor(conn.timeSinceLastPingMs / 1000)}s ago`);
      console.log(`   - Last Use: ${Math.floor(conn.timeSinceLastUseMs / 1000)}s ago`);
      console.log(`   - In Use: ${conn.inUse}`);
      console.log(`   - Stale: ${conn.stale}`);
    });
  }

  if (after.alarmScheduled) {
    console.log('\n✅ Alarm is scheduled for automatic keep-alive');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Test complete!');
  console.log('\nTo verify persistent connections over time:');
  console.log('- Run this test again after 5+ minutes');
  console.log('- Check that lastKeepAliveTime updates');
  console.log('- Check that connections stay alive (no reconnects)');
  console.log('='.repeat(60));
}

// Run test
runKeepAliveTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
