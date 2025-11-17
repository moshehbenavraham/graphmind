import { useEffect, useRef, useCallback, useState } from 'react';
import { createLogger } from '../utils/logger';

/**
 * Custom hook for managing WebSocket connections with automatic reconnection
 *
 * @param {string} url - WebSocket URL
 * @param {Object} options - Configuration options
 * @param {number} options.maxReconnectAttempts - Maximum reconnection attempts (default: 3)
 * @param {number} options.baseReconnectDelay - Base delay for exponential backoff (default: 1000ms)
 * @param {Function} options.onMessage - Message handler
 * @param {Function} options.onOpen - Connection open handler
 * @param {Function} options.onClose - Connection close handler
 * @param {Function} options.onError - Error handler
 * @param {boolean} options.autoConnect - Auto-connect on mount (default: false)
 *
 * @returns {Object} WebSocket utilities
 */
export const useWebSocket = (url, options = {}) => {
  const {
    maxReconnectAttempts = 3,
    baseReconnectDelay = 1000,
    onMessage,
    onOpen,
    onClose,
    onError,
    autoConnect = false,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const shouldReconnectRef = useRef(true);
  const logger = createLogger('useWebSocket', { url });

  /**
   * Connect to WebSocket
   */
  const connect = useCallback((attemptNumber = 0) => {
    if (!url) {
      logger.error('connect.invalid_url', 'WebSocket URL is required');
      return;
    }

    if (attemptNumber >= maxReconnectAttempts) {
      logger.error('connect.max_attempts', 'Max reconnection attempts reached', { attemptNumber });
      setIsConnecting(false);
      onError?.({
        code: 'MAX_RECONNECT_ATTEMPTS',
        message: 'Failed to connect after multiple attempts',
      });
      return;
    }

    setIsConnecting(true);
    setReconnectAttempt(attemptNumber);

    try {
      const ws = new WebSocket(url);

      ws.onopen = (event) => {
        logger.info('open', 'WebSocket connected', { attemptNumber });
        setIsConnected(true);
        setIsConnecting(false);
        setReconnectAttempt(0);
        onOpen?.(event);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (err) {
          logger.warn('message.parse_failed', 'Failed to parse WebSocket message', {
            message: err.message
          });
          onMessage?.(event.data); // Pass raw data if JSON parsing fails
        }
      };

      ws.onerror = (event) => {
        logger.error('error', 'WebSocket error', { event });
        onError?.(event);
      };

      ws.onclose = (event) => {
        logger.info('close', 'WebSocket closed', {
          code: event.code,
          reason: event.reason
        });
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        onClose?.(event);

        // Attempt reconnection if enabled
        if (shouldReconnectRef.current && attemptNumber < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, attemptNumber);
          logger.info('reconnect.schedule', 'Scheduling reconnect', {
            delay_ms: delay,
            attempt: attemptNumber + 1,
            max: maxReconnectAttempts
          });

          reconnectTimeoutRef.current = setTimeout(() => {
            connect(attemptNumber + 1);
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      logger.error('connect.exception', 'Failed to create WebSocket', { message: err.message });
      setIsConnecting(false);
      onError?.(err);
    }
  }, [url, maxReconnectAttempts, baseReconnectDelay, onMessage, onOpen, onClose, onError]);

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setReconnectAttempt(0);
  }, []);

  /**
   * Send message via WebSocket
   */
  const send = useCallback((data) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      logger.warn('send.disconnected', 'WebSocket is not connected');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(message);
      logger.trace('send.sent', 'WebSocket message sent', { bytes: message.length });
      return true;
    } catch (err) {
      logger.error('send.failed', 'Failed to send WebSocket message', { message: err.message });
      return false;
    }
  }, []);

  /**
   * Auto-connect on mount if enabled
   */
  useEffect(() => {
    if (autoConnect) {
      shouldReconnectRef.current = true;
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    reconnectAttempt,
    connect,
    disconnect,
    send,
    websocket: wsRef.current,
  };
};

export default useWebSocket;
