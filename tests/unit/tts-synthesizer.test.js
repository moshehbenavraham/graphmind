/**
 * Unit Tests: TTS Synthesizer Service
 *
 * Tests TTS synthesis, error handling, timeouts, and answer sanitization.
 *
 * Feature 010: Text-to-Speech Responses
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TTSSynthesizer, createTTSSynthesizer } from '../../src/services/tts-synthesizer.js';

describe('TTSSynthesizer', () => {
  let mockAI;
  let synthesizer;

  beforeEach(() => {
    // Mock Workers AI binding
    mockAI = {
      run: vi.fn(),
    };

    synthesizer = new TTSSynthesizer(mockAI);
  });

  describe('synthesize', () => {
    it('should synthesize text to audio successfully', async () => {
      const mockAudio = new ArrayBuffer(1024);
      mockAI.run.mockResolvedValue(mockAudio);

      const result = await synthesizer.synthesize('Hello, this is a test answer.');

      expect(result).toHaveProperty('audio');
      expect(result).toHaveProperty('format', 'webm/opus');
      expect(result).toHaveProperty('duration_ms');
      expect(result.audio).toBeInstanceOf(ArrayBuffer);
    });

    it('should sanitize text before synthesis', async () => {
      const mockAudio = new ArrayBuffer(1024);
      mockAI.run.mockResolvedValue(mockAudio);

      const markdownText = '## Header\n\nThis is **bold** text with [link](https://example.com).';
      await synthesizer.synthesize(markdownText);

      expect(mockAI.run).toHaveBeenCalled();
      const callArgs = mockAI.run.mock.calls[0][1];
      expect(callArgs.text).not.toContain('##');
      expect(callArgs.text).not.toContain('**');
      expect(callArgs.text).not.toContain('https://');
    });

    it('should handle empty text', async () => {
      await expect(synthesizer.synthesize('')).rejects.toThrow();
    });

    it('should handle very short text', async () => {
      const mockAudio = new ArrayBuffer(1024);
      mockAI.run.mockResolvedValue(mockAudio);

      const result = await synthesizer.synthesize('Hi');
      expect(result.audio).toBeInstanceOf(ArrayBuffer);
    });

    it('should timeout after configured duration', async () => {
      // Mock slow Workers AI response
      mockAI.run.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10000)));

      const fastSynthesizer = new TTSSynthesizer(mockAI, { TIMEOUT_MS: 100 });

      await expect(fastSynthesizer.synthesize('Test text')).rejects.toThrow('timeout');
    });

    it('should reject invalid input types', async () => {
      await expect(synthesizer.synthesize(null)).rejects.toThrow();
      await expect(synthesizer.synthesize(undefined)).rejects.toThrow();
      await expect(synthesizer.synthesize(123)).rejects.toThrow();
    });
  });

  describe('callWorkersAI', () => {
    it('should call Workers AI with correct parameters', async () => {
      const mockAudio = new ArrayBuffer(1024);
      mockAI.run.mockResolvedValue(mockAudio);

      await synthesizer.callWorkersAI('Test text');

      expect(mockAI.run).toHaveBeenCalledWith(
        '@cf/deepgram/aura-2',
        expect.objectContaining({
          text: 'Test text',
          voice: 'aura-2',
          sample_rate: 24000,
        })
      );
    });

    it('should handle Response object from Workers AI', async () => {
      const mockAudio = new ArrayBuffer(1024);
      const mockResponse = new Response(mockAudio);
      mockAI.run.mockResolvedValue(mockResponse);

      const result = await synthesizer.callWorkersAI('Test');
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it('should throw error on Workers AI failure', async () => {
      mockAI.run.mockRejectedValue(new Error('Workers AI error'));

      await expect(synthesizer.callWorkersAI('Test')).rejects.toThrow('Workers AI TTS failed');
    });
  });

  describe('estimateDuration', () => {
    it('should estimate duration based on word count', () => {
      const text = 'This is a test sentence with ten words total.';
      const duration = synthesizer.estimateDuration(text);

      // ~10 words / 2.5 words per second = ~4 seconds = ~4000ms
      expect(duration).toBeGreaterThan(3000);
      expect(duration).toBeLessThan(5000);
    });

    it('should handle short text', () => {
      const duration = synthesizer.estimateDuration('Hi');
      expect(duration).toBeGreaterThan(0);
    });

    it('should handle long text', () => {
      const longText = 'word '.repeat(500); // 500 words
      const duration = synthesizer.estimateDuration(longText);

      // ~500 words / 2.5 words per second = ~200 seconds = ~200000ms
      expect(duration).toBeGreaterThan(150000);
    });
  });

  describe('handleError', () => {
    it('should format timeout errors', () => {
      const error = new Error('TTS synthesis timeout after 5000ms');
      const handled = synthesizer.handleError(error);

      expect(handled.code).toBe('TTS_TIMEOUT');
      expect(handled.message).toContain('timeout');
    });

    it('should format Workers AI errors', () => {
      const error = new Error('Workers AI TTS failed: Service unavailable');
      const handled = synthesizer.handleError(error);

      expect(handled.code).toBe('TTS_SERVICE_UNAVAILABLE');
    });

    it('should format invalid audio errors', () => {
      const error = new Error('Invalid audio data: corrupt file');
      const handled = synthesizer.handleError(error);

      expect(handled.code).toBe('TTS_INVALID_AUDIO');
    });

    it('should handle generic errors', () => {
      const error = new Error('Unknown error');
      const handled = synthesizer.handleError(error);

      expect(handled.code).toBe('TTS_FAILED');
      expect(handled.originalError).toBe(error);
    });
  });

  describe('isRecoverableError', () => {
    it('should identify recoverable errors', () => {
      const timeoutError = { code: 'TTS_TIMEOUT' };
      const serviceError = { code: 'TTS_SERVICE_UNAVAILABLE' };

      expect(synthesizer.isRecoverableError(timeoutError)).toBe(true);
      expect(synthesizer.isRecoverableError(serviceError)).toBe(true);
    });

    it('should identify non-recoverable errors', () => {
      const invalidError = { code: 'TTS_INVALID_AUDIO' };
      const genericError = { code: 'TTS_FAILED' };

      expect(synthesizer.isRecoverableError(invalidError)).toBe(false);
      expect(synthesizer.isRecoverableError(genericError)).toBe(false);
    });
  });

  describe('createTTSSynthesizer', () => {
    it('should create TTSSynthesizer instance', () => {
      const instance = createTTSSynthesizer(mockAI);
      expect(instance).toBeInstanceOf(TTSSynthesizer);
    });

    it('should accept custom options', () => {
      const instance = createTTSSynthesizer(mockAI, { TIMEOUT_MS: 10000 });
      expect(instance.config.TIMEOUT_MS).toBe(10000);
    });
  });
});
