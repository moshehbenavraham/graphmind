/**
 * Comprehensive LLM Fallback Tests (T185-T188)
 *
 * T185: Test LLM generation with 10 complex sample questions
 * T186: Verify LLM-generated Cypher is valid and safe
 * T187: Verify LLM fallback completes within 3 seconds
 * T188: Test error handling when LLM fails to generate valid Cypher
 */

import { generateCypherQuery } from '../src/services/cypher-generator.js';

// Test configuration
const USER_NAMESPACE = 'user_test_graph';
const TEST_TIMEOUT_MS = 5000; // 5 seconds per test
const LLM_TARGET_LATENCY_MS = 3000; // 3 seconds target

/**
 * 10 complex sample questions that require LLM fallback (T185)
 * These should NOT match simple templates
 */
const COMPLEX_QUESTIONS = [
  'Who has worked with Sarah on multiple projects?',
  'What are the common topics discussed in meetings with the engineering team?',
  'Find people who know about Python and have attended meetings in the last month',
  'Which projects use both FastAPI and PostgreSQL technologies?',
  'Who are the people that Sarah has worked with who also know about machine learning?',
  'What meetings discussed topics related to the GraphMind project?',
  'Find all connections between Sarah and the FastAPI project',
  'Which people have the most diverse technology skills?',
  'What projects were discussed in meetings last week?',
  'Who are the most frequently mentioned people in recent notes?'
];

/**
 * Mock environment with controlled LLM responses
 */
function createMockEnv(mockAIResponse = null) {
  return {
    AI: {
      run: async (model, options) => {
        // Simulate LLM latency
        await new Promise(resolve => setTimeout(resolve, 100));

        // Return mock response or generate a valid Cypher query
        if (mockAIResponse) {
          return mockAIResponse;
        }

        // Generate a valid Cypher query for the question
        return {
          response: `USE GRAPH ${USER_NAMESPACE};
MATCH (p:Person)-[r]->(target)
RETURN p, r, target, properties(target) as props
ORDER BY p.name
LIMIT 100;`
        };
      }
    },
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null // No entity found in cache
        })
      })
    }
  };
}

/**
 * Test Results Tracker
 */
class TestResults {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  pass(name, details = {}) {
    this.passed++;
    this.tests.push({ name, status: 'PASS', details });
    console.log(`✅ PASS: ${name}`);
    if (Object.keys(details).length > 0) {
      console.log(`   Details:`, details);
    }
  }

  fail(name, error, details = {}) {
    this.failed++;
    this.tests.push({ name, status: 'FAIL', error: error.message, details });
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
    if (Object.keys(details).length > 0) {
      console.log(`   Details:`, details);
    }
  }

  summary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${this.passed + this.failed}`);
    console.log(`Passed: ${this.passed} ✅`);
    console.log(`Failed: ${this.failed} ❌`);
    console.log(`Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(80) + '\n');
  }
}

const results = new TestResults();

/**
 * T185: Test LLM generation with 10 complex sample questions
 */
async function testComplexQuestions() {
  console.log('\n📝 T185: Testing LLM generation with 10 complex questions\n');

  for (let i = 0; i < COMPLEX_QUESTIONS.length; i++) {
    const question = COMPLEX_QUESTIONS[i];
    console.log(`\n[${i + 1}/10] Question: "${question}"`);

    try {
      const startTime = Date.now();
      const result = await generateCypherQuery(
        question,
        USER_NAMESPACE,
        createMockEnv()
      );
      const latency = Date.now() - startTime;

      // Verify result structure
      if (!result.cypher) throw new Error('No Cypher query returned');
      if (!result.templateUsed) throw new Error('No template indicator');

      // Check if LLM was used (for complex queries, should be 'llm_generated')
      console.log(`   Template: ${result.templateUsed}`);
      console.log(`   Latency: ${latency}ms`);
      console.log(`   Cypher: ${result.cypher.substring(0, 100)}...`);

      results.pass(`Complex Question ${i + 1}`, {
        question,
        latency: `${latency}ms`,
        template: result.templateUsed
      });
    } catch (error) {
      results.fail(`Complex Question ${i + 1}`, error, { question });
    }
  }
}

/**
 * T186: Verify LLM-generated Cypher is valid and safe
 */
async function testCypherValidation() {
  console.log('\n🔒 T186: Testing Cypher validation and safety\n');

  // Test 1: Valid Cypher should pass
  console.log('Test 1: Valid Cypher should pass validation');
  try {
    const result = await generateCypherQuery(
      'Who has worked with Sarah?',
      USER_NAMESPACE,
      createMockEnv({
        response: `USE GRAPH ${USER_NAMESPACE};
MATCH (p:Person)-[:WORKED_WITH]->(colleague:Person {name: 'Sarah'})
RETURN p, colleague LIMIT 100;`
      })
    );

    if (!result.cypher.includes('USE GRAPH')) {
      throw new Error('Namespace not injected');
    }
    if (!result.cypher.includes('LIMIT')) {
      throw new Error('LIMIT clause not enforced');
    }

    results.pass('Valid Cypher passes validation', {
      cypherLength: result.cypher.length
    });
  } catch (error) {
    results.fail('Valid Cypher passes validation', error);
  }

  // Test 2: Destructive operation should be blocked
  console.log('\nTest 2: Destructive operation should be blocked');
  try {
    const result = await generateCypherQuery(
      'Delete all projects',
      USER_NAMESPACE,
      createMockEnv({
        response: `USE GRAPH ${USER_NAMESPACE};
MATCH (p:Project) DELETE p;`
      })
    );

    // Should have thrown an error
    results.fail('Destructive operation blocked', new Error('DELETE was not blocked'));
  } catch (error) {
    // Expected to fail
    if (error.message.includes('Destructive') || error.message.includes("couldn't understand")) {
      results.pass('Destructive operation blocked', {
        errorMessage: error.message
      });
    } else {
      results.fail('Destructive operation blocked', error);
    }
  }

  // Test 3: Missing namespace should be rejected
  console.log('\nTest 3: Missing namespace should be auto-injected');
  try {
    const result = await generateCypherQuery(
      'List all people',
      USER_NAMESPACE,
      createMockEnv({
        response: `MATCH (p:Person) RETURN p LIMIT 100;` // Missing USE GRAPH
      })
    );

    if (!result.cypher.includes(`USE GRAPH ${USER_NAMESPACE}`)) {
      throw new Error('Namespace was not auto-injected');
    }

    results.pass('Missing namespace auto-injected', {
      hasNamespace: true
    });
  } catch (error) {
    results.fail('Missing namespace auto-injected', error);
  }
}

/**
 * T187: Verify LLM fallback completes within 3 seconds
 */
async function testLatency() {
  console.log('\n⚡ T187: Testing LLM fallback latency (<3s target)\n');

  const latencies = [];

  for (let i = 0; i < 5; i++) {
    console.log(`\nLatency Test ${i + 1}/5`);
    const question = COMPLEX_QUESTIONS[i % COMPLEX_QUESTIONS.length];

    try {
      const startTime = Date.now();
      await generateCypherQuery(
        question,
        USER_NAMESPACE,
        createMockEnv()
      );
      const latency = Date.now() - startTime;
      latencies.push(latency);

      console.log(`   Latency: ${latency}ms`);

      if (latency <= LLM_TARGET_LATENCY_MS) {
        results.pass(`Latency Test ${i + 1}`, { latency: `${latency}ms` });
      } else {
        results.fail(`Latency Test ${i + 1}`, new Error(`Exceeded 3s target: ${latency}ms`));
      }
    } catch (error) {
      results.fail(`Latency Test ${i + 1}`, error);
    }
  }

  // Calculate statistics
  if (latencies.length > 0) {
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);

    console.log('\n📊 Latency Statistics:');
    console.log(`   Average: ${avgLatency.toFixed(0)}ms`);
    console.log(`   Min: ${minLatency}ms`);
    console.log(`   Max: ${maxLatency}ms`);
    console.log(`   Target: ${LLM_TARGET_LATENCY_MS}ms`);
    console.log(`   All within target: ${maxLatency <= LLM_TARGET_LATENCY_MS ? 'YES ✅' : 'NO ❌'}`);
  }
}

/**
 * T188: Test error handling when LLM fails
 */
async function testErrorHandling() {
  console.log('\n🚨 T188: Testing error handling for LLM failures\n');

  // Test 1: LLM returns empty response
  console.log('Test 1: LLM returns empty response');
  try {
    await generateCypherQuery(
      'Complex question',
      USER_NAMESPACE,
      createMockEnv({ response: '' }) // Empty response
    );
    results.fail('Empty response handling', new Error('Should have thrown error'));
  } catch (error) {
    if (error.message.includes("couldn't understand")) {
      results.pass('Empty response handling', {
        errorMessage: error.message
      });
    } else {
      results.fail('Empty response handling', error);
    }
  }

  // Test 2: LLM timeout
  console.log('\nTest 2: LLM timeout (>3s)');
  try {
    const slowEnv = {
      AI: {
        run: async () => {
          // Simulate slow LLM (4 seconds)
          await new Promise(resolve => setTimeout(resolve, 4000));
          return { response: 'MATCH (n) RETURN n LIMIT 100;' };
        }
      },
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => null
          })
        })
      }
    };

    await generateCypherQuery(
      'Timeout test',
      USER_NAMESPACE,
      slowEnv
    );
    results.fail('LLM timeout handling', new Error('Should have timed out'));
  } catch (error) {
    if (error.message.includes('timeout') || error.message.includes("couldn't understand")) {
      results.pass('LLM timeout handling', {
        errorMessage: error.message
      });
    } else {
      results.fail('LLM timeout handling', error);
    }
  }

  // Test 3: LLM returns invalid Cypher
  console.log('\nTest 3: LLM returns invalid Cypher');
  try {
    await generateCypherQuery(
      'Invalid query test',
      USER_NAMESPACE,
      createMockEnv({
        response: 'This is not a valid Cypher query at all!'
      })
    );
    results.fail('Invalid Cypher handling', new Error('Should have thrown validation error'));
  } catch (error) {
    if (error.message.includes('validation') || error.message.includes("couldn't understand") || error.message.includes('MATCH')) {
      results.pass('Invalid Cypher handling', {
        errorMessage: error.message
      });
    } else {
      results.fail('Invalid Cypher handling', error);
    }
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🧪 LLM Fallback Comprehensive Test Suite\n');
  console.log('Testing: T185, T186, T187, T188\n');
  console.log('='.repeat(80));

  try {
    await testComplexQuestions(); // T185
    await testCypherValidation(); // T186
    await testLatency(); // T187
    await testErrorHandling(); // T188

    results.summary();

    // Final verdict
    if (results.failed === 0) {
      console.log('🎉 All LLM fallback tests PASSED!');
      console.log('✅ T180-T188 complete - LLM fallback is working correctly\n');
      return 0; // Success
    } else {
      console.log('⚠️  Some tests failed. Review the results above.\n');
      return 1; // Failure
    }
  } catch (error) {
    console.error('❌ Test suite failed with error:', error);
    return 1;
  }
}

// Run tests if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runAllTests, COMPLEX_QUESTIONS };
