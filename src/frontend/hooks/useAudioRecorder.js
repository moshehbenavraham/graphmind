import { useState, useRef, useCallback, useEffect } from 'react';
import { createLogger } from '../utils/logger';

/**
 * useAudioRecorder Hook
 *
 * Unified audio recording abstraction for voice capture.
 * Supports two capture modes:
 * - 'pcm': AudioWorklet (preferred) or ScriptProcessor (fallback) with raw PCM Int16 data
 * - 'webm': MediaRecorder with WebM/Opus encoding (for file-based capture)
 *
 * Phase 4 Update: Uses AudioWorklet for better performance and lower latency.
 * Falls back to deprecated ScriptProcessor for browsers without AudioWorklet support.
 *
 * @param {Object} options - Configuration options
 * @param {number} options.sampleRate - Audio sample rate (default: 16000)
 * @param {number} options.channelCount - Number of audio channels (default: 1)
 * @param {'pcm'|'webm'} options.captureMode - Audio capture mode (default: 'pcm')
 * @param {number} options.bufferSize - Buffer size for PCM capture (default: 4096)
 * @param {Function} options.onChunk - Callback for audio chunks (receives { data, sequence, timestamp })
 * @param {Function} options.onComplete - Callback when recording completes
 * @param {Function} options.onError - Callback for errors
 * @param {Function} options.onPermissionChange - Callback for permission state changes
 *
 * @returns {Object} Audio recorder utilities
 */
export const useAudioRecorder = (options = {}) => {
  const {
    sampleRate = 16000,
    channelCount = 1,
    captureMode = 'pcm',
    bufferSize = 4096,
    onChunk,
    onComplete,
    onError,
    onPermissionChange,
  } = options;

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permissionState, setPermissionState] = useState('prompt');
  const [error, setError] = useState(null);

  // Refs
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null); // ScriptProcessor (fallback)
  const workletNodeRef = useRef(null); // AudioWorkletNode (preferred)
  const sourceRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const chunkSequenceRef = useRef(0);
  const audioChunksRef = useRef([]);
  const isRecordingRef = useRef(false);
  const useWorkletRef = useRef(false); // Track if AudioWorklet is being used
  const pendingChunkPromisesRef = useRef(new Set()); // Track async chunk conversions (WebM)

  const logger = createLogger('useAudioRecorder');

  // Audio configuration
  // NOTE: Use "ideal" constraints instead of exact numbers to avoid OverconstrainedError
  // on browsers/devices that can't satisfy the requested sample rate/channel count.
  const preferredAudioConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: { ideal: sampleRate },
    channelCount: { ideal: channelCount },
  };

  // Fallback constraints if the browser rejects the preferred constraints
  const fallbackAudioConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  /**
   * Pick the best supported MediaRecorder MIME type.
   * Some browsers (notably Safari) do not support WebM/Opus and require MP4.
   *
   * @returns {string|null}
   */
  const getBestRecordingMimeType = useCallback(() => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    if (typeof window === 'undefined' || !window.MediaRecorder) {
      return null;
    }

    if (typeof MediaRecorder.isTypeSupported !== 'function') {
      // Older implementations may not expose isTypeSupported; let the constructor decide.
      return null;
    }

    for (const type of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      } catch {
        // Ignore and continue trying other candidates
      }
    }

    return null;
  }, []);

  /**
   * Convert Float32Array to Int16Array (PCM conversion)
   */
  const float32ToInt16 = useCallback((float32Array) => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }, []);

  /**
   * Convert ArrayBuffer to Base64
   */
  const arrayBufferToBase64 = useCallback((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }, []);

  /**
   * Format duration as MM:SS
   */
  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Update permission state and notify
   */
  const updatePermissionState = useCallback(
    (state) => {
      setPermissionState(state);
      onPermissionChange?.(state);
    },
    [onPermissionChange]
  );

  /**
   * Check microphone permission status
   */
  const checkPermission = useCallback(async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' });
        updatePermissionState(result.state);

        result.addEventListener('change', () => {
          updatePermissionState(result.state);
        });

        return result.state;
      }
      return 'prompt';
    } catch (err) {
      logger.warn('permission.check_failed', 'Permission API not supported', {
        message: err.message,
      });
      return 'prompt';
    }
  }, [updatePermissionState]);

  /**
   * Request microphone permission and get stream
   */
  const requestPermission = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          'Your browser does not support audio recording. Please use a modern browser.'
        );
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: preferredAudioConstraints,
        });
      } catch (err) {
        // Retry with relaxed constraints for browsers that reject sampleRate/channelCount
        if (err?.name === 'OverconstrainedError' || err?.name === 'ConstraintNotSatisfiedError') {
          logger.warn('permission.constraints_fallback', 'Preferred audio constraints rejected, retrying with fallback', {
            name: err?.name,
            message: err?.message,
            constraint: err?.constraint,
          });

          stream = await navigator.mediaDevices.getUserMedia({
            audio: fallbackAudioConstraints,
          });
        } else {
          throw err;
        }
      }

      mediaStreamRef.current = stream;
      updatePermissionState('granted');

      return stream;
    } catch (err) {
      let errorMessage = '';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage =
          'Microphone permission denied. Please allow microphone access in your browser settings.';
        updatePermissionState('denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage =
          'Microphone is already in use by another application. Please close other apps using the microphone.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage =
          'Could not initialize microphone with required settings. Your microphone may not support the required sample rate.';
      } else {
        errorMessage = err.message || 'Failed to access microphone. Please check your device settings.';
      }

      setError(errorMessage);
      onError?.(new Error(errorMessage));
      throw err;
    }
  }, [preferredAudioConstraints, fallbackAudioConstraints, updatePermissionState, onError]);

  /**
   * Start timer
   */
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDuration(elapsed);
    }, 1000);
  }, []);

  /**
   * Stop timer
   */
  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  /**
   * Check if AudioWorklet is supported
   */
  const isAudioWorkletSupported = useCallback(() => {
    return (
      typeof window !== 'undefined' &&
      window.AudioContext &&
      typeof AudioWorkletNode !== 'undefined'
    );
  }, []);

  /**
   * Setup PCM capture with AudioWorklet (preferred) or ScriptProcessor (fallback)
   *
   * Phase 4: AudioWorklet provides better performance:
   * - Runs in separate audio thread (no main thread blocking)
   * - Lower latency audio processing
   * - More predictable timing
   */
  const setupPcmCapture = useCallback(
    async (stream) => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Try AudioWorklet first (modern browsers)
      if (isAudioWorkletSupported()) {
        try {
          // Load the worklet module
          await audioContext.audioWorklet.addModule('/audio/pcm-processor.js');

          // Create the worklet node
          const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor', {
            processorOptions: {
              bufferSize,
              channelCount,
            },
          });

          // Handle messages from the worklet
          workletNode.port.onmessage = (event) => {
            if (!isRecordingRef.current) return;

            if (event.data.type === 'audio_chunk') {
              const pcmData = new Int16Array(event.data.pcmData);
              const base64Audio = arrayBufferToBase64(pcmData.buffer);

              audioChunksRef.current.push(pcmData);

              onChunk?.({
                data: base64Audio,
                rawData: pcmData,
                sequence: event.data.sequence,
                timestamp: event.data.timestamp,
              });
            }
          };

          // Connect the audio graph
          source.connect(workletNode);
          workletNode.connect(audioContext.destination);
          workletNodeRef.current = workletNode;
          useWorkletRef.current = true;

          // Signal the worklet to start processing
          workletNode.port.postMessage({ type: 'start' });

          logger.info('capture.pcm_setup', 'PCM capture initialized with AudioWorklet', {
            sampleRate,
            bufferSize,
            channelCount,
            method: 'AudioWorklet',
          });

          return;
        } catch (workletError) {
          logger.warn('capture.worklet_failed', 'AudioWorklet failed, falling back to ScriptProcessor', {
            error: workletError.message,
          });
          // Fall through to ScriptProcessor
        }
      }

      // Fallback: ScriptProcessor (deprecated but widely supported)
      // eslint-disable-next-line no-console
      console.warn(
        '[useAudioRecorder] Using deprecated ScriptProcessor. ' +
        'AudioWorklet is preferred for better performance.'
      );

      const processor = audioContext.createScriptProcessor(bufferSize, channelCount, channelCount);

      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = float32ToInt16(inputData);
        const base64Audio = arrayBufferToBase64(pcmData.buffer);

        audioChunksRef.current.push(pcmData);

        onChunk?.({
          data: base64Audio,
          rawData: pcmData,
          sequence: chunkSequenceRef.current++,
          timestamp: Date.now(),
        });
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      processorRef.current = processor;
      useWorkletRef.current = false;

      logger.info('capture.pcm_setup', 'PCM capture initialized with ScriptProcessor (fallback)', {
        sampleRate,
        bufferSize,
        channelCount,
        method: 'ScriptProcessor',
      });
    },
    [sampleRate, bufferSize, channelCount, float32ToInt16, arrayBufferToBase64, onChunk, isAudioWorkletSupported]
  );

  /**
   * Setup WebM capture with MediaRecorder
   */
  const setupWebmCapture = useCallback(
    async (stream) => {
      if (typeof window === 'undefined' || !window.MediaRecorder) {
        throw new Error(
          'Your browser does not support MediaRecorder audio capture. Please use a modern browser.'
        );
      }

      const mimeType = getBestRecordingMimeType();

      /** @type {MediaRecorderOptions} */
      const recorderOptions = {};
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, recorderOptions);
      } catch (creationError) {
        // Some browsers throw for unsupported mimeType; retry with default options.
        logger.warn('capture.webm_create_failed', 'Failed to create MediaRecorder with options, retrying with defaults', {
          mimeType,
          message: creationError?.message,
        });
        mediaRecorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size < 200) {
          logger.debug('capture.webm_chunk_skipped', 'Skipping tiny chunk', {
            size: event.data.size,
          });
          return;
        }

        if (event.data.size > 0) {
          // Convert Blob -> ArrayBuffer -> base64 without FileReader so we can await flush on stop()
          const processPromise = (async () => {
            const buffer = await event.data.arrayBuffer();
            const base64Audio = arrayBufferToBase64(buffer);

            audioChunksRef.current.push(event.data);

            onChunk?.({
              data: base64Audio,
              rawData: event.data,
              sequence: chunkSequenceRef.current++,
              timestamp: Date.now(),
              size: event.data.size,
            });
          })().catch((err) => {
            const errorMessage = err?.message || 'Failed to process audio chunk';
            logger.error('capture.webm_chunk_failed', 'Failed to convert WebM chunk', { message: errorMessage });
            setError(errorMessage);
            onError?.(err instanceof Error ? err : new Error(errorMessage));
          });

          // Track pending conversion so stop() can await all chunks before returning
          pendingChunkPromisesRef.current.add(processPromise);
          processPromise.finally(() => {
            pendingChunkPromisesRef.current.delete(processPromise);
          });
        }
      };

      mediaRecorder.onerror = (event) => {
        const errorMessage = event.error?.message || 'MediaRecorder error occurred';
        logger.error('capture.webm_error', 'MediaRecorder error', { message: errorMessage });
        setError(errorMessage);
        onError?.(new Error(errorMessage));
      };

      mediaRecorder.onstop = () => {
        logger.debug('capture.webm_stopped', 'MediaRecorder stopped');
      };

      logger.debug('capture.webm_setup', 'WebM capture initialized', {
        mimeType: mediaRecorder.mimeType || mimeType || 'browser_default',
      });

      return mediaRecorder;
    },
    [getBestRecordingMimeType, onChunk, onError]
  );

  /**
   * Start recording
   */
  const start = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);

      const initStart = performance.now();

      // Get or request media stream
      let stream = mediaStreamRef.current;
      if (!stream || !stream.active) {
        stream = await requestPermission();
      }

      // Setup capture based on mode
      if (captureMode === 'pcm') {
        await setupPcmCapture(stream);
      } else {
        const mediaRecorder = await setupWebmCapture(stream);
        // CRITICAL: Pass timeslice (500ms) to emit chunks during recording
        // Without timeslice, ondataavailable only fires on stop()
        mediaRecorder.start(500);
      }

      // Start timer
      startTimer();

      // Update state
      isRecordingRef.current = true;
      setIsRecording(true);
      chunkSequenceRef.current = 0;
      audioChunksRef.current = [];

      const latency = performance.now() - initStart;
      logger.info('recording.started', 'Recording started', {
        captureMode,
        latency_ms: latency.toFixed(2),
      });

      if (latency > 500) {
        logger.warn('recording.slow_start', 'Recording start latency exceeds target', {
          latency_ms: latency.toFixed(2),
          target_ms: 500,
        });
      }

      return true;
    } catch (err) {
      const errorMessage = err?.message || 'Failed to start recording.';
      logger.error('recording.start_failed', 'Failed to start recording', {
        message: errorMessage,
      });
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      setIsInitializing(false);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [requestPermission, captureMode, setupPcmCapture, setupWebmCapture, startTimer, onError]);

  /**
   * Stop recording
   */
  const stop = useCallback(async () => {
    try {
      isRecordingRef.current = false;
      stopTimer();

      // Stop AudioWorklet capture (if used)
      if (workletNodeRef.current) {
        workletNodeRef.current.port.postMessage({ type: 'stop' });
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
      }

      // Stop ScriptProcessor capture (if used)
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }

      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Stop WebM capture
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        const recorder = mediaRecorderRef.current;

        // Wait for MediaRecorder to fully stop (ensures final dataavailable has fired)
        const stopped = new Promise((resolve) => {
          const handleStop = () => resolve(true);
          try {
            recorder.addEventListener('stop', handleStop, { once: true });
          } catch {
            // Older implementations might not support addEventListener on MediaRecorder; fall back.
            recorder.onstop = () => resolve(true);
          }
        });

        try {
          recorder.stop();
        } catch (err) {
          logger.warn('capture.webm_stop_failed', 'MediaRecorder.stop() failed', { message: err?.message });
        }

        // Wait for stop event (best-effort)
        try {
          await stopped;
        } catch {
          // Ignore
        }
      }

      // Ensure any pending WebM chunk conversions have completed before returning
      if (pendingChunkPromisesRef.current.size > 0) {
        const pending = Array.from(pendingChunkPromisesRef.current);
        await Promise.allSettled(pending);
      }

      // Clear MediaRecorder ref after flush
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null;
      }

      setIsRecording(false);

      const recordingData = {
        duration,
        chunks: audioChunksRef.current,
        chunkCount: audioChunksRef.current.length,
        timestamp: new Date().toISOString(),
        captureMode,
        method: useWorkletRef.current ? 'AudioWorklet' : 'ScriptProcessor',
      };

      onComplete?.(recordingData);

      logger.info('recording.stopped', 'Recording stopped', {
        duration,
        chunkCount: recordingData.chunkCount,
        captureMode,
        method: recordingData.method,
      });

      // Reset duration
      setDuration(0);

      return recordingData;
    } catch (err) {
      logger.error('recording.stop_failed', 'Error stopping recording', {
        message: err.message,
      });
      setError('Failed to stop recording properly.');
      return null;
    }
  }, [duration, captureMode, stopTimer, onComplete, arrayBufferToBase64, onError]);

  /**
   * Toggle recording state
   */
  const toggle = useCallback(() => {
    if (isRecording) {
      return stop();
    } else {
      return start();
    }
  }, [isRecording, start, stop]);

  /**
   * Release all resources
   */
  const cleanup = useCallback(() => {
    stopTimer();

    // Cleanup AudioWorklet
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: 'stop' });
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Cleanup ScriptProcessor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    isRecordingRef.current = false;
    useWorkletRef.current = false;
    pendingChunkPromisesRef.current.clear();
    setIsRecording(false);
    setDuration(0);

    logger.debug('cleanup', 'Audio recorder resources released');
  }, [stopTimer]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // State
    isRecording,
    isInitializing,
    duration,
    formattedDuration: formatDuration(duration),
    permissionState,
    error,

    // Actions
    start,
    stop,
    toggle,
    cleanup,
    clearError,
    requestPermission,
    checkPermission,

    // Utilities
    formatDuration,
    float32ToInt16,
    arrayBufferToBase64,

    // Refs (for advanced usage)
    mediaStream: mediaStreamRef.current,
  };
};

export default useAudioRecorder;
