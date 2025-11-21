# Production Testing Guide - Voice Transcription Fix

Complete guide to testing the voice transcription fix in production with enhanced debugging tools.

**Deployment Date**: 2025-11-17
**Production URL**: https://2fc6964f.graphmind-6hz.pages.dev
**Backend API**: https://graphmind-api.apex-web-services-llc-0d4.workers.dev

---

## What Was Fixed

### Root Cause
The voice transcription was failing because the code was calling Workers AI HTTP API with parameters only supported by the WebSocket streaming API.

### Solution Implemented
- Switched from Deepgram Nova-3 to **Whisper Large v3 Turbo**
- Removed invalid parameters (`interim_results`, `smart_format`, `streaming`)
- Send raw `Uint8Array` audio bytes directly to Whisper (no base64 wrapper)
- Updated QuerySessionManager to only pass `{ language: 'en' }`

### Enhanced Debugging
- Added visual **Debug Panel** (Ctrl+Shift+D)
- Comprehensive logging at all levels (trace, debug, info, warn, error)
- Browser console helper functions (`window.graphmindDebug`)
- Real-time WebSocket message capture
- Audio chunk size validation logging

---

## Quick Test Instructions

### 1. Open Production Site

Navigate to: **https://2fc6964f.graphmind-6hz.pages.dev**

### 2. Enable Debug Tools

**Open the Debug Panel:**
- Press `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)
- Or click the "🐛 Debug" button in bottom-right corner

**Enable Verbose Logging** (for maximum detail):
```javascript
// In browser console (F12)
window.graphmindDebug.enableVerbose(10);
```

### 3. Login or Register

Use these test credentials (already created):
- **Email**: `test-1763413165300@example.com`
- **Password**: `TestPassword123!`

Or register a new account with any email/password.

### 4. Navigate to Query Page

Click "Ask Question" or "Query" in the navigation menu.

### 5. Test Voice Recording

1. **Click "Start Recording"**
   - Watch debug panel for logs

2. **Grant Microphone Permission** (if prompted)
   - Click "Allow" when browser asks for mic access

3. **Speak a Test Query**
   - Speak clearly: **"What is the weather today?"**
   - Or any other question

4. **Watch for Transcription**
   - Should appear in the "Your Question" section
   - Check debug panel for errors

5. **Stop Recording**
   - Click "Stop Recording" button
   - Wait for answer processing

---

## Expected Results

### ✅ SUCCESS Indicators

**In the Debug Panel, you should see:**

```
[INFO] api query.start.success - Query session started
[INFO] QueryPage ws.open - WebSocket connected
[INFO] QueryPage media.start - Recording started with 1-second chunks
[DEBUG] QueryPage media.chunk.send - Sending audio chunk (sequence: 0)
[DEBUG] QueryPage media.chunk.send - Sending audio chunk (sequence: 1)
[DEBUG] QueryPage media.chunk.send - Sending audio chunk (sequence: 2)
[INFO] QueryPage ws.transcript_final - Final transcript received
```

**On the Page:**
- ✅ Transcription appears under "Your Question"
- ✅ Answer appears under "Answer" (even if it says "no data found")
- ✅ No error messages displayed
- ✅ Status changes: Starting → Recording → Processing → Complete

**What Success Looks Like:**
Even if the answer says "I don't have enough context" or "no data found", that's OK! The important thing is that **transcription works** and you see your spoken words appear as text.

### ❌ FAILURE Indicators

**In the Debug Panel, you would see:**

```
[ERROR] QueryPage ws.error - Server error: TRANSCRIPTION_ERROR
[ERROR] api request.failed - HTTP 500
[ERROR] QueryPage recording.start_failed
```

**On the Page:**
- ❌ Red error message appears
- ❌ No transcription text
- ❌ "TRANSCRIPTION_ERROR: Failed to transcribe audio"
- ❌ WebSocket disconnects

---

## Detailed Testing Steps

### Test 1: Basic Voice Query

**Goal**: Verify transcription works end-to-end

**Steps**:
1. Enable debug panel and verbose logging
2. Navigate to Query page
3. Click "Start Recording"
4. Speak: "Tell me about the weather"
5. Click "Stop Recording"

**Expected Outcome**:
- Transcription appears: "Tell me about the weather"
- Answer appears (even if generic)
- No errors in debug panel

**If This Fails**:
- Copy all debug panel logs
- Take screenshot of error message
- Check browser console for additional errors
- Proceed to Test 2

### Test 2: Microphone Permission

**Goal**: Verify microphone access works

**Steps**:
1. Open Query page
2. Click "Start Recording"
3. When prompted, click "Allow" for microphone

**Expected Outcome**:
- Microphone permission granted
- Recording starts successfully
- Debug panel shows: `[INFO] media.start - Recording started`

**If This Fails**:
```
[ERROR] recording.start_failed - Microphone access was denied
```
- Check browser settings: Site Settings → Microphone → Allow
- Ensure HTTPS is being used (not HTTP)
- Try different browser

### Test 3: WebSocket Connection

**Goal**: Verify real-time communication works

**Steps**:
1. Open debug panel
2. Enable verbose logging
3. Start recording
4. Filter debug panel to show only "INFO" and "ERROR" levels

**Expected Outcome**:
```
[INFO] ws.open - WebSocket connected
[INFO] ws.recording_started - Recording started
```

**If This Fails**:
```
[ERROR] ws.exception - WebSocket error
```
- Check if JWT token exists: `localStorage.getItem('jwt_token')`
- Try logging out and back in
- Check Network tab for WebSocket connection status

### Test 4: Audio Chunk Transmission

**Goal**: Verify audio data is being sent correctly

**Steps**:
1. Enable verbose logging
2. Start recording
3. Speak for 5 seconds
4. Filter debug panel to show only "DEBUG" level
5. Look for "media.chunk.send" entries

**Expected Outcome**:
```
[DEBUG] media.chunk.send - Sending audio chunk (sequence: 0, bytes: 1234)
[DEBUG] media.chunk.send - Sending audio chunk (sequence: 1, bytes: 1456)
[DEBUG] media.chunk.send - Sending audio chunk (sequence: 2, bytes: 1389)
```
- Should see multiple chunks (one per second)
- Each chunk should be > 200 bytes

**If This Fails**:
- Check if chunks are being created
- Look for "media.chunk.skipped" (chunks too small)
- Check MediaRecorder configuration

### Test 5: Browser Network Tab

**Goal**: Verify WebSocket messages at network level

**Steps**:
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Filter by "WS" (WebSocket)
4. Start recording and speak
5. Click on WebSocket connection
6. View "Messages" tab

**Expected Messages**:
```
↑ SENT: {"type":"audio_chunk","chunk":"base64...","sequence":0}
↓ RECEIVED: {"type":"recording_started","session_id":"sess_..."}
↑ SENT: {"type":"audio_chunk","chunk":"base64...","sequence":1}
↓ RECEIVED: {"type":"transcript_final","text":"your spoken words"}
```

**If This Fails**:
- No WebSocket connection: Check authentication
- No transcript messages: Backend issue
- Connection closes: Check for errors in messages

---

## Advanced Debugging

### Console Helper Commands

```javascript
// Show debug panel
window.graphmindDebug.show();

// Enable verbose logging for 10 minutes
window.graphmindDebug.enableVerbose(10);

// Get current state
window.graphmindDebug.getState();

// Check logging configuration
window.graphmindLogs.getLoggingState();

// Pause log capture (to examine current state)
window.graphmindDebug.pause();

// Resume log capture
window.graphmindDebug.resume();

// Clear all logs
window.graphmindDebug.clear();
```

### Test Microphone Manually

```javascript
navigator.mediaDevices.getUserMedia({
  audio: {
    sampleRate: 16000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
})
.then(stream => {
  console.log('✅ Microphone works!', stream);
  stream.getTracks().forEach(track => track.stop());
})
.catch(err => {
  console.error('❌ Microphone error:', err);
});
```

### Check Authentication

```javascript
// Check if logged in
const token = localStorage.getItem('jwt_token');
console.log('JWT Token:', token ? 'Present' : 'Missing');

// Test API call
fetch('https://graphmind-api.apex-web-services-llc-0d4.workers.dev/api/auth/me', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => console.log('Auth check:', data))
.catch(err => console.error('Auth error:', err));
```

---

## Reporting Issues

### Information to Collect

If you encounter errors, please collect:

1. **Debug Panel Logs**
   - Filter to "Errors" level
   - Screenshot or copy all error messages

2. **Browser Console**
   - Open Console tab (F12)
   - Copy any red error messages

3. **Network Tab**
   - Screenshot WebSocket messages
   - Screenshot failed API requests

4. **Environment Info**
   ```javascript
   console.log({
     userAgent: navigator.userAgent,
     platform: navigator.platform,
     url: window.location.href,
     loggingState: window.graphmindLogs.getLoggingState()
   });
   ```

5. **Steps to Reproduce**
   - What you clicked
   - What you said
   - What happened vs what was expected

### Where to Report

- **GitHub Issues**: (your repo URL)
- **Email**: (your email)
- **Slack**: (your channel)

---

## Comparison: Before vs After

### Before Fix ❌

```
[ERROR] QueryPage ws.error - TRANSCRIPTION_ERROR: Failed to transcribe audio
```
- Transcription would fail immediately
- No text would appear
- User sees error message
- Voice query completely broken

### After Fix ✅

```
[INFO] QueryPage ws.transcript_final - Final transcript received
```
- Transcription works successfully
- Spoken words appear as text
- Query executes (may say "no data" if graph is empty)
- Full voice pipeline functional

---

## Next Steps After Verification

### If Transcription Works ✅

1. **Mark as Resolved**
   - Update implementation notes
   - Mark task T320-T335 as complete
   - Update PRD with `/updateprd`

2. **Complete Remaining Tasks**
   - Cross-browser testing (Chrome, Firefox, Safari)
   - Mobile testing (iOS, Android)
   - Performance optimization
   - Accessibility improvements

3. **Production Readiness**
   - Run `/validate` for comprehensive checks
   - Complete smoke tests
   - Update documentation

### If Transcription Still Fails ❌

1. **Capture Detailed Logs**
   - Enable verbose logging
   - Record full debug panel output
   - Capture Network tab WebSocket messages

2. **Analyze Error Pattern**
   - Is it consistent or intermittent?
   - Does it happen with all audio or specific cases?
   - Are chunks being sent correctly?

3. **Next Solution**
   - Implement Solution B from ROOT_CAUSE_ANALYSIS.md
   - Switch to WebSocket streaming API
   - Use Cloudflare Realtime Agents (Pipecat)

---

## FAQ

### Q: Why don't I see transcription immediately?

**A:** Whisper processes complete audio chunks (1 second each), so there's a 1-2 second delay. This is expected behavior with the batch processing model.

### Q: The answer says "no data found" - is that broken?

**A:** No! That means transcription worked, but the knowledge graph is empty. Try adding sample data via the seed endpoint or creating some notes first.

### Q: Can I test without speaking?

**A:** Not really - the system needs actual audio input. However, you can test the full pipeline by speaking any test phrase like "Hello world".

### Q: What browsers are supported?

**A:** Chrome, Firefox, Safari (latest versions). Mobile browsers also supported.

### Q: How do I know if the fix is deployed?

**A:** The debug panel should be available. Press Ctrl+Shift+D - if it opens, the fix is deployed.

---

## Summary

**Testing Checklist:**

- [ ] Open production site: https://2fc6964f.graphmind-6hz.pages.dev
- [ ] Enable debug panel (Ctrl+Shift+D)
- [ ] Enable verbose logging
- [ ] Login or register
- [ ] Navigate to Query page
- [ ] Start recording
- [ ] Speak test query
- [ ] Verify transcription appears
- [ ] Check for errors in debug panel
- [ ] Capture logs if issues found

**Success = Transcription text appears**
**Failure = Error message or no transcription**

For detailed debugging instructions, see `/docs/DEBUGGING_GUIDE.md`

Good luck! 🎤✨
