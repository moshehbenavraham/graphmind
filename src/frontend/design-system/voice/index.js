/**
 * GraphMind Design System - Voice Components
 *
 * Neo-Brutalist voice interaction components for recording,
 * waveform visualization, and transcript display.
 *
 * All components automatically respect `prefers-reduced-motion`.
 *
 * @example
 * // Import components
 * import {
 *   BrutalWaveform,
 *   RecordingIndicator,
 *   TerminalTranscript
 * } from '../design-system/voice';
 *
 * @example
 * // Import hooks for custom implementations
 * import { useWaveform, useRecordingIndicator } from '../design-system/voice';
 *
 * @example
 * // Combined usage for voice recording UI
 * function VoiceRecorderUI({ isRecording, audioData, transcript }) {
 *   return (
 *     <div>
 *       <RecordingIndicator variant="hazard" active={isRecording} />
 *       <BrutalWaveform audioData={audioData} active={isRecording} />
 *       <TerminalTranscript text={transcript} animate={!isRecording} />
 *     </div>
 *   );
 * }
 *
 * @example
 * // Demo mode for preview/testing
 * <BrutalWaveform demo active />
 */

// Components
export { default as BrutalWaveform } from './BrutalWaveform';
export { default as RecordingIndicator } from './RecordingIndicator';
export { default as TerminalTranscript } from './TerminalTranscript';

// Hooks
export { useWaveform } from './BrutalWaveform';
export { useRecordingIndicator } from './RecordingIndicator';
