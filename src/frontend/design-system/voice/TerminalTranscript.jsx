/**
 * GraphMind Design System - TerminalTranscript
 *
 * Display transcript text with typewriter effect in terminal styling.
 * Integrates with useTypewriter hook for character-by-character reveal.
 *
 * @example
 * // Basic usage
 * <TerminalTranscript text="Hello, this is a transcript..." />
 *
 * @example
 * // With line numbers and success variant
 * <TerminalTranscript
 *   text="Query processed successfully."
 *   variant="success"
 *   showLineNumbers
 * />
 *
 * @example
 * // Manual control without animation
 * <TerminalTranscript
 *   text={transcriptText}
 *   animate={false}
 *   showPrompt={false}
 * />
 *
 * @example
 * // With completion callback
 * <TerminalTranscript
 *   text="Processing..."
 *   onComplete={() => console.log('Done typing!')}
 * />
 */

import { useMemo } from 'react';
import { cn } from '../primitives/utils';
import { useTypewriter } from '../animations';

/**
 * Color variant mappings
 */
const VARIANTS = {
  default: {
    text: 'text-accent-primary',
    border: 'border-accent-primary',
    prompt: 'text-accent-hover',
    lineNumber: 'text-brutal-charcoal/50',
  },
  success: {
    text: 'text-status-success',
    border: 'border-status-success',
    prompt: 'text-status-success/70',
    lineNumber: 'text-status-success/30',
  },
  error: {
    text: 'text-status-error',
    border: 'border-status-error',
    prompt: 'text-status-error/70',
    lineNumber: 'text-status-error/30',
  },
};

/**
 * TerminalTranscript component
 *
 * @param {Object} props - Component props
 * @param {string} props.text - Transcript text to display
 * @param {number} [props.speed=50] - Typewriter speed in ms per character
 * @param {boolean} [props.animate=true] - Enable typewriter animation
 * @param {boolean} [props.showCursor=true] - Show blinking cursor
 * @param {boolean} [props.showLineNumbers=false] - Show line numbers
 * @param {string} [props.prompt='>'] - Prompt character
 * @param {boolean} [props.showPrompt=true] - Display prompt before text
 * @param {'default'|'success'|'error'} [props.variant='default'] - Color variant
 * @param {Function} [props.onComplete] - Callback when typing animation completes
 * @param {boolean} [props.disabled=false] - Disable all animations
 * @param {string} [props.className] - Additional CSS classes
 * @param {number} [props.minHeight=100] - Minimum height in pixels
 * @param {number} [props.maxHeight=400] - Maximum height in pixels (enables scroll)
 */
function TerminalTranscript({
  text = '',
  speed = 50,
  animate = true,
  showCursor = true,
  showLineNumbers = false,
  prompt = '>',
  showPrompt = true,
  variant = 'default',
  onComplete,
  disabled = false,
  className,
  minHeight = 100,
  maxHeight = 400,
  ...props
}) {
  const variantClasses = VARIANTS[variant] || VARIANTS.default;

  // Use the typewriter hook
  const {
    displayText,
    isTyping,
    isComplete,
    cursorClassName,
    skip: _skip,
    reset: _reset,
    isActive,
  } = useTypewriter({
    text,
    speed,
    cursor: showCursor,
    startOnMount: animate,
    disabled: disabled || !animate,
    onComplete,
  });

  // Split text into lines for line number display
  const lines = useMemo(() => {
    const textToSplit = animate && isActive ? displayText : text;
    return textToSplit.split('\n');
  }, [displayText, text, animate, isActive]);

  // Calculate if we need to show the cursor
  const shouldShowCursor = showCursor && (isTyping || (!isComplete && animate && isActive));

  return (
    <div
      className={cn(
        'bg-brutal-black border-brutal-thick font-mono text-sm',
        variantClasses.border,
        'overflow-hidden',
        className
      )}
      style={{
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`,
      }}
      role="log"
      aria-live="polite"
      aria-label="Voice transcript"
      {...props}
    >
      {/* Terminal header bar */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2',
          'bg-brutal-charcoal border-b-brutal border-brutal-charcoal',
          variantClasses.text
        )}
      >
        <span className="text-xs uppercase tracking-widest font-bold">
          Transcript
        </span>
        <div className="flex gap-2">
          <div className="w-3 h-3 bg-status-error border border-brutal-black" />
          <div className="w-3 h-3 bg-status-warning border border-brutal-black" />
          <div className="w-3 h-3 bg-status-success border border-brutal-black" />
        </div>
      </div>

      {/* Terminal content */}
      <div
        className="p-4 overflow-y-auto"
        style={{ maxHeight: `${maxHeight - 44}px` }}
      >
        {showLineNumbers ? (
          // With line numbers
          <div className="flex">
            {/* Line numbers column */}
            <div
              className={cn(
                'select-none pr-4 text-right',
                variantClasses.lineNumber
              )}
              aria-hidden="true"
            >
              {lines.map((_, index) => (
                <div key={index} className="leading-6">
                  {String(index + 1).padStart(2, '0')}
                </div>
              ))}
            </div>

            {/* Content column */}
            <div className={cn('flex-1', variantClasses.text)}>
              {lines.map((line, index) => (
                <div key={index} className="leading-6">
                  {index === 0 && showPrompt && (
                    <span className={variantClasses.prompt}>{prompt} </span>
                  )}
                  <span className="whitespace-pre-wrap break-words">{line}</span>
                  {/* Show cursor at the end of the last line */}
                  {index === lines.length - 1 && shouldShowCursor && (
                    <span
                      className={cn(
                        'inline-block w-2 h-4 ml-0.5 align-middle',
                        variantClasses.text.replace('text-', 'bg-'),
                        cursorClassName
                      )}
                      aria-hidden="true"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Without line numbers
          <div className={variantClasses.text}>
            {showPrompt && (
              <span className={variantClasses.prompt}>{prompt} </span>
            )}
            <span className="whitespace-pre-wrap break-words">
              {animate && isActive ? displayText : text}
            </span>
            {shouldShowCursor && (
              <span
                className={cn(
                  'inline-block w-2 h-4 ml-0.5 align-middle',
                  variantClasses.text.replace('text-', 'bg-'),
                  cursorClassName
                )}
                aria-hidden="true"
              />
            )}
          </div>
        )}

        {/* Empty state */}
        {!text && (
          <div className={cn('text-brutal-charcoal/50 italic', variantClasses.text)}>
            {showPrompt && (
              <span className={variantClasses.prompt}>{prompt} </span>
            )}
            <span>Waiting for input...</span>
            {shouldShowCursor && (
              <span
                className={cn(
                  'inline-block w-2 h-4 ml-0.5 align-middle',
                  variantClasses.text.replace('text-', 'bg-'),
                  'animate-brutal-pulse'
                )}
                aria-hidden="true"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TerminalTranscript;
