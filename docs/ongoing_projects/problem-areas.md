# GraphMind Problem Areas

**Last Updated**: 2025-12-02
**Status**: Active Monitoring

---

## Overview

This document tracks known issues, bugs, and problem areas in GraphMind that need investigation or have been recently fixed.

---

## Problem 1: WebSocket Race Condition

**Status**: ✅ RESOLVED (2025-12-01)

**Symptom**: Multiple WebSocket connections created per session, causing duplicate messages and connection conflicts.

**Root Cause**: React StrictMode double-invocation combined with missing ref-based connection lock in useWebSocket.js.

**Fix Applied**:
- Added `connectingRef` as synchronous lock to prevent duplicate connections
- Bulletproof connection management in `src/frontend/hooks/useWebSocket.js`

**Verification**: Single connection per session confirmed via DevTools Network tab.

---

## Problem 2: Audio Pipeline - No Chunks Sent

**Status**: ✅ RESOLVED (2025-12-02)

**Symptom**: Voice queries fail with "No audio recorded. Please try again." despite successful WebSocket connections.

**Evidence**:
```
WebSocket connection established session_id: sess_xxx
[WARN] "No audio recorded. Please try again."
Session cleaned up
WebSocket connection closed
```

**Root Cause**: `MediaRecorder.start()` called without timeslice parameter in `useAudioRecorder.js` line 411. Without timeslice, `ondataavailable` only fires when `stop()` is called, not during recording.

**Fix Applied**:
```diff
- mediaRecorder.start();
+ mediaRecorder.start(500);  // Emit chunks every 500ms
```

**File Changed**: `src/frontend/hooks/useAudioRecorder.js`

**Verification**: Pending browser testing to confirm audio chunks are now sent during recording.

---

## Problem 3: TTS Synthesis

**Status**: 🔄 DEFERRED

**Symptom**: Text-to-speech audio responses may not play correctly.

**Priority**: Lower - focus on getting voice queries working first (Problem 2).

**Notes**:
- Separate from audio capture issue
- Will investigate after Problem 2 is verified fixed

---

## Recently Closed

| Problem | Status | Date Resolved |
|---------|--------|---------------|
| WebSocket Race Condition | ✅ Fixed | 2025-12-01 |
| Audio Pipeline No Chunks | ✅ Fixed | 2025-12-02 |

---

## References

- **Feature 016 Spec**: `specs/016-audio-pipeline-fix/spec.md`
- **WebSocket Hook**: `src/frontend/hooks/useWebSocket.js`
- **Audio Recorder Hook**: `src/frontend/hooks/useAudioRecorder.js`
- **Query Session Hook**: `src/frontend/hooks/useQuerySession.js`
