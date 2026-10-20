/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        brutal: {
          black: '#000000',
          white: '#FFFFFF',
          cream: '#FFFEF0',
          charcoal: '#1A1A1A',
        },
        accent: {
          primary: '#FF00FF',
          hover: '#CC00CC',
          muted: 'rgba(255, 0, 255, 0.3)',
          glow: 'rgba(255, 0, 255, 0.5)',
        },
        status: {
          success: '#00FF00',
          error: '#FF0000',
          warning: '#FFFF00',
          info: '#00FFFF',
        },
        voice: {
          recording: '#FF0000',
          waveform: '#00FF00',
          transcript: '#FF00FF',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', 'monospace'],
        display: ['Space Mono', 'monospace'],
      },
      /* borderRadius forced to 0 via CSS rule in tokens/index.css */
      boxShadow: {
        'brutal-sm': '2px 2px 0px #000000',
        'brutal': '4px 4px 0px #000000',
        'brutal-lg': '6px 6px 0px #000000',
        'brutal-xl': '8px 8px 0px #000000',
        'brutal-accent': '4px 4px 0px #FF00FF',
        'brutal-glow': '0 0 20px rgba(255, 0, 255, 0.5)',
      },
      borderWidth: {
        'brutal': '2px',
        'brutal-thick': '3px',
        'brutal-heavy': '4px',
      },
      animation: {
        'brutal-pulse': 'brutal-pulse 1s steps(2) infinite',
        'brutal-blink': 'brutal-blink 0.5s steps(1) infinite',
        'glitch': 'glitch 2s linear infinite',
        'scan': 'scan 8s linear infinite',
        'border-draw': 'border-draw 0.6s ease-out forwards',
        'hazard-scroll': 'hazard-scroll 0.5s linear infinite',
        'typewriter': 'typewriter 0.1s steps(1) forwards',
      },
      keyframes: {
        'brutal-pulse': {
          '0%': { opacity: '1' },
          '50%': { opacity: '0.3' },
          '100%': { opacity: '1' },
        },
        'brutal-blink': {
          '0%': { borderColor: '#FF00FF' },
          '50%': { borderColor: '#000000' },
          '100%': { borderColor: '#FF00FF' },
        },
        'glitch': {
          '0%': { clipPath: 'inset(40% 0 61% 0)', transform: 'translate(-2px, 0)' },
          '20%': { clipPath: 'inset(92% 0 1% 0)', transform: 'translate(1px, 0)' },
          '40%': { clipPath: 'inset(43% 0 1% 0)', transform: 'translate(-1px, 0)' },
          '60%': { clipPath: 'inset(25% 0 58% 0)', transform: 'translate(2px, 0)' },
          '80%': { clipPath: 'inset(54% 0 7% 0)', transform: 'translate(-2px, 0)' },
          '100%': { clipPath: 'inset(58% 0 43% 0)', transform: 'translate(0, 0)' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'border-draw': {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
        'hazard-scroll': {
          '0%': { backgroundPosition: '0px 0px' },
          '100%': { backgroundPosition: '28px 0px' },
        },
        'typewriter': {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
      },
    },
  },
  plugins: [],
}
