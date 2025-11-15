// API Client for GraphMind
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

// Enhanced logging for debugging
const LOG_PREFIX = '[API Client]';
const DEBUG = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

function log(...args) {
  if (DEBUG) {
    console.log(LOG_PREFIX, ...args);
  }
}

function logError(...args) {
  console.error(LOG_PREFIX, ...args);
}

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    log('Initialized with baseURL:', this.baseURL);
  }

  // Get authentication headers with JWT token
  getAuthHeaders() {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      log('JWT token found in localStorage');
    }
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

    log(`${options.method || 'GET'} ${url}`);

    try {
      const response = await fetch(url, { ...options, headers });

      log(`Response status: ${response.status} ${response.statusText}`);

      // Handle 401 unauthorized - token expired or invalid
      if (response.status === 401) {
        logError('Unauthorized - clearing token and redirecting to login');
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
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        logError(`Request failed: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      log('Request successful', data);
      return data;
    } catch (error) {
      // Network errors or other failures
      if (error.message === 'Session expired') throw error;

      logError('Request error:', error.message);

      // Provide more helpful error messages
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }

      throw new Error(error.message || 'Network error');
    }
  }

  // Authentication endpoints
  async login(email, password) {
    log('Attempting login for:', email);
    try {
      const result = await this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      log('Login successful');
      return result;
    } catch (error) {
      logError('Login failed:', error.message);
      throw error;
    }
  }

  async register(email, password) {
    log('Attempting registration for:', email);
    try {
      const result = await this.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      log('Registration successful');
      return result;
    } catch (error) {
      logError('Registration failed:', error.message);
      throw error;
    }
  }

  async getMe() {
    log('Fetching current user info');
    try {
      const result = await this.request('/api/auth/me');
      log('User info retrieved:', result.user?.email);
      return result;
    } catch (error) {
      logError('Failed to get user info:', error.message);
      throw error;
    }
  }

  // Query endpoints
  async startQuery() {
    log('Starting new query session');
    try {
      const result = await this.request('/api/query/start', { method: 'POST' });
      log('Query session started:', result.session_id);
      return result;
    } catch (error) {
      logError('Failed to start query:', error.message);
      throw error;
    }
  }

  async getQueryHistory(page = 1, limit = 20) {
    log(`Fetching query history (page=${page}, limit=${limit})`);
    try {
      const result = await this.request(`/api/query/history?page=${page}&limit=${limit}`);
      log('Query history retrieved:', result.queries?.length, 'queries');
      return result;
    } catch (error) {
      logError('Failed to get query history:', error.message);
      throw error;
    }
  }

  async getQuery(queryId) {
    log('Fetching query:', queryId);
    try {
      const result = await this.request(`/api/query/${queryId}`);
      log('Query retrieved');
      return result;
    } catch (error) {
      logError('Failed to get query:', error.message);
      throw error;
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

export default api;
