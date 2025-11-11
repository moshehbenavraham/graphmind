/**
 * ErrorBoundary Component
 *
 * React error boundary to catch and display errors gracefully in the frontend.
 * Provides user-friendly error messages and prevents the entire app from crashing.
 *
 * Tasks: T109-T114
 * - T109: Create ErrorBoundary component
 * - T110: Add user-friendly error messages for all error scenarios
 * - T111: Test microphone not available error
 * - T112: Test Workers AI service failure
 * - T113: Test D1 database connection failure
 * - T114: Test KV storage failure (graceful degradation)
 *
 * @module frontend/components/ErrorBoundary
 */

import React from 'react';

/**
 * Error types with user-friendly messages
 */
const ERROR_MESSAGES = {
  // Microphone errors
  MICROPHONE_NOT_FOUND: {
    title: 'Microphone Not Available',
    message: 'No microphone was detected on your device. Please connect a microphone and refresh the page.',
    action: 'Check your microphone connection and try again.'
  },
  MICROPHONE_PERMISSION_DENIED: {
    title: 'Microphone Permission Denied',
    message: 'GraphMind needs access to your microphone to record voice notes.',
    action: 'Please allow microphone access in your browser settings and refresh the page.'
  },
  MICROPHONE_ERROR: {
    title: 'Microphone Error',
    message: 'There was a problem accessing your microphone.',
    action: 'Please check your microphone settings and try again.'
  },

  // Network errors
  NETWORK_ERROR: {
    title: 'Network Error',
    message: 'Unable to connect to GraphMind servers. Please check your internet connection.',
    action: 'Verify your internet connection and try again.'
  },
  WEBSOCKET_ERROR: {
    title: 'Connection Lost',
    message: 'The real-time connection was interrupted.',
    action: 'Your session will reconnect automatically. If problems persist, please refresh the page.'
  },

  // Service errors
  WORKERS_AI_ERROR: {
    title: 'Transcription Service Unavailable',
    message: 'The voice transcription service is temporarily unavailable.',
    action: 'Please try again in a few moments. Your recording has been saved.'
  },
  DATABASE_ERROR: {
    title: 'Database Error',
    message: 'Unable to save or retrieve your voice notes.',
    action: 'Please try again. If the problem persists, contact support.'
  },
  KV_STORAGE_ERROR: {
    title: 'Storage Error',
    message: 'Session storage is temporarily unavailable. Some features may be limited.',
    action: 'The app will continue to function with reduced performance.'
  },

  // Authentication errors
  AUTH_ERROR: {
    title: 'Authentication Error',
    message: 'Your session has expired or is invalid.',
    action: 'Please log in again to continue.'
  },
  RATE_LIMITED: {
    title: 'Rate Limit Exceeded',
    message: 'You have made too many requests. Please slow down.',
    action: 'Wait a moment and try again.'
  },

  // Default error
  UNKNOWN_ERROR: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred.',
    action: 'Please try refreshing the page. If the problem persists, contact support.'
  }
};

/**
 * Map error codes/messages to error types
 * @param {Error} error - Error object
 * @returns {string} Error type key
 */
function getErrorType(error) {
  const message = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';

  // Microphone errors
  if (name === 'notfounderror' || message.includes('no microphone') || message.includes('microphone not found')) {
    return 'MICROPHONE_NOT_FOUND';
  }
  if (name === 'notallowederror' || message.includes('permission denied') || message.includes('microphone permission')) {
    return 'MICROPHONE_PERMISSION_DENIED';
  }
  if (message.includes('microphone') || message.includes('mediadevices')) {
    return 'MICROPHONE_ERROR';
  }

  // Network errors
  if (message.includes('network') || message.includes('fetch failed') || name === 'networkerror') {
    return 'NETWORK_ERROR';
  }
  if (message.includes('websocket') || message.includes('connection lost')) {
    return 'WEBSOCKET_ERROR';
  }

  // Service errors
  if (message.includes('transcription') || message.includes('workers ai') || message.includes('ai service')) {
    return 'WORKERS_AI_ERROR';
  }
  if (message.includes('database') || message.includes('d1') || message.includes('sql')) {
    return 'DATABASE_ERROR';
  }
  if (message.includes('kv') || message.includes('storage')) {
    return 'KV_STORAGE_ERROR';
  }

  // Authentication errors
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('token')) {
    return 'AUTH_ERROR';
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'RATE_LIMITED';
  }

  return 'UNKNOWN_ERROR';
}

/**
 * ErrorBoundary Component
 *
 * Catches React errors and displays a fallback UI with user-friendly messages.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: null
    };
  }

  /**
   * Update state when an error is caught
   * @param {Error} error - Error that was thrown
   */
  static getDerivedStateFromError(error) {
    const errorType = getErrorType(error);
    return {
      hasError: true,
      error: error,
      errorType: errorType
    };
  }

  /**
   * Log error details
   * @param {Error} error - Error that was thrown
   * @param {Object} errorInfo - React error info with component stack
   */
  componentDidCatch(error, errorInfo) {
    // Log to console for debugging
    console.error('ErrorBoundary caught error:', {
      error: error,
      errorInfo: errorInfo,
      errorType: this.state.errorType
    });

    // In production, you could send this to an error tracking service
    // Example: Sentry, LogRocket, etc.
    this.setState({
      errorInfo: errorInfo
    });
  }

  /**
   * Reset error boundary state
   */
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: null
    });

    // If a reset callback was provided, call it
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      const errorConfig = ERROR_MESSAGES[this.state.errorType] || ERROR_MESSAGES.UNKNOWN_ERROR;

      return (
        <div style={{
          padding: '2rem',
          maxWidth: '600px',
          margin: '2rem auto',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #f0f0f0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#fee',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '1rem'
            }}>
              <span style={{ fontSize: '24px', color: '#c33' }}>!</span>
            </div>
            <h2 style={{
              margin: 0,
              fontSize: '1.5rem',
              color: '#333'
            }}>
              {errorConfig.title}
            </h2>
          </div>

          <div style={{
            marginBottom: '1.5rem',
            color: '#666',
            lineHeight: '1.6'
          }}>
            <p style={{ margin: '0 0 1rem 0' }}>
              {errorConfig.message}
            </p>
            <p style={{ margin: 0, fontWeight: '500', color: '#333' }}>
              {errorConfig.action}
            </p>
          </div>

          <div style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#4a9eff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'white',
                color: '#4a9eff',
                border: '2px solid #4a9eff',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Refresh Page
            </button>
          </div>

          {/* Show technical details in development */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              fontSize: '0.875rem'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: '500', marginBottom: '0.5rem' }}>
                Technical Details (Development Only)
              </summary>
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ margin: '0.5rem 0', fontFamily: 'monospace', color: '#c33' }}>
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre style={{
                    margin: '0.5rem 0',
                    padding: '0.5rem',
                    backgroundColor: '#fff',
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '0.75rem'
                  }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>
          )}

          {/* Help link */}
          <div style={{
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #e0e0e0',
            fontSize: '0.875rem',
            color: '#666'
          }}>
            Need help? <a href="/support" style={{ color: '#4a9eff', textDecoration: 'none' }}>Contact Support</a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap components with ErrorBoundary
 * @param {React.Component} Component - Component to wrap
 * @param {Object} options - Options for error boundary
 * @returns {React.Component} Wrapped component
 */
export function withErrorBoundary(Component, options = {}) {
  return function WithErrorBoundary(props) {
    return (
      <ErrorBoundary onReset={options.onReset}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
