/**
 * GraphMind Design System - OffsetLayer Component
 *
 * Neo-brutalist offset shadow effect using CSS pseudo-elements.
 * Wraps content with a colored shadow layer behind it.
 */

import { cn } from '../primitives/utils';

/**
 * Variant to CSS class mapping
 * @type {Record<string, string>}
 */
const VARIANTS = {
  default: '',
  accent: 'offset-layer-accent',
};

/**
 * Size to CSS class mapping
 * @type {Record<string, string>}
 */
const SIZES = {
  md: '',
  lg: 'offset-layer-lg',
};

/**
 * Hook for custom OffsetLayer implementations.
 *
 * @param {Object} options
 * @param {'default'|'accent'} [options.variant='default'] - Shadow color variant
 * @param {'md'|'lg'} [options.size='md'] - Offset distance
 * @param {boolean} [options.disabled=false] - Disable effect
 * @returns {{ className: string, isActive: boolean }}
 *
 * @example
 * const { className, isActive } = useOffsetLayer({ variant: 'accent', size: 'lg' });
 * return <div className={cn('my-class', isActive && className)}>Content</div>;
 */
export function useOffsetLayer({
  variant = 'default',
  size = 'md',
  disabled = false,
} = {}) {
  const className = cn(
    'offset-layer',
    VARIANTS[variant] || VARIANTS.default,
    SIZES[size] || SIZES.md
  );

  return {
    className: disabled ? '' : className,
    isActive: !disabled,
  };
}

/**
 * Neo-Brutalist OffsetLayer Component
 *
 * Wraps content with an offset shadow layer using CSS ::before pseudo-element.
 * Creates the signature brutalist "stacked" visual effect.
 *
 * @example
 * // Default black offset
 * <OffsetLayer>
 *   <Card>Content with shadow</Card>
 * </OffsetLayer>
 *
 * @example
 * // Magenta accent offset
 * <OffsetLayer variant="accent" size="lg">
 *   <Button>Click me</Button>
 * </OffsetLayer>
 *
 * @example
 * // Disabled (no offset)
 * <OffsetLayer disabled>
 *   <Card>No shadow</Card>
 * </OffsetLayer>
 *
 * @param {Object} props - Component props
 * @param {'default'|'accent'} [props.variant='default'] - Shadow color (black or magenta)
 * @param {'md'|'lg'} [props.size='md'] - Offset distance (5px or 8px)
 * @param {React.ElementType} [props.as='div'] - HTML element to render as
 * @param {boolean} [props.disabled=false] - Disable the offset effect
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} props.children - Content to wrap
 * @param {React.Ref} [props.ref] - Forwarded ref
 * @returns {JSX.Element}
 */
function OffsetLayer({
  variant = 'default',
  size = 'md',
  as: Component = 'div',
  disabled = false,
  className,
  children,
  ref,
  ...props
}) {
  const { className: offsetClassName, isActive } = useOffsetLayer({
    variant,
    size,
    disabled,
  });

  return (
    <Component
      ref={ref}
      className={cn(isActive && offsetClassName, className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export default OffsetLayer;
