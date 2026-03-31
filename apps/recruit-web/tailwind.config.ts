import type { Config } from 'tailwindcss';
import baseConfig from '../../packages/ui/tailwind.config';

const config: Config = {
  ...baseConfig,
  content: {
    files: [
      './src/**/*.{ts,tsx}',
      '../../packages/ui/**/*.{ts,tsx}',
      '../../packages/entity-engine-ui/**/*.{ts,tsx}',
      '../../packages/eav-attributes-ui/**/*.{ts,tsx}',
      '../../packages/entity-relations-ui/**/*.{ts,tsx}',
      '../../packages/platform-ui/**/*.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**'],
  },
};

export default config;
