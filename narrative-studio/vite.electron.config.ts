import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process entry
        entry: 'electron/main.ts',
        onstart(args) {
          // Notify Electron to reload when main process changes
          args.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            sourcemap: true,
            rollupOptions: {
              external: [
                'electron',
                'electron-store',
                'better-sqlite3',
                'sqlite-vec'
              ]
            }
          }
        }
      },
      {
        // Preload script
        entry: 'electron/preload.ts',
        onstart(args) {
          // Reload renderer when preload changes
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            sourcemap: true,
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    // Enable Node.js integration in renderer for certain modules
    renderer({
      nodeIntegration: false // Keep false for security
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // Clear the terminal when restarting
  clearScreen: false,
  // Server config for dev
  server: {
    port: 5173,
    strictPort: false
  },
  // Build config
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  }
});
