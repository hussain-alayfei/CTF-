import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // `@` maps to `src/` so imports survive file moves (see src/AGENT_MAP.md).
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
