import React from 'react';
import { createLogger } from '../utils/logger';
import { Button, Card, Badge } from '../design-system';

const logger = createLogger('WebSocketErrorBoundary');

/**
 * WebSocketErrorBoundary Component (Phase 4)
 *
 * Specialized error boundary for WebSocket connection failures.
 * Provides contextual recovery options for common connection errors:
 * - Connection refused/timeout
 * - Authentication failures
 * - Server unavailable
 * - Network issues
 *
 * Features:
 * - Categorizes errors for appropriate recovery actions
 * - Auto-retry with exponential backoff option
 * - Connection status indicator
 * - Neo-Brutalist styling consistent with design system
 */
class WebSocketErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCategory: null, // 'auth', 'network', 'server', 'unknown'
      retryCount: 0,
      isRetrying: false,
    };
    this.retryTimeoutRef = null;
  }

  static getDerivedStateFromError(error) {
    // Categorize the error for appropriate recovery UI
    let errorCategory = 'unknown';
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code?.toString() || '';

    if (
      errorMessage.includes('auth') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('401') ||
      errorCode === '401' ||
      errorCode === '403'
    ) {
      errorCategory = 'auth';
    } else if (
      errorMessage.includes('network') ||
      errorMessage.includes('offline') ||
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('connection refused')
    ) {
      errorCategory = 'network';
    } else if (
      errorMessage.includes('server') ||
      errorMessage.includes('503') ||
      errorMessage.includes('502') ||
      errorMessage.includes('unavailable')
    ) {
      errorCategory = 'server';
    }

    return {
      hasError: true,
      error,
      errorCategory,
    };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('boundary.websocket_caught', 'WebSocketErrorBoundary caught an error', {
      error: error?.message,
      category: this.state.errorCategory,
      stack: errorInfo?.componentStack,
    });

    // Call optional onError callback
    this.props.onError?.(error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutRef) {
      clearTimeout(this.retryTimeoutRef);
    }
  }

  /**
   * Calculate backoff delay for retry
   */
  getBackoffDelay() {
    const baseDelay = this.props.baseRetryDelay || 1000;
    const maxDelay = this.props.maxRetryDelay || 30000;
    const delay = Math.min(baseDelay * Math.pow(2, this.state.retryCount), maxDelay);
    return delay;
  }

  /**
   * Attempt to recover from the error
   */
  handleRetry = () => {
    const maxRetries = this.props.maxRetries || 3;

    if (this.state.retryCount >= maxRetries) {
      logger.warn('boundary.max_retries', 'Max retries reached', {
        retryCount: this.state.retryCount,
        maxRetries,
      });
      return;
    }

    logger.info('boundary.websocket_retry', 'Attempting WebSocket recovery', {
      retryCount: this.state.retryCount + 1,
    });

    this.setState({
      hasError: false,
      error: null,
      errorCategory: null,
      retryCount: this.state.retryCount + 1,
    });

    this.props.onRetry?.();
  };

  /**
   * Auto-retry with backoff
   */
  handleAutoRetry = () => {
    this.setState({ isRetrying: true });

    const delay = this.getBackoffDelay();
    logger.info('boundary.auto_retry_scheduled', 'Auto-retry scheduled', {
      delay_ms: delay,
      retryCount: this.state.retryCount + 1,
    });

    this.retryTimeoutRef = setTimeout(() => {
      this.setState({ isRetrying: false });
      this.handleRetry();
    }, delay);
  };

  /**
   * Reset error state completely
   */
  handleReset = () => {
    if (this.retryTimeoutRef) {
      clearTimeout(this.retryTimeoutRef);
    }

    this.setState({
      hasError: false,
      error: null,
      errorCategory: null,
      retryCount: 0,
      isRetrying: false,
    });

    this.props.onReset?.();
  };

  /**
   * Get recovery instructions based on error category
   */
  getRecoveryInstructions() {
    const maxRetries = this.props.maxRetries || 3;
    const canRetry = this.state.retryCount < maxRetries;

    switch (this.state.errorCategory) {
      case 'auth':
        return {
          title: 'Session Expired',
          description: 'Your session has expired or you are not authorized.',
          steps: [
            'Try logging in again',
            'Clear your browser cache and cookies',
            'Contact support if the problem persists',
          ],
          primaryAction: {
            label: 'Go to Login',
            handler: () => (window.location.href = '/login'),
          },
          showAutoRetry: false,
        };

      case 'network':
        return {
          title: 'Connection Lost',
          description: 'Unable to connect to the server. Check your internet connection.',
          steps: [
            'Check if you are connected to the internet',
            'Try disabling VPN or proxy if using one',
            'Wait a moment and try again',
          ],
          primaryAction: canRetry
            ? { label: 'Retry Now', handler: this.handleRetry }
            : { label: 'Refresh Page', handler: () => window.location.reload() },
          showAutoRetry: canRetry,
        };

      case 'server':
        return {
          title: 'Server Unavailable',
          description: 'The server is temporarily unavailable. Please try again later.',
          steps: [
            'The server may be undergoing maintenance',
            'Wait a few minutes and try again',
            'Check our status page for updates',
          ],
          primaryAction: canRetry
            ? { label: 'Retry Now', handler: this.handleRetry }
            : { label: 'Refresh Page', handler: () => window.location.reload() },
          showAutoRetry: canRetry,
        };

      default:
        return {
          title: 'Connection Error',
          description: 'An unexpected connection error occurred.',
          steps: [
            'Check your internet connection',
            'Try refreshing the page',
            'Contact support if the problem persists',
          ],
          primaryAction: canRetry
            ? { label: 'Retry', handler: this.handleRetry }
            : { label: 'Refresh Page', handler: () => window.location.reload() },
          showAutoRetry: canRetry,
        };
    }
  }

  render() {
    if (this.state.hasError) {
      const recovery = this.getRecoveryInstructions();
      const { fallback: FallbackComponent } = this.props;
      const maxRetries = this.props.maxRetries || 3;

      // Allow custom fallback component
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={this.state.error}
            errorCategory={this.state.errorCategory}
            onRetry={this.handleRetry}
            onReset={this.handleReset}
            retryCount={this.state.retryCount}
            isRetrying={this.state.isRetrying}
            recovery={recovery}
          />
        );
      }

      return (
        <Card className="max-w-lg mx-auto my-4">
          <Card.Body className="flex flex-col gap-4">
            {/* Error Icon */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-status-warning/10 border-brutal border-status-warning flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-status-warning"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <h3 className="font-mono text-lg font-bold uppercase tracking-wide text-brutal-charcoal">
                  {recovery.title}
                </h3>
                <p className="font-mono text-sm text-brutal-charcoal/70">
                  {recovery.description}
                </p>
              </div>
            </div>

            {/* Retry Status */}
            {this.state.retryCount > 0 && (
              <Badge
                variant={this.state.isRetrying ? 'warning' : 'secondary'}
                className="w-fit"
              >
                {this.state.isRetrying
                  ? 'Retrying...'
                  : `Retry ${this.state.retryCount}/${maxRetries}`}
              </Badge>
            )}

            {/* Recovery Steps */}
            <div className="bg-brutal-charcoal/5 border-brutal border-brutal-charcoal/20 p-4">
              <p className="font-mono text-sm font-bold uppercase tracking-wide text-brutal-charcoal mb-2">
                Troubleshooting
              </p>
              <ol className="list-decimal list-inside font-mono text-sm text-brutal-charcoal space-y-1">
                {recovery.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>

            {/* Error Details (collapsible) */}
            {this.state.error && (
              <details className="font-mono text-xs">
                <summary className="cursor-pointer text-brutal-charcoal/50 hover:text-brutal-charcoal">
                  Technical Details
                </summary>
                <pre className="mt-2 p-2 bg-brutal-charcoal/5 overflow-auto text-brutal-charcoal/70">
                  {this.state.error.toString()}
                  {this.state.error.code && `\nCode: ${this.state.error.code}`}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={recovery.primaryAction.handler}
                disabled={this.state.isRetrying}
              >
                {recovery.primaryAction.label}
              </Button>

              {recovery.showAutoRetry && !this.state.isRetrying && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={this.handleAutoRetry}
                >
                  Auto-Retry ({Math.round(this.getBackoffDelay() / 1000)}s)
                </Button>
              )}

              {this.state.retryCount > 0 && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={this.handleReset}
                >
                  Reset
                </Button>
              )}

              {this.props.onDismiss && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={this.props.onDismiss}
                >
                  Dismiss
                </Button>
              )}
            </div>
          </Card.Body>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default WebSocketErrorBoundary;
