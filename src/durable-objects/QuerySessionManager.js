// @ts-check
/// <reference types="@cloudflare/workers-types" />

/**
 * QuerySessionManager Durable Object
 *
 * Manages WebSocket connections for voice query sessions.
 * Acts as a thin coordinator, delegating to extracted services:
 * - AudioStreamHandler: Audio chunk buffering
 * - TranscriptionService: Audio-to-text transcription
 * - QueryOrchestrator: Query routing and execution
 * - TTSStreamHandler: TTS synthesis and streaming
 * - AnswerGenerator: Natural language answer generation
 *
 * @module durable-objects/QuerySessionManager
 */

/**
 * @typedef {import('./types.js').SessionMetadata} SessionMetadata
 * @typedef {import('./types.js').PerformanceMetrics} PerformanceMetrics
 * @typedef {import('../services/transcription-service.js').TranscriptionResult} TranscriptionResult
 */

import { createLogger } from '../utils/logger.js';
import { generateGraphName } from '../lib/falkordb/namespace.js';

// Extracted services
import { createAudioStreamHandler } from '../services/audio-stream-handler.js';
import { createTranscriptionService } from '../services/transcription-service.js';
import { createQueryOrchestrator } from '../services/query-orchestrator.js';
import { createTTSStreamHandler } from '../services/tts-stream-handler.js';
import { AnswerGenerator } from '../services/answer-generator.js';
import { updateQueryAnswer } from '../lib/db/voice-queries.js';
import { formatResultsAsBulletList } from '../lib/graph/context-formatter.js';

/**
 * Maximum session duration in milliseconds (5 minutes)
 * @const {number}
 */
const MAX_SESSION_DURATION = 5 * 60 * 1000;

/**
 * Warning threshold before timeout (4 minutes)
 * @const {number}
 */
const TIMEOUT_WARNING_THRESHOLD = 4 * 60 * 1000;

/**
 * Generate a unique query ID
 * @returns {string} Query ID in format "query_" + UUID
 */
function generateQueryId() {
  return `query_${crypto.randomUUID()}`;
}

/**
 * QuerySessionManager Durable Object
 *
 * Thin coordinator for voice query sessions.
 */
export class QuerySessionManager {
  /**
   * Constructor - Initialize Durable Object state
   * @param {DurableObjectState} state - Durable Object state
   * @param {Object} env - Environment bindings
   */
  constructor(state, env) {
    this.state = state;
    this.env = env;

    /** @type {WebSocket|null} */
    this.websocket = null;

    /** @type {SessionMetadata} */
    this.sessionMetadata = {
      session_id: null,
      query_id: null,
      user_id: null,
      user_namespace: null,
      start_time: null
    };

    /** @type {ReturnType<typeof setTimeout>|null} */
    this.timeoutHandle = null;
    /** @type {ReturnType<typeof setTimeout>|null} */
    this.warningTimeoutHandle = null;

    /** @type {boolean} */
    this.sessionActive = false;

    // Composed services (initialized on WebSocket connect)
    /** @type {any} */
    this.audioHandler = null;
    /** @type {any} */
    this.transcriptionService = null;
    /** @type {any} */
    this.queryOrchestrator = null;
    /** @type {any} */
    this.ttsHandler = null;
    /** @type {any} */
    this.answerGenerator = null;

    /** @type {string|null} */
    this.question = null;
    /** @type {any} */
    this.queryResults = null;

    /** @type {PerformanceMetrics} */
    this.performanceMetrics = {
      transcription_start: null,
      transcription_end: null,
      query_start: null,
      query_end: null,
      answer_start: null,
      answer_end: null
    };

    // Logger (will be initialized with context)
    this.logger = createLogger('QuerySessionManager', {}, this.env);
  }

  /**
   * Main fetch handler
   * @param {Request} request - Incoming HTTP request
   * @returns {Promise<Response>} HTTP response
   */
  async fetch(request) {
    const url = new URL(request.url);

    try {
      if (request.headers.get('Upgrade') === 'websocket') {
        return await this.handleWebSocketUpgrade(request);
      }

      if (url.pathname === '/status') {
        return new Response(JSON.stringify({
          active: this.sessionActive,
          session_id: this.sessionMetadata.session_id,
          query_id: this.sessionMetadata.query_id,
          question: this.question,
          has_results: !!this.queryResults
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      this.logger.error('Error in fetch handler', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  /**
   * Handle WebSocket upgrade
   * @param {Request} request - HTTP request with Upgrade header
   * @returns {Promise<Response>} WebSocket response
   */
  async handleWebSocketUpgrade(request) {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');
    const userId = url.searchParams.get('user_id');

    if (!sessionId || !userId) {
      return new Response('Missing session_id or user_id', { status: 400 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    // Initialize session
    this.websocket = server;
    this.sessionActive = true;
    this.sessionMetadata.session_id = sessionId;
    this.sessionMetadata.query_id = generateQueryId();
    this.sessionMetadata.user_id = userId;
    this.sessionMetadata.user_namespace = generateGraphName(userId);
    this.sessionMetadata.start_time = Date.now();

    // Update logger with session context
    this.logger = createLogger('QuerySessionManager', {
      session_id: sessionId,
      query_id: this.sessionMetadata.query_id,
      user_id: userId
    }, this.env);

    // Initialize composed services
    this.audioHandler = createAudioStreamHandler(this.logger);
    this.transcriptionService = createTranscriptionService(this.env, this.logger);
    this.queryOrchestrator = createQueryOrchestrator(this.env, this.logger);
    this.ttsHandler = createTTSStreamHandler(this.env, this.logger);
    this.answerGenerator = new AnswerGenerator(this.env, {
      waitUntil: (promise) => promise.catch(err => this.logger.error('Background task failed', err))
    });

    this.logger.info('WebSocket connection established', {
      user_id: userId,
      user_namespace: this.sessionMetadata.user_namespace,
      session_id: sessionId,
      query_id: this.sessionMetadata.query_id
    });

    // Set up event handlers
    server.addEventListener('message', (event) => this.handleMessage(event));
    server.addEventListener('close', () => this.handleClose());
    server.addEventListener('error', (error) => this.handleError(error));

    // Send recording_started event
    this.sendToClient({
      type: 'recording_started',
      session_id: sessionId,
      query_id: this.sessionMetadata.query_id,
      timestamp: Date.now()
    });

    // Set session timeout
    this.setSessionTimeout();

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle WebSocket messages
   * @param {MessageEvent} event - WebSocket message event
   */
  async handleMessage(event) {
    try {
      let messageText;
      if (typeof event.data === 'string') {
        messageText = event.data;
      } else if (event.data instanceof ArrayBuffer) {
        const decoder = new TextDecoder('utf-8');
        messageText = decoder.decode(event.data);
      } else {
        throw new Error(`Unsupported message type: ${typeof event.data}`);
      }

      const message = JSON.parse(messageText);

      switch (message.type) {
        case 'audio_chunk':
          this.handleAudioChunk(message);
          break;

        case 'stop_recording':
          await this.processVoiceQuery();
          break;

        case 'cancel_query':
          this.handleCancelQuery();
          break;

        case 'playback_control':
          this.handlePlaybackControl(message);
          break;

        default:
          this.logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error('Error handling message', error);
      this.sendError('MESSAGE_PARSE_ERROR', 'Invalid message format', false);
    }
  }

  /**
   * Handle audio chunk - delegate to AudioStreamHandler
   * @param {Object} message - Audio chunk message
   */
  handleAudioChunk(message) {
    if (!this.performanceMetrics.transcription_start) {
      this.performanceMetrics.transcription_start = Date.now();
    }

    const result = this.audioHandler.handleAudioChunk(message);

    if (!result.success) {
      this.sendError(result.error.code, result.error.message, result.error.recoverable);
      if (!result.error.recoverable) {
        this.cleanup();
      }
    }
  }

  /**
   * Process voice query - main orchestration flow
   */
  async processVoiceQuery() {
    try {
      // 1. Get buffered audio
      if (!this.audioHandler.hasAudio()) {
        this.sendError('NO_AUDIO', 'No audio recorded. Please try again.', true);
        this.cleanup();
        return;
      }

      const audioData = this.audioHandler.getBufferedAudio();
      this.audioHandler.clearBuffer();

      // 2. Transcribe audio
      this.performanceMetrics.transcription_end = Date.now();
      const transcription = await this.transcriptionService.transcribeAudio(audioData);

      if (!transcription.valid) {
        this.sendError(
          transcription.error_code,
          transcription.error_code === 'EMPTY_TRANSCRIPT'
            ? "I didn't hear anything. Please try again."
            : "I couldn't hear you clearly. Please try again in a quieter location.",
          true
        );
        this.cleanup();
        return;
      }

      this.question = transcription.text;

      // Send final transcript
      this.sendToClient({
        type: 'transcript_final',
        question: this.question,
        is_final: true,
        confidence: transcription.confidence
      });

      this.logger.info('Question transcribed', {
        question: this.question,
        confidence: transcription.confidence
      });

      // 3. Process query
      this.performanceMetrics.query_start = Date.now();

      const queryResult = await this.queryOrchestrator.processQuery(
        this.question,
        this.sessionMetadata.user_id,
        this.sessionMetadata.user_namespace,
        {
          queryId: this.sessionMetadata.query_id,
          onProgress: (progress) => {
            if (progress.message) {
              this.sendToClient({ type: 'query_executing', message: progress.message });
            }
          }
        }
      );

      this.performanceMetrics.query_end = Date.now();
      this.queryResults = queryResult.results;

      // Send query results
      this.sendToClient({
        type: 'query_results',
        query_id: this.sessionMetadata.query_id,
        results: queryResult.results
      });

      // Save to D1
      await this.saveQueryToDatabase(queryResult.cypherQuery, queryResult.results, queryResult.executionTimeMs);

      // 4. Generate answer
      await this.generateAndStreamAnswer(queryResult.results);

      this.cleanup();

    } catch (error) {
      this.logger.error('Voice query processing failed', error);
      this.sendError('QUERY_FAILED', this.getUserFriendlyError(error), true);
      this.cleanup();
    }
  }

  /**
   * Generate answer and stream TTS audio
   * @param {Object} queryResults - Formatted query results
   */
  async generateAndStreamAnswer(queryResults) {
    try {
      this.performanceMetrics.answer_start = Date.now();

      this.sendToClient({ type: 'answer_generating', message: 'Generating answer...' });

      // Generate answer
      const generatedAnswer = await this.answerGenerator.generate({
        question: this.question,
        queryResults,
        userId: this.sessionMetadata.user_id,
        sessionId: this.sessionMetadata.session_id
      });

      this.performanceMetrics.answer_end = Date.now();

      this.logger.info('Answer generated', {
        latency_ms: generatedAnswer.latency_ms,
        cached: generatedAnswer.cached
      });

      // Send answer to client
      this.sendToClient({
        type: 'answer_generated',
        query_id: this.sessionMetadata.query_id,
        answer: generatedAnswer.answer,
        sources: generatedAnswer.sources || [],
        latency_ms: generatedAnswer.latency_ms,
        cached: generatedAnswer.cached || false,
        confidence: generatedAnswer.confidence,
        empty_results: generatedAnswer.empty_results || false
      });

      // Update D1 with answer (async, non-blocking)
      if (this.sessionMetadata.query_id && this.sessionMetadata.user_id) {
        updateQueryAnswer(
          this.env,
          this.sessionMetadata.query_id,
          this.sessionMetadata.user_id,
          generatedAnswer.answer,
          generatedAnswer.sources || [],
          generatedAnswer.latency_ms
        ).catch(err => this.logger.error('Failed to save answer to D1', err));
      }

      // Stream TTS audio
      const ttsResult = await this.ttsHandler.synthesizeAndStream(
        generatedAnswer.answer,
        (chunk) => this.sendToClient(chunk)
      );

      if (!ttsResult.success) {
        this.sendToClient({
          type: 'audio_error',
          error: ttsResult.error.code,
          message: 'Voice response unavailable. Answer text is displayed.',
          fallback: 'text_only'
        });
      }

    } catch (error) {
      this.logger.error('Answer generation error', error);

      if (error.name === 'LLMTimeoutError') {
        this.sendToClient({
          type: 'answer_error',
          query_id: this.sessionMetadata.query_id,
          error: 'Answer generation timed out. Please try again.',
          error_code: 'llm_timeout',
          can_retry: true
        });
      } else {
        // Fallback to formatted results
        const fallbackAnswer = formatResultsAsBulletList(queryResults);
        this.sendToClient({
          type: 'answer_fallback',
          query_id: this.sessionMetadata.query_id,
          fallback_answer: fallbackAnswer,
          sources: queryResults.metadata?.sources || [],
          reason: 'LLM service temporarily unavailable'
        });
      }
    }
  }

  /**
   * Handle playback control - delegate to TTSStreamHandler
   * @param {Object} message - Playback control message
   */
  handlePlaybackControl(message) {
    const result = this.ttsHandler.handlePlaybackControl(message);

    this.sendToClient({
      type: 'playback_control_response',
      action: message.action,
      status: result.status,
      response_time_ms: result.responseTimeMs
    });

    if (!result.success) {
      this.sendError(result.error.code, result.error.message, false);
    }
  }

  /**
   * Handle cancel query
   */
  handleCancelQuery() {
    this.logger.info('Query cancelled by user');
    this.sendToClient({ type: 'query_cancelled', message: 'Query cancelled' });
    this.cleanup();
  }

  /**
   * Save query to D1 database
   */
  async saveQueryToDatabase(cypherQuery, results, latencyMs) {
    try {
      const query = `
        INSERT INTO voice_queries (
          query_id, user_id, session_id, question, cypher_query,
          graph_results, answer, latency_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, '', ?, CURRENT_TIMESTAMP)
      `;

      await this.env.DB.prepare(query)
        .bind(
          this.sessionMetadata.query_id,
          this.sessionMetadata.user_id,
          this.sessionMetadata.session_id,
          this.question,
          cypherQuery,
          JSON.stringify(results),
          latencyMs
        )
        .run();

      this.logger.info('Query saved to D1', { query_id: this.sessionMetadata.query_id });
    } catch (error) {
      this.logger.error('Failed to save query to D1', error);
    }
  }

  /**
   * Handle WebSocket close
   */
  handleClose() {
    this.logger.info('WebSocket connection closed');
    this.cleanup();
  }

  /**
   * Handle WebSocket error
   * @param {Event|Error} error - WebSocket error event
   */
  handleError(error) {
    this.logger.error('WebSocket error', /** @type {any} */ (error));
    this.sendError('WEBSOCKET_ERROR', 'Connection error occurred', false);
    this.cleanup();
  }

  /**
   * Send message to client
   * @param {Object} message - Message object
   */
  sendToClient(message) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  /**
   * Send error to client
   * @param {string} errorCode - Error code
   * @param {string} message - User-friendly error message
   * @param {boolean} retryable - Whether error is retryable
   */
  sendError(errorCode, message, retryable) {
    this.logger.warn(`Error sent to client: ${errorCode}`, { message, retryable });
    this.sendToClient({ type: 'error', error_code: errorCode, message, retryable });
  }

  /**
   * Get user-friendly error message
   * @param {Error} error - Original error
   * @returns {string} User-friendly message
   */
  getUserFriendlyError(error) {
    if (this.env.ENVIRONMENT === 'development') {
      return `Query failed: ${error.message}`;
    }
    return "I couldn't understand that question. Try asking about specific people, projects, or topics.";
  }

  /**
   * Set session timeout
   */
  setSessionTimeout() {
    this.warningTimeoutHandle = setTimeout(() => {
      this.sendToClient({
        type: 'timeout_warning',
        message: 'Session will timeout in 1 minute',
        remaining_ms: MAX_SESSION_DURATION - TIMEOUT_WARNING_THRESHOLD
      });
    }, TIMEOUT_WARNING_THRESHOLD);

    this.timeoutHandle = setTimeout(() => {
      this.logger.warn('Session timeout reached');
      this.sendError('SESSION_TIMEOUT', 'Session timed out. Please try again.', true);
      this.cleanup();
    }, MAX_SESSION_DURATION);
  }

  /**
   * Cleanup session resources
   */
  cleanup() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    if (this.warningTimeoutHandle) {
      clearTimeout(this.warningTimeoutHandle);
      this.warningTimeoutHandle = null;
    }

    if (this.websocket) {
      try {
        this.websocket.close();
      } catch (error) {
        this.logger.error('Error closing WebSocket', error);
      }
      this.websocket = null;
    }

    // Reset services
    if (this.audioHandler) this.audioHandler.reset();
    if (this.ttsHandler) this.ttsHandler.reset();

    this.sessionActive = false;
    this.logger.info('Session cleaned up');
  }
}
