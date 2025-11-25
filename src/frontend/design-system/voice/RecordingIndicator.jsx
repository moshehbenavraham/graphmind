/**
 * GraphMind Design System - RecordingIndicator
 *
 * Recording status indicator with three distinct visual variants.
 * All animations are CSS-only for optimal performance.
 *
 * @example
 * // Hazard stripes (default, most impactful)
 * <RecordingIndicator active={isRecording} />
 *
 * @example
 * // Pulsing beacon
 * <RecordingIndicator variant="beacon" active={isRecording} />
 *
 * @example
 * // Terminal style with custom label
 * <RecordingIndicator variant="terminal" active={isRecording} label="LIVE" />
 *
 * @example
 * // Using the hook for custom implementations
 * const { className, isAnimating, ariaLabel } = useRecordingIndicator({
 *   variant: 'hazard',
 *   active: true
 * });
 */

import { cn } from '../primitives/utils';
import { useReducedMotion } from '../effects/useReducedMotion';

/**
 * Size mappings for different component sizes
 */
const SIZES = {
  sm: {
    dot: 'w-3 h-3',
    text: 'text-xs',
    gap: 'gap-2',
    padding: 'px-2 py-1',
    stripeHeight: 'h-2',
  },
  md: {
    dot: 'w-4 h-4',
    text: 'text-sm',
    gap: 'gap-3',
    padding: 'px-3 py-2',
    stripeHeight: 'h-3',
  },
  lg: {
    dot: 'w-6 h-6',
    text: 'text-base',
    gap: 'gap-4',
    padding: 'px-4 py-3',
    stripeHeight: 'h-4',
  },
};

/**
 * Hook for custom recording indicator implementations
 *
 * @param {Object} options - Hook options
 * @param {'hazard'|'beacon'|'terminal'} [options.variant='hazard'] - Visual style
 * @param {boolean} [options.active=false] - Recording active state
 * @param {boolean} [options.disabled=false] - Disable animations
 * @returns {{
 *   className: string,
 *   isAnimating: boolean,
 *   ariaLabel: string,
 *   isActive: boolean
 * }}
 */
export function useRecordingIndicator({
  variant = 'hazard',
  active = false,
  disabled = false,
} = {}) {
  const prefersReducedMotion = useReducedMotion();
  const isAnimating = active && !disabled && !prefersReducedMotion;

  const ariaLabel = active
    ? 'Recording in progress'
    : 'Recording stopped';

  // Base classes that apply to all variants when active
  const baseActiveClass = active ? 'opacity-100' : 'opacity-50';

  return {
    className: baseActiveClass,
    isAnimating,
    ariaLabel,
    isActive: !disabled && !prefersReducedMotion,
  };
}

/**
 * Hazard variant - Animated diagonal stripes
 */
function HazardIndicator({ active, size, showLabel, label, disabled, prefersReducedMotion }) {
  const sizeClasses = SIZES[size];
  const isAnimating = active && !disabled && !prefersReducedMotion;

  return (
    <div
      className={cn(
        'flex items-center border-brutal-thick border-brutal-black',
        sizeClasses.gap,
        sizeClasses.padding,
        active ? 'bg-brutal-white' : 'bg-brutal-charcoal/20'
      )}
    >
      <div
        className={cn(
          'w-16',
          sizeClasses.stripeHeight,
          'border-brutal border-brutal-black',
          active
            ? isAnimating
              ? 'hazard-stripes-danger'
              : 'bg-status-error'
            : isAnimating
              ? 'hazard-stripes'
              : 'bg-brutal-charcoal/30'
        )}
        style={!isAnimating ? { animation: 'none' } : undefined}
      />
      {showLabel && (
        <span
          className={cn(
            'font-mono font-bold uppercase tracking-wider',
            sizeClasses.text,
            active ? 'text-status-error' : 'text-brutal-charcoal/50'
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * Beacon variant - Pulsing dot with optional glow
 */
function BeaconIndicator({ active, size, showLabel, label, disabled, prefersReducedMotion }) {
  const sizeClasses = SIZES[size];
  const isAnimating = active && !disabled && !prefersReducedMotion;

  return (
    <div
      className={cn(
        'flex items-center',
        sizeClasses.gap,
        sizeClasses.padding
      )}
    >
      <div className="relative">
        {/* Glow layer (only when active and animating) */}
        {active && isAnimating && (
          <div
            className={cn(
              'absolute inset-[-4px] bg-status-error/30 animate-brutal-pulse',
              sizeClasses.dot
            )}
            style={{
              animationDelay: '0.25s',
              width: 'calc(100% + 8px)',
              height: 'calc(100% + 8px)',
            }}
          />
        )}
        {/* Main dot */}
        <div
          className={cn(
            sizeClasses.dot,
            'border-brutal border-brutal-black',
            active
              ? isAnimating
                ? 'bg-status-error animate-brutal-pulse'
                : 'bg-status-error'
              : 'bg-brutal-charcoal/30'
          )}
          style={!isAnimating ? { animation: 'none' } : undefined}
        />
      </div>
      {showLabel && (
        <span
          className={cn(
            'font-mono font-bold uppercase tracking-wider',
            sizeClasses.text,
            active ? 'text-status-error' : 'text-brutal-charcoal/50'
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * Terminal variant - Blinking text with dot
 */
function TerminalIndicator({ active, size, showLabel, label, disabled, prefersReducedMotion }) {
  const sizeClasses = SIZES[size];
  const isAnimating = active && !disabled && !prefersReducedMotion;

  return (
    <div
      className={cn(
        'inline-flex items-center bg-brutal-black border-brutal-thick',
        sizeClasses.gap,
        sizeClasses.padding,
        active ? 'border-status-error' : 'border-brutal-charcoal'
      )}
    >
      {/* Recording dot */}
      <div
        className={cn(
          sizeClasses.dot,
          active
            ? isAnimating
              ? 'bg-status-error animate-brutal-pulse'
              : 'bg-status-error'
            : 'bg-brutal-charcoal/50'
        )}
        style={!isAnimating ? { animation: 'none' } : undefined}
      />
      {showLabel && (
        <span
          className={cn(
            'font-mono font-bold uppercase tracking-wider',
            sizeClasses.text,
            active
              ? isAnimating
                ? 'text-status-error animate-brutal-pulse'
                : 'text-status-error'
              : 'text-brutal-charcoal/50'
          )}
          style={!isAnimating ? { animation: 'none' } : undefined}
        >
          [ {label} ]
        </span>
      )}
    </div>
  );
}

/**
 * RecordingIndicator component
 *
 * @param {Object} props - Component props
 * @param {'hazard'|'beacon'|'terminal'} [props.variant='hazard'] - Visual style
 * @param {boolean} [props.active=false] - Recording active state
 * @param {string} [props.label='REC'] - Label text
 * @param {boolean} [props.showLabel=true] - Show label
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Component size
 * @param {boolean} [props.disabled=false] - Disable animations
 * @param {string} [props.className] - Additional CSS classes
 */
function RecordingIndicator({
  variant = 'hazard',
  active = false,
  label = 'REC',
  showLabel = true,
  size = 'md',
  disabled = false,
  className,
  ...props
}) {
  const prefersReducedMotion = useReducedMotion();

  const commonProps = {
    active,
    size,
    showLabel,
    label,
    disabled,
    prefersReducedMotion,
  };

  const VariantComponent = {
    hazard: HazardIndicator,
    beacon: BeaconIndicator,
    terminal: TerminalIndicator,
  }[variant] || HazardIndicator;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={active ? 'Recording in progress' : 'Recording stopped'}
      className={cn('inline-block', className)}
      {...props}
    >
      <VariantComponent {...commonProps} />
    </div>
  );
}

export default RecordingIndicator;
