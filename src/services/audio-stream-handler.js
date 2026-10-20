/**
 * AudioStreamHandler Service
 *
 * Manages WebSocket audio streaming and buffering for voice query sessions.
 * Handles audio chunk validation, buffering, and reassembly.
 *
 * Extracted from QuerySessionManager as part of decomposition (Phase 1).
 *
 * @module services/audio-stream-handler
 */

import {
  validateAudioChunk,
  getValidationErrorMessage,
  isRecoverableValidationError
} from '../lib/audio/validation.js';
import { base64ToChunk, reassembleChunks } from '../lib/audio/audio-chunker.js';

/**
 * AudioStreamHandler Class
 *
 * Manages audio chunk buffering and sequencing for WebSocket streams.
 * Provides methods to receive, validate, buffer, and reassemble audio chunks.
 */
export class AudioStreamHandler {
  /**
   * Create AudioStreamHandler instance
   *
   * @param {Object} logger - Logger instance
   */
  constructor(logger) {
    this.logger = logger;

    // Audio chunk buffer (for handling out-of-order delivery)
    this.audioBuffer = [];

    // Expected sequence number for validation
    this.expectedSequence = 0;

    // Chunk statistics
    /** @type {{ totalChunksReceived: number, totalBytesReceived: number, firstChunkTime: number | null, lastChunkTime: number | null, validationFailures: number }} */
    this.stats = {
      totalChunksReceived: 0,
      totalBytesReceived: 0,
      firstChunkTime: null,
      lastChunkTime: null,
      validationFailures: 0
    };
  }

  /**
   * Handle incoming audio chunk from WebSocket
   *
   * Validates the chunk and adds it to the buffer if valid.
   *
   * @param {Object} message - Audio chunk message
   * @param {string} message.chunk - Base64 encoded audio data
   * @param {string} [message.data] - Legacy alias for `chunk` (base64 encoded audio)
   * @param {number} message.sequence - Sequence number
   * @param {number} message.timestamp - Unix timestamp
   * @returns {{ success: boolean, error?: { code: string, message: string, recoverable: boolean } }}
   */
  handleAudioChunk(message) {
    // Backward compatibility: some clients used `data` instead of `chunk`
    // Normalize before validation/buffering so we don't drop audio silently.
    const normalizedChunk = message?.chunk ?? message?.data;
    const normalizedMessage = normalizedChunk ? { ...message, chunk: normalizedChunk } : message;

    const { chunk, sequence, timestamp } = normalizedMessage;

    this.logger.info('Audio chunk received', {
      has_chunk: !!chunk,
      chunk_type: typeof chunk,
      chunk_length: chunk?.length || 0,
      sequence,
      timestamp
    });

    // Validate audio chunk
    const validation = validateAudioChunk(normalizedMessage);
    if (!validation.valid) {
      this.stats.validationFailures++;

      this.logger.error('Audio chunk validation failed', {
        errors: validation.errors,
        message_keys: Object.keys(message),
        has_chunk: !!normalizedMessage.chunk,
        chunk_type: typeof normalizedMessage.chunk,
        used_legacy_data_field: !!message?.data && !message?.chunk
      });

      const errorMessage = getValidationErrorMessage(validation);
      const recoverable = isRecoverableValidationError(validation);

      return {
        success: false,
        error: {
          code: 'AUDIO_VALIDATION_ERROR',
          message: errorMessage,
          recoverable
        }
      };
    }

    this.logger.info('Audio chunk validation passed');

    // Update statistics
    this.stats.totalChunksReceived++;
    this.stats.lastChunkTime = Date.now();
    if (!this.stats.firstChunkTime) {
      this.stats.firstChunkTime = Date.now();
    }

    // Estimate bytes received (base64 to binary size)
    const estimatedBytes = Math.floor((chunk.length * 3) / 4);
    this.stats.totalBytesReceived += estimatedBytes;

    // Buffer audio chunk
    this.audioBuffer.push({ chunk, sequence, timestamp });

    return { success: true };
  }

  /**
   * Get buffered audio, sorted by sequence and reassembled
   *
   * @returns {ArrayBuffer} Reassembled audio data
   * @throws {Error} If no audio chunks available
   */
  getBufferedAudio() {
    if (!this.audioBuffer.length) {
      throw new Error('No audio chunks available for processing');
    }

    // Sort chunks to guarantee ordering before reassembly
    const sortedChunks = [...this.audioBuffer].sort((a, b) => a.sequence - b.sequence);

    this.logger.info('Preparing audio for processing', {
      buffer_chunks: this.audioBuffer.length,
      sorted_chunks: sortedChunks.length,
      first_sequence: sortedChunks[0]?.sequence,
      last_sequence: sortedChunks[sortedChunks.length - 1]?.sequence
    });

    try {
      // Convert base64 chunks to Uint8Arrays
      const uint8Chunks = sortedChunks.map(entry => base64ToChunk(entry.chunk));

      // Reassemble into single buffer
      const reassembled = reassembleChunks(uint8Chunks);

      this.logger.info('Audio reassembled', {
        chunk_count: uint8Chunks.length,
        byte_length: reassembled.byteLength,
        byte_length_kb: (reassembled.byteLength / 1024).toFixed(2)
      });

      return reassembled;
    } catch (error) {
      this.logger.error('Failed to reassemble audio', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Clear the audio buffer
   */
  clearBuffer() {
    const clearedCount = this.audioBuffer.length;
    this.audioBuffer = [];
    this.expectedSequence = 0;

    this.logger.info('Audio buffer cleared', { cleared_chunks: clearedCount });
  }

  /**
   * Get current chunk count
   *
   * @returns {number} Number of buffered chunks
   */
  getChunkCount() {
    return this.audioBuffer.length;
  }

  /**
   * Get audio buffer statistics
   *
   * @returns {Object} Buffer statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentBufferSize: this.audioBuffer.length,
      bufferDurationMs: this.stats.lastChunkTime && this.stats.firstChunkTime
        ? this.stats.lastChunkTime - this.stats.firstChunkTime
        : 0
    };
  }

  /**
   * Check if buffer has audio data
   *
   * @returns {boolean} True if buffer contains chunks
   */
  hasAudio() {
    return this.audioBuffer.length > 0;
  }

  /**
   * Reset handler to initial state
   */
  reset() {
    this.audioBuffer = [];
    this.expectedSequence = 0;
    this.stats = {
      totalChunksReceived: 0,
      totalBytesReceived: 0,
      firstChunkTime: null,
      lastChunkTime: null,
      validationFailures: 0
    };

    this.logger.info('AudioStreamHandler reset');
  }
}

/**
 * Create AudioStreamHandler instance
 *
 * @param {Object} logger - Logger instance
 * @returns {AudioStreamHandler}
 */
export function createAudioStreamHandler(logger) {
  return new AudioStreamHandler(logger);
}
