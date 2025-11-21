
import { describe, it, expect } from 'vitest';
import { generateEmptyResponse } from '../../src/prompts/answer-generation.js';

describe('Error Message Generation', () => {
    it('should extract entity from "Who works at GraftMind?"', () => {
        const question = 'Who works at GraftMind?';
        const response = generateEmptyResponse(question);
        expect(response).toContain('GraftMind');
        expect(response).not.toContain('Who');
    });

    it('should extract entity from "Tell me about GraphMind"', () => {
        const question = 'Tell me about GraphMind';
        const response = generateEmptyResponse(question);
        expect(response).toContain('GraphMind');
    });

    it('should handle quoted entities', () => {
        const question = 'What do you know about "Project X"?';
        const response = generateEmptyResponse(question);
        expect(response).toContain('Project X');
    });

    it('should fallback to "that" if no entity found', () => {
        const question = 'What is it?';
        const response = generateEmptyResponse(question);
        expect(response).toContain('that');
    });

    it('should extract non-stop words like "happening"', () => {
        const question = 'What is happening?';
        const response = generateEmptyResponse(question);
        expect(response).toContain('happening');
    });
});
