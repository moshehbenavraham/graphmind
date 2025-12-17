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

const VoiceQueryApp = ({ jwtToken }) => {
  const [currentResults, setCurrentResults] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Handle query completion from recorder (Feature 008)
   */
  const handleQueryComplete = (data) => {
    setCurrentQuestion(data.question);
    setCurrentResults(data.results);
    setError(null);
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
