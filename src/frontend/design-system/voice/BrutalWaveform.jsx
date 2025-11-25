/**
 * GraphMind Design System - BrutalWaveform
 *
 * Canvas-based audio waveform visualization with blocky, pixelated bars.
 * Uses requestAnimationFrame for smooth 60fps updates.
 *
 * @example
 * // Basic usage with audio data
 * <BrutalWaveform audioData={frequencyData} />
 *
 * @example
 * // Demo mode with animated bars
 * <BrutalWaveform demo active />
 *
 * @example
 * // Recording variant (red bars)
 * <BrutalWaveform audioData={data} variant="recording" />
 *
 * @example
 * // Using the hook for custom implementations
 * const { normalizedData, isActive } = useWaveform({
 *   audioData: frequencyData,
 *   barCount: 32
 * });
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '../primitives/utils';
import { useReducedMotion } from '../effects/useReducedMotion';

/**
 * Color mappings for variants
 */
const COLORS = {
  waveform: '#00FF00',   // voice.waveform / status.success
  recording: '#FF0000',  // voice.recording / status.error
  accent: '#FF00FF',     // accent.primary
};

const BACKGROUND_COLOR = '#000000'; // brutal.black

/**
 * Normalize audio data to 0-1 range
 * Handles both 0-255 (Uint8Array) and 0-1 (Float32Array) formats
 */
function normalizeValue(value) {
  if (value > 1) {
    // Assume 0-255 range
    return value / 255;
  }
  // Already normalized or negative (treat as absolute)
  return Math.abs(value);
}

/**
 * Generate demo data using sine waves
 */
function generateDemoData(time, barCount) {
  const data = new Array(barCount);
  for (let i = 0; i < barCount; i++) {
    // Combine multiple sine waves for organic movement
    const base = Math.sin(time * 0.002 + i * 0.2) * 0.4;
    const detail = Math.sin(time * 0.005 + i * 0.5) * 0.25;
    const fast = Math.sin(time * 0.01 + i * 0.8) * 0.15;
    // Clamp to 0.1-0.9 range for visual appeal
    data[i] = Math.max(0.1, Math.min(0.9, 0.5 + base + detail + fast));
  }
  return data;
}

/**
 * Hook for custom waveform implementations
 *
 * @param {Object} options - Hook options
 * @param {number[]|Float32Array|Uint8Array} [options.audioData=[]] - Audio data
 * @param {number} [options.barCount=24] - Number of bars
 * @param {boolean} [options.disabled=false] - Disable animation
 * @returns {{
 *   normalizedData: number[],
 *   isActive: boolean
 * }}
 */
export function useWaveform({
  audioData = [],
  barCount = 24,
  disabled = false,
} = {}) {
  const prefersReducedMotion = useReducedMotion();
  const isActive = !disabled && !prefersReducedMotion;

  // Normalize and downsample audio data to bar count
  const normalizedData = useMemo(() => {
    if (!audioData || audioData.length === 0) {
      // Return static bars when no data
      return new Array(barCount).fill(0.5);
    }

    const result = new Array(barCount);
    const samplesPerBar = Math.max(1, Math.floor(audioData.length / barCount));

    for (let i = 0; i < barCount; i++) {
      const startIndex = i * samplesPerBar;
      let sum = 0;

      // Average samples for this bar
      for (let j = 0; j < samplesPerBar && startIndex + j < audioData.length; j++) {
        sum += normalizeValue(audioData[startIndex + j]);
      }

      result[i] = sum / samplesPerBar;
    }

    return result;
  }, [audioData, barCount]);

  return {
    normalizedData,
    isActive,
  };
}

/**
 * BrutalWaveform component
 *
 * @param {Object} props - Component props
 * @param {number[]|Float32Array|Uint8Array} [props.audioData=[]] - Audio frequency/amplitude data
 * @param {number} [props.barCount=24] - Number of bars to display
 * @param {number} [props.barWidth=8] - Width of each bar in pixels
 * @param {number} [props.barGap=2] - Gap between bars in pixels
 * @param {number} [props.height=64] - Canvas height in pixels
 * @param {'waveform'|'recording'|'accent'} [props.variant='waveform'] - Color variant
 * @param {boolean} [props.active=true] - Whether to animate
 * @param {boolean} [props.demo=false] - Show animated demo data
 * @param {boolean} [props.disabled=false] - Disable all animation
 * @param {string} [props.className] - Additional CSS classes
 */
function BrutalWaveform({
  audioData = [],
  barCount = 24,
  barWidth = 8,
  barGap = 2,
  height = 64,
  variant = 'waveform',
  active = true,
  demo = false,
  disabled = false,
  className,
  ...props
}) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioDataRef = useRef(audioData);
  const timeRef = useRef(0);

  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = active && !disabled && !prefersReducedMotion;

  // Calculate canvas width based on bars
  const canvasWidth = barCount * (barWidth + barGap) - barGap;

  // Get bar color based on variant
  const barColor = COLORS[variant] || COLORS.waveform;

  // Keep audio data ref updated
  useEffect(() => {
    audioDataRef.current = audioData;
  }, [audioData]);

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get context with performance optimizations
    const ctx = canvas.getContext('2d', {
      alpha: false,        // No transparency needed
      desynchronized: true, // Hint for low-latency rendering
    });

    if (ctx) {
      // Disable smoothing for blocky pixel look
      ctx.imageSmoothingEnabled = false;
      ctxRef.current = ctx;
    }
  }, []);

  // Draw function
  const draw = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;

    if (!ctx || !canvas) return;

    // Clear with background color
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get data to render
    let data;
    if (demo && (!audioDataRef.current || audioDataRef.current.length === 0)) {
      // Generate demo data
      data = generateDemoData(timeRef.current, barCount);
    } else if (audioDataRef.current && audioDataRef.current.length > 0) {
      // Use provided audio data
      const samplesPerBar = Math.max(1, Math.floor(audioDataRef.current.length / barCount));
      data = new Array(barCount);

      for (let i = 0; i < barCount; i++) {
        const startIndex = i * samplesPerBar;
        let sum = 0;

        for (let j = 0; j < samplesPerBar && startIndex + j < audioDataRef.current.length; j++) {
          sum += normalizeValue(audioDataRef.current[startIndex + j]);
        }

        data[i] = sum / samplesPerBar;
      }
    } else {
      // Static bars at 50% when no data
      data = new Array(barCount).fill(0.5);
    }

    // Draw bars
    ctx.fillStyle = barColor;
    const minBarHeight = 4;
    const maxBarHeight = canvas.height - 4; // Leave 2px padding top/bottom

    for (let i = 0; i < barCount; i++) {
      const value = data[i] || 0;
      const barHeight = Math.max(minBarHeight, Math.floor(value * maxBarHeight));
      const x = i * (barWidth + barGap);
      const y = canvas.height - barHeight - 2; // 2px bottom padding

      ctx.fillRect(x, y, barWidth, barHeight);
    }

    // Draw border around canvas
    ctx.strokeStyle = barColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  }, [barCount, barWidth, barGap, barColor, demo]);

  // Animation loop
  useEffect(() => {
    if (!shouldAnimate) {
      // Draw once without animation
      draw();
      return;
    }

    let lastTime = performance.now();

    const animate = (currentTime) => {
      // Update time for demo mode
      timeRef.current = currentTime;

      // Draw frame
      draw();

      // Continue loop
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [shouldAnimate, draw]);

  // Redraw when data changes (if not animating)
  useEffect(() => {
    if (!shouldAnimate && ctxRef.current) {
      draw();
    }
  }, [audioData, shouldAnimate, draw]);

  return (
    <div
      className={cn(
        'inline-block bg-brutal-black border-brutal-thick border-brutal-black p-1',
        className
      )}
      {...props}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={height}
        className="block"
        style={{
          imageRendering: 'pixelated',
          // Fallback for Firefox
          imageRendering: 'crisp-edges',
        }}
        role="img"
        aria-label="Audio waveform visualization"
      />
    </div>
  );
}

export default BrutalWaveform;
