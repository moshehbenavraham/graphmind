/**
 * Test Endpoint: Manually Trigger Graph Sync
 *
 * Temporary endpoint for testing graph sync functionality (T051)
 * Sends a message to the graph-sync-jobs queue
 */

/**
 * Trigger graph sync for a specific voice note
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Promise<Response>} JSON response
 */
export async function handleTriggerGraphSync(request, env) {
  try {
    // Parse request body
    const { userId, noteId } = await request.json();

    if (!userId || !noteId) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: userId, noteId'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Send message to graph-sync-jobs queue
    await env.GRAPH_SYNC_QUEUE.send({
      userId,
      noteId
    });

    console.log('[TestTriggerGraphSync] Queued graph sync:', { userId, noteId });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Graph sync queued successfully',
        data: {
          userId,
          noteId,
          queueName: 'graph-sync-jobs'
        }
      }),
      {
        status: 202, // Accepted
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[TestTriggerGraphSync] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
