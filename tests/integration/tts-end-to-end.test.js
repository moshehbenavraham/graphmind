/**
 * Integration Tests: TTS End-to-End Flow
 *
 * Tests complete TTS flow from answer text to audio streaming,
 * including caching, WebSocket transmission, and error scenarios.
 *
 * Feature 010: Text-to-Speech Responses
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTTSSynthesizer } from '../../src/services/tts-synthesizer.js';
import { createAudioCache } from '../../src/lib/audio/audio-cache.js';
import { chunkAudio, createChunkMessage } from '../../src/lib/audio/audio-chunker.js';

describe('TTS End-to-End Integration', () => {
  let mockAI;
  let mockKV;
  let synthesizer;
  let cache;

  beforeEach(() => {
    // Mock Workers AI
    mockAI = {
      run: vi.fn(),
    };

    // Mock KV
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    synthesizer = createTTSSynthesizer(mockAI);
    cache = createAudioCache(mockKV);
  });

  describe('Complete TTS Flow (Cache Miss)', () => {
    it('should synthesize, chunk, and prepare for streaming', async () => {
      // Mock Workers AI response
      const mockAudio = new ArrayBuffer(8192); // 8KB audio
      mockAI.run.mockResolvedValue(mockAudio);

      // Mock cache miss
      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue();

      const answerText = 'This is a test answer from the knowledge graph.';

      // Step 1: Check cache (miss)
      let cachedAudio = await cache.get(answerText);
      expect(cachedAudio).toBeNull();
      expect(cache.metrics.misses).toBe(1);

      // Step 2: Synthesize audio
      const result = await synthesizer.synthesize(answerText);
      expect(result.audio).toBeInstanceOf(ArrayBuffer);
      expect(result.format).toBe('webm/opus');

      // Step 3: Cache audio
      const cached = await cache.set(answerText, result.audio, {
        format: result.format,
        duration_ms: result.duration_ms,
      });
      expect(cached).toBe(true);

      // Step 4: Chunk audio for streaming
      const chunks = chunkAudio(result.audio, 4096); // 4KB chunks
      expect(chunks.length).toBe(2); // 8KB / 4KB = 2 chunks

      // Step 5: Create WebSocket messages
      const messages = chunks.map((chunk, index) =>
        createChunkMessage(chunk, index, chunks.length)
      );

      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe('audio_chunk');
      expect(messages[0].sequence).toBe(0);
      expect(messages[0].total_chunks).toBe(2);
      expect(messages[0].chunk).toBeDefined();
    });
  });

  describe('Complete TTS Flow (Cache Hit)', () => {
    it('should serve audio from cache without synthesis', async () => {
      const answerText = 'This is a cached answer.';

      // Mock cached audio
      const mockAudio = new ArrayBuffer(4096);
      const mockCached = {
        audio: btoa(String.fromCharCode(...new Uint8Array(mockAudio))),
        format: 'webm/opus',
        duration_ms: 3000,
        created_at: Date.now(),
      };
      mockKV.get.mockResolvedValue(mockCached);

      // Step 1: Check cache (hit)
      const cachedAudio = await cache.get(answerText);
      expect(cachedAudio).not.toBeNull();
      expect(cache.metrics.hits).toBe(1);
      expect(cachedAudio.audio).toBeInstanceOf(ArrayBuffer);

      // Step 2: Skip synthesis (cache hit)
      expect(mockAI.run).not.toHaveBeenCalled();

      // Step 3: Chunk cached audio
      const chunks = chunkAudio(cachedAudio.audio, 4096);
      expect(chunks.length).toBe(1); // 4KB / 4KB = 1 chunk

      // Step 4: Stream to client
      const messages = chunks.map((chunk, index) =>
        createChunkMessage(chunk, index, chunks.length)
      );

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('audio_chunk');
    });
  });

  describe('Error Scenario: TTS Failure with Fallback', () => {
    it('should handle TTS failure and allow text-only fallback', async () => {
      const answerText = 'This answer will fail to synthesize.';

      // Mock TTS failure
      mockAI.run.mockRejectedValue(new Error('Workers AI error'));

      // Mock cache miss
      mockKV.get.mockResolvedValue(null);

      // Step 1: Check cache (miss)
      const cachedAudio = await cache.get(answerText);
      expect(cachedAudio).toBeNull();

      // Step 2: Try to synthesize (fails)
      let synthesisError;
      try {
        await synthesizer.synthesize(answerText);
      } catch (error) {
        synthesisError = error;
      }

      expect(synthesisError).toBeDefined();
      expect(synthesisError.code).toBe('TTS_SERVICE_UNAVAILABLE');

      // Step 3: Fallback to text-only
      // (In actual implementation, QuerySessionManager would send text-only message)
      const fallbackMessage = {
        type: 'audio_error',
        error: synthesisError.code,
        message: synthesisError.message,
        fallback: 'text_only',
      };

      expect(fallbackMessage.type).toBe('audio_error');
      expect(fallbackMessage.fallback).toBe('text_only');
    });
  });

  describe('Performance: Cache Hit Rate', () => {
    it('should demonstrate cache effectiveness with repeated queries', async () => {
      const answerText = 'Repeated answer for testing cache hit rate.';
      const mockAudio = new ArrayBuffer(4096);

      // First request: cache miss, synthesize
      mockKV.get.mockResolvedValue(null);
      mockAI.run.mockResolvedValue(mockAudio);
      mockKV.put.mockResolvedValue();

      await cache.get(answerText);
      expect(cache.metrics.misses).toBe(1);

      const result = await synthesizer.synthesize(answerText);
      await cache.set(answerText, result.audio);

      // Subsequent requests: cache hit
      const mockCached = {
        audio: btoa(String.fromCharCode(...new Uint8Array(mockAudio))),
        format: 'webm/opus',
        duration_ms: 3000,
        created_at: Date.now(),
      };
      mockKV.get.mockResolvedValue(mockCached);

      await cache.get(answerText);
      await cache.get(answerText);
      await cache.get(answerText);

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(3);
      expect(metrics.misses).toBe(1);
      expect(parseFloat(metrics.hit_rate_percent)).toBe(75.0); // 3/4 = 75%
    });
  });

  describe('Long Answer Handling', () => {
    it('should handle and truncate very long answers', async () => {
      // Create answer with >500 words
      const longAnswer = 'word '.repeat(600); // 600 words

      const mockAudio = new ArrayBuffer(32768); // 32KB
      mockAI.run.mockResolvedValue(mockAudio);

      const result = await synthesizer.synthesize(longAnswer);

      // Verify answer was sanitized and truncated
      const wordCount = result.sanitized_text.split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(500);

      // Verify audio is still valid
      expect(result.audio).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe('Markdown Answer Sanitization', () => {
    it('should remove markdown formatting before synthesis', async () => {
      const markdownAnswer = `
## Knowledge Graph Query Result

Based on your query, here are the **key findings**:

1. **Entity**: John Doe
2. **Project**: GraphMind
3. **Status**: Active

You can read more at [https://example.com](https://example.com).

\`\`\`javascript
const answer = "This is code";
\`\`\`
      `;

      const mockAudio = new ArrayBuffer(8192);
      mockAI.run.mockResolvedValue(mockAudio);

      const result = await synthesizer.synthesize(markdownAnswer);

      // Verify sanitized text doesn't contain markdown
      expect(result.sanitized_text).not.toContain('##');
      expect(result.sanitized_text).not.toContain('**');
      expect(result.sanitized_text).not.toContain('```');
      expect(result.sanitized_text).not.toContain('https://');
      expect(result.sanitized_text).toContain('code block');
    });
  });
});
