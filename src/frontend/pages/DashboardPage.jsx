import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import Navigation from '../components/Navigation';

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
