// @ts-check

/**
 * TTSStreamHandler Service
 *
 * Handles text-to-speech synthesis and audio streaming via WebSocket.
 * Supports playback control (pause/resume/stop) and audio caching.
 *
 * Extracted from QuerySessionManager as part of decomposition (Phase 4).
 *
 * @module services/tts-stream-handler
 */

import { createTTSSynthesizer } from './tts-synthesizer.js';
import { createAudioCache } from '../lib/audio/audio-cache.js';
import { chunkAudio, createChunkMessage } from '../lib/audio/audio-chunker.js';

/**
 * @typedef {Object} SynthesizeResult
 * @property {boolean} success - Whether synthesis succeeded
 * @property {boolean} [cached] - Whether audio was from cache
 * @property {number} [latencyMs] - Total latency in ms
 * @property {number} [totalChunks] - Number of audio chunks
 * @property {{ code: string, message: string }} [error] - Error details if failed
 */

/**
 * @typedef {Object} PlaybackControlResult
 * @property {boolean} success - Whether control command succeeded
 * @property {string} status - Current playback status
 * @property {number} responseTimeMs - Response time in ms
 * @property {{ code: string, message: string }} [error] - Error details if failed
 * @property {string} [action] - Action that was taken (for resume)
 */

/**
 * Playback state enum
 * @enum {string}
 */
export const PlaybackState = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  STOPPED: 'stopped'
};

/**
 * TTSStreamHandler Class
 *
 * Manages TTS synthesis, audio streaming, and playback controls.
 */
export class TTSStreamHandler {
  /**
   * Create TTSStreamHandler instance
   *
   * @param {Object} env - Cloudflare Worker environment bindings
   * @param {Object} logger - Logger instance
   * @param {Object} options - Configuration options
   * @param {number} [options.chunkSize=4096] - Audio chunk size in bytes
   * @param {number} [options.chunkDelayMs=10] - Delay between chunk sends
   */
  constructor(env, logger, options = {}) {
    this.env = env;
    this.logger = logger;
    this.chunkSize = options.chunkSize || 4096;
    this.chunkDelayMs = options.chunkDelayMs || 10;

    // Create TTS synthesizer and audio cache
    this.ttsSynthesizer = createTTSSynthesizer(this.env.AI);
    this.audioCache = createAudioCache(this.env.KV);

    // Playback state
    /** @type {{ status: string, currentChunk: number, totalChunks: number, audioBuffer: Uint8Array[]|null, isPaused: boolean }} */
    this.playbackState = {
      status: PlaybackState.IDLE,
      currentChunk: 0,
      totalChunks: 0,
      audioBuffer: null,
      isPaused: false
    };

    // Metrics
    this.metrics = {
      totalSyntheses: 0,
      cacheHits: 0,
      cacheMisses: 0,
      failures: 0,
      totalLatencyMs: 0
    };
  }

  /**
   * Synthesize text to speech and stream audio chunks
   *
   * @param {string} text - Text to synthesize
   * @param {Function} sendChunk - Function to send chunk to client (WebSocket)
   * @returns {Promise<SynthesizeResult>}
   */
  async synthesizeAndStream(text, sendChunk) {
    const startTime = Date.now();
    this.metrics.totalSyntheses++;

    this.logger.info('Starting TTS synthesis', {
      text_length: text.length
    });

    try {
      let audioData;
      let audioMetadata;
      let fromCache = false;

      // 1. Check cache first
      const cachedAudio = await this.audioCache.get(text);

      if (cachedAudio) {
        // Cache HIT
        this.logger.info('Audio cache HIT');
        this.metrics.cacheHits++;
        audioData = cachedAudio.audio;
        audioMetadata = {
          format: cachedAudio.format,
          duration_ms: cachedAudio.duration_ms
        };
        fromCache = true;
      } else {
        // Cache MISS - synthesize audio
        this.logger.info('Audio cache MISS - synthesizing audio');
        this.metrics.cacheMisses++;

        const synthesisResult = await this.ttsSynthesizer.synthesize(text);
        audioData = synthesisResult.audio;
        audioMetadata = {
          format: synthesisResult.format,
          duration_ms: synthesisResult.duration_ms
        };

        // Cache audio asynchronously (non-blocking)
        this.audioCache.set(text, audioData, audioMetadata).catch(err => {
          this.logger.error('Failed to cache audio', err);
        });
      }

      const ttsLatency = Date.now() - startTime;
      this.metrics.totalLatencyMs += ttsLatency;

      this.logger.info('TTS synthesis complete', {
        latency_ms: ttsLatency,
        audio_size_bytes: audioData.byteLength,
        cached: fromCache
      });

      // 2. Chunk audio for streaming
      const chunks = chunkAudio(audioData, this.chunkSize);
      this.logger.info(`Audio chunked into ${chunks.length} chunks`);

      // Set playback state
      this.playbackState.status = PlaybackState.PLAYING;
      this.playbackState.totalChunks = chunks.length;
      this.playbackState.currentChunk = 0;
      this.playbackState.audioBuffer = chunks;

      // 3. Stream chunks to client
      for (let i = 0; i < chunks.length; i++) {
        // Check if playback was stopped
        if (this.playbackState.status === PlaybackState.STOPPED) {
          this.logger.info('Playback stopped by user, halting stream');
          break;
        }

        // Wait if paused
        while (this.playbackState.isPaused) {
          await new Promise(resolve => setTimeout(resolve, 100));

          // Check if stopped while paused
          if (this.playbackState.status === PlaybackState.STOPPED) {
            break;
          }
        }

        // Exit if stopped while paused
        if (this.playbackState.status === PlaybackState.STOPPED) {
          break;
        }

        const chunkMessage = createChunkMessage(chunks[i], i, chunks.length);
        this.playbackState.currentChunk = i;

        sendChunk(chunkMessage);

        // Small delay between chunks to prevent overwhelming the WebSocket
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, this.chunkDelayMs));
        }
      }

      // 4. Send completion message
      sendChunk({
        type: 'audio_complete',
        duration_ms: audioMetadata.duration_ms,
        total_bytes: audioData.byteLength,
        total_chunks: chunks.length,
        cached: fromCache,
        latency_ms: ttsLatency
      });

      this.logger.info('Audio streaming complete', {
        total_chunks: chunks.length,
        total_bytes: audioData.byteLength
      });

      // Reset playback state
      this.playbackState.status = PlaybackState.IDLE;

      return {
        success: true,
        cached: fromCache,
        latencyMs: ttsLatency,
        totalChunks: chunks.length
      };

    } catch (error) {
      this.metrics.failures++;
      this.logger.error('TTS synthesis and streaming failed', error);

      // Reset playback state
      this.playbackState.status = PlaybackState.IDLE;

      return {
        success: false,
        error: {
          code: error.code || 'TTS_FAILED',
          message: error.message || 'TTS synthesis failed'
        }
      };
    }
  }

  /**
   * Handle playback control command
   *
   * @param {Object} message - Playback control message
   * @param {string} message.action - Control action (pause/resume/stop)
   * @returns {PlaybackControlResult}
   */
  handlePlaybackControl(message) {
    const { action } = message;
    const startTime = Date.now();

    this.logger.info(`Playback control: ${action}`, {
      current_state: this.playbackState.status
    });

    let newStatus = this.playbackState.status;

    switch (action) {
      case 'pause':
        if (this.playbackState.status === PlaybackState.PLAYING) {
          this.playbackState.status = PlaybackState.PAUSED;
          this.playbackState.isPaused = true;
          newStatus = PlaybackState.PAUSED;
          this.logger.info('Playback paused');
        }
        break;

      case 'resume':
        if (this.playbackState.status === PlaybackState.PAUSED) {
          this.playbackState.status = PlaybackState.PLAYING;
          this.playbackState.isPaused = false;
          newStatus = PlaybackState.PLAYING;
          this.logger.info('Playback resumed');
        }
        break;

      case 'stop':
        this.playbackState.status = PlaybackState.STOPPED;
        this.playbackState.currentChunk = 0;
        this.playbackState.isPaused = false;
        newStatus = PlaybackState.STOPPED;
        this.logger.info('Playback stopped');
        break;

      default:
        this.logger.warn(`Unknown playback action: ${action}`);
        return {
          success: false,
          status: this.playbackState.status,
          error: {
            code: 'INVALID_PLAYBACK_ACTION',
            message: `Unknown action: ${action}`
          },
          responseTimeMs: Date.now() - startTime
        };
    }

    return {
      success: true,
      action,
      status: newStatus,
      responseTimeMs: Date.now() - startTime
    };
  }

  /**
   * Get current playback state
   *
   * @returns {{ status: string, currentChunk: number, totalChunks: number, progress: number }}
   */
  getPlaybackState() {
    const progress = this.playbackState.totalChunks > 0
      ? (this.playbackState.currentChunk / this.playbackState.totalChunks) * 100
      : 0;

    return {
      status: this.playbackState.status,
      currentChunk: this.playbackState.currentChunk,
      totalChunks: this.playbackState.totalChunks,
      progress: Math.round(progress)
    };
  }

  /**
   * Check if currently playing
   *
   * @returns {boolean}
   */
  isPlaying() {
    return this.playbackState.status === PlaybackState.PLAYING;
  }

  /**
   * Check if paused
   *
   * @returns {boolean}
   */
  isPaused() {
    return this.playbackState.status === PlaybackState.PAUSED;
  }

  /**
   * Reset handler to initial state
   */
  reset() {
    this.playbackState = {
      status: PlaybackState.IDLE,
      currentChunk: 0,
      totalChunks: 0,
      audioBuffer: null,
      isPaused: false
    };

    this.logger.info('TTSStreamHandler reset');
  }

  /**
   * Get handler metrics
   *
   * @returns {Object} Metrics
   */
  getMetrics() {
    const avgLatency = this.metrics.totalSyntheses > 0
      ? this.metrics.totalLatencyMs / this.metrics.totalSyntheses
      : 0;

    return {
      ...this.metrics,
      averageLatencyMs: Math.round(avgLatency),
      cacheHitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
        ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100
        : 0
    };
  }
}

/**
 * Create TTSStreamHandler instance
 *
 * @param {Object} env - Cloudflare Worker environment bindings
 * @param {Object} logger - Logger instance
 * @param {Object} options - Configuration options
 * @returns {TTSStreamHandler}
 */
export function createTTSStreamHandler(env, logger, options = {}) {
  return new TTSStreamHandler(env, logger, options);
}
