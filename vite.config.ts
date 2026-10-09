import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The Three.js scene is a lazy chunk (~150 kB gzip) loaded after the page is interactive.
export default defineConfig({ plugins: [react()], build: { chunkSizeWarningLimit: 700 } });
