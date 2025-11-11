/**
 * GET /api/notes
 *
 * List user's voice notes with pagination.
 *
 * Tasks: T070-T074
 * - T070: Validate JWT (handled by requireAuth middleware)
 * - T071: Extract and validate pagination parameters (limit, offset)
 * - T072: Call getUserNotes() and countUserNotes() from voice-notes-queries
 * - T073: Build paginated response with has_more flag
 * - T074: Apply rate limiting (60/min per user)
 *
 * @module workers/api/notes/list
 */

import { getUserNotes } from '../../../lib/db/voice-notes-queries.js';
import { requireAuth } from '../../../middleware/auth.js';
import { rateLimitMiddleware } from '../../../middleware/rateLimit.js';
import { badRequestError, internalServerError } from '../../../utils/errors.js';
import { createLogger } from '../../../utils/logger.js';

/**
 * Handle GET /api/notes
 *
 * Returns paginated list of user's voice notes sorted by created_at DESC.
 * Only returns non-deleted notes.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Worker environment bindings
 * @param {Object} env.DB - D1 database binding
 * @param {Object} env.RATE_LIMIT - KV namespace for rate limiting
 * @returns {Promise<Response>} JSON response with notes array and pagination metadata
 *
 * Query Parameters:
 * - limit (optional): Number of notes per page (default: 20, max: 100)
 * - offset (optional): Pagination offset (default: 0)
 *
 * Response format:
 * {
 *   "notes": [
 *     {
 *       "note_id": "note_...",
 *       "transcript": "Full transcript text...",
 *       "duration_seconds": 120,
 *       "word_count": 245,
 *       "created_at": "ISO timestamp"
 *     }
 *   ],
 *   "pagination": {
 *     "total": 45,
 *     "limit": 20,
 *     "offset": 0,
 *     "has_more": true
 *   }
 * }
 */
export async function handleListNotes(request, env) {
  const logger = createLogger('API:ListNotes');

  try {
    // T070: Validate JWT and get user context (via requireAuth middleware)
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      logger.warn('Authentication failed');
      return authResult;
    }
    const user = authResult;

    logger.baseContext.user_id = user.user_id;

    // T074: Check rate limit (60 requests per minute per user)
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      env,
      'notes:list',
      user.user_id
    );
    if (rateLimitResponse) {
      // Rate limit exceeded, return 429 response
      return rateLimitResponse;
    }

    // T071: Extract and validate pagination parameters
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    // Parse and validate limit (default: 20, max: 100, min: 1)
    let limit = 20;
    if (limitParam !== null) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return badRequestError('Invalid limit parameter: must be a positive integer');
      }
      limit = Math.min(parsedLimit, 100); // Cap at 100
    }

    // Parse and validate offset (default: 0, min: 0)
    let offset = 0;
    if (offsetParam !== null) {
      const parsedOffset = parseInt(offsetParam, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return badRequestError('Invalid offset parameter: must be a non-negative integer');
      }
      offset = parsedOffset;
    }

    // T072: Query database for user's notes with pagination
    let result;
    try {
      const timer = logger.startTimer('db_query');
      result = await getUserNotes(env, user.user_id, limit, offset);
      logger.endTimer(timer, { limit, offset, result_count: result.notes.length });
    } catch (error) {
      logger.error('Database query failed', error);
      return internalServerError('Failed to retrieve notes');
    }

    // T073: Build paginated response
    const { notes, total } = result;

    // Calculate has_more flag
    const hasMore = (offset + limit) < total;

    const response = {
      notes: notes,
      pagination: {
        total: total,
        limit: limit,
        offset: offset,
        has_more: hasMore
      }
    };

    logger.info('Notes listed successfully', {
      limit,
      offset,
      total: total,
      returned: notes.length,
      has_more: hasMore
    });

    // Return success response
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    // Handle unexpected errors
    logger.error('Unexpected error', error);
    return internalServerError('Failed to list notes');
  }
}
