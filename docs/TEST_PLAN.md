# GraphMind Test Plan

This document outlines comprehensive testing procedures for GraphMind voice note capture system (Phases 1-5).

## Table of Contents

1. [End-to-End Flow Testing](#end-to-end-flow-testing)
2. [Load Testing](#load-testing)
3. [Network Testing](#network-testing)
4. [WebSocket Stability Testing](#websocket-stability-testing)
5. [Browser Compatibility Testing](#browser-compatibility-testing)
6. [Mobile Testing](#mobile-testing)
7. [Security Testing](#security-testing)
8. [Performance Benchmarks](#performance-benchmarks)

---

## End-to-End Flow Testing

### T117: Record → Transcribe → Save → List → View → Delete Flow

**Objective**: Verify complete user flow from recording to deletion

**Prerequisites**:
- User account created and authenticated
- Microphone access granted
- Stable network connection

**Test Steps**:

1. **Start Recording**
   ```bash
   # API Call
   POST /api/notes/start-recording
   Headers: Authorization: Bearer <JWT>

   # Expected Response
   {
     "session_id": "sess_...",
     "websocket_url": "wss://[domain]/ws/notes/sess_...",
     "expires_at": "2024-01-01T12:00:00Z",
     "max_duration_seconds": 600
   }
   ```
   - Verify: Session ID generated
   - Verify: WebSocket URL valid
   - Verify: Expiration time is 1 hour in future

2. **Connect WebSocket**
   ```javascript
   const ws = new WebSocket(websocket_url + '?token=' + jwt);

   ws.onopen = () => {
     console.log('Connected');
   };

   ws.onmessage = (event) => {
     const message = JSON.parse(event.data);
     console.log('Message:', message);
   };
   ```
   - Verify: WebSocket connects successfully
   - Verify: `session_started` message received
   - Verify: Status is `recording`

3. **Send Audio Chunks**
   ```javascript
   // Send test audio chunks
   for (let i = 0; i < 10; i++) {
     ws.send(JSON.stringify({
       type: 'audio_chunk',
       sequence: i,
       chunk: base64AudioData,
       timestamp: Date.now()
     }));
   }
   ```
   - Verify: No validation errors
   - Verify: `transcript_partial` messages received
   - Verify: Transcripts accumulate correctly

4. **Stop Recording**
   ```javascript
   ws.send(JSON.stringify({
     type: 'stop_recording'
   }));
   ```
   - Verify: `transcript_complete` message received
   - Verify: `note_id` present
   - Verify: Word count > 0
   - Verify: Duration calculated correctly

5. **List Notes**
   ```bash
   GET /api/notes?limit=20&offset=0
   Headers: Authorization: Bearer <JWT>

   # Expected Response
   {
     "notes": [
       {
         "note_id": "note_...",
         "transcript": "...",
         "duration_seconds": 30,
         "word_count": 50,
         "created_at": "..."
       }
     ],
     "pagination": {
       "total": 1,
       "limit": 20,
       "offset": 0,
       "has_more": false
     }
   }
   ```
   - Verify: Newly created note appears in list
   - Verify: Pagination works correctly
   - Verify: Notes sorted by `created_at DESC`

6. **View Note**
   ```bash
   GET /api/notes/{note_id}
   Headers: Authorization: Bearer <JWT>

   # Expected Response
   {
     "note_id": "note_...",
     "user_id": "user_...",
     "transcript": "Full transcript text...",
     "duration_seconds": 30,
     "word_count": 50,
     "processing_status": "completed",
     "created_at": "..."
   }
   ```
   - Verify: Correct note returned
   - Verify: All fields populated
   - Verify: User can only access their own notes

7. **Delete Note**
   ```bash
   DELETE /api/notes/{note_id}
   Headers: Authorization: Bearer <JWT>

   # Expected Response: 204 No Content
   ```
   - Verify: 204 status returned
   - Verify: Note no longer appears in list
   - Verify: GET request returns 404

**Success Criteria**:
- All steps complete without errors
- Transcript accuracy > 80%
- Total flow time < 60 seconds for 30-second recording

---

## Load Testing

### T118: Concurrent Session Testing

**Objective**: Verify system handles 10+ concurrent recording sessions

**Test Configuration**:
- 10-20 concurrent users
- Each user records 30-60 second note
- Stagger session starts by 5 seconds

**Test Script** (using `artillery` or similar):
```yaml
config:
  target: 'https://your-worker.workers.dev'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Ramp up"
    - duration: 120
      arrivalRate: 20
      name: "Sustained load"

scenarios:
  - name: "Record voice note"
    flow:
      - post:
          url: "/api/notes/start-recording"
          headers:
            Authorization: "Bearer {{ jwt }}"
          capture:
            - json: "$.session_id"
              as: "sessionId"
            - json: "$.websocket_url"
              as: "wsUrl"
      # WebSocket connection and recording would happen here
      # (artillery supports ws protocol)
```

**Metrics to Monitor**:
- Average response time for `/api/notes/start-recording`
- WebSocket connection success rate
- Transcription latency (p50, p95, p99)
- Database query times
- Durable Object CPU usage
- Workers AI API success rate

**Success Criteria**:
- 95% of requests succeed
- p95 transcription latency < 3 seconds
- No Durable Object errors
- Database queries < 100ms average

---

## Network Testing

### T119: Throttling and Packet Loss Testing

**Objective**: Verify graceful handling of poor network conditions

**Test Scenarios**:

1. **Slow 3G Network**
   - Use Chrome DevTools Network throttling
   - Set to "Slow 3G" (400 Kbps, 2000ms latency)
   - Record 30-second note
   - Verify: Transcription still works (may be slower)
   - Verify: User receives appropriate feedback

2. **Intermittent Connection**
   - Simulate packet loss (5-10%)
   - Use `tc` on Linux or Charles Proxy
   - Record 60-second note
   - Verify: WebSocket handles reconnection
   - Verify: Audio chunks buffered correctly
   - Verify: No data loss

3. **Connection Drop Mid-Recording**
   - Start recording
   - Disconnect network after 15 seconds
   - Reconnect after 5 seconds
   - Verify: Session recovers or fails gracefully
   - Verify: User notified of connection loss
   - Verify: Partial transcript saved (if applicable)

**Tools**:
- Chrome DevTools Network tab
- Charles Proxy
- Linux `tc` (traffic control)
- `comcast` (Go-based network simulator)

**Success Criteria**:
- App doesn't crash
- User receives clear feedback
- Recoverable errors handled automatically
- Non-recoverable errors show user-friendly message

---

## WebSocket Stability Testing

### T120: Long-Duration Session Testing

**Objective**: Verify WebSocket stability for 10-minute sessions

**Test Procedure**:

1. **Start Recording Session**
   - Connect WebSocket
   - Begin sending audio chunks

2. **Maintain Connection**
   - Send audio chunks continuously for 10 minutes
   - Monitor for connection drops
   - Monitor for memory leaks

3. **Verify Session Timeout**
   - Continue beyond 10 minutes
   - Verify: Warning at 9 minutes
   - Verify: Auto-save and disconnect at 10 minutes

**Monitoring**:
```javascript
// Monitor WebSocket events
ws.addEventListener('close', (event) => {
  console.log('Close:', event.code, event.reason);
});

ws.addEventListener('error', (event) => {
  console.error('Error:', event);
});

// Track message latency
const sendTime = Date.now();
ws.send(JSON.stringify({...}));

ws.onmessage = (event) => {
  const latency = Date.now() - sendTime;
  console.log('Latency:', latency, 'ms');
};
```

**Success Criteria**:
- WebSocket stays connected for full 10 minutes
- No memory leaks in browser or Durable Object
- Timeout warning delivered at 9 minutes
- Auto-save works correctly at 10 minutes
- Clean shutdown with code 1000

---

## Browser Compatibility Testing

### T121: Multi-Browser Testing

**Objective**: Verify functionality across major browsers

**Browsers to Test**:
- Chrome/Chromium (latest, latest-1)
- Safari (latest on macOS)
- Firefox (latest, latest-1)
- Edge (latest)

**Test Matrix**:

| Feature | Chrome | Safari | Firefox | Edge | Notes |
|---------|--------|--------|---------|------|-------|
| Microphone Access | ✓ | ✓ | ✓ | ✓ | |
| WebSocket Connection | ✓ | ✓ | ✓ | ✓ | |
| Audio Capture (PCM) | ✓ | ✓ | ✓ | ✓ | |
| Base64 Encoding | ✓ | ✓ | ✓ | ✓ | |
| Transcript Display | ✓ | ✓ | ✓ | ✓ | |
| Error Handling | ✓ | ✓ | ✓ | ✓ | |
| UI Responsiveness | ✓ | ✓ | ✓ | ✓ | |

**Known Issues**:
- Safari may require user gesture for microphone access
- Firefox may have different audio capture formats
- Older browsers may not support `MediaRecorder` API

**Success Criteria**:
- Core functionality works in all tested browsers
- Graceful degradation for unsupported features
- Browser-specific issues documented

---

## Mobile Testing

### T122: iOS and Android Testing

**Objective**: Verify mobile browser compatibility

**Devices to Test**:
- iOS Safari (latest iOS)
- Chrome on Android (latest)
- Samsung Internet (if available)

**Test Cases**:

1. **Microphone Access on Mobile**
   - Request microphone permission
   - Verify: Permission prompt appears
   - Verify: Permission persists across sessions
   - Verify: Graceful handling if denied

2. **Recording Quality**
   - Record 30-second note
   - Verify: Audio quality acceptable
   - Verify: Transcription accuracy > 75%

3. **Battery Impact**
   - Monitor battery drain during 5-minute recording
   - Verify: No excessive battery usage
   - Verify: App doesn't cause device heating

4. **Background Behavior**
   - Start recording
   - Switch to another app
   - Return to GraphMind
   - Verify: Recording paused or stopped gracefully
   - Verify: User notified of interruption

5. **Orientation Changes**
   - Start recording in portrait
   - Rotate to landscape
   - Verify: Recording continues
   - Verify: UI adapts correctly

**Known Mobile Limitations**:
- iOS Safari may pause audio in background
- Android may kill WebSocket on low memory
- Mobile networks may have higher latency

**Success Criteria**:
- Core features work on mobile
- Mobile-specific issues documented
- Appropriate warnings shown if features limited

---

## Security Testing

### T123: Rate Limiting Verification

**Objective**: Verify rate limits prevent abuse

**Test Cases**:

1. **Recording Start Rate Limit (10/hour per user)**
   ```javascript
   // Attempt 11 recordings in 1 hour
   for (let i = 0; i < 11; i++) {
     const response = await fetch('/api/notes/start-recording', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${jwt}`
       }
     });
     console.log(`Request ${i+1}:`, response.status);
   }
   ```
   - Verify: Requests 1-10 succeed (200)
   - Verify: Request 11 fails (429)
   - Verify: `Retry-After` header present

2. **List Notes Rate Limit (60/min per user)**
   ```javascript
   // Attempt 61 list requests in 1 minute
   for (let i = 0; i < 61; i++) {
     const response = await fetch('/api/notes', {
       headers: {
         'Authorization': `Bearer ${jwt}`
       }
     });
     console.log(`Request ${i+1}:`, response.status);
   }
   ```
   - Verify: Requests 1-60 succeed
   - Verify: Request 61 fails (429)

3. **Delete Rate Limit (10/min per user)**
   - Similar test for DELETE endpoint

**Success Criteria**:
- Rate limits enforced correctly
- 429 responses include helpful message
- `Retry-After` header accurate

---

### T124: User Data Isolation Verification

**Objective**: Verify users can only access their own data

**Test Procedure**:

1. **Create Two User Accounts**
   - User A: `userA@example.com`
   - User B: `userB@example.com`

2. **User A Creates Notes**
   ```bash
   # As User A
   POST /api/notes/start-recording
   # ... create note_A1
   # ... create note_A2
   ```

3. **User B Attempts Access**
   ```bash
   # As User B (using User A's note_id)
   GET /api/notes/{note_A1}
   Headers: Authorization: Bearer <User B's JWT>

   # Expected: 404 Not Found
   ```
   - Verify: User B cannot view User A's notes
   - Verify: User B cannot delete User A's notes
   - Verify: No information disclosure (404, not 403)

4. **Database Verification**
   ```sql
   -- Verify D1 queries include user_id filter
   SELECT * FROM voice_notes WHERE note_id = ? AND user_id = ?
   ```

5. **FalkorDB Namespace Isolation**
   - Verify: Each user has separate graph namespace
   - Verify: Cross-user queries blocked

**Success Criteria**:
- 100% isolation between user accounts
- No information leakage in error messages
- Database queries always filter by user_id

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Voice transcription latency (p95) | < 2 seconds | Log timestamps in VoiceSessionManager |
| Entity extraction time | < 3 seconds | Time from transcript to graph update |
| Graph query execution (uncached) | < 500ms | FalkorDB query timing logs |
| Graph query execution (cached) | < 100ms | KV cache hit timing |
| TTS playback start | < 1 second | Audio element load event |
| Page load time | < 2 seconds | Lighthouse, WebPageTest |

### Measurement Tools

1. **Structured Logging**
   ```javascript
   // Performance timers in logger
   const timer = logger.startTimer('operation_name');
   // ... perform operation
   logger.endTimer(timer);
   ```

2. **Cloudflare Analytics**
   - Worker CPU time
   - Request duration
   - Subrequest counts

3. **Lighthouse**
   - Run on `/` and `/recorder` pages
   - Target score > 90

4. **WebPageTest**
   - Test from multiple locations
   - Target Speed Index < 2.0s

### Benchmarking Script

```bash
#!/bin/bash
# benchmark.sh

echo "Running GraphMind Performance Benchmarks"

# 1. API Endpoint Latency
echo "Testing API endpoints..."
for i in {1..100}; do
  curl -w "%{time_total}\n" -o /dev/null -s \
    -H "Authorization: Bearer $JWT" \
    https://your-worker.workers.dev/api/notes
done | awk '{ sum += $1; n++ } END { print "Avg:", sum/n, "s" }'

# 2. WebSocket Connection Time
echo "Testing WebSocket..."
# Use wscat or custom script

# 3. Transcription Latency
echo "Testing transcription..."
# Parse logs for transcription timing

# 4. Database Query Performance
echo "Testing database..."
# Run EXPLAIN QUERY PLAN on D1 queries
```

---

## Test Execution Checklist

Before deploying to production:

- [ ] All end-to-end flows tested (T117)
- [ ] Load testing passed with 10+ concurrent users (T118)
- [ ] Network resilience verified (T119)
- [ ] WebSocket stability confirmed for 10-minute sessions (T120)
- [ ] Browser compatibility verified (T121)
- [ ] Mobile testing completed (T122)
- [ ] Rate limiting working correctly (T123)
- [ ] User data isolation verified (T124)
- [ ] Performance benchmarks meet targets
- [ ] Error handling tested for all scenarios
- [ ] Security review completed

---

## Regression Testing

After any major code changes, re-run:

1. End-to-end flow test (T117)
2. Load test with 10 concurrent users
3. Rate limiting verification
4. User data isolation check

---

## Continuous Integration

Automated tests to run on every PR:

1. Unit tests (`npm test`)
2. Integration tests (`npm run test:integration`)
3. Lint checks (`npm run lint`)
4. Type checks (if using TypeScript)
5. Build verification (`npm run build`)

---

## Issue Tracking

Document any test failures with:

- Test name and ID
- Expected vs actual behavior
- Steps to reproduce
- Environment details (browser, OS, network)
- Screenshots/logs if applicable
- Severity (P0-Critical, P1-High, P2-Medium, P3-Low)

---

## Notes

- **T111-T114**: Error scenario testing covered in ErrorBoundary component tests
- **T115-T116**: Optimization verification happens during performance benchmarking
- All tests should be documented in this file as they are executed
- Update this document as new test scenarios are discovered

---

Last Updated: 2024-01-01
Maintained by: GraphMind Development Team
