/**
 * AudioPlayer Component
 *
 * Handles audio playback with play/pause/stop controls.
 * Uses Web Audio API for progressive playback of chunked audio.
 *
 * Feature 010: Text-to-Speech Responses - User Story 2
 */

import React, { useState, useEffect, useRef } from 'react';

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
      // Page becomes hidden (app switch, lock screen, background)
      if (document.hidden && status === 'playing') {
        // Auto-pause on background
        pauseAudio();
      }
      // Note: We do NOT auto-resume on visibility return
      // This respects user control and prevents unexpected audio playback
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup listener on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status]); // Re-bind when status changes

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

      // Resume context if suspended (browser autoplay restrictions)
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
   * Get status icon
   */
  const getStatusIcon = () => {
    switch (status) {
      case 'playing':
        return '▶️';
      case 'paused':
        return '⏸️';
      case 'stopped':
        return '⏹️';
      default:
        return '⏸️';
    }
  };

  /**
   * Get status color
   */
  const getStatusColor = () => {
    switch (status) {
      case 'playing':
        return '#22c55e'; // green
      case 'paused':
        return '#eab308'; // yellow
      case 'stopped':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  return (
    <div className="audio-player" style={styles.container}>
      {/* Playback status indicator */}
      <div className="status-indicator" style={{
        ...styles.statusIndicator,
        backgroundColor: getStatusColor()
      }}>
        <span style={styles.statusIcon}>{getStatusIcon()}</span>
        <span style={styles.statusText}>
          {status === 'idle' && 'Ready'}
          {status === 'playing' && 'Playing'}
          {status === 'paused' && 'Paused'}
          {status === 'stopped' && 'Stopped'}
        </span>
      </div>

      {/* Playback controls */}
      <div className="playback-controls" style={styles.controls}>
        {/* Play/Resume button */}
        {(status === 'idle' || status === 'paused' || status === 'stopped') && (
          <button
            onClick={playAudio}
            style={styles.button}
            disabled={status === 'idle'}
            aria-label="Play audio"
          >
            ▶️ Play
          </button>
        )}

        {/* Pause button */}
        {status === 'playing' && (
          <button
            onClick={pauseAudio}
            style={styles.button}
            aria-label="Pause audio"
          >
            ⏸️ Pause
          </button>
        )}

        {/* Stop button */}
        {(status === 'playing' || status === 'paused') && (
          <button
            onClick={stopAudio}
            style={styles.button}
            aria-label="Stop audio"
          >
            ⏹️ Stop
          </button>
        )}
      </div>

      {/* Progress indicator */}
      {duration > 0 && (
        <div className="progress" style={styles.progress}>
          <span style={styles.timeText}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${(currentTime / duration) * 100}%`
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Component styles
 */
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    maxWidth: '400px',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '6px',
    color: 'white',
    fontWeight: '500',
    fontSize: '14px',
  },
  statusIcon: {
    fontSize: '16px',
  },
  statusText: {
    textTransform: 'capitalize',
  },
  controls: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
  },
  button: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#2563eb',
    },
    '&:disabled': {
      backgroundColor: '#9ca3af',
      cursor: 'not-allowed',
    },
  },
  progress: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  timeText: {
    fontSize: '12px',
    color: '#6b7280',
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: '4px',
    backgroundColor: '#e5e7eb',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    transition: 'width 0.3s ease',
  },
};

export default AudioPlayer;
