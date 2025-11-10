/**
 * GraphMind API - Cloudflare Workers Entry Point
 * Voice-first personal knowledge assistant with GraphRAG
 */

export default {
  /**
   * Fetch handler - processes all incoming HTTP requests
   * @param {Request} request - The incoming request object
   * @param {Object} env - Environment bindings (DB, KV, AI, R2, etc.)
   * @param {Object} ctx - Execution context
   * @returns {Response} HTTP response
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Basic health check endpoint
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'graphmind-api',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        bindings: {
          database: !!env.DB,
          kv: !!env.KV,
          ai: !!env.AI,
          r2: !!env.AUDIO_BUCKET
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Detailed health check endpoint
    if (url.pathname === '/api/health') {
      try {
        // Test D1 database connectivity
        const startTime = Date.now();
        const dbTest = await env.DB.prepare('SELECT 1 as test').first();
        const dbLatency = Date.now() - startTime;

        return new Response(JSON.stringify({
          status: 'ok',
          checks: {
            database: {
              connected: !!dbTest,
              latency_ms: dbLatency
            },
            kv: {
              connected: !!env.KV
            },
            ai: {
              available: !!env.AI
            },
            r2: {
              available: !!env.AUDIO_BUCKET
            }
          }
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          status: 'error',
          message: 'Health check failed',
          error: error.message,
          checks: {
            database: {
              connected: false,
              error: error.message
            }
          }
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }

    // 404 handler for unknown routes
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
      path: url.pathname
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
