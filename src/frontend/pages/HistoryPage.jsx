import { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import { api } from '../utils/api';

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
    <div>
      <Navigation />
      <div className="container" style={{ maxWidth: '900px', padding: '2rem 1rem' }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: 'var(--text-primary)'
        }}>
          Query History
        </h1>

        {error && (
          <div style={{
            backgroundColor: '#FEE2E2',
            border: '1px solid var(--error-color)',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '2rem',
            color: 'var(--error-color)'
          }}>
            {error}
          </div>
        )}

        {loading && page === 1 ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '4rem 0'
          }}>
            <div className="loading" style={{ width: '3rem', height: '3rem' }}></div>
          </div>
        ) : queries.length === 0 ? (
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: '3rem',
            borderRadius: '0.5rem',
            boxShadow: 'var(--shadow)',
            textAlign: 'center'
          }}>
            <p style={{
              fontSize: '1.125rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem'
            }}>
              No queries yet. Start by asking a question!
            </p>
            <a href="/query" className="btn btn-primary">
              Ask Your First Question
            </a>
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              {queries.map((query) => (
                <div
                  key={query.id}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    padding: '1.5rem',
                    borderRadius: '0.5rem',
                    boxShadow: 'var(--shadow)',
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => toggleExpand(query.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem'
                  }}>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      flex: 1
                    }}>
                      {query.query_text || 'No question recorded'}
                    </h3>
                    <span style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      marginLeft: '1rem'
                    }}>
                      {formatDate(query.created_at)}
                    </span>
                  </div>

                  {expandedQuery === query.id && (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{
                        backgroundColor: 'var(--bg-secondary)',
                        padding: '1rem',
                        borderRadius: '0.375rem',
                        marginBottom: '1rem'
                      }}>
                        <h4 style={{
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: 'var(--text-secondary)',
                          marginBottom: '0.5rem',
                          textTransform: 'uppercase'
                        }}>
                          Answer
                        </h4>
                        <p style={{ color: 'var(--text-primary)' }}>
                          {query.answer_text || 'No answer available'}
                        </p>
                      </div>

                      {query.audio_url && (
                        <div style={{ marginBottom: '1rem' }}>
                          <h4 style={{
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: 'var(--text-secondary)',
                            marginBottom: '0.5rem',
                            textTransform: 'uppercase'
                          }}>
                            Audio Answer
                          </h4>
                          <audio controls src={query.audio_url} style={{ width: '100%' }}>
                            Your browser does not support audio playback.
                          </audio>
                        </div>
                      )}

                      {query.graph_context && (
                        <div>
                          <h4 style={{
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: 'var(--text-secondary)',
                            marginBottom: '0.5rem',
                            textTransform: 'uppercase'
                          }}>
                            Graph Data
                          </h4>
                          <pre style={{
                            backgroundColor: 'var(--bg-secondary)',
                            padding: '1rem',
                            borderRadius: '0.375rem',
                            overflow: 'auto',
                            fontSize: '0.75rem',
                            maxHeight: '200px'
                          }}>
                            {typeof query.graph_context === 'string'
                              ? query.graph_context
                              : JSON.stringify(query.graph_context, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {expandedQuery !== query.id && (
                    <p style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.875rem'
                    }}>
                      Click to view answer and details
                    </p>
                  )}
                </div>
              ))}
            </div>

            {hasMore && (
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;
