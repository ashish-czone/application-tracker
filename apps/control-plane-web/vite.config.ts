import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { buildPackageAliases } from '../../packages/resolve-aliases';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@modules': path.resolve(__dirname, 'src/modules'),
      ...buildPackageAliases(path.resolve(__dirname, '../../packages')),
    },
  },
  server: {
    port: 5180,
    proxy: {
      '/api': {
        target: 'http://localhost:3013',
        changeOrigin: true,
      },
    },
  },
});
