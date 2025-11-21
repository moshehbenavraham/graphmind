/**
 * Audio Chunker Utility
 *
 * Splits audio data into chunks for streaming over WebSocket.
 * Uses configurable chunk size (default 4KB) for optimal latency/overhead balance.
 *
 * Feature 010: Text-to-Speech Responses
 */

/**
 * Default chunk size (4KB)
 * Balance between latency (smaller = faster first chunk) and overhead
 */
const DEFAULT_CHUNK_SIZE = 4 * 1024; // 4KB

/**
 * Chunk audio data into fixed-size pieces
 *
 * @param {ArrayBuffer} audioData - Complete audio data
 * @param {number} chunkSize - Size of each chunk in bytes (default: 4KB)
 * @returns {Array<Uint8Array>} Array of audio chunks
 */
export function chunkAudio(audioData, chunkSize = DEFAULT_CHUNK_SIZE) {
  if (!(audioData instanceof ArrayBuffer)) {
    throw new Error('audioData must be an ArrayBuffer');
  }

  if (chunkSize <= 0) {
    throw new Error('chunkSize must be positive');
  }

  const chunks = [];
  const totalBytes = audioData.byteLength;
  const uint8Array = new Uint8Array(audioData);

  for (let offset = 0; offset < totalBytes; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, totalBytes);
    const chunk = uint8Array.slice(offset, end);
    chunks.push(chunk);
  }

  return chunks;
}

/**
 * Convert audio chunk to base64 for WebSocket transmission
 *
 * @param {Uint8Array} chunk - Audio chunk
 * @returns {string} Base64-encoded chunk
 */
export function chunkToBase64(chunk) {
  if (!(chunk instanceof Uint8Array)) {
    throw new Error('chunk must be a Uint8Array');
  }

  // Convert Uint8Array to binary string
  let binary = '';
  for (let i = 0; i < chunk.length; i++) {
    binary += String.fromCharCode(chunk[i]);
  }

  // Encode to base64
  return btoa(binary);
}

/**
 * Convert base64 string back to Uint8Array
 *
 * @param {string} base64 - Base64-encoded chunk
 * @returns {Uint8Array} Audio chunk
 */
export function base64ToChunk(base64) {
  if (typeof base64 !== 'string') {
    throw new Error('base64 must be a string');
  }

  // Decode base64 to binary string
  const binary = atob(base64);

  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/**
 * Calculate total chunks for audio data
 *
 * @param {number} totalBytes - Total audio size in bytes
 * @param {number} chunkSize - Chunk size in bytes
 * @returns {number} Number of chunks
 */
export function calculateTotalChunks(totalBytes, chunkSize = DEFAULT_CHUNK_SIZE) {
  return Math.ceil(totalBytes / chunkSize);
}

/**
 * Create audio chunk message for WebSocket
 *
 * @param {Uint8Array} chunk - Audio chunk
 * @param {number} sequence - Chunk sequence number (0-based)
 * @param {number} totalChunks - Total number of chunks
 * @returns {Object} WebSocket message object
 */
export function createChunkMessage(chunk, sequence, totalChunks) {
  return {
    type: 'audio_chunk',
    chunk: chunkToBase64(chunk),
    sequence: sequence,
    total_chunks: totalChunks,
    chunk_size: chunk.length,
  };
}

/**
 * Reassemble chunks into complete audio
 *
 * @param {Array<Uint8Array>} chunks - Array of audio chunks
 * @returns {ArrayBuffer} Complete audio data
 */
export function reassembleChunks(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('chunks must be a non-empty array');
  }

  // Calculate total size
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

  // Create buffer and copy chunks
  const reassembled = new Uint8Array(totalSize);
  let offset = 0;

  for (const chunk of chunks) {
    reassembled.set(chunk, offset);
    offset += chunk.length;
  }

  return reassembled.buffer;
}

/**
 * Estimate transmission time for audio chunk
 *
 * @param {number} chunkSize - Size of chunk in bytes
 * @param {number} bandwidthBps - Bandwidth in bytes per second (default: 128kbps)
 * @returns {number} Estimated transmission time in milliseconds
 */
export function estimateTransmissionTime(chunkSize, bandwidthBps = 16000) {
  // bandwidthBps default: 128kbps / 8 = 16KB/s
  const seconds = chunkSize / bandwidthBps;
  return Math.round(seconds * 1000);
}
