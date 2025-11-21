/**
 * Audio Transcription Utility
 *
 * Provides audio transcription functionality using Workers AI (Whisper Large v3 Turbo).
 * This module handles audio chunk transcription for batch processing.
 *
 * @module lib/audio/transcription
 */

/**
 * Transcription configuration for Workers AI
 * @typedef {Object} TranscriptionConfig
 * @property {string} language - Language code (default: 'en')
 */

/**
 * Transcription result returned from Workers AI
 * @typedef {Object} TranscriptionResult
 * @property {string} text - Transcribed text
 * @property {boolean} is_final - Whether this is the final transcript for the chunk
 * @property {number} confidence - Confidence score (0-1)
 */

/**
 * Error codes for transcription failures
 * @enum {string}
 */
export const TranscriptionErrorCode = {
  INVALID_AUDIO: 'INVALID_AUDIO',
  AUDIO_TOO_LARGE: 'AUDIO_TOO_LARGE',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  ENCODING_ERROR: 'ENCODING_ERROR',
  TIMEOUT: 'TIMEOUT'
};

/**
 * Custom error class for transcription failures
 */
export class TranscriptionError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code from TranscriptionErrorCode
   * @param {Error} [originalError] - Original error if wrapping
   */
  constructor(message, code, originalError = null) {
    super(message);
    this.name = 'TranscriptionError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Default transcription configuration
 * @type {TranscriptionConfig}
 */
const DEFAULT_CONFIG = {
  language: 'en'
};

/**
 * Chunk size for binary → base64 conversion
 * Using a smaller slice avoids call stack limits on large buffers.
 */
const BASE64_CHUNK_SIZE = 0x8000; // 32KB

/**
 * Convert Uint8Array to base64 string safely
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function uint8ToBase64(bytes) {
  let binary = '';

  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

/**
 * Convert ArrayBuffer to base64 string
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
  return uint8ToBase64(new Uint8Array(buffer));
}

/**
 * Calculate the decoded byte size of a base64 string
 * @param {string} base64String
 * @returns {number}
 */
function getDecodedSize(base64String) {
  let padding = 0;
  if (base64String.endsWith('==')) {
    padding = 2;
  } else if (base64String.endsWith('=')) {
    padding = 1;
  }
  return (base64String.length * 3) / 4 - padding;
}

/**
 * Maximum audio chunk size (2MB)
 * @const {number}
 */
const MAX_CHUNK_SIZE = 2 * 1024 * 1024;

/**
 * Decode base64 string to Uint8Array
 * @param {string} base64String
 * @returns {Uint8Array}
 */
function base64ToUint8Array(base64String) {
  const binary = atob(base64String);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/**
 * Transcribe an audio chunk using Workers AI (Whisper Large v3 Turbo)
 *
 * This function accepts audio as raw bytes (preferred) or base64
 * and returns a final transcript. Whisper processes complete audio
 * chunks, so all results are final (no interim transcripts).
 *
 * Audio Requirements:
 * - Format: WebM/Opus, MP3, WAV, or other common formats
 * - Chunk size: 1-2 seconds recommended for optimal performance
 * - Max size: 2MB per chunk
 *
 * @param {string|ArrayBuffer|Uint8Array} audioChunk - Audio data to transcribe
 * @param {Object} env - Cloudflare Worker environment bindings
 * @param {TranscriptionConfig} [config] - Optional transcription configuration
 * @returns {Promise<TranscriptionResult>} Transcription result
 * @throws {TranscriptionError} If transcription fails
 *
 * @example
 * // Using base64 encoded audio
 * const result = await transcribeAudioChunk(base64Audio, env);
 * console.log(result.text); // "Hello, this is a test"
 * console.log(result.is_final); // true (always true with Whisper)
 * console.log(result.confidence); // 1.0 (Whisper doesn't return confidence)
 */
export async function transcribeAudioChunk(audioChunk, env, config = {}) {
  // Validate environment
  if (!env || !env.AI) {
    throw new TranscriptionError(
      'Workers AI binding not available',
      TranscriptionErrorCode.AI_SERVICE_ERROR
    );
  }

  // Validate audio chunk
  if (!audioChunk) {
    throw new TranscriptionError(
      'Audio chunk is required',
      TranscriptionErrorCode.INVALID_AUDIO
    );
  }

  // Merge config with defaults
  const transcriptionConfig = { ...DEFAULT_CONFIG, ...config };

  // Normalize audio to base64 string (Workers AI Whisper requirement)
  let audioBase64;
  try {
    if (typeof audioChunk === 'string') {
      // Already base64 string - validate size and KEEP IT
      const decodedSize = getDecodedSize(audioChunk);
      if (decodedSize > MAX_CHUNK_SIZE) {
        throw new TranscriptionError(
          `Audio chunk too large: ${decodedSize} bytes (max: ${MAX_CHUNK_SIZE} bytes)`,
          TranscriptionErrorCode.AUDIO_TOO_LARGE
        );
      }
      audioBase64 = audioChunk;  // ✅ Keep as base64 string
    } else if (audioChunk instanceof ArrayBuffer) {
      // ArrayBuffer - validate size and convert to base64
      if (audioChunk.byteLength > MAX_CHUNK_SIZE) {
        throw new TranscriptionError(
          `Audio chunk too large: ${audioChunk.byteLength} bytes (max: ${MAX_CHUNK_SIZE} bytes)`,
          TranscriptionErrorCode.AUDIO_TOO_LARGE
        );
      }
      audioBase64 = arrayBufferToBase64(audioChunk);  // ✅ Convert to base64
    } else if (audioChunk instanceof Uint8Array) {
      // Uint8Array - validate size and convert to base64
      if (audioChunk.byteLength > MAX_CHUNK_SIZE) {
        throw new TranscriptionError(
          `Audio chunk too large: ${audioChunk.byteLength} bytes (max: ${MAX_CHUNK_SIZE} bytes)`,
          TranscriptionErrorCode.AUDIO_TOO_LARGE
        );
      }
      audioBase64 = uint8ToBase64(audioChunk);  // ✅ Convert to base64
    } else {
      throw new TranscriptionError(
        'Audio chunk must be a base64 string, Uint8Array, or ArrayBuffer',
        TranscriptionErrorCode.INVALID_AUDIO
      );
    }
  } catch (error) {
    if (error instanceof TranscriptionError) {
      throw error;
    }
    throw new TranscriptionError(
      'Failed to process audio chunk format',
      TranscriptionErrorCode.ENCODING_ERROR,
      error
    );
  }

  // Validate we have a base64 string
  if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
    throw new TranscriptionError(
      'Audio data must be a non-empty base64 string for Whisper API',
      TranscriptionErrorCode.ENCODING_ERROR
    );
  }

  // Call Workers AI with Whisper Large v3 Turbo
  try {
    // Log what we're sending to Workers AI (with enhanced diagnostics)
    const decodedSize = getDecodedSize(audioBase64);
    console.log('[Transcription] Calling Workers AI', {
      model: '@cf/openai/whisper-large-v3-turbo',
      audio_format: 'base64',
      base64_length: audioBase64.length,
      decoded_bytes: decodedSize,
      decoded_kb: (decodedSize / 1024).toFixed(2),
      audio_preview: audioBase64.substring(0, 100) + '...',
      config: transcriptionConfig
    });

    // Workers AI Whisper accepts base64 string
    // NOTE: Whisper does NOT support interim_results, smart_format, or streaming parameters
    // All transcriptions are final and complete
    const response = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
      audio: audioBase64,
      language: transcriptionConfig.language
    });

    // Log the response with detailed diagnostics
    console.log('[Transcription] Workers AI response received', {
      has_response: !!response,
      response_type: typeof response,
      response_keys: response ? Object.keys(response) : [],
      has_text: !!response?.text,
      text_length: response?.text?.length || 0,
      text_value: response?.text || '(empty)',
      text_preview: response?.text ? response.text.substring(0, 100) : '(no text)',
      raw_response: JSON.stringify(response)
    });

    // Validate response structure
    if (!response || typeof response !== 'object') {
      throw new TranscriptionError(
        'Invalid response from Workers AI',
        TranscriptionErrorCode.AI_SERVICE_ERROR
      );
    }

    // Extract transcript from Whisper response
    // Whisper always returns final transcripts (no interim results)
    // Whisper doesn't return confidence scores, so we use 1.0 as default
    const text = response.text || '';

    if (!text || text.trim().length === 0) {
      console.log('[Transcription] Empty transcript received from Whisper');
      return {
        text: '',
        is_final: true,
        confidence: 1.0
      };
    }

    return {
      text: text.trim(),
      is_final: true, // Whisper always returns final transcripts
      confidence: 1.0 // Whisper doesn't provide confidence scores
    };
  } catch (error) {
    // Handle specific Workers AI errors
    if (error instanceof TranscriptionError) {
      throw error;
    }

    // Check for timeout errors
    if (error.message && error.message.toLowerCase().includes('timeout')) {
      throw new TranscriptionError(
        'Transcription request timed out',
        TranscriptionErrorCode.TIMEOUT,
        error
      );
    }

    // Check for service errors
    if (error.message && (
      error.message.toLowerCase().includes('service') ||
      error.message.toLowerCase().includes('unavailable') ||
      error.message.toLowerCase().includes('ai')
    )) {
      throw new TranscriptionError(
        'Workers AI service error',
        TranscriptionErrorCode.AI_SERVICE_ERROR,
        error
      );
    }

    // Generic transcription error
    throw new TranscriptionError(
      `Transcription failed: ${error.message || 'Unknown error'}`,
      TranscriptionErrorCode.AI_SERVICE_ERROR,
      error
    );
  }
}

/**
 * Batch transcribe multiple audio chunks
 *
 * Processes multiple audio chunks in parallel for improved performance.
 * Note: Be mindful of Workers AI rate limits and concurrent request limits.
 *
 * @param {Array<string|ArrayBuffer>} audioChunks - Array of audio chunks
 * @param {Object} env - Cloudflare Worker environment bindings
 * @param {TranscriptionConfig} [config] - Optional transcription configuration
 * @returns {Promise<Array<TranscriptionResult>>} Array of transcription results
 * @throws {TranscriptionError} If any transcription fails
 *
 * @example
 * const chunks = [chunk1, chunk2, chunk3];
 * const results = await batchTranscribeAudioChunks(chunks, env);
 * console.log(results); // Array of transcription results
 */
export async function batchTranscribeAudioChunks(audioChunks, env, config = {}) {
  if (!Array.isArray(audioChunks)) {
    throw new TranscriptionError(
      'audioChunks must be an array',
      TranscriptionErrorCode.INVALID_AUDIO
    );
  }

  if (audioChunks.length === 0) {
    return [];
  }

  try {
    const results = await Promise.all(
      audioChunks.map(chunk => transcribeAudioChunk(chunk, env, config))
    );
    return results;
  } catch (error) {
    if (error instanceof TranscriptionError) {
      throw error;
    }
    throw new TranscriptionError(
      'Batch transcription failed',
      TranscriptionErrorCode.AI_SERVICE_ERROR,
      error
    );
  }
}

/**
 * Calculate estimated duration of audio chunk in seconds
 * Based on PCM 16kHz mono format assumptions
 *
 * @param {string|ArrayBuffer} audioChunk - Audio data
 * @returns {number} Estimated duration in seconds
 */
export function estimateAudioDuration(audioChunk) {
  const SAMPLE_RATE = 16000; // 16kHz
  const BYTES_PER_SAMPLE = 2; // 16-bit PCM

  let sizeInBytes;
  if (typeof audioChunk === 'string') {
    // Base64 string
    sizeInBytes = (audioChunk.length * 3) / 4;
  } else if (audioChunk instanceof ArrayBuffer) {
    sizeInBytes = audioChunk.byteLength;
  } else {
    return 0;
  }

  const samples = sizeInBytes / BYTES_PER_SAMPLE;
  return samples / SAMPLE_RATE;
}
