import React, { useEffect, useState, useRef } from 'react';

const TranscriptView = ({
  partialText,
  finalTranscript,
  noteId,
  metadata = {},
  isRecording,
}) => {
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const lastUpdateRef = useRef(Date.now());
  const loadingTimeoutRef = useRef(null);

  const LOADING_DELAY_THRESHOLD = 2000; // Show loading after 2 seconds of no updates

  /**
   * Monitor partial text updates and show loading indicator if delayed
   */
  useEffect(() => {
    if (isRecording) {
      lastUpdateRef.current = Date.now();
      setShowLoadingIndicator(false);

      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Set timeout to show loading indicator if no updates
      loadingTimeoutRef.current = setTimeout(() => {
        const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
        if (timeSinceLastUpdate >= LOADING_DELAY_THRESHOLD) {
          setShowLoadingIndicator(true);
        }
      }, LOADING_DELAY_THRESHOLD);

      return () => {
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
      };
    } else {
      setShowLoadingIndicator(false);
    }
  }, [partialText, isRecording]);

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';

    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch (err) {
      console.error('Failed to format timestamp:', err);
      return timestamp;
    }
  };

  /**
   * Format duration as MM:SS
   */
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Render nothing if no content
   */
  if (!partialText && !finalTranscript && !isRecording) {
    return null;
  }

  return (
    <div className="transcript-view">
      {/* Real-time partial transcript */}
      {isRecording && (
        <div className="transcript-partial">
          <div className="transcript-header">
            <h3>Live Transcript</h3>
            {showLoadingIndicator && (
              <span className="loading-indicator">
                <span className="spinner"></span>
                Processing...
              </span>
            )}
          </div>

          <div className="transcript-content partial">
            {partialText ? (
              <p>{partialText}</p>
            ) : (
              <p className="placeholder">
                Start speaking to see your transcript appear here...
              </p>
            )}
          </div>

          {showLoadingIndicator && !partialText && (
            <div className="delay-notice">
              Waiting for speech to be detected...
            </div>
          )}
        </div>
      )}

      {/* Final completed transcript */}
      {finalTranscript && noteId && (
        <div className="transcript-complete">
          <div className="transcript-header">
            <h3>Saved Note</h3>
            <div className="success-badge">
              <span className="checkmark">✓</span>
              Saved
            </div>
          </div>

          <div className="transcript-content final">
            <p>{finalTranscript}</p>
          </div>

          <div className="transcript-metadata">
            <div className="metadata-row">
              <span className="metadata-label">Note ID:</span>
              <span className="metadata-value note-id">{noteId}</span>
            </div>

            {metadata.durationSeconds && (
              <div className="metadata-row">
                <span className="metadata-label">Duration:</span>
                <span className="metadata-value">
                  {formatDuration(metadata.durationSeconds)}
                </span>
              </div>
            )}

            {metadata.wordCount && (
              <div className="metadata-row">
                <span className="metadata-label">Words:</span>
                <span className="metadata-value">{metadata.wordCount}</span>
              </div>
            )}

            {metadata.createdAt && (
              <div className="metadata-row">
                <span className="metadata-label">Created:</span>
                <span className="metadata-value">
                  {formatTimestamp(metadata.createdAt)}
                </span>
              </div>
            )}
          </div>

          <div className="transcript-actions">
            <button
              className="btn-view-note"
              onClick={() => {
                // Navigate to note detail view
                window.location.href = `/notes/${noteId}`;
              }}
            >
              View Full Note
            </button>
            <button
              className="btn-copy-transcript"
              onClick={() => {
                navigator.clipboard.writeText(finalTranscript);
                // Could show toast notification here
              }}
            >
              Copy Transcript
            </button>
          </div>
        </div>
      )}

      {/* Styles (could be moved to separate CSS file) */}
      <style jsx>{`
        .transcript-view {
          margin-top: 1.5rem;
          border-radius: 8px;
          background: #f8f9fa;
          overflow: hidden;
        }

        .transcript-partial,
        .transcript-complete {
          padding: 1.5rem;
        }

        .transcript-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .transcript-header h3 {
          margin: 0;
          font-size: 1.25rem;
          color: #333;
        }

        .loading-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #666;
        }

        .spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid #e0e0e0;
          border-top-color: #007bff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .success-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.75rem;
          background: #28a745;
          color: white;
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .checkmark {
          font-size: 1rem;
        }

        .transcript-content {
          min-height: 100px;
          padding: 1rem;
          background: white;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
        }

        .transcript-content.partial {
          border-left: 3px solid #007bff;
        }

        .transcript-content.final {
          border-left: 3px solid #28a745;
        }

        .transcript-content p {
          margin: 0;
          line-height: 1.6;
          color: #333;
          font-size: 1rem;
        }

        .transcript-content .placeholder {
          color: #999;
          font-style: italic;
        }

        .delay-notice {
          margin-top: 1rem;
          padding: 0.75rem;
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 4px;
          color: #856404;
          font-size: 0.875rem;
          text-align: center;
        }

        .transcript-metadata {
          margin-top: 1.5rem;
          padding: 1rem;
          background: #f1f3f5;
          border-radius: 6px;
        }

        .metadata-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e0e0e0;
        }

        .metadata-row:last-child {
          border-bottom: none;
        }

        .metadata-label {
          font-weight: 600;
          color: #666;
          font-size: 0.875rem;
        }

        .metadata-value {
          color: #333;
          font-size: 0.875rem;
        }

        .metadata-value.note-id {
          font-family: monospace;
          font-size: 0.8rem;
          background: #e0e0e0;
          padding: 0.2rem 0.5rem;
          border-radius: 3px;
        }

        .transcript-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .btn-view-note,
        .btn-copy-transcript {
          flex: 1;
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 6px;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-view-note {
          background: #007bff;
          color: white;
        }

        .btn-view-note:hover {
          background: #0056b3;
        }

        .btn-copy-transcript {
          background: white;
          color: #333;
          border: 1px solid #ccc;
        }

        .btn-copy-transcript:hover {
          background: #f8f9fa;
          border-color: #999;
        }
      `}</style>
    </div>
  );
};

export default TranscriptView;
