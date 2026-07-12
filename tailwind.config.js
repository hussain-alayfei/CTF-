/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      // Colors are driven by CSS variables (see index.css) so the whole app
      // re-themes between light and dark by swapping the variables.
      colors: {
        terminal: {
          bg: 'rgb(var(--c-bg) / <alpha-value>)',
          panel: 'rgb(var(--c-panel) / <alpha-value>)',
          border: 'rgb(var(--c-border) / <alpha-value>)',
          green: 'rgb(var(--c-green) / <alpha-value>)',
          dim: 'rgb(var(--c-dim) / <alpha-value>)',
          amber: 'rgb(var(--c-amber) / <alpha-value>)',
          red: 'rgb(var(--c-red) / <alpha-value>)',
          redlight: 'rgb(var(--c-red-light) / <alpha-value>)',
          cyan: 'rgb(var(--c-cyan) / <alpha-value>)',
          text: 'rgb(var(--c-text) / <alpha-value>)',
          strong: 'rgb(var(--c-strong) / <alpha-value>)',
          input: 'rgb(var(--c-input) / <alpha-value>)',
        },
      },
      boxShadow: {
        neon: '0 0 8px rgb(var(--c-green) / 0.55), 0 0 24px rgb(var(--c-green) / 0.22)',
        'neon-red': '0 0 8px rgb(var(--c-red) / 0.55), 0 0 24px rgb(var(--c-red) / 0.22)',
        'neon-amber': '0 0 8px rgb(var(--c-amber) / 0.5), 0 0 20px rgb(var(--c-amber) / 0.2)',
      },
      keyframes: {
        flicker: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.85' } },
        'slide-down': {
          '0%': { transform: 'translateY(-120%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-left': {
          '0%': { transform: 'translateX(100%)', opacity: '0.4' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgb(var(--c-red) / 0.5)' },
          '100%': { boxShadow: '0 0 0 18px rgb(var(--c-red) / 0)' },
        },
        rise: {
          '0%': { transform: 'translateY(40px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        // Hard on/off blink for the final minute. `flicker` is a gentle 15% fade
        // — this is the real "flash on, off, on, off" alarm. Its speed is driven
        // per-render via an inline animationDuration (see strobeMs in lib/time).
        strobe: { '0%, 49%': { opacity: '1' }, '50%, 100%': { opacity: '0.12' } },
        // Winner reveal: the card lands with a hard slam.
        slam: {
          '0%': { transform: 'scale(2.6)', opacity: '0' },
          '55%': { transform: 'scale(0.92)', opacity: '1' },
          '75%': { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translate3d(0,0,0)' },
          '20%': { transform: 'translate3d(-7px,3px,0)' },
          '40%': { transform: 'translate3d(6px,-4px,0)' },
          '60%': { transform: 'translate3d(-5px,-2px,0)' },
          '80%': { transform: 'translate3d(4px,3px,0)' },
        },
        'card-idle': {
          '0%, 100%': { transform: 'translateY(0) rotate(-0.6deg)' },
          '50%': { transform: 'translateY(-8px) rotate(0.6deg)' },
        },
      },
      animation: {
        flicker: 'flicker 3s ease-in-out infinite',
        'slide-down': 'slide-down 0.4s cubic-bezier(0.2,0.8,0.2,1)',
        'slide-left': 'slide-left 0.3s cubic-bezier(0.2,0.8,0.2,1)',
        pop: 'pop 0.35s cubic-bezier(0.2,0.8,0.2,1)',
        'pulse-ring': 'pulse-ring 1.2s ease-out infinite',
        rise: 'rise 0.6s cubic-bezier(0.2,0.8,0.2,1)',
        strobe: 'strobe 0.9s steps(1,end) infinite',
        slam: 'slam 0.6s cubic-bezier(0.2,0.9,0.2,1)',
        shake: 'shake 0.6s ease-in-out',
        'card-idle': 'card-idle 3.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
