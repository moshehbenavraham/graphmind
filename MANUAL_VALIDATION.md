● Manual Validation Tests for Audio Pipeline Fix

  Prerequisites

  1. Frontend deployed/running locally (npm run dev in frontend
  directory)
  2. Backend deployed/running (Cloudflare Workers)
  3. Browser with microphone access (Chrome/Firefox recommended)

  ---
  T080-T082: Setup and Record

  1. Open fresh browser session (incognito recommended to avoid
  cache)
  2. Navigate to Query page: http://localhost:5173/query (or
  deployed URL)
  3. Open DevTools (F12) → Console tab
  4. Click "Start Recording" button
  5. Allow microphone when prompted
  6. Speak a test question (e.g., "What projects am I working
  on?")
  7. Click "Stop Recording"

  ---
  T083: Verify Audio Chunks Sent

  In browser console, look for:
  [useAudioRecorder] capture.webm_setup WebM capture initialized
  [QueryPage] media.chunk.send Sending audio chunk { sequence: 
  0, bytes: ... }
  [QueryPage] media.chunk.send Sending audio chunk { sequence: 
  1, bytes: ... }
  [QueryPage] media.chunk.send Sending audio chunk { sequence: 
  2, bytes: ... }
  ...

  Expected: Multiple chunk logs (one every ~500ms while
  recording)
  Failure: Zero chunks or only one chunk at the end

  ---
  T084: Verify Transcript Generated

  In browser console, look for:
  [useQuerySession] ws.message Received message { type:
  'transcript_update' }
  [useQuerySession] ws.message Received message { type: 
  'transcript_final' }

  On screen: Your question should appear in the "Your Question"
  section

  Expected: Transcript text matching what you said
  Failure: Empty transcript or "No audio recorded" error

  ---
  T085: Verify Answer Returned

  In browser console, look for:
  [useQuerySession] ws.message Received message { type:
  'cypher_generated' }
  [useQuerySession] ws.message Received message { type: 
  'query_results' }
  [useQuerySession] ws.message Received message { type:
  'answer_generated' }

  On screen: Answer card should appear with response text

  Expected: Relevant answer based on your knowledge graph
  Failure: Error message or no answer card

  ---
  T086: Verify TTS (Optional - May Be Deferred)

  On screen: Audio player should appear below the answer

  Expected: Audio plays when you click play button
  Note: TTS issues (Problem 3) are separate and lower priority

  ---
  T087: Consistency Test

  Repeat the above 3 times with different questions:
  1. "What did I discuss in my last meeting?"
  2. "Who is [person name] related to?"
  3. "Tell me about [project name]"

  Expected: All 3 queries succeed with transcripts and answers

  ---
  Quick Checklist

  [ ] Chunks appear in console during recording (not just at
  stop)
  [ ] Multiple chunks sent (sequence: 0, 1, 2, ...)
  [ ] Transcript appears on screen
  [ ] Answer appears on screen
  [ ] No "No audio recorded" error
  [ ] Consistent across 3 different queries

  Once these pass, mark T080-T087 complete in
  specs/016-audio-pipeline-fix/tasks.md.