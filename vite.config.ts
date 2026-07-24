import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  clearScreen: false,
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    watch: {
      usePolling: true,
      ignored: [
        '**/src-tauri/target/**',
        '**/src-tauri/target',
        '**/src-tauri/target/debug/deps/**',
        '**/*.exe',
      ],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
});
