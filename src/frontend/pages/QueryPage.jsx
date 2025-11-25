import { useState, useRef, useEffect } from 'react';
import Navigation from '../components/Navigation';
import { api } from '../utils/api';
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

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8787';
const logger = createLogger('QueryPage');
const nowMs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

function QueryPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle');
  const [graphData, setGraphData] = useState(null);

  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const chunkSequenceRef = useRef(0);
  const sessionMetaRef = useRef({});
  const audioMetricsRef = useRef(null);
  const startupTimerRef = useRef(null);
  const stoppingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError('');
      setStatus('starting');
      startupTimerRef.current = logger.timer('session.startup');
      audioMetricsRef.current = null;

      // Start query session
      const session = await api.startQuery();
      sessionMetaRef.current = {
        session_id: session.session_id,
        query_id: session.query_id || null
      };
      logger.setContext(sessionMetaRef.current);
      logger.info('session.start', 'Query session started', sessionMetaRef.current);

      if (!session.websocket_url) {
        throw new Error('Server did not provide websocket_url');
      }

      const token = localStorage.getItem('jwt_token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const wsUrl = `${session.websocket_url}?token=${token}`;
      logger.debug('ws.connect', 'Connecting to WebSocket', {
        ...sessionMetaRef.current,
        url: wsUrl.replace(token, 'TOKEN_REDACTED')
      });
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        logger.info('ws.open', 'WebSocket connected', sessionMetaRef.current);
        setStatus('recording');
        if (startupTimerRef.current) {
          startupTimerRef.current();
          startupTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (err) {
          logger.warn('ws.parse_failed', 'Failed to parse WebSocket message', {
            message: err.message
          });
          setError('Received invalid message from server');
          return;
        }

        switch (data.type) {
          case 'recording_started':
            logger.info('ws.recording_started', 'Recording started', {
              session_id: data.session_id
            });
            break;

          case 'transcript_update':
            setTranscript(data.partial_text || '');
            break;

          case 'transcript_final':
            setTranscript(data.question || data.text);
            break;

          case 'cypher_generating':
          case 'query_executing':
          case 'answer_generating':
            setStatus('processing');
            break;

          case 'cypher_generated':
            logger.info('ws.cypher', 'Cypher generated', {
              session_id: data.session_id,
              query_id: data.query_id
            });
            break;

          case 'query_results':
            setGraphData(data.results);
            break;

          case 'answer_generated':
            setAnswer(data.answer);
            setStatus('complete');
            break;

          case 'answer_fallback':
            setAnswer(data.fallback_answer);
            setStatus('complete');
            break;

          case 'answer_error':
            setError(data.error || 'Failed to generate answer');
            setStatus('error');
            logger.error('ws.answer_error', 'Answer generation failed', {
              error: data.error
            });
            break;

          case 'audio_chunk':
            logger.debug('ws.audio_chunk', 'Audio chunk received', {
              chunk_index: data.chunk_index,
              bytes: data.bytes
            });
            break;

          case 'audio_complete':
            logger.info('ws.audio_complete', 'Audio complete', {
              duration_ms: data.duration_ms
            });
            break;

          case 'audio_error':
            logger.warn('ws.audio_error', 'Audio error', { message: data.message });
            break;

          case 'error':
            setError(data.message);
            setStatus('error');
            logger.error('ws.error', 'Server error', { message: data.message });
            break;

          case 'timeout_warning':
            logger.warn('ws.timeout_warning', 'Session timeout warning', { message: data.message });
            break;

          default:
            logger.warn('ws.unknown', 'Unknown message type', { type: data.type });
        }
      };

      ws.onerror = (error) => {
        logger.error('ws.exception', 'WebSocket error', { message: error.message });
        setError('Connection error. Please try again.');
        setStatus('error');
      };

      ws.onclose = (event) => {
        logger.info('ws.close', 'WebSocket closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        if (status === 'recording') {
          setStatus('idle');
        }
      };

      wsRef.current = ws;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      audioStreamRef.current = stream;

      const mimeType = 'audio/webm;codecs=opus';
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 16000
      });
      mediaRecorderRef.current = mediaRecorder;

      logger.debug('media.create', 'MediaRecorder created', { mimeType });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size < 200) {
          if (audioMetricsRef.current) {
            audioMetricsRef.current.tinyChunks += 1;
          }
          logger.debug('media.chunk.skipped', 'Skipping tiny audio chunk', {
            size: event.data.size,
            reason: 'Too small for transcription (< 200 bytes)'
          });
          return;
        }

        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result.split(',')[1];

            const message = {
              type: 'audio_chunk',
              chunk: base64Audio,
              sequence: chunkSequenceRef.current++,
              timestamp: Date.now()
            };

            logger.trace('media.chunk.send', 'Sending audio chunk', {
              sequence: message.sequence,
              bytes: message.chunk.length,
              timestamp: message.timestamp
            });

            try {
              ws.send(JSON.stringify(message));
              if (audioMetricsRef.current) {
                audioMetricsRef.current.chunkCount += 1;
                audioMetricsRef.current.totalBytes += event.data.size;
                audioMetricsRef.current.lastChunkAt = nowMs();
              }

              if (stoppingRef.current && ws.readyState === WebSocket.OPEN) {
                logger.debug('ws.stop', 'Sending stop_recording message after audio chunk');
                const stopMessage = { type: 'stop_recording' };
                ws.send(JSON.stringify(stopMessage));
                stoppingRef.current = false;
              }
            } catch (err) {
              logger.error('media.chunk.failed', 'Failed to send audio chunk', { message: err.message });
              setError('Failed to send audio data');
              setStatus('error');
            }
          };
          reader.readAsDataURL(event.data);
        } else {
          logger.warn('media.chunk.dropped', 'Skipping audio chunk - WebSocket not open', {
            dataSize: event.data.size,
            readyState: ws.readyState
          });
          if (audioMetricsRef.current) {
            audioMetricsRef.current.droppedChunks += 1;
          }
        }
      };

      mediaRecorder.onerror = (event) => {
        logger.error('media.error', 'MediaRecorder error', { message: event.error?.message });
        setError('Recording error. Please try again.');
        setStatus('error');
      };

      mediaRecorder.onstop = () => {
        if (audioMetricsRef.current) {
          const now = nowMs();
          audioMetricsRef.current.stoppedAt = now;
          const durationMs = audioMetricsRef.current.startedAt
            ? Math.round(now - audioMetricsRef.current.startedAt)
            : undefined;
          logger.info('media.summary', 'Audio capture summary', {
            ...sessionMetaRef.current,
            chunks: audioMetricsRef.current.chunkCount,
            dropped_chunks: audioMetricsRef.current.droppedChunks,
            tiny_chunks: audioMetricsRef.current.tinyChunks,
            total_bytes: audioMetricsRef.current.totalBytes,
            duration_ms: durationMs,
            mimeType: audioMetricsRef.current.mimeType
          });
        }
      };

      if (!audioMetricsRef.current) {
        audioMetricsRef.current = {
          startedAt: nowMs(),
          chunkCount: 0,
          totalBytes: 0,
          droppedChunks: 0,
          tinyChunks: 0,
          mimeType,
          lastChunkAt: null
        };
      }

      mediaRecorder.start();
      logger.info('media.start', 'Recording started (complete file on stop)', {
        mimeType,
        strategy: 'complete_file'
      });
      setIsRecording(true);
      chunkSequenceRef.current = 0;
      stoppingRef.current = false;

    } catch (err) {
      startupTimerRef.current = null;
      logger.error('recording.start_failed', 'Error starting recording', {
        message: err.message,
        code: err.name
      });

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }

      let userMessage = err.message || 'Failed to start recording. Please check microphone permissions.';
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        userMessage = 'Microphone access was denied. Please enable microphone permissions.';
      } else if (err?.name === 'NotFoundError') {
        userMessage = 'No microphone was detected. Please check your audio device.';
      }

      setError(userMessage);
      setStatus('error');
    }
  };

  const stopRecording = () => {
    logger.info('recording.stop', 'Stopping recording');
    stoppingRef.current = true;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      logger.debug('media.stop', 'MediaRecorder stopped - waiting for final audio chunk');
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      logger.debug('media.tracks_stopped', 'Audio stream tracks stopped');
    }

    setTimeout(() => {
      if (stoppingRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        logger.warn('ws.stop_fallback', 'Sending stop_recording (no audio chunk received)');
        const message = { type: 'stop_recording' };
        try {
          wsRef.current.send(JSON.stringify(message));
          stoppingRef.current = false;
        } catch (err) {
          logger.error('ws.stop_failed', 'Failed to send stop_recording', { message: err.message });
        }
      }
    }, 2000);

    setIsRecording(false);
    setStatus('processing');
  };

  const resetQuery = () => {
    setTranscript('');
    setAnswer('');
    setAudioUrl('');
    setError('');
    setStatus('idle');
    setGraphData(null);
    sessionMetaRef.current = {};
    logger.setContext({});
  };

  // Status text for display
  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return 'Click to start voice recording';
      case 'starting':
        return 'Connecting...';
      case 'recording':
        return 'Listening... Click to stop';
      case 'processing':
        return 'Generating answer...';
      case 'complete':
        return 'Query complete';
      case 'error':
        return 'Error occurred';
      default:
        return '';
    }
  };

  // Button text for display
  const getButtonText = () => {
    switch (status) {
      case 'starting':
        return 'Starting...';
      case 'recording':
        return 'Stop Recording';
      case 'processing':
        return 'Processing...';
      default:
        return 'Start Recording';
    }
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
            {isRecording && (
              <RecordingIndicator
                variant="hazard"
                active={isRecording}
                size="lg"
                className="mb-6"
              />
            )}

            {/* Waveform Visualization */}
            <BrutalWaveform
              demo={isRecording}
              active={isRecording}
              variant={isRecording ? 'recording' : 'waveform'}
              barCount={32}
              height={80}
              className="mb-6"
            />

            {/* Record Button */}
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={status === 'processing' || status === 'starting'}
              loading={status === 'starting' || status === 'processing'}
              variant={isRecording ? 'danger' : 'primary'}
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
        {error && (
          <Card className="mb-8 border-status-error">
            <Card.Body className="bg-status-error/10">
              <Badge variant="error" className="mb-2">Error</Badge>
              <p className="text-brutal-charcoal font-mono text-sm">{error}</p>
            </Card.Body>
          </Card>
        )}

        {/* Transcript Display */}
        {(transcript || status === 'recording') && (
          <div className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brutal-charcoal/70 mb-3">
              Your Question
            </h2>
            <TerminalTranscript
              text={transcript}
              animate={status === 'recording'}
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
              <h2 className="text-sm font-bold uppercase tracking-wider">
                Answer
              </h2>
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
        {status === 'complete' && (
          <Button
            onClick={resetQuery}
            variant="primary"
            className="w-full"
          >
            Ask Another Question
          </Button>
        )}
      </div>
    </div>
  );
}

export default QueryPage;
