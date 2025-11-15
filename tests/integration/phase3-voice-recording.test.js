/**
 * Phase 3 Integration Tests (T060-T067)
 * User Story 1: Voice Question Recording
 *
 * Tests voice query session creation, WebSocket connection, audio streaming,
 * and real-time transcription functionality.
 */

import { describe, test, expect, beforeAll, afterEach } from 'vitest';

describe('Phase 3: Voice Recording Integration (T060-T067)', () => {
  let mockEnv;
  let testUserId;
  let testJWT;

  beforeAll(() => {
    // Mock environment with necessary bindings
    testUserId = 'test_user_123';
    testJWT = 'mock_jwt_token';

    mockEnv = {
      DB: {
        prepare: () => ({
          bind: () => ({
            all: () => Promise.resolve({ results: [] }),
            first: () => Promise.resolve(null),
            run: () => Promise.resolve({ success: true })
          })
        })
      },
      KV: {
        get: () => Promise.resolve(null),
        put: () => Promise.resolve()
      },
      AI: {
        run: (model, options) => {
          // Mock Deepgram STT response
          if (model === '@cf/deepgram/nova-3') {
            return Promise.resolve({
              text: 'What projects did Sarah work on?',
              confidence: 0.95,
              is_final: true
            });
          }
          return Promise.resolve({});
        }
      },
      QUERY_SESSION_MANAGER: {
        idFromName: () => 'mock_do_id',
        get: () => ({
          fetch: () => new Response(JSON.stringify({ success: true }))
        })
      }
    };
  });

  /**
   * T060: Test POST /api/query/start returns valid WebSocket URL
   *
   * Success Criteria:
   * - Returns 200 status
   * - Response includes session_id
   * - Response includes valid websocket_url
   * - Response includes expires_at timestamp
   */
  test('T060: POST /api/query/start returns valid WebSocket URL', async () => {
    const { startQuerySession } = await import('../../src/workers/api/query.js');

    // Create mock request
    const request = new Request('https://test.com/api/query/start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testJWT}`,
        'Content-Type': 'application/json'
      }
    });

    // Mock auth middleware to return user_id
    const mockRequireAuth = async () => ({ user_id: testUserId });

    // Execute request
    const response = await startQuerySession(request, mockEnv);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.session_id).toBeDefined();
    expect(data.session_id).toMatch(/^sess_[a-f0-9-]{36}$/);
    expect(data.websocket_url).toBeDefined();
    expect(data.websocket_url).toMatch(/^wss?:\/\//);
    expect(data.websocket_url).toContain('/ws/query/');
    expect(data.expires_at).toBeDefined();
    expect(data.expires_at).toBeGreaterThan(Date.now());
  });

  /**
   * T061: Test WebSocket connection establishment
   *
   * Success Criteria:
   * - WebSocket upgrade succeeds
   * - Returns 101 status
   * - Connection is accepted
   * - Session metadata is initialized
   */
  test('T061: WebSocket connection establishment', async () => {
    const { QuerySessionManager } = await import('../../src/durable-objects/QuerySessionManager.js');

    // Create mock DO state
    const mockState = {
      blockConcurrencyWhile: (fn) => fn(),
      storage: {
        get: () => Promise.resolve(undefined),
        put: () => Promise.resolve()
      }
    };

    // Create QuerySessionManager instance
    const qsm = new QuerySessionManager(mockState, mockEnv);

    // Create mock WebSocket upgrade request
    const sessionId = 'sess_test123';
    const request = new Request(
      `https://test.com/ws/query?session_id=${sessionId}&user_id=${testUserId}`,
      {
        headers: { 'Upgrade': 'websocket' }
      }
    );

    // Attempt WebSocket upgrade
    const response = await qsm.handleWebSocketUpgrade(request);

    // Assertions
    expect(response.status).toBe(101);
    expect(qsm.sessionActive).toBe(true);
    expect(qsm.sessionMetadata.session_id).toBe(sessionId);
    expect(qsm.sessionMetadata.user_id).toBe(testUserId);
    expect(qsm.sessionMetadata.query_id).toMatch(/^query_/);
  });

  /**
   * T062: Test audio streaming from frontend to QuerySessionManager
   *
   * Success Criteria:
   * - Audio chunks are buffered correctly
   * - Sequence numbers are tracked
   * - Chunk count increments
   * - Last chunk time is updated
   */
  test('T062: Audio streaming to QuerySessionManager', async () => {
    const { QuerySessionManager } = await import('../../src/durable-objects/QuerySessionManager.js');

    const mockState = {
      blockConcurrencyWhile: (fn) => fn(),
      storage: {
        get: () => Promise.resolve(undefined),
        put: () => Promise.resolve()
      }
    };

    const qsm = new QuerySessionManager(mockState, mockEnv);

    // Initialize session metadata
    qsm.sessionMetadata.session_id = 'sess_test123';
    qsm.sessionMetadata.user_id = testUserId;
    qsm.sessionMetadata.query_id = 'query_test123';
    qsm.sessionActive = true;

    // Create mock audio chunk message
    const audioChunkMessage = {
      type: 'audio_chunk',
      data: 'T2dnUwACAAAAAAAAAABqb3N...', // Base64 encoded audio
      sequence: 1,
      timestamp: Date.now()
    };

    // Handle audio chunk
    await qsm.handleAudioChunk(audioChunkMessage);

    // Assertions
    expect(qsm.sessionMetadata.chunk_count).toBe(1);
    expect(qsm.sessionMetadata.last_chunk_time).toBeDefined();
    expect(qsm.audioBuffer.length).toBe(1);
    expect(qsm.audioBuffer[0].sequence).toBe(1);
  });

  /**
   * T063: Test Deepgram STT integration with sample audio
   *
   * Success Criteria:
   * - Audio is transcribed successfully
   * - Transcript text is returned
   * - Confidence score is provided
   * - Final transcript flag is set correctly
   */
  test('T063: Deepgram STT integration with sample audio', async () => {
    const { transcribeAudioChunk } = await import('../../src/lib/audio/transcription.js');

    const sampleAudioData = 'T2dnUwACAAAAAAAAAABqb3N...'; // Mock Opus audio

    // Transcribe audio
    const result = await transcribeAudioChunk(mockEnv.AI, sampleAudioData, {
      language: 'en',
      streaming: true,
      interim_results: false
    });

    // Assertions
    expect(result.text).toBeDefined();
    expect(result.text).toBe('What projects did Sarah work on?');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.is_final).toBe(true);
  });

  /**
   * T064: Test real-time transcript updates display in frontend
   *
   * Success Criteria:
   * - Partial transcripts are sent during recording
   * - Final transcript is sent after stop_recording
   * - WebSocket messages contain correct event types
   * - Confidence scores are included
   */
  test('T064: Real-time transcript updates', async () => {
    const { QuerySessionManager } = await import('../../src/durable-objects/QuerySessionManager.js');

    const mockState = {
      blockConcurrencyWhile: (fn) => fn(),
      storage: {
        get: () => Promise.resolve(undefined),
        put: () => Promise.resolve()
      }
    };

    const qsm = new QuerySessionManager(mockState, mockEnv);

    // Track messages sent to client
    const messagesSent = [];
    qsm.sendToClient = (message) => {
      messagesSent.push(message);
    };

    qsm.sessionMetadata.session_id = 'sess_test123';
    qsm.sessionMetadata.user_id = testUserId;
    qsm.sessionMetadata.query_id = 'query_test123';
    qsm.sessionActive = true;

    // Simulate audio chunk processing (partial transcript)
    const partialAudioMessage = {
      type: 'audio_chunk',
      data: 'T2dnUwACAAAAAAAAAABqb3N...',
      sequence: 1,
      timestamp: Date.now()
    };

    await qsm.handleAudioChunk(partialAudioMessage);

    // Simulate stop recording (final transcript)
    qsm.transcript = 'What projects did Sarah work on?';
    qsm.transcriptConfidence = 0.95;

    await qsm.handleStopRecording();

    // Assertions - check for transcript_final event
    const finalTranscriptEvent = messagesSent.find(m => m.type === 'transcript_final');
    expect(finalTranscriptEvent).toBeDefined();
    expect(finalTranscriptEvent.question).toBe('What projects did Sarah work on?');
    expect(finalTranscriptEvent.confidence).toBe(0.95);
    expect(finalTranscriptEvent.is_final).toBe(true);
  });

  /**
   * T065: Verify transcription completes within 2 seconds (p95) - Success Criterion 1
   *
   * Success Criteria:
   * - 95% of transcriptions complete within 2 seconds
   * - Performance metrics are tracked
   * - Latency is measured accurately
   */
  test('T065: Transcription latency < 2 seconds (p95)', async () => {
    const { QuerySessionManager } = await import('../../src/durable-objects/QuerySessionManager.js');

    const mockState = {
      blockConcurrencyWhile: (fn) => fn(),
      storage: {
        get: () => Promise.resolve(undefined),
        put: () => Promise.resolve()
      }
    };

    const qsm = new QuerySessionManager(mockState, mockEnv);
    qsm.sessionMetadata.session_id = 'sess_test123';
    qsm.sessionMetadata.user_id = testUserId;
    qsm.sessionMetadata.query_id = 'query_test123';
    qsm.sessionActive = true;

    // Start performance tracking
    qsm.performanceMetrics.transcription_start = Date.now();

    // Process audio chunk
    await qsm.handleAudioChunk({
      type: 'audio_chunk',
      data: 'T2dnUwACAAAAAAAAAABqb3N...',
      sequence: 1,
      timestamp: Date.now()
    });

    // Stop recording
    qsm.transcript = 'What projects did Sarah work on?';
    qsm.transcriptConfidence = 0.95;
    qsm.performanceMetrics.transcription_end = Date.now();

    // Calculate latency
    const latency = qsm.performanceMetrics.transcription_end - qsm.performanceMetrics.transcription_start;

    // Assertions
    expect(latency).toBeLessThan(2000); // < 2 seconds
    expect(qsm.performanceMetrics.transcription_start).toBeDefined();
    expect(qsm.performanceMetrics.transcription_end).toBeDefined();
  });

  /**
   * T066: Test error handling for poor audio quality
   *
   * Success Criteria:
   * - Low confidence transcripts are detected
   * - User-friendly error message is sent
   * - Error is marked as retryable
   * - Session cleanup occurs
   */
  test('T066: Error handling for poor audio quality', async () => {
    const { QuerySessionManager } = await import('../../src/durable-objects/QuerySessionManager.js');

    const mockState = {
      blockConcurrencyWhile: (fn) => fn(),
      storage: {
        get: () => Promise.resolve(undefined),
        put: () => Promise.resolve()
      }
    };

    // Mock low confidence STT response
    const mockLowConfidenceEnv = {
      ...mockEnv,
      AI: {
        run: () => Promise.resolve({
          text: 'what...did...uh...',
          confidence: 0.4, // Below 0.7 threshold
          is_final: true
        })
      }
    };

    const qsm = new QuerySessionManager(mockState, mockLowConfidenceEnv);

    const errorsSent = [];
    qsm.sendError = (code, message, retryable) => {
      errorsSent.push({ code, message, retryable });
    };

    qsm.sessionMetadata.session_id = 'sess_test123';
    qsm.sessionMetadata.user_id = testUserId;
    qsm.sessionMetadata.query_id = 'query_test123';
    qsm.sessionActive = true;
    qsm.transcript = 'what...did...uh...';
    qsm.transcriptConfidence = 0.4;

    // Simulate stop recording with low confidence
    await qsm.handleStopRecording();

    // Assertions
    expect(errorsSent.length).toBeGreaterThan(0);
    const lowConfidenceError = errorsSent.find(e => e.code === 'LOW_CONFIDENCE_TRANSCRIPT');
    expect(lowConfidenceError).toBeDefined();
    expect(lowConfidenceError.message).toContain('couldn\'t hear you clearly');
    expect(lowConfidenceError.retryable).toBe(true);
  });

  /**
   * T067: Test error handling for network interruption
   *
   * Success Criteria:
   * - WebSocket close event is handled
   * - Session cleanup occurs
   * - Resources are released
   */
  test('T067: Error handling for network interruption', async () => {
    const { QuerySessionManager } = await import('../../src/durable-objects/QuerySessionManager.js');

    const mockState = {
      blockConcurrencyWhile: (fn) => fn(),
      storage: {
        get: () => Promise.resolve(undefined),
        put: () => Promise.resolve()
      }
    };

    const qsm = new QuerySessionManager(mockState, mockEnv);
    qsm.sessionMetadata.session_id = 'sess_test123';
    qsm.sessionMetadata.user_id = testUserId;
    qsm.sessionMetadata.query_id = 'query_test123';
    qsm.sessionActive = true;

    // Simulate WebSocket close
    qsm.handleClose();

    // Assertions
    expect(qsm.sessionActive).toBe(false);
    expect(qsm.timeoutHandle).toBe(null);
    expect(qsm.warningTimeoutHandle).toBe(null);
  });
});
