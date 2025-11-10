# API Specifications

**Document Type:** Technical Specification
**Status:** Approved
**Base URL:** `https://graphmind.example.com/api`
**Version:** v1

---

## Overview

GraphMind exposes a RESTful API with WebSocket support for real-time voice operations. All endpoints (except authentication) require JWT authentication via the `Authorization` header.

**Authentication:**
```
Authorization: Bearer <jwt_token>
```

**Response Format:** JSON
**Date Format:** ISO 8601 (e.g., `2025-11-10T14:30:00Z`)

---

## 1. Authentication Endpoints

### POST /api/auth/register

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "user_id": "usr_abc123",
  "message": "Verification email sent to user@example.com"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid email or weak password
- `409 Conflict`: Email already registered
- `500 Internal Server Error`: Server error

---

### POST /api/auth/login

Authenticate user and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "remember_me": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": "usr_abc123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `429 Too Many Requests`: Account temporarily locked (too many failed attempts)

---

### POST /api/auth/logout

Invalidate current session token.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### POST /api/auth/reset-password

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset email sent (if account exists)"
}
```

---

### POST /api/auth/reset-password/confirm

Confirm password reset with token.

**Request:**
```json
{
  "token": "reset_token_abc123",
  "new_password": "NewSecureP@ss456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

---

## 2. Voice Note Endpoints

### POST /api/notes/start-recording

Start a new voice recording session.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "session_id": "sess_xyz789",
  "websocket_url": "wss://graphmind.example.com/ws/notes/sess_xyz789",
  "expires_at": 1699626000
}
```

---

### WebSocket: /ws/notes/:session_id

Real-time voice recording and transcription.

**Client -> Server Messages:**

**Audio Chunk:**
```json
{
  "type": "audio_chunk",
  "data": "base64_encoded_opus_audio",
  "sequence": 1,
  "timestamp": 1699622400
}
```

**Stop Recording:**
```json
{
  "type": "stop_recording"
}
```

**Cancel Recording:**
```json
{
  "type": "cancel_recording"
}
```

**Server -> Client Messages:**

**Transcript Partial:**
```json
{
  "type": "transcript_partial",
  "text": "I met with Sarah to discuss...",
  "confidence": 0.92,
  "is_final": false
}
```

**Transcript Final:**
```json
{
  "type": "transcript_final",
  "text": "I met with Sarah to discuss the FastAPI migration project.",
  "confidence": 0.95
}
```

**Entities Extracted:**
```json
{
  "type": "entities_extracted",
  "entities": [
    {
      "type": "Person",
      "name": "Sarah",
      "properties": {},
      "confidence": 0.90
    },
    {
      "type": "Project",
      "name": "FastAPI migration project",
      "properties": {
        "technology": "Python"
      },
      "confidence": 0.88
    }
  ],
  "relationships": [
    {
      "from": "Meeting",
      "to": "Sarah",
      "type": "WITH",
      "confidence": 0.95
    }
  ],
  "requires_confirmation": false
}
```

**Note Created:**
```json
{
  "type": "note_created",
  "note_id": "note_abc123",
  "transcript": "I met with Sarah to discuss the FastAPI migration project.",
  "entities_count": 2,
  "created_at": "2025-11-10T14:30:00Z"
}
```

**Error:**
```json
{
  "type": "error",
  "error_code": "TRANSCRIPTION_FAILED",
  "message": "Failed to transcribe audio. Please try again."
}
```

---

### GET /api/notes

Retrieve user's voice notes.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `from_date` (optional): ISO 8601 date
- `to_date` (optional): ISO 8601 date
- `status` (optional): `pending`, `completed`, `failed`

**Response (200 OK):**
```json
{
  "notes": [
    {
      "note_id": "note_abc123",
      "transcript": "I met with Sarah to discuss the FastAPI migration project.",
      "entities": ["Sarah", "FastAPI migration project"],
      "created_at": "2025-11-10T14:30:00Z",
      "audio_url": "https://r2.example.com/user/audio/note_abc123.opus",
      "confidence_score": 0.90
    }
  ],
  "total": 145,
  "page": 1,
  "pages": 8
}
```

---

### GET /api/notes/:note_id

Retrieve a specific note with full details.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "note_id": "note_abc123",
  "transcript": "I met with Sarah to discuss the FastAPI migration project.",
  "entities_extracted": [
    {
      "type": "Person",
      "name": "Sarah",
      "properties": {},
      "confidence": 0.90
    }
  ],
  "relationships_created": [
    {
      "from": "Meeting",
      "to": "Sarah",
      "type": "WITH"
    }
  ],
  "audio_url": "https://r2.example.com/user/audio/note_abc123.opus",
  "audio_duration_seconds": 45,
  "confidence_score": 0.90,
  "processing_status": "completed",
  "created_at": "2025-11-10T14:30:00Z"
}
```

---

### DELETE /api/notes/:note_id

Delete a voice note.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Note deleted successfully",
  "entities_updated": 2
}
```

---

## 3. Voice Query Endpoints

### POST /api/query/start

Start a new voice query session.

**Headers:**
```
Authorization: Bearer <token>
```

**Request (optional):**
```json
{
  "session_id": "sess_prev123" // for follow-up questions
}
```

**Response (200 OK):**
```json
{
  "query_session_id": "qsess_xyz789",
  "websocket_url": "wss://graphmind.example.com/ws/query/qsess_xyz789",
  "expires_at": 1699626000
}
```

---

### WebSocket: /ws/query/:session_id

Real-time voice querying.

**Client -> Server Messages:**

**Audio Chunk:**
```json
{
  "type": "audio_chunk",
  "data": "base64_encoded_audio"
}
```

**Stop Recording:**
```json
{
  "type": "stop_recording"
}
```

**Server -> Client Messages:**

**Question Transcribed:**
```json
{
  "type": "question_transcribed",
  "question": "What did I discuss with Sarah last week?"
}
```

**Cypher Generated:**
```json
{
  "type": "cypher_generated",
  "cypher": "MATCH (m:Meeting)-[:WITH]->(p:Person {name: 'Sarah'}) WHERE m.date >= date() - duration('P7D') RETURN m",
  "explanation": "Finding meetings with Sarah in the past 7 days"
}
```

**Results Retrieved:**
```json
{
  "type": "results_retrieved",
  "results": [
    {
      "meeting": {
        "date": "2025-11-03",
        "topic": "FastAPI Migration",
        "duration_minutes": 45
      }
    }
  ],
  "result_count": 1
}
```

**Answer Generated:**
```json
{
  "type": "answer_generated",
  "answer": "Last week on November 3rd, you met with Sarah to discuss the FastAPI Migration project. The meeting lasted 45 minutes.",
  "sources": ["note_abc123", "note_def456"]
}
```

**Audio Response:**
```json
{
  "type": "audio_response",
  "audio_chunk": "base64_encoded_audio_stream"
}
```

---

### GET /api/query/history

Get user's query history.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200 OK):**
```json
{
  "queries": [
    {
      "query_id": "query_abc123",
      "question": "What did I discuss with Sarah last week?",
      "answer": "Last week on November 3rd...",
      "created_at": "2025-11-10T15:00:00Z",
      "user_rating": 5
    }
  ],
  "total": 87,
  "page": 1
}
```

---

### POST /api/query/:query_id/rate

Rate the quality of a query answer.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "rating": 5 // 1-5 stars
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Rating recorded"
}
```

---

## 4. Knowledge Graph Endpoints

### GET /api/graph

Get user's full knowledge graph.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `entity_type` (optional): Filter by type (e.g., `Person`, `Project`)
- `limit` (optional): Max nodes to return (default: 1000)

**Response (200 OK):**
```json
{
  "nodes": [
    {
      "id": "person_abc123",
      "type": "Person",
      "properties": {
        "name": "Sarah Johnson",
        "email": "sarah@example.com",
        "mention_count": 5
      }
    }
  ],
  "edges": [
    {
      "from": "meeting_xyz789",
      "to": "person_abc123",
      "type": "WITH"
    }
  ],
  "stats": {
    "total_nodes": 247,
    "total_edges": 412,
    "node_types": {
      "Person": 45,
      "Project": 12,
      "Meeting": 67
    }
  }
}
```

---

### GET /api/graph/entity/:entity_id

Get details for a specific entity.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "entity": {
    "id": "person_abc123",
    "type": "Person",
    "properties": {
      "name": "Sarah Johnson",
      "email": "sarah@example.com",
      "first_mentioned": "2025-10-15T10:00:00Z",
      "mention_count": 5
    }
  },
  "relationships": [
    {
      "related_entity": {
        "id": "project_def456",
        "type": "Project",
        "name": "FastAPI Migration"
      },
      "relationship_type": "WORKS_ON",
      "direction": "outgoing"
    }
  ],
  "mentioned_in_notes": ["note_abc123", "note_def456", "note_ghi789"]
}
```

---

### POST /api/graph/entity

Create a new entity manually.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "type": "Person",
  "properties": {
    "name": "Alice Smith",
    "email": "alice@example.com",
    "role": "Designer"
  }
}
```

**Response (201 Created):**
```json
{
  "entity_id": "person_new123",
  "created": true
}
```

---

### PUT /api/graph/entity/:entity_id

Update entity properties.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "properties": {
    "email": "alice.smith@example.com",
    "phone": "+1-555-1234"
  }
}
```

**Response (200 OK):**
```json
{
  "entity_id": "person_new123",
  "updated": true
}
```

---

### DELETE /api/graph/entity/:entity_id

Delete an entity and its relationships.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "deleted": true,
  "relationships_removed": 7
}
```

---

### POST /api/graph/entity/:id/merge

Merge duplicate entities.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "target_entity_id": "person_existing456"
}
```

**Response (200 OK):**
```json
{
  "merged_entity_id": "person_existing456",
  "relationships_preserved": 12
}
```

---

## 5. Search Endpoints

### GET /api/search

Full-text search across notes and entities.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `q` (required): Search query
- `entity_type` (optional): Filter by entity type
- `date_from` (optional): ISO 8601 date
- `date_to` (optional): ISO 8601 date
- `limit` (optional): Max results (default: 20)

**Response (200 OK):**
```json
{
  "notes": [
    {
      "note_id": "note_abc123",
      "transcript": "...Sarah...FastAPI...",
      "highlight": "...met with <mark>Sarah</mark> about the <mark>FastAPI</mark> project...",
      "score": 0.95
    }
  ],
  "entities": [
    {
      "entity_id": "person_abc123",
      "type": "Person",
      "name": "Sarah Johnson",
      "score": 0.88
    }
  ],
  "total": 12
}
```

---

## 6. Ingestion Endpoints

### POST /api/ingest/url

Ingest content from a URL.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "url": "https://example.com/article"
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "job_abc123",
  "status": "processing",
  "estimated_time_seconds": 10
}
```

---

### POST /api/ingest/file

Upload and process a file.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request:**
```
file: <binary_file_data>
```

**Response (202 Accepted):**
```json
{
  "job_id": "job_def456",
  "status": "processing",
  "file_id": "file_ghi789"
}
```

---

### POST /api/ingest/text

Process pasted text.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "text": "Today I learned about graph databases...",
  "source": "manual_entry"
}
```

**Response (200 OK):**
```json
{
  "entities_extracted": 3,
  "relationships_created": 2,
  "processing_time_ms": 1250
}
```

---

### GET /api/ingest/job/:job_id

Check ingestion job status.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "job_id": "job_abc123",
  "status": "completed", // or "processing", "failed"
  "progress": 100,
  "entities_extracted": 15,
  "relationships_created": 23,
  "errors": []
}
```

---

## 7. User Profile Endpoints

### GET /api/user/profile

Get user profile and stats.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "user_id": "usr_abc123",
  "email": "user@example.com",
  "name": "John Doe",
  "created_at": "2025-10-01T10:00:00Z",
  "stats": {
    "notes_count": 145,
    "queries_count": 87,
    "entities_count": 247,
    "storage_used_mb": 125
  }
}
```

---

### PUT /api/user/profile

Update user profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "John A. Doe",
  "email": "john.doe@example.com" // triggers verification
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "email_verification_sent": true
}
```

---

### POST /api/user/change-password

Change user password.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "current_password": "OldP@ss123",
  "new_password": "NewSecureP@ss456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

---

### GET /api/user/settings

Get user settings.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "audio_storage_enabled": true,
  "tts_voice_id": "aura-2",
  "theme": "dark",
  "language": "en"
}
```

---

### PUT /api/user/settings

Update user settings.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "audio_storage_enabled": false,
  "theme": "light"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // optional
  }
}
```

**Common Error Codes:**
- `INVALID_INPUT`: Validation failed
- `UNAUTHORIZED`: Authentication required or invalid token
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVER_ERROR`: Internal server error

---

## Rate Limiting

**Limits:**
- Authentication: 5 requests/15 min per IP
- API calls: 100 requests/min per user
- WebSocket connections: 10 concurrent per user

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1699626000
```

---

## Related Documents

- [Database Schemas](./database-schemas.md)
- [REQUIREMENTS-PRD.md](../REQUIREMENTS-PRD.md) - See Section 2.3 for data flows

---

**Last Updated:** 2025-11-10
**API Version:** v1
**Status:** Approved
