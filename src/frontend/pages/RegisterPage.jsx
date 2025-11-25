/**
 * GraphMind - Register Page
 *
 * Neo-brutalist registration page using design system components.
 * Features: GlitchText logo, OffsetLayer card effect, Input primitives with validation
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

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validatePassword = (password) => {
    // Min 8 characters, at least one uppercase, one lowercase, one number
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    console.log('[RegisterPage] Form submitted');

    // Client-side validation
    if (!email || !password || !confirmPassword) {
      console.log('[RegisterPage] Validation failed: Missing fields');
      setError('All fields are required');
      return;
    }

    if (!validateEmail(email)) {
      console.log('[RegisterPage] Validation failed: Invalid email');
      setError('Please enter a valid email address');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      console.log('[RegisterPage] Validation failed:', passwordError);
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      console.log('[RegisterPage] Validation failed: Passwords do not match');
      setError('Passwords do not match');
      return;
    }

    console.log('[RegisterPage] Validation passed, calling register()');
    setLoading(true);

    try {
      await register(email, password);
      console.log('[RegisterPage] Registration successful, navigating to dashboard');
      navigate('/');
    } catch (err) {
      console.error('[RegisterPage] Registration failed:', err);
      // Provide more user-friendly error messages
      let errorMessage = err.message || 'Registration failed. Please try again.';

      // Handle common error scenarios
      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        errorMessage = 'An account with this email already exists. Please log in instead.';
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
                  Create your account
                </p>
              </div>

              {/* Registration Form */}
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
                  placeholder="Min 8 chars, 1 upper, 1 lower, 1 number"
                  autoComplete="new-password"
                  disabled={loading}
                  error={!!error && !password}
                  helperText="Must be at least 8 characters with uppercase, lowercase, and number"
                />

                <Input
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  disabled={loading}
                  error={!!error && password !== confirmPassword && confirmPassword !== ''}
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
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>

                {/* Login Link */}
                <p className="text-center text-brutal-charcoal/70 font-mono text-sm">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="text-accent-primary font-bold uppercase hover:underline hover:underline-offset-4"
                  >
                    Sign in
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

export default RegisterPage;
