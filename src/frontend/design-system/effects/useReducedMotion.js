/**
 * GraphMind Design System - useReducedMotion Hook
 *
 * Detects user's preference for reduced motion.
 * SSR-safe - defaults to false on server.
 *
 * @example
 * const prefersReducedMotion = useReducedMotion();
 * if (prefersReducedMotion) {
 *   // Skip animations
 * }
 */

import { useState, useEffect } from 'react';

/**
 * Hook to detect prefers-reduced-motion media query.
 *
 * @returns {boolean} True if user prefers reduced motion
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // SSR safety check
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

export default useReducedMotion;
