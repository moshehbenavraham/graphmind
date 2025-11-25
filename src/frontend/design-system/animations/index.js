/**
 * GraphMind Design System - Animations
 *
 * Framer Motion presets and animation hooks for Neo-Brutalist effects.
 * All hooks respect prefers-reduced-motion automatically.
 *
 * @example
 * // Import presets for motion components
 * import { brutalHover, brutalTap, brutalTransition } from '../design-system/animations';
 *
 * @example
 * // Import combined interaction preset
 * import { brutalInteraction } from '../design-system/animations';
 * <motion.button {...brutalInteraction}>Click</motion.button>
 *
 * @example
 * // Import hooks
 * import { useGlitch, useTypewriter } from '../design-system/animations';
 *
 * @example
 * // Import stagger for lists
 * import { brutalStagger } from '../design-system/animations';
 * <motion.ul variants={brutalStagger.container} initial="hidden" animate="visible">
 *   {items.map(item => (
 *     <motion.li key={item.id} variants={brutalStagger.item}>{item.name}</motion.li>
 *   ))}
 * </motion.ul>
 */

// === Presets ===

// Constants
export { BRUTAL_EASE, BRUTAL_DURATION } from './presets';

// Interaction presets (individual)
export { brutalHover, brutalTap, brutalTransition } from './presets';

// Interaction preset (combined)
export { brutalInteraction } from './presets';

// Enter/Exit presets
export { brutalEnter, brutalExit } from './presets';

// Stagger presets
export { brutalStagger, createStagger } from './presets';

// === Hooks ===

export { useGlitch } from './useGlitch';
export { useTypewriter } from './useTypewriter';
