/**
 * GraphMind Navigation Component
 *
 * Neo-brutalist navigation bar with hard shadows, thick borders,
 * and mechanical hover effects.
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.jsx';
import { Button, GlitchText, cn, brutalInteraction } from '../design-system';

/**
 * Navigation link with brutalist styling and active state
 */
function NavLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={cn(
        'nav-link-brutal',
        isActive && 'nav-link-brutal-active'
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Mobile menu button with hamburger icon
 */
function MenuButton({ isOpen, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      className="md:hidden p-2 border-brutal border-brutal-white"
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isOpen}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="w-6 h-5 relative flex flex-col justify-between">
        <motion.span
          className="w-full h-0.5 bg-brutal-white block"
          animate={isOpen ? { rotate: 45, y: 9 } : { rotate: 0, y: 0 }}
          transition={{ duration: 0.1 }}
        />
        <motion.span
          className="w-full h-0.5 bg-brutal-white block"
          animate={isOpen ? { opacity: 0 } : { opacity: 1 }}
          transition={{ duration: 0.1 }}
        />
        <motion.span
          className="w-full h-0.5 bg-brutal-white block"
          animate={isOpen ? { rotate: -45, y: -9 } : { rotate: 0, y: 0 }}
          transition={{ duration: 0.1 }}
        />
      </div>
    </motion.button>
  );
}

/**
 * Mobile navigation menu with slide-down animation
 */
function MobileMenu({ isOpen, onClose, user, onLogout }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 1, 1] }}
          className="md:hidden bg-brutal-black border-t-brutal border-accent-primary overflow-hidden"
        >
          <div className="px-4 py-4 flex flex-col gap-2">
            <Link
              to="/"
              onClick={onClose}
              className="nav-link-brutal block text-center"
            >
              Dashboard
            </Link>
            <Link
              to="/query"
              onClick={onClose}
              className="nav-link-brutal block text-center"
            >
              Ask Question
            </Link>
            <Link
              to="/history"
              onClick={onClose}
              className="nav-link-brutal block text-center"
            >
              History
            </Link>

            <div className="border-t-brutal border-brutal-charcoal my-2" />

            {user && (
              <span className="text-brutal-charcoal text-xs text-center font-mono uppercase tracking-wider">
                {user.email}
              </span>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="w-full text-status-error border-status-error hover:bg-status-error hover:text-brutal-white"
            >
              Logout
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Main Navigation Component
 *
 * Neo-brutalist navigation bar with:
 * - Black background with magenta bottom border
 * - GlitchText logo
 * - Hard-edged nav links with active states
 * - Responsive mobile menu
 *
 * @example
 * <Navigation />
 */
function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <nav className="nav-brutal mb-6">
      <div className="max-w-7xl mx-auto">
        {/* Main nav row */}
        <div className="flex items-center justify-between gap-4">
          {/* Logo and desktop nav links */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link to="/" className="shrink-0">
              <GlitchText
                as="h1"
                className="text-xl md:text-2xl font-bold text-accent-primary tracking-wider"
              >
                GRAPHMIND
              </GlitchText>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-2">
              <NavLink to="/">Dashboard</NavLink>
              <NavLink to="/query">Ask Question</NavLink>
              <NavLink to="/history">History</NavLink>
            </div>
          </div>

          {/* User info and logout (desktop) */}
          <div className="hidden md:flex items-center gap-4">
            {user && (
              <span className="text-brutal-charcoal text-xs font-mono uppercase tracking-wider">
                {user.email}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-brutal-white border-brutal-white hover:text-brutal-black"
            >
              Logout
            </Button>
          </div>

          {/* Mobile menu button */}
          <MenuButton
            isOpen={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          />
        </div>
      </div>

      {/* Mobile menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
        user={user}
        onLogout={handleLogout}
      />
    </nav>
  );
}

export default Navigation;
