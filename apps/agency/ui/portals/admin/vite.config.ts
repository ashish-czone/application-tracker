import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { buildPackageAliases, buildDomainAliases } from '../../../../../packages/resolve-aliases';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      ...buildPackageAliases(path.resolve(__dirname, '../../../../../packages')),
      ...buildDomainAliases(path.resolve(__dirname, '../../../../../domains')),
    },
  },
  server: {
    port: 5177,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT ?? '3014'}`,
        changeOrigin: true,
      },
    },
  },
});
