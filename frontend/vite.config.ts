import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 80,
    host: true,
    proxy: {
      '/api': {
        target: 'http://backend:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://backend:4000',
        changeOrigin: true,
        ws: true,
      },
      '/media': {
        target: 'http://backend:4000',
        changeOrigin: true,
      },
    },
  },
});
