/**
 * GraphMind Design System - Input Components
 *
 * Neo-brutalist form inputs with built-in labels, error states,
 * and accessibility features.
 */

import { useId } from 'react';
import { cn } from './utils';

/**
 * Neo-Brutalist Input Component
 *
 * Text input with thick borders, magenta focus states, and optional label.
 * Includes built-in error handling with accessible error messages.
 *
 * @example
 * // Basic input
 * <Input placeholder="Enter your name" />
 *
 * @example
 * // With label
 * <Input label="Email" type="email" placeholder="you@example.com" />
 *
 * @example
 * // With error state
 * <Input
 *   label="Email"
 *   error
 *   errorText="Please enter a valid email"
 *   type="email"
 * />
 *
 * @example
 * // With helper text
 * <Input
 *   label="Password"
 *   type="password"
 *   helperText="Must be at least 8 characters"
 * />
 *
 * @example
 * // Controlled input
 * <Input
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 * />
 *
 * @param {Object} props - Component props
 * @param {string} [props.label] - Label text displayed above input
 * @param {boolean} [props.error=false] - Shows error state styling
 * @param {string} [props.errorText] - Error message (shown when error=true)
 * @param {string} [props.helperText] - Helper text below input
 * @param {string} [props.className] - Additional CSS classes for the input
 * @param {string} [props.id] - HTML id (auto-generated if not provided)
 * @param {React.Ref} [props.ref] - Forwarded ref
 * @returns {JSX.Element}
 */
function Input({
  label,
  error = false,
  errorText,
  helperText,
  className,
  id: providedId,
  ref,
  ...props
}) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block mb-2 font-mono font-bold uppercase tracking-wider text-sm"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          error ? 'input-brutal-error' : 'input-brutal',
          className
        )}
        aria-invalid={error || undefined}
        aria-describedby={
          error && errorText
            ? errorId
            : helperText
              ? helperId
              : undefined
        }
        {...props}
      />
      {error && errorText && (
        <p
          id={errorId}
          className="mt-2 text-status-error font-mono text-xs uppercase tracking-wider"
          role="alert"
        >
          {errorText}
        </p>
      )}
      {!error && helperText && (
        <p
          id={helperId}
          className="mt-2 text-brutal-charcoal/70 font-mono text-xs"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

/**
 * Neo-Brutalist Textarea Component
 *
 * Multi-line text input with brutalist styling.
 * Features resizable textarea with thick borders.
 *
 * @example
 * // Basic textarea
 * <Textarea placeholder="Enter a description..." />
 *
 * @example
 * // With label and rows
 * <Textarea
 *   label="Description"
 *   placeholder="Describe your project..."
 *   rows={4}
 * />
 *
 * @example
 * // With error state
 * <Textarea
 *   label="Bio"
 *   error
 *   errorText="Bio is required"
 * />
 *
 * @param {Object} props - Component props
 * @param {string} [props.label] - Label text displayed above textarea
 * @param {boolean} [props.error=false] - Shows error state styling
 * @param {string} [props.errorText] - Error message (shown when error=true)
 * @param {string} [props.helperText] - Helper text below textarea
 * @param {string} [props.className] - Additional CSS classes
 * @param {string} [props.id] - HTML id (auto-generated if not provided)
 * @param {React.Ref} [props.ref] - Forwarded ref
 * @returns {JSX.Element}
 */
function Textarea({
  label,
  error = false,
  errorText,
  helperText,
  className,
  id: providedId,
  ref,
  ...props
}) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block mb-2 font-mono font-bold uppercase tracking-wider text-sm"
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={cn(
          'textarea-brutal',
          error && 'border-status-error',
          className
        )}
        aria-invalid={error || undefined}
        aria-describedby={
          error && errorText
            ? errorId
            : helperText
              ? helperId
              : undefined
        }
        {...props}
      />
      {error && errorText && (
        <p
          id={errorId}
          className="mt-2 text-status-error font-mono text-xs uppercase tracking-wider"
          role="alert"
        >
          {errorText}
        </p>
      )}
      {!error && helperText && (
        <p
          id={helperId}
          className="mt-2 text-brutal-charcoal/70 font-mono text-xs"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

/**
 * Neo-Brutalist Select Component
 *
 * Dropdown select with custom arrow icon and brutalist styling.
 * Supports both options array and children patterns.
 *
 * @example
 * // With options array
 * <Select
 *   label="Category"
 *   placeholder="Select a category"
 *   options={[
 *     { value: 'work', label: 'Work' },
 *     { value: 'personal', label: 'Personal' },
 *   ]}
 *   value={category}
 *   onChange={(e) => setCategory(e.target.value)}
 * />
 *
 * @example
 * // With children (manual options)
 * <Select label="Priority">
 *   <option value="">Select priority</option>
 *   <option value="low">Low</option>
 *   <option value="medium">Medium</option>
 *   <option value="high">High</option>
 * </Select>
 *
 * @example
 * // With error state
 * <Select
 *   label="Status"
 *   error
 *   errorText="Please select a status"
 *   options={statusOptions}
 * />
 *
 * @param {Object} props - Component props
 * @param {string} [props.label] - Label text displayed above select
 * @param {boolean} [props.error=false] - Shows error state styling
 * @param {string} [props.errorText] - Error message (shown when error=true)
 * @param {string} [props.placeholder] - Placeholder option text
 * @param {Array<{value: string, label: string}>} [props.options] - Array of options
 * @param {string} [props.className] - Additional CSS classes
 * @param {string} [props.id] - HTML id (auto-generated if not provided)
 * @param {React.ReactNode} [props.children] - Manual option elements (alternative to options array)
 * @param {React.Ref} [props.ref] - Forwarded ref
 * @returns {JSX.Element}
 */
function Select({
  label,
  error = false,
  errorText,
  placeholder,
  options = [],
  className,
  id: providedId,
  children,
  ref,
  ...props
}) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = `${id}-error`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block mb-2 font-mono font-bold uppercase tracking-wider text-sm"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={cn(
          'select-brutal',
          error && 'border-status-error',
          className
        )}
        aria-invalid={error || undefined}
        aria-describedby={error && errorText ? errorId : undefined}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children ||
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>
      {error && errorText && (
        <p
          id={errorId}
          className="mt-2 text-status-error font-mono text-xs uppercase tracking-wider"
          role="alert"
        >
          {errorText}
        </p>
      )}
    </div>
  );
}

export { Input, Textarea, Select };
export default Input;
