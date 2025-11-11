import { useEffect, useRef, useCallback, useState } from 'react';

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

  /**
   * Connect to WebSocket
   */
  const connect = useCallback((attemptNumber = 0) => {
    if (!url) {
      console.error('WebSocket URL is required');
      return;
    }

    if (attemptNumber >= maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
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
        console.log('WebSocket connected');
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
          console.error('Failed to parse WebSocket message:', err);
          onMessage?.(event.data); // Pass raw data if JSON parsing fails
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        onError?.(event);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        onClose?.(event);

        // Attempt reconnection if enabled
        if (shouldReconnectRef.current && attemptNumber < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, attemptNumber);
          console.log(`Reconnecting in ${delay}ms (attempt ${attemptNumber + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect(attemptNumber + 1);
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
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
      console.warn('WebSocket is not connected');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(message);
      return true;
    } catch (err) {
      console.error('Failed to send WebSocket message:', err);
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
