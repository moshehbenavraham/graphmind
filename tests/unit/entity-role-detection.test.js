/**
 * Entity Role Detection Unit Tests (Feature 015)
 *
 * Tests the identifyEntityRole() function that determines whether
 * an extracted entity is the SOURCE or TARGET of a relationship.
 *
 * This is the critical fix for the bug where "Who works on GraphMind?"
 * incorrectly treated GraphMind as the source instead of the target.
 */

import { describe, it, expect } from 'vitest';
import {
  identifyEntityRole,
  QUESTION_PATTERNS
} from '../../src/lib/graph/cypher-templates.js';

describe('identifyEntityRole (Feature 015)', () => {
  // ========================================
  // Target-based patterns (entity is TARGET)
  // ========================================

  describe('Target Role Detection', () => {
    it('"Who works on GraphMind?" should return target role', () => {
      const result = identifyEntityRole('Who works on GraphMind?', [{ text: 'GraphMind' }]);
      expect(result.role).toBe('target');
      expect(result.queryDirection).toBe('by_target');
      expect(result.pattern).toBe('WHO_VERBS_X');
    });

    it('"Who works at GraphMind?" should return target role', () => {
      const result = identifyEntityRole('Who works at GraphMind?', [{ text: 'GraphMind' }]);
      expect(result.role).toBe('target');
      expect(result.queryDirection).toBe('by_target');
    });

    it('"What contributes to FastAPI?" should return target role', () => {
      const result = identifyEntityRole('What contributes to FastAPI?', [{ text: 'FastAPI' }]);
      expect(result.role).toBe('target');
      expect(result.queryDirection).toBe('by_target');
    });

    it('"Who leads the API team?" should return target role', () => {
      const result = identifyEntityRole('Who leads the API team?', [{ text: 'API team' }]);
      expect(result.role).toBe('target');
      expect(result.pattern).toBe('WHO_VERBS_X_NO_PREP');
      expect(result.queryDirection).toBe('by_target');
    });

    it('"Who manages GraphMind?" should return target role', () => {
      const result = identifyEntityRole('Who manages GraphMind?', [{ text: 'GraphMind' }]);
      expect(result.role).toBe('target');
      expect(result.queryDirection).toBe('by_target');
    });

    it('"Who attended the planning meeting?" should return target role', () => {
      const result = identifyEntityRole('Who attended the planning meeting?', [{ text: 'planning meeting' }]);
      expect(result.role).toBe('target');
      expect(result.queryDirection).toBe('by_target');
    });
  });

  // ========================================
  // Source-based patterns (entity is SOURCE)
  // ========================================

  describe('Source Role Detection', () => {
    it('"What does John work on?" should return source role', () => {
      const result = identifyEntityRole('What does John work on?', [{ text: 'John' }]);
      expect(result.role).toBe('source');
      expect(result.queryDirection).toBe('by_source');
      expect(result.pattern).toBe('WHAT_DOES_X_VERB');
    });

    it('"What did Sarah build?" should return source role', () => {
      const result = identifyEntityRole('What did Sarah build?', [{ text: 'Sarah' }]);
      expect(result.role).toBe('source');
      expect(result.queryDirection).toBe('by_source');
    });

    it('"What projects does Mike work on?" should return source role', () => {
      const result = identifyEntityRole('What projects does Mike work on?', [{ text: 'Mike' }]);
      expect(result.role).toBe('source');
      expect(result.queryDirection).toBe('by_source');
    });
  });

  // ========================================
  // Entity lookup patterns (not relationship)
  // ========================================

  describe('Entity Lookup Detection', () => {
    it('"Tell me about GraphMind" should return subject role (entity lookup)', () => {
      const result = identifyEntityRole('Tell me about GraphMind', [{ text: 'GraphMind' }]);
      expect(result.role).toBe('subject');
      expect(result.pattern).toBe('ENTITY_LOOKUP');
      expect(result.queryDirection).toBe('lookup');
    });

    it('"Who is Sarah?" should return subject role', () => {
      const result = identifyEntityRole('Who is Sarah?', [{ text: 'Sarah' }]);
      expect(result.role).toBe('subject');
      expect(result.queryDirection).toBe('lookup');
    });

    it('"What is GraphMind?" should return subject role', () => {
      const result = identifyEntityRole('What is GraphMind?', [{ text: 'GraphMind' }]);
      expect(result.role).toBe('subject');
      expect(result.queryDirection).toBe('lookup');
    });

    it('"Describe the project" should return subject role', () => {
      const result = identifyEntityRole('Describe the project', [{ text: 'project' }]);
      expect(result.role).toBe('subject');
      expect(result.queryDirection).toBe('lookup');
    });
  });

  // ========================================
  // Default/fallback behavior
  // ========================================

  describe('Default Fallback', () => {
    it('Unknown pattern should fall back to source role', () => {
      const result = identifyEntityRole('GraphMind stuff', [{ text: 'GraphMind' }]);
      expect(result.role).toBe('source');
      expect(result.pattern).toBe('default');
      expect(result.queryDirection).toBe('by_source');
    });

    it('Complex query without clear pattern should fall back to source', () => {
      const result = identifyEntityRole('Show me everything related to GraphMind and FastAPI', [{ text: 'GraphMind' }]);
      expect(result.role).toBe('source');
      expect(result.pattern).toBe('default');
    });
  });

  // ========================================
  // Edge cases
  // ========================================

  describe('Edge Cases', () => {
    it('Should handle question without question mark', () => {
      const result = identifyEntityRole('Who works on GraphMind', [{ text: 'GraphMind' }]);
      expect(result.role).toBe('target');
      expect(result.queryDirection).toBe('by_target');
    });

    it('Should handle lowercase question', () => {
      const result = identifyEntityRole('who works on graphmind?', [{ text: 'graphmind' }]);
      expect(result.role).toBe('target');
      expect(result.queryDirection).toBe('by_target');
    });

    it('Should handle extra whitespace', () => {
      const result = identifyEntityRole('  Who works on GraphMind?  ', [{ text: 'GraphMind' }]);
      expect(result.role).toBe('target');
    });

    it('Should handle empty entities array gracefully', () => {
      const result = identifyEntityRole('Who works on GraphMind?', []);
      expect(result.role).toBe('target');
      // Still detects pattern even with no entities
    });
  });
});

// ========================================
// Pattern regex validation tests
// ========================================

describe('QUESTION_PATTERNS Regex Validation', () => {
  it('WHO_VERBS_X should match "Who works on X?"', () => {
    expect(QUESTION_PATTERNS.WHO_VERBS_X.test('Who works on GraphMind?')).toBe(true);
  });

  it('WHO_VERBS_X should match "What contributes to X?"', () => {
    expect(QUESTION_PATTERNS.WHO_VERBS_X.test('What contributes to FastAPI?')).toBe(true);
  });

  it('WHO_VERBS_X_NO_PREP should match "Who leads X?"', () => {
    expect(QUESTION_PATTERNS.WHO_VERBS_X_NO_PREP.test('Who leads GraphMind?')).toBe(true);
  });

  it('WHO_VERBS_X_NO_PREP should match "Who manages X?"', () => {
    expect(QUESTION_PATTERNS.WHO_VERBS_X_NO_PREP.test('Who manages the team?')).toBe(true);
  });

  it('WHAT_DOES_X_VERB should match "What does John work on?"', () => {
    expect(QUESTION_PATTERNS.WHAT_DOES_X_VERB.test('What does John work on?')).toBe(true);
  });

  it('WHO_IS_X should match "Who is Sarah?"', () => {
    expect(QUESTION_PATTERNS.WHO_IS_X.test('Who is Sarah?')).toBe(true);
  });

  it('TELL_ME_ABOUT should match "Tell me about GraphMind"', () => {
    expect(QUESTION_PATTERNS.TELL_ME_ABOUT.test('Tell me about GraphMind')).toBe(true);
  });
});

// ========================================
// US2: Extended Pattern Coverage Tests
// ========================================

describe('Verb Tense Variations (T070)', () => {
  it('"Who worked on GraphMind?" should return target role', () => {
    const result = identifyEntityRole('Who worked on GraphMind?', [{ text: 'GraphMind' }]);
    expect(result.role).toBe('target');
    expect(result.queryDirection).toBe('by_target');
  });

  it('"Who working on GraphMind?" should return target role', () => {
    const result = identifyEntityRole('Who working on GraphMind?', [{ text: 'GraphMind' }]);
    expect(result.role).toBe('target');
  });
});

describe('Preposition Variations (T071)', () => {
  it('"Who works for GraphMind?" should return target role', () => {
    const result = identifyEntityRole('Who works for GraphMind?', [{ text: 'GraphMind' }]);
    expect(result.role).toBe('target');
    expect(result.queryDirection).toBe('by_target');
  });

  it('"Who works with GraphMind?" should return target role', () => {
    const result = identifyEntityRole('Who works with GraphMind?', [{ text: 'GraphMind' }]);
    expect(result.role).toBe('target');
  });

  it('"Who contributes to FastAPI?" should return target role', () => {
    const result = identifyEntityRole('Who contributes to FastAPI?', [{ text: 'FastAPI' }]);
    expect(result.role).toBe('target');
  });
});

describe('Questions Without Question Marks (T072)', () => {
  it('"Who works on GraphMind" (no mark) should return target role', () => {
    const result = identifyEntityRole('Who works on GraphMind', [{ text: 'GraphMind' }]);
    expect(result.role).toBe('target');
    expect(result.queryDirection).toBe('by_target');
  });

  it('"Tell me about GraphMind" (no mark) should return subject role', () => {
    const result = identifyEntityRole('Tell me about GraphMind', [{ text: 'GraphMind' }]);
    expect(result.role).toBe('subject');
  });
});

describe('Case Insensitivity (T100)', () => {
  it('"who works on graphmind?" (all lowercase) should return target role', () => {
    const result = identifyEntityRole('who works on graphmind?', [{ text: 'graphmind' }]);
    expect(result.role).toBe('target');
    expect(result.queryDirection).toBe('by_target');
  });

  it('"WHO WORKS ON GRAPHMIND?" (all uppercase) should return target role', () => {
    const result = identifyEntityRole('WHO WORKS ON GRAPHMIND?', [{ text: 'GRAPHMIND' }]);
    expect(result.role).toBe('target');
  });
});
