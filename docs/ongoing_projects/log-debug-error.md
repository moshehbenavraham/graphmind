# Logging, Debugging, and Error Handling (Frontend)

Objectives:
- Make debugging thorough (not lightweight) so voice/query flows can be diagnosed quickly without reproducing locally.
- Provide clear toggles to enable/disable intensive logging per environment.

Environment toggles (frontend):
- `VITE_DEBUG=true|false` — enables standard debug logs (currently used in api/useAuth).
- `VITE_DEBUG_VERBOSE=true|false` — enables intensive logging: payload metrics, WS retries, audio chunk stats, timing spans.
- `VITE_DEBUG_REMOTE=true|false` — when true and verbose, send logs to `/api/logs` via beacon/fetch (use sparingly).

Target logging model:
- Structured entries: `{ ts, level, component, event, session_id, query_id, user_id?, trace_id, message, meta }`.
- Levels: `trace` (wire-level), `debug` (control flow), `info` (user-visible milestones), `warn`, `error`, `fatal`.
- Redaction: never log JWT, passwords, raw audio; log sizes/counts instead.
- Correlation: attach `session_id`/`query_id` everywhere; capture `x-request-id`/`cf-ray` from API responses and reuse in client logs.
- Transport: console for local; optional POST to `/api/logs` (with sampling and rate limits) for production traces; keep a “panic button” that forces verbose logs for the next N minutes when VITE_DEBUG_VERBOSE is true.

Instrumentation coverage (frontend):
- API client: request/response metadata (method, path, status, duration), auth failures, JSON parse errors; include `trace_id` from headers.
- WebSocket (query/notes): connect/disconnect, retries with jitter, per-message type, parse failures, backpressure, and server error payloads; record bytes sent/received and chunk indices when verbose flag set.
- Audio pipeline: MediaRecorder start/stop timings, mimeType, chunk sizes/counts, dropped/tiny chunks, duration per session; capture permission errors separately.
- Transcription → Cypher → Answer spans: timestamps per stage, errors surfaced to UI plus structured log with ids.
- Error boundary/global handlers: `window.onerror` and `unhandledrejection` should log and surface a toast/breadcrumb; include component stack when available.
- UX surfacing: user-friendly toasts/banners for API/WS/audio failures while keeping technical detail in logs.

Planned implementation steps:
1) Create `src/frontend/utils/logger.js` exporting `log(level, component, event, message, meta)` plus helpers (`debug/info/warn/error`) honoring `VITE_DEBUG`/`VITE_DEBUG_VERBOSE` and redaction rules.
2) Wire logger into `api.js`, `useAuth`, query/notes WS flows, audio recorders, and ErrorBoundary/global error handlers; include correlation ids and latency metrics.
3) Add optional remote sink (`/api/logs` endpoint) with sampling + backoff; ensure it is disabled unless `VITE_DEBUG_VERBOSE` is true.
4) Add UX hooks (toast/banner) for major failure classes: auth, network, WS reconnect exhausted, audio permission/encoder errors, transcription/graph failures.
5) Document operational runbook: how to enable verbose mode via env, how to tail logs (browser + Workers tail), and what IDs to provide when filing incidents.

Notes:
- Keep ASCII-only, avoid logging secrets or raw audio.
- Favor metrics + IDs over payloads; for audio, log `bytes` and `chunk_index`, not binary content.

Latest progress (this pass):
- Frontend logger now supports a panic window (persisted in `localStorage` under `gm_debug_verbose_until`) plus sampling/backoff for the remote sink. Optional env tuning: `VITE_DEBUG_REMOTE_SAMPLE_RATE` (default 0.25) and `VITE_DEBUG_REMOTE_MAX_PER_MIN` (default 60). `window.graphmindLogs.getLoggingState()` reports current flags and `window.graphmindLogs.enableVerboseLoggingWindow(15)` forces verbose for 15 minutes when verbose mode is allowed.
- Added POST `/api/logs` endpoint with global rate limit (120/min) and server-side redaction/truncation; accepts an array or `{ entries: [] }`, trims to 50 entries, and writes structured console records with client IP + received timestamp.
- QueryPage logging now attaches session context, tracks audio capture metrics (chunk counts/bytes/dropped/tiny, duration), records startup timing, and surfaces clearer microphone errors.

Runbook updates:
- Enable verbose+remote: set `VITE_DEBUG_VERBOSE=true`, `VITE_DEBUG_REMOTE=true`, and optionally tune sampling via `VITE_DEBUG_REMOTE_SAMPLE_RATE`/`VITE_DEBUG_REMOTE_MAX_PER_MIN`. Confirm flags in the browser console with `window.graphmindLogs.getLoggingState()`.
- Panic button: for short-term tracing in production builds that include verbose logging, call `window.graphmindLogs.enableVerboseLoggingWindow(<minutes>)` to force verbose logging without redeploying; the toggle auto-expires based on stored timestamp.
- Remote sink handling: client transport is sampled and rate-limited; server rejects non-JSON or empty payloads and redacts sensitive keys. Keep payloads minimal (IDs, timings, byte counts) to avoid log bloat.
- `/api/logs` contract: POST either an array of entries or `{ "entries": [...] }`. Up to 50 records accepted per request; payload is globally rate limited (120/min). Entry shape mirrors the structured logging model with `meta` automatically redacted/truncated server-side. Example:
  ```json
  [
    {
      "ts": "2025-01-01T00:00:00.000Z",
      "level": "info",
      "component": "QueryPage",
      "event": "ws.open",
      "message": "WebSocket connected",
      "session_id": "sess_123",
      "query_id": "q_123",
      "trace_id": "abcd",
      "meta": { "duration_ms": 250 }
    }
  ]
  ```
