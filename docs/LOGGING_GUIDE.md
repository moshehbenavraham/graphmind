# GraphMind Logging Guide

Quick reference for using the structured logging system.

---

## Quick Start

```javascript
import { createLogger } from '../utils/logger.js';

// Create logger with component name
const logger = createLogger('MyComponent');

// Log messages
logger.info('Operation successful', { data: 'value' });
logger.error('Operation failed', error);
```

---

## Logger Creation

### Basic Logger

```javascript
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ComponentName');
```

### Logger with Context

```javascript
const logger = createLogger('API:StartRecording', {
  user_id: 'user_123',
  session_id: 'sess_456'
});
```

### Child Logger

```javascript
const parentLogger = createLogger('Parent');
const childLogger = parentLogger.child({ request_id: 'req_789' });
```

---

## Log Levels

### DEBUG

Detailed diagnostic information.

```javascript
logger.debug('Processing chunk', {
  sequence: 5,
  size: 1024
});
```

### INFO

General informational messages.

```javascript
logger.info('Session created', {
  session_id: sessionId
});
```

### WARN

Warning messages for potentially harmful situations.

```javascript
logger.warn('High latency detected', {
  latency_ms: 2500,
  threshold_ms: 2000
});
```

### ERROR

Error events that might still allow the application to continue.

```javascript
logger.error('Database query failed', error);

// Or with custom data
logger.error('Operation failed', {
  operation: 'save_transcript',
  reason: 'validation_error'
});
```

### FATAL

Severe error events that will lead to application abort.

```javascript
logger.fatal('Critical system failure', error);
```

---

## Performance Timing

### Start Timer

```javascript
const timer = logger.startTimer('operation_name');
```

### End Timer

```javascript
// Automatically logs duration
const duration = logger.endTimer(timer);

// With additional data
const duration = logger.endTimer(timer, {
  items_processed: 100
});
```

### Manual Timing

```javascript
const startTime = Date.now();
// ... perform operation
const duration = Date.now() - startTime;

logger.timing('operation_name', duration, {
  items: 50
});
```

---

## Common Patterns

### API Endpoint

```javascript
export async function handleRequest(request, env) {
  const logger = createLogger('API:EndpointName');

  try {
    // Add user context after auth
    const user = await authenticate(request);
    logger.baseContext.user_id = user.user_id;

    // Log success
    logger.info('Request successful', {
      status: 200
    });

    return response;

  } catch (error) {
    logger.error('Request failed', error);
    return errorResponse();
  }
}
```

### Database Query

```javascript
async function queryDatabase(env, userId) {
  const logger = createLogger('Database:Query', { user_id: userId });

  const timer = logger.startTimer('db_query');

  try {
    const result = await env.DB.prepare('SELECT * FROM notes WHERE user_id = ?')
      .bind(userId)
      .all();

    logger.endTimer(timer, {
      rows_returned: result.results.length
    });

    return result;

  } catch (error) {
    logger.error('Query failed', error);
    throw error;
  }
}
```

### WebSocket Handler

```javascript
class WebSocketHandler {
  constructor(sessionId, userId) {
    this.logger = createLogger('WebSocket:Handler', {
      session_id: sessionId,
      user_id: userId
    });
  }

  handleMessage(message) {
    this.logger.debug('Message received', {
      type: message.type,
      size: JSON.stringify(message).length
    });

    try {
      // Process message
      this.logger.info('Message processed', {
        type: message.type
      });
    } catch (error) {
      this.logger.error('Message processing failed', error);
    }
  }
}
```

### Durable Object

```javascript
export class MyDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    // Base logger
    this.logger = createLogger('DO:MyObject');
  }

  async fetch(request) {
    // Update logger with session context
    this.logger = createLogger('DO:MyObject', {
      session_id: sessionId,
      user_id: userId
    });

    this.logger.info('Fetch called', {
      url: request.url,
      method: request.method
    });

    // ... handle request
  }
}
```

---

## Log Output Format

All logs are output as JSON:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "INFO",
  "component": "API:StartRecording",
  "message": "Session created",
  "user_id": "user_1234567890abcdef",
  "session_id": "sess_abcdef1234567890"
}
```

---

## Error Logging Best Practices

### DO: Pass Error Object

```javascript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', error);
}
```

This captures:
- Error message
- Error name
- Stack trace

### DON'T: Pass Error Message String

```javascript
// BAD - loses stack trace
logger.error('Operation failed', { message: error.message });
```

---

## Context Best Practices

### DO: Add Relevant Context

```javascript
logger.info('Transcript saved', {
  note_id: noteId,
  word_count: wordCount,
  duration_seconds: duration
});
```

### DON'T: Log Sensitive Data

```javascript
// BAD - contains passwords
logger.info('User logged in', {
  email: email,
  password: password  // Never log passwords!
});

// GOOD
logger.info('User logged in', {
  user_id: userId
});
```

---

## Performance Monitoring

### Track Operation Duration

```javascript
async function processData(data) {
  const timer = logger.startTimer('process_data');

  try {
    const result = await expensiveOperation(data);

    logger.endTimer(timer, {
      items_processed: result.length
    });

    return result;
  } catch (error) {
    logger.error('Processing failed', {
      duration_ms: timer.end(),
      error
    });
    throw error;
  }
}
```

### Set Performance Thresholds

```javascript
const duration = logger.endTimer(timer);

if (duration > THRESHOLD_MS) {
  logger.warn('Slow operation detected', {
    operation: 'transcription',
    duration_ms: duration,
    threshold_ms: THRESHOLD_MS
  });
}
```

---

## Viewing Logs

### Local Development

```bash
# Logs appear in console
npm run dev
```

### Production (Cloudflare Workers)

```bash
# Tail logs in real-time
npx wrangler tail --env production

# Filter by log level
npx wrangler tail --env production | grep ERROR

# Save logs to file
npx wrangler tail --env production > logs.txt
```

### Parse JSON Logs

```bash
# Pretty print logs
npx wrangler tail --env production | jq '.'

# Filter by component
npx wrangler tail --env production | jq 'select(.component == "API:StartRecording")'

# Show only errors
npx wrangler tail --env production | jq 'select(.level == "ERROR")'

# Calculate average duration
npx wrangler tail --env production | jq -s 'map(select(.duration_ms)) | (map(.duration_ms) | add) / length'
```

---

## Migration from console.log

### Before

```javascript
console.log('[MyComponent] Operation started');
console.error('[MyComponent] Error:', error.message);
```

### After

```javascript
import { createLogger } from '../utils/logger.js';

const logger = createLogger('MyComponent');

logger.info('Operation started');
logger.error('Operation failed', error);
```

---

## FAQ

**Q: Should I log in every function?**
A: Log at key decision points, errors, and performance-critical operations. Avoid excessive debug logging in production.

**Q: What log level should I use?**
- DEBUG: Detailed diagnostic info (disabled in production)
- INFO: Normal operation events
- WARN: Recoverable issues, degraded performance
- ERROR: Errors that affect functionality
- FATAL: System-critical failures

**Q: How do I add user_id to all logs?**
A: Set it in `logger.baseContext.user_id` after authentication.

**Q: Can I use console.log?**
A: No, always use the structured logger for consistency and parseability.

**Q: How do I log without creating a logger instance?**
A: Use the default logger:
```javascript
import { logger } from '../utils/logger.js';
logger.info('Message');
```

---

Last Updated: 2024-01-01
