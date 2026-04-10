import type { Config } from 'tailwindcss';
import baseConfig from '../../packages/core/ui/tailwind.config';

const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/core/ui/**/*.{ts,tsx}',
  ],
};

export default config;
