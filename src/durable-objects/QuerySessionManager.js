/**
 * QuerySessionManager Durable Object (Feature 008)
 *
 * Manages WebSocket connections for voice query sessions.
 * Each query session gets a dedicated DO instance for:
 * - WebSocket connection management
 * - Audio chunk buffering and sequencing
 * - Real-time transcription via Deepgram Nova-3
 * - Cypher query generation and execution
 * - Result formatting and delivery
 *
 * Lifecycle:
 * 1. Created on POST /api/query/start
 * 2. Accepts WebSocket connection
 * 3. Processes audio chunks and streams transcripts
 * 4. Generates Cypher query from transcript
 * 5. Executes query against FalkorDB
 * 6. Saves query to D1 and caches in KV
 * 7. Hibernates after session completion
 *
 * @module durable-objects/QuerySessionManager
 */

import { transcribeAudioChunk } from '../lib/audio/transcription.js';
import { validateAudioChunk, getValidationErrorMessage, isRecoverableValidationError } from '../lib/audio/validation.js';
import { createLogger } from '../utils/logger.js';

// Query generation and execution
import { generateCypherQuery } from '../services/cypher-generator.js';
import { autoFormatResults, formatEmptyResults, formatErrorResults } from '../services/result-formatter.js';

// Caching and persistence
import { getCachedQuery, setCachedQuery } from '../lib/graph/query-cache.js';

// Answer generation (Feature 009)
import { AnswerGenerator } from '../services/answer-generator.js';
import { updateQueryAnswer } from '../lib/db/voice-queries.js';
import { formatResultsAsBulletList } from '../lib/graph/context-formatter.js';

// Text-to-Speech (Feature 010)
import { createTTSSynthesizer } from '../services/tts-synthesizer.js';
import { createAudioCache } from '../lib/audio/audio-cache.js';
import { base64ToChunk, chunkAudio, createChunkMessage, reassembleChunks } from '../lib/audio/audio-chunker.js';

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
 * Minimum transcription confidence threshold (70%)
 * @const {number}
 */
const MIN_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Generate a unique query ID
 * @returns {string} Query ID in format "query_" + UUID
 */
function generateQueryId() {
  return `query_${crypto.randomUUID()}`;
}

/**
 * Generate a user namespace for FalkorDB
 * @param {string} userId - User ID
 * @returns {string} Namespace in format "user_{userId}_graph"
 */
function getUserNamespace(userId) {
  // Clean user ID (remove non-alphanumeric characters)
  const cleanUserId = userId.replace(/[^a-zA-Z0-9]/g, '_');
  return `user_${cleanUserId}_graph`;
}

/**
 * QuerySessionManager Durable Object
 *
 * Manages a single voice query session with WebSocket communication,
 * audio processing, query generation, and result delivery.
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

    // WebSocket connection
    this.websocket = null;

    // Audio chunk buffer (for handling out-of-order delivery)
    this.audioBuffer = [];

    // Transcript accumulation
    this.transcript = '';
    this.partialTranscript = '';
    this.transcriptConfidence = 0;

    // Query state
    this.question = null;
    this.cypherQuery = null;
    this.queryResults = null;

    // Session metadata
    this.sessionMetadata = {
      session_id: null,
      query_id: null,
      user_id: null,
      user_namespace: null,
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

    // Performance tracking
    this.performanceMetrics = {
      transcription_start: null,
      transcription_end: null,
      cypher_generation_start: null,
      cypher_generation_end: null,
      query_execution_start: null,
      query_execution_end: null,
      answer_generation_start: null,
      answer_generation_end: null
    };

    // Answer generation state (Feature 009)
    this.answerGenerationAttempts = 0;
    this.lastGeneratedAnswer = null;

    // Audio playback state (Feature 010 - US2)
    this.audioPlaybackState = {
      status: 'idle', // 'idle' | 'playing' | 'paused' | 'stopped'
      currentChunk: 0,
      totalChunks: 0,
      audioBuffer: null, // Buffered chunks for resumable playback
      isPaused: false
    };

    // Logger (will be initialized with context)
    this.logger = createLogger('QuerySessionManager');
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
          query_id: this.sessionMetadata.query_id,
          chunk_count: this.sessionMetadata.chunk_count,
          question: this.question,
          has_results: !!this.queryResults
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Unhandled path
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      this.logger.error('Error in fetch handler', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  /**
   * Handle WebSocket upgrade and establish connection
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

    // Accept WebSocket connection
    server.accept();

    // Initialize session
    this.websocket = server;
    this.sessionActive = true;
    this.sessionMetadata.session_id = sessionId;
    this.sessionMetadata.query_id = generateQueryId();
    this.sessionMetadata.user_id = userId;
    this.sessionMetadata.user_namespace = getUserNamespace(userId);
    this.sessionMetadata.start_time = Date.now();

    // Update logger with session context
    this.logger = createLogger('QuerySessionManager', {
      session_id: sessionId,
      query_id: this.sessionMetadata.query_id,
      user_id: userId
    });

    this.logger.info('WebSocket connection established');

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

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  /**
   * Handle WebSocket messages from client
   * @param {MessageEvent} event - WebSocket message event
   */
  async handleMessage(event) {
    try {
      // Log raw message data for debugging
      this.logger.info('Raw WebSocket message received', {
        data_type: typeof event.data,
        data_length: event.data?.length || event.data?.byteLength || 0,
        is_array_buffer: event.data instanceof ArrayBuffer,
        is_string: typeof event.data === 'string',
        data_preview: typeof event.data === 'string'
          ? event.data.substring(0, 100)
          : '[binary data]'
      });

      // Convert event.data to string if it's binary (ArrayBuffer or Blob)
      let messageText;
      if (typeof event.data === 'string') {
        // Already a string - use directly
        messageText = event.data;
      } else if (event.data instanceof ArrayBuffer) {
        // ArrayBuffer - decode to string
        const decoder = new TextDecoder('utf-8');
        messageText = decoder.decode(event.data);
        this.logger.info('Decoded ArrayBuffer to string', {
          original_byte_length: event.data.byteLength,
          decoded_length: messageText.length,
          decoded_preview: messageText.substring(0, 100)
        });
      } else {
        throw new Error(`Unsupported message type: ${typeof event.data}`);
      }

      const message = JSON.parse(messageText);

      this.logger.info('Parsed WebSocket message', {
        type: message.type,
        has_chunk: !!message.chunk,
        has_data: !!message.data,
        sequence: message.sequence,
        timestamp: message.timestamp
      });

      switch (message.type) {
        case 'audio_chunk':
          await this.handleAudioChunk(message);
          break;

        case 'stop_recording':
          await this.handleStopRecording();
          break;

        case 'cancel_query':
          await this.handleCancelQuery();
          break;

        case 'playback_control':
          await this.handlePlaybackControl(message);
          break;

        default:
          this.logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error('Error handling message', {
        error_message: error.message,
        error_stack: error.stack,
        raw_data_type: typeof event.data,
        raw_data_preview: typeof event.data === 'string'
          ? event.data.substring(0, 200)
          : '[binary data]'
      });
      this.sendError('MESSAGE_PARSE_ERROR', 'Invalid message format', false);
    }
  }

  /**
   * Handle audio chunk from client
   * @param {Object} message - Audio chunk message
   */
  async handleAudioChunk(message) {
    const { chunk, sequence, timestamp } = message;

    // Log extracted chunk details for debugging
    this.logger.info('Audio chunk extracted from message', {
      has_chunk: !!chunk,
      chunk_type: typeof chunk,
      chunk_length: chunk?.length || 0,
      chunk_preview: typeof chunk === 'string' ? chunk.substring(0, 50) + '...' : '[not a string]',
      sequence,
      timestamp
    });

    // Validate audio chunk
    const validation = validateAudioChunk(message);
    if (!validation.valid) {
      // Log validation failure details
      this.logger.error('Audio chunk validation failed', {
        errors: validation.errors,
        message_keys: Object.keys(message),
        has_chunk: !!message.chunk,
        chunk_type: typeof message.chunk
      });

      const errorMessage = getValidationErrorMessage(validation);
      const recoverable = isRecoverableValidationError(validation);

      this.sendError('AUDIO_VALIDATION_ERROR', errorMessage, recoverable);

      if (!recoverable) {
        this.cleanup();
      }
      return;
    }

    this.logger.info('Audio chunk validation passed');

    // Update session metadata
    this.sessionMetadata.chunk_count++;
    this.sessionMetadata.last_chunk_time = Date.now();

    // Buffer audio chunk
    this.audioBuffer.push({ chunk, sequence, timestamp });

    if (!this.performanceMetrics.transcription_start) {
      this.performanceMetrics.transcription_start = Date.now();
    }
  }

  /**
   * Reassemble buffered base64 chunks and transcribe once with Whisper
   * This ensures Workers AI receives a complete WebM/Opus payload with headers.
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeBufferedAudio() {
    if (!this.audioBuffer.length) {
      throw new Error('No audio chunks available for transcription');
    }

    // Sort chunks to guarantee ordering before reassembly
    const sortedChunks = [...this.audioBuffer].sort((a, b) => a.sequence - b.sequence);

    try {
      const uint8Chunks = sortedChunks.map(entry => base64ToChunk(entry.chunk));

      const reassembled = reassembleChunks(uint8Chunks);

      this.logger.info('Audio reassembled for transcription', {
        chunk_count: uint8Chunks.length,
        byte_length: reassembled.byteLength
      });

      return await transcribeAudioChunk(reassembled, this.env, { language: 'en' });
    } catch (error) {
      this.logger.error('Failed to reassemble audio for transcription', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle stop recording - finalize transcript and process query
   */
  async handleStopRecording() {
    if (!this.performanceMetrics.transcription_start) {
      this.performanceMetrics.transcription_start = Date.now();
    }

    let transcription;

    try {
      transcription = await this.transcribeBufferedAudio();
      this.performanceMetrics.transcription_end = Date.now();
    } catch (error) {
      this.performanceMetrics.transcription_end = Date.now();
      this.sendError('TRANSCRIPTION_ERROR', 'Failed to transcribe audio. Please try again.', true);
      this.cleanup();
      return;
    }

    this.transcript = (transcription.text || '').trim();
    this.transcriptConfidence = transcription.confidence || 1;
    this.partialTranscript = '';
    this.audioBuffer = [];

    // Check transcript confidence
    if (this.transcriptConfidence < MIN_CONFIDENCE_THRESHOLD) {
      this.sendError(
        'LOW_CONFIDENCE_TRANSCRIPT',
        'I couldn\'t hear you clearly. Please try again in a quieter location.',
        true
      );
      this.cleanup();
      return;
    }

    // Check transcript is not empty
    if (!this.transcript || this.transcript.trim().length === 0) {
      this.sendError(
        'EMPTY_TRANSCRIPT',
        'I didn\'t hear anything. Please try again.',
        true
      );
      this.cleanup();
      return;
    }

    this.question = this.transcript.trim();

    // Send final transcript
    this.sendToClient({
      type: 'transcript_final',
      question: this.question,
      is_final: true,
      confidence: this.transcriptConfidence
    });

    this.logger.info('Question transcribed', {
      question: this.question,
      confidence: this.transcriptConfidence
    });

    // Generate and execute Cypher query
    await this.generateAndExecuteQuery();
  }

  /**
   * Generate Cypher query from question and execute it
   */
  async generateAndExecuteQuery() {
    try {
      // Send cypher_generating status
      this.sendToClient({
        type: 'cypher_generating',
        message: 'Understanding your question...'
      });

      this.performanceMetrics.cypher_generation_start = Date.now();

      // 1. Check query cache first
      const cachedResult = await getCachedQuery(
        this.env.KV,
        this.sessionMetadata.user_id,
        this.question,
        {}
      );

      if (cachedResult) {
        this.logger.info('Query cache hit', { question: this.question });

        // Send cached results immediately
        const formattedResults = autoFormatResults(cachedResult.results, {
          execution_time_ms: 0,
          cached: true,
          template_used: cachedResult.template_used,
          query_id: this.sessionMetadata.query_id
        });

        this.queryResults = formattedResults;

        this.sendToClient({
          type: 'query_results',
          query_id: this.sessionMetadata.query_id,
          results: formattedResults
        });

        // Still save to D1 for history
        await this.saveQueryToDatabase(cachedResult.cypher_query, formattedResults, 0);

        this.cleanup();
        return;
      }

      // 2. Generate Cypher query from question
      const { cypher, parameters, templateUsed, entities } = await generateCypherQuery(
        this.question,
        this.sessionMetadata.user_namespace,
        this.env
      );

      this.cypherQuery = cypher;
      this.performanceMetrics.cypher_generation_end = Date.now();

      this.logger.info('Cypher query generated', {
        template: templateUsed,
        cypher,
        entities: entities.length
      });

      // Send cypher_generated event
      this.sendToClient({
        type: 'cypher_generated',
        cypher_query: cypher,
        template_used: templateUsed
      });

      // 3. Execute query against FalkorDB
      await this.executeQuery(cypher, parameters, templateUsed);

    } catch (error) {
      this.logger.error('Query generation error', error);

      let errorMessage = 'I couldn\'t understand that question. Try asking about specific people, projects, or topics.';
      if (error.message && error.message.includes('No entities found')) {
        errorMessage = 'I couldn\'t identify what you\'re asking about. Try mentioning specific names or topics.';
      }

      this.sendError(
        'CYPHER_GENERATION_FAILED',
        errorMessage,
        true
      );
      this.cleanup();
    }
  }

  /**
   * Execute Cypher query against FalkorDB
   *
   * @param {string} cypher - Cypher query
   * @param {Object} parameters - Query parameters
   * @param {string} templateUsed - Template identifier
   */
  async executeQuery(cypher, parameters, templateUsed) {
    try {
      this.sendToClient({
        type: 'query_executing',
        message: 'Searching your knowledge graph...'
      });

      this.performanceMetrics.query_execution_start = Date.now();

      // Get FalkorDBConnectionPool Durable Object
      const poolId = this.env.FALKORDB_POOL.idFromName('pool');
      const poolStub = this.env.FALKORDB_POOL.get(poolId);

      // Execute query via connection pool
      const response = await poolStub.fetch('http://internal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cypher,
          parameters,
          user_namespace: this.sessionMetadata.user_namespace
        })
      });

      if (!response.ok) {
        throw new Error(`Query execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      this.performanceMetrics.query_execution_end = Date.now();

      const executionTime = this.performanceMetrics.query_execution_end - this.performanceMetrics.query_execution_start;

      this.logger.info('Query executed', {
        execution_time_ms: executionTime,
        results_count: result.results?.length || 0
      });

      // Format results
      const formattedResults = autoFormatResults(result.results || [], {
        execution_time_ms: executionTime,
        cached: false,
        template_used: templateUsed,
        query_id: this.sessionMetadata.query_id
      });

      this.queryResults = formattedResults;

      // Send results to client
      this.sendToClient({
        type: 'query_results',
        query_id: this.sessionMetadata.query_id,
        results: formattedResults
      });

      // Save to D1 and cache in KV
      await Promise.all([
        this.saveQueryToDatabase(cypher, formattedResults, executionTime),
        this.cacheQueryResults(cypher, parameters, result.results, templateUsed)
      ]);

      // Generate answer (Feature 009)
      await this.generateAnswer(formattedResults);

      this.cleanup();

    } catch (error) {
      this.logger.error('Query execution error', error);

      this.sendError(
        'QUERY_EXECUTION_FAILED',
        'Unable to search your knowledge graph right now. Please try again.',
        true
      );
      this.cleanup();
    }
  }

  /**
   * Save query to D1 database
   *
   * @param {string} cypherQuery - Cypher query
   * @param {Object} results - Formatted results
   * @param {number} latencyMs - Execution time in milliseconds
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
      // Don't throw - this is non-critical
    }
  }

  /**
   * Cache query results in KV
   *
   * @param {string} cypher - Cypher query
   * @param {Object} parameters - Query parameters
   * @param {Array} results - Raw query results
   * @param {string} templateUsed - Template identifier
   */
  async cacheQueryResults(cypher, parameters, results, templateUsed) {
    try {
      await setCachedQuery(
        this.env.KV,
        this.sessionMetadata.user_id,
        this.question,
        parameters,
        {
          cypher_query: cypher,
          results,
          template_used: templateUsed
        }
      );

      this.logger.info('Query results cached', { question: this.question });
    } catch (error) {
      this.logger.error('Failed to cache query results', error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Handle cancel query request
   */
  async handleCancelQuery() {
    this.logger.info('Query cancelled by user');
    this.sendToClient({
      type: 'query_cancelled',
      message: 'Query cancelled'
    });
    this.cleanup();
  }

  /**
   * Handle playback control requests (Feature 010 - US2)
   * @param {Object} message - Playback control message
   */
  async handlePlaybackControl(message) {
    const { action } = message;
    const startTime = Date.now();

    this.logger.info(`Playback control: ${action}`, {
      current_state: this.audioPlaybackState.status
    });

    switch (action) {
      case 'pause':
        if (this.audioPlaybackState.status === 'playing') {
          this.audioPlaybackState.status = 'paused';
          this.audioPlaybackState.isPaused = true;

          this.sendToClient({
            type: 'playback_control_response',
            action: 'pause',
            status: 'paused',
            response_time_ms: Date.now() - startTime
          });

          this.logger.info('Playback paused');
        }
        break;

      case 'resume':
        if (this.audioPlaybackState.status === 'paused') {
          this.audioPlaybackState.status = 'playing';
          this.audioPlaybackState.isPaused = false;

          this.sendToClient({
            type: 'playback_control_response',
            action: 'resume',
            status: 'playing',
            response_time_ms: Date.now() - startTime
          });

          this.logger.info('Playback resumed');
        }
        break;

      case 'stop':
        // Stop playback and reset to beginning
        this.audioPlaybackState.status = 'stopped';
        this.audioPlaybackState.currentChunk = 0;
        this.audioPlaybackState.isPaused = false;

        this.sendToClient({
          type: 'playback_control_response',
          action: 'stop',
          status: 'stopped',
          response_time_ms: Date.now() - startTime
        });

        this.logger.info('Playback stopped');
        break;

      default:
        this.logger.warn(`Unknown playback action: ${action}`);
        this.sendError('INVALID_PLAYBACK_ACTION', `Unknown action: ${action}`, false);
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
   * @param {Error} error - WebSocket error
   */
  handleError(error) {
    this.logger.error('WebSocket error', error);
    this.sendError('WEBSOCKET_ERROR', 'Connection error occurred', false);
    this.cleanup();
  }

  /**
   * Send message to client via WebSocket
   * @param {Object} message - Message object
   */
  sendToClient(message) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to client
   * @param {string} errorCode - Error code
   * @param {string} message - User-friendly error message
   * @param {boolean} retryable - Whether error is retryable
   */
  sendError(errorCode, message, retryable) {
    this.logger.warn(`Error sent to client: ${errorCode}`, { message, retryable });

    this.sendToClient({
      type: 'error',
      error_code: errorCode,
      message,
      retryable
    });
  }

  /**
   * Set session timeout
   */
  setSessionTimeout() {
    // Warning timeout
    this.warningTimeoutHandle = setTimeout(() => {
      this.sendToClient({
        type: 'timeout_warning',
        message: 'Session will timeout in 1 minute',
        remaining_ms: MAX_SESSION_DURATION - TIMEOUT_WARNING_THRESHOLD
      });
    }, TIMEOUT_WARNING_THRESHOLD);

    // Hard timeout
    this.timeoutHandle = setTimeout(() => {
      this.logger.warn('Session timeout reached');
      this.sendError('SESSION_TIMEOUT', 'Session timed out. Please try again.', true);
      this.cleanup();
    }, MAX_SESSION_DURATION);
  }

  /**
   * Generate natural language answer from query results (Feature 009)
   * @param {Object} queryResults - Formatted query results
   */
  async generateAnswer(queryResults) {
    try {
      this.performanceMetrics.answer_generation_start = Date.now();

      this.sendToClient({
        type: 'answer_generating',
        message: 'Generating answer...'
      });

      // Create answer generator
      const answerGenerator = new AnswerGenerator(this.env, {
        waitUntil: (promise) => {
          // Durable Objects don't have waitUntil directly, so we handle async ops differently
          // Just log if promise fails
          promise.catch(err => this.logger.error('Background task failed', err));
        }
      });

      // Generate answer
      const generatedAnswer = await answerGenerator.generate({
        question: this.question,
        queryResults,
        userId: this.sessionMetadata.user_id,
        sessionId: this.sessionMetadata.session_id
      });

      this.performanceMetrics.answer_generation_end = Date.now();
      this.lastGeneratedAnswer = generatedAnswer;

      this.logger.info('Answer generated', {
        latency_ms: generatedAnswer.latency_ms,
        cached: generatedAnswer.cached,
        validation_passed: generatedAnswer.validation_passed,
        confidence: generatedAnswer.confidence
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
      updateQueryAnswer(
        this.env,
        this.sessionMetadata.query_id,
        this.sessionMetadata.user_id,
        generatedAnswer.answer,
        generatedAnswer.sources || [],
        generatedAnswer.latency_ms
      ).catch(err => {
        this.logger.error('Failed to save answer to D1', err);
      });

      // Synthesize and stream audio (Feature 010)
      await this.synthesizeAndStreamAudio(generatedAnswer.answer);

    } catch (error) {
      this.logger.error('Answer generation error', error);

      // Send fallback or error
      if (error.name === 'LLMTimeoutError') {
        this.sendToClient({
          type: 'answer_error',
          query_id: this.sessionMetadata.query_id,
          error: 'Answer generation timed out. Please try again.',
          error_code: 'llm_timeout',
          can_retry: true
        });
      } else if (error.name === 'ValidationFailedError') {
        // Return formatted results as fallback
        const fallbackAnswer = formatResultsAsBulletList(queryResults);

        this.sendToClient({
          type: 'answer_fallback',
          query_id: this.sessionMetadata.query_id,
          fallback_answer: fallbackAnswer,
          sources: queryResults.metadata?.sources || [],
          reason: 'Answer validation failed'
        });
      } else {
        // LLM service error - return formatted results
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
   * Synthesize answer to speech and stream to client (Feature 010)
   * @param {string} answerText - Generated answer text
   */
  async synthesizeAndStreamAudio(answerText) {
    try {
      this.logger.info('Starting TTS synthesis for answer');

      // Create TTS synthesizer and audio cache
      const ttsSynthesizer = createTTSSynthesizer(this.env.AI);
      const audioCache = createAudioCache(this.env.KV);

      const ttsStartTime = Date.now();

      // 1. Check cache first
      this.logger.info('Checking audio cache');
      let audioData;
      let audioMetadata;
      let fromCache = false;

      const cachedAudio = await audioCache.get(answerText);

      if (cachedAudio) {
        // Cache HIT
        this.logger.info('Audio cache HIT');
        audioData = cachedAudio.audio;
        audioMetadata = {
          format: cachedAudio.format,
          duration_ms: cachedAudio.duration_ms,
        };
        fromCache = true;
      } else {
        // Cache MISS - synthesize audio
        this.logger.info('Audio cache MISS - synthesizing audio');

        try {
          const synthesisResult = await ttsSynthesizer.synthesize(answerText);
          audioData = synthesisResult.audio;
          audioMetadata = {
            format: synthesisResult.format,
            duration_ms: synthesisResult.duration_ms,
          };

          // Cache audio asynchronously (non-blocking)
          audioCache.set(answerText, audioData, audioMetadata).catch(err => {
            this.logger.error('Failed to cache audio', err);
          });

        } catch (ttsError) {
          // TTS synthesis failed - graceful fallback
          this.logger.error('TTS synthesis failed', ttsError);

          this.sendToClient({
            type: 'audio_error',
            error: ttsError.code || 'TTS_FAILED',
            message: 'Voice response unavailable. Answer text is displayed.',
            fallback: 'text_only'
          });

          return; // Exit gracefully, text answer already sent
        }
      }

      const ttsLatency = Date.now() - ttsStartTime;
      this.logger.info('TTS synthesis complete', {
        latency_ms: ttsLatency,
        audio_size_bytes: audioData.byteLength,
        cached: fromCache
      });

      // 2. Chunk audio for streaming
      const chunks = chunkAudio(audioData, 4096); // 4KB chunks
      this.logger.info(`Audio chunked into ${chunks.length} chunks`);

      // Set playback state
      this.audioPlaybackState.status = 'playing';
      this.audioPlaybackState.totalChunks = chunks.length;
      this.audioPlaybackState.currentChunk = 0;
      this.audioPlaybackState.audioBuffer = chunks;

      // 3. Stream chunks to client
      for (let i = 0; i < chunks.length; i++) {
        // Check if playback was stopped
        if (this.audioPlaybackState.status === 'stopped') {
          this.logger.info('Playback stopped by user, halting stream');
          break;
        }

        // Wait if paused
        while (this.audioPlaybackState.isPaused) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const chunkMessage = createChunkMessage(chunks[i], i, chunks.length);
        this.audioPlaybackState.currentChunk = i;

        this.sendToClient(chunkMessage);

        // Small delay between chunks to prevent overwhelming the WebSocket
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // 4. Send completion message
      this.sendToClient({
        type: 'audio_complete',
        duration_ms: audioMetadata.duration_ms,
        total_bytes: audioData.byteLength,
        total_chunks: chunks.length,
        cached: fromCache,
        latency_ms: ttsLatency
      });

      this.logger.info('Audio streaming complete', {
        total_chunks: chunks.length,
        total_bytes: audioData.byteLength
      });

    } catch (error) {
      this.logger.error('Audio synthesis and streaming error', error);

      // Send error message but don't fail the entire query
      this.sendToClient({
        type: 'audio_error',
        error: 'AUDIO_STREAMING_FAILED',
        message: 'Unable to play audio. Answer text is displayed.',
        fallback: 'text_only'
      });
    }
  }

  /**
   * Cleanup session resources
   */
  cleanup() {
    // Clear timeouts
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    if (this.warningTimeoutHandle) {
      clearTimeout(this.warningTimeoutHandle);
      this.warningTimeoutHandle = null;
    }

    // Close WebSocket
    if (this.websocket) {
      try {
        this.websocket.close();
      } catch (error) {
        this.logger.error('Error closing WebSocket', error);
      }
      this.websocket = null;
    }

    // Mark session inactive
    this.sessionActive = false;

    this.logger.info('Session cleaned up');
  }
}
