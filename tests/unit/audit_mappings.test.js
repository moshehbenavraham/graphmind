
import { describe, it, expect, vi } from 'vitest';
import { generateCypherQuery } from '../../src/services/cypher-generator.js';
import { RELATIONSHIP_MAPPINGS } from '../../src/lib/graph/cypher-templates.js';

// Mock environment
const mockEnv = {
    DB: {
        prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
                all: vi.fn().mockImplementation(async () => {
                    // Mock DB returning the "correct" entity type for the test context
                    // We'll set this dynamically or just return a generic match
                    return { results: [] };
                })
            }))
        }))
    },
    AI: {
        run: vi.fn()
    }
};

// Mock resolveEntity to return the type we expect for the test
// We need to mock the module we are testing? No, we can mock the internal call or just mock the DB.
// Actually, since resolveEntity is exported, we can mock it if we mock the module.
// But we want to test the integration of generateCypherQuery -> buildRelationshipParams.

// Let's use a smarter mock for DB that returns based on input
const dbMock = vi.fn();
mockEnv.DB.prepare = vi.fn(() => ({
    bind: vi.fn((userId) => ({
        all: dbMock
    }))
}));

describe('System-Wide Relationship Mapping Audit', () => {

    // Iterate over ALL mappings to ensure they generate valid Cypher
    Object.entries(RELATIONSHIP_MAPPINGS).forEach(([phrase, config]) => {
        it(`should correctly handle "${phrase}" (${config.direction})`, async () => {

            // Setup: We need a question containing the phrase
            const question = `Who ${phrase} TestEntity?`;

            // Setup: Mock DB to return an entity that matches the EXPECTED target of the mapping
            // If the mapping expects (Person)->(Project), and we ask "Who works on TestEntity?",
            // "TestEntity" is the Project. So we return type=Project.
            // This should trigger 'incoming' direction if the config implies it.

            const expectedEntityType = config.target === '*' ? 'Thing' : config.target;

            dbMock.mockResolvedValue({
                results: [
                    { canonical_name: 'TestEntity', entity_type: expectedEntityType, entity_id: '123' }
                ]
            });

            const result = await generateCypherQuery(question, 'user_test', mockEnv);

            // Verification
            if (config.direction === 'incoming' || (config.target && config.target === expectedEntityType)) {
                // Expect (target)-[:REL]->(source)
                // In our query "Who works on TestEntity?", TestEntity is the 'source' param (the known entity).
                // So we expect (target)-[:REL]->(source:Type {name: 'TestEntity'})
                expect(result.cypher).toContain(`->(source:${expectedEntityType}`);
            } else {
                // Expect (source)-[:REL]->(target)
                expect(result.cypher).toContain(`(source:${expectedEntityType}`);
                expect(result.cypher).toContain(`-[r:${config.type}]->`);
            }

            expect(result.cypher).not.toContain('undefined');
            expect(result.cypher).not.toContain('null');
        });
    });
});
