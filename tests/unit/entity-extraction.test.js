import { describe, it, expect } from 'vitest';
import { extractEntityReferences } from '../../src/lib/graph/cypher-templates.js';

describe('Entity Extraction', () => {
    it('should extract entities based on relationship phrases (lowercase)', () => {
        const question = 'sarah works on graphmind';
        const entities = extractEntityReferences(question);
        expect(entities).toHaveLength(2);
        expect(entities.map(e => e.text)).toContain('sarah');
        expect(entities.map(e => e.text)).toContain('graphmind');
    });

    it('should extract entities from questions with phrases', () => {
        const question = 'Who works on GraphMind?';
        const entities = extractEntityReferences(question);
        // "Who" is a stop word, so it should be removed from the left part
        // "GraphMind" is the right part
        expect(entities).toHaveLength(1);
        expect(entities[0].text).toBe('GraphMind');
    });

    it('should handle typos in entities if phrase is present', () => {
        const question = 'Who works on GrapMind?';
        const entities = extractEntityReferences(question);
        expect(entities).toHaveLength(1);
        expect(entities[0].text).toBe('GrapMind');
    });

    it('should ignore stop words like Who, What, Is (Fallback)', () => {
        const question = 'Who is Sarah?';
        const entities = extractEntityReferences(question);
        expect(entities).toHaveLength(1);
        expect(entities[0].text).toBe('Sarah');
    });

    it('should extract multiple entities via phrase', () => {
        const question = 'Does Alice know Bob?';
        // "know" is in RELATIONSHIP_MAPPINGS
        const entities = extractEntityReferences(question);
        expect(entities).toHaveLength(2);
        expect(entities.map(e => e.text)).toContain('Alice');
        expect(entities.map(e => e.text)).toContain('Bob');
    });
});
