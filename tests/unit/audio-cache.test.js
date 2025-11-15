/**
 * Unit Tests: Audio Cache Manager
 *
 * Tests KV caching, hash generation, cache hit/miss logic, and metrics.
 *
 * Feature 010: Text-to-Speech Responses
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioCache, createAudioCache } from '../../src/lib/audio/audio-cache.js';

describe('AudioCache', () => {
  let mockKV;
  let cache;

  beforeEach(() => {
    // Mock KV namespace
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    cache = new AudioCache(mockKV);
  });

  describe('generateKey', () => {
    it('should generate deterministic hash for same text', async () => {
      const text = 'This is a test answer.';
      const key1 = await cache.generateKey(text);
      const key2 = await cache.generateKey(text);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^tts_audio:[a-f0-9]{64}$/);
    });

    it('should generate different hashes for different text', async () => {
      const key1 = await cache.generateKey('Answer 1');
      const key2 = await cache.generateKey('Answer 2');

      expect(key1).not.toBe(key2);
    });

    it('should throw error for invalid input', async () => {
      await expect(cache.generateKey('')).rejects.toThrow();
      await expect(cache.generateKey(null)).rejects.toThrow();
    });
  });

  describe('get', () => {
    it('should return cached audio on cache hit', async () => {
      const mockAudio = 'base64encodedaudio';
      const mockCached = {
        audio: mockAudio,
        format: 'webm/opus',
        duration_ms: 5000,
        created_at: Date.now(),
      };

      mockKV.get.mockResolvedValue(mockCached);

      const result = await cache.get('Test answer');

      expect(result).not.toBeNull();
      expect(result.audio).toBeInstanceOf(ArrayBuffer);
      expect(result.format).toBe('webm/opus');
      expect(cache.metrics.hits).toBe(1);
    });

    it('should return null on cache miss', async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await cache.get('Test answer');

      expect(result).toBeNull();
      expect(cache.metrics.misses).toBe(1);
    });

    it('should handle KV errors gracefully', async () => {
      mockKV.get.mockRejectedValue(new Error('KV error'));

      const result = await cache.get('Test answer');

      expect(result).toBeNull();
      expect(cache.metrics.errors).toBe(1);
    });
  });

  describe('set', () => {
    it('should cache audio successfully', async () => {
      const audioData = new ArrayBuffer(1024);
      const metadata = {
        format: 'webm/opus',
        duration_ms: 5000,
      };

      mockKV.put.mockResolvedValue();

      const result = await cache.set('Test answer', audioData, metadata);

      expect(result).toBe(true);
      expect(mockKV.put).toHaveBeenCalled();
      expect(mockKV.put.mock.calls[0][2]).toHaveProperty('expirationTtl', 86400);
    });

    it('should reject audio that is too large', async () => {
      const largeAudio = new ArrayBuffer(10 * 1024 * 1024); // 10MB

      const result = await cache.set('Test answer', largeAudio);

      expect(result).toBe(false);
      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it('should handle KV errors gracefully', async () => {
      const audioData = new ArrayBuffer(1024);
      mockKV.put.mockRejectedValue(new Error('KV error'));

      const result = await cache.set('Test answer', audioData);

      expect(result).toBe(false);
      expect(cache.metrics.errors).toBe(1);
    });
  });

  describe('has', () => {
    it('should return true if cached', async () => {
      mockKV.get.mockResolvedValue({
        audio: 'base64audio',
        format: 'webm/opus',
      });

      const result = await cache.has('Test answer');
      expect(result).toBe(true);
    });

    it('should return false if not cached', async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await cache.has('Test answer');
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete cached audio', async () => {
      mockKV.delete.mockResolvedValue();

      const result = await cache.delete('Test answer');

      expect(result).toBe(true);
      expect(mockKV.delete).toHaveBeenCalled();
    });

    it('should handle KV errors gracefully', async () => {
      mockKV.delete.mockRejectedValue(new Error('KV error'));

      const result = await cache.delete('Test answer');

      expect(result).toBe(false);
    });
  });

  describe('getMetrics', () => {
    it('should calculate hit rate correctly', async () => {
      mockKV.get.mockResolvedValue({ audio: 'test' });
      await cache.get('Answer 1'); // Hit
      await cache.get('Answer 2'); // Hit

      mockKV.get.mockResolvedValue(null);
      await cache.get('Answer 3'); // Miss

      const metrics = cache.getMetrics();

      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
      expect(metrics.total_requests).toBe(3);
      expect(parseFloat(metrics.hit_rate_percent)).toBeCloseTo(66.67, 1);
    });

    it('should handle zero requests', () => {
      const metrics = cache.getMetrics();

      expect(metrics.total_requests).toBe(0);
      expect(metrics.hit_rate_percent).toBe('0.00');
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics', async () => {
      mockKV.get.mockResolvedValue({ audio: 'test' });
      await cache.get('Answer 1');

      cache.resetMetrics();
      const metrics = cache.getMetrics();

      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.errors).toBe(0);
    });
  });

  describe('arrayBufferToBase64 / base64ToArrayBuffer', () => {
    it('should convert ArrayBuffer to base64 and back', () => {
      const original = new ArrayBuffer(16);
      const view = new Uint8Array(original);
      for (let i = 0; i < view.length; i++) {
        view[i] = i;
      }

      const base64 = cache.arrayBufferToBase64(original);
      expect(typeof base64).toBe('string');

      const decoded = cache.base64ToArrayBuffer(base64);
      expect(decoded).toBeInstanceOf(ArrayBuffer);
      expect(decoded.byteLength).toBe(original.byteLength);

      const decodedView = new Uint8Array(decoded);
      for (let i = 0; i < view.length; i++) {
        expect(decodedView[i]).toBe(view[i]);
      }
    });
  });

  describe('createAudioCache', () => {
    it('should create AudioCache instance', () => {
      const instance = createAudioCache(mockKV);
      expect(instance).toBeInstanceOf(AudioCache);
    });

    it('should accept custom options', () => {
      const instance = createAudioCache(mockKV, { TTL_SECONDS: 3600 });
      expect(instance.config.TTL_SECONDS).toBe(3600);
    });
  });
});
