# GraphMind Frontend Components

Frontend components for GraphMind voice note capture and transcription.

## Components

### VoiceRecorder

Main component for recording voice notes with real-time transcription.

**Features:**
- WebRTC audio capture (16kHz, mono, PCM)
- WebSocket connection with automatic reconnection (3 retries, exponential backoff)
- Real-time audio streaming with base64 encoding
- Recording timer
- Error handling for microphone access, network issues, and transcription failures
- Visual feedback for connection status

**Props:**
- `apiUrl` (string, required): Base API URL (e.g., `https://api.graphmind.com`)
- `authToken` (string, required): JWT authentication token

**Usage:**
```jsx
import VoiceRecorder from './components/VoiceRecorder';

function App() {
  const apiUrl = 'https://graphmind-api.workers.dev';
  const authToken = 'your-jwt-token';

  return (
    <div>
      <VoiceRecorder apiUrl={apiUrl} authToken={authToken} />
    </div>
  );
}
```

### TranscriptView

Component for displaying real-time and final transcripts.

**Features:**
- Real-time partial transcript display
- Loading indicator during delays (>2 seconds)
- Final transcript display with metadata
- Copy to clipboard functionality
- Navigation to full note view

**Props:**
- `partialText` (string): Real-time partial transcript
- `finalTranscript` (string): Completed final transcript
- `noteId` (string): Saved note ID
- `metadata` (object): Note metadata (duration, word count, timestamp)
- `isRecording` (boolean): Current recording state

**Usage:**
```jsx
import TranscriptView from './components/TranscriptView';

function NoteView() {
  return (
    <TranscriptView
      partialText="Current transcript..."
      finalTranscript={null}
      noteId={null}
      metadata={{}}
      isRecording={true}
    />
  );
}
```

## Hooks

### useWebSocket

Custom hook for managing WebSocket connections with automatic reconnection.

**Features:**
- Automatic reconnection with exponential backoff
- Configurable retry attempts
- Message handling with JSON parsing
- Connection state management

**Usage:**
```javascript
import { useWebSocket } from './hooks/useWebSocket';

function MyComponent() {
  const { isConnected, isConnecting, send, connect, disconnect } = useWebSocket(
    'wss://api.example.com/ws',
    {
      maxReconnectAttempts: 3,
      baseReconnectDelay: 1000,
      onMessage: (data) => console.log('Received:', data),
      onOpen: () => console.log('Connected'),
      onClose: () => console.log('Disconnected'),
      onError: (error) => console.error('Error:', error),
      autoConnect: true,
    }
  );

  return (
    <div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <button onClick={() => send({ type: 'ping' })}>Send Ping</button>
    </div>
  );
}
```

## Utilities

### audioUtils

Utility functions for audio handling.

**Functions:**
- `blobToBase64(blob)` - Convert audio blob to base64 string
- `requestMicrophoneAccess(constraints)` - Request microphone access
- `checkAudioCapabilities()` - Check browser audio support
- `getSupportedMimeTypes()` - Get supported audio MIME types
- `getBestMimeType()` - Get best available MIME type
- `createMediaRecorder(stream, options)` - Create MediaRecorder with best settings
- `formatTime(seconds)` - Format seconds as MM:SS
- `formatTimestamp(timestamp, options)` - Format ISO timestamp

**Usage:**
```javascript
import {
  blobToBase64,
  requestMicrophoneAccess,
  checkAudioCapabilities,
  formatTime,
} from './utils/audioUtils';

// Check browser support
const capabilities = checkAudioCapabilities();
if (!capabilities.supported) {
  console.error('Unsupported features:', capabilities.unsupportedFeatures);
}

// Request microphone
const stream = await requestMicrophoneAccess();

// Convert audio to base64
const blob = new Blob([audioData], { type: 'audio/webm' });
const base64 = await blobToBase64(blob);

// Format time
console.log(formatTime(125)); // "02:05"
```

## WebSocket Message Format

### Client → Server

**Audio Chunk:**
```json
{
  "type": "audio_chunk",
  "chunk": "base64_encoded_audio_data",
  "sequence": 1,
  "timestamp": 1699700000000
}
```

**Stop Recording:**
```json
{
  "type": "stop_recording"
}
```

**Heartbeat:**
```json
{
  "type": "ping"
}
```

### Server → Client

**Session Started:**
```json
{
  "type": "session_started",
  "session_id": "sess_abc123",
  "status": "recording"
}
```

**Transcript Partial:**
```json
{
  "type": "transcript_partial",
  "text": "Today I discussed the project with",
  "is_final": false,
  "confidence": 0.87
}
```

**Transcript Complete:**
```json
{
  "type": "transcript_complete",
  "note_id": "note_xyz789",
  "transcript": "Full polished transcript with punctuation.",
  "duration_seconds": 120,
  "word_count": 245,
  "created_at": "2025-11-11T09:30:00Z"
}
```

**Error:**
```json
{
  "type": "error",
  "code": "TRANSCRIPTION_FAILED",
  "message": "Failed to transcribe audio chunk",
  "recoverable": true
}
```

## Error Handling

### Microphone Errors

**NotAllowedError:**
- User denied microphone permission
- Show permission guide
- Provide browser-specific instructions

**NotFoundError:**
- No microphone detected
- Ask user to connect microphone

**NotReadableError:**
- Microphone in use by another app
- Ask user to close other apps

### Network Errors

**WebSocket Connection Failed:**
- Automatic reconnection (3 attempts)
- Exponential backoff (1s, 2s, 4s)
- User notification on failure

**Transcription API Errors:**
- Retry on recoverable errors
- Stop recording on fatal errors
- Display error message with code

## Performance Targets

- **Recording start**: <500ms (click to audio capture)
- **WebSocket connection**: <1s
- **Transcript latency (p95)**: <2s (speech to text display)
- **Notes list load**: <1s
- **Note detail load**: <500ms

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 14+
- Mobile browsers with WebRTC support

**Required Features:**
- `navigator.mediaDevices.getUserMedia()`
- `MediaRecorder API`
- `WebSocket API`
- `FileReader API`

## Styling

Components include inline styles using styled-jsx. To customize:

1. Extract styles to separate CSS file
2. Override CSS variables
3. Use CSS modules
4. Integrate with your design system

**Example CSS Variables:**
```css
:root {
  --primary-color: #007bff;
  --success-color: #28a745;
  --error-color: #dc3545;
  --warning-color: #ffc107;
  --border-radius: 8px;
  --spacing-unit: 1rem;
}
```

## Development

### Local Testing

1. Start development server:
```bash
npm run dev
```

2. Open browser to `http://localhost:8787`

3. Enable microphone permissions

4. Test recording and transcription

### Integration Testing

Test scenarios:
- [ ] Successful recording and transcription
- [ ] Microphone permission denied
- [ ] Network disconnection during recording
- [ ] WebSocket reconnection
- [ ] Transcription errors
- [ ] Maximum recording duration
- [ ] Multiple notes in sequence

## Tasks Implemented

This implementation covers tasks T054-T069:

- [x] T054: Create VoiceRecorder component structure
- [x] T055: Implement WebSocket connection
- [x] T056: Add audio capture with getUserMedia
- [x] T057: Implement base64 audio encoding
- [x] T058: Send audio chunks with sequence numbers
- [x] T059: Send stop_recording message
- [x] T060: Implement reconnection logic (3 retries)
- [x] T061: Add exponential backoff for reconnections
- [x] T062: Create TranscriptView component
- [x] T063: Display transcript_partial messages
- [x] T064: Update transcript in real-time
- [x] T065: Show loading indicator during delays
- [x] T066: Handle transcript_complete message
- [x] T067: Display final transcript with metadata
- [x] T068: Implement error handling for all error types
- [x] T069: Add visual feedback for connection states

## Next Steps

1. **Integration with Backend:**
   - Ensure backend WebSocket endpoint is deployed
   - Test with real Deepgram transcription
   - Verify D1 database storage

2. **UI Enhancements:**
   - Add waveform visualization
   - Add audio level indicator
   - Add transcript editing
   - Add note tagging

3. **Performance Optimization:**
   - Implement audio chunk buffering
   - Add client-side caching
   - Optimize re-renders

4. **Accessibility:**
   - Add ARIA labels
   - Support keyboard navigation
   - Add screen reader support

## License

See project LICENSE file.
