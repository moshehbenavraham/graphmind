import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: 'var(--error-color)',
            marginBottom: '1rem'
          }}>
            Something went wrong
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            marginBottom: '2rem',
            maxWidth: '600px'
          }}>
            We encountered an unexpected error. Please try refreshing the page.
          </p>
          {this.state.error && (
            <details style={{
              backgroundColor: 'var(--bg-secondary)',
              padding: '1rem',
              borderRadius: '0.5rem',
              marginBottom: '2rem',
              maxWidth: '800px',
              width: '100%',
              textAlign: 'left'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: '500', marginBottom: '0.5rem' }}>
                Error details
              </summary>
              <pre style={{
                overflow: 'auto',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)'
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.href = '/'}
            className="btn btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
