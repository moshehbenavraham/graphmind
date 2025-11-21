
import { describe, it, expect } from 'vitest';
import { resolveEntity } from '../../src/services/cypher-generator.js';

// Mock env.DB
const mockEnv = {
    DB: {
        prepare: () => ({
            bind: () => ({
                all: async () => ({
                    results: [
                        { canonical_name: 'GraphMind' },
                        { canonical_name: 'Alice Johnson' },
                        { canonical_name: 'Cloudflare Workers' }
                    ]
                })
            })
        })
    }
};

describe('Fuzzy Entity Resolution', () => {
    it('should match "GraftMind" to "GraphMind"', async () => {
        const result = await resolveEntity('GraftMind', 'user123', mockEnv);
        expect(result.name).toBe('GraphMind');
    });

    it('should match "GrafMind" to "GraphMind"', async () => {
        const result = await resolveEntity('GrafMind', 'user123', mockEnv);
        expect(result.name).toBe('GraphMind');
    });

    it('should match "Alice Jonson" to "Alice Johnson"', async () => {
        // "Alice" vs "Alice Johnson" -> distance 8 (Johnson + space). 
        // Length 13. Sim = 1 - 8/13 = 0.38. 
        // Wait, Levenshtein might not be best for partials.
        // But "Alice" is a substring.
        // My current implementation only does Levenshtein.
        // Let's see what it does.
        // Actually, for "Alice", we might want to keep "Alice" if it's a valid alias.
        // But here we only have canonical names.
        // Let's test a typo of Alice Johnson: "Alice Jonson"
        const result = await resolveEntity('Alice Jonson', 'user123', mockEnv);
        expect(result.name).toBe('Alice Johnson');
    });

    it('should return original if no match found', async () => {
        const result = await resolveEntity('Zebra', 'user123', mockEnv);
        expect(result.name).toBe('Zebra');
    });
});
