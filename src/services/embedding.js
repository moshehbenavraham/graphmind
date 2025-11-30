// @ts-check
/// <reference path="../../types/cloudflare.d.ts" />
/// <reference types="@cloudflare/workers-types" />

/**
 * @typedef {Object} EmbeddingResponse
 * @property {number[]} [shape] - Shape of the embedding array
 * @property {number[][]} [data] - The embedding vectors
 * @property {'mean' | 'cls'} [pooling] - Pooling method used
 */

/**
 * The BGE embedding model identifier
 * @type {'@cf/baai/bge-base-en-v1.5'}
 */
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

/**
 * Service for generating vector embeddings using Cloudflare Workers AI.
 * Uses the BAAI BGE Base English v1.5 model which produces 768-dimensional vectors.
 */
export class EmbeddingService {
    /**
     * @param {Ai} ai - The Workers AI binding
     */
    constructor(ai) {
        /** @type {Ai} */
        this.ai = ai;
    }

    /**
     * Generates a vector embedding for the given text.
     * @param {string} text - The text to embed
     * @returns {Promise<number[]>} The embedding vector (array of numbers)
     * @throws {Error} If embedding generation fails
     */
    async generateEmbedding(text) {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            throw new Error('Text is required for embedding generation');
        }

        try {
            const response = /** @type {EmbeddingResponse} */ (
                await this.ai.run(EMBEDDING_MODEL, {
                    text: [text] // The model expects an array of strings
                })
            );

            // The response format for embeddings is { shape: [1, 768], data: [[...]] }
            if (response && response.data && response.data[0]) {
                return response.data[0];
            }

            throw new Error('Invalid response format from embedding model');
        } catch (error) {
            console.error('Embedding generation failed:', error);
            throw error;
        }
    }

    /**
     * Generates embeddings for a batch of texts.
     * @param {string[]} texts - Array of texts to embed
     * @returns {Promise<number[][]>} Array of embedding vectors
     */
    async generateEmbeddingsBatch(texts) {
        if (!Array.isArray(texts) || texts.length === 0) {
            return [];
        }

        try {
            const response = /** @type {EmbeddingResponse} */ (
                await this.ai.run(EMBEDDING_MODEL, {
                    text: texts
                })
            );

            if (response && response.data) {
                return response.data;
            }

            throw new Error('Invalid response format from embedding model');
        } catch (error) {
            console.error('Batch embedding generation failed:', error);
            throw error;
        }
    }
}
