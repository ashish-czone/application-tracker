import type { Config } from 'tailwindcss';
import baseConfig from '../../packages/core/ui/tailwind.config';

const config: Config = {
  ...baseConfig,
  content: ['./src/**/*.{ts,tsx}', './index.html'],
};

export default config;
