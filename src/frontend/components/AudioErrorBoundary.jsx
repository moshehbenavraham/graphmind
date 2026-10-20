import React from 'react';
import { createLogger } from '../utils/logger';
import { Button, Card } from '../design-system';

const logger = createLogger('AudioErrorBoundary');

/**
 * AudioErrorBoundary Component (Phase 4)
 *
 * Specialized error boundary for audio capture failures.
 * Provides contextual recovery options for common audio errors:
 * - Microphone permission denied
 * - Audio device not found
 * - Audio context failures
 * - Browser compatibility issues
 *
 * Features:
 * - Categorizes errors for appropriate recovery actions
 * - Allows component-level recovery without full page refresh
 * - Neo-Brutalist styling consistent with design system
 */
class AudioErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCategory: null, // 'permission', 'device', 'context', 'unknown'
    };
  }

  static getDerivedStateFromError(error) {
    // Categorize the error for appropriate recovery UI
    let errorCategory = 'unknown';
    const errorMessage = error?.message?.toLowerCase() || '';

    if (
      errorMessage.includes('permission') ||
      errorMessage.includes('notallowed') ||
      error?.name === 'NotAllowedError'
    ) {
      errorCategory = 'permission';
    } else if (
      errorMessage.includes('device') ||
      errorMessage.includes('microphone') ||
      errorMessage.includes('notfound') ||
      error?.name === 'NotFoundError'
    ) {
      errorCategory = 'device';
    } else if (
      errorMessage.includes('audiocontext') ||
      errorMessage.includes('audio context') ||
      errorMessage.includes('worklet')
    ) {
      errorCategory = 'context';
    }

    return {
      hasError: true,
      error,
      errorCategory,
    };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('boundary.audio_caught', 'AudioErrorBoundary caught an error', {
      error: error?.message,
      category: this.state.errorCategory,
      stack: errorInfo?.componentStack,
    });

    // Call optional onError callback
    this.props.onError?.(error, errorInfo);
  }

  /**
   * Attempt to recover from the error
   */
  handleRetry = () => {
    logger.info('boundary.audio_retry', 'Attempting audio recovery');
    this.setState({
      hasError: false,
      error: null,
      errorCategory: null,
    });
    this.props.onRetry?.();
  };

  /**
   * Request microphone permission
   */
  handleRequestPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      logger.info('boundary.permission_granted', 'Microphone permission granted');
      this.handleRetry();
    } catch (err) {
      logger.error('boundary.permission_failed', 'Failed to get permission', {
        error: err.message,
      });
    }
  };

  /**
   * Get recovery instructions based on error category
   */
  getRecoveryInstructions() {
    switch (this.state.errorCategory) {
      case 'permission':
        return {
          title: 'Microphone Access Required',
          description: 'Voice recording needs permission to access your microphone.',
          steps: [
            'Click the lock/site settings icon in your browser address bar',
            'Find "Microphone" in the permissions list',
            'Change the setting to "Allow"',
            'Click the retry button below',
          ],
          primaryAction: {
            label: 'Request Permission',
            handler: this.handleRequestPermission,
          },
        };

      case 'device':
        return {
          title: 'No Microphone Found',
          description: 'We could not find a microphone connected to your device.',
          steps: [
            'Connect a microphone or headset with a microphone',
            'Check that your microphone is not muted or disabled',
            'Try using a different USB port if using an external device',
            'Click retry after connecting a microphone',
          ],
          primaryAction: {
            label: 'Retry',
            handler: this.handleRetry,
          },
        };

      case 'context':
        return {
          title: 'Audio System Error',
          description: 'There was a problem initializing the audio system.',
          steps: [
            'Close other applications that may be using audio',
            'Try refreshing the page',
            'If the problem persists, try a different browser',
          ],
          primaryAction: {
            label: 'Retry',
            handler: this.handleRetry,
          },
        };

      default:
        return {
          title: 'Audio Recording Error',
          description: 'An unexpected error occurred with audio recording.',
          steps: [
            'Check your microphone connection',
            'Ensure no other app is using the microphone',
            'Try refreshing the page',
          ],
          primaryAction: {
            label: 'Retry',
            handler: this.handleRetry,
          },
        };
    }
  }

  render() {
    if (this.state.hasError) {
      const recovery = this.getRecoveryInstructions();
      const { fallback: FallbackComponent } = this.props;

      // Allow custom fallback component
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={this.state.error}
            errorCategory={this.state.errorCategory}
            onRetry={this.handleRetry}
            recovery={recovery}
          />
        );
      }

      return (
        <Card className="max-w-lg mx-auto my-4">
          <Card.Body className="flex flex-col gap-4">
            {/* Error Icon */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-status-error/10 border-brutal border-status-error flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-status-error"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  <path
                    fillRule="evenodd"
                    d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
                    clipRule="evenodd"
                    opacity="0.3"
                  />
                  <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" />
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

            {/* Recovery Steps */}
            <div className="bg-brutal-charcoal/5 border-brutal border-brutal-charcoal/20 p-4">
              <p className="font-mono text-sm font-bold uppercase tracking-wide text-brutal-charcoal mb-2">
                How to Fix
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
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={recovery.primaryAction.handler}
              >
                {recovery.primaryAction.label}
              </Button>
              {this.props.onDismiss && (
                <Button
                  variant="secondary"
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

export default AudioErrorBoundary;
