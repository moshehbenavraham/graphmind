/**
 * Text-to-Speech Synthesizer Service
 *
 * Converts text answers to natural-sounding speech using Deepgram Aura-2 via Workers AI.
 * Handles synthesis, error handling, timeouts, and answer length validation.
 *
 * Feature 010: Text-to-Speech Responses
 */

import { sanitizeTextForTTS } from '../lib/audio/text-sanitizer.js';
import { validateAudioData } from '../lib/validation/audio-validator.js';

/**
 * TTS Configuration
 */
const TTS_CONFIG = {
  MODEL: '@cf/deepgram/aura-2',
  MAX_WORDS: 500,
  TIMEOUT_MS: 5000,
  FORMAT: 'webm/opus',
  SAMPLE_RATE: 24000,
  BITRATE: 64000,
};

/**
 * TTSSynthesizer Class
 *
 * Manages text-to-speech synthesis with caching, error handling, and validation.
 */
export class TTSSynthesizer {
  /**
   * @param {Object} ai - Workers AI binding
   * @param {Object} options - Configuration options
   */
  constructor(ai, options = {}) {
    this.ai = ai;
    this.config = { ...TTS_CONFIG, ...options };
  }

  /**
   * Synthesize text to speech
   *
   * @param {string} text - Answer text to synthesize
   * @param {Object} options - Synthesis options
   * @returns {Promise<{audio: ArrayBuffer, format: string, duration_ms: number}>}
   */
  async synthesize(text, options = {}) {
    try {
      // Validate input
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input for TTS synthesis');
      }

      // Sanitize text (remove markdown, special chars, etc.)
      const sanitizedText = sanitizeTextForTTS(text, {
        maxWords: this.config.MAX_WORDS,
      });

      if (!sanitizedText || sanitizedText.trim().length === 0) {
        throw new Error('Text is empty after sanitization');
      }

      // Handle very short answers
      if (sanitizedText.trim().length < 5) {
        console.warn('Very short answer for TTS:', sanitizedText);
      }

      console.log(`[TTS] Synthesizing text (${sanitizedText.length} chars)`);

      // Call Workers AI with timeout
      const synthesisPromise = this.callWorkersAI(sanitizedText, options);
      const timeoutPromise = this.createTimeout(this.config.TIMEOUT_MS);

      const audioData = await Promise.race([synthesisPromise, timeoutPromise]);

      // Validate audio data
      const validation = validateAudioData(audioData);
      if (!validation.valid) {
        throw new Error(`Invalid audio data: ${validation.error}`);
      }

      console.log(`[TTS] Synthesis complete (${audioData.byteLength} bytes)`);

      return {
        audio: audioData,
        format: this.config.FORMAT,
        duration_ms: this.estimateDuration(sanitizedText),
        sanitized_text: sanitizedText,
      };
    } catch (error) {
      console.error('[TTS] Synthesis failed:', error.message);
      throw this.handleError(error);
    }
  }

  /**
   * Call Workers AI Deepgram Aura-2 TTS
   *
   * @param {string} text - Sanitized text to synthesize
   * @param {Object} options - API options
   * @returns {Promise<ArrayBuffer>}
   */
  async callWorkersAI(text, options = {}) {
    try {
      const response = await this.ai.run(this.config.MODEL, {
        text: text,
        // Deepgram Aura-2 configuration
        voice: options.voice || 'aura-2',
        sample_rate: this.config.SAMPLE_RATE,
      });

      // Workers AI returns audio as ArrayBuffer or ReadableStream
      if (response instanceof ArrayBuffer) {
        return response;
      }

      // Handle ReadableStream response
      if (response && typeof response.arrayBuffer === 'function') {
        return await response.arrayBuffer();
      }

      // Handle Response object
      if (response instanceof Response) {
        return await response.arrayBuffer();
      }

      throw new Error('Unexpected response format from Workers AI');
    } catch (error) {
      console.error('[TTS] Workers AI call failed:', error);
      throw new Error(`Workers AI TTS failed: ${error.message}`);
    }
  }

  /**
   * Create timeout promise
   *
   * @param {number} ms - Timeout in milliseconds
   * @returns {Promise<never>}
   */
  createTimeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`TTS synthesis timeout after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Estimate audio duration from text length
   *
   * Rough estimate: ~150 words per minute = ~2.5 words per second
   *
   * @param {string} text - Text to estimate
   * @returns {number} Estimated duration in milliseconds
   */
  estimateDuration(text) {
    const words = text.split(/\s+/).length;
    const seconds = words / 2.5; // ~150 words per minute
    return Math.round(seconds * 1000);
  }

  /**
   * Handle TTS errors with appropriate error codes
   *
   * @param {Error} error - Original error
   * @returns {Error} Formatted error with code
   */
  handleError(error) {
    if (error.message.includes('timeout')) {
      const formattedError = new Error('TTS synthesis timeout');
      formattedError.code = 'TTS_TIMEOUT';
      return formattedError;
    }

    if (error.message.includes('Workers AI')) {
      const formattedError = new Error('TTS service unavailable');
      formattedError.code = 'TTS_SERVICE_UNAVAILABLE';
      return formattedError;
    }

    if (error.message.includes('Invalid audio')) {
      const formattedError = new Error('Invalid audio data received');
      formattedError.code = 'TTS_INVALID_AUDIO';
      return formattedError;
    }

    // Generic error
    const formattedError = new Error('TTS synthesis failed');
    formattedError.code = 'TTS_FAILED';
    formattedError.originalError = error;
    return formattedError;
  }

  /**
   * Check if error is recoverable
   *
   * @param {Error} error - Error to check
   * @returns {boolean} True if retry might succeed
   */
  isRecoverableError(error) {
    const recoverableCodes = ['TTS_TIMEOUT', 'TTS_SERVICE_UNAVAILABLE'];
    return recoverableCodes.includes(error.code);
  }
}

/**
 * Create TTSSynthesizer instance
 *
 * @param {Object} ai - Workers AI binding
 * @param {Object} options - Configuration options
 * @returns {TTSSynthesizer}
 */
export function createTTSSynthesizer(ai, options = {}) {
  return new TTSSynthesizer(ai, options);
}
