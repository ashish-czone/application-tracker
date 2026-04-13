import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { buildPackageAliases, buildDomainAliases } from '../../packages/resolve-aliases';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@modules': path.resolve(__dirname, 'src/modules'),
      ...buildPackageAliases(path.resolve(__dirname, '../../packages')),
      ...buildDomainAliases(path.resolve(__dirname, '../../domains')),
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
