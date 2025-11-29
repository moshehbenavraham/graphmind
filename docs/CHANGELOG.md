# GraphMind Documentation Changelog

All notable changes to the GraphMind documentation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Previous Changelogs: `docs/previous_changelogs/`

---
Begin Changelog Entries Here - We do not use "unreleased" so all entries should have a version
---

## [0.4.0] - 2025-11-29

### Added

- **Feature 015: Entity Role Bug Fix** - Pattern-based entity role detection for voice queries
  - `identifyEntityRole()` function with regex pattern detection
  - `relationshipByTargetTemplate()` for target-based queries
  - Question pattern matching for "Who VERBS X?" vs "What does X VERB?" patterns
  - 55/59 tasks complete (93%), ready for local validation

- **GraphRAG 2.0 Infrastructure** - Vector-first semantic search
  - 768-dimension embeddings for 61 nodes (Person, Project, Topic)
  - Vector search with cosine similarity scoring
  - Hybrid search combining vector + graph traversal

### Changed

- **PRD Documentation Update** - Comprehensive status refresh via `/updateprd`
  - Updated `docs/PRD/README_PRD.md` with current implementation progress
  - Updated `docs/PRD/REQUIREMENTS-PRD.md` with 15 completed features
  - Updated phase documents (Phase 3: 100%, Phase 4: 25%)
  - All 15 specs now tracked with validation status

- **Project Status** - Phase 4 progress: 15% → 25%
  - Neo-Brutalist UI design system complete (v0.3.5-0.3.13)
  - Security hardening complete (Features 012-014)
  - Entity role bug fix in progress (Feature 015: 93%)

### Performance

- Vector search: Sub-millisecond query times (<1ms)
- Pattern detection: <1ms (target met)
- Graph queries: 9ms uncached, 8ms cached

### Documentation

- **Implementation Tracking** - specs/015-entity-role-bugfix/
  - spec.md, design.md, tasks.md, validation.md complete

- **PRD Updates** - docs/PRD/
  - README_PRD.md: Current status section updated
  - REQUIREMENTS-PRD.md: Implementation status updated
  - phases/phase-3-voice-query.md: 100% complete
  - phases/phase-4-polish.md: 25% complete with implementation status

### Next Steps

- Complete Feature 015 remaining 4 tasks (local validation)
- Deploy entity role fix to production
- Mark Feature 011 (Frontend) as fully functional
- Continue Phase 4 features (search, entity management)

## [0.3.13] - 2025-11-25

### Changed

**Neo-Brutalist Design System Data Components & Final Cleanup (Session 9)**
- Transformed `NotesList.jsx` to use design system components:
  - Removed CSS import `../styles/notes-list.css`
  - Uses `Card` with `interactive` prop for clickable note cards
  - Uses `GlitchText` for page title with glitch effect
  - Uses `Badge` (accent variant) for note count display
  - Uses `Button` (secondary variant) for pagination controls
  - Uses `OffsetLayer` (accent variant) for empty state card
  - Grid layout with responsive columns (1/2/3 based on viewport)
  - Framer Motion stagger animations for list items
  - Metadata row with tabular-nums for duration display
- Transformed `NoteDetail.jsx` to use design system components:
  - Removed CSS import `../styles/note-detail.css`
  - Uses `Card` primitive for metadata and transcript sections
  - Uses `Badge` (success/warning/error variants) for processing status
  - Uses `Button` (ghost/danger variants) for back/delete actions
  - Uses `modal-overlay-brutal` and `modal-brutal` classes for delete modal
  - Framer Motion animated modal with enter/exit transitions
- Transformed `QueryResults.jsx` to use design system components:
  - Removed dead CSS import `../styles/QueryResults.css` (file never existed)
  - Uses `Card` for entity cards and relationship display
  - Uses `Badge` (accent/default/info/success variants) for metadata
  - Uses `OffsetLayer` for empty state display
  - Uses `terminal-brutal` class for question display
  - Expandable entity properties with animated accordion
  - Relationship visualization with arrow indicators
- Transformed `QueryHistory.jsx` to use design system components:
  - Removed dead CSS import `../styles/QueryHistory.css` (file never existed)
  - Uses `Card` with `interactive` prop for query items
  - Uses `GlitchText` for section title
  - Uses `Badge` for query count and metadata
  - Uses `Button` for pagination controls
  - Uses `OffsetLayer` (accent variant) for empty state
  - Framer Motion stagger animations for list items

### Removed

**Legacy CSS Files Deleted:**
- `src/frontend/styles/notes-list.css` - 485 lines of legacy styles
- `src/frontend/styles/note-detail.css` - 656 lines of legacy styles
- `src/frontend/styles/VoiceRecorder.css` - Voice recorder styles (replaced in Session 8)
- `src/frontend/styles/voice-recorder.css` - Duplicate voice recorder styles
- `src/frontend/styles/transcript-view.css` - Transcript view styles (replaced in Session 8)
- `src/frontend/styles/main.css` - 133 lines of global legacy styles

**Import Cleanup:**
- Removed `import './styles/main.css'` from `main.jsx`
- Styles directory now empty (all styles consolidated in design-system/tokens)

### Technical Details

**Files Modified:**
- `src/frontend/components/NotesList.jsx` - Complete transformation (417 -> 447 lines)
- `src/frontend/components/NoteDetail.jsx` - Complete transformation (423 -> 453 lines)
- `src/frontend/components/QueryResults.jsx` - Complete transformation (226 -> 269 lines)
- `src/frontend/components/QueryHistory.jsx` - Complete transformation (274 -> 317 lines)
- `src/frontend/main.jsx` - Removed legacy CSS import

**Files Deleted:**
- `src/frontend/styles/notes-list.css`
- `src/frontend/styles/note-detail.css`
- `src/frontend/styles/VoiceRecorder.css`
- `src/frontend/styles/voice-recorder.css`
- `src/frontend/styles/transcript-view.css`
- `src/frontend/styles/main.css`

**Design System Components Used:**
- `Card` + `Card.Body` - Container components
- `Card` (interactive) - Clickable cards with hover/tap states
- `Button` (primary, secondary, danger, ghost) - Action buttons
- `Badge` (accent, default, success, error, warning, info) - Status indicators
- `GlitchText` - Page titles with chromatic aberration
- `OffsetLayer` (accent variant) - Magenta shadow offset effect
- `cn()` - Conditional class merging utility
- `brutalStagger` - Framer Motion stagger animation variants
- `brutalEnter`/`brutalExit` - Modal enter/exit animations

**Final Checklist Completed:**
- [x] Zero border-radius on ALL elements (enforced in tokens/index.css)
- [x] Hard shadows (no blur) everywhere (box-shadow: 4-6px offsets)
- [x] Magenta (#FF00FF) accent consistently applied
- [x] Thick black borders (2-4px) on all interactive elements
- [x] Monospace typography (JetBrains Mono, Space Mono)
- [x] All inline styles removed (0 `style={{}}` in components)
- [x] Old CSS files deleted (6 files, ~1,400 lines removed)
- [x] Build passes successfully
- [x] Accessibility: 20+ aria attributes, role attributes on interactive elements

**Neo-Brutalist UI Rework Complete:**
- All 9 sessions completed
- 19 new design system files created
- 14 component files transformed
- 6 legacy CSS files deleted
- Consistent visual language across entire application

## [0.3.12] - 2025-11-25

### Changed

**Neo-Brutalist Design System Voice Components Integration (Session 8)**
- Transformed `VoiceRecorder.jsx` to use design system components:
  - Removed CSS import `../styles/VoiceRecorder.css`
  - Uses `Card` primitive as main container
  - Uses `RecordingIndicator` (hazard variant) for recording status
  - Uses `BrutalWaveform` (demo mode, recording variant) for visualization
  - Uses `Button` primitive (primary/danger variants) for record/stop
  - Uses `Badge` (error variant) for error messages
  - Uses `cn()` utility for dynamic class composition
  - Timer display with tabular-nums and status-based coloring
- Transformed `VoiceQueryRecorder.jsx` to use design system components:
  - Uses `TerminalTranscript` for real-time transcript display
  - Uses `RecordingIndicator` (hazard variant) for status
  - Uses `BrutalWaveform` for audio visualization
  - Uses `Card` and `Badge` for layout and error states
  - Uses `Button` with loading state for record control
  - Processing state shows `loading-brutal` spinner
- Transformed `AudioPlayer.jsx` to use design system components:
  - Removed all inline style objects (73 lines of styles removed)
  - Uses `Card` primitive as container
  - Uses `Badge` for status indicator (success/warning/error variants)
  - Uses `Button` primitives for play/pause/stop controls
  - Brutalist progress bar with status-based coloring
  - SVG icons for playback controls
- Transformed `TranscriptView.jsx` to use design system components:
  - Removed `<style jsx>` block (~180 lines of inline CSS)
  - Uses `TerminalTranscript` for both live and saved transcripts
  - Uses `Card` (default and accent variants) for containers
  - Uses `Badge` (success/warning variants) for status
  - Uses `Button` for actions (view note, copy transcript)
  - Grid-based metadata display with brutalist styling
  - Copy to clipboard with success feedback

### Technical Details

**Files Modified:**
- `src/frontend/components/VoiceRecorder.jsx` - Complete transformation (401 -> 415 lines)
- `src/frontend/components/VoiceQueryRecorder.jsx` - Complete transformation (423 -> 470 lines)
- `src/frontend/components/AudioPlayer.jsx` - Complete transformation (303 -> 231 lines)
- `src/frontend/components/TranscriptView.jsx` - Complete transformation (376 -> 245 lines)

**Design System Components Used:**
- `Card` + `Card.Header`, `Card.Body` - Container components
- `Button` (primary, secondary, danger, loading) - Action buttons
- `Badge` (success, warning, error, default) - Status indicators
- `RecordingIndicator` (hazard variant, lg size) - Recording status
- `BrutalWaveform` (demo mode, recording variant) - Audio visualization
- `TerminalTranscript` (default, success variants) - Transcript display
- `cn()` - Conditional class merging utility

**Inline Styles Removed:**
- VoiceRecorder: Removed CSS import, uses Tailwind utilities
- VoiceQueryRecorder: Removed CSS import, uses Tailwind utilities
- AudioPlayer: Removed 73-line `styles` object
- TranscriptView: Removed 180-line `<style jsx>` block

**Voice Components Integration:**
- RecordingIndicator: Hazard stripes animation during recording
- BrutalWaveform: Demo mode with procedural animated bars
- TerminalTranscript: Real-time typewriter effect for live transcript
- TerminalTranscript: Success variant for saved transcripts

## [0.3.11] - 2025-11-25

### Changed

**Neo-Brutalist Design System Core Pages (Session 7)**
- Transformed `DashboardPage.jsx` to use design system components:
  - Replaced 20+ inline `style={{}}` objects with Tailwind CSS classes
  - Uses `GlitchText` component for page title with glitch effect
  - Uses `OffsetLayer` with accent variant for action card shadows
  - Uses `Card` with `interactive` prop for clickable navigation cards
  - Uses `Button` primitives for action buttons
  - Uses `Badge` components for success/error messages
  - Numbered getting started list with brutalist styling
- Transformed `QueryPage.jsx` to integrate voice components:
  - Replaced circular record button with brutalist square button
  - Uses `RecordingIndicator` (hazard variant) for active recording status
  - Uses `BrutalWaveform` for audio visualization (demo mode)
  - Uses `TerminalTranscript` for live transcript display
  - Uses `Card` primitives for all content sections
  - Uses `Badge` for error state display
  - Dark variant `Card` for knowledge graph data display
  - Removed inline `@keyframes pulse` animation
- Transformed `HistoryPage.jsx` with terminal-style data display:
  - Uses `GlitchText` for page title
  - Uses `Card` with `interactive` prop for expandable query items
  - Uses `terminal-brutal` class for answer display (CRT terminal style)
  - Uses `Badge` with numbering for query index
  - Uses `OffsetLayer` for empty state card
  - Traffic light buttons in terminal header
  - `loading-brutal` spinner for loading state

### Technical Details

**Files Modified:**
- `src/frontend/pages/DashboardPage.jsx` - Complete transformation (265 -> 182 lines)
- `src/frontend/pages/QueryPage.jsx` - Complete transformation (592 -> 564 lines)
- `src/frontend/pages/HistoryPage.jsx` - Complete transformation (260 -> 213 lines)

**Design System Components Used:**
- `GlitchText` - Page titles with chromatic aberration
- `Card` + `Card.Header`, `Card.Body` - Content containers
- `Card` (interactive) - Clickable cards with hover/tap states
- `Button` (primary, secondary, danger, loading) - Action buttons
- `Badge` (accent, success, error) - Status indicators
- `OffsetLayer` (accent, lg) - Magenta shadow offset effect
- `RecordingIndicator` (hazard, lg) - Recording status animation
- `BrutalWaveform` (demo, recording variant) - Audio visualization
- `TerminalTranscript` - Live transcript with typewriter effect

**Voice Components Integration:**
- BrutalWaveform displays animated bars in demo mode during recording
- RecordingIndicator shows animated hazard stripes when recording
- TerminalTranscript shows transcript with blinking cursor and prompt

**Styling Changes:**
- Removed all inline `style={{}}` objects (zero remaining in all 3 files)
- Background: `bg-[#FFFEF0]` (brutal cream) on all pages
- Terminal sections use `terminal-brutal` class (black bg, magenta text)
- Graph data displays use `text-status-success` (green terminal text)
- Consistent use of `font-mono` for all data/code display

## [0.3.10] - 2025-11-25

### Changed

**Neo-Brutalist Design System Auth Pages (Session 6)**
- Transformed `LoginPage.jsx` to use design system components:
  - Replaced 15+ inline `style={{}}` objects with Tailwind CSS classes
  - Uses `GlitchText` component for logo with continuous glitch effect
  - Uses `OffsetLayer` with accent variant for card shadow effect
  - Uses `Card` primitive as form container
  - Uses `Input` primitive with built-in labels and error states
  - Uses `Button` primitive with loading state support
  - Uses `Badge` component for error message display
  - Fully responsive with Tailwind breakpoints
- Transformed `RegisterPage.jsx` with matching design system components:
  - Same component usage pattern as LoginPage for consistency
  - Added `helperText` prop on password field for validation hints
  - Three form fields: Email, Password, Confirm Password
  - Consistent brutalist styling with magenta accent offset

### Technical Details

**Files Modified:**
- `src/frontend/pages/LoginPage.jsx` - Complete transformation (186 -> 157 lines)
- `src/frontend/pages/RegisterPage.jsx` - Complete transformation (239 -> 198 lines)

**Design System Components Used:**
- `Card` + `Card.Body` - Form container with brutalist border/shadow
- `Button` (variant="primary", loading) - Submit buttons
- `Input` (label, error, helperText, disabled) - Form fields
- `GlitchText` (as="h1") - Logo with chromatic aberration
- `OffsetLayer` (variant="accent", size="lg") - Magenta shadow offset
- `Badge` (variant="error") - Error message display

**Styling Changes:**
- Removed all inline `style={{}}` objects (zero remaining)
- Uses Tailwind utility classes for layout/spacing
- Background color: `bg-[#FFFEF0]` (brutal cream)
- Link color: `text-accent-primary` (magenta #FF00FF)
- Text color: `text-brutal-charcoal/70` for secondary text
- Spacing: `space-y-6` for form fields, `mb-8` for header

## [0.3.9] - 2025-11-25

### Added

**Neo-Brutalist Design System Main Export & Navigation (Session 5)**
- Created `design-system/index.js` - Main barrel export for entire design system:
  - Re-exports all primitives: `cn`, `Button`, `Card`, `Input`, `Textarea`, `Select`, `Badge`
  - Re-exports all effects: `OffsetLayer`, `GlitchText`, `ScanLine`, `BorderDraw`, `useReducedMotion`, hooks
  - Re-exports all animations: `BRUTAL_EASE`, `brutalHover`, `brutalTap`, `brutalInteraction`, `useGlitch`, `useTypewriter`
  - Re-exports all voice: `BrutalWaveform`, `RecordingIndicator`, `TerminalTranscript`, hooks
- Transformed `Navigation.jsx` to use design system primitives:
  - Uses `GlitchText` for logo with continuous glitch effect
  - Uses `Button` primitive for logout
  - Added mobile responsive hamburger menu with animated bars
  - Uses new `nav-brutal`, `nav-link-brutal` CSS classes
  - Fully responsive with mobile drawer menu

### Changed

**Tailwind CSS v4 Migration**
- Migrated from `@tailwindcss/postcss` to `@tailwindcss/vite` plugin
- Updated `vite.config.js` to use `@tailwindcss/vite` plugin
- Simplified `postcss.config.js` to only use `autoprefixer`
- Rewrote `tokens/index.css` to use pure CSS instead of `@apply` directives:
  - Tailwind v4 does not support `@apply` with custom classes defined in same file
  - Tailwind v4 does not support responsive variants (md:, lg:) in `@apply`
  - All component classes now use native CSS properties for v4 compatibility
- Updated `main.jsx` to import design system tokens before legacy styles

### Technical Details

**Files Created:**
- `src/frontend/design-system/index.js` - Main barrel export

**Files Modified:**
- `src/frontend/components/Navigation.jsx` - Complete transformation to design system
- `src/frontend/main.jsx` - Added design system token import
- `src/frontend/design-system/tokens/index.css` - Rewrote for Tailwind v4 (pure CSS)
- `src/frontend/vite.config.js` - Added @tailwindcss/vite plugin
- `src/frontend/postcss.config.js` - Removed @tailwindcss/postcss
- `src/frontend/tailwind.config.js` - v4 compatibility updates

**Tailwind v4 Notes:**
- Use `@import "tailwindcss"` instead of `@tailwind base/components/utilities`
- Use `@config "path"` to reference custom configuration
- Cannot use `@apply` with custom classes defined in same file
- Cannot use responsive variants like `md:text-xl` inside `@apply`
- Solution: Use pure CSS properties instead of @apply

## [0.3.8] - 2025-11-25

### Added

**Neo-Brutalist Design System Voice Components (Session 4)**
- Created `BrutalWaveform.jsx` - Canvas-based audio visualization:
  - Blocky, pixelated bar rendering with `imageRendering: pixelated`
  - Three color variants: `waveform` (green), `recording` (red), `accent` (magenta)
  - Demo mode with animated procedural sin-wave data
  - 60fps rendering via `requestAnimationFrame`
  - Configurable bar count, width, gap, and height
  - Hook: `useWaveform({ audioData, barCount, disabled })`
- Created `RecordingIndicator.jsx` with three visual variants:
  - `hazard` (default): Animated diagonal stripes (black/magenta or black/red)
  - `beacon`: Pulsing dot with optional glow effect
  - `terminal`: Blinking "[ REC ]" text in terminal style
  - Three sizes: `sm`, `md`, `lg`
  - CSS-only animations for GPU-accelerated performance
  - Hook: `useRecordingIndicator({ variant, active, disabled })`
- Created `TerminalTranscript.jsx` - Terminal-styled transcript display:
  - Integrates `useTypewriter` hook for character-by-character reveal
  - Three color variants: `default` (magenta), `success` (green), `error` (red)
  - Optional line numbers and prompt character
  - Blinking cursor during typing
  - Terminal header bar with traffic light buttons
- Created barrel export at `design-system/voice/index.js`

### Technical Details

**Files Created:**
- `src/frontend/design-system/voice/BrutalWaveform.jsx`
- `src/frontend/design-system/voice/RecordingIndicator.jsx`
- `src/frontend/design-system/voice/TerminalTranscript.jsx`
- `src/frontend/design-system/voice/index.js`

**Features:**
- All components use `cn()` utility for class merging
- All components integrate `useReducedMotion` for accessibility
- BrutalWaveform uses refs (not state) for audio data to avoid re-renders
- Canvas context optimized with `alpha: false` and `desynchronized: true`
- RecordingIndicator uses CSS-only animations (GPU-accelerated)
- TerminalTranscript leverages existing `useTypewriter` hook

## [0.3.7] - 2025-11-25

### Added

**Neo-Brutalist Design System Animations (Session 3)**
- Created `animations/presets.js` with Framer Motion animation objects:
  - `BRUTAL_EASE` - Mechanical easing curve `[0.4, 0, 1, 1]`
  - `BRUTAL_DURATION` - Standard animation duration (0.1s)
  - `brutalHover` - Hover state offset `{ x: -2, y: -2 }`
  - `brutalTap` - Tap state with scale `{ scale: 0.98, x: 2, y: 2 }`
  - `brutalTransition` - Combined transition config
  - `brutalInteraction` - Combined hover/tap/transition object for spreading
  - `brutalEnter` / `brutalExit` - Enter/exit animation presets
  - `brutalStagger` - Container/item variants for staggered lists
  - `createStagger()` - Factory for custom stagger configurations
- Created `useGlitch` hook for periodic/manual glitch effects:
  - Two modes: `'manual'` (on-demand) and `'periodic'` (auto-trigger)
  - Returns `{ isGlitching, triggerGlitch, className, isActive }`
  - Uses CSS class toggle for performance (leverages existing `.glitch-text`)
- Created `useTypewriter` hook for character-by-character text reveal:
  - Configurable speed, delay, cursor visibility
  - Returns `{ displayText, isTyping, isComplete, cursorClassName, start, reset, skip }`
  - Uses existing `animate-brutal-blink` CSS class for cursor
- Created barrel export at `design-system/animations/index.js`

### Changed

**Animation Consistency Refactoring**
- Refactored `Button.jsx` to import presets from `animations/` module
- Refactored `Card.jsx` to import presets from `animations/` module
- Removed duplicate inline animation objects from both components
- Card interactive mode now includes `scale: 0.98` on tap (aligned with Button)

### Technical Details

**Files Created:**
- `src/frontend/design-system/animations/presets.js` - Framer Motion presets
- `src/frontend/design-system/animations/useGlitch.js` - Glitch trigger hook
- `src/frontend/design-system/animations/useTypewriter.js` - Typewriter effect hook
- `src/frontend/design-system/animations/index.js` - Barrel export

**Files Modified:**
- `src/frontend/design-system/primitives/Button.jsx` - Import from animations, remove inline const
- `src/frontend/design-system/primitives/Card.jsx` - Import from animations, remove inline const

**Features:**
- All hooks integrate `useReducedMotion` for accessibility
- Hooks return `isActive` boolean to indicate if animations are enabled
- `useGlitch` supports `onGlitch` callback
- `useTypewriter` supports `onComplete` callback
- Presets are static objects (zero runtime cost, excellent tree-shaking)

## [0.3.6] - 2025-11-25

### Added

**Neo-Brutalist Design System Effects (Session 2)**
- Created `useReducedMotion` hook for detecting user's motion preference (SSR-safe)
- Created `OffsetLayer` component with offset shadow effect (default/accent variants, md/lg sizes)
- Created `GlitchText` component with continuous CSS chromatic aberration effect
- Created `ScanLine` component with CRT horizontal lines overlay (optional animated scan bar)
- Created `BorderDraw` component with SVG animated border drawing (mount/hover/manual triggers)
- Created barrel export at `design-system/effects/index.js`
- Exported custom hooks: `useOffsetLayer`, `useGlitchText`, `useScanLine`, `useBorderDraw`

### Changed

**Accessibility: Reduced Motion Support**
- Added `@media (prefers-reduced-motion: reduce)` rules to `tokens/index.css`
- All effect animations disabled when user prefers reduced motion
- All effect components include `disabled` prop for manual opt-out
- BorderDraw falls back to static CSS border when disabled

### Technical Details

**Files Created:**
- `src/frontend/design-system/effects/useReducedMotion.js` - Shared accessibility hook
- `src/frontend/design-system/effects/OffsetLayer.jsx` - Offset shadow wrapper
- `src/frontend/design-system/effects/GlitchText.jsx` - Glitch text effect
- `src/frontend/design-system/effects/ScanLine.jsx` - CRT scanlines overlay
- `src/frontend/design-system/effects/BorderDraw.jsx` - SVG border animation
- `src/frontend/design-system/effects/index.js` - Barrel export

**Files Modified:**
- `src/frontend/design-system/tokens/index.css` - Added `.scanlines-animated` class, reduced motion rules

**Features:**
- All components use `cn()` utility from primitives
- Polymorphic `as` prop on OffsetLayer, GlitchText, ScanLine
- GlitchText requires string children (warns in dev if not)
- BorderDraw uses Framer Motion for smooth SVG animation
- BorderDraw uses ResizeObserver for responsive dimensions

## [0.3.5] - 2025-11-25

### Added

**Neo-Brutalist Design System Primitives (Session 1)**
- Created `cn()` utility for conditional class merging in `design-system/primitives/utils.js`
- Created `Button` component with Framer Motion animations, loading state, and `asChild` pattern
- Created `Card` component with compound pattern (`Card.Header`, `Card.Body`, `Card.Footer`)
- Created `Input`, `Textarea`, `Select` components with built-in labels and error states
- Created `Badge` component with 6 status variants (default, accent, success, error, warning, info)
- Created barrel export at `design-system/primitives/index.js`

### Technical Details

**Files Created:**
- `src/frontend/design-system/primitives/utils.js` - `cn()` class merging utility
- `src/frontend/design-system/primitives/Button.jsx` - Button with Framer Motion
- `src/frontend/design-system/primitives/Card.jsx` - Card with compound components
- `src/frontend/design-system/primitives/Input.jsx` - Input, Textarea, Select
- `src/frontend/design-system/primitives/Badge.jsx` - Status badge
- `src/frontend/design-system/primitives/index.js` - Barrel export

**Features:**
- All components wrap existing CSS classes from `tokens/index.css`
- Framer Motion integration for mechanical hover/tap animations
- Full accessibility: ARIA attributes, keyboard navigation, focus states
- React 19 compatible with native ref handling
- Zero external dependencies for class merging (custom `cn()` utility)

## [0.3.4] - 2025-11-24

### Added

**GraphRAG 2.0 Vector Search Verification**
- Verified complete GraphRAG 2.0 vector-first retrieval pipeline
- Backfilled 61 nodes with 768-dimension embeddings (6 Person, 4 Project, 51 Topic)
- Vector search operational with cosine similarity scoring
- Admin JWT authentication for backfill endpoint

### Fixed

**REST API Data Parser** (`scripts/falkordb-rest-api.js`)
- Added `extractValue()` function to parse FalkorDB's `[type, value]` format
- Added `extractColumnName()` for column headers in `[[type, name], ...]` format
- Fixed `parseFalkorDBResult()` to return clean column names and extracted values

**FalkorDB Parameter Handling** (`scripts/falkordb-rest-api.js`)
- Changed from `--params JSON` format to `CYPHER key=value` prefix format
- FalkorDB requires params in `CYPHER id=0 embedding=[...] MATCH...` syntax
- Fixed "Missing parameters" errors when executing parameterized queries

**REST API Port Configuration** (`scripts/falkordb-rest-api.js`)
- Added `FALKORDB_REDIS_PORT` env var for direct Redis connection (default 6380)
- Separated from `FALKORDB_PORT` which Workers use for REST API (3001)
- Fixed "Unknown RESP type 72 'H'" error caused by HTTP/Redis protocol mismatch

**Auth Middleware Admin Role** (`src/middleware/auth.js`)
- Added extraction of `role` and `is_admin` from JWT claims
- Fixed 403 Forbidden errors when accessing admin endpoints with valid admin JWT

**Backfill Endpoint** (`src/workers/api/admin/backfill-embeddings.js`)
- Fixed `userId` to use authenticated user's ID instead of `crypto.randomUUID()`
- Changed embedding storage to use `vecf32($embedding)` for vector index compatibility
- Fixed "Node null has no text to embed" errors from incorrect data parsing

### Technical Details

**Files Modified:**
- `scripts/falkordb-rest-api.js` - Lines 152-188 (CYPHER params), Lines 211-310 (data parser)
- `src/middleware/auth.js` - Lines 109-115 (role extraction)
- `src/workers/api/admin/backfill-embeddings.js` - Lines 105, 153, 167 (userId and vecf32)

**Vector Index Requirements:**
- Embeddings must be stored as `vecf32()` type, not raw arrays
- Indexes must be created BEFORE or rebuilt AFTER data population
- Query format: `CALL db.idx.vector.queryNodes('Label', 'embedding', K, vecf32($vector))`

## [0.3.3] - 2025-11-24

### Fixed

**FalkorDB Configuration for Local Development**
- Fixed "FALKORDB_HOST is not configured" error when adding seed data in local development
- Root cause: Wrangler ignores `.env` when `.dev.vars` exists, but `.dev.vars` was incomplete
- Added missing environment variables to `.dev.vars`: `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_USER`, `BCRYPT_COST`, `ANSWER_CACHE_TTL`, `ANSWER_MAX_TOKENS`, `LLM_TEMPERATURE`
- Workers now properly receive all required environment variables via `env` object

**FalkorDB Port Configuration Mismatch**
- Fixed "POOL_ERROR_500: PING failed: Network connection lost" error when connecting to FalkorDB
- Corrected port configuration from 6380 to 3001 in both `.dev.vars` and `.env`
- Workers now connect to REST API wrapper (port 3001) instead of attempting HTTP requests directly to FalkorDB Docker (port 6380 with Redis protocol)
- Architecture: Worker → REST API wrapper (3001) → FalkorDB Docker (6380)

### Changed

- `.dev.vars` now contains complete set of environment variables for local Worker development
- `.dev.vars` `FALKORDB_PORT` changed from 6380 to 3001 (REST API wrapper port)
- `.env` `FALKORDB_PORT` changed from 6380 to 3001 for consistency
- Added architecture documentation comments in both `.dev.vars` and `.env` explaining the connection flow

### Technical Details

**Files Modified:**
- `.dev.vars` - Complete rewrite: Added all missing environment variables and corrected FALKORDB_PORT
- `.env` - Lines 28-36: Updated FALKORDB_PORT and added documentation comments

**Environment Variables Added to `.dev.vars`:**
- `FALKORDB_HOST=localhost`
- `FALKORDB_PORT=3001` (changed from 6380)
- `FALKORDB_USER=default`
- `BCRYPT_COST=12`
- `ANSWER_CACHE_TTL=3600`
- `ANSWER_MAX_TOKENS=200`
- `LLM_TEMPERATURE=0.7`

**Architecture Clarification:**
- FalkorDB Docker: Port 6380 (Redis protocol) - internal use only
- REST API wrapper: Port 3001 (HTTP) - Worker connection endpoint
- Workers use HTTP REST client and must connect to port 3001, not 6380

## [0.3.2] - 2025-11-24

### Fixed

**Frontend Authentication Error Handling**
- Fixed login error messages not displaying when attempting to log in with invalid credentials
- Modified `src/frontend/utils/api.js` to skip 401 auto-redirect for `/api/auth/login` and `/api/auth/register` endpoints
- 401 errors from authentication endpoints now properly display error messages instead of triggering redirect loop
- Users now see "Invalid email or password" message when login fails

**JWT Token Generation in Registration**
- Fixed "Registration completed but token generation failed" error during user registration
- Added `JWT_SECRET` to `.dev.vars` file for local development (Wrangler doesn't read from `.env`)
- Registration now successfully generates JWT tokens and logs users in immediately after account creation

**Local Development Data Persistence**
- Fixed data loss issue where `deploy-local.sh` destroyed all data on every run
- Modified `scripts/deploy-local.sh` to preserve `.wrangler/state/` directory containing D1 local database
- Changed FalkorDB container management from destroy/recreate to stop/start for persistence
- Added `redis.conf` with proper persistence settings (RDB snapshots + AOF) for new FalkorDB containers
- User accounts and graph data now persist across local development restarts

**Deployment Script Numbering**
- Fixed incorrect "[9/8]" step numbering in `scripts/deploy-local.sh` health checks section
- Removed numbering from health checks phase (post-deployment validation)

### Changed

- `.dev.vars` now includes `JWT_SECRET` for local development
- `deploy-local.sh` now restarts existing FalkorDB containers instead of recreating them
- D1 local database in `.wrangler/state/` directory is preserved during cleanup operations
- FalkorDB containers now start with `redis.conf` for persistent configuration

### Technical Details

**Files Modified:**
- `scripts/deploy-local.sh` - Lines 74-84 (D1 persistence), Lines 91-127 (FalkorDB persistence), Line 188 (numbering fix)
- `src/frontend/utils/api.js` - Lines 59-68 (401 handling for auth endpoints)
- `.dev.vars` - Added JWT_SECRET environment variable

**Persistence Configuration:**
- FalkorDB: RDB snapshots (60s/1 change, 300s/10 changes, 3600s/1 change)
- FalkorDB: AOF enabled with everysec fsync
- D1: SQLite database preserved in `.wrangler/state/v3/d1/`

## [0.3.1] - 2025-11-24

### Fixed

**FalkorDB REST API Authentication Issues**
- Fixed health check failures in deployment scripts due to missing authentication headers
- Updated `scripts/deploy-prod.sh` to include `Authorization: Bearer` header with `FALKORDB_REST_API_KEY` in all health checks
- Updated `scripts/deploy-local.sh` with same authentication fixes
- Updated `scripts/start-tunnel-services.sh` to use authenticated health checks
- Increased wait time from 3s to 5s for REST API initialization
- Health checks now properly validate against authenticated `/health` endpoint

**Seed Data API Key Missing**
- Fixed `buildFalkorConfig()` in `src/workers/api/seed-data.js` to include `apiKey` parameter
- Added `const apiKey = env.FALKORDB_REST_API_KEY` (line 31)
- Updated return statement to include `apiKey` in config object (line 42)
- Fixed "POOL_ERROR_500: Unauthorized" errors when adding test data to knowledge graph
- Seed data operations now properly authenticate with FalkorDB REST API

**Cypher Query Parameterization**
- Fixed LLM prompt in `src/services/cypher-generator.js` to generate parameterized queries instead of literal values
- Changed instruction from "Use LITERAL values in queries (NOT $param placeholders)" to "Use $param placeholders for all entity names and values (REQUIRED for parameterization)"
- Updated all example queries to use `$param` syntax (e.g., `{name: $project_name}` instead of `{name: 'GraphMind'}`)
- Added `extractParametersFromQuery()` function to extract parameter values from generated queries and match with detected entities
- Fixed "Missing parameters" errors when executing LLM-generated queries
- Queries now properly use FalkorDB's parameterization system

### Changed

- Deployment scripts now require `FALKORDB_REST_API_KEY` environment variable for health checks
- LLM Cypher generation now returns proper `parameters` object instead of empty `{}`

### Technical Details

**Files Modified:**
- `scripts/deploy-prod.sh` - Lines 126-129, 208-212
- `scripts/deploy-local.sh` - Lines 125-128, 198-202
- `scripts/start-tunnel-services.sh` - Lines 65-68
- `src/workers/api/seed-data.js` - Lines 27-42
- `src/services/cypher-generator.js` - Lines 413-483 (added parameter extraction), Lines 445-474 (updated LLM prompt)



---
END Changelog Entries Here - All Changelog entries should be above here
---

## Version History Summary

See Previous Changelogs for More Details: `docs/previous_changelogs/`

We keep here a brief history (5 entries + the entries in this file) in the form of | Version | Release Date | Key Features |

| Version | Release Date | Key Features |
|---------|--------------|--------------|
| 0.4.0   | 2025-11-29   | Feature 015 Entity Role Bug Fix (93%), PRD documentation update, GraphRAG 2.0 |
| 0.3.13  | 2025-11-25   | Neo-Brutalist UI complete (Session 9), 6 legacy CSS files deleted |
| 0.3.12  | 2025-11-25   | Voice components integration (Session 8) |
| 0.3.5   | 2025-11-25   | Neo-Brutalist Design System primitives (Session 1) |
| 0.3.4   | 2025-11-24   | GraphRAG 2.0 vector search, embeddings backfill |
| 0.3.3   | 2025-11-24   | FalkorDB local dev config fixes |
