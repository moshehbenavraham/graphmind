/**
 * GraphMind Design System - useTypewriter Hook
 *
 * Character-by-character text reveal animation with typewriter effect.
 * Respects reduced motion by showing full text immediately.
 *
 * @example
 * // Basic usage
 * const { displayText, cursorClassName } = useTypewriter({
 *   text: 'Hello World',
 *   speed: 50
 * });
 * return <span>{displayText}<span className={cursorClassName}>|</span></span>;
 *
 * @example
 * // With controls
 * const { displayText, isTyping, skip, reset } = useTypewriter({
 *   text: 'Loading...',
 *   speed: 100,
 *   onComplete: () => console.log('Done!')
 * });
 *
 * @example
 * // Manual start
 * const { displayText, start } = useTypewriter({
 *   text: 'Click to reveal',
 *   startOnMount: false
 * });
 * return <button onClick={start}>{displayText || 'Click me'}</button>;
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useReducedMotion } from '../effects/useReducedMotion';

/**
 * Hook for typewriter text reveal animation
 *
 * @param {Object} options - Hook options
 * @param {string} options.text - Text to reveal character by character
 * @param {number} [options.speed=50] - Milliseconds per character
 * @param {number} [options.delay=0] - Initial delay before starting (ms)
 * @param {boolean} [options.cursor=true] - Show blinking cursor while typing
 * @param {boolean} [options.startOnMount=true] - Auto-start on mount
 * @param {boolean} [options.disabled=false] - Disable animation (show full text)
 * @param {Function} [options.onComplete] - Callback when animation completes
 * @returns {{
 *   displayText: string,
 *   isTyping: boolean,
 *   isComplete: boolean,
 *   cursorClassName: string,
 *   start: () => void,
 *   reset: () => void,
 *   skip: () => void,
 *   isActive: boolean
 * }}
 */
export function useTypewriter({
  text = '',
  speed = 50,
  delay = 0,
  cursor = true,
  startOnMount = true,
  disabled = false,
  onComplete,
} = {}) {
  const [charIndex, setCharIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const prefersReducedMotion = useReducedMotion();
  const timeoutRef = useRef(null);
  const onCompleteRef = useRef(onComplete);

  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const isDisabled = disabled || prefersReducedMotion;
  const isComplete = charIndex >= text.length;
  const displayText = isDisabled ? text : text.slice(0, charIndex);

  /**
   * Start or restart the typewriter animation
   */
  const start = useCallback(() => {
    if (isDisabled) {
      // When disabled, immediately show full text
      setCharIndex(text.length);
      onCompleteRef.current?.();
      return;
    }

    setCharIndex(0);
    setHasStarted(true);
    setIsTyping(true);
  }, [isDisabled, text.length]);

  /**
   * Reset to beginning (doesn't auto-start)
   */
  const reset = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setCharIndex(0);
    setIsTyping(false);
    setHasStarted(false);
  }, []);

  /**
   * Skip to end immediately
   */
  const skip = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setCharIndex(text.length);
    setIsTyping(false);
    onCompleteRef.current?.();
  }, [text.length]);

  // Auto-start on mount if enabled
  useEffect(() => {
    if (startOnMount && !hasStarted) {
      if (delay > 0) {
        timeoutRef.current = setTimeout(start, delay);
      } else {
        start();
      }
    }
    return () => clearTimeout(timeoutRef.current);
  }, [startOnMount, hasStarted, delay, start]);

  // Typing animation loop
  useEffect(() => {
    if (!isTyping || isDisabled) return;

    if (charIndex < text.length) {
      timeoutRef.current = setTimeout(() => {
        setCharIndex((prev) => prev + 1);
      }, speed);
    } else {
      // Animation complete
      setIsTyping(false);
      onCompleteRef.current?.();
    }

    return () => clearTimeout(timeoutRef.current);
  }, [charIndex, isTyping, isDisabled, text.length, speed]);

  // Reset when text changes
  useEffect(() => {
    reset();
    if (startOnMount) {
      if (delay > 0) {
        timeoutRef.current = setTimeout(start, delay);
      } else {
        start();
      }
    }
    // Only trigger on text change, not on other deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return {
    displayText,
    isTyping,
    isComplete: isDisabled ? true : isComplete,
    cursorClassName: cursor && isTyping ? 'animate-brutal-blink' : '',
    start,
    reset,
    skip,
    isActive: !isDisabled,
  };
}

export default useTypewriter;
