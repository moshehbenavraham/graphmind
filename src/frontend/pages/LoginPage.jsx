/**
 * GraphMind - Login Page
 *
 * Neo-brutalist authentication page using design system components.
 * Features: GlitchText logo, OffsetLayer card effect, Input primitives
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import {
  Card,
  Button,
  Input,
  GlitchText,
  OffsetLayer,
  Badge,
} from '../design-system';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    console.log('[LoginPage] Form submitted');

    // Client-side validation
    if (!email || !password) {
      console.log('[LoginPage] Validation failed: Missing fields');
      setError('Email and password are required');
      return;
    }

    if (!validateEmail(email)) {
      console.log('[LoginPage] Validation failed: Invalid email');
      setError('Please enter a valid email address');
      return;
    }

    console.log('[LoginPage] Validation passed, calling login()');
    setLoading(true);

    try {
      await login(email, password);
      console.log('[LoginPage] Login successful, navigating to dashboard');
      navigate('/');
    } catch (err) {
      console.error('[LoginPage] Login failed:', err);
      // Provide more user-friendly error messages
      let errorMessage = err.message || 'Login failed. Please check your credentials.';

      // Handle common error scenarios
      if (errorMessage.includes('Invalid credentials') || errorMessage.includes('401')) {
        errorMessage = 'Invalid email or password. Please try again.';
      } else if (errorMessage.includes('not found')) {
        errorMessage = 'No account found with this email. Please register first.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorMessage = 'Unable to connect to server. Please check your internet connection and try again.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#FFFEF0]">
      <div className="w-full max-w-md">
        <OffsetLayer variant="accent" size="lg">
          <Card>
            <Card.Body>
              {/* Logo/Title */}
              <div className="mb-8">
                <GlitchText as="h1" className="text-3xl md:text-4xl mb-2">
                  GRAPHMIND
                </GlitchText>
                <p className="text-brutal-charcoal/70 font-mono text-sm uppercase tracking-wider">
                  Sign in to your account
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading}
                  error={!!error && !email}
                />

                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                  error={!!error && !password}
                />

                {/* Error Message */}
                {error && (
                  <Badge variant="error" className="w-full justify-center py-3">
                    {error}
                  </Badge>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  className="w-full"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>

                {/* Register Link */}
                <p className="text-center text-brutal-charcoal/70 font-mono text-sm">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    className="text-accent-primary font-bold uppercase hover:underline hover:underline-offset-4"
                  >
                    Create one
                  </Link>
                </p>
              </form>
            </Card.Body>
          </Card>
        </OffsetLayer>
      </div>
    </div>
  );
}

export default LoginPage;
