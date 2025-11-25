/**
 * TranscriptView Component
 *
 * Neo-Brutalist display for voice transcripts with real-time and final states.
 * Uses TerminalTranscript from design system for consistent brutalist styling.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  Card,
  Button,
  Badge,
  TerminalTranscript,
  cn,
} from '../design-system';

const TranscriptView = ({
  partialText,
  finalTranscript,
  noteId,
  metadata = {},
  isRecording,
}) => {
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const lastUpdateRef = useRef(Date.now());
  const loadingTimeoutRef = useRef(null);

  const LOADING_DELAY_THRESHOLD = 2000;

  /**
   * Monitor partial text updates and show loading indicator if delayed
   */
  useEffect(() => {
    if (isRecording) {
      lastUpdateRef.current = Date.now();
      setShowLoadingIndicator(false);

      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

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
   * Copy transcript to clipboard
   */
  const handleCopyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(finalTranscript);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  /**
   * Render nothing if no content
   */
  if (!partialText && !finalTranscript && !isRecording) {
    return null;
  }

  return (
    <div className="mt-6">
      {/* Real-time partial transcript */}
      {isRecording && (
        <Card className="mb-4">
          <Card.Header className="flex items-center justify-between">
            <h3 className="text-lg font-bold uppercase tracking-wider">
              Live Transcript
            </h3>
            {showLoadingIndicator && (
              <div className="flex items-center gap-2">
                <div className="loading-brutal w-3 h-3" />
                <span className="font-mono text-xs text-brutal-charcoal/70 uppercase">
                  Processing...
                </span>
              </div>
            )}
          </Card.Header>
          <Card.Body>
            <TerminalTranscript
              text={partialText || 'Start speaking to see your transcript appear here...'}
              animate={!!partialText}
              showCursor={true}
              variant="default"
              minHeight={80}
              maxHeight={200}
            />

            {showLoadingIndicator && !partialText && (
              <Badge variant="warning" className="mt-4 w-full justify-center py-2">
                Waiting for speech to be detected...
              </Badge>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Final completed transcript */}
      {finalTranscript && noteId && (
        <Card variant="accent">
          <Card.Header className="flex items-center justify-between">
            <h3 className="text-lg font-bold uppercase tracking-wider">
              Saved Note
            </h3>
            <Badge variant="success" className="gap-2">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              SAVED
            </Badge>
          </Card.Header>
          <Card.Body>
            <TerminalTranscript
              text={finalTranscript}
              animate={false}
              showCursor={false}
              variant="success"
              minHeight={80}
              maxHeight={300}
            />

            {/* Metadata */}
            <div className="mt-6 p-4 bg-brutal-charcoal/5 border-brutal border-brutal-charcoal/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between items-center border-b border-brutal-charcoal/20 pb-2">
                  <span className="font-mono text-xs uppercase text-brutal-charcoal/70">
                    Note ID
                  </span>
                  <span className="font-mono text-xs bg-brutal-charcoal/10 px-2 py-1">
                    {noteId.slice(0, 8)}...
                  </span>
                </div>

                {metadata.durationSeconds && (
                  <div className="flex justify-between items-center border-b border-brutal-charcoal/20 pb-2">
                    <span className="font-mono text-xs uppercase text-brutal-charcoal/70">
                      Duration
                    </span>
                    <span className="font-mono text-xs">
                      {formatDuration(metadata.durationSeconds)}
                    </span>
                  </div>
                )}

                {metadata.wordCount && (
                  <div className="flex justify-between items-center border-b border-brutal-charcoal/20 pb-2">
                    <span className="font-mono text-xs uppercase text-brutal-charcoal/70">
                      Words
                    </span>
                    <span className="font-mono text-xs">
                      {metadata.wordCount}
                    </span>
                  </div>
                )}

                {metadata.createdAt && (
                  <div className="flex justify-between items-center border-b border-brutal-charcoal/20 pb-2">
                    <span className="font-mono text-xs uppercase text-brutal-charcoal/70">
                      Created
                    </span>
                    <span className="font-mono text-xs">
                      {formatTimestamp(metadata.createdAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 mt-6">
              <Button
                variant="primary"
                onClick={() => {
                  window.location.href = `/notes/${noteId}`;
                }}
                className="flex-1"
              >
                View Full Note
              </Button>
              <Button
                variant="secondary"
                onClick={handleCopyTranscript}
                className={cn('flex-1', copySuccess && 'bg-status-success text-brutal-black')}
              >
                {copySuccess ? 'Copied!' : 'Copy Transcript'}
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default TranscriptView;
