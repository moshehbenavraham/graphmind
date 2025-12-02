# Next Spec: Audio Pipeline Debug & Fix (Feature 016)

**Generated**: 2025-12-02
**Phase**: Phase 4 - Polish (Critical Bugfix)
**Type**: Debug/Fix
**Priority**: P0 (Blocker - Voice queries non-functional)

---

## Problem Statement

**Current Symptom**: Voice queries fail with "No audio recorded. Please try again." despite successful WebSocket connections.

**Evidence from logs** (docs/ongoing_projects/problem-areas.md):
```
WebSocket connection established session_id: sess_d250cd8d-4ac5-4d4b-91a9-98097ee23bd4
[WARN] "No audio recorded. Please try again."
Session cleaned up
WebSocket connection closed
[Reconnects and repeats]
```

**Root Cause**: Unknown - requires investigation. The WebSocket connects (101 Switching Protocols) and receives stop_recording after 2-3 seconds, but ZERO `audio_chunk` messages arrive at the server.

---

## Why This Next

**Blocks Everything**:
- Voice queries are 100% broken - users cannot ask questions
- Feature 015 (Entity Role Bugfix) is complete but untestable via voice
- Frontend deployment (Feature 011) cannot be validated end-to-end
- The entire voice-first value proposition is non-functional

**Dependencies Satisfied**:
- Feature 015: Entity role detection fixed (98% complete)
- WebSocket race condition fixed (Problem 1 from previous session)
- Backend API endpoints operational
- FalkorDB integration working

**Phase Context**:
- This is a critical bugfix blocking Phase 4 completion
- All other Phase 4 work depends on voice queries working

---

## Scope Definition

### Included (This Session)

1. **Diagnose audio capture pipeline** - Add strategic logging to trace audio flow
2. **Fix useAudioRecorder.js** - Ensure MediaRecorder captures and emits audio chunks
3. **Fix audio chunk transmission** - Ensure chunks flow from recorder to WebSocket
4. **Validate isConnected timing** - Ensure WebSocket is connected when audio starts
5. **End-to-end test** - Voice query works from microphone to answer

### Excluded (Later)

- TTS synthesis issues (Problem 3) - separate issue, lower priority
- Performance optimization - get it working first
- UI polish - functionality over aesthetics
- New features - bugfix only

### Size Check

**Estimated Complexity**: Medium
**Fits Single Context Window**: Yes (~15,000 tokens)
**Session Goal**: Voice queries receive audio and return answers

---

## Investigation Plan

### Step 1: Trace the Audio Flow

**Expected flow**:
```
User clicks Record
  -> useAudioRecorder.startRecording()
    -> MediaRecorder.start()
      -> ondataavailable fires with audio blob
        -> onChunk callback in QueryPage.jsx
          -> useQuerySession.sendAudioChunk()
            -> WebSocket.send({type: 'audio_chunk', data: base64})
              -> Server receives and buffers
```

**Suspected break points** (in priority order):
1. MediaRecorder not starting (permissions?)
2. `ondataavailable` not firing (timeslice config?)
3. `onChunk` callback not wired correctly
4. `sendAudioChunk` not being called
5. WebSocket `isConnected` false when send attempted
6. WebSocket `send()` silently failing

### Step 2: Files to Instrument

1. **`src/frontend/hooks/useAudioRecorder.js`**
   - Add logging: MediaRecorder creation, start, ondataavailable
   - Log chunk sizes when data available
   - Log any errors in try/catch

2. **`src/frontend/pages/QueryPage.jsx`**
   - Add logging: onChunk callback invocation
   - Log chunk data size before passing to sendAudioChunk

3. **`src/frontend/hooks/useQuerySession.js`**
   - Add logging: sendAudioChunk entry
   - Log isConnected state at send time
   - Log WebSocket.send() call and result

### Step 3: Common Issues to Check

**MediaRecorder Issues**:
- [ ] `navigator.mediaDevices.getUserMedia` called?
- [ ] Permission granted (not denied/dismissed)?
- [ ] MediaRecorder created with correct mimeType?
- [ ] `timeslice` parameter set in `recorder.start(timeslice)`?
- [ ] If no timeslice, ondataavailable only fires on stop

**WebSocket Timing Issues**:
- [ ] Is WebSocket connected BEFORE recording starts?
- [ ] Is `isConnected` state updated synchronously with `wsRef.current.readyState`?
- [ ] Race condition between connect and start recording?

**Callback Wiring Issues**:
- [ ] Is `onChunk` prop passed to useAudioRecorder?
- [ ] Is it the correct function (not stale closure)?
- [ ] Is the callback being invoked with correct arguments?

---

## Success Criteria

This spec is complete when:

1. [ ] Console logs show MediaRecorder starting successfully
2. [ ] Console logs show `ondataavailable` firing with chunk sizes
3. [ ] Console logs show `onChunk` callback receiving data
4. [ ] Console logs show `sendAudioChunk` being called
5. [ ] Console logs show WebSocket `send()` being executed
6. [ ] Server logs show `audio_chunk` messages being received
7. [ ] Voice query returns a spoken answer (end-to-end test)

---

## Technical Context

### useAudioRecorder Hook API

```javascript
const {
  isRecording,
  startRecording,  // Async - requests mic permission, starts MediaRecorder
  stopRecording,   // Returns audio blob
  error,
} = useAudioRecorder({
  onChunk: (chunk) => { /* Called when audio data available */ },
  mimeType: 'audio/webm',
  timeslice: 500,  // ms between ondataavailable events
});
```

### useQuerySession Hook API

```javascript
const {
  isConnected,
  sendAudioChunk,  // (chunk: Blob) -> void
  startSession,    // Creates WebSocket URL
  ...
} = useQuerySession({
  onTranscript: ...,
  onAnswer: ...,
  onError: ...,
});
```

### WebSocket Message Protocol

```javascript
// Client -> Server
{ type: 'audio_chunk', data: '<base64 encoded audio>' }
{ type: 'stop_recording' }

// Server -> Client
{ type: 'transcript_chunk', text: '...' }
{ type: 'answer', text: '...' }
{ type: 'audio_response', url: '...' }
```

---

## Implementation Steps

### Phase 1: Diagnosis (Priority)

1. Read and understand current useAudioRecorder.js implementation
2. Read and understand QueryPage.jsx audio integration
3. Read and understand useQuerySession.js sendAudioChunk
4. Add strategic console.log statements at each step
5. Test in browser and capture console output
6. Identify exact failure point

### Phase 2: Fix

7. Fix the identified issue (depends on diagnosis)
8. Remove debug logging (or make configurable)
9. Test end-to-end voice query

### Phase 3: Validation

10. Verify server receives audio chunks
11. Verify transcript is generated
12. Verify answer is returned
13. Document fix in problem-areas.md

---

## References

- **Problem Documentation**: [docs/ongoing_projects/problem-areas.md](../ongoing_projects/problem-areas.md)
- **WebSocket Hook (fixed)**: `src/frontend/hooks/useWebSocket.js`
- **Audio Recorder Hook**: `src/frontend/hooks/useAudioRecorder.js`
- **Query Session Hook**: `src/frontend/hooks/useQuerySession.js`
- **Query Page**: `src/frontend/pages/QueryPage.jsx`
- **Server Handler**: `src/durable-objects/query-session-manager.js`

---

## Notes

**Previous Session Work**:
- Problem 1 (WebSocket race condition) was fixed - verified single connection per session
- Problem 2 (this spec) emerged after fixing Problem 1
- Problem 3 (TTS synthesis) is separate and lower priority

**Debug Approach**:
- Start with minimal logging, expand if needed
- Use browser DevTools Network tab to inspect WebSocket frames
- Check browser console for MediaRecorder errors
- Verify microphone permissions in browser settings

**Key Question**:
Is the issue in the frontend (audio not being captured/sent) or backend (audio received but not processed)?
Server logs say "No audio recorded" = ZERO audio_chunk messages received = frontend issue.
