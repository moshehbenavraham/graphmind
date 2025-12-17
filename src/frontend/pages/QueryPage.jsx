import { useRef, useCallback, useEffect } from 'react';
import Navigation from '../components/Navigation';
import { useQuerySession, QueryStatus } from '../hooks/useQuerySession';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { createLogger } from '../utils/logger';
import {
  GlitchText,
  Card,
  Button,
  Badge,
  RecordingIndicator,
  BrutalWaveform,
  TerminalTranscript,
} from '../design-system';

const logger = createLogger('QueryPage');

/**
 * QueryPage Component
 *
 * Voice-first query interface for asking questions about the knowledge graph.
 * Uses Neo-Brutalist design system for consistent styling.
 *
 * Refactored to use:
 * - useQuerySession: Session management, WebSocket, state machine
 * - useAudioRecorder: Audio capture with WebM/Opus encoding
 */
function QueryPage() {
  // Refs for audio metrics
  const audioMetricsRef = useRef(null);
  const chunkSequenceRef = useRef(0);
  const pendingChunksRef = useRef([]); // buffer chunks until WS connects
  const pendingStopRef = useRef(false); // defer stop_recording until WS connects
  const isConnectedRef = useRef(false);

  /**
   * Query session hook - manages WebSocket and query state
   */
  const {
    status,
    transcript,
    answer,
    audioUrl,
    graphData,
    error,
    isConnected,
    isRecording: sessionRecording,
    isProcessing,
    isComplete,
    startSession,
    stopRecording: signalStopRecording,
    sendAudioChunk,
    reset,
    endSession,
  } = useQuerySession({
    onError: (err) => {
      logger.error('session.error', 'Session error', { message: err.message });
    },
  });

  // Keep connection state in a ref so audio callbacks don't capture stale values
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Flush any buffered chunks once the WebSocket is connected
  useEffect(() => {
    if (!isConnected) return;
    if (!pendingChunksRef.current.length) return;

    const buffered = pendingChunksRef.current;
    pendingChunksRef.current = [];

    logger.info('media.chunk.flush', 'Flushing buffered audio chunks', { count: buffered.length });

    for (const entry of buffered) {
      const sequence = chunkSequenceRef.current++;
      sendAudioChunk(entry.data, sequence, entry.timestamp);

      if (audioMetricsRef.current) {
        audioMetricsRef.current.chunkCount += 1;
        audioMetricsRef.current.totalBytes += entry.size || entry.data.length;
      }
    }

    // If user already stopped while connecting, send stop now after flushing
    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      signalStopRecording();
    }
  }, [isConnected, sendAudioChunk, signalStopRecording]);

  /**
   * Audio recorder hook - handles MediaRecorder with WebM/Opus
   */
  const {
    isRecording,
    isInitializing,
    start: startAudioCapture,
    stop: stopAudioCapture,
    cleanup: cleanupAudio,
    error: recorderError,
  } = useAudioRecorder({
    sampleRate: 16000,
    channelCount: 1,
    captureMode: 'webm',
    onChunk: (chunk) => {
      // Skip tiny chunks
      if (chunk.size && chunk.size < 200) {
        if (audioMetricsRef.current) {
          audioMetricsRef.current.tinyChunks += 1;
        }
        logger.debug('media.chunk.skipped', 'Skipping tiny audio chunk', {
          size: chunk.size,
        });
        return;
      }

      // Send audio chunk via WebSocket
      if (isConnectedRef.current) {
        const sequence = chunkSequenceRef.current++;
        sendAudioChunk(chunk.data, sequence, chunk.timestamp);

        if (audioMetricsRef.current) {
          audioMetricsRef.current.chunkCount += 1;
          audioMetricsRef.current.totalBytes += chunk.size || chunk.data.length;
        }
        return;
      }

      // Buffer chunks while connecting to avoid losing early audio
      pendingChunksRef.current.push({
        data: chunk.data,
        timestamp: chunk.timestamp,
        size: chunk.size,
      });

      // Bound memory usage (keep last ~30 chunks = ~15s @ 500ms)
      if (pendingChunksRef.current.length > 30) {
        pendingChunksRef.current.shift();
      }

      if (audioMetricsRef.current) {
        audioMetricsRef.current.droppedChunks += 1; // preserved metric name; this is now "buffered while disconnected"
      }
      logger.warn('media.chunk.buffered', 'Buffered chunk - WebSocket not connected yet');
    },
    onComplete: (recordingData) => {
      if (audioMetricsRef.current) {
        logger.info('media.summary', 'Audio capture summary', {
          chunks: audioMetricsRef.current.chunkCount,
          dropped_chunks: audioMetricsRef.current.droppedChunks,
          tiny_chunks: audioMetricsRef.current.tinyChunks,
          total_bytes: audioMetricsRef.current.totalBytes,
          duration: recordingData.duration,
        });
      }
    },
    onError: (err) => {
      logger.error('audio.error', 'Audio capture error', { message: err.message });
    },
  });

  /**
   * Start recording flow
   */
  const handleStartRecording = useCallback(async () => {
    try {
      // Reset metrics
      audioMetricsRef.current = {
        startedAt: performance.now(),
        chunkCount: 0,
        totalBytes: 0,
        droppedChunks: 0,
        tinyChunks: 0,
      };
      chunkSequenceRef.current = 0;

      // Start query session (gets WebSocket URL)
      await startSession();

      // Start audio capture
      const started = await startAudioCapture();
      if (!started) {
        // Audio capture failed (e.g. unsupported MIME type / permission / constraints)
        logger.error('recording.audio_failed', 'Audio capture failed to start');
        cleanupAudio();
        pendingChunksRef.current = [];
        pendingStopRef.current = false;
        chunkSequenceRef.current = 0;
        endSession();
        return;
      }

      logger.info('recording.started', 'Recording started');
    } catch (err) {
      logger.error('recording.start_failed', 'Failed to start recording', {
        message: err.message,
      });
      cleanupAudio();
      pendingChunksRef.current = [];
      pendingStopRef.current = false;
      chunkSequenceRef.current = 0;
      endSession();
    }
  }, [startSession, startAudioCapture, cleanupAudio, endSession]);

  /**
   * Stop recording flow
   */
  const handleStopRecording = useCallback(async () => {
    logger.info('recording.stop', 'Stopping recording');

    // Stop audio capture
    await stopAudioCapture();

    // Signal stop to backend
    if (isConnectedRef.current) {
      signalStopRecording();
    } else {
      // Connection isn't ready yet; send stop as soon as it connects (after flushing buffered chunks)
      pendingStopRef.current = true;
      logger.warn('recording.stop_deferred', 'Deferring stop_recording until WebSocket connects');
    }
  }, [stopAudioCapture, signalStopRecording]);

  /**
   * Reset query
   */
  const handleReset = useCallback(() => {
    cleanupAudio();
    reset();
    audioMetricsRef.current = null;
    chunkSequenceRef.current = 0;
    pendingChunksRef.current = [];
    pendingStopRef.current = false;
  }, [cleanupAudio, reset]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  // Determine if actively recording
  const isActivelyRecording = isRecording || sessionRecording;

  // Status text
  const getStatusText = () => {
    switch (status) {
      case QueryStatus.IDLE:
        return 'Click to start voice recording';
      case QueryStatus.STARTING:
        return 'Connecting...';
      case QueryStatus.RECORDING:
        return 'Listening... Click to stop';
      case QueryStatus.PROCESSING:
        return 'Generating answer...';
      case QueryStatus.COMPLETE:
        return 'Query complete';
      case QueryStatus.ERROR:
        return 'Error occurred';
      default:
        return '';
    }
  };

  // Button text
  const getButtonText = () => {
    if (isInitializing || status === QueryStatus.STARTING) {
      return 'Starting...';
    }
    if (isActivelyRecording) {
      return 'Stop Recording';
    }
    if (isProcessing) {
      return 'Processing...';
    }
    return 'Start Recording';
  };

  return (
    <div className="min-h-screen bg-[#FFFEF0]">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Page Header */}
        <GlitchText as="h1" className="text-3xl md:text-4xl mb-8">
          Ask a Question
        </GlitchText>

        {/* Recording Card */}
        <Card className="mb-8">
          <Card.Body className="flex flex-col items-center py-8">
            {/* Recording Indicator */}
            {isActivelyRecording && (
              <RecordingIndicator
                variant="hazard"
                active={isActivelyRecording}
                size="lg"
                className="mb-6"
              />
            )}

            {/* Waveform Visualization */}
            <BrutalWaveform
              demo={isActivelyRecording}
              active={isActivelyRecording}
              variant={isActivelyRecording ? 'recording' : 'waveform'}
              barCount={32}
              height={80}
              className="mb-6"
            />

            {/* Record Button */}
            <Button
              onClick={isActivelyRecording ? handleStopRecording : handleStartRecording}
              disabled={isProcessing || isInitializing || status === QueryStatus.STARTING}
              loading={isInitializing || status === QueryStatus.STARTING || isProcessing}
              variant={isActivelyRecording ? 'danger' : 'primary'}
              size="lg"
              className="w-48 h-16 text-lg mb-4"
            >
              {getButtonText()}
            </Button>

            {/* Status Text */}
            <p className="text-brutal-charcoal/70 text-center font-mono text-sm">
              {getStatusText()}
            </p>
          </Card.Body>
        </Card>

        {/* Error Display */}
        {(error || recorderError) && (
          <Card className="mb-8 border-status-error">
            <Card.Body className="bg-status-error/10">
              <Badge variant="error" className="mb-2">
                Error
              </Badge>
              {recorderError && (
                <p className="text-brutal-charcoal font-mono text-sm">{recorderError}</p>
              )}
              {error && error !== recorderError && (
                <p className="text-brutal-charcoal font-mono text-sm">{error}</p>
              )}
            </Card.Body>
          </Card>
        )}

        {/* Transcript Display */}
        {(transcript || status === QueryStatus.RECORDING) && (
          <div className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brutal-charcoal/70 mb-3">
              Your Question
            </h2>
            <TerminalTranscript
              text={transcript}
              animate={status === QueryStatus.RECORDING}
              showPrompt
              prompt=">"
              variant="default"
              minHeight={80}
              maxHeight={200}
            />
          </div>
        )}

        {/* Answer Display */}
        {answer && (
          <Card className="mb-8">
            <Card.Header>
              <h2 className="text-sm font-bold uppercase tracking-wider">Answer</h2>
            </Card.Header>
            <Card.Body>
              <p className="text-brutal-charcoal font-mono text-sm leading-relaxed mb-4">
                {answer}
              </p>

              {audioUrl && (
                <audio controls src={audioUrl} className="w-full">
                  Your browser does not support audio playback.
                </audio>
              )}
            </Card.Body>
          </Card>
        )}

        {/* Graph Data Display */}
        {graphData && (
          <Card className="mb-8" variant="dark">
            <Card.Header>
              <h2 className="text-sm font-bold uppercase tracking-wider text-accent-primary">
                Knowledge Graph Data
              </h2>
            </Card.Header>
            <Card.Body>
              <pre className="font-mono text-xs text-status-success overflow-auto max-h-64 p-4 bg-brutal-black border-2 border-status-success">
                {JSON.stringify(graphData, null, 2)}
              </pre>
            </Card.Body>
          </Card>
        )}

        {/* Reset Button */}
        {isComplete && (
          <Button onClick={handleReset} variant="primary" className="w-full">
            Ask Another Question
          </Button>
        )}
      </div>
    </div>
  );
}

export default QueryPage;
