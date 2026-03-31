import type { Config } from 'tailwindcss';
import baseConfig from '../../packages/ui/tailwind.config';

const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    // @packages/ui
    '../../packages/ui/components/**/*.{ts,tsx}',
    '../../packages/ui/hooks/**/*.{ts,tsx}',
    '../../packages/ui/lib/**/*.{ts,tsx}',
    // @packages/entity-engine-ui
    '../../packages/entity-engine-ui/*.{ts,tsx}',
    '../../packages/entity-engine-ui/components/**/*.{ts,tsx}',
    '../../packages/entity-engine-ui/helpers/**/*.{ts,tsx}',
    '../../packages/entity-engine-ui/pages/**/*.{ts,tsx}',
    // @packages/eav-attributes-ui
    '../../packages/eav-attributes-ui/components/**/*.{ts,tsx}',
    '../../packages/eav-attributes-ui/field-types/**/*.{ts,tsx}',
    '../../packages/eav-attributes-ui/helpers/**/*.{ts,tsx}',
    // @packages/entity-relations-ui
    '../../packages/entity-relations-ui/field-types/**/*.{ts,tsx}',
    // @packages/platform-ui
    '../../packages/platform-ui/*.{ts,tsx}',
    '../../packages/platform-ui/audit/**/*.{ts,tsx}',
    '../../packages/platform-ui/conditions/**/*.{ts,tsx}',
    '../../packages/platform-ui/notification-channels/**/*.{ts,tsx}',
    '../../packages/platform-ui/notifications/**/*.{ts,tsx}',
    '../../packages/platform-ui/rbac/**/*.{ts,tsx}',
    '../../packages/platform-ui/settings/**/*.{ts,tsx}',
    '../../packages/platform-ui/tasks/**/*.{ts,tsx}',
    '../../packages/platform-ui/taxonomy/**/*.{ts,tsx}',
    '../../packages/platform-ui/users/**/*.{ts,tsx}',
    '../../packages/platform-ui/workflows/**/*.{ts,tsx}',
  ],
};

export default config;
