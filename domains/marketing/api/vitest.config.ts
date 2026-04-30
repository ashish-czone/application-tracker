import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'path';
import { buildPackageAliases, buildDomainAliases } from '../../../packages/resolve-aliases';

export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.test.ts'],
    exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
  resolve: {
    alias: {
      ...buildPackageAliases(path.resolve(__dirname, '../../../packages')),
      ...buildDomainAliases(path.resolve(__dirname, '../../../domains')),
    },
  },
});
