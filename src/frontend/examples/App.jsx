import React, { useState, useEffect } from 'react';
import VoiceRecorder from '../components/VoiceRecorder';
import { checkAudioCapabilities } from '../utils/audioUtils';

/**
 * Example App component demonstrating VoiceRecorder usage
 *
 * This shows how to integrate the VoiceRecorder component
 * in a real application with authentication and configuration.
 */
function App() {
  const [authToken, setAuthToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [capabilities, setCapabilities] = useState(null);

  // Configuration
  const API_URL = import.meta.env.VITE_API_URL || 'https://graphmind-api.workers.dev';

  /**
   * Initialize app - check capabilities and authenticate
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        // Check browser capabilities
        const caps = checkAudioCapabilities();
        setCapabilities(caps);

        if (!caps.supported) {
          setError(`Your browser doesn't support required features: ${caps.unsupportedFeatures.join(', ')}`);
          setIsLoading(false);
          return;
        }

        // Get auth token (from localStorage or API)
        const token = localStorage.getItem('auth_token');

        if (!token) {
          // Redirect to login if no token
          window.location.href = '/login';
          return;
        }

        // Verify token is valid
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // Token invalid, redirect to login
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
          return;
        }

        setAuthToken(token);
        setIsLoading(false);
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Failed to initialize application');
        setIsLoading(false);
      }
    };

    initialize();
  }, [API_URL]);

  /**
   * Handle logout
   */
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  };

  /**
   * Render loading state
   */
  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading GraphMind...</p>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="app-error">
        <h2>Error</h2>
        <p>{error}</p>
        {capabilities && !capabilities.supported && (
          <div className="browser-requirements">
            <h3>Browser Requirements:</h3>
            <ul>
              <li>WebRTC support (getUserMedia)</li>
              <li>MediaRecorder API</li>
              <li>WebSocket API</li>
              <li>FileReader API</li>
            </ul>
            <p>Please use a modern browser like Chrome, Firefox, or Safari.</p>
          </div>
        )}
      </div>
    );
  }

  /**
   * Render main app
   */
  return (
    <div className="app">
      <header className="app-header">
        <h1>GraphMind Voice Notes</h1>
        <nav>
          <a href="/notes">My Notes</a>
          <a href="/graph">Knowledge Graph</a>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </nav>
      </header>

      <main className="app-main">
        <div className="recorder-section">
          <h2>Record Voice Note</h2>
          <p className="instructions">
            Click "Start Recording" and speak naturally. Your voice will be
            transcribed in real-time and saved to your knowledge graph.
          </p>

          <VoiceRecorder apiUrl={API_URL} authToken={authToken} />
        </div>

        <aside className="app-sidebar">
          <div className="quick-tips">
            <h3>Quick Tips</h3>
            <ul>
              <li>Speak clearly and at a normal pace</li>
              <li>Mention names, dates, and projects explicitly</li>
              <li>Recordings are limited to 10 minutes</li>
              <li>Your transcript appears in real-time</li>
            </ul>
          </div>

          <div className="browser-info">
            <h3>Browser Status</h3>
            <ul>
              <li>
                <span className={capabilities?.mediaDevices ? 'status-ok' : 'status-error'}>
                  {capabilities?.mediaDevices ? '✓' : '✗'}
                </span>
                Media Devices API
              </li>
              <li>
                <span className={capabilities?.getUserMedia ? 'status-ok' : 'status-error'}>
                  {capabilities?.getUserMedia ? '✓' : '✗'}
                </span>
                Microphone Access
              </li>
              <li>
                <span className={capabilities?.mediaRecorder ? 'status-ok' : 'status-error'}>
                  {capabilities?.mediaRecorder ? '✓' : '✗'}
                </span>
                MediaRecorder API
              </li>
              <li>
                <span className={capabilities?.webSocket ? 'status-ok' : 'status-error'}>
                  {capabilities?.webSocket ? '✓' : '✗'}
                </span>
                WebSocket API
              </li>
            </ul>
          </div>
        </aside>
      </main>

      <style jsx>{`
        .app {
          min-height: 100vh;
          background: #f5f5f5;
        }

        .app-header {
          background: white;
          border-bottom: 1px solid #e0e0e0;
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .app-header h1 {
          margin: 0;
          font-size: 1.5rem;
          color: #333;
        }

        .app-header nav {
          display: flex;
          gap: 1.5rem;
          align-items: center;
        }

        .app-header nav a {
          color: #666;
          text-decoration: none;
          font-weight: 500;
        }

        .app-header nav a:hover {
          color: #007bff;
        }

        .btn-logout {
          padding: 0.5rem 1rem;
          background: #f0f0f0;
          border: 1px solid #ccc;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }

        .btn-logout:hover {
          background: #e0e0e0;
        }

        .app-main {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 2rem;
        }

        .recorder-section {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .recorder-section h2 {
          margin-top: 0;
          color: #333;
        }

        .instructions {
          color: #666;
          line-height: 1.6;
          margin-bottom: 2rem;
        }

        .app-sidebar {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .quick-tips,
        .browser-info {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .quick-tips h3,
        .browser-info h3 {
          margin-top: 0;
          font-size: 1rem;
          color: #333;
        }

        .quick-tips ul,
        .browser-info ul {
          margin: 0;
          padding-left: 1.5rem;
          color: #666;
        }

        .quick-tips li,
        .browser-info li {
          margin-bottom: 0.5rem;
        }

        .browser-info li {
          list-style: none;
          padding-left: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .status-ok {
          color: #28a745;
          font-weight: bold;
        }

        .status-error {
          color: #dc3545;
          font-weight: bold;
        }

        .app-loading,
        .app-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 2rem;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e0e0e0;
          border-top-color: #007bff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .app-error h2 {
          color: #dc3545;
        }

        .browser-requirements {
          margin-top: 2rem;
          padding: 1.5rem;
          background: #f8f9fa;
          border-radius: 8px;
          max-width: 500px;
        }

        .browser-requirements h3 {
          margin-top: 0;
        }

        @media (max-width: 768px) {
          .app-main {
            grid-template-columns: 1fr;
          }

          .app-header {
            flex-direction: column;
            gap: 1rem;
          }

          .app-header nav {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
