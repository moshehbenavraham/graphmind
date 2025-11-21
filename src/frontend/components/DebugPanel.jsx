/**
 * DebugPanel Component
 *
 * Real-time debug panel for GraphMind that captures and displays:
 * - All frontend logs (trace, debug, info, warn, error)
 * - WebSocket messages
 * - API requests/responses
 * - System state
 * - Error history
 *
 * Usage:
 * - Press Ctrl+Shift+D (or Cmd+Shift+D on Mac) to toggle panel
 * - Or call window.graphmindDebug.toggle() in console
 * - Or call window.graphmindDebug.enable() / .disable()
 */

import { useState, useEffect, useRef } from 'react';
import { getLoggingState, enableVerboseLoggingWindow } from '../utils/logger';

function DebugPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all'); // all, error, warn, info, debug, trace
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [loggingState, setLoggingState] = useState(getLoggingState());
  const logsEndRef = useRef(null);
  const maxLogs = 500;

  // Capture console logs
  useEffect(() => {
    if (!isVisible) return;

    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    const captureLog = (level, ...args) => {
      if (isPaused) return;

      const timestamp = new Date().toISOString();
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');

      setLogs(prev => {
        const newLogs = [...prev, { level, message, timestamp, id: Date.now() + Math.random() }];
        return newLogs.slice(-maxLogs); // Keep only last maxLogs entries
      });
    };

    console.log = (...args) => {
      captureLog('debug', ...args);
      originalConsole.log(...args);
    };

    console.info = (...args) => {
      captureLog('info', ...args);
      originalConsole.info(...args);
    };

    console.warn = (...args) => {
      captureLog('warn', ...args);
      originalConsole.warn(...args);
    };

    console.error = (...args) => {
      captureLog('error', ...args);
      originalConsole.error(...args);
    };

    console.debug = (...args) => {
      captureLog('debug', ...args);
      originalConsole.debug(...args);
    };

    return () => {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.debug = originalConsole.debug;
    };
  }, [isVisible, isPaused]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Keyboard shortcut: Ctrl+Shift+D or Cmd+Shift+D
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Expose debug controls to window
  useEffect(() => {
    window.graphmindDebug = {
      toggle: () => setIsVisible(prev => !prev),
      show: () => setIsVisible(true),
      hide: () => setIsVisible(false),
      clear: () => setLogs([]),
      pause: () => setIsPaused(true),
      resume: () => setIsPaused(false),
      enableVerbose: (minutes = 10) => {
        const success = enableVerboseLoggingWindow(minutes);
        setLoggingState(getLoggingState());
        return success;
      },
      getState: () => ({
        visible: isVisible,
        paused: isPaused,
        logCount: logs.length,
        filter,
        loggingState
      })
    };

    return () => {
      delete window.graphmindDebug;
    };
  }, [isVisible, isPaused, logs.length, filter, loggingState]);

  if (!isVisible) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999
      }}>
        <button
          onClick={() => setIsVisible(true)}
          style={{
            padding: '10px 15px',
            backgroundColor: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
          }}
          title="Open Debug Panel (Ctrl+Shift+D)"
        >
          🐛 Debug
        </button>
      </div>
    );
  }

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.level === filter);

  const levelColors = {
    error: '#FF5555',
    warn: '#FFB86C',
    info: '#50FA7B',
    debug: '#8BE9FD',
    trace: '#BD93F9'
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      right: 0,
      width: '600px',
      height: '500px',
      backgroundColor: '#1E1E1E',
      color: '#D4D4D4',
      fontFamily: 'monospace',
      fontSize: '12px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      boxShadow: '0 -2px 20px rgba(0,0,0,0.5)',
      borderTop: '2px solid #333'
    }}>
      {/* Header */}
      <div style={{
        padding: '10px',
        backgroundColor: '#252526',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
          🐛 GraphMind Debug Panel
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#888' }}>
            {filteredLogs.length} logs
          </span>
          <button
            onClick={() => setIsVisible(false)}
            style={{
              padding: '5px 10px',
              backgroundColor: 'transparent',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        padding: '8px 10px',
        backgroundColor: '#2D2D2D',
        borderBottom: '1px solid #333',
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '4px 8px',
            backgroundColor: '#1E1E1E',
            color: '#D4D4D4',
            border: '1px solid #555',
            borderRadius: '3px',
            fontSize: '11px'
          }}
        >
          <option value="all">All Levels</option>
          <option value="error">❌ Errors</option>
          <option value="warn">⚠️  Warnings</option>
          <option value="info">ℹ️  Info</option>
          <option value="debug">🔍 Debug</option>
          <option value="trace">📝 Trace</option>
        </select>

        <button
          onClick={() => setIsPaused(prev => !prev)}
          style={{
            padding: '4px 8px',
            backgroundColor: isPaused ? '#FFB86C' : '#1E1E1E',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          {isPaused ? '▶️ Resume' : '⏸️ Pause'}
        </button>

        <button
          onClick={() => setAutoScroll(prev => !prev)}
          style={{
            padding: '4px 8px',
            backgroundColor: autoScroll ? '#50FA7B' : '#1E1E1E',
            color: autoScroll ? '#000' : '#fff',
            border: '1px solid #555',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          {autoScroll ? '📜 Auto' : '📜 Manual'}
        </button>

        <button
          onClick={() => setLogs([])}
          style={{
            padding: '4px 8px',
            backgroundColor: '#1E1E1E',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          🗑️ Clear
        </button>

        <button
          onClick={() => {
            enableVerboseLoggingWindow(10);
            setLoggingState(getLoggingState());
          }}
          style={{
            padding: '4px 8px',
            backgroundColor: loggingState.verbose ? '#BD93F9' : '#1E1E1E',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          {loggingState.verbose ? '🔊 Verbose ON' : '🔇 Verbose OFF'}
        </button>

        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#888' }}>
          Ctrl+Shift+D to toggle
        </span>
      </div>

      {/* System Status */}
      <div style={{
        padding: '6px 10px',
        backgroundColor: '#252526',
        borderBottom: '1px solid #333',
        fontSize: '10px',
        color: '#888',
        display: 'flex',
        gap: '15px'
      }}>
        <span>Debug: {loggingState.debug ? '✅' : '❌'}</span>
        <span>Verbose: {loggingState.verbose ? '✅' : '❌'}</span>
        <span>Remote: {loggingState.remote ? '✅' : '❌'}</span>
        {loggingState.verbose_until > Date.now() && (
          <span style={{ color: '#BD93F9' }}>
            Verbose until: {new Date(loggingState.verbose_until).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Logs */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px',
        backgroundColor: '#1E1E1E'
      }}>
        {filteredLogs.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center', marginTop: '50px' }}>
            No logs to display. {isPaused && 'Logging is paused.'}
          </div>
        ) : (
          filteredLogs.map(log => (
            <div
              key={log.id}
              style={{
                marginBottom: '8px',
                paddingBottom: '8px',
                borderBottom: '1px solid #2D2D2D',
                fontFamily: 'monospace',
                fontSize: '11px'
              }}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ color: '#666', fontSize: '10px' }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span style={{
                  color: levelColors[log.level] || '#888',
                  fontWeight: 'bold',
                  fontSize: '10px',
                  textTransform: 'uppercase'
                }}>
                  {log.level}
                </span>
              </div>
              <pre style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: '#D4D4D4'
              }}>
                {log.message}
              </pre>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 10px',
        backgroundColor: '#252526',
        borderTop: '1px solid #333',
        fontSize: '10px',
        color: '#666',
        textAlign: 'center'
      }}>
        Use <code>window.graphmindDebug</code> in console for more controls
      </div>
    </div>
  );
}

export default DebugPanel;
