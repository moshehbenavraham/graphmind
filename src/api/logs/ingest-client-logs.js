import { badRequestError } from '../../utils/errors.js';
import { successResponse } from '../../utils/responses.js';
import { createLogger } from '../../utils/logger.js';
import { rateLimitMiddleware } from '../../middleware/rateLimit.js';

const MAX_ENTRIES = 50;
const MAX_STRING = 500;
const MAX_META_DEPTH = 3;
const MAX_META_KEYS = 30;
const REDACT_KEYS = ['authorization', 'password', 'token', 'jwt', 'secret'];

const clampString = (value, max = MAX_STRING) => {
  if (typeof value !== 'string') return value;
  return value.length > max ? `${value.slice(0, max)}...<truncated>` : value;
};

const sanitizeMeta = (value, depth = 0) => {
  if (depth > MAX_META_DEPTH) return '[Truncated depth]';
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return clampString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof ArrayBuffer) return `[ArrayBuffer ${value.byteLength} bytes]`;
  if (ArrayBuffer.isView(value)) return `[${value.constructor.name} ${value.byteLength} bytes]`;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: clampString(value.message, 200),
      stack: clampString(value.stack || '', 400)
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => sanitizeMeta(v, depth + 1));
  }

  if (typeof value === 'object') {
    const result = {};
    let count = 0;
    for (const [key, val] of Object.entries(value)) {
      if (count >= MAX_META_KEYS) {
        result.__truncated = `trimmed after ${MAX_META_KEYS} keys`;
        break;
      }
      count += 1;
      if (REDACT_KEYS.includes(key.toLowerCase())) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = sanitizeMeta(val, depth + 1);
      }
    }
    return result;
  }

  return `[Unsupported ${typeof value}]`;
};

const sanitizeEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;

  const {
    ts,
    level,
    component,
    event,
    message,
    session_id,
    query_id,
    user_id,
    trace_id,
    meta
  } = entry;

  return {
    ts: typeof ts === 'string' ? ts : new Date().toISOString(),
    level: typeof level === 'string' ? level.toLowerCase() : 'info',
    component: clampString(component || 'client'),
    event: clampString(event || 'event'),
    message: clampString(message || ''),
    session_id: clampString(session_id || ''),
    query_id: clampString(query_id || ''),
    user_id: clampString(user_id || ''),
    trace_id: clampString(trace_id || ''),
    meta: sanitizeMeta(meta)
  };
};

export async function handleClientLogs(request, env) {
  const logger = createLogger('API:ClientLogs');

  const rateLimitResponse = await rateLimitMiddleware(request, env, 'logs:ingest');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    logger.warn('client_logs.parse_failed', 'Invalid JSON payload', { message: error.message });
    return badRequestError('Invalid JSON payload');
  }

  const entries = Array.isArray(body) ? body : body?.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return badRequestError('Expected array of log entries');
  }

  const limitedEntries = entries.slice(0, MAX_ENTRIES);
  const sanitized = limitedEntries
    .map(sanitizeEntry)
    .filter(Boolean);

  const dropped = entries.length - sanitized.length;
  const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';

  sanitized.forEach((entry) => {
    const record = {
      source: 'client',
      received_at: new Date().toISOString(),
      client_ip: clientIp,
      ...entry
    };
    console.log(JSON.stringify(record));
  });

  logger.info('client_logs.received', 'Client logs ingested', {
    count: sanitized.length,
    dropped,
    client_ip: clientIp
  });

  return successResponse({
    received: sanitized.length,
    dropped
  });
}
