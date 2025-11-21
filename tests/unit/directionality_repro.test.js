
import { describe, it, expect, vi } from 'vitest';
import { generateCypherQuery } from '../../src/services/cypher-generator.js';

// Mock environment
const mockEnv = {
    DB: {
        prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
                all: vi.fn().mockResolvedValue({
                    results: [
                        { canonical_name: 'GraphMind', entity_type: 'Project', entity_id: 'proj1' },
                        { canonical_name: 'Alice Johnson', entity_type: 'Person', entity_id: 'p1' }
                    ]
                })
            }))
        }))
    },
    AI: {
        run: vi.fn()
    }
};

describe('Relationship Directionality', () => {
    it('should generate correct query for "Who works at GraphMind?" (Target -> Source)', async () => {
        const question = "Who works at GraphMind?";
        const result = await generateCypherQuery(question, 'user_test', mockEnv);

        console.log('Generated Cypher:', result.cypher);

        // Should be: MATCH (source:Project {name: 'GraphMind'})<-[:WORKS_ON]-(target)
        // OR: MATCH (target)-[:WORKS_ON]->(source:Project {name: 'GraphMind'})

        // Current wrong behavior expected: MATCH (source:Project {name: 'GraphMind'})-[:WORKS_ON]->(target)
        // Expected: MATCH (target:Person)-[r:WORKS_ON]->(source:Project {name: 'GraphMind'})
        expect(result.cypher).toContain("(target:Person)-[r:WORKS_ON]->(source:Project");
    });

    it('should generate correct query for "What projects does Alice work on?" (Source -> Target)', async () => {
        const question = "What projects does Alice work on?";
        const result = await generateCypherQuery(question, 'user_test', mockEnv);

        console.log('Generated Cypher:', result.cypher);

        expect(result.cypher).toContain("-[r:WORKS_ON]->");
    });
});
