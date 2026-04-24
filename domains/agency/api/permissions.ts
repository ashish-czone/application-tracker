import type { PermissionManifest } from '@packages/rbac';

export const AGENCY_PERMISSIONS = {} as const;

export type AgencyPermission =
  (typeof AGENCY_PERMISSIONS)[keyof typeof AGENCY_PERMISSIONS];

export const AGENCY_PERMISSION_MANIFESTS: PermissionManifest[] = [];
