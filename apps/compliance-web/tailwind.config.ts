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
    // @packages/app-shell-ui (platform)
    '../../packages/platform/app-shell-ui/index.tsx',
    '../../packages/platform/app-shell-ui/src/**/*.{ts,tsx}',
    // @packages/entity-engine-ui (platform)
    '../../packages/platform/entity-engine/ui/*.{ts,tsx}',
    '../../packages/platform/entity-engine/ui/components/**/*.{ts,tsx}',
    '../../packages/platform/entity-engine/ui/helpers/**/*.{ts,tsx}',
    '../../packages/platform/entity-engine/ui/pages/**/*.{ts,tsx}',
    // @packages/eav-attributes-ui (platform)
    '../../packages/platform/eav-attributes-ui/components/**/*.{ts,tsx}',
    '../../packages/platform/eav-attributes-ui/field-types/**/*.{ts,tsx}',
    '../../packages/platform/eav-attributes-ui/helpers/**/*.{ts,tsx}',
    // @packages/entity-relations-ui (addons)
    '../../packages/addons/entity-relations-ui/field-types/**/*.{ts,tsx}',
    // @packages/notes-ui (addons)
    '../../packages/addons/notes-ui/components/**/*.tsx',
    // @packages/attachments-ui (addons)
    '../../packages/addons/attachments-ui/components/**/*.tsx',
    // @packages/evaluations-ui (addons)
    '../../packages/addons/evaluations-ui/components/**/*.tsx',
    // @packages/platform-ui (platform)
    '../../packages/platform/platform-ui/*.{ts,tsx}',
    '../../packages/platform/platform-ui/audit/**/*.{ts,tsx}',
    '../../packages/platform/platform-ui/conditions/*.tsx',
    // @packages/notification-channels-ui (platform)
    '../../packages/platform/notification-channels/ui/**/*.{ts,tsx}',
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
    // Compliance domain UI
    '../../domains/compliance/ui/**/*.{ts,tsx}',
  ],
};

export default config;
