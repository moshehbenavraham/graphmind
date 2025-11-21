/**
 * Audio Validator Utility
 *
 * Validates audio data format, size, and integrity.
 * Ensures audio is valid WebM/Opus before caching or transmission.
 *
 * Feature 010: Text-to-Speech Responses
 */

/**
 * Validation configuration
 */
const VALIDATION_CONFIG = {
  MAX_SIZE_MB: 10, // Maximum audio file size
  MIN_SIZE_BYTES: 100, // Minimum valid audio size
  SUPPORTED_FORMATS: ['webm', 'opus'],
};

/**
 * WebM file signature (magic bytes)
 */
const WEBM_SIGNATURE = [0x1A, 0x45, 0xDF, 0xA3];

/**
 * Validate audio data
 *
 * @param {ArrayBuffer} audioData - Audio data to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result {valid: boolean, error?: string}
 */
export function validateAudioData(audioData, options = {}) {
  const config = { ...VALIDATION_CONFIG, ...options };

  // Check if audioData is ArrayBuffer
  if (!(audioData instanceof ArrayBuffer)) {
    return {
      valid: false,
      error: 'Audio data must be an ArrayBuffer',
    };
  }

  // Check size
  const sizeMB = audioData.byteLength / (1024 * 1024);
  if (audioData.byteLength < config.MIN_SIZE_BYTES) {
    return {
      valid: false,
      error: `Audio data too small (${audioData.byteLength} bytes)`,
    };
  }

  if (sizeMB > config.MAX_SIZE_MB) {
    return {
      valid: false,
      error: `Audio data too large (${sizeMB.toFixed(2)}MB)`,
    };
  }

  // Check WebM signature
  const isWebM = validateWebMSignature(audioData);
  if (!isWebM) {
    return {
      valid: false,
      error: 'Invalid WebM file signature',
    };
  }

  return {
    valid: true,
    size_bytes: audioData.byteLength,
    size_mb: sizeMB.toFixed(2),
  };
}

/**
 * Validate WebM file signature
 *
 * @param {ArrayBuffer} audioData - Audio data
 * @returns {boolean} True if valid WebM file
 */
export function validateWebMSignature(audioData) {
  if (audioData.byteLength < 4) {
    return false;
  }

  const bytes = new Uint8Array(audioData);

  // Check first 4 bytes match WebM signature
  for (let i = 0; i < WEBM_SIGNATURE.length; i++) {
    if (bytes[i] !== WEBM_SIGNATURE[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Validate audio format string
 *
 * @param {string} format - Audio format (e.g., "webm/opus")
 * @returns {boolean} True if format is supported
 */
export function validateAudioFormat(format) {
  if (typeof format !== 'string') {
    return false;
  }

  const lowerFormat = format.toLowerCase();
  return VALIDATION_CONFIG.SUPPORTED_FORMATS.some(f => lowerFormat.includes(f));
}

/**
 * Validate audio duration
 *
 * @param {number} durationMs - Duration in milliseconds
 * @param {Object} options - Validation options
 * @returns {boolean} True if duration is reasonable
 */
export function validateAudioDuration(durationMs, options = {}) {
  const { minMs = 100, maxMs = 300000 } = options; // 0.1s to 5 minutes

  if (typeof durationMs !== 'number' || durationMs < 0) {
    return false;
  }

  return durationMs >= minMs && durationMs <= maxMs;
}

/**
 * Validate cached audio object
 *
 * @param {Object} cached - Cached audio object
 * @returns {Object} Validation result
 */
export function validateCachedAudio(cached) {
  if (!cached || typeof cached !== 'object') {
    return {
      valid: false,
      error: 'Cached audio must be an object',
    };
  }

  // Check required fields
  if (!cached.audio) {
    return {
      valid: false,
      error: 'Missing audio data',
    };
  }

  if (!cached.format) {
    return {
      valid: false,
      error: 'Missing audio format',
    };
  }

  // Validate format
  if (!validateAudioFormat(cached.format)) {
    return {
      valid: false,
      error: `Unsupported audio format: ${cached.format}`,
    };
  }

  // Validate duration if present
  if (cached.duration_ms && !validateAudioDuration(cached.duration_ms)) {
    return {
      valid: false,
      error: `Invalid audio duration: ${cached.duration_ms}ms`,
    };
  }

  return {
    valid: true,
  };
}

/**
 * Check if audio data is corrupt
 *
 * @param {ArrayBuffer} audioData - Audio data to check
 * @returns {boolean} True if audio appears corrupt
 */
export function isAudioCorrupt(audioData) {
  // Simple corruption check: all zeros
  const bytes = new Uint8Array(audioData);
  let nonZeroCount = 0;

  // Sample first 1KB
  const sampleSize = Math.min(1024, bytes.length);
  for (let i = 0; i < sampleSize; i++) {
    if (bytes[i] !== 0) {
      nonZeroCount++;
    }
  }

  // If less than 10% non-zero bytes, likely corrupt
  const nonZeroPercent = (nonZeroCount / sampleSize) * 100;
  return nonZeroPercent < 10;
}
