/**
 * POST /api/notes/start-recording
 *
 * Create a new voice recording session and return WebSocket URL.
 *
 * Tasks: T026-T032
 * - T026: Validate JWT (handled by requireAuth middleware)
 * - T027: Generate session_id using generateSessionId()
 * - T028: Create Durable Object stub for VoiceSessionManager
 * - T029: Store session metadata in KV with 1-hour TTL
 * - T030: Return WebSocket URL with session_id
 * - T031: Include rate limiting (10/hour per user)
 * - T032: Return appropriate error responses
 *
 * @module workers/api/notes/start-recording
 */

import { generateSessionId, createSession } from '../../../lib/session/session-manager.js';
import { requireAuth } from '../../../middleware/auth.js';
import { rateLimitMiddleware } from '../../../middleware/rateLimit.js';
import { badRequestError, internalServerError } from '../../../utils/errors.js';
import { createLogger } from '../../../utils/logger.js';

/**
 * Maximum recording duration in seconds (10 minutes)
 */
const MAX_DURATION_SECONDS = 600;

/**
 * Handle POST /api/notes/start-recording
 *
 * Creates a new recording session with:
 * - Unique session ID
 * - Durable Object instance for WebSocket management
 * - Session metadata stored in KV
 * - WebSocket URL for client connection
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Worker environment bindings
 * @param {Object} env.KV - KV namespace for session storage
 * @param {Object} env.VOICE_SESSION - Durable Object binding for VoiceSessionManager
 * @param {Object} env.RATE_LIMIT - KV namespace for rate limiting
 * @returns {Promise<Response>} JSON response with session details or error
 *
 * Response format:
 * {
 *   "session_id": "sess_...",
 *   "websocket_url": "wss://[worker-domain]/ws/notes/sess_...",
 *   "expires_at": "ISO timestamp",
 *   "max_duration_seconds": 600
 * }
 */
export async function handleStartRecording(request, env) {
  const logger = createLogger('API:StartRecording');

  try {
    // T026: Validate JWT and get user context (via requireAuth middleware)
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      logger.warn('Authentication failed');
      return authResult;
    }
    const user = authResult;

    // Add user context to logger
    logger.baseContext.user_id = user.user_id;

    // T031: Check rate limit (10 requests per hour per user)
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      env,
      'notes:start-recording',
      user.user_id
    );
    if (rateLimitResponse) {
      logger.warn('Rate limit exceeded');
      return rateLimitResponse;
    }

    // Parse request body (optional audio configuration)
    let audioConfig = {
      sample_rate: 16000,
      channels: 1,
      format: 'pcm'
    };

    try {
      const body = await request.json();
      if (body.audio_config) {
        // Validate and merge audio config
        audioConfig = {
          ...audioConfig,
          ...body.audio_config
        };

        // Validate audio config parameters
        if (audioConfig.sample_rate !== 16000) {
          return badRequestError('Invalid sample_rate: must be 16000 Hz');
        }
        if (audioConfig.channels !== 1) {
          return badRequestError('Invalid channels: must be 1 (mono)');
        }
        if (audioConfig.format !== 'pcm') {
          return badRequestError('Invalid format: must be "pcm"');
        }
      }
    } catch (error) {
      // Body parsing failed or empty - use defaults
      // This is acceptable, audio_config is optional
    }

    // T027: Generate unique session ID
    const sessionId = generateSessionId();

    // T029: Store session metadata in KV with 1-hour TTL
    try {
      await createSession(env, user.user_id, sessionId);
      logger.info('Session created', { session_id: sessionId });
    } catch (error) {
      logger.error('Failed to create session in KV', error);
      return internalServerError('Failed to create recording session');
    }

    // T028: Create Durable Object stub for VoiceSessionManager
    // Note: We don't initialize the DO here, it will be initialized when
    // the WebSocket connection is established at /ws/notes/:session_id
    try {
      // Get DO stub to verify it's accessible
      const id = env.VOICE_SESSION.idFromName(sessionId);
      const stub = env.VOICE_SESSION.get(id);

      // Verify stub is valid (doesn't make a request, just checks binding)
      if (!stub) {
        throw new Error('Failed to get Durable Object stub');
      }

      logger.debug('Durable Object stub created', { session_id: sessionId });
    } catch (error) {
      logger.error('Failed to create DO stub', error);
      return internalServerError('Failed to initialize session manager');
    }

    // T030: Build WebSocket URL
    // Extract domain from request URL
    const url = new URL(request.url);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const websocketUrl = `${protocol}//${url.host}/ws/notes/${sessionId}`;

    // Calculate expiration time (1 hour from now)
    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    logger.info('Recording session started successfully', {
      session_id: sessionId,
      websocket_url: websocketUrl
    });

    // T032: Return success response with session details
    return new Response(
      JSON.stringify({
        session_id: sessionId,
        websocket_url: websocketUrl,
        expires_at: expiresAt,
        max_duration_seconds: MAX_DURATION_SECONDS
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    // T032: Handle unexpected errors
    logger.error('Unexpected error', error);
    return internalServerError('Failed to start recording session');
  }
}
