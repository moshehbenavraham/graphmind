/**
 * VoiceSessionManager Durable Object
 *
 * Manages WebSocket connections for voice note recording sessions.
 * Each recording session gets a dedicated DO instance for:
 * - WebSocket connection management
 * - Audio chunk buffering and sequencing
 * - Real-time transcription via Workers AI
 * - Transcript accumulation and persistence
 *
 * Lifecycle:
 * 1. Created on /api/notes/start-recording
 * 2. Accepts WebSocket connection
 * 3. Processes audio chunks and streams transcripts
 * 4. Saves completed transcript to D1
 * 5. Hibernates after session completion
 *
 * @module durable-objects/VoiceSessionManager
 */

import { transcribeAudioChunk } from '../lib/audio/transcription.js';
import { validateAudioChunk, getValidationErrorMessage, isRecoverableValidationError } from '../lib/audio/validation.js';
import { getSession, updateSessionStatus } from '../lib/session/session-manager.js';
import { insertVoiceNote } from '../lib/db/voice-notes-queries.js';
import { createLogger } from '../utils/logger.js';

/**
 * Maximum session duration in milliseconds (10 minutes)
 * @const {number}
 */
const MAX_SESSION_DURATION = 10 * 60 * 1000;

/**
 * Warning threshold before timeout (1 minute before max duration)
 * @const {number}
 */
const TIMEOUT_WARNING_THRESHOLD = 9 * 60 * 1000;

/**
 * Generate a unique note ID
 * @returns {string} Note ID in format "note_" + UUID
 */
function generateNoteId() {
  return `note_${crypto.randomUUID()}`;
}

/**
 * Calculate word count from transcript text
 * @param {string} text - Transcript text
 * @returns {number} Word count
 */
function countWords(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  // Split by whitespace and filter out empty strings
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Sanitize transcript text for storage
 * @param {string} text - Raw transcript text
 * @returns {string} Sanitized text
 */
function sanitizeTranscript(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  // Remove potentially harmful characters while keeping punctuation
  return text
    .replace(/[^\w\s.,;:?!'-]/g, '')
    .trim()
    .substring(0, 50000); // Max 50k characters
}

/**
 * VoiceSessionManager Durable Object
 *
 * Manages a single voice recording session with WebSocket communication,
 * audio processing, and transcript persistence.
 */
export class VoiceSessionManager {
  /**
   * Constructor - Initialize Durable Object state
   * @param {DurableObjectState} state - Durable Object state
   * @param {Object} env - Environment bindings
   */
  constructor(state, env) {
    this.state = state;
    this.env = env;

    // WebSocket connection
    this.websocket = null;

    // Audio chunk buffer (for handling out-of-order delivery)
    this.audioBuffer = [];

    // Transcript accumulation
    this.transcript = '';
    this.partialTranscript = '';

    // Session metadata
    this.sessionMetadata = {
      session_id: null,
      user_id: null,
      start_time: null,
      last_chunk_time: null,
      chunk_count: 0,
      expected_sequence: 0
    };

    // Timeout tracking
    this.timeoutHandle = null;
    this.warningTimeoutHandle = null;

    // Session state
    this.sessionActive = false;

    // Logger (will be initialized with context in handleWebSocketUpgrade)
    this.logger = createLogger('VoiceSessionManager');
  }

  /**
   * Main fetch handler - handles HTTP requests and WebSocket upgrades
   * @param {Request} request - Incoming HTTP request
   * @returns {Promise<Response>} HTTP response
   */
  async fetch(request) {
    const url = new URL(request.url);

    try {
      // Handle WebSocket upgrade requests
      if (request.headers.get('Upgrade') === 'websocket') {
        return await this.handleWebSocketUpgrade(request);
      }

      // Handle status check requests
      if (url.pathname === '/status') {
        return new Response(JSON.stringify({
          active: this.sessionActive,
          session_id: this.sessionMetadata.session_id,
          chunk_count: this.sessionMetadata.chunk_count,
          transcript_length: this.transcript.length
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Unknown endpoint
      return new Response('Not Found', { status: 404 });

    } catch (error) {
      this.logger.error('Fetch handler error', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle WebSocket upgrade and connection setup
   * @param {Request} request - WebSocket upgrade request
   * @returns {Promise<Response>} WebSocket response
   */
  async handleWebSocketUpgrade(request) {
    const url = new URL(request.url);

    // Extract session_id from URL path
    const pathParts = url.pathname.split('/');
    const session_id = pathParts[pathParts.length - 1];

    // Extract JWT token from query param
    const token = url.searchParams.get('token');

    if (!session_id || !token) {
      return new Response('Missing session_id or token', { status: 400 });
    }

    try {
      // Validate session exists in KV
      const sessionMetadata = await getSession(this.env, session_id);
      if (!sessionMetadata) {
        this.logger.warn('Session not found or expired', { session_id });
        return new Response('Session not found or expired', { status: 404 });
      }

      // TODO: Validate JWT token (would need auth utilities)
      // For now, we'll trust the token was validated by the main worker

      // Create WebSocket pair
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      // Accept the WebSocket connection
      server.accept();

      // Store WebSocket and initialize session
      this.websocket = server;
      this.sessionMetadata.session_id = session_id;
      this.sessionMetadata.user_id = sessionMetadata.user_id;
      this.sessionMetadata.start_time = Date.now();
      this.sessionActive = true;

      // Initialize logger with session context
      this.logger = createLogger('VoiceSessionManager', {
        session_id,
        user_id: sessionMetadata.user_id
      });

      this.logger.info('WebSocket session started', {
        start_time: this.sessionMetadata.start_time
      });

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers();

      // Send session_started message
      this.sendMessage({
        type: 'session_started',
        session_id: session_id,
        status: 'recording'
      });

      // Set up session timeout
      this.setupSessionTimeout();

      // Return the client WebSocket in the response
      return new Response(null, {
        status: 101,
        webSocket: client
      });

    } catch (error) {
      this.logger.error('WebSocket upgrade failed', error);
      return new Response(JSON.stringify({
        error: 'WebSocket upgrade failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  setupWebSocketHandlers() {
    if (!this.websocket) {
      return;
    }

    // Handle incoming messages
    this.websocket.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        await this.handleWebSocketMessage(message);
      } catch (error) {
        this.logger.error('Message handling error', error);
        this.sendError('MESSAGE_PARSE_ERROR', 'Failed to parse message', false);
      }
    });

    // Handle WebSocket close
    this.websocket.addEventListener('close', async (event) => {
      this.logger.info('WebSocket closed', {
        code: event.code,
        reason: event.reason,
        clean_close: event.code === 1000
      });
      await this.cleanup();
    });

    // Handle WebSocket error
    this.websocket.addEventListener('error', async (event) => {
      this.logger.error('WebSocket error', {
        event_type: event.type
      });
      await this.cleanup();
    });
  }

  /**
   * Handle incoming WebSocket messages
   * @param {Object} message - Parsed WebSocket message
   */
  async handleWebSocketMessage(message) {
    if (!message || !message.type) {
      this.sendError('INVALID_MESSAGE', 'Message must have a type field', false);
      return;
    }

    switch (message.type) {
      case 'audio_chunk':
        await this.handleAudioChunk(message);
        break;

      case 'stop_recording':
        await this.handleStopRecording();
        break;

      case 'ping':
        this.sendMessage({ type: 'pong' });
        break;

      default:
        this.sendError('UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`, true);
    }
  }

  /**
   * Handle audio chunk message
   * @param {Object} message - Audio chunk message
   */
  async handleAudioChunk(message) {
    try {
      // Validate audio chunk
      const validationResult = validateAudioChunk(message, this.sessionMetadata.expected_sequence);

      if (!validationResult.valid) {
        const errorMessage = getValidationErrorMessage(validationResult);
        const recoverable = isRecoverableValidationError(validationResult);

        this.logger.warn('Audio chunk validation failed', {
          validation_error: errorMessage,
          recoverable,
          sequence: message.sequence,
          expected_sequence: this.sessionMetadata.expected_sequence
        });

        this.sendError('VALIDATION_FAILED', errorMessage, recoverable);

        // If recoverable, continue; otherwise return
        if (!recoverable) {
          return;
        }
      }

      // Update session metadata
      this.sessionMetadata.last_chunk_time = Date.now();
      this.sessionMetadata.chunk_count++;
      this.sessionMetadata.expected_sequence = message.sequence + 1;

      // Buffer the audio chunk
      this.audioBuffer.push({
        sequence: message.sequence,
        chunk: message.chunk,
        timestamp: message.timestamp
      });

      this.logger.debug('Audio chunk received', {
        sequence: message.sequence,
        chunk_count: this.sessionMetadata.chunk_count,
        buffer_size: this.audioBuffer.length
      });

      // Process the audio chunk (don't wait for completion - process in parallel)
      this.processAudioChunk(message.chunk, message.sequence)
        .catch(error => {
          this.logger.error('Audio processing error', {
            error_message: error.message,
            sequence: message.sequence
          });
          this.sendError('TRANSCRIPTION_FAILED', 'Failed to transcribe audio chunk', true);
        });

    } catch (error) {
      this.logger.error('Audio chunk handling error', error);
      this.sendError('AUDIO_CHUNK_ERROR', 'Failed to process audio chunk', true);
    }
  }

  /**
   * Process audio chunk through Workers AI transcription
   * @param {string} audioChunk - Base64 encoded audio data
   * @param {number} sequence - Sequence number
   */
  async processAudioChunk(audioChunk, sequence) {
    const timer = this.logger.startTimer('transcription');

    try {
      // Call transcription service
      const result = await transcribeAudioChunk(audioChunk, this.env, {
        language: 'en',
        smart_format: true,
        interim_results: true
      });

      // Log transcription latency
      const latency = this.logger.endTimer(timer, {
        sequence,
        is_final: result.is_final,
        text_length: result.text?.length || 0
      });

      // Accumulate transcript
      if (result.text && result.text.length > 0) {
        if (result.is_final) {
          // Final result - add to main transcript
          this.transcript += (this.transcript.length > 0 ? ' ' : '') + result.text;
          this.partialTranscript = '';

          this.logger.debug('Final transcript received', {
            sequence,
            text_length: result.text.length,
            confidence: result.confidence,
            total_transcript_length: this.transcript.length
          });
        } else {
          // Partial result - update partial transcript
          this.partialTranscript = result.text;

          this.logger.debug('Partial transcript received', {
            sequence,
            text_length: result.text.length
          });
        }

        // Send transcript partial back to client
        this.sendMessage({
          type: 'transcript_partial',
          text: result.text,
          is_final: result.is_final,
          confidence: result.confidence,
          sequence: sequence
        });
      }

      // Log warning if transcription latency is high
      if (latency > 2000) {
        this.logger.warn('High transcription latency detected', {
          latency_ms: latency,
          sequence,
          threshold_ms: 2000
        });
      }

    } catch (error) {
      this.logger.error('Transcription error', {
        error_message: error.message,
        sequence,
        duration_ms: timer.end()
      });
      // Error already sent to client in handleAudioChunk
      throw error;
    }
  }

  /**
   * Handle stop recording message
   */
  async handleStopRecording() {
    try {
      this.logger.info('Stop recording requested', {
        chunk_count: this.sessionMetadata.chunk_count,
        transcript_length: this.transcript.length
      });

      // Clear timeouts
      this.clearTimeouts();

      // Save the transcript
      const noteData = await this.saveTranscript();

      this.logger.info('Transcript saved successfully', {
        note_id: noteData.note_id,
        duration_seconds: noteData.duration_seconds,
        word_count: noteData.word_count
      });

      // Send transcript_complete message
      this.sendMessage({
        type: 'transcript_complete',
        note_id: noteData.note_id,
        transcript: noteData.transcript,
        duration_seconds: noteData.duration_seconds,
        word_count: noteData.word_count,
        created_at: noteData.created_at
      });

      // Update session status
      await updateSessionStatus(this.env, this.sessionMetadata.session_id, 'completed');

      // Close WebSocket gracefully
      this.websocket.close(1000, 'Recording completed');

      // Cleanup
      await this.cleanup();

    } catch (error) {
      this.logger.error('Stop recording error', error);
      this.sendError('SAVE_FAILED', 'Failed to save transcript', false);

      // Update session status to failed
      try {
        await updateSessionStatus(this.env, this.sessionMetadata.session_id, 'failed');
      } catch (statusError) {
        this.logger.error('Failed to update session status', statusError);
      }
    }
  }

  /**
   * Save transcript to D1 database
   * @returns {Promise<Object>} Note data including note_id
   */
  async saveTranscript() {
    try {
      // Sanitize transcript
      const sanitized = sanitizeTranscript(this.transcript);

      if (!sanitized || sanitized.length === 0) {
        throw new Error('Transcript is empty');
      }

      // Calculate duration (based on session time)
      const duration_seconds = this.sessionMetadata.last_chunk_time
        ? Math.round((this.sessionMetadata.last_chunk_time - this.sessionMetadata.start_time) / 1000)
        : 0;

      // Calculate word count
      const word_count = countWords(sanitized);

      // Generate note ID
      const note_id = generateNoteId();

      // Insert into D1
      await insertVoiceNote(this.env, {
        note_id,
        user_id: this.sessionMetadata.user_id,
        transcript: sanitized,
        duration_seconds,
        word_count
      });

      this.logger.info('Transcript inserted into database', {
        note_id,
        duration_seconds,
        word_count,
        transcript_length: sanitized.length
      });

      return {
        note_id,
        transcript: sanitized,
        duration_seconds,
        word_count,
        created_at: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Save transcript error', error);
      throw new Error(`Failed to save transcript: ${error.message}`);
    }
  }

  /**
   * Set up session timeout handling
   */
  setupSessionTimeout() {
    // Clear any existing timeouts
    this.clearTimeouts();

    // Set warning timeout (1 minute before max duration)
    this.warningTimeoutHandle = setTimeout(() => {
      this.sendMessage({
        type: 'warning',
        message: 'Session will end in 1 minute',
        seconds_remaining: 60
      });
    }, TIMEOUT_WARNING_THRESHOLD);

    // Set maximum session timeout
    this.timeoutHandle = setTimeout(async () => {
      this.logger.warn('Session timeout reached', {
        max_duration_ms: MAX_SESSION_DURATION,
        chunk_count: this.sessionMetadata.chunk_count,
        transcript_length: this.transcript.length
      });

      this.sendError('SESSION_TIMEOUT', 'Maximum session duration reached (10 minutes)', false);

      // Save transcript if any
      if (this.transcript.length > 0) {
        try {
          await this.saveTranscript();
        } catch (error) {
          this.logger.error('Failed to save transcript on timeout', error);
        }
      }

      // Update session status
      try {
        await updateSessionStatus(this.env, this.sessionMetadata.session_id, 'completed');
      } catch (error) {
        this.logger.error('Failed to update session status on timeout', error);
      }

      // Close WebSocket
      if (this.websocket) {
        this.websocket.close(1000, 'Session timeout');
      }

      // Cleanup
      await this.cleanup();

    }, MAX_SESSION_DURATION);
  }

  /**
   * Clear all timeout handles
   */
  clearTimeouts() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    if (this.warningTimeoutHandle) {
      clearTimeout(this.warningTimeoutHandle);
      this.warningTimeoutHandle = null;
    }
  }

  /**
   * Send a message to the client via WebSocket
   * @param {Object} message - Message object to send
   */
  sendMessage(message) {
    if (this.websocket && this.websocket.readyState === 1) { // 1 = OPEN state
      try {
        this.websocket.send(JSON.stringify(message));
      } catch (error) {
        this.logger.error('Failed to send message', {
          error_message: error.message,
          message_type: message.type
        });
      }
    }
  }

  /**
   * Send an error message to the client
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {boolean} recoverable - Whether the error is recoverable
   */
  sendError(code, message, recoverable) {
    this.sendMessage({
      type: 'error',
      code,
      message,
      recoverable
    });
  }

  /**
   * Cleanup resources when session ends
   */
  async cleanup() {
    this.logger.info('Cleaning up session', {
      chunk_count: this.sessionMetadata.chunk_count,
      transcript_length: this.transcript.length,
      buffer_size: this.audioBuffer.length
    });

    // Clear timeouts
    this.clearTimeouts();

    // Close WebSocket if still open
    if (this.websocket && this.websocket.readyState === 1) { // 1 = OPEN state
      try {
        this.websocket.close(1000, 'Session ended');
      } catch (error) {
        this.logger.error('Error closing WebSocket', error);
      }
    }

    // Clear state
    this.websocket = null;
    this.sessionActive = false;
    this.audioBuffer = [];
    this.transcript = '';
    this.partialTranscript = '';

    // Note: Durable Object will hibernate automatically after cleanup
  }
}
