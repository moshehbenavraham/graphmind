/**
 * GraphMind Design System - Card Component
 *
 * Neo-brutalist card with compound components, interactive modes,
 * and Framer Motion animations.
 */

import { createContext, useContext } from 'react';
import { motion } from 'framer-motion';
import { cn } from './utils';
import { brutalHover, brutalTap, brutalTransition } from '../animations';

/**
 * Context for sharing variant info with compound components
 * @type {React.Context<{variant: string}>}
 */
const CardContext = createContext({ variant: 'default' });

/**
 * Variant to CSS class mapping
 * @type {Record<string, string>}
 */
const VARIANTS = {
  default: 'card-brutal',
  accent: 'card-brutal-accent',
  dark: 'card-brutal-dark',
};

/**
 * Neo-Brutalist Card Component
 *
 * Container with hard shadows and thick borders.
 * Supports compound components for structured content.
 *
 * @example
 * // Basic card
 * <Card>
 *   <p>Simple content</p>
 * </Card>
 *
 * @example
 * // Card with sections
 * <Card>
 *   <Card.Header>
 *     <h3>Card Title</h3>
 *   </Card.Header>
 *   <Card.Body>
 *     <p>Main content goes here</p>
 *   </Card.Body>
 *   <Card.Footer>
 *     <Button>Action</Button>
 *   </Card.Footer>
 * </Card>
 *
 * @example
 * // Interactive card (clickable)
 * <Card interactive onClick={handleClick}>
 *   <Card.Body>
 *     Click me!
 *   </Card.Body>
 * </Card>
 *
 * @example
 * // Accent variant with magenta border
 * <Card variant="accent">
 *   <Card.Header>Featured</Card.Header>
 *   <Card.Body>Important content</Card.Body>
 * </Card>
 *
 * @example
 * // Dark variant
 * <Card variant="dark">
 *   <Card.Body>Dark theme content</Card.Body>
 * </Card>
 *
 * @param {Object} props - Component props
 * @param {'default'|'accent'|'dark'} [props.variant='default'] - Card visual variant
 * @param {boolean} [props.interactive=false] - Enables hover/active states and click handling
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} props.children - Card content
 * @param {function} [props.onClick] - Click handler (use with interactive)
 * @param {React.Ref} [props.ref] - Forwarded ref
 * @returns {JSX.Element}
 */
function Card({
  variant = 'default',
  interactive = false,
  className,
  children,
  onClick,
  ref,
  ...props
}) {
  // Determine base class based on interactive state
  const baseClass = interactive
    ? cn(VARIANTS[variant] || VARIANTS.default, 'cursor-pointer')
    : VARIANTS[variant] || VARIANTS.default;

  // Use motion.div for interactive, regular div otherwise
  const Component = interactive ? motion.div : 'div';
  const motionProps = interactive
    ? {
        whileHover: brutalHover,
        whileTap: brutalTap,
        transition: brutalTransition,
      }
    : {};

  // Keyboard handler for interactive cards
  const handleKeyDown = interactive
    ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e);
        }
      }
    : undefined;

  return (
    <CardContext.Provider value={{ variant }}>
      <Component
        ref={ref}
        className={cn(baseClass, className)}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        {...motionProps}
        {...props}
      >
        {children}
      </Component>
    </CardContext.Provider>
  );
}

/**
 * Card Header Component
 *
 * Title area with a bottom border separator.
 * Automatically adapts border color to dark variant.
 *
 * @example
 * <Card.Header>
 *   <h3>Section Title</h3>
 * </Card.Header>
 *
 * @param {Object} props - Component props
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} props.children - Header content
 * @returns {JSX.Element}
 */
function CardHeader({ className, children, ...props }) {
  const { variant } = useContext(CardContext);
  const borderColor = variant === 'dark' ? 'border-brutal-white' : 'border-brutal-black';

  return (
    <div
      className={cn('pb-4 mb-4 border-b-brutal-thick', borderColor, className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card Body Component
 *
 * Main content area of the card.
 * Flexes to fill available space.
 *
 * @example
 * <Card.Body>
 *   <p>Main card content goes here</p>
 * </Card.Body>
 *
 * @param {Object} props - Component props
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} props.children - Body content
 * @returns {JSX.Element}
 */
function CardBody({ className, children, ...props }) {
  return (
    <div className={cn('flex-1', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Card Footer Component
 *
 * Actions area with a top border separator.
 * Automatically adapts border color to dark variant.
 *
 * @example
 * <Card.Footer>
 *   <Button variant="primary">Save</Button>
 *   <Button variant="ghost">Cancel</Button>
 * </Card.Footer>
 *
 * @param {Object} props - Component props
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} props.children - Footer content
 * @returns {JSX.Element}
 */
function CardFooter({ className, children, ...props }) {
  const { variant } = useContext(CardContext);
  const borderColor = variant === 'dark' ? 'border-brutal-white' : 'border-brutal-black';

  return (
    <div
      className={cn('pt-4 mt-4 border-t-brutal-thick', borderColor, className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Attach compound components
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
