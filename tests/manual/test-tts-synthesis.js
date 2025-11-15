/**
 * Manual Test Script: TTS Synthesis
 *
 * Tests TTS synthesis with sample answer text using Workers AI.
 * Run with: node tests/manual/test-tts-synthesis.js
 *
 * Feature 010: Text-to-Speech Responses
 */

import { createTTSSynthesizer } from '../../src/services/tts-synthesizer.js';
import { validateAudioData } from '../../src/lib/validation/audio-validator.js';

/**
 * Mock Workers AI for testing (replace with real AI binding in wrangler dev)
 */
class MockWorkersAI {
  async run(model, options) {
    console.log(`[Mock AI] Called ${model} with text: "${options.text.substring(0, 50)}..."`);

    // Simulate TTS latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Return mock audio (WebM header + random data)
    const mockAudio = new ArrayBuffer(8192);
    const view = new Uint8Array(mockAudio);

    // WebM signature
    view[0] = 0x1A;
    view[1] = 0x45;
    view[2] = 0xDF;
    view[3] = 0xA3;

    // Fill rest with random data
    for (let i = 4; i < view.length; i++) {
      view[i] = Math.floor(Math.random() * 256);
    }

    return mockAudio;
  }
}

/**
 * Test TTS synthesis with various inputs
 */
async function testTTSSynthesis() {
  console.log('=== TTS Synthesis Test ===\n');

  const mockAI = new MockWorkersAI();
  const synthesizer = createTTSSynthesizer(mockAI);

  // Test 1: Normal answer
  console.log('Test 1: Normal answer text');
  try {
    const result1 = await synthesizer.synthesize(
      'Based on your knowledge graph, John Doe is working on the GraphMind project with a status of Active.'
    );

    console.log('✅ Synthesis successful');
    console.log(`   Audio size: ${result1.audio.byteLength} bytes`);
    console.log(`   Format: ${result1.format}`);
    console.log(`   Duration: ${result1.duration_ms}ms`);

    // Validate audio
    const validation = validateAudioData(result1.audio);
    console.log(`   Valid: ${validation.valid}`);
    console.log('');
  } catch (error) {
    console.log('❌ Test 1 failed:', error.message);
  }

  // Test 2: Markdown answer
  console.log('Test 2: Answer with markdown formatting');
  try {
    const result2 = await synthesizer.synthesize(
      '## Query Results\n\n**Entity**: John Doe\n**Project**: GraphMind\n\nYou can read more at [https://example.com](https://example.com).'
    );

    console.log('✅ Markdown sanitization successful');
    console.log(`   Sanitized text: "${result2.sanitized_text}"`);
    console.log(`   Audio size: ${result2.audio.byteLength} bytes`);
    console.log('');
  } catch (error) {
    console.log('❌ Test 2 failed:', error.message);
  }

  // Test 3: Very long answer
  console.log('Test 3: Very long answer (>500 words)');
  try {
    const longText = 'This is a test sentence. '.repeat(250); // ~500 words
    const result3 = await synthesizer.synthesize(longText);

    console.log('✅ Long answer handled');
    console.log(`   Original words: ${longText.split(/\s+/).length}`);
    console.log(`   Sanitized words: ${result3.sanitized_text.split(/\s+/).length}`);
    console.log('');
  } catch (error) {
    console.log('❌ Test 3 failed:', error.message);
  }

  // Test 4: Empty answer (should fail)
  console.log('Test 4: Empty answer (expected to fail)');
  try {
    await synthesizer.synthesize('');
    console.log('❌ Should have thrown error');
  } catch (error) {
    console.log('✅ Correctly rejected empty text');
    console.log(`   Error: ${error.message}`);
    console.log('');
  }

  // Test 5: Very short answer
  console.log('Test 5: Very short answer');
  try {
    const result5 = await synthesizer.synthesize('Yes.');

    console.log('✅ Short answer handled');
    console.log(`   Audio size: ${result5.audio.byteLength} bytes`);
    console.log('');
  } catch (error) {
    console.log('❌ Test 5 failed:', error.message);
  }

  console.log('=== All Tests Complete ===');
}

// Run tests
testTTSSynthesis().catch(console.error);
