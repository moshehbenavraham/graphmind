/**
 * Audio Cache Manager
 *
 * Manages KV-based caching of synthesized audio using content-addressed keys.
 * Uses SHA-256 hash of answer text for deterministic cache keys.
 *
 * Feature 010: Text-to-Speech Responses
 */

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  PREFIX: 'tts_audio:',
  TTL_SECONDS: 86400, // 24 hours
  MAX_SIZE_MB: 5, // Maximum cached audio size (5MB)
};

/**
 * AudioCache Class
 *
 * Manages TTS audio caching in Cloudflare KV.
 */
export class AudioCache {
  /**
   * @param {Object} kv - KV namespace binding
   * @param {Object} options - Configuration options
   */
  constructor(kv, options = {}) {
    this.kv = kv;
    this.config = { ...CACHE_CONFIG, ...options };
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
    };
  }

  /**
   * Generate cache key from answer text
   *
   * Uses SHA-256 hash for content-addressed caching
   *
   * @param {string} answerText - Answer text to hash
   * @returns {Promise<string>} Cache key
   */
  async generateKey(answerText) {
    if (!answerText || typeof answerText !== 'string') {
      throw new Error('answerText must be a non-empty string');
    }

    // Use Web Crypto API to generate SHA-256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(answerText);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert hash to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return `${this.config.PREFIX}${hashHex}`;
  }

  /**
   * Get cached audio
   *
   * @param {string} answerText - Answer text (used to generate key)
   * @returns {Promise<Object|null>} Cached audio data or null if not found
   */
  async get(answerText) {
    try {
      const key = await this.generateKey(answerText);
      console.log(`[AudioCache] Checking cache for key: ${key}`);

      const cached = await this.kv.get(key, 'json');

      if (cached) {
        console.log(`[AudioCache] Cache HIT for key: ${key}`);
        this.metrics.hits++;
        return {
          audio: this.base64ToArrayBuffer(cached.audio),
          format: cached.format,
          duration_ms: cached.duration_ms,
          cached_at: cached.created_at,
        };
      }

      console.log(`[AudioCache] Cache MISS for key: ${key}`);
      this.metrics.misses++;
      return null;
    } catch (error) {
      console.error('[AudioCache] Get failed:', error);
      this.metrics.errors++;
      return null; // Fail gracefully
    }
  }

  /**
   * Store audio in cache
   *
   * @param {string} answerText - Answer text (used to generate key)
   * @param {ArrayBuffer} audioData - Audio data to cache
   * @param {Object} metadata - Audio metadata (format, duration)
   * @returns {Promise<boolean>} True if cached successfully
   */
  async set(answerText, audioData, metadata = {}) {
    try {
      const key = await this.generateKey(answerText);

      // Validate size
      const sizeMB = audioData.byteLength / (1024 * 1024);
      if (sizeMB > this.config.MAX_SIZE_MB) {
        console.warn(`[AudioCache] Audio too large to cache: ${sizeMB.toFixed(2)}MB`);
        return false;
      }

      // Convert ArrayBuffer to base64 for KV storage
      const base64Audio = this.arrayBufferToBase64(audioData);

      const cacheData = {
        audio: base64Audio,
        format: metadata.format || 'webm/opus',
        duration_ms: metadata.duration_ms || 0,
        created_at: Date.now(),
      };

      await this.kv.put(key, JSON.stringify(cacheData), {
        expirationTtl: this.config.TTL_SECONDS,
      });

      console.log(`[AudioCache] Cached audio (${audioData.byteLength} bytes, TTL: ${this.config.TTL_SECONDS}s)`);
      return true;
    } catch (error) {
      console.error('[AudioCache] Set failed:', error);
      this.metrics.errors++;
      return false; // Fail gracefully
    }
  }

  /**
   * Check if audio is cached
   *
   * @param {string} answerText - Answer text
   * @returns {Promise<boolean>} True if cached
   */
  async has(answerText) {
    const cached = await this.get(answerText);
    return cached !== null;
  }

  /**
   * Delete cached audio
   *
   * @param {string} answerText - Answer text
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(answerText) {
    try {
      const key = await this.generateKey(answerText);
      await this.kv.delete(key);
      console.log(`[AudioCache] Deleted cache for key: ${key}`);
      return true;
    } catch (error) {
      console.error('[AudioCache] Delete failed:', error);
      return false;
    }
  }

  /**
   * Get cache metrics
   *
   * @returns {Object} Cache hit/miss/error counts
   */
  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    return {
      ...this.metrics,
      total_requests: total,
      hit_rate_percent: hitRate.toFixed(2),
    };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics() {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
    };
  }

  /**
   * Convert ArrayBuffer to base64 string
   *
   * @param {ArrayBuffer} buffer - Audio data
   * @returns {string} Base64 string
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   *
   * @param {string} base64 - Base64 string
   * @returns {ArrayBuffer} Audio data
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * Create AudioCache instance
 *
 * @param {Object} kv - KV namespace binding
 * @param {Object} options - Configuration options
 * @returns {AudioCache}
 */
export function createAudioCache(kv, options = {}) {
  return new AudioCache(kv, options);
}
