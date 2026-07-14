import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      // Local stand-in for vercel.json headers on the Day 8 ping asset.
      name: 'day8-ping-header',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] === '/challenges/day8/ping.txt') {
            res.setHeader('X-Desk-Ticket', 'mirror-7');
          }
          next();
        });
      },
    },
  ],
  resolve: {
    // `@` maps to `src/` so imports survive file moves (see src/AGENT_MAP.md).
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});