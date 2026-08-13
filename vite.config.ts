import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: {
    // MediaPipe's classic WASM loader calls importScripts(). Keep its worker classic.
    format: 'iife',
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  server: {
    headers: {
      'Permissions-Policy': 'camera=(self), microphone=()',
    },
  },
});
