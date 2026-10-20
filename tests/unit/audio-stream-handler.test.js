/**
 * Unit Tests: AudioStreamHandler Service
 *
 * Tests audio chunk buffering, validation, and reassembly.
 *
 * Extracted from QuerySessionManager decomposition.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioStreamHandler, createAudioStreamHandler } from '../../src/services/audio-stream-handler.js';

describe('AudioStreamHandler', () => {
  let mockLogger;
  let handler;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    handler = new AudioStreamHandler(mockLogger);
  });

  describe('handleAudioChunk', () => {
    it('should buffer valid audio chunks', () => {
      // Create valid base64 audio data (at least 100 bytes decoded)
      const validBase64 = btoa('x'.repeat(150));

      const result = handler.handleAudioChunk({
        type: 'audio_chunk',
        chunk: validBase64,
        sequence: 0,
        timestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(handler.getChunkCount()).toBe(1);
    });

    it('should reject invalid audio chunks', () => {
      const result = handler.handleAudioChunk({
        type: 'audio_chunk',
        chunk: 'not-valid-base64!!!',
        sequence: 0,
        timestamp: Date.now(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('AUDIO_VALIDATION_ERROR');
    });

    it('should reject chunks without required fields', () => {
      const result = handler.handleAudioChunk({
        type: 'audio_chunk',
        // Missing chunk, sequence, timestamp
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should track statistics', () => {
      const validBase64 = btoa('x'.repeat(150));

      handler.handleAudioChunk({
        type: 'audio_chunk',
        chunk: validBase64,
        sequence: 0,
        timestamp: Date.now(),
      });

      const stats = handler.getStats();
      expect(stats.totalChunksReceived).toBe(1);
      expect(stats.totalBytesReceived).toBeGreaterThan(0);
      expect(stats.firstChunkTime).toBeTruthy();
    });

    it('should increment validation failure count on errors', () => {
      handler.handleAudioChunk({
        type: 'audio_chunk',
        chunk: 'invalid',
        sequence: 0,
        timestamp: Date.now(),
      });

      const stats = handler.getStats();
      expect(stats.validationFailures).toBe(1);
    });
  });

  describe('getBufferedAudio', () => {
    it('should throw when buffer is empty', () => {
      expect(() => handler.getBufferedAudio()).toThrow('No audio chunks available');
    });

    it('should return reassembled audio from buffered chunks', () => {
      const validBase64 = btoa('x'.repeat(150));

      handler.handleAudioChunk({
        type: 'audio_chunk',
        chunk: validBase64,
        sequence: 0,
        timestamp: Date.now(),
      });

      const audio = handler.getBufferedAudio();
      expect(audio).toBeInstanceOf(ArrayBuffer);
      expect(audio.byteLength).toBe(150);
    });

    it('should sort chunks by sequence before reassembly', () => {
      // Create valid chunks that meet minimum size requirement (100+ bytes)
      const data1 = 'A'.repeat(100);
      const data2 = 'B'.repeat(100);
      const data3 = 'C'.repeat(100);

      const chunk1 = btoa(data1);
      const chunk2 = btoa(data2);
      const chunk3 = btoa(data3);

      // Add chunks out of order
      const result2 = handler.handleAudioChunk({
        type: 'audio_chunk',
        chunk: chunk2,
        sequence: 1,
        timestamp: Date.now(),
      });
      expect(result2.success).toBe(true);

      const result3 = handler.handleAudioChunk({
        type: 'audio_chunk',
        chunk: chunk3,
        sequence: 2,
        timestamp: Date.now(),
      });
      expect(result3.success).toBe(true);

      const result1 = handler.handleAudioChunk({
        type: 'audio_chunk',
        chunk: chunk1,
        sequence: 0,
        timestamp: Date.now(),
      });
      expect(result1.success).toBe(true);

      const audio = handler.getBufferedAudio();
      const view = new Uint8Array(audio);
      const text = String.fromCharCode(...view);

      // Should be in order: AAA... + BBB... + CCC...
      expect(text.startsWith('A'.repeat(100))).toBe(true);
      expect(text.slice(100, 200)).toBe('B'.repeat(100));
      expect(text.slice(200, 300)).toBe('C'.repeat(100));
    });
  });

  describe('clearBuffer', () => {
    it('should clear the audio buffer', () => {
      const validBase64 = btoa('x'.repeat(150));

      handler.handleAudioChunk({
        type: 'audio_chunk',
        chunk: validBase64,
        sequence: 0,
        timestamp: Date.now(),
      });

      expect(handler.getChunkCount()).toBe(1);

      handler.clearBuffer();

      expect(handler.getChunkCount()).toBe(0);
    });

    it('should reset expected sequence', () => {
      handler.clearBuffer();
      expect(handler.expectedSequence).toBe(0);
    });
  });

  describe('hasAudio', () => {
    it('should return false when buffer is empty', () => {
      expect(handler.hasAudio()).toBe(false);
    });

    it('should return true when buffer has chunks', () => {
      const validBase64 = btoa('x'.repeat(150));

      handler.handleAudioChunk({
        type: 'audio_chunk',
        chunk: validBase64,
        sequence: 0,
        timestamp: Date.now(),
      });

      expect(handler.hasAudio()).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset handler to initial state', () => {
      const validBase64 = btoa('x'.repeat(150));

      handler.handleAudioChunk({
        type: 'audio_chunk',
        chunk: validBase64,
        sequence: 0,
        timestamp: Date.now(),
      });

      handler.reset();

      expect(handler.getChunkCount()).toBe(0);
      expect(handler.hasAudio()).toBe(false);
      expect(handler.getStats().totalChunksReceived).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return buffer statistics', () => {
      const stats = handler.getStats();

      expect(stats).toHaveProperty('totalChunksReceived');
      expect(stats).toHaveProperty('totalBytesReceived');
      expect(stats).toHaveProperty('currentBufferSize');
      expect(stats).toHaveProperty('bufferDurationMs');
    });

    it('should calculate buffer duration', async () => {
      const validBase64 = btoa('x'.repeat(150));

      handler.handleAudioChunk({
        type: 'audio_chunk',
        chunk: validBase64,
        sequence: 0,
        timestamp: Date.now(),
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      handler.handleAudioChunk({
        type: 'audio_chunk',
        chunk: validBase64,
        sequence: 1,
        timestamp: Date.now(),
      });

      const stats = handler.getStats();
      expect(stats.bufferDurationMs).toBeGreaterThanOrEqual(40);
    });
  });

  describe('createAudioStreamHandler', () => {
    it('should create AudioStreamHandler instance', () => {
      const instance = createAudioStreamHandler(mockLogger);
      expect(instance).toBeInstanceOf(AudioStreamHandler);
    });
  });
});
