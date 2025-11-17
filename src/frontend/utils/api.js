import { createLogger } from './logger';

// API Client for GraphMind
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
const logger = createLogger('api');

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    logger.debug('init', 'Initialized API client', { baseURL: this.baseURL });
  }

  // Get authentication headers with JWT token
  getAuthHeaders() {
    const token = localStorage.getItem('jwt_token');
    logger.trace('auth.header', 'Auth header requested', { hasToken: !!token });
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // Generic request wrapper with error handling and 401 auto-redirect
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...options.headers
    };

    const method = options.method || 'GET';
    const endTimer = logger.timer('request', { method, endpoint });
    logger.debug('request.start', `${method} ${url}`, { endpoint });

    try {
      const response = await fetch(url, { ...options, headers });
      const traceId = response.headers.get('x-request-id') || response.headers.get('cf-ray');
      const durationMs = endTimer();
      logger.debug('request.response', 'Response received', {
        status: response.status,
        statusText: response.statusText,
        endpoint,
        duration_ms: durationMs,
        trace_id: traceId
      });

      // Handle 401 unauthorized - token expired or invalid
      if (response.status === 401) {
        logger.warn('request.unauthorized', 'Clearing token and redirecting to login', { endpoint });
        localStorage.removeItem('jwt_token');
        window.location.href = '/login';
        throw new Error('Session expired');
      }

      // Handle other error responses
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: 'Request failed' };
        }

        const errorMessage = (() => {
          if (typeof errorData?.error === 'string') return errorData.error;
          if (errorData?.error?.message) return errorData.error.message;
          return `HTTP ${response.status}: ${response.statusText}`;
        })();

        const traceSuffix = traceId ? ` (trace: ${traceId})` : '';
        const finalMessage = `${errorMessage}${traceSuffix}`;

        logger.error('request.failed', finalMessage, {
          status: response.status,
          endpoint,
          trace_id: traceId,
          error: errorData
        });
        throw new Error(finalMessage);
      }

      const data = await response.json();
      logger.debug('request.success', 'Request successful', {
        endpoint,
        duration_ms: durationMs,
        trace_id: traceId
      });
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.warn('request.aborted', 'Request aborted (timeout or cancellation)', { endpoint });
        throw error;
      }

      // Network errors or other failures
      if (error.message === 'Session expired') throw error;

      logger.error('request.exception', 'Request error', {
        endpoint,
        message: error.message
      });

      // Provide more helpful error messages
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }

      throw new Error(error.message || 'Network error');
    }
  }

  // Authentication endpoints
  async login(email, password) {
    logger.info('auth.login.start', 'Attempting login', { email });
    try {
      const result = await this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      logger.info('auth.login.success', 'Login successful', { user: result?.user?.email });
      return result;
    } catch (error) {
      logger.error('auth.login.failed', 'Login failed', { message: error.message });
      throw error;
    }
  }

  async register(email, password) {
    logger.info('auth.register.start', 'Attempting registration', { email });
    try {
      const result = await this.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      logger.info('auth.register.success', 'Registration successful', { user: result?.user?.email });
      return result;
    } catch (error) {
      logger.error('auth.register.failed', 'Registration failed', { message: error.message });
      throw error;
    }
  }

  async getMe() {
    logger.debug('auth.me.start', 'Fetching current user info');
    try {
      const result = await this.request('/api/auth/me');
      logger.debug('auth.me.success', 'User info retrieved', { user: result.user?.email });
      return result;
    } catch (error) {
      logger.error('auth.me.failed', 'Failed to get user info', { message: error.message });
      throw error;
    }
  }

  // Query endpoints
  async startQuery() {
    logger.info('query.start', 'Starting new query session');
    try {
      const result = await this.request('/api/query/start', { method: 'POST' });
      logger.info('query.start.success', 'Query session started', { session_id: result.session_id });
      return result;
    } catch (error) {
      logger.error('query.start.failed', 'Failed to start query', { message: error.message });
      throw error;
    }
  }

  async getQueryHistory(page = 1, limit = 20) {
    logger.debug('query.history.start', 'Fetching query history', { page, limit });
    try {
      const result = await this.request(`/api/query/history?page=${page}&limit=${limit}`);
      logger.debug('query.history.success', 'Query history retrieved', {
        page,
        limit,
        count: result.queries?.length
      });
      return result;
    } catch (error) {
      logger.error('query.history.failed', 'Failed to get query history', { message: error.message });
      throw error;
    }
  }

  async getQuery(queryId) {
    logger.debug('query.get.start', 'Fetching query', { queryId });
    try {
      const result = await this.request(`/api/query/${queryId}`);
      logger.debug('query.get.success', 'Query retrieved', { queryId });
      return result;
    } catch (error) {
      logger.error('query.get.failed', 'Failed to get query', { queryId, message: error.message });
      throw error;
    }
  }

  // Seed data endpoint for demo/testing
  async seedData(options = {}) {
    const { timeoutMs = 20000, signal } = options;
    const controller = signal ? null : new AbortController();
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const requestSignal = signal || controller?.signal;

    logger.info('seed.start', 'Requesting seed data', { timeout_ms: timeoutMs });

    try {
      const result = await this.request('/api/seed-data', {
        method: 'POST',
        signal: requestSignal
      });

      logger.info('seed.success', 'Seed data request completed', {
        success: !!result?.success,
        existing_data: !!result?.existing_data
      });

      return result;
    } catch (error) {
      const isTimeout = error.name === 'AbortError' ||
        (typeof error.message === 'string' && error.message.toLowerCase().includes('timeout'));

      logger.error('seed.failed', 'Seed data request failed', {
        message: error.message
      });

      if (isTimeout) {
        throw new Error('Seed data request timed out. Please try again.');
      }

      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}

// Export singleton instance
export const api = new ApiClient();

// Export bound methods to preserve 'this' context
export const login = api.login.bind(api);
export const register = api.register.bind(api);
export const getMe = api.getMe.bind(api);
export const startQuery = api.startQuery.bind(api);
export const getQueryHistory = api.getQueryHistory.bind(api);
export const getQuery = api.getQuery.bind(api);
export const seedData = api.seedData.bind(api);

export default api;
