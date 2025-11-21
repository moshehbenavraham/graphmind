/**
 * Audio Processing Library
 *
 * Central export point for audio-related utilities including
 * transcription and validation functionality.
 *
 * @module lib/audio
 */

// Export all transcription utilities
export {
  transcribeAudioChunk,
  batchTranscribeAudioChunks,
  estimateAudioDuration,
  TranscriptionError,
  TranscriptionErrorCode
} from './transcription.js';

// Export all validation utilities
export {
  validateAudioChunk,
  validateAudioChunkOrThrow,
  validateAudioFormat,
  validateAudioSize,
  validateSequence,
  validateTimestamp,
  getValidationErrorMessage,
  isRecoverableValidationError,
  ValidationError,
  ValidationErrorCode,
  MAX_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  MAX_SEQUENCE_NUMBER
} from './validation.js';
