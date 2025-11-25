/**
 * GraphMind Design System - Animation Presets
 *
 * Framer Motion animation presets for Neo-Brutalist mechanical feel.
 * These are RAW presets - components should check useReducedMotion before applying.
 *
 * All animations use stepped/mechanical easing for the brutalist aesthetic.
 * Avoid smooth, eased transitions - embrace the mechanical, digital feel.
 */

// === EASING CONSTANTS ===

/**
 * Mechanical easing curve - sharp, not smooth
 * Equivalent to a custom ease-in with abrupt stop
 * @type {[number, number, number, number]}
 */
export const BRUTAL_EASE = [0.4, 0, 1, 1];

/**
 * Standard animation duration for interactions
 * @type {number}
 */
export const BRUTAL_DURATION = 0.1;

// === INTERACTION PRESETS ===

/**
 * Hover state - shift up-left to reveal shadow underneath
 * Use with whileHover prop
 * @type {{ x: number, y: number }}
 */
export const brutalHover = { x: -2, y: -2 };

/**
 * Active/tap state - press into shadow for tactile feedback
 * Use with whileTap prop
 * @type {{ scale: number, x: number, y: number }}
 */
export const brutalTap = { scale: 0.98, x: 2, y: 2 };

/**
 * Standard transition for all brutalist animations
 * @type {{ duration: number, ease: [number, number, number, number] }}
 */
export const brutalTransition = { duration: BRUTAL_DURATION, ease: BRUTAL_EASE };

/**
 * Combined hover/tap props for motion components
 * Spread directly onto motion.button, motion.div, etc.
 *
 * @example
 * <motion.button {...brutalInteraction}>Click me</motion.button>
 *
 * @type {{ whileHover: object, whileTap: object, transition: object }}
 */
export const brutalInteraction = {
  whileHover: brutalHover,
  whileTap: brutalTap,
  transition: brutalTransition,
};

// === ENTER/EXIT PRESETS ===

/**
 * Entrance animation - mechanical slide in from left
 * Spread onto motion components with AnimatePresence
 *
 * @example
 * <motion.div {...brutalEnter}>Content</motion.div>
 *
 * @type {{ initial: object, animate: object, transition: object }}
 */
export const brutalEnter = {
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.15, ease: BRUTAL_EASE },
};

/**
 * Exit animation - mechanical slide out to right
 * Use with AnimatePresence for unmount animations
 *
 * @example
 * <AnimatePresence>
 *   {show && <motion.div {...brutalEnter} {...brutalExit}>Content</motion.div>}
 * </AnimatePresence>
 *
 * @type {{ exit: object, transition: object }}
 */
export const brutalExit = {
  exit: { opacity: 0, x: 10 },
  transition: { duration: 0.1, ease: BRUTAL_EASE },
};

// === STAGGER PRESETS ===

/**
 * Stagger animation variants for lists/grids
 * Apply container variants to parent, item variants to children
 *
 * @example
 * <motion.ul
 *   variants={brutalStagger.container}
 *   initial="hidden"
 *   animate="visible"
 * >
 *   {items.map(item => (
 *     <motion.li key={item.id} variants={brutalStagger.item}>
 *       {item.name}
 *     </motion.li>
 *   ))}
 * </motion.ul>
 *
 * @type {{ container: object, item: object }}
 */
export const brutalStagger = {
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  },
  item: {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.15, ease: BRUTAL_EASE },
    },
  },
};

/**
 * Factory to create custom stagger configurations
 *
 * @example
 * const fastStagger = createStagger({ staggerDelay: 0.02 });
 * const slowStagger = createStagger({ staggerDelay: 0.1, delayChildren: 0.2 });
 *
 * @param {Object} options - Stagger options
 * @param {number} [options.staggerDelay=0.05] - Delay between each child
 * @param {number} [options.delayChildren=0] - Initial delay before first child
 * @returns {{ container: object, item: object }}
 */
export function createStagger({ staggerDelay = 0.05, delayChildren = 0 } = {}) {
  return {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: staggerDelay,
          delayChildren,
        },
      },
    },
    item: brutalStagger.item,
  };
}
