/**
 * GraphMind Design System - Effects
 *
 * Neo-Brutalist visual effect components and hooks.
 * All effects automatically respect prefers-reduced-motion.
 *
 * @example
 * // Import components
 * import { OffsetLayer, GlitchText, ScanLine, BorderDraw } from '../design-system/effects';
 *
 * @example
 * // Import hooks for custom implementations
 * import { useOffsetLayer, useGlitchText, useScanLine, useBorderDraw } from '../design-system/effects';
 *
 * @example
 * // Combined usage
 * <OffsetLayer variant="accent">
 *   <BorderDraw trigger="hover">
 *     <ScanLine>
 *       <Card>
 *         <GlitchText as="h2">TITLE</GlitchText>
 *       </Card>
 *     </ScanLine>
 *   </BorderDraw>
 * </OffsetLayer>
 */

// Components
export { default as OffsetLayer } from './OffsetLayer';
export { default as GlitchText } from './GlitchText';
export { default as ScanLine } from './ScanLine';
export { default as BorderDraw } from './BorderDraw';

// Hooks
export { useReducedMotion } from './useReducedMotion';
export { useOffsetLayer } from './OffsetLayer';
export { useGlitchText } from './GlitchText';
export { useScanLine } from './ScanLine';
export { useBorderDraw } from './BorderDraw';
