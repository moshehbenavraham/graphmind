# GraphMind Frontend Developer Guide

A comprehensive guide to the Neo-Brutalist design system for GraphMind.

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Quick Start](#quick-start)
3. [Project Structure](#project-structure)
4. [Design Tokens](#design-tokens)
5. [Primitives](#primitives)
6. [Effects](#effects)
7. [Animations](#animations)
8. [Voice Components](#voice-components)
9. [Common Patterns](#common-patterns)
10. [Accessibility](#accessibility)
11. [Troubleshooting](#troubleshooting)

---

## Design Philosophy

GraphMind uses a **Neo-Brutalist** design system - raw, unpolished, and structural. It's honest about its materials (pixels and vectors) and rejects artificial decoration.

### Core Principles

| Principle | Implementation |
|-----------|----------------|
| Zero border-radius | Hard corners everywhere (enforced globally) |
| Hard shadows | No blur - offset solid shadows (4-8px) |
| Thick borders | 2-4px solid black strokes |
| High contrast | Stark black/white with neon accents |
| Monospace typography | JetBrains Mono, Space Mono |
| Mechanical animations | Stepped easing, short duration (0.1s) |

### Brand Colors

```
Primary Accent:  #FF00FF (Magenta)
Background:      #FFFEF0 (Cream)
Text:            #1A1A1A (Charcoal)
Success:         #00FF00 (Neon Green)
Error:           #FF0000 (Pure Red)
Warning:         #FFFF00 (Yellow)
Info:            #00FFFF (Cyan)
```

### What NOT to Do

- No rounded corners (enforced via CSS reset)
- No blurred shadows
- No smooth/eased transitions
- No soft colors or gradients
- No decorative elements without function

---

## Quick Start

### Importing Components

All design system components are exported from a single entry point:

```jsx
// Import what you need
import {
  // Primitives
  Button, Card, Input, Textarea, Select, Badge,

  // Effects
  OffsetLayer, GlitchText, ScanLine, BorderDraw,

  // Voice
  BrutalWaveform, RecordingIndicator, TerminalTranscript,

  // Animations
  brutalInteraction, brutalStagger, brutalEnter, brutalExit,
  useGlitch, useTypewriter,

  // Utilities
  cn, useReducedMotion,
} from '../design-system';
```

### Basic Page Template

```jsx
import { GlitchText, Card, Button, OffsetLayer } from '../design-system';

function MyPage() {
  return (
    <div className="min-h-screen bg-brutal-cream p-6">
      <GlitchText as="h1" className="mb-8">
        PAGE TITLE
      </GlitchText>

      <OffsetLayer variant="accent" size="lg">
        <Card>
          <Card.Header>Section Title</Card.Header>
          <Card.Body>
            <p>Content goes here</p>
            <Button variant="primary">Action</Button>
          </Card.Body>
        </Card>
      </OffsetLayer>
    </div>
  );
}
```

---

## Project Structure

```
src/frontend/
├── design-system/
│   ├── index.js              # Main export (import from here)
│   ├── tokens/
│   │   └── index.css         # CSS variables, utility classes, keyframes
│   ├── primitives/
│   │   ├── Button.jsx        # Button component
│   │   ├── Card.jsx          # Card container + subcomponents
│   │   ├── Input.jsx         # Text input + Textarea + Select
│   │   ├── Badge.jsx         # Status badges
│   │   ├── utils.js          # cn() utility function
│   │   └── index.js
│   ├── effects/
│   │   ├── OffsetLayer.jsx   # Stacked shadow effect
│   │   ├── GlitchText.jsx    # Chromatic aberration text
│   │   ├── ScanLine.jsx      # CRT overlay effect
│   │   ├── BorderDraw.jsx    # Animated SVG border
│   │   ├── useReducedMotion.js
│   │   └── index.js
│   ├── animations/
│   │   ├── presets.js        # Framer Motion configs
│   │   ├── useGlitch.js      # Periodic glitch hook
│   │   ├── useTypewriter.js  # Text reveal hook
│   │   └── index.js
│   └── voice/
│       ├── BrutalWaveform.jsx      # Audio visualization
│       ├── RecordingIndicator.jsx  # Recording status
│       ├── TerminalTranscript.jsx  # Typewriter transcript
│       └── index.js
├── components/               # Feature components
├── pages/                    # Page components
├── main.jsx                  # App entry point
├── tailwind.config.js        # Tailwind v4 config
└── postcss.config.js
```

---

## Design Tokens

Design tokens are defined in `design-system/tokens/index.css` and loaded globally via `main.jsx`.

### CSS Classes Reference

#### Buttons
```css
.btn-brutal-primary    /* Magenta background, black text */
.btn-brutal-secondary  /* White background, inverts on hover */
.btn-brutal-danger     /* Red background, white text */
.btn-brutal-ghost      /* Transparent, appears on hover */
.btn-brutal-sm         /* Small size */
.btn-brutal-lg         /* Large size */
```

#### Cards
```css
.card-brutal           /* Standard white card with black shadow */
.card-brutal-accent    /* Magenta border and shadow */
.card-brutal-dark      /* Black background, white text */
.card-brutal-interactive /* Hover/tap states for clickable cards */
```

#### Inputs
```css
.input-brutal          /* Standard text input */
.input-brutal-error    /* Red border for errors */
.textarea-brutal       /* Multi-line input */
.select-brutal         /* Dropdown select */
```

#### Badges
```css
.badge-brutal          /* Default (white) */
.badge-brutal-accent   /* Magenta */
.badge-brutal-success  /* Green */
.badge-brutal-error    /* Red */
.badge-brutal-warning  /* Yellow */
.badge-brutal-info     /* Cyan */
```

#### Effects
```css
.offset-layer          /* Adds black shadow layer behind */
.offset-layer-accent   /* Magenta shadow layer */
.offset-layer-lg       /* Larger offset (8px) */
.scanlines             /* CRT horizontal lines overlay */
.scanlines-animated    /* + moving scan bar */
.hazard-stripes        /* Animated magenta/black stripes */
.hazard-stripes-danger /* Animated red/black stripes */
.glitch-text           /* Chromatic aberration effect */
```

#### Terminal
```css
.terminal-brutal       /* Black bg, magenta text, terminal styling */
.terminal-cursor       /* Blinking cursor block */
.terminal-line         /* Line with number gutter */
.terminal-line-number  /* Muted line number */
```

#### Utilities
```css
.text-shadow-brutal    /* Black text shadow */
.text-shadow-accent    /* Magenta text shadow */
.bg-grid-brutal        /* Grid pattern background */
.bg-dots-brutal        /* Dot pattern background */
.loading-brutal        /* Spinning square loader */
.skeleton-brutal       /* Pulsing placeholder */
.divider-brutal        /* Horizontal black rule */
.divider-brutal-accent /* Horizontal magenta rule */
```

---

## Primitives

### Button

```jsx
import { Button } from '../design-system';

// Variants
<Button variant="primary">Submit</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Delete</Button>
<Button variant="ghost">Menu</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>

// States
<Button loading>Processing...</Button>
<Button disabled>Disabled</Button>

// Polymorphic (render as link)
<Button asChild>
  <a href="/dashboard">Go to Dashboard</a>
</Button>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'ghost'` | `'secondary'` | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `loading` | `boolean` | `false` | Shows spinner, disables button |
| `disabled` | `boolean` | `false` | Disables interaction |
| `asChild` | `boolean` | `false` | Renders child element with button styles |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | HTML type |

### Card

```jsx
import { Card } from '../design-system';

// Basic card
<Card>Simple content</Card>

// With header and body
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content here</Card.Body>
</Card>

// Variants
<Card variant="accent">Magenta border</Card>
<Card variant="dark">Dark theme</Card>

// Interactive (clickable)
<Card interactive onClick={handleClick}>
  Click me
</Card>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'accent' \| 'dark'` | `'default'` | Visual style |
| `interactive` | `boolean` | `false` | Enables hover/tap animations |
| `as` | `string` | `'div'` | HTML element to render |

### Input

```jsx
import { Input, Textarea, Select } from '../design-system';

// Text input
<Input
  label="Email"
  type="email"
  placeholder="you@example.com"
  error="Invalid email"
  helperText="We'll never share your email"
/>

// Textarea
<Textarea
  label="Description"
  rows={4}
/>

// Select
<Select label="Country">
  <option value="">Select...</option>
  <option value="us">United States</option>
  <option value="uk">United Kingdom</option>
</Select>
```

**Props (Input):**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | - | Label text above input |
| `error` | `string` | - | Error message (red border) |
| `helperText` | `string` | - | Help text below input |
| `type` | `string` | `'text'` | HTML input type |

### Badge

```jsx
import { Badge } from '../design-system';

<Badge>Default</Badge>
<Badge variant="accent">New</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="error">Failed</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="info">Beta</Badge>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'accent' \| 'success' \| 'error' \| 'warning' \| 'info'` | `'default'` | Color variant |

---

## Effects

### OffsetLayer

Adds a colored shadow layer behind children, creating a "stacked" 3D effect.

```jsx
import { OffsetLayer } from '../design-system';

// Black shadow (default)
<OffsetLayer>
  <Card>Content</Card>
</OffsetLayer>

// Magenta shadow
<OffsetLayer variant="accent">
  <Card>Content</Card>
</OffsetLayer>

// Larger offset
<OffsetLayer variant="accent" size="lg">
  <Card>Content</Card>
</OffsetLayer>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'accent'` | `'default'` | Shadow color |
| `size` | `'md' \| 'lg'` | `'md'` | Shadow offset (5px or 8px) |

### GlitchText

Applies chromatic aberration (RGB split) effect to text.

```jsx
import { GlitchText } from '../design-system';

// As heading
<GlitchText as="h1">GRAPHMIND</GlitchText>

// As span (inline)
<GlitchText as="span">glitchy text</GlitchText>

// Disabled (for reduced motion)
<GlitchText disabled>Static text</GlitchText>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `as` | `string` | `'span'` | HTML element to render |
| `disabled` | `boolean` | `false` | Disables glitch animation |

### ScanLine

Overlays CRT-style horizontal scan lines on content.

```jsx
import { ScanLine } from '../design-system';

// Static lines only
<ScanLine>
  <Card>Retro content</Card>
</ScanLine>

// With animated scan bar
<ScanLine animated>
  <Card>More retro</Card>
</ScanLine>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `animated` | `boolean` | `false` | Adds moving scan bar |
| `disabled` | `boolean` | `false` | Disables effect |

### BorderDraw

Animates a border drawing around the element using SVG.

```jsx
import { BorderDraw } from '../design-system';

// Animate on mount
<BorderDraw trigger="mount">
  <Card>Animated border on load</Card>
</BorderDraw>

// Animate on hover
<BorderDraw trigger="hover">
  <Card>Hover to see border</Card>
</BorderDraw>

// Manual control
const [draw, setDraw] = useState(false);
<BorderDraw trigger="manual" active={draw}>
  <Card>Controlled by state</Card>
</BorderDraw>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `trigger` | `'mount' \| 'hover' \| 'manual'` | `'mount'` | When to animate |
| `active` | `boolean` | `false` | For manual trigger mode |
| `duration` | `number` | `0.6` | Animation duration in seconds |

---

## Animations

### Animation Presets

Import Framer Motion presets for consistent brutalist animations:

```jsx
import {
  brutalInteraction,  // Combined hover + tap
  brutalHover,        // { x: -2, y: -2 }
  brutalTap,          // { scale: 0.98, x: 2, y: 2 }
  brutalTransition,   // { duration: 0.1, ease: [0.4, 0, 1, 1] }
  brutalEnter,        // Entrance animation
  brutalExit,         // Exit animation
  brutalStagger,      // List stagger variants
  createStagger,      // Factory for custom stagger
  BRUTAL_EASE,        // [0.4, 0, 1, 1]
  BRUTAL_DURATION,    // 0.1
} from '../design-system';
```

### Interactive Elements

```jsx
import { motion } from 'framer-motion';
import { brutalInteraction } from '../design-system';

// Spread onto any motion component
<motion.div {...brutalInteraction}>
  Hover and click me
</motion.div>
```

### Enter/Exit Animations

```jsx
import { AnimatePresence, motion } from 'framer-motion';
import { brutalEnter, brutalExit } from '../design-system';

<AnimatePresence>
  {isVisible && (
    <motion.div {...brutalEnter} {...brutalExit}>
      Content appears/disappears mechanically
    </motion.div>
  )}
</AnimatePresence>
```

### Staggered Lists

```jsx
import { motion } from 'framer-motion';
import { brutalStagger } from '../design-system';

<motion.ul
  variants={brutalStagger.container}
  initial="hidden"
  animate="visible"
>
  {items.map(item => (
    <motion.li key={item.id} variants={brutalStagger.item}>
      {item.name}
    </motion.li>
  ))}
</motion.ul>
```

### useGlitch Hook

Triggers periodic or on-demand glitch effects.

```jsx
import { useGlitch } from '../design-system';

function GlitchyComponent() {
  const { isGlitching, triggerGlitch } = useGlitch({
    mode: 'periodic',    // or 'manual'
    interval: 3000,      // ms between glitches
    duration: 150,       // ms glitch lasts
  });

  return (
    <div className={isGlitching ? 'glitch-active' : ''}>
      <button onClick={triggerGlitch}>Trigger Glitch</button>
    </div>
  );
}
```

### useTypewriter Hook

Character-by-character text reveal.

```jsx
import { useTypewriter } from '../design-system';

function TypedText() {
  const { displayText, isTyping, restart } = useTypewriter({
    text: 'Hello, GraphMind!',
    speed: 50,           // ms per character
    delay: 500,          // ms before starting
    cursor: true,        // show blinking cursor
    startOnMount: true,
  });

  return (
    <div>
      {displayText}
      {cursor && <span className="terminal-cursor" />}
    </div>
  );
}
```

---

## Voice Components

### BrutalWaveform

Canvas-based audio visualization with blocky, pixelated bars.

```jsx
import { BrutalWaveform } from '../design-system';

// With real audio data
<BrutalWaveform
  audioData={analyserData}  // Uint8Array from Web Audio API
  active={isRecording}
  variant="recording"       // Red bars
/>

// Demo mode (generates fake data)
<BrutalWaveform
  demo
  active
  variant="waveform"        // Green bars
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `audioData` | `Uint8Array` | - | Audio frequency data |
| `active` | `boolean` | `false` | Enables animation |
| `demo` | `boolean` | `false` | Uses procedural data |
| `variant` | `'waveform' \| 'recording' \| 'accent'` | `'waveform'` | Bar color |
| `barCount` | `number` | `32` | Number of bars |

### RecordingIndicator

Visual indicator for recording state with multiple variants.

```jsx
import { RecordingIndicator } from '../design-system';

// Hazard stripes (animated warning)
<RecordingIndicator
  variant="hazard"
  active={isRecording}
  size="lg"
/>

// Simple beacon (pulsing dot)
<RecordingIndicator
  variant="beacon"
  active={isRecording}
/>

// Terminal style (text with cursor)
<RecordingIndicator
  variant="terminal"
  active={isRecording}
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'hazard' \| 'beacon' \| 'terminal'` | `'hazard'` | Visual style |
| `active` | `boolean` | `false` | Enables animation |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Component size |

### TerminalTranscript

Terminal-style transcript display with optional typewriter effect.

```jsx
import { TerminalTranscript } from '../design-system';

// Static display
<TerminalTranscript
  text="This is the transcript text..."
  variant="default"   // Magenta text
/>

// With typewriter animation
<TerminalTranscript
  text={transcriptText}
  animate
  speed={30}
  showLineNumbers
/>

// Success variant (green)
<TerminalTranscript
  text="Query successful!"
  variant="success"
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | - | Transcript text to display |
| `variant` | `'default' \| 'success' \| 'error'` | `'default'` | Color theme |
| `animate` | `boolean` | `false` | Enable typewriter effect |
| `speed` | `number` | `50` | Typing speed (ms per char) |
| `showLineNumbers` | `boolean` | `false` | Show line number gutter |
| `showHeader` | `boolean` | `true` | Show terminal header bar |

---

## Common Patterns

### Page Layout

```jsx
function PageTemplate({ title, children }) {
  return (
    <div className="min-h-screen bg-brutal-cream">
      <Navigation />
      <main className="p-6 max-w-7xl mx-auto">
        <GlitchText as="h1" className="mb-8">
          {title}
        </GlitchText>
        {children}
      </main>
    </div>
  );
}
```

### Form with Validation

```jsx
function LoginForm() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <OffsetLayer variant="accent" size="lg">
      <Card>
        <Card.Header>
          <GlitchText as="h2">LOGIN</GlitchText>
        </Card.Header>
        <Card.Body className="space-y-4">
          {error && <Badge variant="error">{error}</Badge>}

          <Input
            label="Email"
            type="email"
            error={emailError}
          />
          <Input
            label="Password"
            type="password"
          />

          <Button variant="primary" loading={loading} type="submit">
            Sign In
          </Button>
        </Card.Body>
      </Card>
    </OffsetLayer>
  );
}
```

### Card Grid with Stagger

```jsx
import { motion } from 'framer-motion';
import { Card, brutalStagger } from '../design-system';

function CardGrid({ items }) {
  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-3 gap-6"
      variants={brutalStagger.container}
      initial="hidden"
      animate="visible"
    >
      {items.map(item => (
        <motion.div key={item.id} variants={brutalStagger.item}>
          <Card interactive onClick={() => handleClick(item)}>
            <Card.Body>
              <h3 className="brutal-caps">{item.title}</h3>
              <p>{item.description}</p>
            </Card.Body>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### Modal Dialog

```jsx
import { AnimatePresence, motion } from 'framer-motion';
import { Card, Button, brutalEnter, brutalExit } from '../design-system';

function Modal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay-brutal">
          <motion.div {...brutalEnter} {...brutalExit}>
            <Card className="modal-brutal">
              {children}
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

### Voice Recording UI

```jsx
function VoiceRecorderUI({ isRecording, audioData, transcript }) {
  return (
    <Card>
      <Card.Header className="flex items-center gap-4">
        <RecordingIndicator variant="hazard" active={isRecording} />
        <span className="brutal-caps">
          {isRecording ? 'Recording...' : 'Ready'}
        </span>
      </Card.Header>
      <Card.Body>
        <BrutalWaveform
          audioData={audioData}
          active={isRecording}
          variant="recording"
        />
        <TerminalTranscript
          text={transcript}
          animate={!isRecording}
          showLineNumbers
        />
      </Card.Body>
    </Card>
  );
}
```

---

## Accessibility

### Automatic Features

- **Focus states**: Magenta ring on all focusable elements
- **Reduced motion**: All animations respect `prefers-reduced-motion`
- **Color contrast**: All combinations meet WCAG AA (6.9:1+ ratio)
- **Touch targets**: Minimum 44x44px on interactive elements

### Using `useReducedMotion`

```jsx
import { useReducedMotion } from '../design-system';

function AnimatedComponent() {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      animate={reducedMotion ? {} : { x: 10 }}
    >
      Content
    </motion.div>
  );
}
```

### Keyboard Navigation

All interactive components are keyboard accessible:
- `Tab` to navigate
- `Enter`/`Space` to activate buttons
- `Escape` to close modals
- Arrow keys for select dropdowns

### Color Contrast Reference

| Combination | Ratio | Status |
|-------------|-------|--------|
| Black on White | 21:1 | PASS |
| White on Black | 21:1 | PASS |
| Black on Magenta | 6.9:1 | PASS |
| Black on Cyan | 8.6:1 | PASS |
| Black on Yellow | 19.6:1 | PASS |
| Black on Green | 15.3:1 | PASS |

**Warning**: Never use magenta (#FF00FF) as text on white backgrounds.

---

## Troubleshooting

### Rounded Corners Appearing

The design system enforces `border-radius: 0 !important` globally. If you see rounded corners:
1. Check for inline styles overriding
2. Ensure `tokens/index.css` is imported in `main.jsx`
3. Check third-party component libraries

### Animations Not Working

1. Check Framer Motion is installed: `npm list framer-motion`
2. Ensure you're using `motion.` components
3. Check browser's reduced motion setting
4. Verify you're spreading presets correctly: `{...brutalInteraction}`

### Fonts Not Loading

1. Check font imports in `tokens/index.css`
2. Ensure `@fontsource/*` packages are installed
3. Clear browser cache

### Flash of Unstyled Content (FOUC)

1. Ensure `tokens/index.css` is imported early in `main.jsx`
2. Check that Tailwind CSS is processing correctly
3. Verify `@tailwindcss/vite` plugin is configured

### Build Errors

```bash
# Common fixes
npm install                    # Reinstall dependencies
npx vite --force              # Clear Vite cache
rm -rf node_modules/.vite     # Clear Vite cache manually
```

### Class Not Applying

1. Use the `cn()` utility for conditional classes:
   ```jsx
   import { cn } from '../design-system';

   <div className={cn('base-class', isActive && 'active-class')} />
   ```
2. Check Tailwind is scanning your files (see `tailwind.config.js`)

---

## Quick Reference

### Import Cheatsheet

```jsx
// Everything you'll commonly need
import {
  // Layout
  Card, Button, Input, Badge,

  // Effects
  OffsetLayer, GlitchText,

  // Voice
  BrutalWaveform, RecordingIndicator, TerminalTranscript,

  // Animation
  brutalInteraction, brutalStagger,

  // Utility
  cn,
} from '../design-system';
```

### CSS Class Cheatsheet

```
Buttons:    btn-brutal-{primary|secondary|danger|ghost}
Cards:      card-brutal{-accent|-dark|-interactive}
Inputs:     input-brutal{-error}, textarea-brutal, select-brutal
Badges:     badge-brutal{-accent|-success|-error|-warning|-info}
Effects:    offset-layer{-accent}{-lg}, scanlines{-animated}, glitch-text
Terminal:   terminal-brutal, terminal-cursor, terminal-line
Utility:    text-shadow-brutal, bg-grid-brutal, loading-brutal
```

---

*Last Updated: November 2025*
