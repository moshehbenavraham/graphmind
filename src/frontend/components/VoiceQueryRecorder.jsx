/**
 * VoiceQueryRecorder Component (T050-T055)
 * Feature 008: Voice Query Input & Graph Querying
 *
 * Specialized voice recorder for asking questions about the knowledge graph.
 * Handles recording, real-time transcription, and query processing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import '../styles/VoiceQueryRecorder.css';

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
    <div className="voice-query-recorder">
      <div className="voice-query-recorder__container">
        {/* Error display */}
        {error && (
          <div className="voice-query-recorder__error" role="alert">
            <span className="voice-query-recorder__error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* T054: Real-time transcript display */}
        {transcript && (
          <div className={`voice-query-recorder__transcript ${isTranscriptFinal ? 'voice-query-recorder__transcript--final' : ''}`}>
            <div className="voice-query-recorder__transcript-label">
              {isTranscriptFinal ? 'Your Question:' : 'Hearing...'}
            </div>
            <div className="voice-query-recorder__transcript-text">
              "{transcript}"
            </div>
          </div>
        )}

        {/* T055: Recording status indicators */}
        <div className="voice-query-recorder__status">
          <div className={`voice-query-recorder__status-indicator voice-query-recorder__status-indicator--${status}`}>
            {status === 'listening' && <div className="voice-query-recorder__pulse"></div>}
          </div>
          <div className="voice-query-recorder__status-text">
            {getStatusMessage()}
          </div>
        </div>

        {/* Timer */}
        {isRecording && (
          <div className="voice-query-recorder__timer">
            {formatTime(recordingTime)}
          </div>
        )}

        {/* Record/Stop button */}
        <button
          className={`voice-query-recorder__button ${isRecording ? 'voice-query-recorder__button--recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={status === 'starting' || status === 'processing'}
          aria-label={isRecording ? 'Stop recording' : 'Ask a question'}
        >
          {isRecording ? (
            <svg className="voice-query-recorder__icon" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="voice-query-recorder__icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          )}
        </button>

        <div className="voice-query-recorder__label">
          {isRecording ? 'Stop' : 'Ask a Question'}
        </div>
      </div>
    </div>
  );
};

export default VoiceQueryRecorder;
