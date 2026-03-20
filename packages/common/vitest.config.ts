import { defineConfig } from 'vitest/config';
import path from 'path';

// Force UTC so date-fns getHours() returns UTC hours, making tests deterministic
// regardless of the system timezone. This matches the intent of localHourToUtcHour().
process.env.TZ = 'UTC';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@packages': path.resolve(__dirname, '..'),
    },
  },
});
