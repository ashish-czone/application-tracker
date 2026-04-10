import type { Config } from 'tailwindcss';
import baseConfig from '../../packages/core/ui/tailwind.config';

const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    // @packages/ui (core)
    '../../packages/core/ui/components/**/*.{ts,tsx}',
    '../../packages/core/ui/hooks/**/*.{ts,tsx}',
    '../../packages/core/ui/lib/**/*.{ts,tsx}',
    // @packages/entity-engine-ui (platform)
    '../../packages/platform/entity-engine-ui/*.{ts,tsx}',
    '../../packages/platform/entity-engine-ui/components/**/*.{ts,tsx}',
    '../../packages/platform/entity-engine-ui/helpers/**/*.{ts,tsx}',
    '../../packages/platform/entity-engine-ui/pages/**/*.{ts,tsx}',
    // @packages/eav-attributes-ui (platform)
    '../../packages/platform/eav-attributes-ui/components/**/*.{ts,tsx}',
    '../../packages/platform/eav-attributes-ui/field-types/**/*.{ts,tsx}',
    '../../packages/platform/eav-attributes-ui/helpers/**/*.{ts,tsx}',
    // @packages/platform-ui (platform)
    '../../packages/platform/platform-ui/*.{ts,tsx}',
    '../../packages/platform/platform-ui/audit/**/*.{ts,tsx}',
    '../../packages/platform/platform-ui/conditions/**/*.{ts,tsx}',
    '../../packages/platform/platform-ui/notification-channels/**/*.{ts,tsx}',
    '../../packages/platform/platform-ui/automations/**/*.{ts,tsx}',
    '../../packages/platform/platform-ui/notifications/**/*.{ts,tsx}',
    '../../packages/platform/platform-ui/rbac/**/*.{ts,tsx}',
    '../../packages/platform/platform-ui/settings/**/*.{ts,tsx}',
    '../../packages/platform/platform-ui/tasks/**/*.{ts,tsx}',
    '../../packages/platform/platform-ui/taxonomy/*.{ts,tsx}',
    '../../packages/platform/platform-ui/taxonomy/components/**/*.{ts,tsx}',
    '../../packages/platform/platform-ui/taxonomy/pages/**/*.{ts,tsx}',
    '../../packages/platform/platform-ui/users/**/*.{ts,tsx}',
    '../../packages/platform/platform-ui/workflows/**/*.{ts,tsx}',
  ],
};

export default config;
