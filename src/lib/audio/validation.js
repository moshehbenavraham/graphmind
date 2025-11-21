/**
 * Audio Validation Utility
 *
 * Provides validation functionality for audio chunks and related data.
 * Ensures audio data meets requirements before processing.
 *
 * @module lib/audio/validation
 */

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {Array<string>} errors - Array of error messages (empty if valid)
 */

/**
 * Audio chunk message structure (WebSocket format)
 * @typedef {Object} AudioChunkMessage
 * @property {string} type - Message type (should be 'audio_chunk')
 * @property {string} chunk - Base64 encoded audio data
 * @property {number} sequence - Sequence number for ordering
 * @property {number} timestamp - Unix timestamp in milliseconds
 */

/**
 * Maximum audio chunk size (2MB)
 * @const {number}
 */
export const MAX_CHUNK_SIZE = 2 * 1024 * 1024;

/**
 * Minimum audio chunk size (100 bytes)
 * @const {number}
 */
export const MIN_CHUNK_SIZE = 100;

/**
 * Maximum sequence number
 * @const {number}
 */
export const MAX_SEQUENCE_NUMBER = Number.MAX_SAFE_INTEGER;

/**
 * Validation error codes
 * @enum {string}
 */
export const ValidationErrorCode = {
  INVALID_FORMAT: 'INVALID_FORMAT',
  CHUNK_TOO_LARGE: 'CHUNK_TOO_LARGE',
  CHUNK_TOO_SMALL: 'CHUNK_TOO_SMALL',
  INVALID_SEQUENCE: 'INVALID_SEQUENCE',
  INVALID_TIMESTAMP: 'INVALID_TIMESTAMP',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_TYPE: 'INVALID_TYPE',
  INVALID_BASE64: 'INVALID_BASE64'
};

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code from ValidationErrorCode
   * @param {Array<string>} [errors] - Array of detailed error messages
   */
  constructor(message, code, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.errors = errors;
  }
}

/**
 * Validate base64 string format
 *
 * @param {string} base64String - String to validate
 * @returns {boolean} True if valid base64
 */
function isValidBase64(base64String) {
  if (typeof base64String !== 'string') {
    return false;
  }

  // Check for empty string
  if (base64String.length === 0) {
    return false;
  }

  // Base64 regex pattern
  const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

  return base64Regex.test(base64String);
}

/**
 * Calculate decoded size of base64 string
 *
 * @param {string} base64String - Base64 encoded string
 * @returns {number} Decoded size in bytes
 */
function getBase64DecodedSize(base64String) {
  if (!base64String || typeof base64String !== 'string') {
    return 0;
  }

  let length = base64String.length;
  let padding = 0;

  // Count padding characters
  if (base64String.endsWith('==')) {
    padding = 2;
  } else if (base64String.endsWith('=')) {
    padding = 1;
  }

  return (length * 3) / 4 - padding;
}

/**
 * Validate audio chunk format (base64 or ArrayBuffer)
 *
 * @param {string|ArrayBuffer} audioChunk - Audio data to validate
 * @returns {ValidationResult} Validation result
 *
 * @example
 * const result = validateAudioFormat(base64Audio);
 * if (!result.valid) {
 *   console.error('Invalid audio:', result.errors);
 * }
 */
export function validateAudioFormat(audioChunk) {
  const errors = [];

  // Check if chunk exists
  if (!audioChunk) {
    errors.push('Audio chunk is required');
    return { valid: false, errors };
  }

  // Check type
  const isString = typeof audioChunk === 'string';
  const isArrayBuffer = audioChunk instanceof ArrayBuffer;

  if (!isString && !isArrayBuffer) {
    errors.push('Audio chunk must be a base64 string or ArrayBuffer');
    return { valid: false, errors };
  }

  // Validate base64 string
  if (isString) {
    if (!isValidBase64(audioChunk)) {
      errors.push('Invalid base64 encoding');
      return { valid: false, errors };
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate audio chunk size
 *
 * @param {string|ArrayBuffer} audioChunk - Audio data to validate
 * @returns {ValidationResult} Validation result with size details
 *
 * @example
 * const result = validateAudioSize(audioChunk);
 * if (!result.valid) {
 *   console.error('Size validation failed:', result.errors);
 * }
 */
export function validateAudioSize(audioChunk) {
  const errors = [];

  if (!audioChunk) {
    errors.push('Audio chunk is required');
    return { valid: false, errors };
  }

  let sizeInBytes;

  // Determine size based on type
  if (typeof audioChunk === 'string') {
    sizeInBytes = getBase64DecodedSize(audioChunk);
  } else if (audioChunk instanceof ArrayBuffer) {
    sizeInBytes = audioChunk.byteLength;
  } else {
    errors.push('Audio chunk must be a base64 string or ArrayBuffer');
    return { valid: false, errors };
  }

  // Check minimum size
  if (sizeInBytes < MIN_CHUNK_SIZE) {
    errors.push(
      `Audio chunk too small: ${sizeInBytes} bytes (minimum: ${MIN_CHUNK_SIZE} bytes)`
    );
  }

  // Check maximum size
  if (sizeInBytes > MAX_CHUNK_SIZE) {
    errors.push(
      `Audio chunk too large: ${sizeInBytes} bytes (maximum: ${MAX_CHUNK_SIZE} bytes)`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate sequence number
 *
 * @param {number} sequence - Sequence number to validate
 * @param {number} [expectedSequence] - Optional expected sequence number
 * @returns {ValidationResult} Validation result
 *
 * @example
 * const result = validateSequence(5, 4);
 * if (!result.valid) {
 *   console.error('Sequence error:', result.errors);
 * }
 */
export function validateSequence(sequence, expectedSequence = null) {
  const errors = [];

  // Check if sequence is provided
  if (sequence === undefined || sequence === null) {
    errors.push('Sequence number is required');
    return { valid: false, errors };
  }

  // Check if sequence is a number
  if (typeof sequence !== 'number') {
    errors.push('Sequence must be a number');
    return { valid: false, errors };
  }

  // Check if sequence is an integer
  if (!Number.isInteger(sequence)) {
    errors.push('Sequence must be an integer');
    return { valid: false, errors };
  }

  // Check if sequence is non-negative
  if (sequence < 0) {
    errors.push('Sequence must be non-negative');
    return { valid: false, errors };
  }

  // Check if sequence is within safe range
  if (sequence > MAX_SEQUENCE_NUMBER) {
    errors.push(`Sequence exceeds maximum: ${MAX_SEQUENCE_NUMBER}`);
    return { valid: false, errors };
  }

  // Check expected sequence if provided
  if (expectedSequence !== null && typeof expectedSequence === 'number') {
    if (sequence !== expectedSequence) {
      errors.push(
        `Sequence mismatch: expected ${expectedSequence}, got ${sequence}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate timestamp
 *
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {ValidationResult} Validation result
 *
 * @example
 * const result = validateTimestamp(Date.now());
 * if (!result.valid) {
 *   console.error('Timestamp error:', result.errors);
 * }
 */
export function validateTimestamp(timestamp) {
  const errors = [];

  // Check if timestamp is provided
  if (timestamp === undefined || timestamp === null) {
    errors.push('Timestamp is required');
    return { valid: false, errors };
  }

  // Check if timestamp is a number
  if (typeof timestamp !== 'number') {
    errors.push('Timestamp must be a number');
    return { valid: false, errors };
  }

  // Check if timestamp is positive
  if (timestamp <= 0) {
    errors.push('Timestamp must be positive');
    return { valid: false, errors };
  }

  // Check if timestamp is reasonable (not in the far future)
  const now = Date.now();
  const maxFutureTime = now + 60000; // 1 minute in the future
  if (timestamp > maxFutureTime) {
    errors.push('Timestamp is too far in the future');
    return { valid: false, errors };
  }

  // Check if timestamp is not too old (more than 1 hour ago)
  const minPastTime = now - 3600000; // 1 hour ago
  if (timestamp < minPastTime) {
    errors.push('Timestamp is too old (more than 1 hour ago)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate complete audio chunk message (WebSocket format)
 *
 * Performs comprehensive validation of the entire message structure
 * including type, chunk data, sequence, and timestamp.
 *
 * @param {AudioChunkMessage|Object} message - Message to validate
 * @param {number} [expectedSequence] - Optional expected sequence number
 * @returns {ValidationResult} Validation result with all errors
 * @throws {ValidationError} If validation fails
 *
 * @example
 * const message = {
 *   type: 'audio_chunk',
 *   chunk: base64Audio,
 *   sequence: 1,
 *   timestamp: Date.now()
 * };
 * const result = validateAudioChunk(message);
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * }
 */
export function validateAudioChunk(message, expectedSequence = null) {
  const errors = [];

  // Validate message exists
  if (!message || typeof message !== 'object') {
    errors.push('Message must be an object');
    return { valid: false, errors };
  }

  // Validate message type
  if (!message.type) {
    errors.push('Message type is required');
  } else if (message.type !== 'audio_chunk') {
    errors.push(`Invalid message type: expected 'audio_chunk', got '${message.type}'`);
  }

  // Validate chunk field exists
  if (!message.chunk) {
    errors.push('Audio chunk field is required');
  } else {
    // Validate chunk format
    const formatResult = validateAudioFormat(message.chunk);
    if (!formatResult.valid) {
      errors.push(...formatResult.errors);
    } else {
      // Validate chunk size (only if format is valid)
      const sizeResult = validateAudioSize(message.chunk);
      if (!sizeResult.valid) {
        errors.push(...sizeResult.errors);
      }
    }
  }

  // Validate sequence
  if (message.sequence === undefined || message.sequence === null) {
    errors.push('Sequence number is required');
  } else {
    const sequenceResult = validateSequence(message.sequence, expectedSequence);
    if (!sequenceResult.valid) {
      errors.push(...sequenceResult.errors);
    }
  }

  // Validate timestamp
  if (message.timestamp === undefined || message.timestamp === null) {
    errors.push('Timestamp is required');
  } else {
    const timestampResult = validateTimestamp(message.timestamp);
    if (!timestampResult.valid) {
      errors.push(...timestampResult.errors);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate audio chunk and throw error if invalid
 *
 * Convenience function that validates and throws ValidationError if invalid.
 * Use this when you want validation to throw exceptions instead of returning results.
 *
 * @param {AudioChunkMessage|Object} message - Message to validate
 * @param {number} [expectedSequence] - Optional expected sequence number
 * @throws {ValidationError} If validation fails
 *
 * @example
 * try {
 *   validateAudioChunkOrThrow(message);
 *   // Process valid audio chunk
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.error('Validation failed:', error.errors);
 *   }
 * }
 */
export function validateAudioChunkOrThrow(message, expectedSequence = null) {
  const result = validateAudioChunk(message, expectedSequence);

  if (!result.valid) {
    throw new ValidationError(
      'Audio chunk validation failed',
      ValidationErrorCode.INVALID_FORMAT,
      result.errors
    );
  }
}

/**
 * Create a sanitized error message for client response
 *
 * Converts validation errors into a user-friendly message suitable
 * for sending to clients via WebSocket.
 *
 * @param {ValidationResult} validationResult - Validation result to convert
 * @returns {string} User-friendly error message
 *
 * @example
 * const result = validateAudioChunk(message);
 * if (!result.valid) {
 *   const errorMessage = getValidationErrorMessage(result);
 *   ws.send(JSON.stringify({ type: 'error', message: errorMessage }));
 * }
 */
export function getValidationErrorMessage(validationResult) {
  if (validationResult.valid || validationResult.errors.length === 0) {
    return 'Validation passed';
  }

  // Return first error for simplicity (avoid overwhelming client)
  return validationResult.errors[0];
}

/**
 * Check if validation error is recoverable
 *
 * Determines if the client can retry after fixing the issue.
 * Some errors (like sequence mismatch) are recoverable, others (like invalid format) are not.
 *
 * @param {ValidationResult} validationResult - Validation result to check
 * @returns {boolean} True if error is recoverable
 *
 * @example
 * const result = validateAudioChunk(message);
 * if (!result.valid) {
 *   const recoverable = isRecoverableValidationError(result);
 *   ws.send(JSON.stringify({
 *     type: 'error',
 *     message: getValidationErrorMessage(result),
 *     recoverable
 *   }));
 * }
 */
export function isRecoverableValidationError(validationResult) {
  if (validationResult.valid) {
    return true;
  }

  // Check for unrecoverable errors
  const unrecoverablePatterns = [
    'must be an object',
    'must be a number',
    'must be an integer',
    'Invalid base64',
    'Invalid message type'
  ];

  for (const error of validationResult.errors) {
    for (const pattern of unrecoverablePatterns) {
      if (error.includes(pattern)) {
        return false;
      }
    }
  }

  // Recoverable errors: size issues, sequence mismatches, timestamp issues
  return true;
}
