import { useState, useRef, useEffect } from 'react';
import Navigation from '../components/Navigation';
import { api } from '../utils/api';

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8787';

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

      // Start query session
      const session = await api.startQuery();
      const { session_id } = session;

      // Connect to WebSocket
      const token = localStorage.getItem('jwt_token');
      const wsUrl = `${WS_BASE_URL}/ws/query/${session_id}?token=${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setStatus('recording');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'transcript') {
          setTranscript(data.text);
        } else if (data.type === 'answer') {
          setAnswer(data.answer_text);
          setAudioUrl(data.audio_url);
          setGraphData(data.graph_data);
          setStatus('complete');

          // Auto-play audio answer
          if (data.audio_url) {
            const audio = new Audio(data.audio_url);
            audio.play();
          }
        } else if (data.type === 'error') {
          setError(data.message);
          setStatus('error');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error. Please try again.');
        setStatus('error');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        if (status === 'recording') {
          setStatus('idle');
        }
      };

      wsRef.current = ws;

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(event.data);
        }
      };

      mediaRecorder.start(100); // Send chunks every 100ms
      setIsRecording(true);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err.message || 'Failed to start recording. Please check microphone permissions.');
      setStatus('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
    }

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
