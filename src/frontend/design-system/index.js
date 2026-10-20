/**
 * GraphMind Design System
 *
 * Neo-Brutalist UI component library for the GraphMind application.
 * Import all components, effects, animations, and voice components from this single entry point.
 *
 * Design Principles:
 * - Zero border-radius (hard corners everywhere)
 * - Hard shadows (no blur) with 4px offsets
 * - Magenta (#FF00FF) primary accent
 * - Thick black borders (2-4px)
 * - Monospace typography (JetBrains Mono, Space Mono)
 * - Mechanical animations (stepped easing, short duration)
 *
 * @example
 * // Import specific components
 * import { Button, Card, Input, GlitchText, BrutalWaveform } from '../design-system';
 *
 * @example
 * // Import all from a category
 * import { Button, Card, Badge } from '../design-system';
 * import { useGlitch, useTypewriter, brutalInteraction } from '../design-system';
 *
 * @example
 * // Import utility
 * import { cn } from '../design-system';
 */

// ============================================================
// PRIMITIVES - Core UI components
// ============================================================

export {
  // Utility
  cn,
  // Components
  Button,
  Card,
  Input,
  Textarea,
  Select,
  Badge,
} from './primitives';

// ============================================================
// EFFECTS - Visual effect components and hooks
// ============================================================

export {
  // Components
  OffsetLayer,
  GlitchText,
  ScanLine,
  BorderDraw,
  // Hooks
  useReducedMotion,
  useOffsetLayer,
  useGlitchText,
  useScanLine,
  useBorderDraw,
} from './effects';

// ============================================================
// ANIMATIONS - Framer Motion presets and animation hooks
// ============================================================

export {
  // Constants
  BRUTAL_EASE,
  BRUTAL_DURATION,
  // Interaction presets
  brutalHover,
  brutalTap,
  brutalTransition,
  brutalInteraction,
  // Enter/Exit presets
  brutalEnter,
  brutalExit,
  // Stagger presets
  brutalStagger,
  createStagger,
  // Hooks
  useGlitch,
  useTypewriter,
} from './animations';

// ============================================================
// VOICE - Voice interaction components and hooks
// ============================================================

export {
  // Components
  BrutalWaveform,
  RecordingIndicator,
  TerminalTranscript,
  // Hooks
  useWaveform,
  useRecordingIndicator,
} from './voice';
