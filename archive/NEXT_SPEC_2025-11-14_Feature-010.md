# Next Spec: Text-to-Speech Responses

**Phase**: Phase 3 - Voice Query System
**Priority**: P1 (Next to Build)
**Estimated Context**: ~18,000 tokens
**Dependencies**: Feature 008 (Voice Query Input), Feature 009 (Answer Generation)
**Status**: Ready to Implement

---

## What We're Building

Feature 010 adds the final piece of the voice query loop: converting text answers into natural speech using Deepgram Aura TTS and streaming audio responses back to users via WebSocket. This completes the full voice-first experience for GraphMind.

## Why This Next

**Logical Progression:**
- Dependency on: Feature 008 (query input), Feature 009 (answer generation) - BOTH COMPLETE
- Completes: The full voice query loop (speak question → get spoken answer)
- Enables: Feature 011 (Conversation Context) to have complete voice conversations
- Phase requirement: Phase 3 core functionality (Voice Query System)

**Current State:**
- Users can speak questions (Feature 008 ✅)
- System generates text answers (Feature 009 ✅)
- Missing: Speaking answers back (Feature 010)

**Impact:**
- Without TTS: Users read text answers (incomplete voice-first experience)
- With TTS: True hands-free voice assistant (full GraphMind vision)

## Scope (Single Context Window)

**Included**:
- Deepgram Aura TTS integration (Aura-1 or Aura-2 model)
- Audio streaming via WebSocket (chunked delivery)
- QuerySessionManager integration (new `streamAudioResponse` method)
- Audio playback controls (play, pause, stop)
- Text-audio synchronization (highlight text as it's spoken)
- Audio caching in KV (optional, for repeat queries)
- Error handling and fallback to text-only

**Explicitly Excluded** (for later specs):
- Voice customization (speed, pitch, voice selection) - Phase 5
- Audio recording/download - Phase 5
- Multi-language TTS - Phase 5
- SSML markup for advanced speech control - Phase 5
- Conversation interruption (barge-in) - Feature 011

**Estimated Tokens**: ~18,000 tokens

---

## User Stories (for this spec)

### Story 1: Users Hear Spoken Answers (P1)
As a user asking questions via voice, I want to hear the answer spoken back to me naturally so I can stay hands-free and focused on the conversation.

**Acceptance Criteria**:
- [ ] Answer text converted to speech using Deepgram Aura TTS
- [ ] Audio starts playing within 1 second of answer generation
- [ ] Voice sounds natural (not robotic)
- [ ] Audio quality is clear and understandable
- [ ] Audio streams progressively (starts before full generation)

### Story 2: Control Audio Playback (P1)
As a user listening to a response, I want basic playback controls so I can pause, resume, or stop the audio as needed.

**Acceptance Criteria**:
- [ ] Pause button stops audio playback
- [ ] Resume button continues from pause point
- [ ] Stop button ends playback and resets
- [ ] Controls respond immediately (<100ms)
- [ ] Visual feedback for playback state

### Story 3: See Text While Hearing Audio (P2)
As a user receiving an answer, I want to see the text displayed while the audio plays so I can read along or refer back to specific details.

**Acceptance Criteria**:
- [ ] Answer text displayed before audio starts
- [ ] Text remains visible during and after playback
- [ ] Optional: Text highlights in sync with audio (word-level or sentence-level)
- [ ] Scrollable if answer is long

---

## Technical Approach

### Cloudflare Components

**Workers AI**:
- Model: `@cf/deepgram/aura-1` (primary) or `@cf/deepgram/aura-2` (higher quality)
- Input: Text answer from Feature 009
- Output: Audio stream (WebM/Opus format)

**Durable Objects**:
- `QuerySessionManager` - Add `streamAudioResponse(answer)` method
- Manages TTS request and audio streaming state

**KV**:
- Cache audio for repeat queries: `audio_cache:{user_id}:{answer_hash}`
- TTL: 1 hour (same as answer cache)
- Reduces TTS API calls and latency

**WebSocket**:
- New event: `audio_chunk` (base64-encoded audio data)
- New event: `audio_complete` (playback finished)
- New event: `audio_error` (TTS failure)

### Audio Streaming Flow

```
Feature 009 generates text answer
    ↓
QuerySessionManager.streamAudioResponse(answer)
    ↓
Check KV cache for existing audio (hash answer text)
    ↓
[Cache miss] → Call Workers AI @cf/deepgram/aura-1
    ↓
Receive audio stream (chunked)
    ↓
Stream chunks via WebSocket (base64 audio_chunk events)
    ↓
Cache complete audio in KV (for future queries)
    ↓
Send audio_complete event
```

### Frontend Integration

**New Components** (to be created in frontend/):
- `AudioPlayer.jsx` - Audio playback UI with controls
- `AudioWaveform.jsx` - Visual audio indicator (optional)

**Modifications**:
- `VoiceQueryApp.jsx` - Integrate AudioPlayer component
- `QueryResults.jsx` - Display text alongside audio playback

**Audio Playback**:
- Receive `audio_chunk` WebSocket events
- Decode base64 → ArrayBuffer → Web Audio API
- Play audio progressively (streaming playback)
- Update UI for playback state (playing/paused/stopped)

---

## Implementation Steps

### 1. Backend Setup (QuerySessionManager)
- Add `streamAudioResponse(answer, userId)` method to QuerySessionManager
- Integrate Workers AI binding (`env.AI`) for TTS
- Implement audio caching in KV (get/set with answer hash)
- Add error handling for TTS failures (fallback to text-only)
- Emit WebSocket events: `audio_chunk`, `audio_complete`, `audio_error`

### 2. Audio Streaming Logic
- Call Deepgram Aura TTS model with answer text
- Receive audio stream (ReadableStream)
- Chunk audio into ~4KB pieces (optimal for WebSocket)
- Base64 encode each chunk
- Send via WebSocket with sequence numbers

### 3. Frontend Audio Player
- Create `AudioPlayer` component (React)
- Handle `audio_chunk` events → decode base64 → queue audio
- Use Web Audio API for playback
- Implement play/pause/stop controls
- Add loading and error states
- Synchronize text display with audio (optional highlighting)

### 4. Configuration & Environment
- Add `TTS_MODEL` env var to wrangler.toml (`aura-1` or `aura-2`)
- Add `TTS_VOICE` env var (default: `asteria` for Aura-1)
- Add `AUDIO_CACHE_ENABLED` boolean flag
- Document in .env.example

### 5. Testing
- Unit tests for `streamAudioResponse` method
- Integration test: answer generation → TTS → audio chunks
- Frontend test: audio playback with controls
- Cache test: verify audio caching and retrieval
- Error test: TTS failure → text-only fallback

---

## Success Criteria

**Performance**:
- [ ] Audio playback starts <1 second after answer generation (p95)
- [ ] No audio stuttering or gaps during playback
- [ ] Cache hit rate >60% for repeat queries (after warm-up)
- [ ] TTS latency <2 seconds for 2-3 sentence answers

**Quality**:
- [ ] Voice quality rated 4/5+ by users (natural, clear)
- [ ] Audio volume consistent across answers
- [ ] No audio artifacts (clicks, pops, distortion)

**Functionality**:
- [ ] All playback controls work (play/pause/stop)
- [ ] Text displayed correctly with audio
- [ ] Errors handled gracefully (fallback to text)
- [ ] Works across browsers (Chrome, Safari, Firefox)

**Integration**:
- [ ] Seamless transition from Feature 009 (answer generation) to Feature 010 (TTS)
- [ ] WebSocket events properly sequenced
- [ ] No memory leaks during audio playback
- [ ] Mobile-friendly audio playback (iOS, Android)

---

## Database Schema (D1)

No new tables required. Optionally add to `voice_queries` table:

```sql
-- Optional: Track TTS usage and audio metadata
ALTER TABLE voice_queries ADD COLUMN audio_r2_key TEXT;
ALTER TABLE voice_queries ADD COLUMN tts_latency_ms INTEGER;
ALTER TABLE voice_queries ADD COLUMN audio_cached BOOLEAN DEFAULT 0;
```

**Note**: Audio R2 storage is optional (users may want to download/replay answers later). For MVP, in-memory streaming is sufficient.

---

## Environment Variables

Add to `wrangler.toml`:

```toml
[vars]
# ... existing vars ...

# Text-to-Speech Configuration (Feature 010)
TTS_MODEL = "@cf/deepgram/aura-1"  # or "aura-2" for higher quality
TTS_VOICE = "asteria"              # Aura-1 voice (natural, friendly)
AUDIO_CACHE_ENABLED = "true"
AUDIO_CACHE_TTL = "3600"           # 1 hour (same as answer cache)
```

Add to `.env.example`:

```bash
# Text-to-Speech (Feature 010)
TTS_MODEL="@cf/deepgram/aura-1"
TTS_VOICE="asteria"
AUDIO_CACHE_ENABLED="true"
AUDIO_CACHE_TTL="3600"
```

---

## API/WebSocket Events

### Server → Client (WebSocket)

**audio_chunk**:
```json
{
  "type": "audio_chunk",
  "data": "base64_encoded_audio_data",
  "sequence": 1,
  "total_chunks": 10
}
```

**audio_complete**:
```json
{
  "type": "audio_complete",
  "duration_ms": 3500,
  "cached": false
}
```

**audio_error**:
```json
{
  "type": "audio_error",
  "error": "TTS service unavailable",
  "fallback": "text_only"
}
```

### Client → Server (WebSocket)

**audio_control**:
```json
{
  "type": "audio_control",
  "action": "pause" | "resume" | "stop"
}
```

---

## Dependencies

**Internal**:
- ✅ Feature 008 (Voice Query Input) - COMPLETE
- ✅ Feature 009 (Answer Generation) - COMPLETE
- ✅ QuerySessionManager Durable Object - EXISTS
- ✅ KV namespace binding - CONFIGURED

**External**:
- Workers AI: `@cf/deepgram/aura-1` or `aura-2` (beta, free during beta)
- Web Audio API (browser support: Chrome 34+, Safari 14.1+, Firefox 25+)

**Blockers**: None - all dependencies satisfied

---

## Next After This

Once Feature 010 (TTS) is complete, the next logical steps will be:

1. **Feature 011: Conversation Context Management** (Phase 3)
   - Multi-turn conversations with context retention
   - "What else?" and "Tell me more" follow-ups
   - Session context management

2. **Deploy Features 008, 009, 010 together** (Operational)
   - Apply D1 migrations (0005_voice_queries.sql)
   - Deploy to production with `npx wrangler deploy`
   - Run smoke tests on voice query flow
   - Monitor performance and errors

3. **Phase 4: Polish & Features** (After Phase 3 complete)
   - Graph visualization (HIGH PRIORITY)
   - Full-text search
   - Manual entity management

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| TTS latency >2s | Medium | Low | Use chunked streaming, cache audio, optimize prompt |
| Audio playback issues (Safari) | High | Medium | Test extensively on iOS, use standard Web Audio API |
| Voice quality poor | Medium | Low | Use Aura-2 if Aura-1 insufficient, test with users |
| WebSocket audio buffering | Medium | Low | Implement proper queuing, handle backpressure |
| TTS API rate limits | High | Low | Cache aggressively, implement request queuing |

---

## References

- **PRD Phase**: [Phase 3 - Voice Query System](phases/phase-3-voice-query.md)
- **Related Specs**:
  - [Feature 008 - Voice Query Input](../../specs/008-voice-query-input)
  - [Feature 009 - Answer Generation](../../specs/009-answer-generation)
- **Technical Docs**:
  - [Deepgram Aura TTS Models](https://developers.deepgram.com/docs/tts-models)
  - [Workers AI Documentation](https://developers.cloudflare.com/workers-ai/)
  - [Web Audio API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

**Ready to implement?** Run `/spec "Feature 010: Text-to-Speech Responses"` to create the detailed specification and begin implementation.
