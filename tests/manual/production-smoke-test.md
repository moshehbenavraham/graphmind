# Production Smoke Test

**Task**: T155 - Smoke test in production (single end-to-end query)
**Feature**: 010 - Text-to-Speech Responses
**Created**: 2025-11-14

---

## Overview

This smoke test validates the complete end-to-end flow of Feature 010 (Text-to-Speech Responses) in the production environment. It tests a single voice query from start to finish, including answer generation and audio playback.

---

## Prerequisites

Before running the smoke test:

1. ✅ **Feature 010 deployed to production** (T154 complete)
2. ✅ **Production WebSocket tested** (T153 complete)
3. ✅ **KV namespace configured** in production
4. ✅ **Workers AI binding active** in production
5. ✅ **FalkorDB accessible** (via tunnel or cloud)

---

## Smoke Test Procedure

### Step 1: Environment Verification

**Objective**: Verify production environment is ready

**Commands**:
```bash
# Check worker deployment
npx wrangler deployments list --name graphmind-api

# Verify latest deployment
# Should show deployment within last 24 hours

# Check worker status
npx wrangler tail graphmind-api --format json > /dev/null 2>&1 &
TAIL_PID=$!

# Stop tail after test
# kill $TAIL_PID
```

**Expected**:
- ✅ Recent deployment listed
- ✅ Worker logs streaming (no errors)

---

### Step 2: Single End-to-End Query Test

**Objective**: Execute one complete voice query with audio response

#### Option A: Browser-Based Test (Recommended)

1. **Open Production Application**:
   - Navigate to production URL (e.g., `https://graphmind-api.{subdomain}.workers.dev`)
   - Open Developer Console (F12)

2. **Run Smoke Test Script**:
   ```javascript
   /**
    * Production Smoke Test - Feature 010
    * Single end-to-end voice query with audio response
    */
   const runSmokeTest = () => {
     console.log('🚀 Starting Production Smoke Test - Feature 010');
     console.log('Testing: Text-to-Speech Responses');

     const sessionId = 'smoke-test-' + Date.now();
     const wsUrl = `wss://graphmind-api.{subdomain}.workers.dev/ws/query/${sessionId}`;

     // Test configuration
     const testQuery = 'What is GraphMind?'; // Simple query for quick response
     const timeout = 30000; // 30 second timeout

     // Metrics
     const metrics = {
       start: performance.now(),
       connected: 0,
       answerReceived: 0,
       firstAudioChunk: 0,
       audioComplete: 0,
       audioChunks: 0,
       totalBytes: 0,
       errors: []
     };

     console.log('Connecting to:', wsUrl);

     const ws = new WebSocket(wsUrl);
     let timeoutHandle;

     // Timeout handler
     timeoutHandle = setTimeout(() => {
       console.error('❌ SMOKE TEST FAILED: Timeout after 30 seconds');
       ws.close();
       displayResults(false);
     }, timeout);

     ws.onopen = () => {
       metrics.connected = performance.now();
       console.log('✅ WebSocket connected');
       console.log(`Connection time: ${(metrics.connected - metrics.start).toFixed(2)}ms`);

       // Send test query
       console.log('Sending query:', testQuery);
       ws.send(JSON.stringify({
         type: 'query',
         text: testQuery
       }));
     };

     ws.onmessage = (event) => {
       try {
         const data = JSON.parse(event.data);

         switch (data.type) {
           case 'transcription_complete':
             console.log('📝 Transcription:', data.text);
             break;

           case 'cypher_generated':
             console.log('🔍 Cypher query generated');
             break;

           case 'answer_generated':
             metrics.answerReceived = performance.now();
             console.log('📄 Answer received:', data.answer.substring(0, 100) + '...');
             console.log(`Answer time: ${(metrics.answerReceived - metrics.connected).toFixed(2)}ms`);
             break;

           case 'audio_chunk':
             if (metrics.firstAudioChunk === 0) {
               metrics.firstAudioChunk = performance.now();
               console.log('🔊 First audio chunk received');
               console.log(`Audio latency: ${(metrics.firstAudioChunk - metrics.answerReceived).toFixed(2)}ms`);
             }
             metrics.audioChunks++;
             metrics.totalBytes += data.chunk.length;
             console.log(`Audio chunk ${data.sequence}/${data.total_chunks} (${data.chunk.length} bytes)`);
             break;

           case 'audio_complete':
             metrics.audioComplete = performance.now();
             clearTimeout(timeoutHandle);

             console.log('\n✅ Audio streaming complete');
             console.log(`Duration: ${data.duration_ms}ms`);
             console.log(`Total bytes: ${data.total_bytes}`);
             console.log(`Cached: ${data.cached}`);
             console.log(`Chunks received: ${metrics.audioChunks}`);

             ws.close();
             displayResults(true);
             break;

           case 'audio_error':
             console.error('❌ Audio error:', data.error, data.message);
             metrics.errors.push({ type: 'audio', error: data.error, message: data.message });
             clearTimeout(timeoutHandle);
             ws.close();
             displayResults(false);
             break;

           case 'error':
             console.error('❌ Query error:', data.message);
             metrics.errors.push({ type: 'query', message: data.message });
             clearTimeout(timeoutHandle);
             ws.close();
             displayResults(false);
             break;

           default:
             console.log('Message type:', data.type);
         }
       } catch (error) {
         console.error('Error parsing message:', error);
         metrics.errors.push({ type: 'parse', error: error.message });
       }
     };

     ws.onerror = (error) => {
       console.error('❌ WebSocket error:', error);
       metrics.errors.push({ type: 'websocket', error: 'Connection error' });
       clearTimeout(timeoutHandle);
       displayResults(false);
     };

     ws.onclose = (event) => {
       console.log('Connection closed:', event.code, event.reason);
     };

     // Display final results
     const displayResults = (success) => {
       console.log('\n' + '='.repeat(60));
       console.log('SMOKE TEST RESULTS - Feature 010');
       console.log('='.repeat(60));

       if (success) {
         console.log('✅ SMOKE TEST PASSED');
       } else {
         console.log('❌ SMOKE TEST FAILED');
       }

       console.log('\nMetrics:');
       console.log('  Connection time:', (metrics.connected - metrics.start).toFixed(2), 'ms');
       if (metrics.answerReceived > 0) {
         console.log('  Answer latency:', (metrics.answerReceived - metrics.connected).toFixed(2), 'ms');
       }
       if (metrics.firstAudioChunk > 0) {
         console.log('  Audio latency:', (metrics.firstAudioChunk - metrics.answerReceived).toFixed(2), 'ms');
       }
       if (metrics.audioComplete > 0) {
         console.log('  Total time:', (metrics.audioComplete - metrics.start).toFixed(2), 'ms');
       }
       console.log('  Audio chunks:', metrics.audioChunks);
       console.log('  Total bytes:', metrics.totalBytes);

       if (metrics.errors.length > 0) {
         console.log('\nErrors:');
         metrics.errors.forEach((err, i) => {
           console.log(`  ${i + 1}.`, err.type, '-', err.error || err.message);
         });
       }

       console.log('\nValidation:');
       console.log('  WebSocket connection:', metrics.connected > 0 ? '✅' : '❌');
       console.log('  Answer received:', metrics.answerReceived > 0 ? '✅' : '❌');
       console.log('  Audio chunks received:', metrics.audioChunks > 0 ? '✅' : '❌');
       console.log('  Audio latency <1s:', metrics.firstAudioChunk > 0 && (metrics.firstAudioChunk - metrics.answerReceived) < 1000 ? '✅' : '❌');
       console.log('  No errors:', metrics.errors.length === 0 ? '✅' : '❌');

       console.log('='.repeat(60));

       // Return results for programmatic access
       return {
         success,
         metrics,
         errors: metrics.errors
       };
     };
   };

   // Run the smoke test
   runSmokeTest();
   ```

3. **Observe Output**:
   - Watch console for progress messages
   - Verify each stage completes:
     - ✅ WebSocket connected
     - ✅ Query sent
     - ✅ Answer received
     - ✅ Audio chunks streaming
     - ✅ Audio complete

4. **Review Results**:
   - Check final results table
   - Verify all validations pass (✅)
   - Note any errors

#### Option B: Node.js Script

Create `tests/smoke/production-smoke-test.js`:

```javascript
/**
 * Production Smoke Test - Feature 010
 * Run from command line: node tests/smoke/production-smoke-test.js
 */
const WebSocket = require('ws');

const PRODUCTION_URL = process.env.PRODUCTION_WS_URL || 'wss://graphmind-api.{subdomain}.workers.dev/ws/query';
const TEST_QUERY = 'What is GraphMind?';

console.log('🚀 Production Smoke Test - Feature 010\n');
console.log('Testing:', PRODUCTION_URL);

const sessionId = 'smoke-test-' + Date.now();
const wsUrl = `${PRODUCTION_URL}/${sessionId}`;

const metrics = {
  start: Date.now(),
  connected: 0,
  answerReceived: 0,
  firstAudioChunk: 0,
  audioComplete: 0,
  audioChunks: 0,
  totalBytes: 0,
  errors: []
};

const ws = new WebSocket(wsUrl);

// Timeout after 30 seconds
const timeout = setTimeout(() => {
  console.error('\n❌ SMOKE TEST FAILED: Timeout');
  ws.close();
  process.exit(1);
}, 30000);

ws.on('open', () => {
  metrics.connected = Date.now();
  console.log('✅ Connected');
  console.log(`Connection time: ${metrics.connected - metrics.start}ms\n`);

  // Send query
  ws.send(JSON.stringify({ type: 'query', text: TEST_QUERY }));
  console.log('Query sent:', TEST_QUERY);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'answer_generated':
        metrics.answerReceived = Date.now();
        console.log('\n📄 Answer:', message.answer.substring(0, 100) + '...');
        console.log(`Answer time: ${metrics.answerReceived - metrics.connected}ms`);
        break;

      case 'audio_chunk':
        if (metrics.firstAudioChunk === 0) {
          metrics.firstAudioChunk = Date.now();
          console.log(`\n🔊 First audio chunk`);
          console.log(`Audio latency: ${metrics.firstAudioChunk - metrics.answerReceived}ms`);
        }
        metrics.audioChunks++;
        metrics.totalBytes += message.chunk.length;
        process.stdout.write('.');
        break;

      case 'audio_complete':
        metrics.audioComplete = Date.now();
        clearTimeout(timeout);
        console.log('\n\n✅ Audio complete');
        displayResults(true);
        ws.close();
        break;

      case 'audio_error':
      case 'error':
        console.error('\n❌ Error:', message.error || message.message);
        metrics.errors.push(message);
        clearTimeout(timeout);
        displayResults(false);
        ws.close();
        break;
    }
  } catch (error) {
    console.error('Parse error:', error.message);
  }
});

ws.on('error', (error) => {
  console.error('\n❌ WebSocket error:', error.message);
  metrics.errors.push({ type: 'websocket', error: error.message });
  clearTimeout(timeout);
  displayResults(false);
  process.exit(1);
});

ws.on('close', () => {
  console.log('\nConnection closed');
});

function displayResults(success) {
  console.log('\n' + '='.repeat(60));
  console.log('SMOKE TEST RESULTS');
  console.log('='.repeat(60));
  console.log(success ? '✅ PASSED' : '❌ FAILED');
  console.log('\nMetrics:');
  console.log('  Connection:', metrics.connected - metrics.start, 'ms');
  if (metrics.answerReceived) console.log('  Answer:', metrics.answerReceived - metrics.connected, 'ms');
  if (metrics.firstAudioChunk) console.log('  Audio:', metrics.firstAudioChunk - metrics.answerReceived, 'ms');
  if (metrics.audioComplete) console.log('  Total:', metrics.audioComplete - metrics.start, 'ms');
  console.log('  Chunks:', metrics.audioChunks);
  console.log('  Bytes:', metrics.totalBytes);
  if (metrics.errors.length) console.log('  Errors:', metrics.errors.length);
  console.log('='.repeat(60));

  process.exit(success ? 0 : 1);
}
```

Run:
```bash
node tests/smoke/production-smoke-test.js
```

---

### Step 3: Validation Criteria

The smoke test PASSES if all criteria are met:

#### Connection & Basic Flow
- [ ] WebSocket connection establishes successfully
- [ ] Connection uses secure protocol (wss://)
- [ ] Query is sent and acknowledged
- [ ] Answer text is received

#### Audio Streaming (Feature 010)
- [ ] Audio chunks are received (at least 1 chunk)
- [ ] `audio_complete` message received
- [ ] Total audio bytes > 0
- [ ] No `audio_error` messages

#### Performance
- [ ] Connection time < 500ms
- [ ] Answer latency < 5 seconds (varies by query)
- [ ] Audio latency < 1 second (p95 target)
- [ ] Total end-to-end time < 10 seconds

#### Reliability
- [ ] No WebSocket errors
- [ ] No connection drops
- [ ] No timeout (completes within 30 seconds)
- [ ] No exceptions or crashes

---

## Expected Output

### Successful Test

```
🚀 Starting Production Smoke Test - Feature 010
Testing: Text-to-Speech Responses
Connecting to: wss://graphmind-api.{subdomain}.workers.dev/ws/query/smoke-test-1731600000000

✅ WebSocket connected
Connection time: 145.32ms
Sending query: What is GraphMind?

📝 Transcription: What is GraphMind?
🔍 Cypher query generated
📄 Answer received: GraphMind is a voice-first personal knowledge assistant...
Answer time: 1842.56ms

🔊 First audio chunk received
Audio latency: 523.12ms
Audio chunk 1/12 (4096 bytes)
Audio chunk 2/12 (4096 bytes)
...
Audio chunk 12/12 (2048 bytes)

✅ Audio streaming complete
Duration: 8450ms
Total bytes: 45056
Cached: false
Chunks received: 12

============================================================
SMOKE TEST RESULTS - Feature 010
============================================================
✅ SMOKE TEST PASSED

Metrics:
  Connection time: 145.32 ms
  Answer latency: 1842.56 ms
  Audio latency: 523.12 ms
  Total time: 10987.23 ms
  Audio chunks: 12
  Total bytes: 45056

Validation:
  WebSocket connection: ✅
  Answer received: ✅
  Audio chunks received: ✅
  Audio latency <1s: ✅
  No errors: ✅
============================================================
```

### Failed Test Example

```
❌ SMOKE TEST FAILED: Timeout after 30 seconds

============================================================
SMOKE TEST RESULTS - Feature 010
============================================================
❌ SMOKE TEST FAILED

Metrics:
  Connection time: 142.56 ms
  Answer latency: 1956.78 ms
  Audio latency: 0 ms
  Total time: 30000.00 ms
  Audio chunks: 0
  Total bytes: 0

Errors:
  1. timeout - Test exceeded 30 second limit

Validation:
  WebSocket connection: ✅
  Answer received: ✅
  Audio chunks received: ❌
  Audio latency <1s: ❌
  No errors: ❌
============================================================
```

---

## Step 4: Monitor Production After Test

After running the smoke test, check production logs:

```bash
# View recent logs
npx wrangler tail graphmind-api --format json

# Filter for errors
npx wrangler tail graphmind-api --format json | grep -i error

# Monitor for 5 minutes
npx wrangler tail graphmind-api --format pretty
```

**What to look for**:
- ✅ No error logs during test
- ✅ TTS synthesis completed successfully
- ✅ Cache operations working (KV reads/writes)
- ✅ Durable Object connections stable

---

## Troubleshooting

### Issue: Connection timeout

**Cause**: Worker not responding or DNS issue

**Solution**:
1. Verify worker is deployed: `npx wrangler deployments list`
2. Check worker health: `curl https://{worker-url}/health`
3. Review worker logs for errors

### Issue: Answer received but no audio

**Cause**: TTS synthesis failed or Workers AI unavailable

**Solution**:
1. Check Workers AI status: Cloudflare Status page
2. Verify Workers AI binding in wrangler.toml
3. Review TTS error logs in Durable Object

### Issue: Audio latency >1 second

**Cause**: Network, TTS service, or caching issue

**Solution**:
1. Test from different location (geographic latency)
2. Check KV cache hit rate (should be >0 for repeat queries)
3. Review TTS synthesis time in logs
4. Verify FalkorDB connection is fast

### Issue: WebSocket connection fails

**Cause**: SSL certificate, routing, or DO unavailable

**Solution**:
1. Verify using wss:// (not ws://)
2. Check Durable Object binding in wrangler.toml
3. Review QuerySessionManager logs
4. Test WebSocket separately (T153)

---

## Post-Test Checklist

After successful smoke test:

- [ ] Smoke test passed (all validations ✅)
- [ ] Production logs reviewed (no errors)
- [ ] Performance metrics within targets
- [ ] Cache working (check cached flag on repeat query)
- [ ] No errors in Cloudflare dashboard
- [ ] Mark T155 as complete in tasks.md
- [ ] Update implementation notes with test results
- [ ] (Optional) Run /validate for full validation

---

## Continuous Monitoring

Set up ongoing production monitoring:

1. **Cloudflare Analytics**:
   - Monitor requests per second
   - Track error rates
   - Review latency percentiles (p50, p95, p99)

2. **Worker Logs**:
   - Set up log aggregation (Logpush to S3/R2)
   - Create alerts for error spikes
   - Monitor TTS API usage

3. **KV Metrics**:
   - Track cache hit rate (target >60%)
   - Monitor storage usage
   - Review read/write latency

4. **User Feedback**:
   - Collect voice quality ratings
   - Monitor support tickets
   - Track feature usage

---

## References

- **Task T154**: Deploy QuerySessionManager changes with wrangler deploy
- **Task T153**: Test WebSocket connection in production environment
- **Feature 010 Design**: specs/010-tts-responses/design.md
- **Feature 010 Spec**: specs/010-tts-responses/spec.md
