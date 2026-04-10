import { createViTestIntegrationConfig } from '../../core/testing/vitest-integration';

export default createViTestIntegrationConfig(__dirname, {
  test: {
    setupFiles: ['./test/setup-field-types.ts'],
  },
});
