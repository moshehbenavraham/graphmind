/**
 * VoiceQueryRecorder Component (T050-T055)
 * Feature 008: Voice Query Input & Graph Querying
 *
 * Neo-Brutalist voice recorder for asking questions about the knowledge graph.
 * Uses design system components for brutalist styling.
 * Handles recording, real-time transcription, and query processing.
 *
 * Refactored to use useAudioRecorder hook for shared audio logic.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import {
  Button,
  Card,
  Badge,
  RecordingIndicator,
  BrutalWaveform,
  TerminalTranscript,
  cn,
} from '../design-system';

const VoiceQueryRecorder = ({ jwtToken, onQueryComplete, onError }) => {
  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [websocketUrl, setWebsocketUrl] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle', 'starting', 'listening', 'processing'
  const [transcript, setTranscript] = useState('');
  const [isTranscriptFinal, setIsTranscriptFinal] = useState(false);
  const [error, setError] = useState(null);

  // Track if we should be sending audio
  const shouldSendAudioRef = useRef(false);

  /**
   * Audio recorder hook - handles all audio capture logic
   */
  const {
    isRecording,
    isInitializing,
    formattedDuration,
    start: startAudioCapture,
    stop: stopAudioCapture,
    cleanup: cleanupAudio,
  } = useAudioRecorder({
    sampleRate: 16000,
    channelCount: 1,
    captureMode: 'pcm',
    bufferSize: 4096,
    onChunk: (chunk) => {
      // T053: Send audio chunks via WebSocket
      if (shouldSendAudioRef.current && isConnected) {
        send({
          type: 'audio_chunk',
          data: chunk.data,
          sequence: chunk.sequence,
          timestamp: chunk.timestamp,
        });
      }
    },
    onError: (err) => {
      setError(err.message);
      if (onError) onError(err);
    },
  });

  /**
   * Handle WebSocket messages from QuerySessionManager
   */
  const handleWebSocketMessage = useCallback(
    (data) => {
      console.log('[VoiceQueryRecorder] WebSocket message:', data.type);

      switch (data.type) {
        case 'recording_started':
          setStatus('listening');
          break;

        case 'transcript_update': // T054: Display real-time transcript
          setTranscript(data.partial_text || '');
          setIsTranscriptFinal(false);
          break;

        case 'transcript_final':
          setTranscript(data.question || '');
          setIsTranscriptFinal(true);
          setStatus('processing');
          break;

        case 'cypher_generating':
          setStatus('processing');
          break;

        case 'cypher_generated':
          // Query generated, waiting for execution
          break;

        case 'query_executing':
          setStatus('processing');
          break;

        case 'query_results':
          setStatus('idle');
          shouldSendAudioRef.current = false;
          stopAudioCapture();

          if (onQueryComplete) {
            onQueryComplete({
              queryId: data.query_id,
              question: transcript,
              results: data.results,
            });
          }
          break;

        case 'error':
          setError(data.message || 'An error occurred');
          setStatus('idle');
          shouldSendAudioRef.current = false;
          stopAudioCapture();

          if (onError) {
            onError(new Error(data.message));
          }
          break;

        default:
          console.warn('Unknown WebSocket message type:', data.type);
      }
    },
    [transcript, onQueryComplete, onError, stopAudioCapture]
  );

  /**
   * WebSocket connection management (T053)
   */
  const { isConnected, isConnecting, connect, disconnect, send } = useWebSocket(websocketUrl, {
    onMessage: handleWebSocketMessage,
    onOpen: () => {
      console.log('[VoiceQueryRecorder] WebSocket connected');
    },
    onClose: () => {
      console.log('[VoiceQueryRecorder] WebSocket closed');
      if (isRecording) {
        shouldSendAudioRef.current = false;
        stopAudioCapture();
        setStatus('idle');
      }
    },
    onError: (err) => {
      console.error('[VoiceQueryRecorder] WebSocket error:', err);
      setError('Connection error. Please try again.');
      if (onError) onError(err);
    },
    autoConnect: true, // useWebSocket will connect when websocketUrl is set
  });

  /**
   * T050: Initialize query session by calling POST /api/query/start
   */
  const initializeQuerySession = async () => {
    try {
      setStatus('starting');
      setError(null);

      const response = await fetch('/api/query/start', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start query session');
      }

      const data = await response.json();
      setSessionId(data.session_id);

      // Append JWT token to WebSocket URL for authentication
      const wsUrl = `${data.websocket_url}?token=${jwtToken}`;
      setWebsocketUrl(wsUrl);

      return data;
    } catch (err) {
      console.error('Failed to initialize query session:', err);
      setError(err.message);
      setStatus('idle');
      if (onError) onError(err);
      throw err;
    }
  };

  /**
   * T052: Start recording flow
   */
  const startRecording = async () => {
    try {
      // Step 1: Initialize session
      await initializeQuerySession();

      // Step 2: Start audio capture
      const started = await startAudioCapture();
      if (!started) {
        throw new Error('Failed to start audio capture');
      }

      // Mark that we should send audio chunks
      shouldSendAudioRef.current = true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      setStatus('idle');
    }
  };

  /**
   * Stop recording and send stop signal
   */
  const stopRecording = () => {
    // Send stop recording signal
    if (isConnected) {
      send({ type: 'stop_recording' });
    }

    shouldSendAudioRef.current = false;
    stopAudioCapture();
  };

  // NOTE: Removed manual connect useEffect - useWebSocket handles this with autoConnect: true

  /**
   * Cleanup on unmount only
   * IMPORTANT: Empty dependency array ensures this only runs on unmount,
   * not when function references change (which causes premature disconnection)
   */
  useEffect(() => {
    return () => {
      shouldSendAudioRef.current = false;
      cleanupAudio();
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Get status message for UI (T055)
   */
  const getStatusMessage = () => {
    switch (status) {
      case 'starting':
        return 'Initializing...';
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing your question...';
      default:
        return 'Ready to record';
    }
  };

  return (
    <div className="w-full p-6 bg-[#FFFEF0]">
      <Card className="max-w-2xl mx-auto">
        <Card.Body className="flex flex-col gap-6">
          {/* Error display */}
          {error && (
            <Badge variant="error" className="w-full justify-center py-3 text-sm">
              <svg
                className="w-5 h-5 mr-2 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </Badge>
          )}

          {/* T054: Real-time transcript display using TerminalTranscript */}
          <TerminalTranscript
            text={transcript}
            animate={!isTranscriptFinal}
            showCursor={isRecording || status === 'processing'}
            variant={isTranscriptFinal ? 'success' : 'default'}
            prompt={isTranscriptFinal ? '?' : '>'}
            minHeight={80}
            maxHeight={200}
          />

          {/* T055: Recording status indicators */}
          <div className="flex flex-col items-center gap-4">
            <RecordingIndicator
              variant="hazard"
              active={isRecording}
              size="lg"
              label={status === 'processing' ? 'PROCESSING' : 'REC'}
            />

            {/* Waveform visualization */}
            {isRecording && (
              <BrutalWaveform
                demo
                active={isRecording}
                variant="recording"
                barCount={32}
                height={64}
              />
            )}

            {/* Processing spinner */}
            {status === 'processing' && (
              <div className="flex items-center gap-3">
                <div className="loading-brutal w-6 h-6" />
                <span className="font-mono text-sm uppercase tracking-wider text-accent-primary">
                  {getStatusMessage()}
                </span>
              </div>
            )}

            {/* Status text */}
            <span
              className={cn(
                'font-mono text-sm font-bold uppercase tracking-wider',
                status === 'listening' ? 'text-status-error' : 'text-brutal-charcoal/70'
              )}
            >
              {getStatusMessage()}
            </span>

            {/* Timer */}
            {isRecording && (
              <div className="font-mono text-3xl font-bold tabular-nums text-status-error">
                {formattedDuration}
              </div>
            )}
          </div>

          {/* Record/Stop button */}
          <div className="flex flex-col items-center gap-3">
            <Button
              variant={isRecording ? 'danger' : 'primary'}
              size="lg"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={status === 'starting' || status === 'processing' || isInitializing}
              loading={status === 'starting' || isInitializing}
              className="w-20 h-20 p-0 flex items-center justify-center"
              aria-label={isRecording ? 'Stop recording' : 'Ask a question'}
            >
              {isRecording ? (
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
              ) : (
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
            </Button>

            <span className="font-mono text-sm font-bold uppercase tracking-wider text-brutal-charcoal">
              {isRecording ? 'Stop' : 'Ask a Question'}
            </span>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default VoiceQueryRecorder;
