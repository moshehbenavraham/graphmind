/**
 * AudioPlayer Component
 *
 * Neo-Brutalist audio playback with play/pause/stop controls.
 * Uses Web Audio API for progressive playback of chunked audio.
 * Styled with design system components for consistent brutalist styling.
 *
 * Feature 010: Text-to-Speech Responses - User Story 2
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button, Card, Badge, cn } from '../design-system';

/**
 * AudioPlayer Component
 *
 * @param {Object} props
 * @param {Function} props.onPlaybackControl - Callback for playback controls
 * @param {string} props.playbackStatus - Current playback status ('idle', 'playing', 'paused', 'stopped')
 * @param {number} props.duration - Total audio duration in milliseconds
 */
export function AudioPlayer({ onPlaybackControl, playbackStatus = 'idle', duration = 0 }) {
  const [status, setStatus] = useState('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const audioContextRef = useRef(null);
  const audioBufferRef = useRef([]);
  const sourceNodeRef = useRef(null);
  const startTimeRef = useRef(0);

  // Sync status with prop
  useEffect(() => {
    setStatus(playbackStatus);
  }, [playbackStatus]);

  /**
   * Handle mobile background state (T105)
   * Pause audio when user switches apps or locks screen
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && status === 'playing') {
        pauseAudio();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status]);

  /**
   * Initialize Web Audio API context
   */
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  /**
   * Play audio from buffer
   */
  const playAudio = async () => {
    try {
      const audioContext = initAudioContext();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      onPlaybackControl('resume');
      startTimeRef.current = Date.now();
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  };

  /**
   * Pause audio
   */
  const pauseAudio = () => {
    onPlaybackControl('pause');
  };

  /**
   * Stop audio and reset
   */
  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      } catch (error) {
        // Already stopped
      }
    }
    setCurrentTime(0);
    onPlaybackControl('stop');
  };

  /**
   * Format time in MM:SS format
   */
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * Get status badge variant
   */
  const getStatusVariant = () => {
    switch (status) {
      case 'playing':
        return 'success';
      case 'paused':
        return 'warning';
      case 'stopped':
        return 'error';
      default:
        return 'default';
    }
  };

  /**
   * Get status label
   */
  const getStatusLabel = () => {
    switch (status) {
      case 'playing':
        return 'PLAYING';
      case 'paused':
        return 'PAUSED';
      case 'stopped':
        return 'STOPPED';
      default:
        return 'READY';
    }
  };

  return (
    <Card className="max-w-md">
      <Card.Body className="flex flex-col gap-4">
        {/* Playback status indicator */}
        <div className="flex items-center justify-between">
          <Badge variant={getStatusVariant()} className="gap-2">
            {status === 'playing' && (
              <span className="w-2 h-2 bg-current animate-brutal-pulse" />
            )}
            {getStatusLabel()}
          </Badge>

          {/* Time display */}
          {duration > 0 && (
            <span className="font-mono text-sm text-brutal-charcoal/70">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {duration > 0 && (
          <div className="w-full h-2 bg-brutal-charcoal/20 border-brutal border-brutal-black">
            <div
              className={cn(
                'h-full transition-all duration-300',
                status === 'playing' ? 'bg-status-success' :
                status === 'paused' ? 'bg-status-warning' :
                'bg-accent-primary'
              )}
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
        )}

        {/* Playback controls */}
        <div className="flex gap-3 justify-center">
          {/* Play/Resume button */}
          {(status === 'idle' || status === 'paused' || status === 'stopped') && (
            <Button
              variant="primary"
              onClick={playAudio}
              disabled={status === 'idle'}
              aria-label="Play audio"
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              PLAY
            </Button>
          )}

          {/* Pause button */}
          {status === 'playing' && (
            <Button
              variant="secondary"
              onClick={pauseAudio}
              aria-label="Pause audio"
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
              PAUSE
            </Button>
          )}

          {/* Stop button */}
          {(status === 'playing' || status === 'paused') && (
            <Button
              variant="danger"
              onClick={stopAudio}
              aria-label="Stop audio"
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
              STOP
            </Button>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

export default AudioPlayer;
