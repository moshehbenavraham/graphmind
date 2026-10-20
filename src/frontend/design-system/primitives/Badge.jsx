/**
 * GraphMind Design System - Badge Component
 *
 * Neo-brutalist badge for status indicators, tags, and categories.
 */

import { cn } from './utils';

/**
 * Variant to CSS class mapping
 * @type {Record<string, string>}
 */
const VARIANTS = {
  default: 'badge-brutal',
  accent: 'badge-brutal-accent',
  success: 'badge-brutal-success',
  error: 'badge-brutal-error',
  warning: 'badge-brutal-warning',
  info: 'badge-brutal-info',
};

/**
 * Neo-Brutalist Badge Component
 *
 * Small label for status indicators, tags, and categories.
 * Features thick borders, uppercase text, and status-specific colors.
 *
 * @example
 * // Default badge
 * <Badge>New</Badge>
 *
 * @example
 * // Status variants
 * <Badge variant="success">Complete</Badge>
 * <Badge variant="error">Failed</Badge>
 * <Badge variant="warning">Pending</Badge>
 * <Badge variant="info">Beta</Badge>
 *
 * @example
 * // Accent variant (magenta)
 * <Badge variant="accent">Featured</Badge>
 *
 * @example
 * // In a flex container with custom classes
 * <div className="flex gap-2">
 *   <Badge variant="accent">React</Badge>
 *   <Badge variant="info" className="animate-pulse">Live</Badge>
 * </div>
 *
 * @param {Object} props - Component props
 * @param {'default'|'accent'|'success'|'error'|'warning'|'info'} [props.variant='default'] - Visual variant
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} props.children - Badge content
 * @param {React.Ref} [props.ref] - Forwarded ref
 * @returns {JSX.Element}
 */
function Badge({
  variant = 'default',
  className,
  children,
  ref,
  ...props
}) {
  return (
    <span
      ref={ref}
      className={cn(VARIANTS[variant] || VARIANTS.default, className)}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
