import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav style={{
      backgroundColor: 'var(--bg-primary)',
      borderBottom: '1px solid var(--border-color)',
      padding: '1rem 0',
      marginBottom: '2rem',
      boxShadow: 'var(--shadow)'
    }}>
      <div className="container" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{
          display: 'flex',
          gap: '2rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: 'var(--primary-color)',
            margin: 0
          }}>
            GraphMind
          </h1>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link
              to="/"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                fontWeight: '500',
                backgroundColor: isActive('/') ? 'var(--primary-color)' : 'transparent',
                color: isActive('/') ? 'white' : 'var(--text-primary)',
                transition: 'all 0.2s'
              }}
            >
              Dashboard
            </Link>
            <Link
              to="/query"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                fontWeight: '500',
                backgroundColor: isActive('/query') ? 'var(--primary-color)' : 'transparent',
                color: isActive('/query') ? 'white' : 'var(--text-primary)',
                transition: 'all 0.2s'
              }}
            >
              Ask Question
            </Link>
            <Link
              to="/history"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                fontWeight: '500',
                backgroundColor: isActive('/history') ? 'var(--primary-color)' : 'transparent',
                color: isActive('/history') ? 'white' : 'var(--text-primary)',
                transition: 'all 0.2s'
              }}
            >
              History
            </Link>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          {user && (
            <span style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem'
            }}>
              {user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem' }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
