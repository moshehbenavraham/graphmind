import React, { useState } from 'react';
import VoiceRecorder from './VoiceRecorder';

/**
 * Example usage of VoiceRecorder component
 * This demonstrates how to use the VoiceRecorder with callbacks
 *
 * Tasks: T033-T042 Demo
 */
const VoiceRecorderExample = () => {
  const [audioLog, setAudioLog] = useState([]);
  const [completedRecordings, setCompletedRecordings] = useState([]);
  const [errors, setErrors] = useState([]);

  /**
   * Handle audio data chunks as they arrive
   */
  const handleAudioData = (pcmData) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      samples: pcmData.length,
      type: 'audio_chunk'
    };

    setAudioLog(prev => [...prev.slice(-9), logEntry]); // Keep last 10 entries
    console.log('[Audio Chunk]', logEntry);
  };

  /**
   * Handle recording completion
   */
  const handleRecordingComplete = (metadata) => {
    console.log('[Recording Complete]', metadata);

    const recording = {
      id: Date.now(),
      ...metadata,
      totalChunks: metadata.audioChunks.length,
      totalSamples: metadata.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    };

    setCompletedRecordings(prev => [recording, ...prev]);
    setAudioLog([]); // Clear audio log for next recording
  };

  /**
   * Handle errors
   */
  const handleError = (error) => {
    console.error('[Recording Error]', error);

    const errorEntry = {
      id: Date.now(),
      message: error.message,
      timestamp: new Date().toISOString()
    };

    setErrors(prev => [errorEntry, ...prev.slice(0, 4)]); // Keep last 5 errors
  };

  /**
   * Clear logs
   */
  const clearLogs = () => {
    setAudioLog([]);
    setCompletedRecordings([]);
    setErrors([]);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>
          VoiceRecorder Component Demo
        </h1>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
          '@media (max-width: 768px)': {
            gridTemplateColumns: '1fr'
          }
        }}>
          {/* Recorder Component */}
          <div>
            <VoiceRecorder
              onAudioData={handleAudioData}
              onRecordingComplete={handleRecordingComplete}
              onError={handleError}
            />
          </div>

          {/* Logs Panel */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h2 style={{ margin: 0 }}>Activity Log</h2>
              <button
                onClick={clearLogs}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Clear Logs
              </button>
            </div>

            {/* Error Log */}
            {errors.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#dc2626',
                  marginBottom: '0.5rem'
                }}>
                  Errors
                </h3>
                <div style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '1rem',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}>
                  {errors.map(error => (
                    <div key={error.id} style={{
                      fontSize: '0.875rem',
                      marginBottom: '0.5rem',
                      paddingBottom: '0.5rem',
                      borderBottom: '1px solid #fecaca'
                    }}>
                      <div style={{ fontWeight: 600, color: '#dc2626' }}>
                        {new Date(error.timestamp).toLocaleTimeString()}
                      </div>
                      <div style={{ color: '#991b1b' }}>{error.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audio Chunks Log */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Audio Chunks (Last 10)
              </h3>
              <div style={{
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                padding: '1rem',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {audioLog.length === 0 ? (
                  <div style={{
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    textAlign: 'center'
                  }}>
                    No audio chunks yet. Start recording to see activity.
                  </div>
                ) : (
                  audioLog.map((entry, idx) => (
                    <div key={idx} style={{
                      fontSize: '0.75rem',
                      marginBottom: '0.25rem',
                      fontFamily: 'monospace',
                      color: '#374151'
                    }}>
                      {new Date(entry.timestamp).toLocaleTimeString()} -
                      {entry.samples} samples
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Completed Recordings */}
            <div>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Completed Recordings ({completedRecordings.length})
              </h3>
              <div style={{
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                padding: '1rem',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {completedRecordings.length === 0 ? (
                  <div style={{
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    textAlign: 'center'
                  }}>
                    No completed recordings yet.
                  </div>
                ) : (
                  completedRecordings.map(recording => (
                    <div key={recording.id} style={{
                      backgroundColor: 'white',
                      padding: '1rem',
                      borderRadius: '6px',
                      marginBottom: '0.75rem',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '0.5rem'
                      }}>
                        <span style={{ fontWeight: 600, color: '#374151' }}>
                          Recording #{recording.id}
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#6b7280'
                        }}>
                          {new Date(recording.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#6b7280'
                      }}>
                        <div>
                          <strong>Duration:</strong> {recording.duration}s
                        </div>
                        <div>
                          <strong>Chunks:</strong> {recording.totalChunks}
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <strong>Total Samples:</strong> {recording.totalSamples.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          marginTop: '3rem',
          padding: '1.5rem',
          backgroundColor: '#eff6ff',
          borderRadius: '8px',
          border: '1px solid #bfdbfe'
        }}>
          <h3 style={{ marginTop: 0, color: '#1e40af' }}>
            Testing Instructions
          </h3>
          <ul style={{ color: '#1e40af', lineHeight: 1.6 }}>
            <li>Click "Start Recording" to begin audio capture</li>
            <li>Allow microphone permission when prompted</li>
            <li>Watch the timer and recording indicator</li>
            <li>See audio chunks appear in real-time in the log</li>
            <li>Click "Stop Recording" to finish</li>
            <li>Check browser console for latency measurements</li>
            <li>Verify recording start latency is below 500ms</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VoiceRecorderExample;
