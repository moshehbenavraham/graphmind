/**
 * VoiceQueryApp - Main application component for Feature 008 & 010
 * Integrates VoiceQueryRecorder, QueryResults, QueryHistory, and AudioPlayer
 *
 * Feature 010: Text-to-Speech Responses
 */

import React, { useState } from 'react';
import VoiceQueryRecorder from './VoiceQueryRecorder.jsx';
import QueryResults from './QueryResults.jsx';
import QueryHistory from './QueryHistory.jsx';
import AudioPlayer from './AudioPlayer.jsx';

const VoiceQueryApp = ({ jwtToken }) => {
  const [currentResults, setCurrentResults] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState(null);

  // Audio playback state (Feature 010)
  const [audioPlaybackStatus, setAudioPlaybackStatus] = useState('idle');
  const [audioDuration, setAudioDuration] = useState(0);
  const [websocketRef, setWebsocketRef] = useState(null);

  /**
   * Handle query completion from recorder (Feature 008 & 010)
   */
  const handleQueryComplete = (data) => {
    setCurrentQuestion(data.question);
    setCurrentResults(data.results);
    setCurrentAnswer(data.answer || '');
    setError(null);

    // Reset audio state
    setAudioPlaybackStatus('idle');
    setAudioDuration(0);
  };

  /**
   * Handle audio metadata (Feature 010)
   */
  const handleAudioMetadata = (metadata) => {
    if (metadata.duration_ms) {
      setAudioDuration(metadata.duration_ms);
    }
  };

  /**
   * Handle playback control (Feature 010)
   */
  const handlePlaybackControl = (action) => {
    if (websocketRef && websocketRef.readyState === WebSocket.OPEN) {
      websocketRef.send(JSON.stringify({
        type: 'playback_control',
        action: action
      }));
    }
  };

  /**
   * Handle playback status updates (Feature 010)
   */
  const handlePlaybackStatusUpdate = (status) => {
    setAudioPlaybackStatus(status);
  };

  /**
   * Handle query selection from history
   */
  const handleHistorySelect = (query) => {
    setCurrentQuestion(query.question);
    setCurrentResults(query.results ? JSON.parse(query.results) : null);
    setShowHistory(false);
  };

  /**
   * Handle errors
   */
  const handleError = (err) => {
    setError(err.message);
    console.error('Voice query error:', err);
  };

  return (
    <div className="voice-query-app">
      <header className="voice-query-app__header">
        <h1>GraphMind Voice Query</h1>
        <button
          className="voice-query-app__history-toggle"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? 'Ask Question' : 'View History'}
        </button>
      </header>

      <main className="voice-query-app__main">
        {error && (
          <div className="voice-query-app__error">
            ⚠️ {error}
          </div>
        )}

        {showHistory ? (
          <QueryHistory
            jwtToken={jwtToken}
            onQuerySelect={handleHistorySelect}
          />
        ) : (
          <>
            <VoiceQueryRecorder
              jwtToken={jwtToken}
              onQueryComplete={handleQueryComplete}
              onError={handleError}
            />

            {currentResults && (
              <QueryResults
                results={currentResults}
                question={currentQuestion}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default VoiceQueryApp;
