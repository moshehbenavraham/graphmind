/**
 * Simple test: Check if pool has warm connections without calling health check
 */

async function testPoolStatus() {
  try {
    console.log('Testing pool status...');

    const response = await fetch('https://graphmind-api.apex-web-services-llc-0d4.workers.dev/api/test/init-pool', {
      method: 'POST',
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      console.log('SUCCESS:', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('ERROR Response:', response.status, text);
    }
  } catch (error) {
    console.error('TIMEOUT or ERROR:', error.message);
  }
}

testPoolStatus();
