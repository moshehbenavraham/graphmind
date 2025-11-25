import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { api } from '../utils/api';
import {
  GlitchText,
  Card,
  Button,
  Badge,
  OffsetLayer,
} from '../design-system';

function HistoryPage() {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [expandedQuery, setExpandedQuery] = useState(null);

  useEffect(() => {
    loadHistory();
  }, [page]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await api.getQueryHistory(page, 20);

      if (page === 1) {
        setQueries(response.queries || []);
      } else {
        setQueries(prev => [...prev, ...(response.queries || [])]);
      }

      setHasMore(response.has_more || false);
      setError('');
    } catch (err) {
      console.error('Error loading history:', err);
      setError(err.message || 'Failed to load query history');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  const toggleExpand = (queryId) => {
    setExpandedQuery(expandedQuery === queryId ? null : queryId);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-[#FFFEF0]">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Page Header */}
        <GlitchText as="h1" className="text-3xl md:text-4xl mb-8">
          Query History
        </GlitchText>

        {/* Error Display */}
        {error && (
          <Card className="mb-8 border-status-error">
            <Card.Body className="bg-status-error/10">
              <Badge variant="error" className="mb-2">Error</Badge>
              <p className="text-brutal-charcoal font-mono text-sm">{error}</p>
            </Card.Body>
          </Card>
        )}

        {/* Loading State */}
        {loading && page === 1 ? (
          <div className="flex justify-center py-16">
            <div className="loading-brutal w-12 h-12" />
          </div>
        ) : queries.length === 0 ? (
          /* Empty State */
          <OffsetLayer variant="accent" size="lg">
            <Card className="text-center py-12">
              <Card.Body>
                <p className="text-lg text-brutal-charcoal/70 mb-6 font-mono">
                  No queries yet. Start by asking a question!
                </p>
                <Link to="/query">
                  <Button variant="primary">
                    Ask Your First Question
                  </Button>
                </Link>
              </Card.Body>
            </Card>
          </OffsetLayer>
        ) : (
          /* Query List */
          <>
            <div className="space-y-4 mb-8">
              {queries.map((query, index) => (
                <Card
                  key={query.id}
                  interactive
                  onClick={() => toggleExpand(query.id)}
                  className={expandedQuery === query.id ? 'border-accent-primary' : ''}
                >
                  <Card.Body>
                    {/* Query Header */}
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="accent" className="text-xs">
                            #{String(index + 1).padStart(3, '0')}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-brutal-charcoal truncate">
                          {query.query_text || 'No question recorded'}
                        </h3>
                      </div>
                      <span className="text-xs text-brutal-charcoal/50 font-mono whitespace-nowrap">
                        {formatDate(query.created_at)}
                      </span>
                    </div>

                    {/* Expanded Content */}
                    {expandedQuery === query.id && (
                      <div className="mt-4 pt-4 border-t-2 border-brutal-black/10 space-y-4">
                        {/* Answer Section */}
                        <div className="terminal-brutal">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 bg-status-error border border-brutal-black" />
                            <div className="w-3 h-3 bg-status-warning border border-brutal-black" />
                            <div className="w-3 h-3 bg-status-success border border-brutal-black" />
                            <span className="text-xs uppercase tracking-widest font-bold ml-2">
                              Answer
                            </span>
                          </div>
                          <p className="text-brutal-cream font-mono text-sm leading-relaxed">
                            <span className="text-accent-primary">&gt;</span>{' '}
                            {query.answer_text || 'No answer available'}
                          </p>
                        </div>

                        {/* Audio Player */}
                        {query.audio_url && (
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-brutal-charcoal/70 mb-2">
                              Audio Answer
                            </h4>
                            <audio controls src={query.audio_url} className="w-full">
                              Your browser does not support audio playback.
                            </audio>
                          </div>
                        )}

                        {/* Graph Context */}
                        {query.graph_context && (
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-brutal-charcoal/70 mb-2">
                              Graph Data
                            </h4>
                            <pre className="terminal-brutal text-xs overflow-auto max-h-48 text-status-success">
                              {typeof query.graph_context === 'string'
                                ? query.graph_context
                                : JSON.stringify(query.graph_context, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Collapsed Hint */}
                    {expandedQuery !== query.id && (
                      <p className="text-brutal-charcoal/50 text-xs font-mono mt-2">
                        Click to view answer and details
                      </p>
                    )}
                  </Card.Body>
                </Card>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center">
                <Button
                  onClick={loadMore}
                  disabled={loading}
                  loading={loading}
                  variant="secondary"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;
