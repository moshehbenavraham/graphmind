import React from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import {
  Button,
  Card,
  Badge,
  RecordingIndicator,
  BrutalWaveform,
  cn,
} from '../design-system';

/**
 * VoiceRecorder Component (Tasks T033-T042)
 *
 * Neo-Brutalist voice recording component with microphone permission handling.
 * Uses design system components for consistent brutalist styling.
 *
 * Features:
 * - T034: Microphone permission request with getUserMedia
 * - T035: Permission denial handling with helpful messaging
 * - T036: Audio configuration (16kHz PCM mono)
 * - T037: Recording indicator with brutalist hazard stripes
 * - T038: Recording timer in MM:SS format
 * - T039: Stop recording button functionality
 * - T040: Target <500ms recording start latency
 * - T041-T042: Cross-browser and mobile support
 *
 * Refactored to use useAudioRecorder hook for shared audio logic.
 */
const VoiceRecorder = ({ onAudioData, onRecordingComplete, onError }) => {
  const {
    isRecording,
    isInitializing,
    formattedDuration,
    permissionState,
    error,
    start,
    stop,
    clearError,
  } = useAudioRecorder({
    sampleRate: 16000,
    channelCount: 1,
    captureMode: 'pcm',
    bufferSize: 4096,
    onChunk: (chunk) => {
      // T036: Pass PCM audio data to parent
      if (onAudioData) {
        onAudioData(chunk.rawData);
      }
    },
    onComplete: (recordingData) => {
      // T039: Callback with recording metadata
      if (onRecordingComplete) {
        onRecordingComplete({
          duration: recordingData.duration,
          timestamp: recordingData.timestamp,
          audioChunks: recordingData.chunks,
        });
      }
    },
    onError: (err) => {
      if (onError) {
        onError(err);
      }
    },
  });

  /**
   * Toggle recording state
   */
  const toggleRecording = () => {
    if (isRecording) {
      stop();
    } else {
      clearError();
      start();
    }
  };

  return (
    <div className="flex justify-center items-center w-full p-8 bg-[#FFFEF0]">
      <Card className="max-w-xl w-full">
        <Card.Body className="flex flex-col gap-6 items-center">
          {/* T035: Permission message */}
          {permissionState === 'denied' && (
            <div className="w-full p-4 bg-status-error/10 border-brutal-thick border-status-error">
              <p className="font-mono font-bold text-status-error uppercase tracking-wide mb-3">
                Microphone Access Blocked
              </p>
              <p className="font-mono text-sm text-brutal-charcoal mb-2">
                To enable microphone access:
              </p>
              <ol className="list-decimal list-inside font-mono text-sm text-brutal-charcoal space-y-1">
                <li>Click the lock icon in your browser's address bar</li>
                <li>Find "Microphone" in the permissions list</li>
                <li>Change the setting to "Allow"</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          )}

          {/* T035: Error message */}
          {error && (
            <Badge variant="error" className="w-full justify-center py-3 text-sm">
              <svg
                className="w-5 h-5 mr-2 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </Badge>
          )}

          {/* T037: Recording indicator with hazard stripes */}
          <RecordingIndicator variant="hazard" active={isRecording} size="lg" label="REC" />

          {/* Waveform visualization */}
          {isRecording && (
            <BrutalWaveform
              demo
              active={isRecording}
              variant="recording"
              barCount={32}
              height={80}
            />
          )}

          {/* T038: Timer display (MM:SS format) */}
          <div
            className={cn(
              'font-mono text-5xl font-bold tabular-nums min-w-[150px] text-center',
              isRecording ? 'text-status-error' : 'text-brutal-charcoal/50'
            )}
          >
            {formattedDuration}
          </div>

          {/* T034, T039: Record/Stop button */}
          <Button
            variant={isRecording ? 'danger' : 'primary'}
            size="lg"
            onClick={toggleRecording}
            disabled={isInitializing || (permissionState === 'denied' && !isRecording)}
            loading={isInitializing}
            className="w-20 h-20 p-0 flex items-center justify-center"
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? (
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            ) : (
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
          </Button>

          {/* Button label */}
          <span className="font-mono text-sm font-bold uppercase tracking-wider text-brutal-charcoal">
            {isInitializing ? 'Initializing...' : isRecording ? 'Stop Recording' : 'Start Recording'}
          </span>

          {/* Permission prompt hint */}
          {!isRecording && permissionState === 'prompt' && !error && (
            <div className="w-full p-4 bg-brutal-charcoal/5 border-brutal border-brutal-charcoal/20 font-mono text-sm text-brutal-charcoal/70 text-center">
              Click the button to start recording. You will be asked for microphone permission.
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default VoiceRecorder;
