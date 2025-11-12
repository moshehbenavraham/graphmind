/**
 * POST /api/graph/sync - Manually trigger graph sync for a voice note
 *
 * Allows users to manually re-sync a voice note to the knowledge graph.
 * Useful for:
 * - Retrying failed syncs
 * - Re-syncing after entity extraction updates
 * - Forcing graph update for specific notes
 *
 * Rate limit: 5 requests/minute per user
 *
 * @module api/graph/sync-note
 */

/**
 * Handle POST /api/graph/sync
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment bindings
 * @param {Object} ctx - Execution context
 * @returns {Response} - HTTP response
 */
export async function handleSyncNote(request, env, ctx) {
  const startTime = Date.now();

  try {
    // Extract user_id from JWT (assume validateJWT middleware already ran)
    const userId = request.user?.user_id || request.userId;

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Valid JWT token required'
          }
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Rate limiting: 5 requests/minute per user
    const rateLimitKey = `rate_limit:graph_sync:${userId}`;
    const rateLimitCount = await env.GRAPHMIND_KV.get(rateLimitKey);

    if (rateLimitCount && parseInt(rateLimitCount) >= 5) {
      console.warn('[SyncNote] Rate limit exceeded:', { userId });
      return new Response(
        JSON.stringify({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many sync requests. Limit: 5 per minute',
            details: {
              retry_after_seconds: 60
            }
          }
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60'
          }
        }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request body must be valid JSON',
            details: { expected_format: { note_id: 'string' } }
          }
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { note_id } = body;

    if (!note_id || typeof note_id !== 'string') {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'note_id is required and must be a string',
            details: {
              field: 'note_id',
              expected_type: 'string'
            }
          }
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[SyncNote] Manual sync requested:', { userId, noteId: note_id });

    // Verify note exists and belongs to user
    const noteQuery = await env.GRAPHMIND_DB.prepare(
      `SELECT note_id, extraction_status, graph_sync_status, entities_extracted
       FROM voice_notes
       WHERE note_id = ? AND user_id = ?`
    ).bind(note_id, userId).first();

    if (!noteQuery) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'NOTE_NOT_FOUND',
            message: 'Voice note not found',
            details: {
              note_id: note_id,
              hint: 'Note does not exist or does not belong to authenticated user'
            }
          }
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate extraction is complete
    if (noteQuery.extraction_status !== 'completed') {
      return new Response(
        JSON.stringify({
          error: {
            code: 'EXTRACTION_INCOMPLETE',
            message: 'Entity extraction must be completed before graph sync',
            details: {
              note_id: note_id,
              current_status: noteQuery.extraction_status,
              hint: 'Wait for entity extraction to complete, or trigger manual extraction first'
            }
          }
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate entities exist
    if (!noteQuery.entities_extracted) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'NO_ENTITIES',
            message: 'No entities extracted from voice note',
            details: {
              note_id: note_id,
              hint: 'Note has no extractable entities, graph sync not needed'
            }
          }
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse entity count for response
    let entityCount = 0;
    try {
      const entities = JSON.parse(noteQuery.entities_extracted);
      entityCount = Array.isArray(entities) ? entities.length : 0;
    } catch (error) {
      console.warn('[SyncNote] Could not parse entities_extracted:', error);
    }

    // Enqueue graph sync job
    const queueBinding = env.GRAPH_SYNC_JOBS || env.GRAPH_SYNC_QUEUE;
    if (!queueBinding) {
      console.error('[SyncNote] Queue binding not found');
      return new Response(
        JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Queue service not configured',
            details: { hint: 'Contact administrator' }
          }
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    await queueBinding.send({
      user_id: userId,
      note_id: note_id,
      triggered_by: 'manual_api',
      timestamp: Date.now()
    });

    // Update note status to 'pending' in D1
    await env.GRAPHMIND_DB.prepare(
      `UPDATE voice_notes
       SET graph_sync_status = 'pending',
           graph_sync_error = NULL
       WHERE note_id = ? AND user_id = ?`
    ).bind(note_id, userId).run();

    // Update rate limit counter
    const currentCount = parseInt(rateLimitCount || '0');
    await env.GRAPHMIND_KV.put(
      rateLimitKey,
      (currentCount + 1).toString(),
      { expirationTtl: 60 } // 60 seconds TTL
    );

    console.log('[SyncNote] Queued graph sync job:', {
      userId,
      noteId: note_id,
      entityCount,
      previousStatus: noteQuery.graph_sync_status
    });

    // Calculate estimated completion time (5 seconds avg)
    const estimatedCompletionMs = Date.now() + 5000;
    const estimatedCompletion = new Date(estimatedCompletionMs).toISOString();
    const messageId = `sync_${note_id}_${Date.now()}`;

    // Return 202 Accepted with job details
    return new Response(
      JSON.stringify({
        data: {
          sync_job_id: messageId,
          note_id: note_id,
          status: 'queued',
          entity_count: entityCount,
          estimated_completion: estimatedCompletion,
          estimated_duration_ms: 5000,
          previous_sync_status: noteQuery.graph_sync_status
        },
        meta: {
          query_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      }),
      {
        status: 202, // Accepted
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[SyncNote] Error:', error);

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to trigger graph sync',
          details: {
            error: error.message,
            hint: 'Check server logs for details'
          }
        }
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
