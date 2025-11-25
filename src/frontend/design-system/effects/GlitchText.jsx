/**
 * GraphMind Design System - GlitchText Component
 *
 * Continuous CSS glitch animation with chromatic aberration.
 * Uses CSS pseudo-elements with data-text attribute.
 */

import { cn } from '../primitives/utils';
import { useReducedMotion } from './useReducedMotion';

/**
 * Hook for custom GlitchText implementations.
 *
 * @param {Object} options
 * @param {string} options.text - The text content (required for data-text attr)
 * @param {boolean} [options.disabled=false] - Disable effect
 * @returns {{ className: string, dataText: string, isActive: boolean }}
 *
 * @example
 * const { className, dataText, isActive } = useGlitchText({ text: 'GLITCH' });
 * return <span className={className} data-text={dataText}>GLITCH</span>;
 */
export function useGlitchText({
  text = '',
  disabled = false,
} = {}) {
  const prefersReducedMotion = useReducedMotion();

  // Disable if user prefers reduced motion
  const isActive = !disabled && !prefersReducedMotion;

  return {
    className: isActive ? 'glitch-text' : '',
    dataText: isActive ? text : undefined,
    isActive,
  };
}

/**
 * Neo-Brutalist GlitchText Component
 *
 * Text with continuous CSS glitch animation.
 * Creates red/cyan chromatic aberration effect.
 *
 * IMPORTANT: Children must be a string for the effect to work.
 * The CSS uses `content: attr(data-text)` for pseudo-elements.
 *
 * @example
 * // Basic glitch text
 * <GlitchText>GRAPHMIND</GlitchText>
 *
 * @example
 * // As heading
 * <GlitchText as="h1">SYSTEM STATUS</GlitchText>
 *
 * @example
 * // Disabled
 * <GlitchText disabled>No glitch</GlitchText>
 *
 * @param {Object} props - Component props
 * @param {'span'|'h1'|'h2'|'h3'|'h4'|'h5'|'h6'|'p'|'div'} [props.as='span'] - HTML element
 * @param {boolean} [props.disabled=false] - Disable the glitch effect
 * @param {string} [props.className] - Additional CSS classes
 * @param {string} props.children - Text content (must be string)
 * @param {React.Ref} [props.ref] - Forwarded ref
 * @returns {JSX.Element}
 */
function GlitchText({
  as: Component = 'span',
  disabled = false,
  className,
  children,
  ref,
  ...props
}) {
  // Extract text content for data-text attribute
  const textContent = typeof children === 'string' ? children : '';

  // Warn in development if children is not a string
  if (process.env.NODE_ENV === 'development' && typeof children !== 'string') {
    console.warn(
      'GlitchText: children should be a string for the glitch effect to work properly. ' +
      'Received type: ' + typeof children
    );
  }

  const { className: glitchClassName, dataText, isActive } = useGlitchText({
    text: textContent,
    disabled,
  });

  return (
    <Component
      ref={ref}
      className={cn(glitchClassName, className)}
      data-text={dataText}
      {...props}
    >
      {children}
    </Component>
  );
}

export default GlitchText;
