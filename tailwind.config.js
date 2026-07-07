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
      },
      animation: {
        flicker: 'flicker 3s ease-in-out infinite',
        'slide-down': 'slide-down 0.4s cubic-bezier(0.2,0.8,0.2,1)',
        'slide-left': 'slide-left 0.3s cubic-bezier(0.2,0.8,0.2,1)',
        pop: 'pop 0.35s cubic-bezier(0.2,0.8,0.2,1)',
        'pulse-ring': 'pulse-ring 1.2s ease-out infinite',
        rise: 'rise 0.6s cubic-bezier(0.2,0.8,0.2,1)',
      },
    },
  },
  plugins: [],
};
