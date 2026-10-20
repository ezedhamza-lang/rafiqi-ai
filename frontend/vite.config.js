import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = process.env.VITE_PROXY_TARGET || 'http://localhost:3001';
const wsTarget = target.replace(/^http/, 'ws');
// محلي فقط:allows the proxied API to accept requests coming from the Vite dev server
// (the backend's CORS allow-list usually contains the production origin only).
const proxyOrigin = process.env.VITE_PROXY_ORIGIN || '';
const originRewrite = proxyOrigin
  ? {
      configure(proxy) {
        proxy.on('proxyReq', (proxyReq) => proxyReq.setHeader('Origin', proxyOrigin));
      }
    }
  : {};

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target,
        changeOrigin: true,
        ...originRewrite
      },
      '/uploads': {
        target,
        changeOrigin: true,
        ...originRewrite
      },
      '/assets': {
        target,
        changeOrigin: true,
        ...originRewrite
      },
      '/images': {
        target,
        changeOrigin: true,
        ...originRewrite
      },
      '/media': {
        target,
        changeOrigin: true,
        ...originRewrite
      },
      '/plans': {
        target,
        changeOrigin: true,
        ...originRewrite
      },
      '/ws': {
        target: wsTarget,
        changeOrigin: true,
        ws: true
      }
    },
    allowedHosts: []
  },
  build: {
    // livekit-client is a large third-party SDK, already lazy-loaded on demand.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  }
});
