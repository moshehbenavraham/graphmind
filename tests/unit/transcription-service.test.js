/**
 * Unit Tests: TranscriptionService
 *
 * Tests audio transcription, confidence validation, and error handling.
 *
 * Extracted from QuerySessionManager decomposition.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TranscriptionService,
  TranscriptionServiceError,
  createTranscriptionService,
} from '../../src/services/transcription-service.js';

// Mock the transcription module
vi.mock('../../src/lib/audio/transcription.js', () => ({
  transcribeAudioChunk: vi.fn(),
  TranscriptionError: class TranscriptionError extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
    }
  },
  TranscriptionErrorCode: {
    INVALID_AUDIO: 'INVALID_AUDIO',
    TIMEOUT: 'TIMEOUT',
    AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  },
}));

import { transcribeAudioChunk } from '../../src/lib/audio/transcription.js';

describe('TranscriptionService', () => {
  let mockEnv;
  let mockLogger;
  let service;

  beforeEach(() => {
    mockEnv = {
      AI: {
        run: vi.fn(),
      },
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    service = new TranscriptionService(mockEnv, mockLogger);

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('transcribeAudio', () => {
    it('should transcribe audio successfully', async () => {
      transcribeAudioChunk.mockResolvedValue({
        text: 'Hello, this is a test.',
        confidence: 0.95,
        is_final: true,
      });

      const audioData = new ArrayBuffer(1024);
      const result = await service.transcribeAudio(audioData);

      expect(result.valid).toBe(true);
      expect(result.text).toBe('Hello, this is a test.');
      expect(result.confidence).toBe(0.95);
      expect(result.is_final).toBe(true);
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('should return invalid for empty transcript', async () => {
      transcribeAudioChunk.mockResolvedValue({
        text: '',
        confidence: 1.0,
        is_final: true,
      });

      const audioData = new ArrayBuffer(1024);
      const result = await service.transcribeAudio(audioData);

      expect(result.valid).toBe(false);
      expect(result.error_code).toBe('EMPTY_TRANSCRIPT');
    });

    it('should return invalid for low confidence', async () => {
      transcribeAudioChunk.mockResolvedValue({
        text: 'Some text',
        confidence: 0.5, // Below default threshold of 0.7
        is_final: true,
      });

      const audioData = new ArrayBuffer(1024);
      const result = await service.transcribeAudio(audioData);

      expect(result.valid).toBe(false);
      expect(result.error_code).toBe('LOW_CONFIDENCE_TRANSCRIPT');
    });

    it('should respect custom confidence threshold', async () => {
      const customService = new TranscriptionService(mockEnv, mockLogger, {
        minConfidence: 0.5,
      });

      transcribeAudioChunk.mockResolvedValue({
        text: 'Some text',
        confidence: 0.6, // Above custom threshold
        is_final: true,
      });

      const audioData = new ArrayBuffer(1024);
      const result = await customService.transcribeAudio(audioData);

      expect(result.valid).toBe(true);
    });

    it('should throw TranscriptionServiceError on failure', async () => {
      transcribeAudioChunk.mockRejectedValue(new Error('AI service error'));

      const audioData = new ArrayBuffer(1024);

      await expect(service.transcribeAudio(audioData)).rejects.toThrow(TranscriptionServiceError);
    });

    it('should track metrics on success', async () => {
      transcribeAudioChunk.mockResolvedValue({
        text: 'Hello',
        confidence: 0.9,
        is_final: true,
      });

      const audioData = new ArrayBuffer(1024);
      await service.transcribeAudio(audioData);

      const metrics = service.getMetrics();
      expect(metrics.totalTranscriptions).toBe(1);
      expect(metrics.successfulTranscriptions).toBe(1);
    });

    it('should track empty transcription metrics', async () => {
      transcribeAudioChunk.mockResolvedValue({
        text: '',
        confidence: 1.0,
        is_final: true,
      });

      const audioData = new ArrayBuffer(1024);
      await service.transcribeAudio(audioData);

      const metrics = service.getMetrics();
      expect(metrics.emptyTranscriptions).toBe(1);
    });

    it('should track low confidence metrics', async () => {
      transcribeAudioChunk.mockResolvedValue({
        text: 'Something',
        confidence: 0.3,
        is_final: true,
      });

      const audioData = new ArrayBuffer(1024);
      await service.transcribeAudio(audioData);

      const metrics = service.getMetrics();
      expect(metrics.lowConfidenceTranscriptions).toBe(1);
    });
  });

  describe('validateTranscript', () => {
    it('should validate good transcript', () => {
      const result = service.validateTranscript('Hello world', 0.9);
      expect(result.valid).toBe(true);
    });

    it('should reject empty transcript', () => {
      const result = service.validateTranscript('', 0.9);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Empty');
    });

    it('should reject whitespace-only transcript', () => {
      const result = service.validateTranscript('   ', 0.9);
      expect(result.valid).toBe(false);
    });

    it('should reject low confidence', () => {
      const result = service.validateTranscript('Hello', 0.5);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Confidence');
    });

    it('should reject very short transcript', () => {
      const result = service.validateTranscript('H', 0.9);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('short');
    });
  });

  describe('getMetrics', () => {
    it('should calculate average latency', async () => {
      transcribeAudioChunk.mockResolvedValue({
        text: 'Hello',
        confidence: 0.9,
        is_final: true,
      });

      const audioData = new ArrayBuffer(1024);
      await service.transcribeAudio(audioData);
      await service.transcribeAudio(audioData);

      const metrics = service.getMetrics();
      expect(metrics.averageLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should calculate success rate', async () => {
      transcribeAudioChunk.mockResolvedValue({
        text: 'Hello',
        confidence: 0.9,
        is_final: true,
      });

      const audioData = new ArrayBuffer(1024);
      await service.transcribeAudio(audioData);

      const metrics = service.getMetrics();
      expect(metrics.successRate).toBe(100);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to zero', async () => {
      transcribeAudioChunk.mockResolvedValue({
        text: 'Hello',
        confidence: 0.9,
        is_final: true,
      });

      const audioData = new ArrayBuffer(1024);
      await service.transcribeAudio(audioData);

      service.resetMetrics();

      const metrics = service.getMetrics();
      expect(metrics.totalTranscriptions).toBe(0);
      expect(metrics.successfulTranscriptions).toBe(0);
    });
  });

  describe('TranscriptionServiceError', () => {
    it('should identify recoverable errors', () => {
      const error = new TranscriptionServiceError('Timeout', 'TRANSCRIPTION_TIMEOUT');
      expect(error.isRecoverable()).toBe(true);
    });

    it('should identify non-recoverable errors', () => {
      const error = new TranscriptionServiceError('Unknown', 'UNKNOWN_ERROR');
      expect(error.isRecoverable()).toBe(false);
    });
  });

  describe('createTranscriptionService', () => {
    it('should create TranscriptionService instance', () => {
      const instance = createTranscriptionService(mockEnv, mockLogger);
      expect(instance).toBeInstanceOf(TranscriptionService);
    });

    it('should accept custom options', () => {
      const instance = createTranscriptionService(mockEnv, mockLogger, {
        minConfidence: 0.5,
        language: 'es',
      });

      expect(instance.minConfidence).toBe(0.5);
      expect(instance.language).toBe('es');
    });
  });
});
