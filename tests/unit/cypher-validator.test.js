
import { describe, it, expect } from 'vitest';
import { validateCypherQuery, CypherValidationError } from '../../src/lib/graph/cypher-validator.js';

describe('Cypher Validator', () => {
    const userNamespace = 'user_test';

    it('should validate a simple valid query', () => {
        const query = "MATCH (n) RETURN n LIMIT 1";
        const result = validateCypherQuery(query, userNamespace);
        expect(result.valid).toBe(true);
    });

    it('should reject multi-statement queries', () => {
        const query = "MATCH (n) RETURN n LIMIT 1; MATCH (m) RETURN m LIMIT 1";
        expect(() => validateCypherQuery(query, userNamespace)).toThrow(CypherValidationError);
        expect(() => validateCypherQuery(query, userNamespace)).toThrow(/Multi-statement/);
    });

    it('should allow semicolons inside single quotes', () => {
        const query = "MATCH (n) WHERE n.name = 'A;B' RETURN n LIMIT 1";
        const result = validateCypherQuery(query, userNamespace);
        expect(result.valid).toBe(true);
    });

    it('should allow semicolons inside double quotes', () => {
        const query = 'MATCH (n) WHERE n.name = "A;B" RETURN n LIMIT 1';
        const result = validateCypherQuery(query, userNamespace);
        expect(result.valid).toBe(true);
    });

    it('should allow semicolons inside backticks', () => {
        const query = "MATCH (n:`Label;With;Semicolon`) RETURN n LIMIT 1";
        const result = validateCypherQuery(query, userNamespace);
        expect(result.valid).toBe(true);
    });

    it('should allow trailing semicolon', () => {
        const query = "MATCH (n) RETURN n LIMIT 1;";
        const result = validateCypherQuery(query, userNamespace);
        expect(result.valid).toBe(true);
    });

    it('should reject destructive operations', () => {
        const query = "MATCH (n) DELETE n";
        expect(() => validateCypherQuery(query, userNamespace)).toThrow(/Destructive operation/);
    });

    it('should require LIMIT clause', () => {
        const query = "MATCH (n) RETURN n";
        expect(() => validateCypherQuery(query, userNamespace)).toThrow(/LIMIT clause/);
    });
});
