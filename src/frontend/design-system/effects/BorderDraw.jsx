/**
 * GraphMind Design System - BorderDraw Component
 *
 * SVG-based animated border drawing effect.
 * Uses stroke-dasharray/strokeDashoffset for draw animation.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../primitives/utils';
import { useReducedMotion } from './useReducedMotion';

/**
 * Hook for custom BorderDraw implementations.
 *
 * @param {Object} options
 * @param {'mount'|'hover'|'manual'} [options.trigger='mount'] - Animation trigger
 * @param {boolean} [options.active=false] - Active state for manual trigger
 * @param {number} [options.duration=600] - Animation duration in ms
 * @param {boolean} [options.disabled=false] - Disable effect
 * @returns {{ isDrawing: boolean, startDraw: () => void, resetDraw: () => void, isComplete: boolean }}
 *
 * @example
 * const { isDrawing, startDraw, resetDraw } = useBorderDraw({ trigger: 'manual' });
 */
export function useBorderDraw({
  trigger = 'mount',
  active = false,
  duration = 600,
  disabled = false,
} = {}) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const timeoutRef = useRef(null);

  const startDraw = useCallback(() => {
    if (disabled) return;
    setIsDrawing(true);
    setIsComplete(false);

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsComplete(true);
    }, duration);
  }, [duration, disabled]);

  const resetDraw = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setIsDrawing(false);
    setIsComplete(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  // Handle mount trigger
  useEffect(() => {
    if (trigger === 'mount' && !disabled) {
      startDraw();
    }
  }, [trigger, disabled, startDraw]);

  // Handle manual trigger via active prop
  useEffect(() => {
    if (trigger === 'manual') {
      if (active && !disabled) {
        startDraw();
      } else {
        resetDraw();
      }
    }
  }, [trigger, active, disabled, startDraw, resetDraw]);

  return {
    isDrawing,
    isComplete,
    startDraw,
    resetDraw,
  };
}

/**
 * Neo-Brutalist BorderDraw Component
 *
 * Animates an SVG border that "draws" itself around content.
 * Uses stroke-dashoffset animation for the drawing effect.
 *
 * @example
 * // Draw on mount
 * <BorderDraw>
 *   <Card>Content with animated border</Card>
 * </BorderDraw>
 *
 * @example
 * // Draw on hover
 * <BorderDraw trigger="hover" strokeColor="#FF00FF">
 *   <div className="p-4">Hover to draw border</div>
 * </BorderDraw>
 *
 * @example
 * // Manual control
 * <BorderDraw trigger="manual" active={isActive} onComplete={() => console.log('done')}>
 *   <Card>Controlled animation</Card>
 * </BorderDraw>
 *
 * @param {Object} props - Component props
 * @param {'mount'|'hover'|'manual'} [props.trigger='mount'] - When to animate
 * @param {boolean} [props.active=false] - Active state (for manual trigger)
 * @param {number} [props.duration=600] - Animation duration in ms
 * @param {number} [props.strokeWidth=3] - Border thickness
 * @param {string} [props.strokeColor='#000000'] - Border color
 * @param {boolean} [props.disabled=false] - Disable the effect
 * @param {() => void} [props.onComplete] - Callback when animation completes
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} props.children - Content to wrap
 * @param {React.Ref} [props.ref] - Forwarded ref
 * @returns {JSX.Element}
 */
function BorderDraw({
  trigger = 'mount',
  active = false,
  duration = 600,
  strokeWidth = 3,
  strokeColor = '#000000',
  disabled = false,
  onComplete,
  className,
  children,
  ref,
  ...props
}) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Combine disabled with reduced motion preference
  const isDisabled = disabled || prefersReducedMotion;

  const { isDrawing, isComplete, startDraw, resetDraw } = useBorderDraw({
    trigger,
    active,
    duration,
    disabled: isDisabled,
  });

  // Measure container dimensions
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    };

    updateDimensions();

    // ResizeObserver for responsive behavior
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  // Handle hover trigger
  useEffect(() => {
    if (trigger === 'hover' && !isDisabled) {
      if (isHovered) {
        startDraw();
      } else {
        resetDraw();
      }
    }
  }, [trigger, isHovered, isDisabled, startDraw, resetDraw]);

  // Handle onComplete callback
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  // Hover handlers
  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      setIsHovered(false);
    }
  };

  // Combine refs
  const setRefs = useCallback(
    (node) => {
      containerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
  );

  // Calculate SVG properties
  const { width, height } = dimensions;
  const perimeter = 2 * (width + height);

  // Framer Motion animation
  const pathVariants = {
    hidden: {
      strokeDashoffset: perimeter,
    },
    visible: {
      strokeDashoffset: 0,
      transition: {
        duration: duration / 1000,
        ease: [0.4, 0, 0.2, 1], // ease-out
      },
    },
  };

  // Fallback for disabled/reduced motion - render static border
  if (isDisabled) {
    return (
      <div
        ref={setRefs}
        className={cn('relative', className)}
        style={{
          border: `${strokeWidth}px solid ${strokeColor}`,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={setRefs}
      className={cn('relative', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}

      {/* SVG border overlay */}
      {width > 0 && height > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          style={{ zIndex: 10 }}
          aria-hidden="true"
        >
          <motion.rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={Math.max(0, width - strokeWidth)}
            height={Math.max(0, height - strokeWidth)}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="square"
            strokeDasharray={perimeter}
            initial="hidden"
            animate={isDrawing ? 'visible' : 'hidden'}
            variants={pathVariants}
          />
        </svg>
      )}
    </div>
  );
}

export default BorderDraw;
