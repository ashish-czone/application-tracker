import { defineConfig } from 'vitest/config';
import path from 'path';
import { buildPackageAliases } from './resolve-aliases';

export default defineConfig({
  resolve: {
    alias: buildPackageAliases(path.resolve(__dirname)),
  },
});
