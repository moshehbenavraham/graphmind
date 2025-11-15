/**
 * QueryHistory Component (T165-T169)
 * Feature 008: Voice Query Input & Graph Querying
 *
 * Displays user's query history with pagination.
 * Allows viewing past questions and their results.
 */

import React, { useState, useEffect } from 'react';
import '../styles/QueryHistory.css';

const QueryHistory = ({ jwtToken, onQuerySelect }) => {
  const [queries, setQueries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    hasMore: false,
    total: 0
  });

  /**
   * T169: Fetch query history from GET /api/query/history
   */
  const fetchQueryHistory = async (offset = 0) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/query/history?limit=${pagination.limit}&offset=${offset}&order=desc`,
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch query history');
      }

      const data = await response.json();

      setQueries(data.queries || []);
      setPagination({
        ...pagination,
        offset,
        hasMore: data.has_more || false,
        total: data.total || 0
      });
    } catch (err) {
      console.error('Failed to fetch query history:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load history on mount
   */
  useEffect(() => {
    if (jwtToken) {
      fetchQueryHistory(0);
    }
  }, [jwtToken]);

  /**
   * T168: Handle pagination - next page
   */
  const handleNextPage = () => {
    const nextOffset = pagination.offset + pagination.limit;
    fetchQueryHistory(nextOffset);
  };

  /**
   * T168: Handle pagination - previous page
   */
  const handlePrevPage = () => {
    const prevOffset = Math.max(0, pagination.offset - pagination.limit);
    fetchQueryHistory(prevOffset);
  };

  /**
   * T167: Click to view query details
   */
  const handleQueryClick = async (query) => {
    if (onQuerySelect) {
      // If full results not loaded, fetch them
      if (!query.results) {
        try {
          const response = await fetch(`/api/query/${query.query_id}`, {
            headers: {
              'Authorization': `Bearer ${jwtToken}`
            }
          });

          if (response.ok) {
            const fullQuery = await response.json();
            onQuerySelect(fullQuery.query);
          } else {
            onQuerySelect(query); // Use cached data
          }
        } catch (err) {
          console.error('Failed to fetch query details:', err);
          onQuerySelect(query); // Fallback to cached data
        }
      } else {
        onQuerySelect(query);
      }
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  /**
   * Empty state
   */
  if (!isLoading && queries.length === 0) {
    return (
      <div className="query-history query-history--empty">
        <div className="query-history__empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35M11 8v3l2 2"/>
          </svg>
        </div>
        <h3 className="query-history__empty-title">No Query History</h3>
        <p className="query-history__empty-message">
          Your voice queries will appear here. Start by asking a question about your knowledge graph.
        </p>
      </div>
    );
  }

  return (
    <div className="query-history">
      {/* Header */}
      <div className="query-history__header">
        <h2 className="query-history__title">Query History</h2>
        {pagination.total > 0 && (
          <span className="query-history__count">
            {pagination.total} {pagination.total === 1 ? 'query' : 'queries'}
          </span>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="query-history__error" role="alert">
          <span>⚠️ {error}</span>
          <button onClick={() => fetchQueryHistory(pagination.offset)}>
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="query-history__loading">
          <div className="query-history__spinner"></div>
          <span>Loading history...</span>
        </div>
      )}

      {/* T166: Display query list (question, timestamp) */}
      {!isLoading && queries.length > 0 && (
        <div className="query-history__list">
          {queries.map((query) => (
            <div
              key={query.query_id}
              className="query-history__item"
              onClick={() => handleQueryClick(query)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleQueryClick(query);
              }}
            >
              <div className="query-history__item-main">
                <div className="query-history__item-question">
                  {query.question}
                </div>
                <div className="query-history__item-meta">
                  <span className="query-history__item-time">
                    {formatTimestamp(query.created_at)}
                  </span>
                  {query.entity_count !== undefined && (
                    <span className="query-history__item-stat">
                      {query.entity_count} {query.entity_count === 1 ? 'entity' : 'entities'}
                    </span>
                  )}
                  {query.latency_ms && (
                    <span className="query-history__item-stat">
                      {query.latency_ms}ms
                    </span>
                  )}
                  {query.cached && (
                    <span className="query-history__item-badge">cached</span>
                  )}
                </div>
              </div>

              <div className="query-history__item-arrow">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* T168: Pagination controls */}
      {queries.length > 0 && (
        <div className="query-history__pagination">
          <button
            className="query-history__pagination-button"
            onClick={handlePrevPage}
            disabled={pagination.offset === 0}
            aria-label="Previous page"
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Previous
          </button>

          <span className="query-history__pagination-info">
            Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
          </span>

          <button
            className="query-history__pagination-button"
            onClick={handleNextPage}
            disabled={!pagination.hasMore}
            aria-label="Next page"
          >
            Next
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default QueryHistory;
