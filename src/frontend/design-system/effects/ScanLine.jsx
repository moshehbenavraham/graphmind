/**
 * GraphMind Design System - ScanLine Component
 *
 * CRT monitor horizontal scan lines overlay effect.
 * Adds retro/terminal aesthetic to any content.
 */

import { cn } from '../primitives/utils';
import { useReducedMotion } from './useReducedMotion';

/**
 * Hook for custom ScanLine implementations.
 *
 * @param {Object} options
 * @param {boolean} [options.animated=false] - Enable moving scan bar
 * @param {boolean} [options.disabled=false] - Disable effect
 * @returns {{ className: string, isActive: boolean }}
 *
 * @example
 * const { className, isActive } = useScanLine({ animated: true });
 * return <div className={cn('my-class', isActive && className)}>Content</div>;
 */
export function useScanLine({
  animated = false,
  disabled = false,
} = {}) {
  const prefersReducedMotion = useReducedMotion();

  // Disable animation if user prefers reduced motion
  const shouldAnimate = animated && !prefersReducedMotion && !disabled;

  const className = cn(
    'scanlines',
    shouldAnimate && 'scanlines-animated'
  );

  return {
    className: disabled ? '' : className,
    isActive: !disabled,
    isAnimated: shouldAnimate,
  };
}

/**
 * Neo-Brutalist ScanLine Component
 *
 * Applies CRT monitor horizontal scan lines overlay to content.
 * Optional animated scan bar that moves across the content.
 *
 * @example
 * // Basic scanlines
 * <ScanLine>
 *   <div className="terminal-brutal">Terminal content</div>
 * </ScanLine>
 *
 * @example
 * // With animated scan bar
 * <ScanLine animated>
 *   <Card>Animated scanlines</Card>
 * </ScanLine>
 *
 * @example
 * // Disabled
 * <ScanLine disabled>
 *   <Card>No scanlines</Card>
 * </ScanLine>
 *
 * @param {Object} props - Component props
 * @param {React.ElementType} [props.as='div'] - HTML element to render as
 * @param {boolean} [props.animated=false] - Enable moving scan bar animation
 * @param {boolean} [props.disabled=false] - Disable the scanline effect
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} props.children - Content to apply effect to
 * @param {React.Ref} [props.ref] - Forwarded ref
 * @returns {JSX.Element}
 */
function ScanLine({
  as: Component = 'div',
  animated = false,
  disabled = false,
  className,
  children,
  ref,
  ...props
}) {
  const { className: scanlineClassName, isActive } = useScanLine({
    animated,
    disabled,
  });

  return (
    <Component
      ref={ref}
      className={cn(isActive && scanlineClassName, className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export default ScanLine;
