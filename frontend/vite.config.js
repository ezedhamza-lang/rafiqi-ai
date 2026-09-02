import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = process.env.VITE_PROXY_TARGET || 'http://localhost:3001';
const wsTarget = target.replace(/^http/, 'ws');

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-livekit': ['livekit-client']
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target,
        changeOrigin: true
      },
      '/uploads': {
        target,
        changeOrigin: true
      },
      '/assets': {
        target,
        changeOrigin: true
      },
      '/images': {
        target,
        changeOrigin: true
      },
      '/media': {
        target,
        changeOrigin: true
      },
      '/svg': {
        target,
        changeOrigin: true
      },
      '/islamic': {
        target,
        changeOrigin: true
      },
      '/tech': {
        target,
        changeOrigin: true
      },
      '/science': {
        target,
        changeOrigin: true
      },
      '/intaj': {
        target,
        changeOrigin: true
      },
      '/plans': {
        target,
        changeOrigin: true
      },
      '/ws': {
        target: wsTarget,
        changeOrigin: true,
        ws: true
      }
    },
    allowedHosts: ['.monkeycode-ai.live']
  }
});
