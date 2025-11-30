# GraphMind Problem Areas

## Session: 2025-11-30 - WebSocket + Audio Pipeline Issues (CRITICAL - UNRESOLVED)

### Initial Symptom
Frontend shows "Error occurred" and "Connection error. Please try again." with browser console spam:
```
WebSocket connection to 'ws://localhost:8787/ws/query/sess_xxx?token=xxx' failed: WebSocket is closed before the connection is established.
```

### Problem 1: WebSocket Multiple Connection Race Condition - PARTIALLY FIXED

**Root Causes Identified:**
1. `useWebSocket.js` - `wsRef.current = ws` was set AFTER event handlers (line 128), allowing multiple WebSocket instances to be created before the guard could catch them
2. React useEffect dependencies on `connect` function caused infinite reconnection loops
3. useEffect cleanup calling `disconnect()` had `[disconnect]` dependency, causing premature disconnections when function reference changed

**Changes Made to `src/frontend/hooks/useWebSocket.js`:**
- Complete rewrite with bulletproof connection management
- Added `connectingRef` - synchronous ref-based lock (no React state race conditions)
- Set `wsRef.current = ws` immediately after `new WebSocket(url)`
- Store all callbacks in refs to avoid dependency changes triggering useEffect re-runs
- Added `mountedRef` to prevent state updates on unmounted components
- Minimal dependencies on connect useCallback: `[maxReconnectAttempts, baseReconnectDelay]`
- Separate unmount-only cleanup effect with empty dependency array

**Changes Made to `src/frontend/hooks/useQuerySession.js`:**
- Added guard at start of `startSession()` - blocks if not IDLE/ERROR/COMPLETE
- Added guard if `websocketUrl` already exists
- Changed to `autoConnect: true` (useWebSocket handles connection)
- Removed manual connect useEffect (was causing duplicate connections)
- Fixed cleanup useEffect dependency from `[disconnect]` to `[]`

**Changes Made to `src/frontend/components/VoiceQueryRecorder.jsx`:**
- Added JWT token append to websocket URL (was missing: `${data.websocket_url}?token=${jwtToken}`)
- Changed to `autoConnect: true`
- Removed manual connect useEffect

**Result:** WebSocket now creates single connection per session (verified in logs), but new issue emerged.

### Problem 2: Audio Chunks Not Being Sent - UNRESOLVED (REAL ISSUE)

**Evidence from logs:**
```
WebSocket connection established session_id: sess_d250cd8d-4ac5-4d4b-91a9-98097ee23bd4
[WARN] "No audio recorded. Please try again."
Session cleaned up
WebSocket connection closed
[Reconnects and repeats]
```

**Analysis:**
- WebSocket connects successfully (101 Switching Protocols)
- Server receives stop_recording signal after ~2-3 seconds
- Server reports "No audio recorded" - meaning ZERO audio_chunk messages received
- This triggers session cleanup and close
- useWebSocket auto-reconnects (exponential backoff)
- Cycle repeats

**Suspected Causes (NOT INVESTIGATED):**
1. `useAudioRecorder` hook may not be capturing audio properly
2. Audio chunks may not be sent over WebSocket (`sendAudioChunk` in useQuerySession)
3. `isConnected` state may be stale when audio starts recording
4. MediaRecorder permissions/initialization failure
5. `onChunk` callback not being called by audio recorder

**Files to Investigate:**
- `src/frontend/hooks/useAudioRecorder.js` - Audio capture logic
- `src/frontend/pages/QueryPage.jsx` - Integration between audio and WebSocket
- `src/frontend/hooks/useQuerySession.js` - `sendAudioChunk` function

**Key Questions:**
1. Is the microphone permission being granted?
2. Is MediaRecorder actually starting?
3. Are audio chunks being generated?
4. Is `isConnected` true when chunks need to be sent?
5. Is the WebSocket `send()` being called with audio data?

### Problem 3: TTS Synthesis Failure - STILL OPEN (from previous session)

**Status:** Not fully investigated - appears to be Workers AI TTS service issue.
**Location:** Likely in `src/durable-objects/query-session-manager.js`

---

## Session: 2025-11-30 - Critical Bugfix Session (PREVIOUS)

### Status: RESOLVED

All critical issues from Feature 012 (Security Hardening) integration have been fixed.

### Issues Fixed

1. **FalkorDB REST API Authentication (15+ files)**
   - Missing `apiKey: env.FALKORDB_REST_API_KEY` in config objects
   - Error: "PING failed: Health check failed: Unauthorized"
   - Fixed in: graph-rag.js, search-entities.js, get-graph.js, get-stats.js, all CRUD endpoints

2. **Seed Data Missing user_id (`src/workers/api/seed-data.js`)**
   - Nodes created without `user_id` property
   - Search queries filtered by user_id returned empty
   - Fixed: Added `user_id: $user_id` to all CREATE statements

3. **Response Parser Format Mismatch (3 files)**
   - Code assumed array format `[node, types]` but REST API returns object `{n, types}`
   - Fixed in: search-entities.js, get-graph.js, get-stats.js
   - Added dual format handling for both array and object responses

4. **Stats FalkorDB String Parsing (`src/api/graph/get-stats.js`)**
   - FalkorDB returns complex types as strings: `"[{type: Task, count: 3}]"`
   - Added `parseFalkorDBArray()` helper to convert to proper JSON

5. **CSS Duplicate Key (`src/frontend/design-system/voice/BrutalWaveform.jsx`)**
   - Duplicate `imageRendering` property in JSX style object
   - Fixed: Removed duplicate, kept `crisp-edges`

### Validation Results

All endpoints tested and working:
- Health check: OK
- Entity search: Returns correct user_id filtered results
- Graph stats: Proper entity_breakdown object and most_connected array
- Get graph: Returns nodes without errors
- FalkorDB health: Pool healthy with 6 connections

---

## Session: 2025-11-30 - Feature 015 Entity Role Bug Fix (PREVIOUS)

### Problem 1: Voice Query Returns "I don't have any information" - RESOLVED

**Root Causes Found & Fixed:**
1. Falsy value bug in result-formatter.js (node ID 0 treated as false)
2. REST API format mismatch (src_node/dest_node vs src/dst)
3. Stale KV cache serving old wrong answers

### Problem 2: TTS Synthesis Failure - STILL OPEN

**Status:** Not fully investigated - appears to be Workers AI TTS service issue.
**Location:** Likely in `src/durable-objects/query-session-manager.js`

---

## Next Steps for Audio Issue

1. Add console.log statements in `useAudioRecorder.js` to verify:
   - MediaRecorder is being created
   - `ondataavailable` is firing
   - Audio chunks are being generated

2. Add console.log in `QueryPage.jsx` `onChunk` callback to verify chunks reach there

3. Add console.log in `useQuerySession.js` `sendAudioChunk` to verify:
   - Function is being called
   - `isConnected` is true at call time
   - `send()` is returning true

4. Check browser DevTools Network tab for WebSocket frames - are audio_chunk messages being sent?

5. Check browser console for MediaRecorder errors or permission denials
