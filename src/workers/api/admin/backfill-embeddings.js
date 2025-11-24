
import { EmbeddingService } from '../../../services/embedding.js';
import { internalServerError, badRequestError } from '../../../utils/errors.js';
import { requireAdmin } from '../../../middleware/auth.js';
import { checkRateLimit, rateLimitError } from '../../../middleware/rate-limit.js';

/**
 * Extract value from FalkorDB raw format
 * FalkorDB returns values as [type, value] arrays:
 * - [2, "string"] for strings
 * - [3, number] for integers
 * - [4, boolean] for booleans
 * - null for missing values
 */
function extractValue(val) {
    if (val === null || val === undefined) return null;
    // If it's already a plain value (not array), return as-is
    if (!Array.isArray(val)) return val;
    // If it's [type, value] format, return the value
    if (val.length >= 2) return val[1];
    // Fallback
    return val[0] ?? null;
}

/**
 * Handle request to backfill embeddings for nodes
 *
 * SECURITY: Admin-only endpoint with rate limiting (1 request/hour)
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Promise<Response>} Response with backfill stats
 */
export async function handleBackfillEmbeddings(request, env) {
    try {
        // T100: Re-enable Bearer token authentication
        // T102: Implement admin role check
        const authResult = await requireAdmin(request, env);

        if (authResult instanceof Response) {
            return authResult; // Return auth error (401 or 403)
        }

        const user = authResult;

        // T103: Rate limiting (1 request/hour per admin)
        if (env.KV) {
            const rateLimitKey = `backfill:${user.user_id}`;
            const rateLimit = await checkRateLimit(rateLimitKey, 1, 3600, env.KV); // 1 req/hour

            if (!rateLimit.allowed) {
                return rateLimitError(rateLimit.reset);
            }
        }

        const body = await request.json().catch(() => ({}));
        const { limit = 50, nodeType = 'Person' } = body;

        // Input validation
        const VALID_NODE_TYPES = ['Person', 'Project', 'Note', 'Topic'];
        if (nodeType && !VALID_NODE_TYPES.includes(nodeType)) {
            return badRequestError(`Invalid nodeType. Must be one of: ${VALID_NODE_TYPES.join(', ')}`);
        }
        if (limit && (typeof limit !== 'number' || limit < 1 || limit > 100)) {
            return badRequestError('Limit must be a number between 1 and 100');
        }

        // Initialize services
        const embeddingService = new EmbeddingService(env.AI);

        console.log('Backfill Env Check:', {
            host: env.FALKORDB_HOST,
            port: env.FALKORDB_PORT,
            user: env.FALKORDB_USER,
            has_password: env.FALKORDB_PASSWORD !== undefined,
            password_type: typeof env.FALKORDB_PASSWORD,
            api_key_exists: !!env.FALKORDB_REST_API_KEY
        });

        // Get FalkorDB connection
        const id = env.FALKORDB_POOL.idFromName('pool');
        const stub = env.FALKORDB_POOL.get(id);

        // 1. Find nodes without embeddings
        // We look for nodes where embedding property is missing
        // Return individual properties to avoid raw node parsing issues
        const findQuery = `
      MATCH (n:${nodeType})
      WHERE n.embedding IS NULL
      RETURN ID(n) as id,
             n.name as name,
             n.description as description,
             n.bio as bio,
             n.summary as summary,
             n.title as title
      LIMIT ${limit}
    `;

        const findResponse = await stub.fetch(new Request('http://do/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                config: {
                    host: env.FALKORDB_HOST || 'localhost',
                    port: '3001', // REST API wrapper port
                    username: env.FALKORDB_USER || env.FALKORDB_USERNAME || 'default',
                    password: env.FALKORDB_PASSWORD,
                    apiKey: env.FALKORDB_REST_API_KEY,
                },
                userId: user.user_id, // Use authenticated user's ID for correct namespace
                cypher: findQuery
            })
        }));

        if (!findResponse.ok) {
            throw new Error(`Failed to query nodes: ${await findResponse.text()}`);
        }

        const findResult = await findResponse.json();
        const nodes = findResult.data || [];

        if (nodes.length === 0) {
            return new Response(JSON.stringify({
                message: 'No nodes found needing embeddings',
                count: 0
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        // 2. Generate embeddings and update nodes
        let updatedCount = 0;
        const errors = [];

        for (const row of nodes) {
            try {
                // Extract properties directly from row (returned as individual columns)
                const nodeId = extractValue(row.id);
                const name = extractValue(row.name);
                const description = extractValue(row.description);
                const bio = extractValue(row.bio);
                const summary = extractValue(row.summary);
                const title = extractValue(row.title);

                // Construct text to embed based on node properties
                // Priority: description -> bio -> summary -> name -> title
                const textToEmbed = description || bio || summary || name || title;

                if (!textToEmbed) {
                    console.warn(`Node ${nodeId} has no text to embed`);
                    continue;
                }

                const embedding = await embeddingService.generateEmbedding(textToEmbed);

                // 3. Update node with embedding (use vecf32 for vector index compatibility)
                const updateQuery = `
          MATCH (n)
          WHERE ID(n) = $id
          SET n.embedding = vecf32($embedding)
        `;

                const updateResponse = await stub.fetch(new Request('http://do/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        config: {
                            host: env.FALKORDB_HOST || 'localhost',
                            port: '3001', // REST API wrapper port
                            username: env.FALKORDB_USER || env.FALKORDB_USERNAME || 'default',
                            password: env.FALKORDB_PASSWORD,
                            apiKey: env.FALKORDB_REST_API_KEY,
                        },
                        userId: user.user_id, // Use authenticated user's ID for correct namespace
                        cypher: updateQuery,
                        params: {
                            id: nodeId,
                            embedding: embedding
                        }
                    })
                }));

                if (updateResponse.ok) {
                    updatedCount++;
                } else {
                    errors.push(`Failed to update node ${nodeId}: ${await updateResponse.text()}`);
                }

            } catch (err) {
                console.error(`Error processing node:`, err);
                errors.push(err.message);
            }
        }

        return new Response(JSON.stringify({
            message: `Processed ${nodes.length} nodes`,
            updated: updatedCount,
            errors: errors.length > 0 ? errors : undefined
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Backfill error:', error);
        return internalServerError(error.message);
    }
}
