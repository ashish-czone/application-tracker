import type { Config } from 'tailwindcss';
import baseConfig from '../../packages/ui/tailwind.config';

const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/**/*.{ts,tsx}',
    '../../packages/auth-ui/**/*.{ts,tsx}',
  ],
};

export default config;
