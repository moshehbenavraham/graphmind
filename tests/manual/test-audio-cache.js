/**
 * Manual Test Script: Audio Cache
 *
 * Tests audio caching with cache hit/miss scenarios.
 * Run with: node tests/manual/test-audio-cache.js
 *
 * Feature 010: Text-to-Speech Responses
 */

import { createAudioCache } from '../../src/lib/audio/audio-cache.js';

/**
 * Mock KV namespace for testing
 */
class MockKV {
  constructor() {
    this.store = new Map();
  }

  async get(key, type = 'text') {
    const value = this.store.get(key);
    if (!value) return null;

    if (type === 'json') {
      return JSON.parse(value);
    }
    return value;
  }

  async put(key, value, options = {}) {
    this.store.set(key, value);
    console.log(`[MockKV] Stored key: ${key.substring(0, 40)}... (TTL: ${options.expirationTtl}s)`);
  }

  async delete(key) {
    this.store.delete(key);
  }
}

/**
 * Test audio caching scenarios
 */
async function testAudioCache() {
  console.log('=== Audio Cache Test ===\n');

  const mockKV = new MockKV();
  const cache = createAudioCache(mockKV);

  const answerText = 'This is a test answer from the knowledge graph.';
  const mockAudio = new ArrayBuffer(8192);
  const audioView = new Uint8Array(mockAudio);

  // Fill with mock data
  for (let i = 0; i < audioView.length; i++) {
    audioView[i] = i % 256;
  }

  // Test 1: Cache miss
  console.log('Test 1: Cache miss (first request)');
  const cached1 = await cache.get(answerText);
  console.log(`   Result: ${cached1 === null ? 'MISS ✅' : 'HIT ❌'}`);
  console.log(`   Metrics: ${JSON.stringify(cache.getMetrics())}\n`);

  // Test 2: Store in cache
  console.log('Test 2: Store audio in cache');
  const stored = await cache.set(answerText, mockAudio, {
    format: 'webm/opus',
    duration_ms: 5000
  });
  console.log(`   Stored: ${stored ? '✅' : '❌'}`);
  console.log('');

  // Test 3: Cache hit
  console.log('Test 3: Cache hit (second request)');
  const cached2 = await cache.get(answerText);
  console.log(`   Result: ${cached2 !== null ? 'HIT ✅' : 'MISS ❌'}`);
  if (cached2) {
    console.log(`   Audio size: ${cached2.audio.byteLength} bytes`);
    console.log(`   Format: ${cached2.format}`);
    console.log(`   Duration: ${cached2.duration_ms}ms`);
  }
  console.log(`   Metrics: ${JSON.stringify(cache.getMetrics())}\n`);

  // Test 4: Different answer (cache miss)
  console.log('Test 4: Different answer (cache miss)');
  const cached3 = await cache.get('Different answer text');
  console.log(`   Result: ${cached3 === null ? 'MISS ✅' : 'HIT ❌'}`);
  console.log(`   Metrics: ${JSON.stringify(cache.getMetrics())}\n`);

  // Test 5: Cache hit rate calculation
  console.log('Test 5: Cache hit rate');
  // Request same answer multiple times
  await cache.get(answerText); // Hit
  await cache.get(answerText); // Hit
  await cache.get(answerText); // Hit
  await cache.get('Another different answer'); // Miss

  const finalMetrics = cache.getMetrics();
  console.log(`   Total requests: ${finalMetrics.total_requests}`);
  console.log(`   Hits: ${finalMetrics.hits}`);
  console.log(`   Misses: ${finalMetrics.misses}`);
  console.log(`   Hit rate: ${finalMetrics.hit_rate_percent}%`);
  console.log(`   Target: >60% ${parseFloat(finalMetrics.hit_rate_percent) > 60 ? '✅' : '⚠️'}\n`);

  // Test 6: Key generation consistency
  console.log('Test 6: Key generation consistency');
  const key1 = await cache.generateKey(answerText);
  const key2 = await cache.generateKey(answerText);
  console.log(`   Key 1: ${key1.substring(0, 50)}...`);
  console.log(`   Key 2: ${key2.substring(0, 50)}...`);
  console.log(`   Match: ${key1 === key2 ? '✅' : '❌'}\n`);

  console.log('=== All Tests Complete ===');
}

// Run tests
testAudioCache().catch(console.error);
