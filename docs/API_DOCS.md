# GraphMind API Documentation

Complete API reference for GraphMind voice note system.

**Base URL**: `https://graphmind.your-domain.com`

**API Version**: v1

**Authentication**: Bearer JWT token in `Authorization` header

---

## Table of Contents

1. [Authentication](#authentication)
2. [Voice Notes](#voice-notes)
3. [WebSocket Protocol](#websocket-protocol)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Health Endpoints](#health-endpoints)

---

## Authentication

### Register User

Create a new user account.

**Endpoint**: `POST /api/auth/register`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Validation**:
- Email: Valid email format, max 255 characters
- Password: Min 8 characters, must contain uppercase, lowercase, number, and special character

**Response**: `201 Created`
```json
{
  "user": {
    "user_id": "user_1234567890abcdef",
    "email": "user@example.com",
    "created_at": "2024-01-01T12:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors**:
- `400 Bad Request`: Validation failed
- `409 Conflict`: Email already registered
- `500 Internal Server Error`: Server error

---

### Login

Authenticate and receive JWT token.

**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response**: `200 OK`
```json
{
  "user": {
    "user_id": "user_1234567890abcdef",
    "email": "user@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Token Expiration**: 24 hours

**Errors**:
- `400 Bad Request`: Missing email or password
- `401 Unauthorized`: Invalid credentials
- `500 Internal Server Error`: Server error

---

### Get Current User

Get authenticated user details.

**Endpoint**: `GET /api/auth/me`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Response**: `200 OK`
```json
{
  "user_id": "user_1234567890abcdef",
  "email": "user@example.com",
  "created_at": "2024-01-01T12:00:00.000Z"
}
```

**Errors**:
- `401 Unauthorized`: Invalid or expired token
- `500 Internal Server Error`: Server error

---

## Voice Notes

### Start Recording Session

Create a new voice recording session.

**Endpoint**: `POST /api/notes/start-recording`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Request Body** (optional):
```json
{
  "audio_config": {
    "sample_rate": 16000,
    "channels": 1,
    "format": "pcm"
  }
}
```

**Response**: `200 OK`
```json
{
  "session_id": "sess_1234567890abcdef",
  "websocket_url": "wss://graphmind.your-domain.com/ws/notes/sess_1234567890abcdef",
  "expires_at": "2024-01-01T13:00:00.000Z",
  "max_duration_seconds": 600
}
```

**Session Details**:
- Session expires after 1 hour of inactivity
- Maximum recording duration: 10 minutes
- WebSocket URL is single-use

**Rate Limit**: 10 requests per hour per user

**Errors**:
- `400 Bad Request`: Invalid audio configuration
- `401 Unauthorized`: Invalid token
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

### List Voice Notes

Get paginated list of user's voice notes.

**Endpoint**: `GET /api/notes`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters**:
- `limit` (optional): Number of notes per page (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Example**:
```
GET /api/notes?limit=20&offset=0
```

**Response**: `200 OK`
```json
{
  "notes": [
    {
      "note_id": "note_1234567890abcdef",
      "transcript": "This is my voice note transcript...",
      "duration_seconds": 45,
      "word_count": 82,
      "created_at": "2024-01-01T12:00:00.000Z"
    },
    {
      "note_id": "note_0987654321fedcba",
      "transcript": "Another voice note...",
      "duration_seconds": 30,
      "word_count": 55,
      "created_at": "2024-01-01T11:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

**Sorting**: Notes are returned in descending order by `created_at` (newest first)

**Rate Limit**: 60 requests per minute per user

**Errors**:
- `400 Bad Request`: Invalid pagination parameters
- `401 Unauthorized`: Invalid token
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

### Get Voice Note

Get full details of a specific voice note.

**Endpoint**: `GET /api/notes/:note_id`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Example**:
```
GET /api/notes/note_1234567890abcdef
```

**Response**: `200 OK`
```json
{
  "note_id": "note_1234567890abcdef",
  "user_id": "user_1234567890abcdef",
  "transcript": "This is the full transcript of my voice note. It can be quite long and contain multiple sentences and paragraphs.",
  "duration_seconds": 45,
  "word_count": 82,
  "processing_status": "completed",
  "created_at": "2024-01-01T12:00:00.000Z"
}
```

**Processing Status Values**:
- `completed`: Transcription complete
- `processing`: Currently being transcribed (shouldn't happen, synchronous)
- `failed`: Transcription failed

**User Isolation**: Users can only access their own notes. Attempting to access another user's note returns `404`.

**Rate Limit**: 60 requests per minute per user

**Errors**:
- `401 Unauthorized`: Invalid token
- `404 Not Found`: Note doesn't exist or belongs to different user
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

### Delete Voice Note

Soft delete a voice note.

**Endpoint**: `DELETE /api/notes/:note_id`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Example**:
```
DELETE /api/notes/note_1234567890abcdef
```

**Response**: `204 No Content`

Empty response body.

**Deletion Behavior**:
- Soft delete: Sets `is_deleted = 1` flag
- Note will not appear in future queries
- Data retained for recovery (if needed)

**User Isolation**: Users can only delete their own notes.

**Rate Limit**: 10 requests per minute per user

**Errors**:
- `401 Unauthorized`: Invalid token
- `404 Not Found`: Note doesn't exist, already deleted, or belongs to different user
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## WebSocket Protocol

### Connection

**URL**: `wss://graphmind.your-domain.com/ws/notes/:session_id`

**Query Parameters**:
- `token`: JWT authentication token

**Example**:
```javascript
const ws = new WebSocket(
  'wss://graphmind.your-domain.com/ws/notes/sess_1234567890abcdef?token=' + jwt
);
```

**Connection Lifecycle**:
1. Client connects with session_id and token
2. Server validates session and token
3. Server sends `session_started` message
4. Client sends `audio_chunk` messages
5. Server sends `transcript_partial` messages
6. Client sends `stop_recording` message
7. Server sends `transcript_complete` message
8. Connection closes

---

### Client → Server Messages

#### Audio Chunk

Send audio data for transcription.

```json
{
  "type": "audio_chunk",
  "sequence": 0,
  "chunk": "base64_encoded_audio_data",
  "timestamp": 1704110400000
}
```

**Fields**:
- `type`: Always `"audio_chunk"`
- `sequence`: Sequential chunk number, starting from 0
- `chunk`: Base64-encoded PCM audio data (16kHz, mono, 16-bit)
- `timestamp`: Unix timestamp in milliseconds

**Validation**:
- Chunks must be sent in sequence order
- Missing sequences will trigger warning
- Out-of-order chunks may be rejected

---

#### Stop Recording

End the recording session.

```json
{
  "type": "stop_recording"
}
```

Server will:
1. Save transcript to database
2. Send `transcript_complete` message
3. Close WebSocket connection

---

#### Ping

Keep-alive ping (optional).

```json
{
  "type": "ping"
}
```

Server responds with `pong`.

---

### Server → Client Messages

#### Session Started

Sent immediately after connection.

```json
{
  "type": "session_started",
  "session_id": "sess_1234567890abcdef",
  "status": "recording"
}
```

---

#### Transcript Partial

Partial or final transcription result.

```json
{
  "type": "transcript_partial",
  "text": "This is the transcribed text",
  "is_final": true,
  "confidence": 0.95,
  "sequence": 5
}
```

**Fields**:
- `text`: Transcribed text
- `is_final`: `true` if final result, `false` if partial
- `confidence`: Transcription confidence (0.0 - 1.0)
- `sequence`: Corresponding audio chunk sequence

**Usage**:
- Display partial results in real-time
- Only store final results

---

#### Transcript Complete

Sent when recording stops successfully.

```json
{
  "type": "transcript_complete",
  "note_id": "note_1234567890abcdef",
  "transcript": "Full transcript text...",
  "duration_seconds": 45,
  "word_count": 82,
  "created_at": "2024-01-01T12:00:00.000Z"
}
```

---

#### Warning

Session timeout warning.

```json
{
  "type": "warning",
  "message": "Session will end in 1 minute",
  "seconds_remaining": 60
}
```

Sent 1 minute before maximum session duration (10 minutes).

---

#### Error

Error occurred during processing.

```json
{
  "type": "error",
  "code": "VALIDATION_FAILED",
  "message": "Audio chunk validation failed: sequence out of order",
  "recoverable": true
}
```

**Error Codes**:
- `MESSAGE_PARSE_ERROR`: Invalid JSON message
- `INVALID_MESSAGE`: Message missing required fields
- `VALIDATION_FAILED`: Audio chunk validation failed
- `TRANSCRIPTION_FAILED`: Transcription service error
- `AUDIO_CHUNK_ERROR`: Error processing audio chunk
- `SAVE_FAILED`: Failed to save transcript to database
- `SESSION_TIMEOUT`: Maximum session duration reached
- `UNKNOWN_MESSAGE_TYPE`: Unrecognized message type

**Recoverable Errors**:
- `true`: Session can continue, retry allowed
- `false`: Fatal error, session will be terminated

---

#### Pong

Response to ping.

```json
{
  "type": "pong"
}
```

---

### WebSocket Close Codes

| Code | Reason | Description |
|------|--------|-------------|
| 1000 | Normal Closure | Session completed successfully |
| 1001 | Going Away | Server shutdown or restart |
| 1008 | Policy Violation | Invalid session or authentication |
| 1011 | Internal Error | Server error during processing |

---

## Error Handling

### Error Response Format

All HTTP errors return JSON:

```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": {
      "field": "Additional context"
    }
  }
}
```

**Common Error Codes**:
- `INVALID_INPUT`: Request validation failed
- `UNAUTHORIZED`: Authentication required or failed
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `DUPLICATE_EMAIL`: Email already registered
- `RATE_LIMITED`: Rate limit exceeded
- `SERVER_ERROR`: Internal server error
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable
- `DATABASE_ERROR`: Database operation failed

---

### HTTP Status Codes

| Status | Meaning | Common Causes |
|--------|---------|---------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 204 | No Content | Successful delete |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Invalid/missing token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Temporary outage |

---

## Rate Limiting

### Rate Limit Headers

Responses include rate limit information:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1704110400
```

**Headers**:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets

---

### Rate Limits by Endpoint

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/auth/register | 5 | 1 hour |
| POST /api/auth/login | 10 | 15 minutes |
| POST /api/notes/start-recording | 10 | 1 hour |
| GET /api/notes | 60 | 1 minute |
| GET /api/notes/:note_id | 60 | 1 minute |
| DELETE /api/notes/:note_id | 10 | 1 minute |

---

### Rate Limit Exceeded

When rate limit is exceeded:

**Response**: `429 Too Many Requests`
```json
{
  "error": {
    "message": "Rate limit exceeded. Please try again in 45 seconds.",
    "code": "RATE_LIMITED",
    "details": {
      "retry_after_seconds": 45
    }
  }
}
```

**Headers**:
```
Retry-After: 45
```

**Recommendation**: Wait for `retry_after_seconds` before retrying.

---

## Health Endpoints

### Worker Health

Check if worker is operational.

**Endpoint**: `GET /health`

**Response**: `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

---

### FalkorDB Health

Check FalkorDB connection.

**Endpoint**: `GET /api/health/falkordb`

**Response**: `200 OK`
```json
{
  "status": "connected",
  "latency_ms": 45,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Status Values**:
- `connected`: Connection healthy
- `disconnected`: Connection failed
- `degraded`: Connection slow or intermittent

---

### Database Health

Check D1 database connection.

**Endpoint**: `GET /api/health/db`

**Response**: `200 OK`
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## Code Examples

### JavaScript/TypeScript

```javascript
// Register user
const registerResponse = await fetch('https://graphmind.your-domain.com/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123!'
  })
});

const { token, user } = await registerResponse.json();

// Start recording session
const sessionResponse = await fetch('https://graphmind.your-domain.com/api/notes/start-recording', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { websocket_url, session_id } = await sessionResponse.json();

// Connect WebSocket
const ws = new WebSocket(`${websocket_url}?token=${token}`);

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'session_started':
      console.log('Recording started');
      break;
    case 'transcript_partial':
      console.log('Transcript:', message.text);
      break;
    case 'transcript_complete':
      console.log('Note saved:', message.note_id);
      break;
    case 'error':
      console.error('Error:', message.message);
      break;
  }
};

// Send audio chunk
ws.send(JSON.stringify({
  type: 'audio_chunk',
  sequence: 0,
  chunk: base64AudioData,
  timestamp: Date.now()
}));

// Stop recording
ws.send(JSON.stringify({
  type: 'stop_recording'
}));

// List notes
const notesResponse = await fetch('https://graphmind.your-domain.com/api/notes', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { notes, pagination } = await notesResponse.json();
```

---

### Python

```python
import requests
import json
import websocket

# Register user
response = requests.post(
    'https://graphmind.your-domain.com/api/auth/register',
    json={
        'email': 'user@example.com',
        'password': 'SecurePassword123!'
    }
)

data = response.json()
token = data['token']

# Start recording session
response = requests.post(
    'https://graphmind.your-domain.com/api/notes/start-recording',
    headers={'Authorization': f'Bearer {token}'}
)

session_data = response.json()
ws_url = f"{session_data['websocket_url']}?token={token}"

# Connect WebSocket
def on_message(ws, message):
    msg = json.loads(message)
    print(f"Received: {msg['type']}")

def on_open(ws):
    print("Connected")

    # Send audio chunk
    ws.send(json.dumps({
        'type': 'audio_chunk',
        'sequence': 0,
        'chunk': base64_audio_data,
        'timestamp': int(time.time() * 1000)
    }))

ws = websocket.WebSocketApp(
    ws_url,
    on_message=on_message,
    on_open=on_open
)

ws.run_forever()
```

---

### cURL

```bash
# Register
curl -X POST https://graphmind.your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePassword123!"}'

# Save token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Start recording
curl -X POST https://graphmind.your-domain.com/api/notes/start-recording \
  -H "Authorization: Bearer $TOKEN"

# List notes
curl https://graphmind.your-domain.com/api/notes?limit=20&offset=0 \
  -H "Authorization: Bearer $TOKEN"

# Get note
curl https://graphmind.your-domain.com/api/notes/note_1234567890abcdef \
  -H "Authorization: Bearer $TOKEN"

# Delete note
curl -X DELETE https://graphmind.your-domain.com/api/notes/note_1234567890abcdef \
  -H "Authorization: Bearer $TOKEN"
```

---

## Versioning

Current API version: **v1**

Breaking changes will be introduced in new versions:
- v1: Current (stable)
- v2: Future (TBD)

Version is included in base URL (future):
- `https://graphmind.your-domain.com/v1/api/...`
- `https://graphmind.your-domain.com/v2/api/...`

---

## Support

- **Documentation**: https://docs.graphmind.your-domain.com
- **Issues**: https://github.com/your-org/graphmind/issues
- **Email**: support@your-domain.com
- **Status**: https://status.graphmind.your-domain.com

---

Last Updated: 2024-01-01
API Version: 1.0.0
