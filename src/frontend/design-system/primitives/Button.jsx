/**
 * GraphMind Design System - Button Component
 *
 * Neo-brutalist button with Framer Motion animations,
 * loading states, and polymorphic rendering.
 */

import { Children, cloneElement, isValidElement } from 'react';
import { motion } from 'framer-motion';
import { cn } from './utils';
import { brutalHover, brutalTap, brutalTransition } from '../animations';

/**
 * Variant to CSS class mapping
 * @type {Record<string, string>}
 */
const VARIANTS = {
  primary: 'btn-brutal-primary',
  secondary: 'btn-brutal-secondary',
  danger: 'btn-brutal-danger',
  ghost: 'btn-brutal-ghost',
};

/**
 * Size to CSS class mapping
 * @type {Record<string, string>}
 */
const SIZES = {
  sm: 'btn-brutal-sm',
  md: '', // Base size is default in CSS
  lg: 'btn-brutal-lg',
};

/**
 * Neo-Brutalist Button Component
 *
 * A button with hard shadows, thick borders, and mechanical animations.
 * Supports multiple variants, sizes, loading states, and polymorphic rendering.
 *
 * @example
 * // Primary button (default)
 * <Button variant="primary" onClick={handleClick}>
 *   Save Changes
 * </Button>
 *
 * @example
 * // Secondary button with size
 * <Button variant="secondary" size="lg">
 *   Learn More
 * </Button>
 *
 * @example
 * // Loading state
 * <Button variant="primary" loading>
 *   Processing...
 * </Button>
 *
 * @example
 * // Disabled state
 * <Button variant="danger" disabled>
 *   Delete
 * </Button>
 *
 * @example
 * // As a link (polymorphic with asChild)
 * <Button asChild>
 *   <a href="/dashboard">Go to Dashboard</a>
 * </Button>
 *
 * @example
 * // Ghost button
 * <Button variant="ghost" size="sm">
 *   Cancel
 * </Button>
 *
 * @param {Object} props - Component props
 * @param {'primary'|'secondary'|'danger'|'ghost'} [props.variant='secondary'] - Visual variant
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Button size
 * @param {boolean} [props.loading=false] - Shows loading spinner, disables interaction
 * @param {boolean} [props.disabled=false] - Disables the button
 * @param {boolean} [props.asChild=false] - Render as child element (polymorphic)
 * @param {'button'|'submit'|'reset'} [props.type='button'] - HTML button type
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} props.children - Button content
 * @param {React.Ref} [props.ref] - Forwarded ref
 * @param {function} [props.onClick] - Click handler
 * @returns {JSX.Element}
 */
function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  asChild = false,
  type = 'button',
  className,
  children,
  ref,
  ...props
}) {
  const isDisabled = disabled || loading;

  const buttonClasses = cn(
    VARIANTS[variant] || VARIANTS.secondary,
    SIZES[size],
    className
  );

  // asChild pattern - render children with button props merged
  if (asChild && isValidElement(children)) {
    const child = Children.only(children);
    return cloneElement(child, {
      className: cn(child.props.className, buttonClasses),
      ref,
      ...props,
    });
  }

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={buttonClasses}
      whileHover={!isDisabled ? brutalHover : undefined}
      whileTap={!isDisabled ? brutalTap : undefined}
      transition={brutalTransition}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span
            className="loading-brutal w-4 h-4"
            aria-hidden="true"
          />
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}

export default Button;
