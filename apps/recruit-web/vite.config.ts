import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@packages/platform-ui-taxonomy': path.resolve(__dirname, '../../packages/platform-ui/taxonomy'),
      '@packages/platform-ui-conditions': path.resolve(__dirname, '../../packages/platform-ui/conditions'),
      '@packages': path.resolve(__dirname, '../../packages'),
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT ?? '3011'}`,
        changeOrigin: true,
      },
    },
  },
});
