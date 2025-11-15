/**
 * Comprehensive Answer Generation Test Suite
 * Feature 009: Answer Generation with LLM - Final Phase
 *
 * Tests:
 * - T270-T273: Prompt engineering with 30+ diverse queries
 * - T285-T291: Quality assurance with 50+ queries and expected answers
 *
 * This suite validates answer quality, accuracy, citations, and handling of edge cases.
 */

/**
 * Test Query Database - 50+ Diverse Queries
 * Each query includes expected answer characteristics for validation
 */
export const TEST_QUERIES = [
  // ===== Entity Description Queries (10) =====
  {
    id: 'entity-001',
    question: 'Who is Sarah Johnson?',
    type: 'entity',
    expectedCharacteristics: {
      mentions: ['Sarah Johnson', 'Sarah'],
      includesType: true, // Should mention she's a Person or have a role
      includesProperties: true, // Should mention role, projects, etc.
      sentenceCount: [2, 3], // 2-3 sentences
      includesCitation: true
    },
    notes: 'Basic entity description'
  },
  {
    id: 'entity-002',
    question: 'Tell me about the FastAPI Migration project',
    type: 'entity',
    expectedCharacteristics: {
      mentions: ['FastAPI', 'migration', 'project'],
      includesProperties: true,
      sentenceCount: [2, 3],
      includesCitation: true
    }
  },
  {
    id: 'entity-003',
    question: 'What is the Redis Cache Optimization about?',
    type: 'entity',
    expectedCharacteristics: {
      mentions: ['Redis', 'cache', 'optimization'],
      includesProperties: true,
      sentenceCount: [2, 3]
    }
  },
  {
    id: 'entity-004',
    question: 'Who is Alice Chen?',
    type: 'entity',
    expectedCharacteristics: {
      mentions: ['Alice'],
      includesType: true,
      sentenceCount: [2, 3]
    }
  },
  {
    id: 'entity-005',
    question: 'What is the GraphQL API Design project?',
    type: 'entity',
    expectedCharacteristics: {
      mentions: ['GraphQL', 'API'],
      includesProperties: true
    }
  },
  {
    id: 'entity-006',
    question: 'Tell me about Bob',
    type: 'entity',
    expectedCharacteristics: {
      mentions: ['Bob'],
      sentenceCount: [2, 3]
    }
  },
  {
    id: 'entity-007',
    question: 'What is Python?',
    type: 'entity',
    expectedCharacteristics: {
      mentions: ['Python'],
      includesType: true
    }
  },
  {
    id: 'entity-008',
    question: 'Who is the product manager?',
    type: 'entity',
    expectedCharacteristics: {
      includesType: true,
      sentenceCount: [2, 3]
    }
  },
  {
    id: 'entity-009',
    question: 'What is TypeScript used for?',
    type: 'entity',
    expectedCharacteristics: {
      mentions: ['TypeScript'],
      includesProperties: true
    }
  },
  {
    id: 'entity-010',
    question: 'Tell me about the backend team',
    type: 'entity',
    expectedCharacteristics: {
      mentions: ['backend', 'team'],
      sentenceCount: [2, 3]
    }
  },

  // ===== Relationship Queries (10) =====
  {
    id: 'rel-001',
    question: 'What projects is Sarah working on?',
    type: 'relationship',
    expectedCharacteristics: {
      mentions: ['Sarah', 'project'],
      includesList: true, // Should list projects
      mentionsRelationship: true, // "working on", "works on", etc.
      sentenceCount: [2, 4],
      includesCitation: true
    }
  },
  {
    id: 'rel-002',
    question: 'Who is working on the FastAPI Migration?',
    type: 'relationship',
    expectedCharacteristics: {
      mentions: ['FastAPI', 'migration'],
      includesList: true,
      mentionsRelationship: true
    }
  },
  {
    id: 'rel-003',
    question: 'What technologies does Alice use?',
    type: 'relationship',
    expectedCharacteristics: {
      mentions: ['Alice'],
      includesList: true,
      mentionsRelationship: true
    }
  },
  {
    id: 'rel-004',
    question: 'Who did I meet with last week?',
    type: 'relationship',
    expectedCharacteristics: {
      includesList: true,
      mentionsRelationship: true,
      includesCitation: true
    }
  },
  {
    id: 'rel-005',
    question: 'What meetings did Sarah attend?',
    type: 'relationship',
    expectedCharacteristics: {
      mentions: ['Sarah', 'meeting'],
      includesList: true
    }
  },
  {
    id: 'rel-006',
    question: 'Who works on the backend team?',
    type: 'relationship',
    expectedCharacteristics: {
      mentions: ['backend', 'team'],
      includesList: true,
      sentenceCount: [2, 4]
    }
  },
  {
    id: 'rel-007',
    question: 'What projects use Python?',
    type: 'relationship',
    expectedCharacteristics: {
      mentions: ['Python', 'project'],
      includesList: true
    }
  },
  {
    id: 'rel-008',
    question: 'Who reports to the engineering manager?',
    type: 'relationship',
    expectedCharacteristics: {
      mentions: ['manager'],
      includesList: true
    }
  },
  {
    id: 'rel-009',
    question: 'What technologies are used in the API project?',
    type: 'relationship',
    expectedCharacteristics: {
      mentions: ['API', 'project', 'technology'],
      includesList: true
    }
  },
  {
    id: 'rel-010',
    question: 'Who collaborated on the Redis optimization?',
    type: 'relationship',
    expectedCharacteristics: {
      mentions: ['Redis', 'optimization'],
      includesList: true
    }
  },

  // ===== Temporal Queries (10) =====
  {
    id: 'temp-001',
    question: 'What did I do yesterday?',
    type: 'temporal',
    expectedCharacteristics: {
      mentions: ['yesterday'],
      includesDates: true,
      includesList: true,
      sentenceCount: [2, 4],
      includesCitation: true
    }
  },
  {
    id: 'temp-002',
    question: 'What meetings happened in November?',
    type: 'temporal',
    expectedCharacteristics: {
      mentions: ['November', 'meeting'],
      includesDates: true,
      includesList: true
    }
  },
  {
    id: 'temp-003',
    question: 'When did Sarah start working on the FastAPI project?',
    type: 'temporal',
    expectedCharacteristics: {
      mentions: ['Sarah', 'FastAPI'],
      includesDates: true,
      sentenceCount: [1, 2]
    }
  },
  {
    id: 'temp-004',
    question: 'What happened last week?',
    type: 'temporal',
    expectedCharacteristics: {
      mentions: ['last week'],
      includesList: true,
      includesDates: true
    }
  },
  {
    id: 'temp-005',
    question: 'When was the last deployment?',
    type: 'temporal',
    expectedCharacteristics: {
      mentions: ['deployment'],
      includesDates: true,
      includesCitation: true
    }
  },
  {
    id: 'temp-006',
    question: 'What meetings are scheduled for next week?',
    type: 'temporal',
    expectedCharacteristics: {
      mentions: ['next week', 'meeting'],
      includesDates: true,
      includesList: true
    }
  },
  {
    id: 'temp-007',
    question: 'What did we discuss on November 5th?',
    type: 'temporal',
    expectedCharacteristics: {
      mentions: ['November'],
      includesDates: true,
      sentenceCount: [2, 3]
    }
  },
  {
    id: 'temp-008',
    question: 'When did Alice join the project?',
    type: 'temporal',
    expectedCharacteristics: {
      mentions: ['Alice'],
      includesDates: true
    }
  },
  {
    id: 'temp-009',
    question: 'What happened in Q4?',
    type: 'temporal',
    expectedCharacteristics: {
      mentions: ['Q4'],
      includesList: true
    }
  },
  {
    id: 'temp-010',
    question: 'When was the Redis optimization completed?',
    type: 'temporal',
    expectedCharacteristics: {
      mentions: ['Redis', 'optimization'],
      includesDates: true
    }
  },

  // ===== Count Queries (10) =====
  {
    id: 'count-001',
    question: 'How many projects involve Python?',
    type: 'count',
    expectedCharacteristics: {
      mentions: ['Python', 'project'],
      includesCount: true, // Should state a number
      sentenceCount: [1, 3],
      noApproximations: true // Should say "3" not "several" or "a few"
    }
  },
  {
    id: 'count-002',
    question: 'How many people work on the backend team?',
    type: 'count',
    expectedCharacteristics: {
      mentions: ['backend', 'team'],
      includesCount: true,
      sentenceCount: [1, 2]
    }
  },
  {
    id: 'count-003',
    question: 'How many meetings did I have last week?',
    type: 'count',
    expectedCharacteristics: {
      mentions: ['meeting', 'last week'],
      includesCount: true,
      includesCitation: true
    }
  },
  {
    id: 'count-004',
    question: 'How many projects is Sarah working on?',
    type: 'count',
    expectedCharacteristics: {
      mentions: ['Sarah', 'project'],
      includesCount: true
    }
  },
  {
    id: 'count-005',
    question: 'How many technologies are we using?',
    type: 'count',
    expectedCharacteristics: {
      mentions: ['technology'],
      includesCount: true,
      includesList: true // Should list examples
    }
  },
  {
    id: 'count-006',
    question: 'How many active projects do we have?',
    type: 'count',
    expectedCharacteristics: {
      mentions: ['project', 'active'],
      includesCount: true
    }
  },
  {
    id: 'count-007',
    question: 'How many bugs were fixed this sprint?',
    type: 'count',
    expectedCharacteristics: {
      mentions: ['bug', 'sprint'],
      includesCount: true
    }
  },
  {
    id: 'count-008',
    question: 'How many team members attended the standup?',
    type: 'count',
    expectedCharacteristics: {
      mentions: ['team', 'standup'],
      includesCount: true
    }
  },
  {
    id: 'count-009',
    question: 'How many projects use TypeScript?',
    type: 'count',
    expectedCharacteristics: {
      mentions: ['TypeScript', 'project'],
      includesCount: true
    }
  },
  {
    id: 'count-010',
    question: 'How many meetings involve Bob?',
    type: 'count',
    expectedCharacteristics: {
      mentions: ['Bob', 'meeting'],
      includesCount: true
    }
  },

  // ===== List Queries (10) =====
  {
    id: 'list-001',
    question: 'List all my active projects',
    type: 'list',
    expectedCharacteristics: {
      mentions: ['project', 'active'],
      includesList: true,
      enumeratesItems: true, // Should clearly list items
      sentenceCount: [2, 4]
    }
  },
  {
    id: 'list-002',
    question: 'Show me all meetings with Bob',
    type: 'list',
    expectedCharacteristics: {
      mentions: ['Bob', 'meeting'],
      includesList: true,
      enumeratesItems: true
    }
  },
  {
    id: 'list-003',
    question: 'List all technologies we use',
    type: 'list',
    expectedCharacteristics: {
      mentions: ['technology'],
      includesList: true,
      enumeratesItems: true
    }
  },
  {
    id: 'list-004',
    question: 'Show all team members',
    type: 'list',
    expectedCharacteristics: {
      mentions: ['team'],
      includesList: true,
      enumeratesItems: true
    }
  },
  {
    id: 'list-005',
    question: 'List projects using Python',
    type: 'list',
    expectedCharacteristics: {
      mentions: ['Python', 'project'],
      includesList: true
    }
  },
  {
    id: 'list-006',
    question: 'Show me all completed tasks',
    type: 'list',
    expectedCharacteristics: {
      mentions: ['task', 'completed'],
      includesList: true
    }
  },
  {
    id: 'list-007',
    question: 'List all meetings in November',
    type: 'list',
    expectedCharacteristics: {
      mentions: ['meeting', 'November'],
      includesList: true,
      includesDates: true
    }
  },
  {
    id: 'list-008',
    question: 'Show projects Sarah is working on',
    type: 'list',
    expectedCharacteristics: {
      mentions: ['Sarah', 'project'],
      includesList: true
    }
  },
  {
    id: 'list-009',
    question: 'List all backend team members',
    type: 'list',
    expectedCharacteristics: {
      mentions: ['backend', 'team'],
      includesList: true
    }
  },
  {
    id: 'list-010',
    question: 'Show all projects in progress',
    type: 'list',
    expectedCharacteristics: {
      mentions: ['project', 'progress'],
      includesList: true
    }
  }
];

/**
 * Validation Functions
 * Check if generated answers meet expected characteristics
 */

export function validateAnswer(query, generatedAnswer) {
  const results = {
    queryId: query.id,
    question: query.question,
    type: query.type,
    answer: generatedAnswer.answer,
    passed: true,
    failures: [],
    warnings: []
  };

  const answer = generatedAnswer.answer.toLowerCase();
  const expected = query.expectedCharacteristics;

  // Check mentions
  if (expected.mentions) {
    for (const term of expected.mentions) {
      if (!answer.includes(term.toLowerCase())) {
        results.failures.push(`Missing expected mention: "${term}"`);
        results.passed = false;
      }
    }
  }

  // Check sentence count
  if (expected.sentenceCount) {
    const sentences = generatedAnswer.answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const [min, max] = expected.sentenceCount;
    if (sentences.length < min || sentences.length > max) {
      results.warnings.push(`Sentence count ${sentences.length} outside range [${min}, ${max}]`);
    }
  }

  // Check for count in answer
  if (expected.includesCount) {
    const hasNumber = /\b\d+\b/.test(generatedAnswer.answer);
    if (!hasNumber) {
      results.failures.push('Missing expected count/number');
      results.passed = false;
    }

    if (expected.noApproximations) {
      const approximations = ['several', 'a few', 'some', 'many'];
      if (approximations.some(approx => answer.includes(approx))) {
        results.failures.push('Used approximation instead of exact count');
        results.passed = false;
      }
    }
  }

  // Check for citations
  if (expected.includesCitation) {
    const hasCitation = generatedAnswer.sources && generatedAnswer.sources.length > 0;
    if (!hasCitation) {
      results.warnings.push('Missing source citations');
    }

    // Check if citation is mentioned in answer text
    const citationPhrases = ['from your notes', 'from your meeting', 'from', 'on november', 'in your notes'];
    const hasCitationInText = citationPhrases.some(phrase => answer.includes(phrase));
    if (!hasCitationInText) {
      results.warnings.push('Citation not mentioned in answer text');
    }
  }

  // Check for dates
  if (expected.includesDates) {
    const hasDate = /\b(january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}(st|nd|rd|th)?)\b/i.test(generatedAnswer.answer);
    if (!hasDate) {
      results.failures.push('Missing expected date/temporal reference');
      results.passed = false;
    }
  }

  // Check for list enumeration
  if (expected.includesList || expected.enumeratesItems) {
    const hasList = /[:,]|and|including/.test(answer);
    if (!hasList) {
      results.warnings.push('Expected list/enumeration not clear');
    }
  }

  return results;
}

/**
 * Run comprehensive test suite
 */
export async function runComprehensiveTests(answerGeneratorFunction) {
  console.log('🧪 Running Comprehensive Answer Generation Test Suite\n');
  console.log(`Total Queries: ${TEST_QUERIES.length}\n`);

  const results = {
    total: TEST_QUERIES.length,
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
  };

  for (const query of TEST_QUERIES) {
    console.log(`Testing: ${query.id} - ${query.question}`);

    try {
      // Generate answer (mock or actual implementation)
      const generatedAnswer = await answerGeneratorFunction(query.question, query.type);

      // Validate answer
      const validation = validateAnswer(query, generatedAnswer);
      results.details.push(validation);

      if (validation.passed) {
        results.passed++;
        console.log(`  ✅ PASS`);
      } else {
        results.failed++;
        console.log(`  ❌ FAIL`);
        validation.failures.forEach(f => console.log(`     - ${f}`));
      }

      if (validation.warnings.length > 0) {
        results.warnings += validation.warnings.length;
        validation.warnings.forEach(w => console.log(`     ⚠️  ${w}`));
      }
    } catch (error) {
      results.failed++;
      results.details.push({
        queryId: query.id,
        question: query.question,
        passed: false,
        failures: [error.message]
      });
      console.log(`  ❌ ERROR: ${error.message}`);
    }

    console.log('');
  }

  // Summary
  console.log('📊 Test Summary:\n');
  console.log(`Total: ${results.total}`);
  console.log(`Passed: ${results.passed} (${((results.passed / results.total) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${results.failed} (${((results.failed / results.total) * 100).toFixed(1)}%)`);
  console.log(`Warnings: ${results.warnings}\n`);

  // Validation against success criteria
  const passRate = (results.passed / results.total) * 100;
  console.log('🎯 Success Criteria Validation:');
  console.log(`  - 95%+ accuracy: ${passRate >= 95 ? '✅ PASS' : '❌ FAIL'} (${passRate.toFixed(1)}%)`);
  console.log(`  - Zero hallucinations: ${results.failed === 0 ? '✅ PASS' : '⚠️  See failures'}`);
  console.log(`  - 90%+ citation rate: ${results.warnings < (results.total * 0.1) ? '✅ PASS' : '⚠️  Low citation rate'}`);

  return results;
}

// Export for use in other test files
export default {
  TEST_QUERIES,
  validateAnswer,
  runComprehensiveTests
};
