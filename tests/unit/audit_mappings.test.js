
import { describe, it, expect, vi } from 'vitest';
import { generateCypherQuery } from '../../src/services/cypher-generator.js';
import {
    RELATIONSHIP_MAPPINGS,
    extractEntityReferences,
    identifyEntityRole
} from '../../src/lib/graph/cypher-templates.js';

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

            // Determine whether the extracted entity is treated as SOURCE or TARGET (Feature 015).
            // This controls whether we query by target_name or source_name and which label
            // resolveEntity should return for the known entity.
            const entities = extractEntityReferences(question);
            const { queryDirection } = identifyEntityRole(question, entities);

            const expectedEntityType = (() => {
                // If we're querying by target, the known entity is the target type.
                // Otherwise the known entity is the source type.
                if (queryDirection === 'by_target') {
                    return (config.target === '*' ? 'Thing' : config.target) || 'Thing';
                }
                return (config.source === '*' ? 'Thing' : config.source) || 'Thing';
            })();

            dbMock.mockResolvedValue({
                results: [
                    { canonical_name: 'TestEntity', entity_type: expectedEntityType, entity_id: '123' }
                ]
            });

            const result = await generateCypherQuery(question, 'user_test', 'user_123', mockEnv);

            // Verification: relationship type always present
            expect(result.cypher).toContain(`-[r:${config.type}]->`);

            // Verification: correct parameterization based on query direction
            if (queryDirection === 'by_target') {
                expect(result.cypher).toContain(`(target:${expectedEntityType})`);
                expect(result.cypher).toContain('WHERE toLower(target.name) = toLower($target_name)');
            } else {
                expect(result.cypher).toContain(`(source:${expectedEntityType})`);
                expect(result.cypher).toContain('WHERE toLower(source.name) = toLower($source_name)');
            }

            expect(result.cypher).not.toContain('undefined');
            expect(result.cypher).not.toContain('null');
        });
    });
});
