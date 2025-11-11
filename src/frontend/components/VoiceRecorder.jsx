import React, { useState, useRef, useEffect } from 'react';
import '../styles/VoiceRecorder.css';

/**
 * VoiceRecorder Component (Tasks T033-T042)
 *
 * Basic voice recording component with microphone permission handling.
 * This is Phase 3 (US1) - focuses on audio capture and UI only.
 * WebSocket streaming and transcription will be added in Phase 4 (US2).
 *
 * Features:
 * - T034: Microphone permission request with getUserMedia
 * - T035: Permission denial handling with helpful messaging
 * - T036: Audio configuration (16kHz PCM mono)
 * - T037: Recording indicator with pulse animation
 * - T038: Recording timer in MM:SS format
 * - T039: Stop recording button functionality
 * - T040: Target <500ms recording start latency
 * - T041-T042: Cross-browser and mobile support
 */
const VoiceRecorder = ({ onAudioData, onRecordingComplete, onError }) => {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Refs for audio handling
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Audio configuration matching design requirements (T036)
  const AUDIO_CONFIG = {
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  };

  /**
   * Check microphone permission status on mount
   */
  useEffect(() => {
    checkPermissionStatus();

    return () => {
      cleanup();
    };
  }, []);

  /**
   * Check current microphone permission status
   */
  const checkPermissionStatus = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' });
        setPermissionState(result.state);

        // Listen for permission changes
        result.addEventListener('change', () => {
          setPermissionState(result.state);
        });
      }
    } catch (err) {
      console.warn('Permission API not supported:', err);
    }
  };

  /**
   * T034: Request microphone permission and initialize audio stream
   */
  const requestMicrophonePermission = async () => {
    try {
      setIsInitializing(true);
      setError(null);

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support audio recording. Please use a modern browser like Chrome, Firefox, or Safari.');
      }

      // T036: Request microphone access with 16kHz PCM mono configuration
      const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONFIG);

      mediaStreamRef.current = stream;
      setPermissionState('granted');

      return stream;
    } catch (err) {
      handlePermissionError(err);
      throw err;
    } finally {
      setIsInitializing(false);
    }
  };

  /**
   * T035: Handle permission and media errors
   */
  const handlePermissionError = (err) => {
    let errorMessage = '';

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings and try again.';
      setPermissionState('denied');
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMessage = 'No microphone found. Please connect a microphone and try again.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      errorMessage = 'Microphone is already in use by another application. Please close other apps using the microphone and try again.';
    } else if (err.name === 'OverconstrainedError') {
      errorMessage = 'Could not initialize microphone with required settings. Your microphone may not support 16kHz sample rate.';
    } else {
      errorMessage = err.message || 'Failed to access microphone. Please check your device settings.';
    }

    setError(errorMessage);

    if (onError) {
      onError(new Error(errorMessage));
    }
  };

  /**
   * T040: Start recording with <500ms latency target
   */
  const startRecording = async () => {
    try {
      const startInitTime = performance.now();

      // Get or request media stream
      let stream = mediaStreamRef.current;
      if (!stream || !stream.active) {
        stream = await requestMicrophonePermission();
      }

      // T036: Create AudioContext for PCM processing at 16kHz
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Create ScriptProcessor for raw PCM data
      // Note: ScriptProcessor is deprecated but widely supported
      // For production, consider using AudioWorklet for better performance
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

      processor.onaudioprocess = (e) => {
        if (isRecording) {
          const inputData = e.inputBuffer.getChannelData(0);
          // Convert Float32Array to Int16Array (PCM 16-bit)
          const pcmData = float32ToInt16(inputData);

          // Store audio chunks
          audioChunksRef.current.push(pcmData);

          // Callback with audio data if provided
          if (onAudioData) {
            onAudioData(pcmData);
          }
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      processorRef.current = processor;

      // T038: Start timer (MM:SS format)
      startTimeRef.current = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingTime(elapsed);
      }, 1000);

      setIsRecording(true);
      setError(null);

      // Log initialization latency for T040 verification
      const latency = performance.now() - startInitTime;
      console.log(`Recording started. Initialization latency: ${latency.toFixed(2)}ms`);

      if (latency > 500) {
        console.warn(`Warning: Recording start latency (${latency.toFixed(2)}ms) exceeds target of 500ms`);
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      handlePermissionError(err);
    }
  };

  /**
   * T039: Stop recording
   */
  const stopRecording = () => {
    try {
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

      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      setIsRecording(false);

      // Callback with recording metadata
      if (onRecordingComplete) {
        onRecordingComplete({
          duration: recordingTime,
          timestamp: new Date().toISOString(),
          audioChunks: audioChunksRef.current
        });
      }

      // Reset audio chunks and timer
      audioChunksRef.current = [];
      setRecordingTime(0);
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError('Failed to stop recording properly.');
    }
  };

  /**
   * Toggle recording state
   */
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  /**
   * Clean up resources
   */
  const cleanup = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  /**
   * Convert Float32Array to Int16Array (PCM conversion)
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
   * T038: Format time as MM:SS
   */
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * T035: Get helpful message for permission state
   */
  const getPermissionMessage = () => {
    if (permissionState === 'denied') {
      return (
        <div className="voice-recorder__permission-message voice-recorder__permission-message--denied">
          <p>Microphone access is blocked.</p>
          <p className="voice-recorder__permission-help">
            To enable microphone access:
          </p>
          <ul className="voice-recorder__permission-steps">
            <li>Click the lock icon in your browser's address bar</li>
            <li>Find "Microphone" in the permissions list</li>
            <li>Change the setting to "Allow"</li>
            <li>Refresh this page</li>
          </ul>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="voice-recorder">
      <div className="voice-recorder__container">
        {/* T035: Permission message */}
        {getPermissionMessage()}

        {/* T035: Error message */}
        {error && (
          <div className="voice-recorder__error" role="alert">
            <svg className="voice-recorder__error-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Recording controls */}
        <div className="voice-recorder__controls">
          {/* T037: Recording indicator with pulse animation */}
          {isRecording && (
            <div className="voice-recorder__indicator">
              <div className="voice-recorder__pulse"></div>
              <span className="voice-recorder__status">Recording</span>
            </div>
          )}

          {/* T038: Timer display (MM:SS format) */}
          <div className={`voice-recorder__timer ${isRecording ? 'voice-recorder__timer--active' : ''}`}>
            {formatTime(recordingTime)}
          </div>

          {/* T034, T039: Record/Stop button */}
          <button
            className={`voice-recorder__button ${isRecording ? 'voice-recorder__button--recording' : ''}`}
            onClick={toggleRecording}
            disabled={isInitializing || (permissionState === 'denied' && !mediaStreamRef.current)}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isInitializing ? (
              <div className="voice-recorder__spinner"></div>
            ) : isRecording ? (
              <svg className="voice-recorder__icon" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="voice-recorder__icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            )}
          </button>

          {/* Button label */}
          <div className="voice-recorder__label">
            {isInitializing ? 'Initializing...' : isRecording ? 'Stop Recording' : 'Start Recording'}
          </div>
        </div>

        {/* Permission prompt hint */}
        {!isRecording && permissionState === 'prompt' && !error && (
          <div className="voice-recorder__hint">
            Click the button to start recording. You will be asked for microphone permission.
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceRecorder;
