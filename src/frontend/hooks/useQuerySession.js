import { useState, useRef, useCallback, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { api } from '../utils/api';
import { createLogger } from '../utils/logger';

/**
 * Query session states
 */
export const QueryStatus = {
  IDLE: 'idle',
  STARTING: 'starting',
  RECORDING: 'recording',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
  ERROR: 'error',
};

/**
 * useQuerySession Hook
 *
 * Manages the voice query session lifecycle including:
 * - Session initialization via API
 * - WebSocket connection and message handling
 * - Query state machine (idle -> starting -> recording -> processing -> complete)
 * - Transcript and answer management
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onTranscriptUpdate - Callback for transcript updates
 * @param {Function} options.onAnswerReceived - Callback when answer is received
 * @param {Function} options.onGraphResults - Callback for graph query results
 * @param {Function} options.onError - Callback for errors
 * @param {Function} options.onStatusChange - Callback for status changes
 *
 * @returns {Object} Query session utilities
 */
export const useQuerySession = (options = {}) => {
  const {
    onTranscriptUpdate,
    onAnswerReceived,
    onGraphResults,
    onError,
    onStatusChange,
  } = options;

  // State
  const [status, setStatus] = useState(QueryStatus.IDLE);
  const [sessionId, setSessionId] = useState(null);
  const [queryId, setQueryId] = useState(null);
  const [websocketUrl, setWebsocketUrl] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [isTranscriptFinal, setIsTranscriptFinal] = useState(false);
  const [answer, setAnswer] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [graphData, setGraphData] = useState(null);
  const [error, setError] = useState('');

  // Refs
  const sessionMetaRef = useRef({});
  const startupTimerRef = useRef(null);
  const logger = createLogger('useQuerySession');

  /**
   * Update status and notify
   */
  const updateStatus = useCallback(
    (newStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  /**
   * Handle WebSocket messages
   */
  const handleWebSocketMessage = useCallback(
    (data) => {
      logger.debug('ws.message', 'Received message', { type: data.type });

      switch (data.type) {
        case 'recording_started':
          logger.info('ws.recording_started', 'Recording started', {
            session_id: data.session_id,
          });
          break;

        case 'transcript_update':
          setTranscript(data.partial_text || '');
          setIsTranscriptFinal(false);
          onTranscriptUpdate?.(data.partial_text || '', false);
          break;

        case 'transcript_final':
          const finalText = data.question || data.text || '';
          setTranscript(finalText);
          setIsTranscriptFinal(true);
          onTranscriptUpdate?.(finalText, true);
          break;

        case 'cypher_generating':
        case 'query_executing':
        case 'answer_generating':
          updateStatus(QueryStatus.PROCESSING);
          break;

        case 'cypher_generated':
          logger.info('ws.cypher', 'Cypher generated', {
            session_id: data.session_id,
            query_id: data.query_id,
          });
          if (data.query_id) {
            setQueryId(data.query_id);
          }
          break;

        case 'query_results':
          setGraphData(data.results);
          onGraphResults?.(data.results);
          break;

        case 'answer_generated':
          setAnswer(data.answer);
          updateStatus(QueryStatus.COMPLETE);
          onAnswerReceived?.(data.answer, data.audio_url);
          if (data.audio_url) {
            setAudioUrl(data.audio_url);
          }
          break;

        case 'answer_fallback':
          setAnswer(data.fallback_answer);
          updateStatus(QueryStatus.COMPLETE);
          onAnswerReceived?.(data.fallback_answer, null);
          break;

        case 'answer_error':
          const answerError = data.error || 'Failed to generate answer';
          setError(answerError);
          updateStatus(QueryStatus.ERROR);
          logger.error('ws.answer_error', 'Answer generation failed', {
            error: answerError,
          });
          onError?.(new Error(answerError));
          break;

        case 'audio_chunk':
          logger.debug('ws.audio_chunk', 'Audio chunk received', {
            chunk_index: data.chunk_index,
            bytes: data.bytes,
          });
          break;

        case 'audio_complete':
          logger.info('ws.audio_complete', 'Audio complete', {
            duration_ms: data.duration_ms,
          });
          if (data.audio_url) {
            setAudioUrl(data.audio_url);
          }
          break;

        case 'audio_error':
          logger.warn('ws.audio_error', 'Audio error', { message: data.message });
          break;

        case 'error':
          setError(data.message);
          updateStatus(QueryStatus.ERROR);
          logger.error('ws.error', 'Server error', { message: data.message });
          onError?.(new Error(data.message));
          break;

        case 'timeout_warning':
          logger.warn('ws.timeout_warning', 'Session timeout warning', {
            message: data.message,
          });
          break;

        default:
          logger.warn('ws.unknown', 'Unknown message type', { type: data.type });
      }
    },
    [updateStatus, onTranscriptUpdate, onAnswerReceived, onGraphResults, onError]
  );

  /**
   * WebSocket connection
   */
  const {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    send,
  } = useWebSocket(websocketUrl, {
    onMessage: handleWebSocketMessage,
    onOpen: () => {
      logger.info('ws.open', 'WebSocket connected', sessionMetaRef.current);
      updateStatus(QueryStatus.RECORDING);

      if (startupTimerRef.current) {
        startupTimerRef.current();
        startupTimerRef.current = null;
      }
    },
    onClose: (event) => {
      logger.info('ws.close', 'WebSocket closed', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });

      if (status === QueryStatus.RECORDING) {
        updateStatus(QueryStatus.IDLE);
      }
    },
    onError: (err) => {
      logger.error('ws.exception', 'WebSocket error', { message: err?.message });
      setError('Connection error. Please try again.');
      updateStatus(QueryStatus.ERROR);
      onError?.(err);
    },
    autoConnect: true, // useWebSocket will connect when websocketUrl is set
  });

  /**
   * Start a new query session
   */
  const startSession = useCallback(async () => {
    // CRITICAL: Prevent double session creation
    // This guards against rapid button clicks or React StrictMode double-invocation
    if (status !== QueryStatus.IDLE && status !== QueryStatus.ERROR && status !== QueryStatus.COMPLETE) {
      logger.warn('session.start_blocked', 'Session start blocked - already in progress', { status });
      return null;
    }

    // Also check if we already have an active WebSocket
    if (websocketUrl) {
      logger.warn('session.start_blocked', 'Session start blocked - WebSocket URL already set', {
        status,
        hasWebsocketUrl: true,
      });
      return null;
    }

    try {
      setError('');
      updateStatus(QueryStatus.STARTING);
      startupTimerRef.current = logger.timer('session.startup');

      // Initialize session via API
      const session = await api.startQuery();

      sessionMetaRef.current = {
        session_id: session.session_id,
        query_id: session.query_id || null,
      };

      setSessionId(session.session_id);
      if (session.query_id) {
        setQueryId(session.query_id);
      }

      logger.setContext(sessionMetaRef.current);
      logger.info('session.start', 'Query session started', sessionMetaRef.current);

      if (!session.websocket_url) {
        throw new Error('Server did not provide websocket_url');
      }

      // Get auth token
      const token = localStorage.getItem('jwt_token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      // Set WebSocket URL (will trigger connection via useEffect)
      const wsUrl = `${session.websocket_url}?token=${token}`;
      logger.debug('ws.connect', 'Setting WebSocket URL', {
        ...sessionMetaRef.current,
        url: wsUrl.replace(token, 'TOKEN_REDACTED'),
      });

      setWebsocketUrl(wsUrl);

      return session;
    } catch (err) {
      startupTimerRef.current = null;
      logger.error('session.start_failed', 'Error starting session', {
        message: err.message,
        code: err.name,
      });

      let userMessage = err.message || 'Failed to start session. Please try again.';
      setError(userMessage);
      updateStatus(QueryStatus.ERROR);
      onError?.(err);

      throw err;
    }
  }, [status, websocketUrl, updateStatus, onError]);

  /**
   * Send audio chunk via WebSocket
   */
  const sendAudioChunk = useCallback(
    (chunk, sequence, timestamp) => {
      if (!isConnected) {
        logger.warn('send.disconnected', 'Cannot send audio - WebSocket not connected');
        return false;
      }

      const message = {
        type: 'audio_chunk',
        chunk,
        sequence,
        timestamp: timestamp || Date.now(),
      };

      logger.trace('media.chunk.send', 'Sending audio chunk', {
        sequence,
        bytes: chunk.length,
      });

      return send(message);
    },
    [isConnected, send]
  );

  /**
   * Signal stop recording
   */
  const stopRecording = useCallback(() => {
    logger.info('recording.stop', 'Sending stop recording signal');

    if (isConnected) {
      send({ type: 'stop_recording' });
    }

    updateStatus(QueryStatus.PROCESSING);
  }, [isConnected, send, updateStatus]);

  /**
   * Reset session state
   */
  const reset = useCallback(() => {
    setTranscript('');
    setIsTranscriptFinal(false);
    setAnswer('');
    setAudioUrl('');
    setError('');
    setGraphData(null);
    setSessionId(null);
    setQueryId(null);
    setWebsocketUrl(null);
    updateStatus(QueryStatus.IDLE);

    sessionMetaRef.current = {};
    logger.setContext({});

    logger.debug('session.reset', 'Session state reset');
  }, [updateStatus]);

  /**
   * End session and cleanup
   */
  const endSession = useCallback(() => {
    disconnect();
    reset();
  }, [disconnect, reset]);

  // NOTE: Removed manual connect useEffect - useWebSocket handles this with autoConnect: true

  /**
   * Cleanup on unmount only
   * IMPORTANT: Empty dependency array ensures this only runs on unmount,
   * not when disconnect function reference changes (which causes premature disconnection)
   */
  useEffect(() => {
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // State
    status,
    sessionId,
    queryId,
    transcript,
    isTranscriptFinal,
    answer,
    audioUrl,
    graphData,
    error,

    // Connection state
    isConnected,
    isConnecting,

    // Derived state
    isIdle: status === QueryStatus.IDLE,
    isStarting: status === QueryStatus.STARTING,
    isRecording: status === QueryStatus.RECORDING,
    isProcessing: status === QueryStatus.PROCESSING,
    isComplete: status === QueryStatus.COMPLETE,
    isError: status === QueryStatus.ERROR,

    // Actions
    startSession,
    stopRecording,
    sendAudioChunk,
    reset,
    endSession,
    send,

    // WebSocket direct access (for advanced usage)
    disconnect,
  };
};

export default useQuerySession;
