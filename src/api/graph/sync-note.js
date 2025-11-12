/**
 * POST /api/graph/sync
 *
 * Manually trigger graph sync for a specific voice note.
 * Enqueues a graph-sync-jobs message for background processing.
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
  try {
    // Parse request body
    const body = await request.json();
    const { note_id } = body;

    if (!note_id) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Missing required field: note_id'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Extract user_id from JWT (assume validateJWT middleware already ran)
    const userId = request.user?.user_id;

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Valid JWT token required'
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[SyncNote] Manual sync requested:', { userId, noteId: note_id });

    // Verify note exists and belongs to user
    const noteQuery = await env.DB.prepare(
      `SELECT note_id, extraction_status, graph_sync_status
       FROM voice_notes
       WHERE note_id = ? AND user_id = ?`
    ).bind(note_id, userId).first();

    if (!noteQuery) {
      return new Response(
        JSON.stringify({
          error: 'Not Found',
          message: 'Voice note not found or does not belong to user'
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
          error: 'Bad Request',
          message: `Cannot sync note - extraction_status is ${noteQuery.extraction_status}, must be 'completed'`
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Enqueue graph sync job
    await env.GRAPH_SYNC_QUEUE.send({
      userId,
      noteId: note_id
    });

    console.log('[SyncNote] Queued graph sync job:', { userId, noteId: note_id });

    // Return 202 Accepted with job details
    const estimatedCompletion = new Date(Date.now() + 5000).toISOString(); // Estimate 5s

    return new Response(
      JSON.stringify({
        data: {
          sync_job_id: `${userId}_${note_id}_${Date.now()}`,
          status: 'queued',
          estimated_completion: estimatedCompletion,
          note_id,
          current_status: noteQuery.graph_sync_status
        }
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[SyncNote] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error.message || 'Failed to trigger graph sync'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
