import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { createLogger } from '../utils/logger';
import api from '../utils/api.js';
import Navigation from '../components/Navigation';

const logger = createLogger('dashboard');
const SEED_TIMEOUT_MS = 20000;

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');
  const [seedError, setSeedError] = useState('');

  const handleSeedData = async () => {
    setSeedLoading(true);
    setSeedMessage('');
    setSeedError('');
    logger.info('seed.click', 'Add Test Data clicked', { user: user?.email });

    try {
      const data = await api.seedData({ timeoutMs: SEED_TIMEOUT_MS });

      if (data.success) {
        setSeedMessage('✅ Test data successfully added! Try asking: "Who works on GraphMind?"');
      } else if (data.existing_data) {
        setSeedMessage('ℹ️ Your graph already has data. Seed data is only added to empty graphs.');
      } else {
        const message = data.message || 'Failed to add seed data';
        setSeedError(message);
        logger.error('seed.response_error', 'Seed data API returned error', { message });
      }
    } catch (error) {
      console.error('[Dashboard] Seed data error:', error);
      const message = error?.message || 'Failed to add seed data. Please try again.';
      setSeedError(message);
      logger.error('seed.exception', 'Seed data request failed', { message });
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <div>
      <Navigation />
      <div className="container" style={{
        maxWidth: '800px',
        padding: '2rem 1rem'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: 'var(--text-primary)'
        }}>
          Welcome to GraphMind
        </h1>
        <p style={{
          fontSize: '1.125rem',
          color: 'var(--text-secondary)',
          marginBottom: '3rem'
        }}>
          Your voice-first personal knowledge assistant
        </p>

        <div style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          marginBottom: '3rem'
        }}>
          <div
            onClick={() => navigate('/query')}
            style={{
              backgroundColor: 'var(--bg-primary)',
              padding: '2rem',
              borderRadius: '0.5rem',
              boxShadow: 'var(--shadow)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: '2px solid transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-color)';
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.boxShadow = 'var(--shadow)';
            }}
          >
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              marginBottom: '0.5rem',
              color: 'var(--primary-color)'
            }}>
              Ask a Question
            </h2>
            <p style={{
              color: 'var(--text-secondary)',
              marginBottom: '1rem'
            }}>
              Use voice to query your knowledge graph
            </p>
            <button className="btn btn-primary">
              Start Recording
            </button>
          </div>

          <div
            onClick={() => navigate('/history')}
            style={{
              backgroundColor: 'var(--bg-primary)',
              padding: '2rem',
              borderRadius: '0.5rem',
              boxShadow: 'var(--shadow)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: '2px solid transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-color)';
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.boxShadow = 'var(--shadow)';
            }}
          >
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              marginBottom: '0.5rem',
              color: 'var(--secondary-color)'
            }}>
              View History
            </h2>
            <p style={{
              color: 'var(--text-secondary)',
              marginBottom: '1rem'
            }}>
              Review past queries and answers
            </p>
            <button className="btn btn-secondary">
              Browse History
            </button>
          </div>
        </div>

        {/* Seed Data Card */}
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          padding: '2rem',
          borderRadius: '0.5rem',
          boxShadow: 'var(--shadow)',
          marginBottom: '3rem'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            color: 'var(--text-primary)'
          }}>
            Need Test Data?
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            marginBottom: '1rem',
            fontSize: '0.95rem'
          }}>
            Add sample knowledge graph data to test voice queries. Includes people, projects, meetings, and more.
          </p>

          <button
            onClick={handleSeedData}
            disabled={seedLoading}
            className="btn btn-primary"
            style={{
              marginBottom: seedMessage || seedError ? '1rem' : '0'
            }}
          >
            {seedLoading ? 'Adding Test Data...' : 'Add Test Data'}
          </button>

          {seedMessage && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#e8f5e9',
              borderLeft: '4px solid #4caf50',
              borderRadius: '0.25rem',
              color: '#2e7d32',
              fontSize: '0.9rem'
            }}>
              {seedMessage}
            </div>
          )}

          {seedError && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#ffebee',
              borderLeft: '4px solid #f44336',
              borderRadius: '0.25rem',
              color: '#c62828',
              fontSize: '0.9rem'
            }}>
              {seedError}
            </div>
          )}
        </div>

        <div style={{
          backgroundColor: 'var(--bg-primary)',
          padding: '2rem',
          borderRadius: '0.5rem',
          boxShadow: 'var(--shadow)'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
            color: 'var(--text-primary)'
          }}>
            Getting Started
          </h2>
          <ul style={{
            listStyle: 'none',
            padding: 0
          }}>
            <li style={{
              padding: '0.75rem 0',
              borderBottom: '1px solid var(--border-color)'
            }}>
              1. Click "Ask a Question" to start a voice query
            </li>
            <li style={{
              padding: '0.75rem 0',
              borderBottom: '1px solid var(--border-color)'
            }}>
              2. Allow microphone access when prompted
            </li>
            <li style={{
              padding: '0.75rem 0',
              borderBottom: '1px solid var(--border-color)'
            }}>
              3. Speak your question clearly
            </li>
            <li style={{
              padding: '0.75rem 0'
            }}>
              4. Listen to the AI-generated answer
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
