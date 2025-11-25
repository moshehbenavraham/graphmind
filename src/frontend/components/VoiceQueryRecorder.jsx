/**
 * VoiceQueryRecorder Component (T050-T055)
 * Feature 008: Voice Query Input & Graph Querying
 *
 * Neo-Brutalist voice recorder for asking questions about the knowledge graph.
 * Uses design system components for brutalist styling.
 * Handles recording, real-time transcription, and query processing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
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
  // State management
  const [sessionId, setSessionId] = useState(null);
  const [websocketUrl, setWebsocketUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [status, setStatus] = useState('idle'); // 'idle', 'starting', 'listening', 'processing'
  const [transcript, setTranscript] = useState('');
  const [isTranscriptFinal, setIsTranscriptFinal] = useState(false);
  const [error, setError] = useState(null);

  // Audio handling refs
  const mediaStreamRef = React.useRef(null);
  const audioContextRef = React.useRef(null);
  const processorRef = React.useRef(null);
  const timerIntervalRef = React.useRef(null);

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
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start query session');
      }

      const data = await response.json();
      setSessionId(data.session_id);
      setWebsocketUrl(data.websocket_url);

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
   * Handle WebSocket messages from QuerySessionManager
   */
  const handleWebSocketMessage = useCallback((data) => {
    console.log('[VoiceQueryRecorder] WebSocket message:', data.type);

    switch (data.type) {
      case 'recording_started':
        setStatus('listening');
        setIsRecording(true);
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
        setIsRecording(false);
        stopRecording();

        if (onQueryComplete) {
          onQueryComplete({
            queryId: data.query_id,
            question: transcript,
            results: data.results
          });
        }
        break;

      case 'error':
        setError(data.message || 'An error occurred');
        setStatus('idle');
        setIsRecording(false);
        stopRecording();

        if (onError) {
          onError(new Error(data.message));
        }
        break;

      default:
        console.warn('Unknown WebSocket message type:', data.type);
    }
  }, [transcript, onQueryComplete, onError]);

  /**
   * WebSocket connection management (T053)
   */
  const {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    send
  } = useWebSocket(websocketUrl, {
    onMessage: handleWebSocketMessage,
    onOpen: () => {
      console.log('[VoiceQueryRecorder] WebSocket connected');
    },
    onClose: () => {
      console.log('[VoiceQueryRecorder] WebSocket closed');
      if (isRecording) {
        setIsRecording(false);
        setStatus('idle');
      }
    },
    onError: (err) => {
      console.error('[VoiceQueryRecorder] WebSocket error:', err);
      setError('Connection error. Please try again.');
      if (onError) onError(err);
    },
    autoConnect: false // Manual connection after session init
  });

  /**
   * T051: Request microphone permission
   */
  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStreamRef.current = stream;
      return stream;
    } catch (err) {
      let errorMessage = 'Microphone permission denied';

      if (err.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone.';
      }

      setError(errorMessage);
      if (onError) onError(new Error(errorMessage));
      throw err;
    }
  };

  /**
   * T052: Start recording with Opus encoding (simplified to PCM for now)
   */
  const startRecording = async () => {
    try {
      // Step 1: Initialize session
      await initializeQuerySession();

      // Step 2: Request microphone
      const stream = await requestMicrophonePermission();

      // Step 3: Set up audio processing
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(stream);

      // Use ScriptProcessor for audio chunks (for simplicity)
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

      let sequence = 0;

      processor.onaudioprocess = (e) => {
        if (isRecording && isConnected) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = float32ToInt16(inputData);
          const base64Audio = arrayBufferToBase64(pcmData.buffer);

          // T053: Send audio chunks via WebSocket
          send({
            type: 'audio_chunk',
            data: base64Audio,
            sequence: sequence++,
            timestamp: Date.now()
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      processorRef.current = processor;

      // Start timer (T055: Recording status indicators)
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      setIsRecording(true);
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

    // Stop timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setIsRecording(false);
    setRecordingTime(0);
  };

  /**
   * Connect WebSocket when URL is available
   */
  useEffect(() => {
    if (websocketUrl && !isConnected && !isConnecting) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [websocketUrl, isConnected, isConnecting, connect, disconnect]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopRecording();
      disconnect();
    };
  }, [disconnect]);

  /**
   * Utility: Convert Float32Array to Int16Array
   */
  const float32ToInt16 = (float32Array) => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  };

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  /**
   * Format time as MM:SS
   */
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
              <svg className="w-5 h-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
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
                {formatTime(recordingTime)}
              </div>
            )}
          </div>

          {/* Record/Stop button */}
          <div className="flex flex-col items-center gap-3">
            <Button
              variant={isRecording ? 'danger' : 'primary'}
              size="lg"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={status === 'starting' || status === 'processing'}
              loading={status === 'starting'}
              className="w-20 h-20 p-0 flex items-center justify-center"
              aria-label={isRecording ? 'Stop recording' : 'Ask a question'}
            >
              {isRecording ? (
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
              ) : (
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
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
