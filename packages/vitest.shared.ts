import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@packages': path.resolve(__dirname),
    },
  },
});
