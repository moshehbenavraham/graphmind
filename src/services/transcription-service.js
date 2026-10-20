/**
 * TranscriptionService
 *
 * Handles audio-to-text transcription via Workers AI (Whisper).
 * Includes confidence validation and structured error handling.
 *
 * Extracted from QuerySessionManager as part of decomposition (Phase 2).
 *
 * @module services/transcription-service
 */

import { transcribeAudioChunk, TranscriptionError, TranscriptionErrorCode } from '../lib/audio/transcription.js';

/**
 * Minimum transcription confidence threshold (70%)
 * @const {number}
 */
const DEFAULT_MIN_CONFIDENCE = 0.7;

/**
 * TranscriptionResult type
 * @typedef {Object} TranscriptionResult
 * @property {string} text - Transcribed text
 * @property {number} confidence - Confidence score (0-1)
 * @property {boolean} is_final - Whether this is a final transcript
 * @property {boolean} valid - Whether transcript meets quality thresholds
 * @property {number} latency_ms - Transcription latency in milliseconds
 * @property {string} [error_code] - Error code if validation failed
 * @property {string} [error_message] - Error message if validation failed
 */

/**
 * TranscriptionService Class
 *
 * Manages audio transcription with confidence validation and error handling.
 */
export class TranscriptionService {
  /**
   * Create TranscriptionService instance
   *
   * @param {Object} env - Cloudflare Worker environment bindings
   * @param {Object} logger - Logger instance
   * @param {Object} options - Configuration options
   * @param {number} [options.minConfidence=0.7] - Minimum confidence threshold
   * @param {string} [options.language='en'] - Transcription language
   */
  constructor(env, logger, options = {}) {
    this.env = env;
    this.logger = logger;
    this.minConfidence = options.minConfidence || DEFAULT_MIN_CONFIDENCE;
    this.language = options.language || 'en';

    // Performance tracking
    this.metrics = {
      totalTranscriptions: 0,
      successfulTranscriptions: 0,
      failedTranscriptions: 0,
      lowConfidenceTranscriptions: 0,
      emptyTranscriptions: 0,
      totalLatencyMs: 0
    };
  }

  /**
   * Transcribe audio data to text
   *
   * @param {ArrayBuffer|Uint8Array|string} audioData - Audio data to transcribe
   * @param {Object} options - Transcription options
   * @param {string} [options.language] - Override language setting
   * @returns {Promise<TranscriptionResult>} Transcription result
   * @throws {TranscriptionServiceError} If transcription fails
   */
  async transcribeAudio(audioData, options = {}) {
    const startTime = Date.now();
    this.metrics.totalTranscriptions++;

    this.logger.info('Starting transcription', {
      audio_type: audioData instanceof ArrayBuffer ? 'ArrayBuffer' :
                  audioData instanceof Uint8Array ? 'Uint8Array' : 'string',
      audio_size: audioData instanceof ArrayBuffer ? audioData.byteLength :
                  audioData instanceof Uint8Array ? audioData.byteLength :
                  Math.floor((audioData.length * 3) / 4)
    });

    try {
      const transcription = await transcribeAudioChunk(audioData, this.env, {
        language: options.language || this.language
      });

      const latencyMs = Date.now() - startTime;
      this.metrics.totalLatencyMs += latencyMs;

      // Process transcription result
      const text = (transcription.text || '').trim();
      const confidence = transcription.confidence || 1.0;

      this.logger.info('Transcription completed', {
        text_length: text.length,
        confidence,
        latency_ms: latencyMs
      });

      // Check for empty transcription
      if (!text || text.length === 0) {
        this.metrics.emptyTranscriptions++;
        return {
          text: '',
          confidence: 1.0,
          is_final: true,
          valid: false,
          latency_ms: latencyMs,
          error_code: 'EMPTY_TRANSCRIPT',
          error_message: 'No speech detected in audio'
        };
      }

      // Check confidence threshold
      if (confidence < this.minConfidence) {
        this.metrics.lowConfidenceTranscriptions++;
        return {
          text,
          confidence,
          is_final: true,
          valid: false,
          latency_ms: latencyMs,
          error_code: 'LOW_CONFIDENCE_TRANSCRIPT',
          error_message: 'Transcription confidence below threshold'
        };
      }

      this.metrics.successfulTranscriptions++;

      return {
        text,
        confidence,
        is_final: true,
        valid: true,
        latency_ms: latencyMs
      };

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.metrics.failedTranscriptions++;

      this.logger.error('Transcription failed', {
        error_name: error.name,
        error_message: error.message,
        error_code: error.code,
        latency_ms: latencyMs
      });

      throw new TranscriptionServiceError(
        'Transcription failed',
        this.mapErrorCode(error),
        error
      );
    }
  }

  /**
   * Validate a transcription result
   *
   * @param {string} transcript - Transcript text to validate
   * @param {number} confidence - Confidence score
   * @returns {{ valid: boolean, reason?: string }}
   */
  validateTranscript(transcript, confidence) {
    // Check for empty transcript
    if (!transcript || transcript.trim().length === 0) {
      return {
        valid: false,
        reason: 'Empty transcript'
      };
    }

    // Check confidence threshold
    if (confidence < this.minConfidence) {
      return {
        valid: false,
        reason: `Confidence ${confidence.toFixed(2)} below threshold ${this.minConfidence}`
      };
    }

    // Check minimum length (at least a few characters)
    if (transcript.trim().length < 2) {
      return {
        valid: false,
        reason: 'Transcript too short'
      };
    }

    return { valid: true };
  }

  /**
   * Map error to appropriate error code
   *
   * @param {Error} error - Original error
   * @returns {string} Error code
   */
  mapErrorCode(error) {
    if (error instanceof TranscriptionError) {
      return error.code;
    }

    if (error.message?.toLowerCase().includes('timeout')) {
      return 'TRANSCRIPTION_TIMEOUT';
    }

    if (error.message?.toLowerCase().includes('service')) {
      return 'TRANSCRIPTION_SERVICE_ERROR';
    }

    return 'TRANSCRIPTION_ERROR';
  }

  /**
   * Get service metrics
   *
   * @returns {Object} Service metrics
   */
  getMetrics() {
    const avgLatency = this.metrics.totalTranscriptions > 0
      ? this.metrics.totalLatencyMs / this.metrics.totalTranscriptions
      : 0;

    return {
      ...this.metrics,
      averageLatencyMs: Math.round(avgLatency),
      successRate: this.metrics.totalTranscriptions > 0
        ? (this.metrics.successfulTranscriptions / this.metrics.totalTranscriptions) * 100
        : 0
    };
  }

  /**
   * Reset service metrics
   */
  resetMetrics() {
    this.metrics = {
      totalTranscriptions: 0,
      successfulTranscriptions: 0,
      failedTranscriptions: 0,
      lowConfidenceTranscriptions: 0,
      emptyTranscriptions: 0,
      totalLatencyMs: 0
    };
  }
}

/**
 * Custom error class for transcription service failures
 */
export class TranscriptionServiceError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Error|null} [originalError=null] - Original error if wrapping
   */
  constructor(message, code, originalError = null) {
    super(message);
    this.name = 'TranscriptionServiceError';
    this.code = code;
    this.originalError = originalError;
  }

  /**
   * Check if error is recoverable (client can retry)
   *
   * @returns {boolean}
   */
  isRecoverable() {
    const recoverableCodes = [
      'TRANSCRIPTION_TIMEOUT',
      'TRANSCRIPTION_SERVICE_ERROR',
      TranscriptionErrorCode.TIMEOUT,
      TranscriptionErrorCode.AI_SERVICE_ERROR
    ];
    return recoverableCodes.includes(this.code);
  }
}

/**
 * Create TranscriptionService instance
 *
 * @param {Object} env - Cloudflare Worker environment bindings
 * @param {Object} logger - Logger instance
 * @param {Object} options - Configuration options
 * @returns {TranscriptionService}
 */
export function createTranscriptionService(env, logger, options = {}) {
  return new TranscriptionService(env, logger, options);
}
