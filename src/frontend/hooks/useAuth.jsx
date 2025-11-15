import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, getMe } from '../utils/api';

// Create authentication context
const AuthContext = createContext(null);

// Enhanced logging
const LOG_PREFIX = '[useAuth]';
const DEBUG = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

function log(...args) {
  if (DEBUG) {
    console.log(LOG_PREFIX, ...args);
  }
}

function logError(...args) {
  console.error(LOG_PREFIX, ...args);
}

// AuthProvider component - wraps app to provide auth state
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    log('Initializing auth state...');
    const token = localStorage.getItem('jwt_token');

    if (token) {
      log('Found existing JWT token, validating...');
      // Validate token by fetching user data
      getMe()
        .then(userData => {
          log('Token valid, user authenticated:', userData.user?.email);
          setUser(userData.user || userData);
          setError(null);
        })
        .catch((err) => {
          logError('Token validation failed:', err.message);
          // Token invalid or expired, clear it
          localStorage.removeItem('jwt_token');
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      log('No existing token found');
      setLoading(false);
    }
  }, []);

  // Login function
  const login = async (email, password) => {
    log('Login attempt for:', email);
    try {
      setError(null);

      if (!email || !password) {
        const error = new Error('Email and password are required');
        logError('Login validation failed:', error.message);
        setError(error.message);
        throw error;
      }

      const response = await apiLogin(email, password);

      if (!response || !response.token || !response.user) {
        const error = new Error('Invalid response from server');
        logError('Login failed - invalid response:', response);
        setError(error.message);
        throw error;
      }

      // Store JWT token
      log('Login successful, storing token');
      localStorage.setItem('jwt_token', response.token);
      setUser(response.user);

      return response;
    } catch (err) {
      logError('Login error:', err.message);
      setError(err.message);
      throw err;
    }
  };

  // Register function
  const register = async (email, password) => {
    log('Registration attempt for:', email);
    try {
      setError(null);

      if (!email || !password) {
        const error = new Error('Email and password are required');
        logError('Registration validation failed:', error.message);
        setError(error.message);
        throw error;
      }

      const response = await apiRegister(email, password);

      if (!response || !response.token || !response.user) {
        const error = new Error('Invalid response from server');
        logError('Registration failed - invalid response:', response);
        setError(error.message);
        throw error;
      }

      // Store JWT token
      log('Registration successful, storing token');
      localStorage.setItem('jwt_token', response.token);
      setUser(response.user);

      return response;
    } catch (err) {
      logError('Registration error:', err.message);
      setError(err.message);
      throw err;
    }
  };

  // Logout function
  const logout = () => {
    log('User logging out');
    localStorage.removeItem('jwt_token');
    setUser(null);
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
