import { useState, useRef, useEffect } from 'react';
import Navigation from '../components/Navigation';
import { api } from '../utils/api';
import { createLogger } from '../utils/logger';

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
  const stoppingRef = useRef(false); // Track if we're waiting for final audio chunk

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

      // IMPORTANT: Use the websocket_url from the API response and append JWT token
      // The server expects ?token= parameter for authentication
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
            // Partial transcript
            setTranscript(data.partial_text || '');
            break;

          case 'transcript_final':
            // Final transcript
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
            // TODO: Handle TTS audio chunks for playback
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

      // Request microphone access with optimal audio settings
      // Configure for high-quality voice transcription
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,      // 16kHz for voice (matches Whisper expectations)
          channelCount: 1,        // Mono audio
          echoCancellation: true, // Reduce echo
          noiseSuppression: true, // Reduce background noise
          autoGainControl: true   // Normalize volume levels
        }
      });
      audioStreamRef.current = stream;

      // Create MediaRecorder with WebM/Opus codec
      // Opus is widely supported and provides good compression for voice
      const mimeType = 'audio/webm;codecs=opus';
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 16000 // 16 kbps is sufficient for voice
      });
      mediaRecorderRef.current = mediaRecorder;

      logger.debug('media.create', 'MediaRecorder created', { mimeType });

      mediaRecorder.ondataavailable = async (event) => {
        // Skip tiny chunks (< 200 bytes) that occur during final MediaRecorder flush
        // These are too small to contain meaningful audio and cause transcription errors
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
          // Convert Blob to base64 for JSON transmission
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result.split(',')[1]; // Remove data:audio/webm;base64, prefix

            // Send as JSON message with expected format
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

              // If we're stopping, send stop_recording AFTER audio chunk is sent
              if (stoppingRef.current && ws.readyState === WebSocket.OPEN) {
                logger.debug('ws.stop', 'Sending stop_recording message after audio chunk');
                const stopMessage = { type: 'stop_recording' };
                ws.send(JSON.stringify(stopMessage));
                stoppingRef.current = false; // Reset flag
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

      // Start recording without timeslice parameter
      // This makes MediaRecorder emit data only when stop() is called
      // This ensures we send a complete, valid WebM file to Whisper
      // Previously we were chunking every 1s which created multiple WebM files
      // that couldn't be properly reassembled
      mediaRecorder.start(); // No timeslice = complete file on stop
      logger.info('media.start', 'Recording started (complete file on stop)', {
        mimeType,
        strategy: 'complete_file'
      });
      setIsRecording(true);
      chunkSequenceRef.current = 0; // Reset sequence counter
      stoppingRef.current = false; // Reset stopping flag

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

    // Set flag to send stop_recording after audio chunk arrives
    stoppingRef.current = true;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      logger.debug('media.stop', 'MediaRecorder stopped - waiting for final audio chunk');
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      logger.debug('media.tracks_stopped', 'Audio stream tracks stopped');
    }

    // Set a timeout fallback to send stop_recording if no audio chunk arrives
    // This handles cases where recording was too short or failed
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
    }, 2000); // Wait 2 seconds for audio chunk

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

  return (
    <div>
      <Navigation />
      <div className="container" style={{ maxWidth: '800px', padding: '2rem 1rem' }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: 'var(--text-primary)'
        }}>
          Ask a Question
        </h1>

        <div style={{
          backgroundColor: 'var(--bg-primary)',
          padding: '2rem',
          borderRadius: '0.5rem',
          boxShadow: 'var(--shadow)',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={status === 'processing' || status === 'starting'}
              className="btn btn-primary"
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                fontSize: '1.25rem',
                backgroundColor: isRecording ? 'var(--error-color)' : 'var(--primary-color)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {status === 'starting' && 'Starting...'}
              {status === 'recording' && 'Stop Recording'}
              {status === 'processing' && 'Processing...'}
              {(status === 'idle' || status === 'complete' || status === 'error') && 'Start Recording'}

              {isRecording && (
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
              )}
            </button>

            <p style={{
              color: 'var(--text-secondary)',
              textAlign: 'center'
            }}>
              {status === 'idle' && 'Click to start voice recording'}
              {status === 'starting' && 'Connecting...'}
              {status === 'recording' && 'Listening... Click to stop'}
              {status === 'processing' && 'Generating answer...'}
              {status === 'complete' && 'Query complete'}
              {status === 'error' && 'Error occurred'}
            </p>
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#FEE2E2',
            border: '1px solid var(--error-color)',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '2rem',
            color: 'var(--error-color)'
          }}>
            {error}
          </div>
        )}

        {transcript && (
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: '1.5rem',
            borderRadius: '0.5rem',
            boxShadow: 'var(--shadow)',
            marginBottom: '2rem'
          }}>
            <h2 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              marginBottom: '0.5rem',
              color: 'var(--text-primary)'
            }}>
              Your Question
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>{transcript}</p>
          </div>
        )}

        {answer && (
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: '1.5rem',
            borderRadius: '0.5rem',
            boxShadow: 'var(--shadow)',
            marginBottom: '2rem'
          }}>
            <h2 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              marginBottom: '0.5rem',
              color: 'var(--text-primary)'
            }}>
              Answer
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{answer}</p>

            {audioUrl && (
              <audio controls src={audioUrl} style={{ width: '100%' }}>
                Your browser does not support audio playback.
              </audio>
            )}
          </div>
        )}

        {graphData && (
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: '1.5rem',
            borderRadius: '0.5rem',
            boxShadow: 'var(--shadow)',
            marginBottom: '2rem'
          }}>
            <h2 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              marginBottom: '0.5rem',
              color: 'var(--text-primary)'
            }}>
              Knowledge Graph Data
            </h2>
            <pre style={{
              backgroundColor: 'var(--bg-secondary)',
              padding: '1rem',
              borderRadius: '0.375rem',
              overflow: 'auto',
              fontSize: '0.875rem'
            }}>
              {JSON.stringify(graphData, null, 2)}
            </pre>
          </div>
        )}

        {status === 'complete' && (
          <button
            onClick={resetQuery}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            Ask Another Question
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default QueryPage;
