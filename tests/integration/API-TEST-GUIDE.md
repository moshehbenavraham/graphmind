# API Endpoint Testing Guide

## Feature 005: Entity Extraction API

This guide provides manual testing instructions for the 4 entity extraction API endpoints.

---

## Prerequisites

1. **Start local dev server:**
   ```bash
   npm run dev
   ```

2. **Get JWT token** (from Feature 002 auth system)
   ```bash
   # Login and get token
   curl -X POST http://localhost:8787/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"testpass123"}'
   ```

3. **Export token for testing:**
   ```bash
   export JWT_TOKEN="your-jwt-token-here"
   ```

---

## Endpoint 1: Manual Extraction Trigger

**Endpoint:** `POST /api/notes/:note_id/extract-entities`

**Purpose:** Manually trigger entity extraction for a specific note

**Rate Limit:** 10 requests/minute per user

**Test:**
```bash
curl -X POST http://localhost:8787/api/notes/note_abc123/extract-entities \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "note_id": "note_abc123",
    "extraction_status": "pending",
    "job_enqueued_at": "2025-11-11T17:30:00Z",
    "estimated_completion": "2025-11-11T17:30:03Z"
  }
}
```

**Error Cases:**
- `401` - Missing or invalid JWT token
- `404` - Note not found
- `409` - Extraction already in progress
- `429` - Rate limit exceeded (10/min)

---

## Endpoint 2: View Extracted Entities

**Endpoint:** `GET /api/notes/:note_id/entities`

**Purpose:** Retrieve entities extracted from a specific voice note

**Rate Limit:** 60 requests/minute per user

**Test:**
```bash
curl http://localhost:8787/api/notes/note_abc123/entities \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "note_id": "note_abc123",
    "extraction_status": "completed",
    "extraction_completed_at": "2025-11-11T17:30:02Z",
    "entities": [
      {
        "type": "Person",
        "name": "Sarah Johnson",
        "canonical_name": "Sarah Johnson",
        "confidence": 0.92,
        "properties": {
          "email": "sarah.j@example.com",
          "role": "Project Manager"
        },
        "aliases": ["Sarah", "Sarah J"]
      },
      {
        "type": "Project",
        "name": "FastAPI Migration",
        "canonical_name": "FastAPI Migration Project",
        "confidence": 0.88,
        "properties": {
          "description": "Migrating REST API from Flask to FastAPI",
          "status": "in_progress",
          "technologies": ["Python", "FastAPI", "Flask"]
        }
      }
    ],
    "extraction_metadata": {
      "model": "llama-3.1-8b-instruct",
      "timestamp": "2025-11-11T17:30:02Z",
      "processing_time_ms": 2341,
      "entities_filtered": 2
    }
  }
}
```

**Error Cases:**
- `401` - Missing or invalid JWT token
- `403` - User doesn't own this note
- `404` - Note not found

---

## Endpoint 3: Batch Extraction

**Endpoint:** `POST /api/entities/extract-batch`

**Purpose:** Trigger entity extraction for multiple notes at once

**Rate Limit:** 5 requests/hour per user

**Test:**
```bash
curl -X POST http://localhost:8787/api/entities/extract-batch \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "note_ids": [
      "note_abc123",
      "note_def456",
      "note_ghi789"
    ]
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "total_notes": 3,
    "jobs_enqueued": 3,
    "enqueued_at": "2025-11-11T17:30:00Z",
    "estimated_completion": "2025-11-11T17:30:09Z",
    "note_ids": [
      "note_abc123",
      "note_def456",
      "note_ghi789"
    ]
  }
}
```

**Error Cases:**
- `400` - Invalid request (missing note_ids, empty array, >10 notes)
- `401` - Missing or invalid JWT token
- `429` - Rate limit exceeded (5/hour)

---

## Endpoint 4: Entity Cache Lookup

**Endpoint:** `GET /api/entities/cache/:entity_key`

**Purpose:** Check if an entity has been seen before (fuzzy match)

**Rate Limit:** 120 requests/minute per user

**Test:**
```bash
curl http://localhost:8787/api/entities/cache/sarah-johnson \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "entity_key": "sarah-johnson",
    "canonical_name": "Sarah Johnson",
    "entity_type": "Person",
    "properties": {
      "email": "sarah.j@example.com",
      "role": "Project Manager"
    },
    "aliases": ["Sarah", "Sarah J", "SJ"],
    "mention_count": 5,
    "first_mentioned_note_id": "note_abc123",
    "last_mentioned_note_id": "note_xyz789",
    "created_at": "2025-11-10T10:00:00Z",
    "updated_at": "2025-11-11T17:30:02Z"
  }
}
```

**Error Cases:**
- `401` - Missing or invalid JWT token
- `404` - Entity not found in cache

---

## Automated Testing

Run the automated test script:

```bash
# Export JWT token first
export JWT_TOKEN="your-jwt-token"

# Run test script
bash tests/integration/test-api-endpoints.sh
```

The script tests:
- ✓ All 4 endpoints with valid requests
- ✓ Authentication (401 without token)
- ✓ Rate limiting (429 after limit exceeded)
- ✓ Response format validation

---

## Performance Validation

### Latency Requirements

- **Manual extraction (POST):** <200ms (just enqueues, doesn't wait for extraction)
- **Entity extraction (background):** <3 seconds (p95)
- **Entity lookup (GET):** <100ms (p95)
- **Cache lookup (GET):** <10ms (p95) on cache hit

### Testing Latency

```bash
# Test extraction latency
time curl -X POST http://localhost:8787/api/notes/note_test/extract-entities \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"

# Should complete in <200ms

# Test entity lookup latency
time curl http://localhost:8787/api/notes/note_test/entities \
  -H "Authorization: Bearer $JWT_TOKEN"

# Should complete in <100ms
```

---

## Success Criteria

All tests should verify:

- [x] **Authentication Required:** All endpoints return 401 without valid JWT
- [x] **Rate Limiting Enforced:** Endpoints return 429 after exceeding limits
- [x] **Response Format:** All responses follow `{success, data, error}` structure
- [x] **User Isolation:** Users can only access their own notes/entities
- [x] **Status Codes:** Correct HTTP status codes for all scenarios
- [x] **Latency Targets:** API responses within performance requirements

---

## Troubleshooting

### Issue: 401 Unauthorized

**Solution:** Ensure JWT token is valid and not expired
```bash
# Re-login to get fresh token
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

### Issue: 404 Not Found

**Solution:** Verify note exists in D1 database
```bash
npx wrangler d1 execute graphmind-db --local \
  --command "SELECT note_id, transcript FROM voice_notes LIMIT 5;"
```

### Issue: 500 Internal Server Error

**Solution:** Check wrangler dev logs for errors
- Workers AI binding configured?
- D1 migrations applied?
- Queue bindings configured?

---

## Next Steps

After manual testing:

1. Run automated test suite: `npm test`
2. Measure extraction accuracy: See `tests/accuracy/measure-f1-score.js`
3. Test production deployment: Follow Phase 9 tasks (T097-T108)
