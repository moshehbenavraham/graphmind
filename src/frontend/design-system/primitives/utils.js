/**
 * GraphMind Design System - Utility Functions
 *
 * Zero-dependency utilities for the neo-brutalist component library.
 */

/**
 * Conditionally merges class names (like clsx but zero-dependency).
 *
 * Handles strings, objects, arrays, and falsy values.
 *
 * @example
 * // String arguments
 * cn('btn-brutal', 'btn-brutal-primary')
 * // => 'btn-brutal btn-brutal-primary'
 *
 * @example
 * // Object syntax (key included if value is truthy)
 * cn('btn-brutal', { 'btn-brutal-lg': isLarge, 'opacity-50': isDisabled })
 * // => 'btn-brutal btn-brutal-lg' (if isLarge true, isDisabled false)
 *
 * @example
 * // Conditional with && operator
 * cn('btn-brutal', isDisabled && 'opacity-50', className)
 * // => 'btn-brutal opacity-50 custom-class' (if isDisabled true)
 *
 * @example
 * // Nested arrays
 * cn('base', ['nested', 'classes'], 'final')
 * // => 'base nested classes final'
 *
 * @param {...(string|object|array|boolean|null|undefined)} classes - Class names to merge
 * @returns {string} Merged class string
 */
export function cn(...classes) {
  return classes
    .flatMap((cls) => {
      if (!cls) return [];
      if (typeof cls === 'string') return cls;
      if (Array.isArray(cls)) return cn(...cls);
      if (typeof cls === 'object') {
        return Object.entries(cls)
          .filter(([, v]) => Boolean(v))
          .map(([k]) => k);
      }
      return [];
    })
    .join(' ')
    .trim();
}
