import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../vitest.shared';

// Force UTC so date-fns getHours() returns UTC hours, making tests deterministic
// regardless of the system timezone. This matches the intent of localHourToUtcHour().
process.env.TZ = 'UTC';

export default mergeConfig(shared, defineConfig({
  test: {
    include: ['**/*.test.ts'],
    globals: false,
  },
}));
