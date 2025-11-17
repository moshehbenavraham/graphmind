const boolVal = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return fallback;
  return String(value).toLowerCase() === 'true';
};

const numVal = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const nowMs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

const PANIC_STORAGE_KEY = 'gm_debug_verbose_until';
const BASE_DEBUG = import.meta.env.DEV || boolVal(import.meta.env.VITE_DEBUG);
const BASE_VERBOSE = boolVal(import.meta.env.VITE_DEBUG_VERBOSE);
const REMOTE_FLAG = boolVal(import.meta.env.VITE_DEBUG_REMOTE);
const REMOTE_SAMPLE_RATE = clamp(numVal(import.meta.env.VITE_DEBUG_REMOTE_SAMPLE_RATE, 0.25), 0, 1);
const REMOTE_MAX_PER_MIN = Math.max(1, numVal(import.meta.env.VITE_DEBUG_REMOTE_MAX_PER_MIN, 60));

const LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};

const CONSOLE_MAP = {
  trace: 'log',
  debug: 'log',
  info: 'info',
  warn: 'warn',
  error: 'error',
  fatal: 'error'
};

const REDACT_KEYS = ['authorization', 'password', 'token', 'jwt', 'secret'];
const MAX_META_DEPTH = 3;
const MAX_META_KEYS = 30;

let remoteWindowStart = Date.now();
let remoteSentThisWindow = 0;
let remoteBackoffUntil = 0;
let remoteFailures = 0;

const getPanicUntil = () => {
  if (typeof localStorage === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(PANIC_STORAGE_KEY);
    const value = Number(raw);
    if (!Number.isFinite(value)) return 0;
    if (value < Date.now()) {
      localStorage.removeItem(PANIC_STORAGE_KEY);
      return 0;
    }
    return value;
  } catch {
    return 0;
  }
};

const isPanicActive = () => getPanicUntil() > Date.now();
const isVerboseEnabled = () => BASE_VERBOSE || isPanicActive();
const isDebugEnabled = () => BASE_DEBUG || isVerboseEnabled();
const isRemoteEnabled = () => isVerboseEnabled() && REMOTE_FLAG;

const shouldLog = (level) => {
  const threshold = isVerboseEnabled() ? LEVELS.trace : (isDebugEnabled() ? LEVELS.debug : LEVELS.info);
  return LEVELS[level] >= threshold;
};

const sanitizeValue = (value, depth = 0) => {
  if (depth > MAX_META_DEPTH) {
    return '[Truncated depth]';
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (value instanceof ArrayBuffer) {
    return `[ArrayBuffer ${value.byteLength} bytes]`;
  }
  if (ArrayBuffer.isView(value)) {
    return `[${value.constructor.name} ${value.byteLength} bytes]`;
  }
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }
  if (typeof value === 'string') {
    return value.length > 500 ? `${value.slice(0, 500)}...<truncated>` : value;
  }
  if (value && typeof value === 'object') {
    const copy = Array.isArray(value) ? [] : {};
    let count = 0;
    for (const [k, v] of Object.entries(value)) {
      if (count >= MAX_META_KEYS) {
        copy.__truncated = `trimmed after ${MAX_META_KEYS} keys`;
        break;
      }
      count += 1;
      if (REDACT_KEYS.includes(k.toLowerCase())) {
        copy[k] = '[REDACTED]';
        continue;
      }
      copy[k] = sanitizeValue(v, depth + 1);
    }
    return copy;
  }
  return value;
};

const buildEntry = (component, context, level, event, message, meta) => ({
  ts: new Date().toISOString(),
  level,
  component,
  event,
  message,
  ...sanitizeValue(context || {}),
  meta: sanitizeValue(meta)
});

const sendConsole = (entry) => {
  const method = CONSOLE_MAP[entry.level] || 'log';
  const parts = [
    `[${entry.level.toUpperCase()}]`,
    entry.component,
    entry.event,
    '-',
    entry.message
  ];
  console[method](...parts, entry.meta || '');
};

const shouldSendRemote = () => {
  if (!isRemoteEnabled()) return false;

  const now = Date.now();
  if (now < remoteBackoffUntil) return false;

  if (now - remoteWindowStart >= 60000) {
    remoteWindowStart = now;
    remoteSentThisWindow = 0;
  }

  if (remoteSentThisWindow >= REMOTE_MAX_PER_MIN) return false;
  if (Math.random() > REMOTE_SAMPLE_RATE) return false;

  remoteSentThisWindow += 1;
  return true;
};

const recordRemoteFailure = () => {
  remoteFailures += 1;
  const backoffMs = Math.min(30000, 1000 * Math.pow(2, remoteFailures - 1));
  remoteBackoffUntil = Date.now() + backoffMs;
};

const recordRemoteSuccess = () => {
  remoteFailures = 0;
};

const sendRemote = (entry) => {
  if (!shouldSendRemote()) return;
  try {
    const body = JSON.stringify(entry);

    if (typeof navigator !== 'undefined' && navigator?.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/logs', blob);
      if (sent) {
        recordRemoteSuccess();
        return;
      }
    }

    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).then(recordRemoteSuccess).catch(recordRemoteFailure);
  } catch (_) {
    recordRemoteFailure();
  }
};

export const getLoggingState = () => ({
  debug: isDebugEnabled(),
  verbose: isVerboseEnabled(),
  remote: isRemoteEnabled(),
  verbose_until: getPanicUntil(),
  remote_sample_rate: REMOTE_SAMPLE_RATE,
  remote_max_per_minute: REMOTE_MAX_PER_MIN,
  remote_backoff_until: remoteBackoffUntil
});

export const enableVerboseLoggingWindow = (minutes = 10) => {
  if (!BASE_VERBOSE) return false;
  if (typeof localStorage === 'undefined') return false;
  const duration = Math.max(1, minutes) * 60000;
  try {
    localStorage.setItem(PANIC_STORAGE_KEY, String(Date.now() + duration));
    return true;
  } catch {
    return false;
  }
};

export const createLogger = (component, initialContext = {}) => {
  let context = { ...initialContext };

  const log = (level, event, message, meta = {}) => {
    if (!shouldLog(level)) return;
    const entry = buildEntry(component, context, level, event, message, meta);
    sendConsole(entry);
    if (isVerboseEnabled()) {
      sendRemote(entry);
    }
  };

  return {
    trace: (event, message, meta) => log('trace', event, message, meta),
    debug: (event, message, meta) => log('debug', event, message, meta),
    info: (event, message, meta) => log('info', event, message, meta),
    warn: (event, message, meta) => log('warn', event, message, meta),
    error: (event, message, meta) => log('error', event, message, meta),
    fatal: (event, message, meta) => log('fatal', event, message, meta),
    timer: (event, meta = {}) => {
      const start = nowMs();
      return () => {
        const durationMs = Math.round(nowMs() - start);
        log('debug', `${event}.duration`, 'Elapsed time', { ...meta, duration_ms: durationMs });
        return durationMs;
      };
    },
    setContext: (extra = {}) => {
      context = { ...context, ...extra };
    },
    getContext: () => ({ ...context }),
    child: (extra = {}) => createLogger(component, { ...context, ...extra })
  };
};

const globalLogger = createLogger('frontend');

export const installGlobalErrorHandlers = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    globalLogger.error('window.error', event.message, {
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error ? sanitizeValue(event.error) : undefined
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    globalLogger.error('window.unhandledrejection', 'Unhandled promise rejection', {
      reason: sanitizeValue(event.reason)
    });
  });
};

if (typeof window !== 'undefined') {
  window.graphmindLogs = {
    enableVerboseLoggingWindow,
    getLoggingState
  };
}

export default globalLogger;
