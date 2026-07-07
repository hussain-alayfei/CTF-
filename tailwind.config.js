/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        terminal: {
          bg: '#0a0e0a',
          panel: '#0f150f',
          border: '#1c2a1c',
          green: '#39ff14',
          dim: '#7a8a7a',
          amber: '#ffb000',
          red: '#ff3b3b',
          cyan: '#00e5ff',
        },
      },
      boxShadow: {
        neon: '0 0 8px rgba(57,255,20,0.6), 0 0 24px rgba(57,255,20,0.25)',
        'neon-red': '0 0 8px rgba(255,59,59,0.6), 0 0 24px rgba(255,59,59,0.25)',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-120%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(255,59,59,0.5)' },
          '100%': { boxShadow: '0 0 0 18px rgba(255,59,59,0)' },
        },
      },
      animation: {
        flicker: 'flicker 3s ease-in-out infinite',
        'slide-down': 'slide-down 0.4s cubic-bezier(0.2,0.8,0.2,1)',
        pop: 'pop 0.35s cubic-bezier(0.2,0.8,0.2,1)',
        'pulse-ring': 'pulse-ring 1.2s ease-out infinite',
      },
    },
  },
  plugins: [],
};
