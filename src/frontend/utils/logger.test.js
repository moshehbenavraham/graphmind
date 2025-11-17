import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalRandom = Math.random;

const makeLocalStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    }
  };
};

const loadLogger = async (env = {}) => {
  vi.resetModules();
  vi.unstubAllEnvs();
  Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));

  Object.defineProperty(global, 'localStorage', {
    value: makeLocalStorage(),
    writable: true,
    configurable: true
  });

  if (env.withBeacon) {
    Object.defineProperty(global, 'navigator', {
      value: { sendBeacon: vi.fn(() => true) },
      configurable: true
    });
  } else {
    Object.defineProperty(global, 'navigator', {
      value: undefined,
      configurable: true
    });
  }

  Object.defineProperty(global, 'fetch', {
    value: vi.fn(() => Promise.resolve()),
    writable: true,
    configurable: true
  });

  return import('./logger.js');
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  Math.random = originalRandom;
  delete global.navigator;
  delete global.fetch;
  delete global.localStorage;
});

describe('frontend logger', () => {
  it('enables remote transport and redacts sensitive fields', async () => {
    Math.random = vi.fn(() => 0); // Always pass sampling gate
    const { createLogger } = await loadLogger({
      VITE_DEBUG: 'true',
      VITE_DEBUG_VERBOSE: 'true',
      VITE_DEBUG_REMOTE: 'true',
      VITE_DEBUG_REMOTE_SAMPLE_RATE: '1', // always sample
      VITE_DEBUG_REMOTE_MAX_PER_MIN: '5',
      withBeacon: true
    });

    const logger = createLogger('TestComponent', { secret: 'should-hide' });
    const beaconSpy = global.navigator.sendBeacon;

    logger.info('event.happened', 'Payload sent', {
      token: 'redact-this',
      details: { nested: 'ok' }
    });

    expect(beaconSpy).toHaveBeenCalledTimes(1);
    const [, blob] = beaconSpy.mock.calls[0];
    const payload = JSON.parse(await blob.text());

    expect(payload.component).toBe('TestComponent');
    expect(payload.secret).toBe('[REDACTED]');
    expect(payload.meta.token).toBe('[REDACTED]');
    expect(payload.meta.details.nested).toBe('ok');
  });

  it('forces verbose logging when panic window is active even if env is false', async () => {
    const { getLoggingState } = await loadLogger({
      VITE_DEBUG: 'false',
      VITE_DEBUG_VERBOSE: 'false',
      VITE_DEBUG_REMOTE: 'false'
    });

    const future = Date.now() + 5 * 60 * 1000;
    global.localStorage.setItem('gm_debug_verbose_until', String(future));

    const state = getLoggingState();
    expect(state.verbose).toBe(true);
    expect(state.debug).toBe(true);
    expect(state.remote).toBe(false);
  });

  it('tracks durations via timer helper', async () => {
    const { createLogger } = await loadLogger({
      VITE_DEBUG: 'true',
      VITE_DEBUG_VERBOSE: 'false',
      VITE_DEBUG_REMOTE: 'false'
    });

    const logger = createLogger('TimerComponent');
    const spy = console.log;

    const done = logger.timer('work');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const duration = done();

    expect(duration).toBeGreaterThanOrEqual(0);
    expect(spy).toHaveBeenCalled();
    const [firstCall] = spy.mock.calls;
    const lastArg = firstCall[firstCall.length - 1];
    expect(lastArg.duration_ms).toBeDefined();
  });
});
