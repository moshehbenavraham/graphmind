/**
 * Unit Tests: Entity Resolution Service
 * Feature: 005-entity-extraction
 *
 * Tests entity resolution logic including:
 * - KV cache hit/miss scenarios
 * - D1 entity_cache lookups
 * - Entity creation and updates
 * - Fuzzy matching and alias resolution
 * - Batch processing
 * - Statistics calculation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveEntity,
  resolveEntitiesBatch,
  findEntityByAlias,
  addAlias,
  getResolutionStats,
  mergeEntityProperties,
} from '../src/services/entity-resolution.service.js';

// Mock dependencies
vi.mock('../src/lib/entity-utils/entity-key-generator.js', () => ({
  generateEntityKey: vi.fn((name) => name.toLowerCase().replace(/\s+/g, '-')),
  generateAliases: vi.fn((name) => {
    // Mimic actual behavior from entity-key-generator.js
    const aliases = new Set();
    const trimmedName = name.trim();
    aliases.add(trimmedName);
    aliases.add(trimmedName.toLowerCase());
    const words = trimmedName.split(/\s+/);
    if (words.length > 1) {
      aliases.add(words[0]);
    }
    return Array.from(aliases);
  }),
}));

vi.mock('../src/lib/kv/entity-cache-utils.js', () => ({
  getEntityFromCache: vi.fn(),
  setEntityInCache: vi.fn(),
}));

vi.mock('../src/lib/db/entity-cache-queries.js', () => ({
  getEntityByKey: vi.fn(),
  createEntity: vi.fn(),
  updateEntityMention: vi.fn(),
  addEntityAlias: vi.fn(),
}));

// Import mocked functions for testing
import { generateEntityKey, generateAliases } from '../src/lib/entity-utils/entity-key-generator.js';
import { getEntityFromCache, setEntityInCache } from '../src/lib/kv/entity-cache-utils.js';
import {
  getEntityByKey,
  createEntity,
  updateEntityMention,
  addEntityAlias,
} from '../src/lib/db/entity-cache-queries.js';

describe('Entity Resolution Service', () => {
  let mockEnv;
  const userId = 'user123';
  const noteId = 'note_abc';

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup mock environment
    mockEnv = {
      KV: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: vi.fn(),
            run: vi.fn(),
            all: vi.fn(),
          })),
        })),
      },
    };
  });

  describe('resolveEntity()', () => {
    it('should throw error if entity missing name', async () => {
      const entity = { type: 'Person' };

      await expect(
        resolveEntity(mockEnv, userId, entity, noteId)
      ).rejects.toThrow('Entity must have name and type');
    });

    it('should throw error if entity missing type', async () => {
      const entity = { name: 'Sarah Johnson' };

      await expect(
        resolveEntity(mockEnv, userId, entity, noteId)
      ).rejects.toThrow('Entity must have name and type');
    });

    it('should resolve from KV cache (cache hit)', async () => {
      const entity = {
        name: 'Sarah Johnson',
        type: 'Person',
        confidence: 0.92,
        properties: { role: 'Manager' },
      };

      const cachedEntity = {
        canonical_name: 'Sarah Johnson',
        entity_type: 'Person',
        properties: { role: 'Manager' },
        aliases: ['Sarah', 'sarah johnson'],
      };

      // Mock KV cache hit
      getEntityFromCache.mockResolvedValue(cachedEntity);
      updateEntityMention.mockResolvedValue(true);

      const result = await resolveEntity(mockEnv, userId, entity, noteId);

      expect(result).toEqual({
        ...entity,
        canonical_name: 'Sarah Johnson',
        entity_key: 'sarah-johnson',
        cache_hit: true,
      });

      expect(getEntityFromCache).toHaveBeenCalledWith(
        mockEnv.KV,
        userId,
        'sarah-johnson'
      );
      expect(updateEntityMention).toHaveBeenCalledWith(
        mockEnv.DB,
        'sarah-johnson',
        userId,
        noteId,
        0.92
      );
      expect(getEntityByKey).not.toHaveBeenCalled(); // D1 not queried on cache hit
    });

    it('should resolve from D1 and warm cache (cache miss, DB hit)', async () => {
      const entity = {
        name: 'FastAPI Migration',
        type: 'Project',
        confidence: 0.88,
        properties: { status: 'in_progress' },
      };

      const dbEntity = {
        canonical_name: 'FastAPI Migration Project',
        entity_type: 'Project',
        properties: { description: 'Migrating to FastAPI' },
        aliases: ['FastAPI Migration', 'fastapi-migration'],
      };

      // Mock KV cache miss
      getEntityFromCache.mockResolvedValue(null);
      // Mock D1 hit
      getEntityByKey.mockResolvedValue(dbEntity);
      updateEntityMention.mockResolvedValue(true);
      setEntityInCache.mockResolvedValue(true);

      const result = await resolveEntity(mockEnv, userId, entity, noteId);

      expect(result).toEqual({
        ...entity,
        canonical_name: 'FastAPI Migration Project',
        entity_key: 'fastapi-migration',
        cache_hit: false,
        db_hit: true,
      });

      expect(getEntityFromCache).toHaveBeenCalled();
      expect(getEntityByKey).toHaveBeenCalledWith(
        mockEnv.DB,
        'fastapi-migration',
        userId
      );
      expect(updateEntityMention).toHaveBeenCalled();
      expect(setEntityInCache).toHaveBeenCalledWith(
        mockEnv.KV,
        userId,
        'fastapi-migration',
        {
          canonical_name: 'FastAPI Migration Project',
          entity_type: 'Project',
          properties: { description: 'Migrating to FastAPI' },
          aliases: ['FastAPI Migration', 'fastapi-migration'],
        }
      );
    });

    it('should create new entity if not found (cache miss, DB miss)', async () => {
      const entity = {
        name: 'TechCorp',
        type: 'Organization',
        confidence: 0.85,
        properties: { industry: 'Technology' },
      };

      const newEntity = {
        cache_id: 1,
        entity_key: 'techcorp',
        user_id: userId,
        canonical_name: 'TechCorp',
        entity_type: 'Organization',
        aliases: ['TechCorp', 'techcorp', 'Tech'],
        properties: { industry: 'Technology' },
        confidence: 0.85,
        first_mentioned_note_id: noteId,
        last_mentioned_note_id: noteId,
        mention_count: 1,
      };

      // Mock cache miss
      getEntityFromCache.mockResolvedValue(null);
      // Mock D1 miss
      getEntityByKey.mockResolvedValue(null);
      // Mock entity creation
      createEntity.mockResolvedValue(newEntity);
      setEntityInCache.mockResolvedValue(true);

      const result = await resolveEntity(mockEnv, userId, entity, noteId);

      expect(result).toEqual({
        ...entity,
        canonical_name: 'TechCorp',
        entity_key: 'techcorp',
        cache_hit: false,
        db_hit: false,
        new_entity: true,
      });

      expect(createEntity).toHaveBeenCalledWith(mockEnv.DB, {
        entityKey: 'techcorp',
        userId,
        canonicalName: 'TechCorp',
        entityType: 'Organization',
        aliases: ['TechCorp', 'techcorp'], // Single word: no first-word alias generated
        properties: { industry: 'Technology' },
        confidence: 0.85,
        noteId,
      });

      expect(setEntityInCache).toHaveBeenCalled();
    });

    it('should handle entity with no properties', async () => {
      const entity = {
        name: 'Python',
        type: 'Technology',
        confidence: 0.95,
      };

      const newEntity = {
        cache_id: 2,
        entity_key: 'python',
        user_id: userId,
        canonical_name: 'Python',
        entity_type: 'Technology',
        aliases: ['Python', 'python'],
        properties: {},
        confidence: 0.95,
        first_mentioned_note_id: noteId,
        last_mentioned_note_id: noteId,
        mention_count: 1,
      };

      getEntityFromCache.mockResolvedValue(null);
      getEntityByKey.mockResolvedValue(null);
      createEntity.mockResolvedValue(newEntity);
      setEntityInCache.mockResolvedValue(true);

      const result = await resolveEntity(mockEnv, userId, entity, noteId);

      expect(result.canonical_name).toBe('Python');
      expect(createEntity).toHaveBeenCalledWith(mockEnv.DB, {
        entityKey: 'python',
        userId,
        canonicalName: 'Python',
        entityType: 'Technology',
        aliases: ['Python', 'python'],
        properties: {},
        confidence: 0.95,
        noteId,
      });
    });
  });

  describe('resolveEntitiesBatch()', () => {
    it('should throw error if entities is not an array', async () => {
      await expect(
        resolveEntitiesBatch(mockEnv, userId, 'not-an-array', noteId)
      ).rejects.toThrow('Entities must be an array');
    });

    it('should resolve multiple entities successfully', async () => {
      const entities = [
        { name: 'Sarah Johnson', type: 'Person', confidence: 0.92 },
        { name: 'FastAPI', type: 'Technology', confidence: 0.95 },
      ];

      // Mock cache hits for both entities
      getEntityFromCache.mockImplementation((kv, uid, key) => {
        if (key === 'sarah-johnson') {
          return Promise.resolve({
            canonical_name: 'Sarah Johnson',
            entity_type: 'Person',
            properties: {},
            aliases: ['Sarah'],
          });
        }
        if (key === 'fastapi') {
          return Promise.resolve({
            canonical_name: 'FastAPI',
            entity_type: 'Technology',
            properties: {},
            aliases: ['FastAPI'],
          });
        }
        return Promise.resolve(null);
      });

      updateEntityMention.mockResolvedValue(true);

      const results = await resolveEntitiesBatch(mockEnv, userId, entities, noteId);

      expect(results).toHaveLength(2);
      expect(results[0].canonical_name).toBe('Sarah Johnson');
      expect(results[1].canonical_name).toBe('FastAPI');
      expect(results[0].cache_hit).toBe(true);
      expect(results[1].cache_hit).toBe(true);
    });

    it('should handle partial failures gracefully', async () => {
      const entities = [
        { name: 'Valid Entity', type: 'Person', confidence: 0.92 },
        { name: 'Invalid Entity', type: 'Person', confidence: 0.88 },
      ];

      // Mock first entity succeeds
      getEntityFromCache.mockImplementation((kv, uid, key) => {
        if (key === 'valid-entity') {
          return Promise.resolve({
            canonical_name: 'Valid Entity',
            entity_type: 'Person',
            properties: {},
            aliases: [],
          });
        }
        // Second entity throws error
        throw new Error('Database error');
      });

      updateEntityMention.mockResolvedValue(true);

      const results = await resolveEntitiesBatch(mockEnv, userId, entities, noteId);

      expect(results).toHaveLength(2);
      expect(results[0].canonical_name).toBe('Valid Entity');
      expect(results[1].resolution_error).toBe('Database error');
    });

    it('should handle empty array', async () => {
      const results = await resolveEntitiesBatch(mockEnv, userId, [], noteId);
      expect(results).toEqual([]);
    });
  });

  describe('findEntityByAlias()', () => {
    it('should find entity from KV cache', async () => {
      const aliasName = 'Sarah';
      const cachedEntity = {
        canonical_name: 'Sarah Johnson',
        entity_type: 'Person',
        properties: { role: 'Manager' },
        aliases: ['Sarah', 'Sarah J', 'SJ'],
      };

      getEntityFromCache.mockResolvedValue(cachedEntity);

      const result = await findEntityByAlias(mockEnv, userId, aliasName);

      expect(result).toEqual(cachedEntity);
      expect(getEntityFromCache).toHaveBeenCalledWith(
        mockEnv.KV,
        userId,
        'sarah'
      );
      expect(getEntityByKey).not.toHaveBeenCalled();
    });

    it('should find entity from D1 and warm cache', async () => {
      const aliasName = 'JS';
      const dbEntity = {
        canonical_name: 'JavaScript',
        entity_type: 'Technology',
        properties: {},
        aliases: ['JavaScript', 'JS', 'js'],
      };

      getEntityFromCache.mockResolvedValue(null);
      getEntityByKey.mockResolvedValue(dbEntity);
      setEntityInCache.mockResolvedValue(true);

      const result = await findEntityByAlias(mockEnv, userId, aliasName);

      expect(result).toEqual(dbEntity);
      expect(getEntityByKey).toHaveBeenCalledWith(mockEnv.DB, 'js', userId);
      expect(setEntityInCache).toHaveBeenCalledWith(
        mockEnv.KV,
        userId,
        'js',
        dbEntity
      );
    });

    it('should return null if entity not found', async () => {
      getEntityFromCache.mockResolvedValue(null);
      getEntityByKey.mockResolvedValue(null);

      const result = await findEntityByAlias(mockEnv, userId, 'Unknown');

      expect(result).toBeNull();
    });
  });

  describe('addAlias()', () => {
    it('should throw error if alias is invalid', async () => {
      await expect(
        addAlias(mockEnv, userId, 'entity-key', '')
      ).rejects.toThrow('Alias must be a non-empty string');

      await expect(
        addAlias(mockEnv, userId, 'entity-key', null)
      ).rejects.toThrow('Alias must be a non-empty string');
    });

    it('should add alias and invalidate cache', async () => {
      const entityKey = 'sarah-johnson';
      const newAlias = 'SJ';
      const cachedEntity = {
        canonical_name: 'Sarah Johnson',
        entity_type: 'Person',
        properties: {},
        aliases: ['Sarah', 'Sarah J'],
      };
      const updatedEntity = {
        canonical_name: 'Sarah Johnson',
        entity_type: 'Person',
        properties: {},
        aliases: ['Sarah', 'Sarah J', 'SJ'],
      };

      addEntityAlias.mockResolvedValue(true);
      getEntityFromCache.mockResolvedValue(cachedEntity);
      getEntityByKey.mockResolvedValue(updatedEntity);
      setEntityInCache.mockResolvedValue(true);

      const result = await addAlias(mockEnv, userId, entityKey, newAlias);

      expect(result).toBe(true);
      expect(addEntityAlias).toHaveBeenCalledWith(
        mockEnv.DB,
        entityKey,
        userId,
        newAlias
      );
      expect(setEntityInCache).toHaveBeenCalledWith(
        mockEnv.KV,
        userId,
        entityKey,
        updatedEntity
      );
    });

    it('should return false if D1 update fails', async () => {
      addEntityAlias.mockResolvedValue(false);

      const result = await addAlias(mockEnv, userId, 'entity-key', 'NewAlias');

      expect(result).toBe(false);
      expect(setEntityInCache).not.toHaveBeenCalled();
    });

    it('should skip cache update if entity not cached', async () => {
      const entityKey = 'new-entity';
      const newAlias = 'Alias';

      addEntityAlias.mockResolvedValue(true);
      getEntityFromCache.mockResolvedValue(null); // Not in cache

      const result = await addAlias(mockEnv, userId, entityKey, newAlias);

      expect(result).toBe(true);
      expect(getEntityByKey).not.toHaveBeenCalled();
      expect(setEntityInCache).not.toHaveBeenCalled();
    });
  });

  describe('getResolutionStats()', () => {
    it('should calculate statistics correctly', () => {
      const resolvedEntities = [
        { name: 'Entity 1', cache_hit: true },
        { name: 'Entity 2', cache_hit: false, db_hit: true },
        { name: 'Entity 3', cache_hit: true },
        { name: 'Entity 4', cache_hit: false, db_hit: false, new_entity: true },
        { name: 'Entity 5', resolution_error: 'Failed' },
      ];

      const stats = getResolutionStats(resolvedEntities);

      expect(stats).toEqual({
        total: 5,
        cache_hits: 2,
        db_hits: 1,
        new_entities: 1,
        errors: 1,
        cache_hit_rate: 0.4, // 2/5 = 0.4
      });
    });

    it('should handle empty array', () => {
      const stats = getResolutionStats([]);

      expect(stats).toEqual({
        total: 0,
        cache_hits: 0,
        db_hits: 0,
        new_entities: 0,
        errors: 0,
        cache_hit_rate: 0,
      });
    });

    it('should handle non-array input', () => {
      const stats = getResolutionStats('not-an-array');

      expect(stats).toEqual({
        total: 0,
        cache_hits: 0,
        db_hits: 0,
        new_entities: 0,
        errors: 0,
        cache_hit_rate: 0,
      });
    });

    it('should calculate 100% hit rate', () => {
      const resolvedEntities = [
        { name: 'Entity 1', cache_hit: true },
        { name: 'Entity 2', cache_hit: true },
        { name: 'Entity 3', cache_hit: true },
      ];

      const stats = getResolutionStats(resolvedEntities);

      expect(stats.cache_hit_rate).toBe(1.0);
    });

    it('should round hit rate to 3 decimal places', () => {
      const resolvedEntities = [
        { name: 'Entity 1', cache_hit: true },
        { name: 'Entity 2', cache_hit: false },
        { name: 'Entity 3', cache_hit: false },
      ];

      const stats = getResolutionStats(resolvedEntities);

      expect(stats.cache_hit_rate).toBe(0.333); // 1/3 rounded to 3 decimals
    });
  });

  describe('mergeEntityProperties()', () => {
    it('should merge properties correctly', () => {
      const existing = {
        name: 'Sarah Johnson',
        role: 'Manager',
        email: 'sarah@example.com',
      };

      const newProps = {
        role: 'Senior Manager', // Update
        phone: '555-1234',       // Add
      };

      const merged = mergeEntityProperties(existing, newProps);

      expect(merged).toEqual({
        name: 'Sarah Johnson',
        role: 'Senior Manager',
        email: 'sarah@example.com',
        phone: '555-1234',
      });
    });

    it('should handle null existing properties', () => {
      const newProps = { key: 'value' };
      const merged = mergeEntityProperties(null, newProps);

      expect(merged).toEqual(newProps);
    });

    it('should handle null new properties', () => {
      const existing = { key: 'value' };
      const merged = mergeEntityProperties(existing, null);

      expect(merged).toEqual(existing);
    });

    it('should handle both null', () => {
      const merged = mergeEntityProperties(null, null);
      expect(merged).toEqual({});
    });

    it('should handle empty objects', () => {
      const merged = mergeEntityProperties({}, {});
      expect(merged).toEqual({});
    });

    it('should not mutate original objects', () => {
      const existing = { name: 'Original' };
      const newProps = { role: 'New' };

      const merged = mergeEntityProperties(existing, newProps);

      expect(existing).toEqual({ name: 'Original' });
      expect(newProps).toEqual({ role: 'New' });
      expect(merged).toEqual({ name: 'Original', role: 'New' });
    });

    it('should handle non-object inputs gracefully', () => {
      const merged = mergeEntityProperties('not-object', { key: 'value' });
      expect(merged).toEqual({ key: 'value' });
    });
  });

  describe('Integration: Full Resolution Flow', () => {
    it('should handle complete resolution flow with caching', async () => {
      // First mention of "Sarah" - creates new entity
      const firstMention = {
        name: 'Sarah Johnson',
        type: 'Person',
        confidence: 0.92,
        properties: { role: 'Manager' },
      };

      getEntityFromCache.mockResolvedValueOnce(null); // Cache miss
      getEntityByKey.mockResolvedValueOnce(null);     // DB miss
      createEntity.mockResolvedValueOnce({
        cache_id: 1,
        entity_key: 'sarah-johnson',
        user_id: userId,
        canonical_name: 'Sarah Johnson',
        entity_type: 'Person',
        aliases: ['Sarah Johnson', 'sarah johnson', 'Sarah'],
        properties: { role: 'Manager' },
        confidence: 0.92,
        first_mentioned_note_id: noteId,
        last_mentioned_note_id: noteId,
        mention_count: 1,
      });
      setEntityInCache.mockResolvedValue(true);

      const firstResult = await resolveEntity(mockEnv, userId, firstMention, noteId);

      expect(firstResult.new_entity).toBe(true);
      expect(firstResult.cache_hit).toBe(false);

      // Second mention of "Sarah" (just first name) - resolves from cache
      const secondMention = {
        name: 'Sarah',
        type: 'Person',
        confidence: 0.88,
      };

      getEntityFromCache.mockResolvedValueOnce({
        canonical_name: 'Sarah Johnson',
        entity_type: 'Person',
        properties: { role: 'Manager' },
        aliases: ['Sarah Johnson', 'sarah johnson', 'Sarah'],
      });
      updateEntityMention.mockResolvedValue(true);

      // Mock entity key generator to normalize "Sarah" to "sarah"
      generateEntityKey.mockReturnValueOnce('sarah');

      const secondResult = await resolveEntity(mockEnv, userId, secondMention, 'note_def');

      expect(secondResult.cache_hit).toBe(true);
      expect(secondResult.canonical_name).toBe('Sarah Johnson');
      expect(updateEntityMention).toHaveBeenCalledWith(
        mockEnv.DB,
        'sarah',
        userId,
        'note_def',
        0.88
      );
    });
  });
});
