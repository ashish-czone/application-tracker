import type { PermissionManifest } from '@packages/rbac';

/**
 * Marketing domain permission constants.
 *
 * Hand-written services/controllers (no entity-engine), so every permission
 * is declared here and registered via `RbacIntegrationModule.forFeature`
 * inside each module that needs them.
 */
export const MARKETING_PERMISSIONS = {
  MONITORING_SOURCES_READ: 'marketing.monitoring-sources.read',
  MONITORING_SOURCES_MANAGE: 'marketing.monitoring-sources.manage',
  MONITORING_KEYWORDS_READ: 'marketing.monitoring-keywords.read',
  MONITORING_KEYWORDS_MANAGE: 'marketing.monitoring-keywords.manage',
} as const;

export type MarketingPermission =
  (typeof MARKETING_PERMISSIONS)[keyof typeof MARKETING_PERMISSIONS];

export const MONITORING_SOURCES_PERMISSION_MANIFESTS: PermissionManifest[] = [
  {
    slug: 'marketing.monitoring-sources.read',
    module: 'marketing',
    action: 'monitoring-sources.read',
    label: 'View monitoring sources',
    description: 'View configured Reddit / HN / RSS sources used for the monitoring inbox',
    supportedScopes: ['any'],
  },
  {
    slug: 'marketing.monitoring-sources.manage',
    module: 'marketing',
    action: 'monitoring-sources.manage',
    label: 'Manage monitoring sources',
    description: 'Add, edit, enable, disable, or delete monitoring sources',
    supportedScopes: ['any'],
  },
];

export const MONITORING_KEYWORDS_PERMISSION_MANIFESTS: PermissionManifest[] = [
  {
    slug: 'marketing.monitoring-keywords.read',
    module: 'marketing',
    action: 'monitoring-keywords.read',
    label: 'View monitoring keywords',
    description: 'View per-source keyword watchers used to filter the monitoring inbox',
    supportedScopes: ['any'],
  },
  {
    slug: 'marketing.monitoring-keywords.manage',
    module: 'marketing',
    action: 'monitoring-keywords.manage',
    label: 'Manage monitoring keywords',
    description: 'Add, edit, enable, disable, or delete keyword watchers',
    supportedScopes: ['any'],
  },
];
