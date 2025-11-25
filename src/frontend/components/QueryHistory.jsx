/**
 * QueryHistory Component (T165-T169)
 * Feature 008: Voice Query Input & Graph Querying
 *
 * Displays user's query history with pagination.
 * Allows viewing past questions and their results.
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, GlitchText, OffsetLayer, cn } from '../design-system';
import { motion, AnimatePresence } from 'framer-motion';
import { brutalStagger } from '../design-system';

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
  if (!isLoading && queries.length === 0 && !error) {
    return (
      <div className="w-full">
        <OffsetLayer variant="accent" size="lg">
          <Card variant="default" className="text-center py-12">
            <Card.Body>
              <svg className="w-16 h-16 mx-auto mb-6 text-brutal-charcoal/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35M11 8v3l2 2"/>
              </svg>
              <h3 className="text-xl font-bold mb-2">NO QUERY HISTORY</h3>
              <p className="font-mono text-sm text-brutal-charcoal/70 max-w-md mx-auto">
                Your voice queries will appear here. Start by asking a question about your knowledge graph.
              </p>
            </Card.Body>
          </Card>
        </OffsetLayer>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <GlitchText as="h2" className="text-2xl">
          Query History
        </GlitchText>
        {pagination.total > 0 && (
          <Badge variant="accent">
            {pagination.total} {pagination.total === 1 ? 'query' : 'queries'}
          </Badge>
        )}
      </div>

      {/* Error display */}
      {error && (
        <Card variant="default" className="border-status-error">
          <Card.Body>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="error">ERROR</Badge>
                <span className="font-mono text-sm">{error}</span>
              </div>
              <Button
                variant="secondary"
                onClick={() => fetchQueryHistory(pagination.offset)}
              >
                RETRY
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 gap-4">
          <div className="loading-brutal" />
          <span className="font-mono text-brutal-charcoal/70">Loading history...</span>
        </div>
      )}

      {/* T166: Display query list (question, timestamp) */}
      {!isLoading && queries.length > 0 && (
        <motion.div
          className="space-y-3"
          variants={brutalStagger.container}
          initial="hidden"
          animate="show"
        >
          <AnimatePresence>
            {queries.map((query, index) => (
              <motion.div
                key={query.query_id}
                variants={brutalStagger.item}
                layout
              >
                <Card
                  interactive
                  onClick={() => handleQueryClick(query)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleQueryClick(query);
                  }}
                >
                  <Card.Body>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Index badge */}
                        <Badge variant="default" className="mb-2">
                          #{pagination.offset + index + 1}
                        </Badge>

                        {/* Question */}
                        <p className="font-mono text-sm leading-relaxed mb-3 line-clamp-2">
                          {query.question}
                        </p>

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-brutal-charcoal/70">
                          <span className="tabular-nums">
                            {formatTimestamp(query.created_at)}
                          </span>
                          {query.entity_count !== undefined && (
                            <Badge variant="info">
                              {query.entity_count} {query.entity_count === 1 ? 'entity' : 'entities'}
                            </Badge>
                          )}
                          {query.latency_ms && (
                            <span className="tabular-nums">{query.latency_ms}ms</span>
                          )}
                          {query.cached && (
                            <Badge variant="success">CACHED</Badge>
                          )}
                        </div>
                      </div>

                      {/* Arrow indicator */}
                      <div className="flex-shrink-0 text-brutal-charcoal/50">
                        <svg className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* T168: Pagination controls */}
      {queries.length > 0 && (pagination.offset > 0 || pagination.hasMore) && (
        <div className="flex items-center justify-between pt-6 border-t-4 border-brutal-black">
          <Button
            variant="secondary"
            onClick={handlePrevPage}
            disabled={pagination.offset === 0}
            aria-label="Previous page"
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            PREVIOUS
          </Button>

          <span className="font-mono text-sm text-brutal-charcoal/70 tabular-nums">
            {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
          </span>

          <Button
            variant="secondary"
            onClick={handleNextPage}
            disabled={!pagination.hasMore}
            aria-label="Next page"
            className="flex items-center gap-2"
          >
            NEXT
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </Button>
        </div>
      )}
    </div>
  );
};

export default QueryHistory;
