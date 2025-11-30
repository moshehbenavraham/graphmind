/**
 * Type definitions for Durable Objects
 *
 * @module durable-objects/types
 */

/**
 * Session metadata for query/voice sessions
 * @typedef {Object} SessionMetadata
 * @property {string|null} session_id - Session identifier
 * @property {string|null} query_id - Query identifier
 * @property {string|null} user_id - User identifier
 * @property {string|null} user_namespace - User namespace for graph isolation
 * @property {number|null} start_time - Session start timestamp
 */

/**
 * Performance metrics for tracking operation timing
 * @typedef {Object} PerformanceMetrics
 * @property {number|null} transcription_start - Transcription start timestamp
 * @property {number|null} transcription_end - Transcription end timestamp
 * @property {number|null} query_start - Query start timestamp
 * @property {number|null} query_end - Query end timestamp
 * @property {number|null} answer_start - Answer generation start timestamp
 * @property {number|null} answer_end - Answer generation end timestamp
 */

/**
 * Voice session metadata
 * @typedef {Object} VoiceSessionMetadata
 * @property {string|null} session_id - Session identifier
 * @property {string|null} note_id - Note identifier
 * @property {string|null} user_id - User identifier
 * @property {number|null} start_time - Session start timestamp
 */

/**
 * Audio stream handler result
 * @typedef {Object} AudioHandlerResult
 * @property {boolean} success - Whether operation succeeded
 * @property {boolean} [cached] - Whether result was cached
 * @property {number} [latencyMs] - Operation latency in milliseconds
 * @property {number} [totalChunks] - Total chunks processed
 * @property {string} [error] - Error message if failed
 */

/**
 * Query orchestrator result
 * @typedef {Object} QueryOrchestratorResult
 * @property {boolean} success - Whether query succeeded
 * @property {string} status - Query status
 * @property {number} responseTimeMs - Response time in milliseconds
 * @property {any} [data] - Query result data
 * @property {string} [error] - Error message if failed
 */

/**
 * WebSocket message types
 * @typedef {'audio_chunk' | 'recording_stopped' | 'ping' | 'recording_started' | 'transcript_chunk' | 'answer_chunk' | 'error' | 'answer_error'} WebSocketMessageType
 */

/**
 * Client WebSocket message
 * @typedef {Object} ClientMessage
 * @property {WebSocketMessageType} type - Message type
 * @property {string} [data] - Audio data (base64)
 * @property {number} [sequence] - Audio chunk sequence number
 * @property {string} [session_id] - Session ID
 * @property {string} [query_id] - Query ID
 */

/**
 * Server WebSocket message
 * @typedef {Object} ServerMessage
 * @property {string} type - Message type
 * @property {string} [session_id] - Session ID
 * @property {string} [query_id] - Query ID
 * @property {number} [timestamp] - Message timestamp
 * @property {string} [text] - Text content
 * @property {string} [error] - Error message
 * @property {string} [error_code] - Error code
 * @property {boolean} [retryable] - Whether error is retryable
 */

export {};
