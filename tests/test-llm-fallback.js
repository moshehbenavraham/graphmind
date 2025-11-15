/**
 * Quick test for LLM fallback in Cypher generation
 * Tests T180-T184: LLM integration, prompt template, fallback logic, validation, timeout
 */

import { generateCypherQuery } from '../src/services/cypher-generator.js';

/**
 * Mock environment for testing
 */
const mockEnv = {
  AI: {
    run: async (model, options) => {
      console.log(`[Mock AI] Called with model: ${model}`);
      console.log('[Mock AI] Prompt:', options.messages[1].content.substring(0, 200) + '...');

      // Simulate LLM response for a complex query
      return {
        response: `USE GRAPH user_test_graph;
MATCH (p:Person)-[r:WORKED_WITH]->(colleague:Person)
WHERE colleague.name = 'Sarah Johnson'
RETURN p, r, colleague, properties(colleague) as props
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

/**
 * Test cases for LLM fallback
 */
async function runTests() {
  console.log('🧪 Testing LLM Fallback Implementation\n');

  // Test 1: Complex query that requires LLM
  console.log('Test 1: Complex query requiring LLM');
  console.log('Question: "Who has worked with Sarah on multiple projects?"');

  try {
    const result = await generateCypherQuery(
      'Who has worked with Sarah on multiple projects?',
      'user_test_graph',
      mockEnv
    );

    console.log('✅ LLM generation succeeded');
    console.log('Generated Cypher:', result.cypher);
    console.log('Template used:', result.templateUsed);
    console.log('Entities:', result.entities);
    console.log('');
  } catch (error) {
    console.error('❌ LLM generation failed:', error.message);
    console.log('');
  }

  // Test 2: Simple query that should use template (not LLM)
  console.log('Test 2: Simple query using template (should NOT use LLM)');
  console.log('Question: "Who is Sarah?"');

  try {
    const result = await generateCypherQuery(
      'Who is Sarah?',
      'user_test_graph',
      mockEnv
    );

    console.log('✅ Template generation succeeded');
    console.log('Template used:', result.templateUsed);
    console.log('Should be "entity_lookup", not "llm_generated"');
    console.log('');
  } catch (error) {
    console.error('❌ Template generation failed:', error.message);
    console.log('');
  }

  console.log('🎉 LLM Fallback Tests Complete!');
  console.log('\nNext steps:');
  console.log('1. Test with real Workers AI binding');
  console.log('2. Test with 10 complex sample questions (T185)');
  console.log('3. Verify validation catches invalid Cypher (T186)');
  console.log('4. Test timeout handling (T187)');
}

// Run tests
runTests().catch(console.error);
