/**
 * Unit Tests: TTSStreamHandler Service
 *
 * Tests TTS synthesis, audio streaming, and playback control.
 *
 * Extracted from QuerySessionManager decomposition.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TTSStreamHandler,
  PlaybackState,
  createTTSStreamHandler,
} from '../../src/services/tts-stream-handler.js';

// Mock dependencies
vi.mock('../../src/services/tts-synthesizer.js', () => ({
  createTTSSynthesizer: vi.fn(() => ({
    synthesize: vi.fn(),
  })),
}));

vi.mock('../../src/lib/audio/audio-cache.js', () => ({
  createAudioCache: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock('../../src/lib/audio/audio-chunker.js', () => ({
  chunkAudio: vi.fn((data, size) => {
    const chunks = [];
    const view = new Uint8Array(data);
    for (let i = 0; i < view.length; i += size) {
      chunks.push(view.slice(i, Math.min(i + size, view.length)));
    }
    return chunks;
  }),
  createChunkMessage: vi.fn((chunk, sequence, total) => ({
    type: 'audio_chunk',
    chunk: 'base64data',
    sequence,
    total_chunks: total,
  })),
}));

import { createTTSSynthesizer } from '../../src/services/tts-synthesizer.js';
import { createAudioCache } from '../../src/lib/audio/audio-cache.js';

describe('TTSStreamHandler', () => {
  let mockEnv;
  let mockLogger;
  let handler;
  let mockSynthesizer;
  let mockCache;

  beforeEach(() => {
    mockEnv = {
      AI: { run: vi.fn() },
      KV: {},
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Reset mocks
    vi.clearAllMocks();

    // Setup mock synthesizer
    mockSynthesizer = {
      synthesize: vi.fn().mockResolvedValue({
        audio: new ArrayBuffer(1024),
        format: 'webm/opus',
        duration_ms: 5000,
      }),
    };
    createTTSSynthesizer.mockReturnValue(mockSynthesizer);

    // Setup mock cache
    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
    };
    createAudioCache.mockReturnValue(mockCache);

    handler = new TTSStreamHandler(mockEnv, mockLogger);
  });

  describe('synthesizeAndStream', () => {
    it('should synthesize and stream audio successfully', async () => {
      const chunks = [];
      const sendChunk = vi.fn((chunk) => chunks.push(chunk));

      const result = await handler.synthesizeAndStream('Hello, world!', sendChunk);

      expect(result.success).toBe(true);
      expect(result.cached).toBe(false);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(sendChunk).toHaveBeenCalled();

      // Should have sent audio_complete message
      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.type).toBe('audio_complete');
    });

    it('should use cached audio when available', async () => {
      mockCache.get.mockResolvedValue({
        audio: new ArrayBuffer(512),
        format: 'webm/opus',
        duration_ms: 3000,
      });

      const sendChunk = vi.fn();
      const result = await handler.synthesizeAndStream('Cached text', sendChunk);

      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
      expect(mockSynthesizer.synthesize).not.toHaveBeenCalled();
    });

    it('should cache synthesized audio', async () => {
      const sendChunk = vi.fn();
      await handler.synthesizeAndStream('New text', sendChunk);

      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should track metrics', async () => {
      const sendChunk = vi.fn();
      await handler.synthesizeAndStream('Test', sendChunk);

      const metrics = handler.getMetrics();
      expect(metrics.totalSyntheses).toBe(1);
      expect(metrics.cacheMisses).toBe(1);
    });

    it('should handle synthesis failure', async () => {
      mockSynthesizer.synthesize.mockRejectedValue(new Error('Synthesis failed'));

      const sendChunk = vi.fn();
      const result = await handler.synthesizeAndStream('Test', sendChunk);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('TTS_FAILED');
    });
  });

  describe('handlePlaybackControl', () => {
    it('should handle pause action', () => {
      handler.playbackState.status = PlaybackState.PLAYING;

      const result = handler.handlePlaybackControl({ action: 'pause' });

      expect(result.success).toBe(true);
      expect(result.status).toBe(PlaybackState.PAUSED);
      expect(handler.playbackState.isPaused).toBe(true);
    });

    it('should handle resume action', () => {
      handler.playbackState.status = PlaybackState.PAUSED;
      handler.playbackState.isPaused = true;

      const result = handler.handlePlaybackControl({ action: 'resume' });

      expect(result.success).toBe(true);
      expect(result.status).toBe(PlaybackState.PLAYING);
      expect(handler.playbackState.isPaused).toBe(false);
    });

    it('should handle stop action', () => {
      handler.playbackState.status = PlaybackState.PLAYING;

      const result = handler.handlePlaybackControl({ action: 'stop' });

      expect(result.success).toBe(true);
      expect(result.status).toBe(PlaybackState.STOPPED);
    });

    it('should reject unknown actions', () => {
      const result = handler.handlePlaybackControl({ action: 'unknown' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_PLAYBACK_ACTION');
    });

    it('should include response time', () => {
      const result = handler.handlePlaybackControl({ action: 'pause' });

      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPlaybackState', () => {
    it('should return current playback state', () => {
      handler.playbackState.status = PlaybackState.PLAYING;
      handler.playbackState.currentChunk = 5;
      handler.playbackState.totalChunks = 10;

      const state = handler.getPlaybackState();

      expect(state.status).toBe(PlaybackState.PLAYING);
      expect(state.currentChunk).toBe(5);
      expect(state.totalChunks).toBe(10);
      expect(state.progress).toBe(50);
    });

    it('should calculate progress percentage', () => {
      handler.playbackState.currentChunk = 3;
      handler.playbackState.totalChunks = 4;

      const state = handler.getPlaybackState();
      expect(state.progress).toBe(75);
    });
  });

  describe('isPlaying', () => {
    it('should return true when playing', () => {
      handler.playbackState.status = PlaybackState.PLAYING;
      expect(handler.isPlaying()).toBe(true);
    });

    it('should return false when not playing', () => {
      handler.playbackState.status = PlaybackState.PAUSED;
      expect(handler.isPlaying()).toBe(false);
    });
  });

  describe('isPaused', () => {
    it('should return true when paused', () => {
      handler.playbackState.status = PlaybackState.PAUSED;
      expect(handler.isPaused()).toBe(true);
    });

    it('should return false when not paused', () => {
      handler.playbackState.status = PlaybackState.PLAYING;
      expect(handler.isPaused()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      handler.playbackState.status = PlaybackState.PLAYING;
      handler.playbackState.currentChunk = 5;

      handler.reset();

      expect(handler.playbackState.status).toBe(PlaybackState.IDLE);
      expect(handler.playbackState.currentChunk).toBe(0);
      expect(handler.playbackState.totalChunks).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should calculate cache hit rate', async () => {
      // First request - cache miss
      const sendChunk = vi.fn();
      await handler.synthesizeAndStream('Test 1', sendChunk);

      // Second request - cache hit
      mockCache.get.mockResolvedValue({
        audio: new ArrayBuffer(512),
        format: 'webm/opus',
        duration_ms: 3000,
      });
      await handler.synthesizeAndStream('Test 2', sendChunk);

      const metrics = handler.getMetrics();
      expect(metrics.cacheHitRate).toBe(50);
    });

    it('should calculate average latency', async () => {
      const sendChunk = vi.fn();
      await handler.synthesizeAndStream('Test', sendChunk);

      const metrics = handler.getMetrics();
      expect(metrics.averageLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createTTSStreamHandler', () => {
    it('should create TTSStreamHandler instance', () => {
      const instance = createTTSStreamHandler(mockEnv, mockLogger);
      expect(instance).toBeInstanceOf(TTSStreamHandler);
    });

    it('should accept custom options', () => {
      const instance = createTTSStreamHandler(mockEnv, mockLogger, {
        chunkSize: 8192,
        chunkDelayMs: 20,
      });

      expect(instance.chunkSize).toBe(8192);
      expect(instance.chunkDelayMs).toBe(20);
    });
  });
});
