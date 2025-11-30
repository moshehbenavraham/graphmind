import { useState, useRef, useCallback, useEffect } from 'react';
import { createLogger } from '../utils/logger';

/**
 * useWebSocket Hook - BULLETPROOF VERSION
 *
 * Provides WebSocket connection management with:
 * - Single connection guarantee (no duplicates)
 * - Automatic reconnection with exponential backoff
 * - Proper cleanup on unmount
 */
export const useWebSocket = (url, options = {}) => {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    autoConnect = true,
    maxReconnectAttempts = 3,
    baseReconnectDelay = 1000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // Refs for connection management - these prevent race conditions
  const wsRef = useRef(null);
  const connectingRef = useRef(false); // CRITICAL: ref-based lock
  const reconnectTimeoutRef = useRef(null);
  const shouldReconnectRef = useRef(true);
  const mountedRef = useRef(true);
  const urlRef = useRef(url);

  // Callback refs to avoid dependency issues
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);

  const logger = createLogger('useWebSocket');

  // Update callback refs
  useEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
  }, [onMessage, onOpen, onClose, onError]);

  // Update URL ref
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  /**
   * Connect to WebSocket - SINGLE CONNECTION GUARANTEED
   */
  const connect = useCallback((attemptNumber = 0) => {
    const currentUrl = urlRef.current;

    if (!currentUrl) {
      logger.error('connect.invalid_url', 'WebSocket URL is required');
      return;
    }

    // CRITICAL: Check ref-based lock FIRST (synchronous, no race condition)
    if (connectingRef.current) {
      logger.debug('connect.locked', 'Connection already in progress (ref lock)');
      return;
    }

    // Check if already connected
    if (wsRef.current) {
      const state = wsRef.current.readyState;
      if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) {
        logger.debug('connect.already_active', 'WebSocket already active', { readyState: state });
        return;
      }
    }

    if (attemptNumber >= maxReconnectAttempts) {
      logger.error('connect.max_attempts', 'Max reconnection attempts reached');
      if (mountedRef.current) {
        setIsConnecting(false);
      }
      onErrorRef.current?.({ code: 'MAX_RECONNECT_ATTEMPTS', message: 'Failed to connect' });
      return;
    }

    // SET LOCK IMMEDIATELY
    connectingRef.current = true;

    if (mountedRef.current) {
      setIsConnecting(true);
      setReconnectAttempt(attemptNumber);
    }

    logger.info('connect.start', 'Creating WebSocket', { url: currentUrl.replace(/token=[^&]+/, 'token=REDACTED'), attempt: attemptNumber });

    try {
      const ws = new WebSocket(currentUrl);
      wsRef.current = ws; // Set ref immediately after creation

      ws.onopen = (event) => {
        connectingRef.current = false; // Release lock
        logger.info('open', 'WebSocket connected');
        if (mountedRef.current) {
          setIsConnected(true);
          setIsConnecting(false);
          setReconnectAttempt(0);
        }
        onOpenRef.current?.(event);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch (err) {
          onMessageRef.current?.(event.data);
        }
      };

      ws.onerror = (event) => {
        logger.error('error', 'WebSocket error');
        onErrorRef.current?.(event);
      };

      ws.onclose = (event) => {
        connectingRef.current = false; // Release lock
        logger.info('close', 'WebSocket closed', { code: event.code, reason: event.reason });
        wsRef.current = null;

        if (mountedRef.current) {
          setIsConnected(false);
          setIsConnecting(false);
        }

        onCloseRef.current?.(event);

        // Reconnect if enabled and component still mounted
        if (shouldReconnectRef.current && mountedRef.current && attemptNumber < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, attemptNumber);
          logger.info('reconnect.schedule', 'Scheduling reconnect', { delay_ms: delay });
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect(attemptNumber + 1);
            }
          }, delay);
        }
      };
    } catch (err) {
      connectingRef.current = false; // Release lock on error
      logger.error('connect.exception', 'Failed to create WebSocket', { message: err.message });
      wsRef.current = null;
      if (mountedRef.current) {
        setIsConnecting(false);
      }
      onErrorRef.current?.(err);
    }
  }, [maxReconnectAttempts, baseReconnectDelay]); // Minimal dependencies

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    logger.info('disconnect', 'Disconnecting WebSocket');
    shouldReconnectRef.current = false;
    connectingRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    if (mountedRef.current) {
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, []);

  /**
   * Send message via WebSocket
   */
  const send = useCallback((data) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      logger.warn('send.not_connected', 'Cannot send - WebSocket not connected');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(message);
      return true;
    } catch (err) {
      logger.error('send.failed', 'Failed to send message', { message: err.message });
      return false;
    }
  }, []);

  /**
   * Auto-connect when URL changes (if autoConnect enabled)
   */
  useEffect(() => {
    if (url && autoConnect) {
      shouldReconnectRef.current = true;
      connect();
    }
    // Cleanup handled by unmount effect
  }, [url, autoConnect, connect]);

  /**
   * Cleanup on unmount ONLY
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      shouldReconnectRef.current = false;
      connectingRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
        wsRef.current = null;
      }
    };
  }, []); // Empty deps = unmount only

  return {
    isConnected,
    isConnecting,
    reconnectAttempt,
    connect,
    disconnect,
    send,
  };
};

export default useWebSocket;
