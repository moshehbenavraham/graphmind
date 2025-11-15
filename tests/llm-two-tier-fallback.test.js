/**
 * Tests for Two-Tier LLM Fallback Strategy
 *
 * Feature 008: Voice Query Input & Graph Querying
 * Tests Llama 3.1-8b → DeepSeek R1 Qwen 32B fallback chain
 */

import { generateCypherQuery } from '../src/services/cypher-generator.js';

/**
 * Test scenarios for LLM fallback
 */

// Mock environment with both AI models
const createMockEnv = (tier1Success, tier2Success) => {
  return {
    AI: {
      run: async (modelName, params) => {
        console.log(`\n[TEST] Mock AI.run called: ${modelName}`);

        // Simulate Llama 3.1-8b behavior
        if (modelName === '@cf/meta/llama-3.1-8b-instruct') {
          if (tier1Success) {
            return {
              response: `USE GRAPH test_user_graph;
MATCH (p:Person {name: 'Sarah Johnson'})-[:WORKS_ON]->(proj:Project)
RETURN p, proj, properties(proj) as props
LIMIT 100;`
            };
          } else {
            throw new Error('Tier 1 LLM timeout or overloaded');
          }
        }

        // Simulate DeepSeek R1 Qwen 32B behavior
        if (modelName === '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b') {
          if (tier2Success) {
            return {
              response: `USE GRAPH test_user_graph;
MATCH (p:Person {name: 'Sarah Johnson'})-[:WORKS_ON]->(proj:Project)
WHERE proj.status = 'active'
RETURN p, proj, properties(proj) as props
ORDER BY proj.last_updated DESC
LIMIT 100;`
            };
          } else {
            throw new Error('Tier 2 LLM timeout or overloaded');
          }
        }

        throw new Error(`Unknown model: ${modelName}`);
      }
    },
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null // No entity cache hit
        })
      })
    }
  };
};

/**
 * Test 1: Tier 1 LLM (Llama 8b) succeeds - should not call Tier 2
 */
async function testTier1Success() {
  console.log('\n=== TEST 1: Tier 1 LLM Success ===');

  const env = createMockEnv(true, false); // Tier 1 works, Tier 2 would fail

  try {
    const result = await generateCypherQuery(
      'What is the relationship between quantum computing and machine learning?',
      'test_user_graph',
      env
    );

    console.log('✓ Tier 1 succeeded as expected');
    console.log('Template used:', result.templateUsed);

    if (result.templateUsed === 'llm_generated_llama_8b') {
      console.log('✓ Correct template marker (llm_generated_llama_8b)');
    } else {
      console.error('✗ Wrong template marker:', result.templateUsed);
    }

    console.log('Generated Cypher:', result.cypher.substring(0, 100) + '...');
    return true;
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    return false;
  }
}

/**
 * Test 2: Tier 1 fails, Tier 2 (Qwen 32b) succeeds
 */
async function testTier2Fallback() {
  console.log('\n=== TEST 2: Tier 2 Fallback Success ===');

  const env = createMockEnv(false, true); // Tier 1 fails, Tier 2 succeeds

  try {
    const result = await generateCypherQuery(
      'Explain the complex relationship between distributed systems architecture and blockchain consensus mechanisms',
      'test_user_graph',
      env
    );

    console.log('✓ Tier 2 fallback succeeded as expected');
    console.log('Template used:', result.templateUsed);

    if (result.templateUsed === 'llm_generated_qwen_32b') {
      console.log('✓ Correct template marker (llm_generated_qwen_32b)');
    } else {
      console.error('✗ Wrong template marker:', result.templateUsed);
    }

    console.log('Generated Cypher:', result.cypher.substring(0, 100) + '...');
    return true;
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    return false;
  }
}

/**
 * Test 3: Both tiers fail - should return user-friendly error
 */
async function testBothTiersFail() {
  console.log('\n=== TEST 3: Both Tiers Fail ===');

  const env = createMockEnv(false, false); // Both fail

  try {
    await generateCypherQuery(
      'Some super complex impossible query that would fail',
      'test_user_graph',
      env
    );

    console.error('✗ Test failed - should have thrown error');
    return false;
  } catch (error) {
    if (error.message.includes("couldn't understand that question")) {
      console.log('✓ Both tiers failed, user-friendly error returned');
      console.log('Error message:', error.message);
      return true;
    } else {
      console.error('✗ Wrong error message:', error.message);
      return false;
    }
  }
}

/**
 * Test 4: Template matching still works (should not use LLM at all)
 */
async function testTemplateBypass() {
  console.log('\n=== TEST 4: Template Matching Bypass ===');

  const env = createMockEnv(false, false); // LLMs would fail if called

  try {
    // Simple entity lookup should match template, never call LLM
    const result = await generateCypherQuery(
      'Who is Sarah?',
      'test_user_graph',
      env
    );

    console.log('✓ Template matching worked (no LLM called)');
    console.log('Template used:', result.templateUsed);

    if (result.templateUsed === 'entity_lookup') {
      console.log('✓ Correct template (entity_lookup)');
      return true;
    } else {
      console.error('✗ Wrong template:', result.templateUsed);
      return false;
    }
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  Two-Tier LLM Fallback Test Suite                    ║');
  console.log('║  Llama 3.1-8b → DeepSeek R1 Qwen 32B                 ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  const results = [];

  results.push(await testTier1Success());
  results.push(await testTier2Fallback());
  results.push(await testBothTiersFail());
  results.push(await testTemplateBypass());

  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  Test Summary                                         ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log(`\nTests Passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('\n✓ ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log(`\n✗ ${total - passed} TESTS FAILED`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Test suite crashed:', error);
  process.exit(1);
});
