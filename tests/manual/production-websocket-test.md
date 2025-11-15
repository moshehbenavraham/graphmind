# Production WebSocket Testing Guide

**Task**: T153 - Test WebSocket connection in production environment (wss://)
**Feature**: 010 - Text-to-Speech Responses
**Created**: 2025-11-14

---

## Overview

This guide provides comprehensive testing procedures for validating WebSocket connectivity and audio streaming in the production environment.

---

## Prerequisites

### 1. Production Deployment Verified

Check that the worker is deployed:
```bash
npx wrangler deployments list --name graphmind-api
```

Expected: Recent deployment listed (within last 24 hours)

### 2. Production URL

Get the production URL:
```bash
npx wrangler whoami
# Account ID: 0d4ac5ace370a9a2f4b7d707eacde75d
```

Production Worker URL format: `https://graphmind-api.{subdomain}.workers.dev`

Or custom domain if configured.

### 3. WebSocket URL

WebSocket endpoint format: `wss://graphmind-api.{subdomain}.workers.dev/ws/query/{session_id}`

---

## Test 1: WebSocket Connection Establishment

### Objective
Verify that WebSocket connections can be established to the production worker.

### Test Procedure

#### Option A: Browser Console Test

1. **Open Production Site**:
   - Navigate to production URL in browser
   - Open Developer Console (F12)

2. **Run Connection Test**:
   ```javascript
   // Test WebSocket connection
   const testWSConnection = async () => {
     const wsUrl = 'wss://graphmind-api.{subdomain}.workers.dev/ws/query/test-session-123';

     console.log('Connecting to:', wsUrl);

     const ws = new WebSocket(wsUrl);

     ws.onopen = () => {
       console.log('✅ WebSocket connected successfully');
       console.log('readyState:', ws.readyState); // Should be 1 (OPEN)

       // Send test message
       ws.send(JSON.stringify({ type: 'ping' }));
     };

     ws.onmessage = (event) => {
       console.log('📨 Received message:', event.data);
       try {
         const data = JSON.parse(event.data);
         console.log('Parsed:', data);
       } catch (e) {
         console.log('Raw data:', event.data);
       }
     };

     ws.onerror = (error) => {
       console.error('❌ WebSocket error:', error);
     };

     ws.onclose = (event) => {
       console.log('WebSocket closed:', event.code, event.reason);
     };

     // Keep reference for manual testing
     window.testWS = ws;
   };

   // Run test
   testWSConnection();
   ```

3. **Expected Results**:
   - ✅ "WebSocket connected successfully" message
   - ✅ `readyState: 1` (OPEN)
   - ✅ No error messages
   - ✅ Connection remains open

4. **Manual Interaction**:
   ```javascript
   // Send test messages
   window.testWS.send(JSON.stringify({ type: 'test', message: 'Hello production!' }));

   // Close connection
   window.testWS.close();
   ```

#### Option B: Node.js Test Script

Create `tests/manual/test-production-ws.js`:

```javascript
// Test production WebSocket connection
const WebSocket = require('ws');

const PRODUCTION_WS_URL = 'wss://graphmind-api.{subdomain}.workers.dev/ws/query/test-session';

console.log('Testing production WebSocket connection...');
console.log('URL:', PRODUCTION_WS_URL);

const ws = new WebSocket(PRODUCTION_WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to production WebSocket');

  // Send test message
  const testMessage = JSON.stringify({
    type: 'query',
    text: 'What is GraphMind?'
  });

  console.log('Sending test query:', testMessage);
  ws.send(testMessage);
});

ws.on('message', (data) => {
  console.log('📨 Received:', data.toString());

  try {
    const parsed = JSON.parse(data.toString());
    console.log('Type:', parsed.type);
    if (parsed.type === 'audio_chunk') {
      console.log('Audio chunk received, size:', parsed.chunk?.length || 0);
    }
  } catch (e) {
    // Raw message
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log('Connection closed:', code, reason.toString());
  process.exit(0);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('Test timeout - closing connection');
  ws.close();
}, 30000);
```

Run test:
```bash
node tests/manual/test-production-ws.js
```

---

## Test 2: SSL/TLS Certificate Validation

### Objective
Verify that the production WebSocket uses valid SSL/TLS certificates (wss:// protocol).

### Test Procedure

1. **Certificate Inspection**:
   - Open production URL in Chrome
   - Click padlock icon in address bar
   - Select "Connection is secure"
   - Click "Certificate is valid"
   - Verify certificate details:
     - Issued by: Cloudflare Inc ECC CA-3
     - Valid from/to dates
     - Subject Alternative Names include your domain

2. **Browser Security Check**:
   ```javascript
   // In browser console
   console.log('Protocol:', window.location.protocol); // Should be "https:"
   console.log('Secure context:', window.isSecureContext); // Should be true
   ```

3. **WebSocket Protocol Verification**:
   ```javascript
   const ws = new WebSocket('wss://graphmind-api.{subdomain}.workers.dev/ws/query/test');
   ws.onopen = () => {
     console.log('Protocol:', ws.protocol);
     console.log('URL:', ws.url); // Should start with "wss://"
     ws.close();
   };
   ```

### Expected Results

- ✅ Valid Cloudflare SSL certificate
- ✅ Certificate not expired
- ✅ WebSocket URL uses `wss://` (not `ws://`)
- ✅ No certificate warnings in browser
- ✅ `window.isSecureContext === true`

---

## Test 3: Audio Streaming Over Production WebSocket

### Objective
Verify that audio chunks stream correctly over the production WebSocket connection.

### Test Procedure

1. **Full Query Flow Test**:
   ```javascript
   const testAudioStreaming = () => {
     const sessionId = 'audio-test-' + Date.now();
     const wsUrl = `wss://graphmind-api.{subdomain}.workers.dev/ws/query/${sessionId}`;

     console.log('Testing audio streaming...');

     const ws = new WebSocket(wsUrl);
     let audioChunksReceived = 0;
     let totalBytes = 0;

     ws.onopen = () => {
       console.log('✅ Connected');

       // Send voice query
       ws.send(JSON.stringify({
         type: 'query',
         text: 'Tell me about GraphMind in one sentence.'
       }));
     };

     ws.onmessage = (event) => {
       const data = JSON.parse(event.data);

       switch (data.type) {
         case 'answer_generated':
           console.log('📝 Answer:', data.answer.substring(0, 100) + '...');
           break;

         case 'audio_chunk':
           audioChunksReceived++;
           totalBytes += data.chunk.length;
           console.log(`🔊 Audio chunk ${data.sequence}/${data.total_chunks} (${data.chunk.length} bytes)`);
           break;

         case 'audio_complete':
           console.log('✅ Audio streaming complete');
           console.log(`Total: ${audioChunksReceived} chunks, ${totalBytes} bytes`);
           console.log(`Duration: ${data.duration_ms}ms`);
           console.log(`Cached: ${data.cached}`);
           ws.close();
           break;

         case 'audio_error':
           console.error('❌ Audio error:', data.error, data.message);
           break;

         default:
           console.log('Message:', data.type);
       }
     };

     ws.onerror = (error) => {
       console.error('❌ WebSocket error:', error);
     };

     ws.onclose = () => {
       console.log('Connection closed');
     };
   };

   testAudioStreaming();
   ```

2. **Monitor Network Traffic**:
   - Open Chrome DevTools → Network tab
   - Filter by "WS" (WebSocket)
   - Run test
   - Click on WebSocket connection
   - View "Messages" tab
   - Verify:
     - ✅ Multiple `audio_chunk` messages
     - ✅ Each chunk has base64 data
     - ✅ Final `audio_complete` message
     - ✅ No error messages

### Expected Results

- ✅ WebSocket connection established
- ✅ Answer text received
- ✅ Multiple audio chunks streamed (usually 5-20 chunks)
- ✅ `audio_complete` message received
- ✅ Total bytes > 0
- ✅ No `audio_error` messages
- ✅ Connection closed gracefully

---

## Test 4: Production Performance Validation

### Objective
Verify that production WebSocket meets latency and performance targets.

### Test Procedure

1. **Latency Measurement**:
   ```javascript
   const measureLatency = () => {
     const sessionId = 'perf-test-' + Date.now();
     const wsUrl = `wss://graphmind-api.{subdomain}.workers.dev/ws/query/${sessionId}`;

     const metrics = {
       connectionStart: 0,
       connectionOpen: 0,
       queryStart: 0,
       answerReceived: 0,
       firstAudioChunk: 0,
       audioComplete: 0
     };

     metrics.connectionStart = performance.now();

     const ws = new WebSocket(wsUrl);

     ws.onopen = () => {
       metrics.connectionOpen = performance.now();
       console.log(`Connection time: ${(metrics.connectionOpen - metrics.connectionStart).toFixed(2)}ms`);

       metrics.queryStart = performance.now();
       ws.send(JSON.stringify({
         type: 'query',
         text: 'What is FalkorDB?'
       }));
     };

     ws.onmessage = (event) => {
       const data = JSON.parse(event.data);

       if (data.type === 'answer_generated') {
         metrics.answerReceived = performance.now();
         console.log(`Answer latency: ${(metrics.answerReceived - metrics.queryStart).toFixed(2)}ms`);
       }

       if (data.type === 'audio_chunk' && metrics.firstAudioChunk === 0) {
         metrics.firstAudioChunk = performance.now();
         console.log(`Time to first audio: ${(metrics.firstAudioChunk - metrics.answerReceived).toFixed(2)}ms`);
       }

       if (data.type === 'audio_complete') {
         metrics.audioComplete = performance.now();
         console.log(`Total audio time: ${(metrics.audioComplete - metrics.answerReceived).toFixed(2)}ms`);
         console.log(`End-to-end: ${(metrics.audioComplete - metrics.queryStart).toFixed(2)}ms`);

         // Validate against targets
         const audioLatency = metrics.firstAudioChunk - metrics.answerReceived;
         if (audioLatency < 1000) {
           console.log('✅ Audio latency target met (<1s)');
         } else {
           console.warn('⚠️ Audio latency exceeded target:', audioLatency, 'ms');
         }

         ws.close();
       }
     };
   };

   measureLatency();
   ```

2. **Run Multiple Tests**:
   ```javascript
   // Run 5 tests to get p95 latency
   const runMultipleTests = async () => {
     const results = [];

     for (let i = 0; i < 5; i++) {
       console.log(`\n=== Test ${i + 1}/5 ===`);
       await new Promise(resolve => {
         // Run measureLatency() and collect results
         setTimeout(resolve, 10000); // Wait 10s between tests
       });
     }

     console.log('\n=== Summary ===');
     // Calculate p50, p95
   };
   ```

### Expected Results

- ✅ Connection time: < 200ms
- ✅ Answer latency: < 3 seconds (varies by query complexity)
- ✅ Time to first audio: < 1 second (p95 target)
- ✅ Total audio streaming: < 5 seconds for typical answers
- ✅ No timeouts or disconnections

---

## Test 5: Error Handling and Resilience

### Objective
Verify that production WebSocket handles errors gracefully.

### Test Procedure

1. **Invalid Session ID**:
   ```javascript
   const ws = new WebSocket('wss://graphmind-api.{subdomain}.workers.dev/ws/query/invalid-session');
   ws.onopen = () => console.log('Connected (unexpected)');
   ws.onerror = () => console.log('✅ Error caught as expected');
   ws.onclose = (e) => console.log('Closed:', e.code, e.reason);
   ```

2. **Rapid Reconnection**:
   ```javascript
   // Test connection pooling
   for (let i = 0; i < 5; i++) {
     const ws = new WebSocket(`wss://graphmind-api.{subdomain}.workers.dev/ws/query/test-${i}`);
     ws.onopen = () => console.log(`Connection ${i} opened`);
   }
   ```

3. **Connection Timeout**:
   ```javascript
   const ws = new WebSocket('wss://graphmind-api.{subdomain}.workers.dev/ws/query/timeout-test');
   ws.onopen = () => {
     console.log('Connected');
     // Don't send anything, wait for timeout
   };
   ws.onclose = (e) => {
     console.log('Timeout close:', e.code); // Should be 1000 or 1001
   };
   ```

### Expected Results

- ✅ Invalid sessions rejected appropriately
- ✅ Multiple connections handled without errors
- ✅ Timeouts handled gracefully
- ✅ No server crashes or 500 errors

---

## Test Checklist

Use this checklist to track T153 validation:

- [ ] WebSocket connection establishes successfully (wss://)
- [ ] SSL/TLS certificate is valid (Cloudflare)
- [ ] Connection uses secure WebSocket protocol (wss://, not ws://)
- [ ] Audio chunks stream over WebSocket
- [ ] `audio_chunk` messages received (base64 encoded)
- [ ] `audio_complete` message received
- [ ] Connection latency < 200ms
- [ ] Audio latency < 1 second (p95)
- [ ] No connection drops or timeouts
- [ ] Error handling works (invalid sessions, timeouts)
- [ ] Multiple concurrent connections supported
- [ ] No console errors in browser
- [ ] Production logs show successful connections (check Cloudflare dashboard)

---

## Troubleshooting

### Issue: WebSocket connection fails

**Symptoms**: `ERR_CONNECTION_REFUSED` or immediate close

**Solutions**:
1. Verify worker is deployed: `npx wrangler deployments list --name graphmind-api`
2. Check worker logs: `npx wrangler tail graphmind-api`
3. Verify WebSocket route exists in wrangler.toml
4. Check Cloudflare dashboard for worker status

### Issue: SSL certificate error

**Symptoms**: `ERR_CERT_AUTHORITY_INVALID` or security warning

**Solutions**:
1. Verify using `wss://` (not `ws://`)
2. Check certificate in browser (padlock icon)
3. Ensure custom domain SSL is configured (if using custom domain)

### Issue: Audio chunks not received

**Symptoms**: Answer text received, but no audio

**Solutions**:
1. Check QuerySessionManager deployed with TTS code (Feature 010)
2. Verify Workers AI binding configured in production
3. Check KV namespace binding exists
4. Review worker logs for TTS errors

### Issue: High latency

**Symptoms**: Audio takes >2 seconds to start

**Solutions**:
1. Check FalkorDB connection (ensure tunnel active)
2. Verify KV cache is working (check cache hit rate)
3. Test from different geographic location (Cloudflare edge latency)
4. Review Workers AI status (Workers AI dashboard)

---

## Production Monitoring

After testing, monitor these metrics in Cloudflare dashboard:

1. **Worker Metrics**:
   - Requests per second
   - CPU time (should be <50ms p95)
   - Errors (should be <1%)

2. **WebSocket Metrics**:
   - Active connections
   - Connection duration
   - Messages sent/received

3. **KV Metrics**:
   - Read operations (cache lookups)
   - Write operations (cache stores)
   - Latency

4. **Workers AI Metrics**:
   - TTS API calls
   - Latency
   - Error rate

---

## References

- **WebSocket API**: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **Durable Objects**: https://developers.cloudflare.com/durable-objects/
- **Workers AI**: https://developers.cloudflare.com/workers-ai/
