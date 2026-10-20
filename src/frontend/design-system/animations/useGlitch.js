/**
 * GraphMind Design System - useGlitch Hook
 *
 * Triggers periodic or on-demand glitch effects via CSS class toggle.
 * Different from GlitchText component which runs continuous CSS animation.
 *
 * This hook is for:
 * - Error state emphasis (form validation failed)
 * - Attention-getting notifications
 * - Periodic "glitch" effects for atmosphere
 * - One-shot emphasis effects
 *
 * GlitchText is for:
 * - Continuous decorative glitch (logos, titles)
 * - Static chromatic aberration effect
 *
 * @example
 * // Manual trigger on error
 * const { triggerGlitch, className } = useGlitch({ mode: 'manual' });
 * useEffect(() => { if (hasError) triggerGlitch(); }, [hasError]);
 * return <span className={className}>Error!</span>;
 *
 * @example
 * // Periodic glitch for atmosphere
 * const { isGlitching, className } = useGlitch({ mode: 'periodic', interval: 5000 });
 * return <h1 className={className}>GRAPHMIND</h1>;
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useReducedMotion } from '../effects/useReducedMotion';

/**
 * Hook for on-demand or periodic glitch effects
 *
 * @param {Object} options - Hook options
 * @param {'manual'|'periodic'} [options.mode='manual'] - Trigger mode
 * @param {number} [options.interval=5000] - Ms between glitches (periodic mode only)
 * @param {number} [options.duration=200] - Glitch burst duration in ms
 * @param {boolean} [options.disabled=false] - Disable the effect entirely
 * @param {Function} [options.onGlitch] - Callback when glitch triggers
 * @returns {{
 *   isGlitching: boolean,
 *   triggerGlitch: () => void,
 *   className: string,
 *   isActive: boolean
 * }}
 */
export function useGlitch({
  mode = 'manual',
  interval = 5000,
  duration = 200,
  disabled = false,
  onGlitch,
} = {}) {
  const [isGlitching, setIsGlitching] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const onGlitchRef = useRef(onGlitch);

  // Keep callback ref updated
  useEffect(() => {
    onGlitchRef.current = onGlitch;
  }, [onGlitch]);

  const isDisabled = disabled || prefersReducedMotion;

  /**
   * Trigger a single glitch burst
   */
  const triggerGlitch = useCallback(() => {
    if (isDisabled) return;

    // Clear any existing timeout
    clearTimeout(timeoutRef.current);

    // Start glitch
    setIsGlitching(true);
    onGlitchRef.current?.();

    // End glitch after duration
    timeoutRef.current = setTimeout(() => {
      setIsGlitching(false);
    }, duration);
  }, [isDisabled, duration]);

  // Periodic mode - auto-trigger at intervals
  useEffect(() => {
    if (mode !== 'periodic' || isDisabled) return;

    // Initial trigger after a small delay
    const initialTimeout = setTimeout(() => {
      triggerGlitch();
    }, 500);

    // Set up periodic triggers with slight randomness for natural feel
    intervalRef.current = setInterval(() => {
      triggerGlitch();
    }, interval + Math.random() * 500);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalRef.current);
    };
  }, [mode, interval, isDisabled, triggerGlitch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
      clearInterval(intervalRef.current);
    };
  }, []);

  return {
    isGlitching,
    triggerGlitch,
    className: isGlitching ? 'glitch-text' : '',
    isActive: !isDisabled,
  };
}

export default useGlitch;
