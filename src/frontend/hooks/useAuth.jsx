import { createContext, useContext, useState, useEffect } from 'react';
import { createLogger } from '../utils/logger';
import { login as apiLogin, register as apiRegister, getMe } from '../utils/api';

// Create authentication context
const AuthContext = createContext(null);
const logger = createLogger('useAuth');

// AuthProvider component - wraps app to provide auth state
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    logger.debug('init', 'Initializing auth state');
    const token = localStorage.getItem('jwt_token');

    if (token) {
      logger.debug('token.present', 'Found existing JWT token, validating');
      // Validate token by fetching user data
      getMe()
        .then(userData => {
          logger.info('token.valid', 'User authenticated', { user: userData.user?.email });
          setUser(userData.user || userData);
          setError(null);
        })
        .catch((err) => {
          logger.warn('token.invalid', 'Token validation failed', { message: err.message });
          // Token invalid or expired, clear it
          localStorage.removeItem('jwt_token');
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      logger.debug('token.absent', 'No existing token found');
      setLoading(false);
    }
  }, []);

  // Login function
  const login = async (email, password) => {
    logger.info('login.start', 'Login attempt', { email });
    try {
      setError(null);

      if (!email || !password) {
        const error = new Error('Email and password are required');
        logger.warn('login.validation', 'Validation failed', { message: error.message });
        setError(error.message);
        throw error;
      }

      const response = await apiLogin(email, password);

      if (!response || !response.token || !response.user) {
        const error = new Error('Invalid response from server');
        logger.error('login.invalid_response', 'Login failed - invalid response', { response });
        setError(error.message);
        throw error;
      }

      // Store JWT token
      logger.info('login.success', 'Login successful, storing token', { user: response.user?.email });
      localStorage.setItem('jwt_token', response.token);
      setUser(response.user);

      return response;
    } catch (err) {
      logger.error('login.error', 'Login error', { message: err.message });
      setError(err.message);
      throw err;
    }
  };

  // Register function
  const register = async (email, password) => {
    logger.info('register.start', 'Registration attempt', { email });
    try {
      setError(null);

      if (!email || !password) {
        const error = new Error('Email and password are required');
        logger.warn('register.validation', 'Validation failed', { message: error.message });
        setError(error.message);
        throw error;
      }

      const response = await apiRegister(email, password);

      if (!response || !response.token || !response.user) {
        const error = new Error('Invalid response from server');
        logger.error('register.invalid_response', 'Registration failed - invalid response', { response });
        setError(error.message);
        throw error;
      }

      // Store JWT token
      logger.info('register.success', 'Registration successful, storing token', { user: response.user?.email });
      localStorage.setItem('jwt_token', response.token);
      setUser(response.user);

      return response;
    } catch (err) {
      logger.error('register.error', 'Registration error', { message: err.message });
      setError(err.message);
      throw err;
    }
  };

  // Logout function
  const logout = () => {
    logger.info('logout', 'User logging out');
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
