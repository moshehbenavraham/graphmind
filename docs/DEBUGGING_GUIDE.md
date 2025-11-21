# GraphMind Debugging Guide

Complete guide to debugging GraphMind's voice transcription and query system in production.

---

## Quick Start

### 1. Enable Debug Panel

The debug panel is always available in production. To open it:

**Method 1: Keyboard Shortcut**
- Press `Ctrl+Shift+D` (Windows/Linux)
- Press `Cmd+Shift+D` (Mac)

**Method 2: Browser Console**
```javascript
window.graphmindDebug.show();
```

**Method 3: Click Debug Button**
- Look for the "🐛 Debug" button in the bottom-right corner
- Click to open the debug panel

### 2. Enable Verbose Logging

For maximum detail, enable verbose logging:

```javascript
// Enable verbose logging for 10 minutes
window.graphmindDebug.enableVerbose(10);

// Or directly:
window.graphmindLogs.enableVerboseLoggingWindow(10);
```

### 3. Check Logging State

```javascript
// Check current logging configuration
window.graphmindDebug.getState();

// Or:
window.graphmindLogs.getLoggingState();
```

---

## Debug Panel Features

### Controls

1. **Filter Logs**: Filter by level (All, Errors, Warnings, Info, Debug, Trace)
2. **Pause/Resume**: Pause log capture to examine current state
3. **Auto Scroll**: Toggle automatic scrolling to newest logs
4. **Clear**: Clear all captured logs
5. **Verbose Toggle**: Enable/disable verbose logging mode

### Log Levels

- **ERROR** (Red): Critical errors, transcription failures, API errors
- **WARN** (Orange): Warnings, non-critical issues, validation warnings
- **INFO** (Green): Important events, session start/stop, success messages
- **DEBUG** (Cyan): Detailed debugging info, WebSocket messages, chunk data
- **TRACE** (Purple): Extremely detailed logs, every small step

### Keyboard Shortcuts

- `Ctrl+Shift+D` / `Cmd+Shift+D`: Toggle debug panel
- Panel is resizable and can be minimized

---

## Console Helper Functions

### window.graphmindDebug

```javascript
// Show/hide debug panel
window.graphmindDebug.show();
window.graphmindDebug.hide();
window.graphmindDebug.toggle();

// Control logging
window.graphmindDebug.pause();  // Pause log capture
window.graphmindDebug.resume(); // Resume log capture
window.graphmindDebug.clear();  // Clear all logs

// Enable verbose mode
window.graphmindDebug.enableVerbose(minutes); // Default: 10 minutes

// Get current state
window.graphmindDebug.getState();
```

### window.graphmindLogs

```javascript
// Enable verbose logging window
window.graphmindLogs.enableVerboseLoggingWindow(10);

// Get logging configuration
window.graphmindLogs.getLoggingState();
```

---

## Debugging Voice Transcription Issues

### Step-by-Step Debugging Process

#### 1. Enable Verbose Logging

```javascript
window.graphmindDebug.enableVerbose(10);
window.graphmindDebug.show();
```

#### 2. Start Recording

1. Navigate to `/query` page
2. Click "Start Recording"
3. Watch the debug panel for these key events:

**Expected Log Sequence:**

```
[INFO] api query.start - Starting new query session
[INFO] api query.start.success - Query session started
[DEBUG] QueryPage session.start - Query session started
[DEBUG] QueryPage ws.connect - Connecting to WebSocket
[INFO] QueryPage ws.open - WebSocket connected
[INFO] QueryPage media.start - Recording started with 1-second chunks
[DEBUG] QueryPage media.chunk.send - Sending audio chunk (sequence: 0)
[DEBUG] QueryPage media.chunk.send - Sending audio chunk (sequence: 1)
[INFO] QueryPage ws.recording_started - Recording started
```

#### 3. Speak Your Query

Watch for transcription-related logs:

```
[DEBUG] QueryPage media.chunk.send - Sending audio chunk (sequence: 2)
[INFO] QueryPage ws.transcript_final - Final transcript received
```

#### 4. Check for Errors

Look for these ERROR logs:

```
❌ [ERROR] QueryPage ws.error - Server error
❌ [ERROR] api request.failed - HTTP error
❌ [ERROR] QueryPage recording.start_failed - Error starting recording
❌ [ERROR] QueryPage media.error - MediaRecorder error
```

### Common Issues and Solutions

#### Issue 1: "TRANSCRIPTION_ERROR: Failed to transcribe audio"

**Check the logs for:**
```
[ERROR] QueryPage ws.error - Server error: TRANSCRIPTION_ERROR
```

**Possible Causes:**
1. Audio chunks too small (< 200 bytes)
2. Invalid audio format
3. Workers AI service issue
4. Base64 encoding/decoding issue

**Debug Steps:**
1. Check audio chunk size in logs:
   ```
   [DEBUG] media.chunk.send - Sending audio chunk
   ```
   Look for `bytes` field - should be > 200

2. Check MediaRecorder configuration:
   ```
   [DEBUG] media.create - MediaRecorder created
   ```
   Should show `mimeType: audio/webm;codecs=opus`

3. Check backend logs (if accessible):
   ```bash
   npx wrangler tail graphmind-api
   ```

#### Issue 2: WebSocket Connection Fails

**Check the logs for:**
```
[ERROR] QueryPage ws.exception - WebSocket error
```

**Possible Causes:**
1. Invalid JWT token
2. Network connection issue
3. Backend not responding

**Debug Steps:**
1. Check authentication:
   ```javascript
   localStorage.getItem('jwt_token');
   ```

2. Check WebSocket URL in logs:
   ```
   [DEBUG] ws.connect - Connecting to WebSocket
   ```
   Verify the URL looks correct

3. Test backend connectivity:
   ```bash
   curl https://graphmind-api.apex-web-services-llc-0d4.workers.dev/api/auth/me \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

#### Issue 3: Microphone Permission Denied

**Check the logs for:**
```
[ERROR] recording.start_failed - Error starting recording
```

**Possible Causes:**
1. User denied microphone permission
2. HTTPS required (not HTTP)
3. No microphone hardware detected

**Debug Steps:**
1. Check browser permissions:
   - Chrome: Settings → Privacy and security → Site Settings → Microphone
   - Firefox: Settings → Privacy & Security → Permissions → Microphone

2. Ensure HTTPS:
   - Production URL must use HTTPS
   - localhost can use HTTP

3. Test microphone:
   ```javascript
   navigator.mediaDevices.getUserMedia({ audio: true })
     .then(stream => {
       console.log('Microphone works!', stream);
       stream.getTracks().forEach(track => track.stop());
     })
     .catch(err => console.error('Microphone error:', err));
   ```

#### Issue 4: No Transcript Appears

**Check the logs for:**
```
[WARN] ws.unknown - Unknown message type
```

**Possible Causes:**
1. WebSocket message format mismatch
2. Backend not sending transcript messages
3. Client-side message parsing issue

**Debug Steps:**
1. Enable verbose logging and check all WebSocket messages

2. Check for `transcript_final` or `transcript_update` messages:
   ```
   [DEBUG] ws.message - Received: {"type":"transcript_final","text":"..."}
   ```

3. If no transcript messages, issue is on backend

4. Check Network tab → WebSocket messages

---

## Browser Network Tab Debugging

### WebSocket Messages

1. Open Chrome DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Click on the WebSocket connection
4. View "Messages" tab

**Expected Message Flow:**

```
↑ SENT: {"type":"audio_chunk","chunk":"base64...","sequence":0,"timestamp":...}
↓ RECEIVED: {"type":"recording_started","session_id":"sess_..."}
↑ SENT: {"type":"audio_chunk","chunk":"base64...","sequence":1,"timestamp":...}
↓ RECEIVED: {"type":"transcript_final","text":"Your query text"}
↓ RECEIVED: {"type":"cypher_generating"}
↓ RECEIVED: {"type":"cypher_generated","cypher":"MATCH ..."}
↓ RECEIVED: {"type":"answer_generated","answer":"..."}
```

### API Requests

1. Open Network tab
2. Filter by "Fetch/XHR"
3. Look for:
   - `POST /api/auth/login` or `/api/auth/register`
   - `POST /api/query/start`
   - `GET /api/query/history`

4. Check response status:
   - **200**: Success
   - **401**: Unauthorized (token expired)
   - **400**: Bad request (validation error)
   - **500**: Server error

5. Click on request → Response tab to see error details

---

## Production Deployment Verification

### After Deploying Fix

1. **Clear Browser Cache**
   ```
   Chrome: Ctrl+Shift+Del → Clear cached images and files
   Firefox: Ctrl+Shift+Del → Cached Web Content
   ```

2. **Hard Refresh**
   ```
   Ctrl+Shift+R (Windows/Linux)
   Cmd+Shift+R (Mac)
   ```

3. **Enable Debug Panel**
   ```javascript
   window.graphmindDebug.enableVerbose(10);
   window.graphmindDebug.show();
   ```

4. **Test Voice Query**
   - Start recording
   - Speak clearly: "What is the weather today?"
   - Watch debug panel for errors

5. **Capture Logs**
   - If errors occur, copy debug panel logs
   - Or open Console → right-click → Save as...

6. **Check Backend Logs** (if accessible)
   ```bash
   npx wrangler tail graphmind-api --format pretty
   ```

### Expected Success Indicators

✅ **All Good if you see:**
```
[INFO] query.start.success - Query session started
[INFO] ws.open - WebSocket connected
[INFO] media.start - Recording started
[DEBUG] media.chunk.send - Sending audio chunk (multiple times)
[INFO] ws.transcript_final - Final transcript received
[INFO] ws.cypher - Cypher generated
[INFO] ws.answer_generated - Answer generated (or answer_fallback)
```

❌ **Problem if you see:**
```
[ERROR] ws.error - Server error: TRANSCRIPTION_ERROR
[ERROR] request.failed - HTTP 500
[ERROR] recording.start_failed
[ERROR] ws.exception
```

---

##Environment Variables for Debugging

### Local Development (.env)

```bash
# Enable debug mode
VITE_DEBUG=true

# Enable verbose logging
VITE_DEBUG_VERBOSE=true

# Enable remote logging (to /api/logs endpoint)
VITE_DEBUG_REMOTE=false

# Remote logging sample rate (0.0 to 1.0)
VITE_DEBUG_REMOTE_SAMPLE_RATE=0.25

# Max remote logs per minute
VITE_DEBUG_REMOTE_MAX_PER_MIN=60

# API endpoints
VITE_API_BASE_URL=http://localhost:8787
VITE_WS_BASE_URL=ws://localhost:8787
```

### Production (Cloudflare Pages Environment Variables)

```bash
# Minimal logging in production
VITE_DEBUG=false
VITE_DEBUG_VERBOSE=false

# API endpoints
VITE_API_BASE_URL=https://graphmind-api.apex-web-services-llc-0d4.workers.dev
VITE_WS_BASE_URL=wss://graphmind-api.apex-web-services-llc-0d4.workers.dev
```

**Note:** Even with `VITE_DEBUG=false`, you can still enable verbose logging at runtime using `window.graphmindDebug.enableVerbose()`.

---

## Advanced Debugging

### Capture All Console Output

```javascript
// Save console output to array
const capturedLogs = [];
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn
};

console.log = (...args) => {
  capturedLogs.push({ level: 'log', args, timestamp: Date.now() });
  originalConsole.log(...args);
};

console.error = (...args) => {
  capturedLogs.push({ level: 'error', args, timestamp: Date.now() });
  originalConsole.error(...args);
};

console.warn = (...args) => {
  capturedLogs.push({ level: 'warn', args, timestamp: Date.now() });
  originalConsole.warn(...args);
};

// After test, export logs
console.log('Captured logs:', capturedLogs);
copy(JSON.stringify(capturedLogs, null, 2)); // Copies to clipboard
```

### Monitor WebSocket Messages

```javascript
// Intercept WebSocket constructor
const OriginalWebSocket = window.WebSocket;
window.WebSocket = function(...args) {
  const ws = new OriginalWebSocket(...args);

  ws.addEventListener('message', (event) => {
    console.log('[WS RECEIVED]', event.data);
  });

  const originalSend = ws.send.bind(ws);
  ws.send = function(data) {
    console.log('[WS SENT]', data);
    return originalSend(data);
  };

  return ws;
};
```

### Test Audio Recording

```javascript
// Test microphone and MediaRecorder
async function testAudioRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  const recorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 16000
  });

  recorder.ondataavailable = (event) => {
    console.log('Audio chunk size:', event.data.size, 'bytes');
  };

  recorder.start(1000); // 1-second chunks

  setTimeout(() => {
    recorder.stop();
    stream.getTracks().forEach(track => track.stop());
  }, 5000); // Record for 5 seconds
}

testAudioRecording();
```

---

## Getting Help

### Information to Collect

When reporting issues, please provide:

1. **Browser Console Logs**
   - Open debug panel
   - Filter to "Errors"
   - Screenshot or copy-paste

2. **Network Tab Screenshot**
   - WebSocket messages
   - Failed API requests

3. **Environment Info**
   ```javascript
   {
     userAgent: navigator.userAgent,
     platform: navigator.platform,
     language: navigator.language,
     loggingState: window.graphmindLogs.getLoggingState(),
     debugState: window.graphmindDebug.getState()
   }
   ```

4. **Steps to Reproduce**
   - What you clicked
   - What you expected
   - What actually happened

### Support Resources

- **GitHub Issues**: https://github.com/yourorg/graphmind/issues
- **Documentation**: /docs/PRD/REQUIREMENTS-PRD.md
- **Debugging Logs**: specs/011-frontend-deployment/

---

## Summary

GraphMind now has comprehensive logging and debugging tools built-in:

✅ **Visual Debug Panel** - Ctrl+Shift+D to toggle
✅ **Verbose Logging** - Runtime enablement via console
✅ **Console Helper Functions** - `window.graphmindDebug.*`
✅ **Automatic Error Capture** - All errors logged
✅ **WebSocket Monitoring** - All messages logged
✅ **API Request Logging** - Timing and error details

**For any voice transcription issue, follow these steps:**

1. Enable verbose logging: `window.graphmindDebug.enableVerbose(10)`
2. Open debug panel: `Ctrl+Shift+D`
3. Start recording and watch for errors
4. Copy error logs and report issue

**Happy debugging! 🐛**
