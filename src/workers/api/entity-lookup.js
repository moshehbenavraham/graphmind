/**
 * Entity Lookup API Endpoints
 * Feature: 005-entity-extraction
 *
 * GET /api/notes/:note_id/entities - View extracted entities for a note
 * GET /api/entities/cache/:entity_key - Entity resolution lookup
 */

import { getEntityByKey } from '../../lib/db/entity-cache-queries.js';
import { getEntityFromCache } from '../../lib/kv/entity-cache-utils.js';
import { generateEntityKey } from '../../lib/entity-utils/entity-key-generator.js';

/**
 * GET /api/notes/:note_id/entities
 * Get extracted entities for a voice note
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} params - URL parameters
 * @param {string} params.userId - User ID from JWT
 * @param {string} params.noteId - Note ID from URL
 * @returns {Response} HTTP response
 */
export async function getEntitiesForNote(request, env, params) {
  const { userId, noteId } = params;

  try {
    // Fetch note with entities
    const note = await getNoteWithEntities(env.DB, noteId, userId);

    if (!note) {
      return jsonResponse({ success: false, error: 'Note not found' }, 404);
    }

    // Parse entities JSON
    const entities = note.entities_extracted
      ? JSON.parse(note.entities_extracted)
      : { entities: [], extraction_metadata: null };

    // Return response
    return jsonResponse({
      success: true,
      data: {
        note_id: noteId,
        extraction_status: note.extraction_status,
        extraction_completed_at: note.extraction_completed_at,
        entities: entities.entities || [],
        metadata: entities.extraction_metadata || null,
      },
    });
  } catch (error) {
    console.error('Get entities error:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * GET /api/entities/cache/:entity_key
 * Lookup entity in cache by key
 *
 * Query params:
 * - name: Entity name (alternative to entity_key)
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} params - Parameters
 * @param {string} params.userId - User ID from JWT
 * @param {string} params.entityKey - Entity key from URL (optional)
 * @returns {Response} HTTP response
 */
export async function lookupEntityCache(request, env, params) {
  const { userId, entityKey: urlEntityKey } = params;

  try {
    // Get entity key from URL or query params
    const url = new URL(request.url);
    const nameParam = url.searchParams.get('name');

    let entityKey = urlEntityKey;

    // If name provided, generate key
    if (!entityKey && nameParam) {
      entityKey = generateEntityKey(nameParam);
    }

    if (!entityKey) {
      return jsonResponse({
        success: false,
        error: 'entity_key required in URL or name in query params',
      }, 400);
    }

    // Step 1: Check KV cache
    const cached = await getEntityFromCache(env.KV, userId, entityKey);

    if (cached) {
      return jsonResponse({
        success: true,
        data: {
          entity_key: entityKey,
          canonical_name: cached.canonical_name,
          entity_type: cached.entity_type,
          properties: cached.properties,
          aliases: cached.aliases,
          source: 'kv_cache',
        },
      });
    }

    // Step 2: Check D1 entity_cache
    const dbEntity = await getEntityByKey(env.DB, entityKey, userId);

    if (dbEntity) {
      return jsonResponse({
        success: true,
        data: {
          entity_key: dbEntity.entity_key,
          canonical_name: dbEntity.canonical_name,
          entity_type: dbEntity.entity_type,
          properties: dbEntity.properties,
          aliases: dbEntity.aliases,
          mention_count: dbEntity.mention_count,
          first_mentioned: dbEntity.first_mentioned_note_id,
          last_mentioned: dbEntity.last_mentioned_note_id,
          source: 'd1_cache',
        },
      });
    }

    // Not found
    return jsonResponse({
      success: false,
      error: 'Entity not found in cache',
    }, 404);
  } catch (error) {
    console.error('Lookup entity cache error:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * Helper: Get note with entities from D1
 */
async function getNoteWithEntities(db, noteId, userId) {
  const query = `
    SELECT
      note_id,
      user_id,
      extraction_status,
      extraction_completed_at,
      entities_extracted
    FROM voice_notes
    WHERE note_id = ? AND user_id = ? AND is_deleted = 0
    LIMIT 1
  `;

  return await db.prepare(query).bind(noteId, userId).first();
}

/**
 * Helper: JSON response
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
